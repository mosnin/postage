# GDPR & Privacy Compliance Audit — PostSyncer

**Date:** 2026-03-29
**Auditor:** Claude Code (Anthropic)
**Scope:** Full codebase at `/home/user/postage`
**Standard:** GDPR (EU 2016/679), ePrivacy Directive

---

## Executive Summary

PostSyncer has a reasonable security foundation (bcrypt, JWT sessions, CSRF protection on OAuth) but has **critical GDPR gaps** that must be addressed before operating in the EU or serving EU data subjects. The most urgent issues are: no self-service account deletion for users, no data export (GDPR Art. 20), no Privacy Policy or Terms of Service pages, no cookie consent banner, and OAuth tokens stored in plaintext in the database.

**Risk rating: HIGH** — multiple mandatory GDPR requirements are unmet.

---

## Findings by Category

---

### 1. Data Deletion Flows

**Status: PARTIAL — CRITICAL GAP**

**What exists:**
- Workspace deletion: `DELETE /api/workspace/settings` — owners can delete a workspace; Prisma cascade deletes all workspace-scoped data (posts, social accounts, media, analytics, activity logs) via `onDelete: Cascade` on all workspace relations.
- Admin deletion: `DELETE /api/admin/users/[id]` — super-admins can delete any user account.

**What is missing:**
- **No self-service "Delete My Account" endpoint or UI for regular users.** The profile settings page (`/settings/profile`) has no account deletion section. Users cannot exercise their GDPR Art. 17 "Right to Erasure" without contacting an admin.
- The admin-only deletion at `/api/admin/users/[id]` prevents self-deletion (`if (id === session.user.id) return 400`). This is correct for the admin route but underscores that no user-facing equivalent exists.
- Deleting a workspace does **not** delete the `User` record. A user who owns multiple workspaces must delete all workspaces and then separately request account deletion — which requires admin action. This violates the right to erasure.
- There is no check that the Stripe customer record is deleted/anonymised in Stripe when a user account is deleted. Stripe retains billing data independently.

**Required implementations:**
1. Add `DELETE /api/settings/profile` (or `/api/settings/account`) that:
   - Verifies the user's password or sends a confirmation email before proceeding.
   - Transfers or deletes all owned workspaces.
   - Cancels any active Stripe subscriptions via `stripe.subscriptions.cancel()`.
   - Deletes or anonymises the Stripe customer via `stripe.customers.del()`.
   - Calls `db.user.delete({ where: { id } })`, which cascades to accounts, sessions, API keys, and activity logs.
2. Add a "Danger Zone — Delete Account" section to `/settings/profile`.

---

### 2. Data Export (GDPR Art. 20 — Right to Data Portability)

**Status: MISSING — CRITICAL GAP**

**What exists:**
- A CSV export utility exists at `src/lib/csv.ts` used for the analytics dashboard export (client-side download of analytics data only).
- No API endpoint or UI exists for a full personal data export.

**Required implementations:**
1. Implement `GET /api/settings/export` that compiles and returns a machine-readable JSON or ZIP archive containing all data held about the requesting user:
   - Profile data (name, email, image, created date)
   - All workspace memberships
   - All posts authored by the user
   - All social accounts linked to their workspaces
   - All activity log entries attributed to the user
   - All API keys (metadata only, not hashes)
2. Add a "Download My Data" button to `/settings/profile`.
3. Provide the export in a structured, commonly used, machine-readable format (JSON is sufficient; CSV per entity type is also acceptable).

---

### 3. Consent Management

**Status: MISSING — CRITICAL GAP**

**Cookie Consent:**
- There is no cookie consent banner anywhere in the codebase. The marketing layout (`/src/app/(marketing)/layout.tsx`), root layout (`/src/app/layout.tsx`), and all page files contain no consent UI component.
- The footer links to `/cookies` but this page does not exist.
- NextAuth sets a `__Secure-next-auth.session-token` JWT cookie. Under ePrivacy / GDPR, this strictly-necessary session cookie does not require consent — but users must be informed it exists via a Cookie Policy.

**Marketing Consent:**
- The registration form (`/src/app/(auth)/register/`) and onboarding page have no marketing opt-in checkbox.
- The `User` model has no `marketingConsent` or `cookieConsent` boolean field.
- Notification preferences exist in the UI (`/settings/notifications`) but they only cover operational notifications (post published, team invites, billing) — they are not persisted to the database (the mutation uses a hardcoded 600ms delay and never calls an API endpoint: `// In a real app, POST to /api/settings/notifications`).

**Required implementations:**
1. Implement a cookie consent banner (e.g. using `cookies-next` or a lightweight custom component) that:
   - Appears on first visit for unauthenticated and authenticated users.
   - Offers Accept / Reject / Manage options.
   - Stores the consent decision in a `gdpr_consent` cookie and/or the `User`/`WorkspaceSettings.preferences` JSON field.
   - Is shown on the marketing site before any analytics scripts load.
2. Add a `marketingEmailConsent Boolean @default(false)` field to the `User` model.
3. Add a marketing opt-in checkbox to the registration form.
4. Wire the Notifications page to a real `PATCH /api/settings/notifications` endpoint that persists preferences to the DB (add a `notificationPreferences Json` column to `User` or `WorkspaceSettings`).

---

### 4. Privacy Policy Page

**Status: MISSING — CRITICAL GAP**

- The marketing footer links to `/privacy` (file: `src/components/layout/marketing-footer.tsx` line 28).
- The middleware allowlist includes `/privacy` as a public route (`src/middleware.ts` line 17).
- The email layout links to `https://postsyncer.com/privacy` (`src/emails/components/email-layout.tsx` line 152).
- **No page file exists at `/src/app/(marketing)/privacy/page.tsx`.**

**Required implementations:**
1. Create `/src/app/(marketing)/privacy/page.tsx` with a full Privacy Policy that covers:
   - What personal data is collected (name, email, avatar, social tokens, billing info, usage analytics, activity logs, comments/inbox content, IP addresses via Vercel logs).
   - Legal basis for processing under GDPR Art. 6 (contract performance for core features; legitimate interests for security logging; consent for marketing).
   - Third-party data processors: Stripe (billing), OpenAI (AI features), Resend (email), Vercel (hosting/logs), and any CDN/object-storage provider used for media.
   - Data retention periods (see Finding 8).
   - User rights: access, rectification, erasure, portability, restriction, objection.
   - Contact information and DPO details (if applicable).
   - Last updated date.

---

### 5. Terms of Service Page

**Status: MISSING**

- The footer links to `/terms`; the middleware allowlist includes `/terms`.
- **No page file exists at `/src/app/(marketing)/terms/page.tsx`.**

**Required implementations:**
1. Create `/src/app/(marketing)/terms/page.tsx` with Terms of Service covering: acceptable use, subscription terms, refund policy, liability limitations, governing law, and dispute resolution.

---

### 6. Data Minimization

**Status: ACCEPTABLE with minor concerns**

**What is good:**
- The `User` model stores only: id, name, email, emailVerified, image (URL), passwordHash, role, lastLoginAt, createdAt, updatedAt. No phone number, date of birth, address, or other unnecessary PII.
- Profile API selects only necessary fields (uses `select:` projections throughout).
- Social accounts store display name, username, and avatar URL — all needed for the product's functionality.

**Minor concerns:**
- The `Comment` model stores `authorName`, `authorUsername`, and `authorAvatar` for third-party social media users who have not consented to PostSyncer's data processing. This is common practice for social media management tools but should be disclosed in the Privacy Policy and subject to a retention policy (see Finding 8).
- The `ActivityLog.metadata` field is a freeform JSON blob. There is no schema enforcement to prevent accidental storage of PII in log metadata.
- The `WorkspaceSettings.preferences` and `Post.metadata` fields are also untyped JSON — ensure no PII is inadvertently stored there.

**Recommendation:** Add a TypeScript type/Zod schema for `ActivityLog.metadata` and audit all call sites to confirm no email addresses or tokens are stored.

---

### 7. Third-Party Data Sharing Disclosure

**Status: MISSING from Privacy Policy (which itself is missing)**

The following third-party processors receive personal data and must be disclosed:

| Processor | Data Shared | Purpose | Location |
|-----------|-------------|---------|----------|
| **Stripe** | Email, workspace ID, subscription events | Payment processing | USA (EU SCCs apply) |
| **OpenAI** | Post content/topics submitted to AI features | AI caption/hashtag generation | USA (EU SCCs apply) |
| **Resend** | Email address, name, post content in notification emails | Transactional email delivery | USA (EU SCCs apply) |
| **Vercel** | IP addresses, request URLs, user agents | Hosting, serverless functions, logs | Global (USA primary) |
| **Social Platforms** (Twitter/X, Facebook, Instagram, LinkedIn, etc.) | Post content, media, OAuth tokens | Publishing on behalf of user | Varies by platform |

**Specific concerns:**
- `src/lib/ai/openai.ts`: Post topic/content and comment text are sent to OpenAI GPT-4o. Users may include PII in their post topics. No scrubbing or anonymisation occurs before sending. This must be disclosed and users must be able to opt out of AI features.
- `src/lib/stripe.ts → getOrCreateStripeCustomer()`: The workspace owner's email is passed to Stripe as the customer email.
- Resend: Full post content can appear in approval notification emails (`src/app/api/posts/[id]/approve/route.ts`).

**Required implementations:**
1. Write a Privacy Policy section listing all processors with their privacy policy links.
2. Add a `disableAiFeatures` toggle to workspace settings if you want to allow users to opt out of OpenAI data processing.

---

### 8. Data Retention Policies

**Status: MISSING — HIGH RISK**

- There are **no automated cleanup jobs** for any data type. The only cron job is `POST /api/cron/publish` (runs every minute) which only publishes scheduled posts — it performs no cleanup.
- Data accumulates indefinitely: publish logs, analytics snapshots, activity logs, comment inbox entries, and expired invite tokens all grow without bound.

**Required implementations:**

| Data Type | Recommended Retention | Implementation |
|-----------|----------------------|----------------|
| `PublishLog` | 90 days | Cron: delete where `attemptAt < NOW() - INTERVAL '90 days'` |
| `AnalyticsSnapshot` | 2 years (PRO), 90 days (FREE/STARTER) | Cron: tier-based cleanup |
| `PostAnalytics` | 2 years | Cron: delete old rows |
| `ActivityLog` | 1 year | Cron: delete where `createdAt < NOW() - INTERVAL '1 year'` |
| `Comment` (inbox) | 6 months after `syncedAt` | Cron: delete old comments |
| `WorkspaceMember` (INVITED status) | 30 days (already have `inviteExpiresAt` field) | Cron: delete expired pending invites |
| `Session` (expired) | Immediate on expiry | Prisma adapter handles this, verify configuration |
| `VerificationToken` | Immediate on use or 24 hours | Verify NextAuth adapter cleanup |

1. Create `/api/cron/cleanup/route.ts` with a Vercel Cron schedule (e.g. `0 2 * * *` for daily at 2 AM).
2. Document retention periods in the Privacy Policy.

---

### 9. Password Hashing Adequacy

**Status: INCONSISTENT — MEDIUM RISK**

**Findings:**
- `src/app/api/auth/register/route.ts` line 34: `bcrypt.hash(password, 10)` — **10 rounds**
- `src/app/api/settings/profile/route.ts` line 122: `bcrypt.hash(newPassword, 12)` — **12 rounds**
- `src/app/api/admin/users/route.ts` line 140: `bcrypt.hash(password, 12)` — **12 rounds**

**Assessment:**
- bcrypt is an appropriate algorithm for password hashing (NIST SP 800-63B compliant).
- 10 rounds is the `bcryptjs` default and is considered the minimum acceptable. It is below the 12-round recommendation for 2026 hardware.
- The inconsistency between registration (10 rounds) and password change (12 rounds) means users who registered first and never changed their password have weaker hashes.

**Required implementations:**
1. Change `src/app/api/auth/register/route.ts` to use `bcrypt.hash(password, 12)` to match the other locations.
2. Consider implementing a "pepper" (server-side secret added before hashing) for defence-in-depth, stored in an environment variable.
3. On successful login (`src/lib/auth.ts`), check if the existing hash was generated with fewer than 12 rounds and silently rehash it.

---

### 10. PII in Logs

**Status: LOW RISK (no direct PII logging found, but risks exist)**

**Findings:**
- All `console.error()` calls in API routes pass only the error object (e.g. `console.error("[GET /api/settings/profile]", error)`). No email addresses or tokens are explicitly logged.
- The cron job logs post counts and timing but no user data.
- The `ActivityLog` DB table stores `userId`, `action`, `entityType`, `entityId`, and a freeform `metadata` JSON blob. Call sites examined write minimal metadata (e.g. `{ deletedAt: "..." }`). **However**, no schema enforcement prevents future contributors from accidentally writing PII into `metadata`.
- Vercel's platform logs will capture request headers and bodies if verbose logging is enabled. Ensure `NEXT_PUBLIC_VERCEL_ENV` is production and that Vercel log drains are configured to redact sensitive headers.

**Recommendations:**
1. Define and enforce a TypeScript type for `ActivityLog.metadata` to prevent accidental PII storage.
2. Add a linting rule or code review guideline: "Never log email, password, or token values."
3. Confirm Vercel log retention is set to the minimum required (30 days recommended) and that log access is restricted to authorised personnel.

---

### 11. Social Token Storage Security

**Status: HIGH RISK — CRITICAL GAP**

**Findings:**
- OAuth access tokens and refresh tokens for all 11 social platforms are stored as plaintext `String @db.Text` columns in the `social_accounts` table (`prisma/schema.prisma` lines 183–184).
- `accessToken` and `refreshToken` fields have **no encryption at rest** in the application layer.
- The `Account` model (NextAuth OAuth sign-in tokens) also stores `access_token`, `refresh_token`, and `id_token` as plaintext `@db.Text` fields (lines 45–47).

**Risk:** A database breach would expose all connected social media OAuth tokens for all users, allowing an attacker to post, delete, and read data on behalf of every user on all 11 platforms.

**Required implementations:**
1. Encrypt OAuth tokens before writing to the database using AES-256-GCM with a key stored in an environment variable (e.g. `TOKEN_ENCRYPTION_KEY`). Decrypt on read.
2. Implement a utility function `encryptToken(plaintext: string): string` and `decryptToken(ciphertext: string): string` using Node.js `crypto.createCipheriv` / `createDecipheriv`.
3. Run a one-time migration to encrypt all existing tokens in the database.
4. Consider using a secrets manager (AWS Secrets Manager, HashiCorp Vault) rather than env-var key management for higher-security deployments.

Example approach (application-level encryption):
```typescript
// src/lib/crypto.ts
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY!, "hex"); // 32 bytes

export function encryptToken(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptToken(ciphertext: string): string {
  const [ivHex, tagHex, encHex] = ciphertext.split(":");
  const decipher = createDecipheriv(ALGORITHM, KEY, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return decipher.update(Buffer.from(encHex, "hex")) + decipher.final("utf8");
}
```

---

### 12. Right to Rectification (GDPR Art. 16)

**Status: PARTIAL — MEDIUM GAP**

**What exists:**
- Name and avatar URL: editable via `PATCH /api/settings/profile` and the profile settings UI. ✓
- Password: changeable via `PATCH /api/settings/profile` for credential users. ✓
- Workspace name, slug, timezone, logo: editable via `PATCH /api/workspace/settings`. ✓

**What is missing:**
- **Email address cannot be changed.** The profile page (`/settings/profile/page.tsx` lines 188–204) explicitly marks the email field as `readOnly` and disabled, with the message "Contact support to change your email address." There is no `PATCH /api/settings/profile` handler for email updates.
- **Social account display names/usernames** are read-only (set at OAuth time). Users must disconnect and reconnect to update them — which is acceptable.

**Required implementations:**
1. Implement email change via a verification flow:
   - User submits new email → system sends a verification link to the new address.
   - On click, update `user.email` and `user.emailVerified`.
   - Also update the Stripe customer email via `stripe.customers.update(customerId, { email: newEmail })`.
2. Add `PATCH /api/settings/profile` support for the `email` field, gated behind email verification.

---

### 13. Cookie Security Flags

**Status: PARTIALLY COMPLIANT — MEDIUM CONCERN**

**Findings:**

**OAuth state cookies** (`src/app/api/accounts/connect/[platform]/route.ts` lines 77–83):
```
httpOnly: true    ✓
secure: process.env.NODE_ENV === "production"   ✓ (production only)
sameSite: "lax"   ✓ (appropriate for OAuth redirects)
maxAge: 600       ✓ (10-minute expiry)
path: "/"         ✓
```
These are correctly configured.

**NextAuth session cookie** (managed by `next-auth`):
- NextAuth v5 with `session: { strategy: "jwt" }` sets `__Secure-next-auth.session-token` in production.
- NextAuth automatically sets `httpOnly: true`, `secure: true` in production, and `sameSite: "lax"`.
- The `AUTH_SECRET` / `NEXTAUTH_SECRET` environment variable is not explicitly referenced in the codebase (it is consumed by NextAuth internally at startup). Ensure this is set to a strong random value in production.

**Concerns:**
1. `sameSite: "lax"` is used for the OAuth state cookie. For maximum CSRF protection on state-changing requests, `"strict"` would be preferable, but `"lax"` is required for OAuth redirect flows and is acceptable here.
2. No custom cookie configuration is applied to the NextAuth session cookie in `src/lib/auth.ts`. If the default NextAuth cookie settings are overridden anywhere, verify `httpOnly`, `secure`, and `sameSite` are maintained.
3. The GDPR cookie consent banner (missing — see Finding 3) must inform users about all cookies set, including the session cookie, before they are set on first visit.

**Required implementations:**
1. Add an explicit `cookies` configuration block to `NextAuth({...})` in `src/lib/auth.ts` to make the security settings visible and reviewable:
```typescript
cookies: {
  sessionToken: {
    options: {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
    },
  },
},
```
2. Implement the cookie consent banner (see Finding 3).

---

## Summary Table

| # | Area | Status | Risk | Priority |
|---|------|--------|------|----------|
| 1 | Data deletion (user self-service) | Missing | Critical | P0 |
| 2 | Data export (Art. 20) | Missing | Critical | P0 |
| 3 | Consent management | Missing | Critical | P0 |
| 4 | Privacy Policy page | Missing | Critical | P0 |
| 5 | Terms of Service page | Missing | High | P1 |
| 6 | Data minimization | Acceptable (minor gaps) | Low | P3 |
| 7 | Third-party disclosure | Missing from Privacy Policy | High | P1 |
| 8 | Data retention policies | Missing | High | P1 |
| 9 | Password hashing (bcrypt rounds) | Inconsistent (10 vs 12) | Medium | P2 |
| 10 | PII in logs | Low risk, no direct leaks found | Low | P3 |
| 11 | Social token storage encryption | Plaintext in DB | Critical | P0 |
| 12 | Right to rectification (email) | Email not updatable | Medium | P2 |
| 13 | Cookie security flags | Mostly compliant, missing explicit config | Low | P3 |

---

## Prioritised Action Plan

### P0 — Immediate (before EU launch / GDPR enforcement)
1. Encrypt all OAuth tokens at rest in the database (Finding 11).
2. Implement self-service account deletion at `DELETE /api/settings/profile` (Finding 1).
3. Implement GDPR data export at `GET /api/settings/export` (Finding 2).
4. Create the Privacy Policy page at `/privacy` (Finding 4).
5. Implement a cookie consent banner (Finding 3).

### P1 — Short term (within 30 days)
6. Create the Terms of Service page at `/terms` (Finding 5).
7. Implement a data retention cron job (Finding 8).
8. Document all third-party data processors in the Privacy Policy (Finding 7).

### P2 — Medium term (within 60 days)
9. Standardise bcrypt rounds to 12 everywhere and implement rehashing on login (Finding 9).
10. Implement email change with verification flow (Finding 12).

### P3 — Housekeeping (backlog)
11. Type the `ActivityLog.metadata` JSON field (Finding 6, 10).
12. Add explicit cookie config to NextAuth (Finding 13).
13. Wire the Notifications page to a real persistence endpoint (Finding 3).
14. Persist notification preferences to the database.

---

## References
- GDPR Art. 17 — Right to erasure: https://gdpr-info.eu/art-17-gdpr/
- GDPR Art. 20 — Right to data portability: https://gdpr-info.eu/art-20-gdpr/
- GDPR Art. 16 — Right to rectification: https://gdpr-info.eu/art-16-gdpr/
- ePrivacy Directive (Cookie Law): https://ec.europa.eu/digital-agenda/en/news/eprivacy-directive
- NIST SP 800-63B (password hashing guidance): https://pages.nist.gov/800-63-3/sp800-63b.html
- OWASP Cryptographic Storage Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html
