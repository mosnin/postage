# Email System Audit

**Date:** 2026-03-29
**Scope:** `src/lib/email/resend.ts`, `src/emails/*.tsx`, `src/emails/components/email-layout.tsx`

---

## 1. Template Inventory

| Template file | Trigger function in `resend.ts` |
|---|---|
| `welcome.tsx` | `sendWelcomeEmail` |
| `invite-member.tsx` | `sendInviteEmail` |
| `post-approval-request.tsx` | `sendApprovalRequestReactEmail` |
| `post-approved.tsx` | `sendPostApprovedEmail` |
| `post-failed.tsx` | `sendPostFailedEmail` |
| `trial-expiring.tsx` | `sendTrialExpiringEmail` |
| `subscription-receipt.tsx` | `sendSubscriptionReceiptEmail` |
| `magic-link.tsx` | `sendMagicLinkEmail` |

Additionally, two **legacy plain-HTML helpers** exist for the same approval flow:
- `sendApprovalRequestEmail` (deprecated, uses `EMAIL_FROM` env var)
- `sendApprovalDecisionEmail` (covers rejected / changes-requested decisions — no React template equivalent)

---

## 2. Missing Templates

| Missing flow | Notes |
|---|---|
| **Post rejected / changes requested** | `sendApprovalDecisionEmail` handles rejection and change-requests via legacy plain HTML only; no React template covers these states |
| **Password reset** | No template or helper found (magic-link covers passwordless login but not explicit reset) |
| **Plan cancelled / subscription ended** | Receipt email exists but cancellation notification does not |
| **Trial started** | Welcome email exists but there is no "trial just started" transactional email distinct from welcome |
| **Team member removed** | Invite exists; removal notification does not |
| **Comment mention / activity digest** | No mention or digest template |

---

## 3. Deliverability Issues

| Check | Status | Detail |
|---|---|---|
| **List-Unsubscribe header** | Missing | The `sendEmail` core helper sends `{ from, to, subject, html }` to Resend — no `headers` field. CAN-SPAM / RFC 8058 requires `List-Unsubscribe` for marketing mail. The footer has an unsubscribe link but the header is absent. |
| **Plain-text fallback** | Missing | `render()` from `@react-email/render` is called without the `plainText: true` option; only `html` is passed to `resend.emails.send`. Spam filters penalise HTML-only messages. |
| **From address configurable** | Partial | React-email path uses `RESEND_FROM_EMAIL` (good). Legacy helpers use a separate `EMAIL_FROM` env var with a different default domain (`postage.app` vs `postsyncer.com`) — two env vars, two different defaults, brand mismatch. |
| **Preview text on templates** | Partial | `WelcomeEmail` sets preview text; other templates cannot be verified from these three files alone, but `EmailLayout.previewText` is optional so it may be omitted in some. |

---

## 4. Template Quality

| Check | Status | Detail |
|---|---|---|
| **Graceful handling of undefined props** | Partial | `WelcomeEmail` requires `userName` and `dashboardUrl` as non-optional strings — rendering with undefined would produce literal "undefined" in the heading. Legacy helpers use `?? "there"` fallbacks; React templates do not. |
| **Consistent layout wrapper** | Good | All React templates import `EmailLayout` from `./components/email-layout`. |
| **Mobile-responsive** | Good | `EmailLayout` uses a `maxWidth: 560px` centred table, system font stack, and `width=device-width` viewport meta. Card padding (`40px`) may be tight on small screens but the structure is sound. |
| **Dark-mode support** | Good | `color-scheme` and `supported-color-schemes` meta tags are present; colours are hardcoded (no `prefers-color-scheme` media query), which is the safe default for email. |
| **Preview text padding** | Good | `\u00A0\u200C` repeat(50) prevents body content bleeding into the preview snippet. |
| **Duplicate approval flow** | Risk | Both a legacy plain-HTML path and a React-email path exist for approval requests. Callers must pick the right one; the deprecated function is not removed. |

---

## 5. Quick Fixes (Priority Order)

1. **Add `List-Unsubscribe` header** — Pass `headers: { 'List-Unsubscribe': '<mailto:unsubscribe@postsyncer.com>', 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }` in `sendEmail`. Required for CAN-SPAM compliance and improves Gmail / Outlook deliverability.

2. **Add plain-text fallback** — Call `render(element, { plainText: true })` and pass the result as the `text` field alongside `html` in `resend.emails.send`. Reduces spam-filter score significantly.

3. **Consolidate `FROM_EMAIL` env vars** — Remove `EMAIL_FROM` from legacy helpers; both paths should read `RESEND_FROM_EMAIL` (or a single shared constant) to avoid the `postage.app` / `postsyncer.com` brand split.

4. **Add null/undefined guards to React template props** — At minimum `userName` in `WelcomeEmail` (and equivalent props in other templates) should default gracefully: `userName = "there"` in the destructure, matching the pattern already used in the legacy helpers.

5. **Create a React template for post rejected / changes-requested decisions** — `sendApprovalDecisionEmail` is the only user-facing decision notification and it uses unstyled legacy HTML. Migrate it to a React template (reusing `EmailLayout`) and delete the legacy `sendLegacyEmail` path once all callers are updated.
