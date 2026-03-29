# Billing Audit — PostSyncer

**Date:** 2026-03-29
**Auditor:** Claude Code
**Scope:** `src/lib/stripe.ts`, `src/app/api/billing/**`, `prisma/schema.prisma` (Subscription model)

---

## Executive Summary

The billing implementation covers the happy path well but has several reliability and correctness gaps. The most critical issues are: (1) no idempotency key on Stripe customer creation leading to potential duplicate customers, (2) the `customer.subscription.created` idempotency guard silently drops the event if a record already exists from `getOrCreateStripeCustomer`, (3) several important Stripe webhook events are completely unhandled, (4) no periodic sync mechanism if webhooks are missed, (5) trial expiry is stored but never actively enforced, and (6) the `.env.example` is missing annual price ID variables referenced in code.

Severity key: **CRITICAL** | **HIGH** | **MEDIUM** | **LOW**

---

## Finding 1 — Stripe Customer Deduplication Race Condition [CRITICAL]

**File:** `src/lib/stripe.ts:22-53`

`getOrCreateStripeCustomer` reads the DB for an existing `stripeCustomerId`, and if absent, calls `stripe.customers.create`. Under concurrent requests (e.g. two browser tabs opening checkout simultaneously) both requests can pass the `if (subscription?.stripeCustomerId)` check before either has written the new customer to the DB, resulting in two Stripe customers for the same workspace.

```ts
// stripe.ts:28-33 — no lock between check and create
const subscription = await db.subscription.findUnique({ where: { workspaceId } });
if (subscription?.stripeCustomerId) {
  return subscription.stripeCustomerId;
}
const customer = await stripe.customers.create({ email, metadata: { workspaceId } });
```

**Fix:** Use a Stripe idempotency key so that concurrent calls produce only one customer:

```ts
const customer = await stripe.customers.create(
  { email, metadata: { workspaceId } },
  { idempotencyKey: `customer-create-${workspaceId}` }
);
```

Additionally, add a `try/catch` around the `db.subscription.upsert` and use a DB unique constraint (already present as `@unique` on `stripeCustomerId`) to detect and recover from the duplicate.

---

## Finding 2 — Webhook Idempotency: `customer.subscription.created` Silently Discards Updates [HIGH]

**File:** `src/app/api/billing/webhook/route.ts:79-82`

The idempotency guard for `handleSubscriptionCreated` returns early whenever a subscription record already has the matching `stripeSubscriptionId`. This means if Stripe retries the event (e.g. after a 500 response), or if a trial subscription was created by `getOrCreateStripeCustomer` before Stripe sent the webhook, the subscription record will never be updated with the real period start/end, price, or trial-end timestamps from Stripe.

```ts
// webhook/route.ts:79-82
const existing = await db.subscription.findFirst({
  where: { stripeSubscriptionId: subscription.id },
});
if (existing) return; // ← silently drops any field updates
```

**Fix:** The `customer.subscription.updated` handler already handles upserts without early-exit. Remove the early-exit guard from `handleSubscriptionCreated` entirely, or compare `updatedAt` against `event.created` to detect stale replays.

---

## Finding 3 — Missing Webhook Event Handlers [HIGH]

**File:** `src/app/api/billing/webhook/route.ts:34-68`

The following Stripe events are received but fall through to the silent `default` case. Each represents a real user-facing state change:

| Missing Event | Impact |
|---|---|
| `invoice.payment_succeeded` | No subscription receipt email sent; `sendSubscriptionReceiptEmail` exists in `src/lib/email/resend.ts` but is never called from billing flows |
| `invoice.upcoming` | No trial-ending or renewal warning email triggered |
| `customer.subscription.trial_will_end` | The `sendTrialExpiringEmail` helper exists but is never wired to a webhook |
| `checkout.session.completed` | Plan is not synced until the async `customer.subscription.created` event arrives; a missed subscription webhook leaves the workspace on `TRIALING/FREE` indefinitely |
| `customer.updated` | If a customer's email changes in Stripe the local record is never updated |
| `payment_method.attached` / `payment_method.detached` | No local tracking of default payment method status |
| `invoice.finalized` | No receipt tracking |

**Minimum required additions:**

```ts
case "invoice.payment_succeeded": {
  // send receipt email, set status ACTIVE
  break;
}
case "customer.subscription.trial_will_end": {
  // send trial-expiring email (helper already exists)
  break;
}
case "checkout.session.completed": {
  // fallback sync: retrieve subscription from session and upsert
  break;
}
```

---

## Finding 4 — Subscription Status Sync: No Recovery From Missed Webhooks [HIGH]

**File:** `src/lib/stripe.ts`, `src/app/api/billing/webhook/route.ts`

There is no background job or on-demand reconciliation call that re-fetches subscription state from the Stripe API. If a webhook is missed (Stripe stops retrying after 72 hours) the local DB record can permanently diverge from Stripe truth. Concretely:

- A subscription cancelled via the Stripe dashboard will leave `status = ACTIVE` locally.
- A payment that eventually succeeds after retries (`past_due → active`) will not transition locally unless `customer.subscription.updated` is received.

**Fix:** Add a `/api/billing/sync` internal endpoint (or a cron job) that calls `stripe.subscriptions.retrieve(stripeSubscriptionId)` and re-runs the same upsert logic on every billing page load, or at minimum on app startup per workspace. Alternatively, expose it as a Stripe reconciliation run on first load when `currentPeriodEnd` is in the past.

---

## Finding 5 — Trial Handling: Expiry Not Enforced [HIGH]

**File:** `prisma/schema.prisma:157`, `src/lib/plans.ts`, `src/app/api/billing/webhook/route.ts`

`trialEndsAt` is stored correctly when a subscription is created. However:

1. No server-side middleware or API guard checks whether `trialEndsAt < now()` and demotes the plan if the trial has lapsed without a paid subscription.
2. The `status` field will be `TRIALING` until Stripe sends a `customer.subscription.updated` event transitioning to `past_due` or `canceled`. If that event is missed, the workspace keeps full access indefinitely.
3. There is no trial-will-end email trigger (see Finding 3).

**Fix:**
- Add a guard in `src/lib/workspace.ts` (or wherever plan-gating reads the subscription) that returns `FREE` effective plan when `status === 'TRIALING' && trialEndsAt !== null && trialEndsAt < new Date()`.
- Wire `customer.subscription.trial_will_end` webhook to call `sendTrialExpiringEmail`.

---

## Finding 6 — Plan Downgrade: No Data Truncation Logic [MEDIUM]

**File:** `src/app/api/billing/webhook/route.ts:125-171`, `src/lib/plans.ts`

When `handleSubscriptionUpdated` detects a plan change (e.g. PRO_PLUS → STARTER), it updates `workspace.plan` and `subscription.plan` but does not:

1. Disconnect social accounts that exceed the new plan's account limit.
2. Reduce AI credits to the lower plan's limit.
3. Revoke API key access if downgrading to FREE.
4. Archive or flag scheduled posts that exceed the new post quota.

The `PLAN_FEATURES` map in `src/lib/plans.ts` defines limits but `handleSubscriptionUpdated` never consults it.

**Fix:** After updating the plan, compare `oldPlan` vs `newPlan` rank using `PLAN_RANK` and run cleanup tasks asynchronously (fire-and-forget with error logging) or queue them. At minimum, soft-limit excess connected accounts by setting their `status` to `DISCONNECTED`.

---

## Finding 7 — Proration Handling Not Configured [MEDIUM]

**File:** `src/app/api/billing/create-checkout/route.ts:47-68`

The checkout session creation does not set `subscription_data.proration_behavior`. Stripe defaults to `create_prorations` which is usually correct, but:

1. There is no customer portal configuration (see Finding 12) that explicitly sets proration behaviour, so mid-cycle upgrades via the portal use Stripe's default.
2. Immediate mid-cycle downgrades via portal will generate credit notes, but the app has no `invoice.payment_succeeded` or `credit_note.created` handlers to reflect the change.
3. There is no `trial_from_plan` or `trial_end` override set in checkout, meaning new paid checkouts created while a local `TRIALING` subscription exists may create a second parallel Stripe subscription.

---

## Finding 8 — Missing Metadata on Stripe Checkout Session [MEDIUM]

**File:** `src/app/api/billing/create-checkout/route.ts:59-67`

`workspaceId` is correctly added to both `subscription_data.metadata` and the session-level `metadata`. However:

1. The customer's `name` is never passed to `stripe.customers.create` — only `email` and `workspaceId` are set (`src/lib/stripe.ts:36-39`). Stripe invoices, receipts, and the dashboard will show a blank name.
2. The checkout session does not set `customer_update: { name: 'auto' }` so name is never backfilled from the checkout form.
3. No `userId` is stored in subscription or customer metadata, making it impossible to trace a Stripe object back to a specific user without going through the workspace.

**Fix (stripe.ts:36-39):**

```ts
const customer = await stripe.customers.create({
  email,
  name: workspaceName,          // pass workspace name
  metadata: { workspaceId, userId }, // add userId
});
```

---

## Finding 9 — Payment Failure Handling Gaps [MEDIUM]

**File:** `src/app/api/billing/webhook/route.ts:201-242`

The `invoice.payment_failed` handler:

1. Sets status to `PAST_DUE` only once (idempotency check at line 214). On a second failed retry the handler is a no-op — no escalating notification is sent.
2. Instantiates `new Resend(...)` inline rather than using the shared `resend` client from `src/lib/email/resend.ts`, bypassing the React Email template system (`src/emails/`) and the `FROM_EMAIL` env var, meaning the `from` address is hard-coded as `billing@postsyncer.com` while all other emails use `RESEND_FROM_EMAIL`.
3. Does not handle `invoice.payment_action_required` (3D Secure / SCA), where `status` should remain `TRIALING`/`ACTIVE` but the user needs to complete authentication.
4. No dunning counter is tracked (e.g. how many retries have occurred), so there is no mechanism to send escalating "final warning" emails.

**Fix:** Replace inline Resend instantiation with the shared `sendEmail` helper from `src/lib/email/resend.ts`:

```ts
// webhook/route.ts — replace inline Resend usage
import { sendEmail } from "@/lib/email/resend";
import PaymentFailedEmail from "@/emails/payment-failed"; // create this template
```

---

## Finding 10 — Error Handling in Checkout Creation [LOW]

**File:** `src/app/api/billing/create-checkout/route.ts:71-74`

The catch block returns a generic `"Internal server error"` for all Stripe errors. Stripe throws typed errors (`Stripe.errors.StripeCardError`, `StripeInvalidRequestError`, etc.) that carry user-actionable messages. In particular:

- `StripeInvalidRequestError` with `param: 'customer'` means the stored `stripeCustomerId` no longer exists in Stripe (deleted manually in dashboard). The current code will return 500 with no recovery path.
- `StripeCardError` during checkout creation (rare but possible on recurring billing) should surface the decline message.

**Fix:** Catch `Stripe.errors.StripeError` specifically and map `error.type` to appropriate HTTP status codes and user messages.

---

## Finding 11 — Customer Portal Not Configured Explicitly [LOW]

**File:** `src/app/api/billing/portal/route.ts:43-46`

`stripe.billingPortal.sessions.create` is called with only `customer` and `return_url`. The portal's feature set (which plans are available for upgrade/downgrade, whether cancellation is allowed, proration settings) is configured in the Stripe Dashboard under **Customer Portal settings**, not in code. This means:

1. A Stripe Dashboard misconfiguration silently enables or disables cancellation, plan switches, and payment method updates with no code-side guard.
2. The portal does not pass `flow_data` to send the user directly to a specific flow (e.g. straight to payment method update after a failed payment).

**Recommendation:** Document the required Stripe Dashboard portal configuration in a runbook, and consider passing `flow_data: { type: 'payment_method_update' }` when redirecting from a `PAST_DUE` banner.

---

## Finding 12 — Test Mode vs Live Mode Safety [LOW]

**File:** `src/lib/stripe.ts:3`, `src/app/api/billing/data/route.ts:62-85`

1. There is no runtime assertion that `STRIPE_SECRET_KEY` starts with `sk_live_` in production (`NODE_ENV === 'production'`). A misconfigured production deploy using a `sk_test_` key will silently process fake payments.
2. `data/route.ts:65` already has a guard `!process.env.STRIPE_SECRET_KEY.startsWith("sk_test_placeholder")` to skip invoice fetching, but this only covers a placeholder value — a real `sk_test_*` key will hit live Stripe in production.
3. `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is exposed to the browser. If a `pk_live_` key is accidentally used with a `sk_test_` backend (or vice versa), Stripe will silently reject all checkout sessions.

**Fix (stripe.ts):**

```ts
if (process.env.NODE_ENV === 'production') {
  const key = process.env.STRIPE_SECRET_KEY ?? '';
  if (!key.startsWith('sk_live_')) {
    throw new Error('STRIPE_SECRET_KEY must be a live key in production');
  }
}
```

---

## Finding 13 — Annual Price IDs Missing From `.env.example` [LOW]

**File:** `src/lib/stripe.ts:8-14`, `.env.example:16-21`

`STRIPE_PLANS` references six price IDs including three annual variants (`STRIPE_STARTER_ANNUAL_PRICE_ID`, `STRIPE_PRO_ANNUAL_PRICE_ID`, `STRIPE_PRO_PLUS_ANNUAL_PRICE_ID`), but `.env.example` only lists the three monthly IDs. A developer setting up the project from `.env.example` will get `undefined` for annual price IDs, and `getPlanFromPriceId` will silently fall back to `"STARTER"` for any annual checkout attempt.

**Fix:** Add the three missing annual price ID variables to `.env.example`.

---

## Finding 14 — `handleSubscriptionDeleted` Upsert Creates Orphan Records [LOW]

**File:** `src/app/api/billing/webhook/route.ts:180-198`

The `create` branch of the upsert in `handleSubscriptionDeleted` omits `stripePriceId`, `currentPeriodStart`, `currentPeriodEnd`, and `trialEndsAt`. While these fields are nullable in the schema, the more dangerous issue is that if Stripe sends a `subscription.deleted` event for a workspace that has no local subscription record (e.g. after a data migration), the handler will create a new `CANCELED/FREE` subscription row with only `stripeSubscriptionId` and `stripeCustomerId` set. This orphan record will block future `getOrCreateStripeCustomer` from creating a valid Stripe customer because `stripeCustomerId` is `@unique`.

---

## Finding 15 — `mapStripeStatus` Default Falls Through to `ACTIVE` [LOW]

**File:** `src/app/api/billing/webhook/route.ts:258-262`

The `default` branch of `mapStripeStatus` returns `"ACTIVE"`. The `incomplete` and `incomplete_expired` Stripe statuses (which occur when an initial payment attempt fails during subscription creation) are not mapped and will incorrectly mark the subscription as `ACTIVE`, granting access before payment is confirmed.

```ts
// webhook/route.ts:258-262
default:
  return "ACTIVE"; // ← incorrect for 'incomplete', 'incomplete_expired'
```

**Fix:**

```ts
case "incomplete":
  return "PAST_DUE";
case "incomplete_expired":
  return "CANCELED";
default:
  console.warn(`[mapStripeStatus] Unhandled Stripe status: ${status}`);
  return "CANCELED"; // fail-safe: deny access for unknown states
```

---

## Summary Table

| # | Finding | Severity | File | Line(s) |
|---|---|---|---|---|
| 1 | Customer creation race condition / no idempotency key | CRITICAL | `src/lib/stripe.ts` | 36-52 |
| 2 | `subscription.created` early-exit discards field updates on replay | HIGH | `webhook/route.ts` | 79-82 |
| 3 | Missing webhook handlers (payment_succeeded, trial_will_end, checkout.completed) | HIGH | `webhook/route.ts` | 34-68 |
| 4 | No sync/recovery when webhooks are missed | HIGH | `webhook/route.ts` | — |
| 5 | Trial expiry not actively enforced | HIGH | `webhook/route.ts`, `schema.prisma` | 157 |
| 6 | Plan downgrade does not truncate data | MEDIUM | `webhook/route.ts` | 125-171 |
| 7 | Proration not explicitly configured | MEDIUM | `create-checkout/route.ts` | 47-68 |
| 8 | Missing customer name and userId in Stripe metadata | MEDIUM | `src/lib/stripe.ts` | 36-39 |
| 9 | Payment failure handler uses inline Resend, no SCA handling | MEDIUM | `webhook/route.ts` | 201-242 |
| 10 | Generic catch hides Stripe-typed errors in checkout | LOW | `create-checkout/route.ts` | 71-74 |
| 11 | Customer portal not explicitly configured in code | LOW | `portal/route.ts` | 43-46 |
| 12 | No test-vs-live key assertion in production | LOW | `src/lib/stripe.ts` | 3 |
| 13 | Annual price IDs missing from `.env.example` | LOW | `.env.example` | 16-21 |
| 14 | `subscription.deleted` upsert create branch can create orphan records | LOW | `webhook/route.ts` | 180-198 |
| 15 | `mapStripeStatus` default returns `ACTIVE` for `incomplete` status | LOW | `webhook/route.ts` | 258-262 |
