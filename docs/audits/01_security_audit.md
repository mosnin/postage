# PostSyncer Security Audit — Report 01

**Date:** 2026-03-29
**Auditor:** Claude (automated security review)
**Scope:** Full codebase at `/home/user/postage` — authentication, API security, tenant isolation, session management, input validation, secrets exposure, rate limiting, CSRF, XSS, and Prisma query safety.

---

## Executive Summary

The codebase demonstrates a solid security foundation: Zod schema validation is applied on all authenticated API routes, Prisma's ORM prevents raw SQL injection, workspace membership is enforced on most data-bearing endpoints, and API keys are hashed (SHA-256) before storage. However, several medium-to-high severity issues were found that require attention before production hardening.

| Severity | Count |
|----------|-------|
| Critical | 1     |
| High     | 5     |
| Medium   | 8     |
| Low / Informational | 6 |

---

## Findings

### CRITICAL

---

#### CRIT-01 — Insecure API key generation uses `Math.random()`

**File:** `src/lib/utils.ts:37-45`

```ts
export function generateApiKey(): string {
  const prefix = "ps_";
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let key = prefix;
  for (let i = 0; i < 40; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}
```

`Math.random()` is a pseudorandom number generator that is **not cryptographically secure**. In V8 (Node.js), its state can be partially predicted from a small number of observed outputs. An attacker who can observe one or more issued API keys could potentially predict others.

**Fix:** Replace with `crypto.randomBytes`:

```ts
import { randomBytes } from "crypto";

export function generateApiKey(): string {
  return "ps_" + randomBytes(30).toString("base64url").slice(0, 40);
}
```

---

### HIGH

---

#### HIGH-01 — OAuth state validation is skipped in development; mock flow accepts `mock_auth_code` in production if env var is absent

**File:** `src/app/api/accounts/callback/[platform]/route.ts:52-59` and `src/app/api/accounts/connect/[platform]/route.ts:60-72`

The cookie-based CSRF state check is conditional on `process.env.NODE_ENV === "production"`:

```ts
// Validate cookie state in production (CSRF protection)
if (process.env.NODE_ENV === "production") {
  const cookieStore = await cookies();
  const cookieState = cookieStore.get(`oauth_state_${platformKey}`)?.value;
  if (!cookieState || cookieState !== stateParam) {
    return redirectWithError(req, "State mismatch — possible CSRF attack");
  }
  cookieStore.delete(`oauth_state_${platformKey}`);
}
```

The connect route uses the condition `isDev && !hasClientId` to bypass OAuth entirely and redirect directly to the mock callback. If `NODE_ENV !== "production"` but the app is running in a staging environment with real users, CSRF validation is skipped entirely. Furthermore, the mock code path accepts the literal string `"mock_auth_code"` as a valid code even when the platform client ID is absent in non-development environments.

**Fix:**
- Move the CSRF guard to be unconditional (always check state) and remove the mock flow shortcut from the production-visible connect endpoint.
- Gate the mock flow strictly behind an explicit `ENABLE_MOCK_OAUTH=true` environment variable checked in addition to `NODE_ENV`.

---

#### HIGH-02 — Access tokens and refresh tokens stored in plaintext in the database

**File:** `prisma/schema.prisma:180-182`

```prisma
accessToken  String   @db.Text
refreshToken String?  @db.Text
```

Social platform OAuth access and refresh tokens are stored as plaintext strings. A database dump or SQL injection vulnerability would expose all tokens for all connected social accounts, allowing an attacker to post, read, or delete content on behalf of every user.

**Fix:** Encrypt tokens at rest using a symmetric key (e.g., AES-256-GCM with a key from `process.env.TOKEN_ENCRYPTION_KEY`). Decrypt only within the publish engine and social platform API calls. The Auth.js `Account.access_token` / `refresh_token` fields (also stored plaintext) share the same risk.

---

#### HIGH-03 — Unvalidated URL passed directly to `fetch()` in the content-agent AI feature (SSRF)

**File:** `src/lib/ai/openai.ts:133-154` called from `src/app/api/ai/content-agent/route.ts:44`, validated at `src/app/api/ai/content-agent/route.ts:43`:

The route validates the URL with `z.string().url()`, but this only ensures it is a syntactically valid URL — it does not restrict the scheme, IP range, or hostname. This allows Server-Side Request Forgery (SSRF): an authenticated user could supply `http://169.254.169.254/latest/meta-data/` (AWS IMDS), `http://localhost:5432/` (internal database), or any other internal network endpoint.

```ts
url: z.string().url().optional(),
```

**Fix:**
- Restrict allowed schemes to `https://` only.
- Block private IP ranges (RFC 1918: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16), loopback (127.0.0.0/8), and link-local (169.254.0.0/16).
- Consider using an allow-list of domains or resolving the hostname and checking the resulting IP before making the request.

---

#### HIGH-04 — Invite token accepted as a GET request; state-changing operation over GET is CSRF-exploitable

**File:** `src/app/api/workspace/invites/[token]/route.ts:7`

```ts
export async function GET(...)
```

Accepting a workspace invite is a state-changing operation (it creates membership in a workspace) but it is implemented as a `GET` handler. GET requests can be triggered by embedding the URL in an `<img src>`, `<iframe>`, or similar tag on any page the victim visits, or can be pre-fetched by browsers and link-preview crawlers. An attacker can craft a link that makes an authenticated user silently join an attacker-controlled workspace.

**Fix:** Change the invite-acceptance handler to `POST` and require the client to send the token in the request body. Redirect the invite link URL to a page that displays invite details and contains a confirmation button that submits a POST.

---

#### HIGH-05 — Rate limiting is in-memory only; resets on every server restart and is ineffective on multi-instance deployments

**File:** `src/lib/api/rate-limit.ts:11`

```ts
const counters = new Map<string, CounterEntry>();
```

The rate limiter stores counters in a module-level `Map`. On Vercel (serverless), each function invocation may spawn a fresh instance, making the counter always start at zero and the rate limit trivially bypassable. On multi-instance deployments, each instance tracks only its own share of requests.

The same pattern is replicated in the public tools endpoints:
- `src/app/api/tools/generate-hashtags/route.ts:14`
- `src/app/api/tools/generate-caption/route.ts:14`

**Fix:** Replace the in-memory store with a distributed store (e.g., Redis via Upstash). The comment in `rate-limit.ts` acknowledges this, but it must be treated as a pre-launch blocker rather than a TODO.

---

### MEDIUM

---

#### MED-01 — Middleware does not protect all non-public API routes; `/api/v1/*` and `/api/mcp` are explicitly excluded

**File:** `src/middleware.ts:33-36`

```ts
const isPublic =
  PUBLIC_ROUTES.some((r) => path === r || path.startsWith(r + "/")) ||
  path.startsWith("/api/auth") ||
  path.startsWith("/api/v1") ||
  path.startsWith("/api/mcp") ||
  path.startsWith("/api/webhooks");
```

The middleware marks `/api/v1/*` and `/api/mcp` as public, relying entirely on the individual route handlers to enforce authentication. While the route handlers do check API-key auth, a bug in any single handler (e.g., a forgotten auth check) becomes exploitable with no middleware safety net. Additionally, `/api/webhooks` is declared public but no such route exists in the codebase — this path prefix could be registered accidentally in the future without authentication.

**Fix:** Remove these paths from the middleware's public bypass list. Let the individual handlers return their own 401s (they already do). The middleware then provides defence-in-depth.

---

#### MED-02 — MCP endpoint uses `Access-Control-Allow-Origin: *`; combined with cookie-bearing requests this may leak data

**File:** `src/app/api/mcp/route.ts:53-56` and `OPTIONS` handler `src/app/api/mcp/route.ts:70-76`

```ts
"Access-Control-Allow-Origin": "*",
"Access-Control-Allow-Headers": "Authorization, Content-Type",
```

A wildcard ACAO header on an endpoint that handles sensitive workspace data is overly permissive. While Bearer-token authentication is not sent automatically by browsers (unlike cookies), the wildcard still allows any origin to read the full JSON-RPC response body from a browser context, which may be combined with credential sharing in edge cases.

**Fix:** Restrict to the known application origin (`process.env.NEXTAUTH_URL`) or maintain an explicit allow-list.

---

#### MED-03 — No email verification on registration; unverified accounts can create workspaces and send invites

**File:** `src/app/api/auth/register/route.ts`

Users can register with any email address (including one they do not own) and immediately create a workspace, invite collaborators, connect social accounts, and generate API keys. The `emailVerified` field exists in the database schema (`prisma/schema.prisma:17`) but is never populated for credentials-provider sign-ups.

**Fix:** After registration, generate a verification token and send an email to the supplied address. Block workspace-creation and invite-sending for unverified accounts. NextAuth v5 supports `VerificationToken`; the infrastructure is present.

---

#### MED-04 — Workspace slug update has no rate limit; enumerable slugs reveal workspace existence

**File:** `src/app/api/workspace/settings/route.ts:119-130`

The PATCH endpoint checks slug uniqueness and returns a `409` on conflict. An attacker with any authenticated session can enumerate every workspace slug in the system by attempting to claim slugs and observing the conflict response.

**Fix:** Return a generic error on slug conflict without confirming whether the slug belongs to an active workspace. Consider normalising the error message to be non-distinguishing.

---

#### MED-05 — `image` field in profile update accepts arbitrary URLs without allowlisting

**File:** `src/app/api/settings/profile/route.ts:49`

```ts
image: z.string().url().nullable().optional(),
```

A user can set their profile image to any URL, including internal network addresses, malicious content, or tracking pixels. When the application renders this image (e.g., in the UI or in email templates), it may cause unintended outbound requests from the browser or server.

**Fix:** Validate the URL against an allowlist of trusted image hosting domains (matching the domains already configured in `next.config.ts`), or require that profile images be uploaded through the media upload endpoint.

---

#### MED-06 — `workspaceId` is accepted from the request body in multiple state-changing endpoints

**File:** Multiple locations including `src/app/api/posts/route.ts:9`, `src/app/api/ai/generate-caption/route.ts:39`, `src/app/api/ai/content-agent/route.ts:40`

These endpoints accept `workspaceId` from the client-supplied JSON body. While membership checks do follow (preventing cross-tenant access), the pattern is error-prone: if a future developer omits the membership check the `workspaceId` becomes freely attacker-controlled. The workspace context should be derived from the authenticated session whenever possible.

**Fix:** For session-authenticated routes, derive `workspaceId` from a URL path parameter or from the user's verified session / workspace cookie rather than the request body. At minimum, document the pattern prominently so reviewers know to look for the membership check.

---

#### MED-07 — `status` field on posts can be set to `SCHEDULED` without a `scheduledAt` date by authenticated users

**File:** `src/app/api/posts/route.ts:13-14`

```ts
status: z
  .enum(["DRAFT", "PENDING_APPROVAL", "SCHEDULED", "CANCELLED"])
  .default("DRAFT"),
```

The creation schema allows `SCHEDULED` as a status value without enforcing that `scheduledAt` is also provided. A post in `SCHEDULED` status without a `scheduledAt` date will be picked up by the publish engine immediately if the engine uses `scheduledAt <= now` logic (or may behave unexpectedly).

**Fix:** Add a cross-field Zod refinement: `.refine(d => d.status !== "SCHEDULED" || !!d.scheduledAt, { message: "scheduledAt is required when status is SCHEDULED" })`.

---

#### MED-08 — Billing webhook `workspaceId` comes from Stripe event metadata and is not verified against the database

**File:** `src/app/api/billing/webhook/route.ts:72-76`

```ts
const workspaceId = subscription.metadata?.workspaceId;
if (!workspaceId) { ... return; }
// Used directly in db.subscription.upsert({ where: { workspaceId } })
```

Although Stripe webhook signatures are verified (correct), the `workspaceId` embedded in the subscription metadata is not confirmed to correspond to an existing workspace before being used in `db.workspace.update`. If Stripe metadata is manually edited or the workspace has been deleted, the `db.workspace.update` call will silently fail (or throw), but more importantly the `db.subscription.upsert` could create an orphaned subscription row tied to a non-existent workspace.

**Fix:** After extracting `workspaceId` from metadata, confirm the workspace exists:
```ts
const workspace = await db.workspace.findUnique({ where: { id: workspaceId } });
if (!workspace) { console.warn(...); return; }
```

---

### LOW / INFORMATIONAL

---

#### LOW-01 — JWT tokens embed the user role at sign-in time; role changes are not reflected until the user signs out and back in

**File:** `src/lib/auth.ts:57-63`

```ts
async jwt({ token, user }) {
  if (user) {
    token.id = user.id;
    token.role = (user as { role?: string }).role ?? "USER";
  }
  return token;
},
```

The role is written into the JWT only on initial sign-in (`if (user)` is only truthy on the first callback invocation). When a SUPER_ADMIN demotes a user via `/api/admin/users/[id]`, the user continues to hold `SUPER_ADMIN` role in their JWT until they re-authenticate.

**Fix:** In the JWT callback, always re-fetch the current role from the database (or cache it with a short TTL):
```ts
async jwt({ token }) {
  const dbUser = await db.user.findUnique({ where: { id: token.id as string }, select: { role: true } });
  if (dbUser) token.role = dbUser.role;
  return token;
},
```

---

#### LOW-02 — Workspace invite token is returned in the API response body

**File:** `src/app/api/workspace/members/route.ts:239`

```ts
return NextResponse.json({ member, inviteUrl }, { status: 201 });
```

The full invite URL (containing the secret token) is returned in the JSON response. This is necessary for the sender to copy and share, but the response also includes the full `member` object which contains the raw `inviteToken` field from the database. If the invite email is later implemented (the TODO comment at line 231-237 implies it is not yet sent), the token could be leaked through response logging or proxies.

**Fix:** Exclude `inviteToken` from the `member` object in the select clause:
```ts
const member = await db.workspaceMember.create({
  ...
  select: { id: true, role: true, status: true, invitedEmail: true, workspace: true, user: true },
});
```

---

#### LOW-03 — No Content-Security-Policy header is configured

**File:** `next.config.ts`

The application does not set a `Content-Security-Policy` header. Next.js does not add one automatically. Without a CSP, reflected or stored XSS payloads (e.g. in user-supplied post content rendered in the UI) have full access to the DOM and cookies.

**Fix:** Add a strict CSP via Next.js `headers()` configuration in `next.config.ts`. At minimum: `default-src 'self'; script-src 'self'; object-src 'none'; frame-ancestors 'none'`. The Tiptap editor may require relaxed `style-src` and `script-src` directives.

---

#### LOW-04 — No `X-Frame-Options` or `frame-ancestors` CSP directive

**File:** `next.config.ts`

Without frame embedding protection, the application can be embedded in an `<iframe>` on an attacker-controlled domain, enabling click-jacking attacks against authenticated users.

**Fix:** Add `X-Frame-Options: DENY` (or `SAMEORIGIN`) via Next.js response headers, and include `frame-ancestors 'self'` in the CSP (see LOW-03).

---

#### LOW-05 — `generateApiKey` entropy is 40 characters from a 62-character alphabet (~237 bits), but the prefix reduces distinctiveness

**File:** `src/lib/utils.ts:37-45`

After fixing CRIT-01 (replacing `Math.random()`), the key length is adequate. However, the fixed prefix `ps_` and the 10-character display prefix stored in `keyPrefix` means that the effective secret portion visible for HMAC comparison is 37 characters from a 62-char alphabet (~220 bits). This is acceptable, but worth noting.

**No immediate action required** once CRIT-01 is resolved.

---

#### LOW-06 — bcrypt cost factor is 10 for user registration but 12 for admin-created users; should be consistent

**File:** `src/app/api/auth/register/route.ts:34` vs `src/app/api/admin/users/route.ts:140`

```ts
// register/route.ts
const passwordHash = await bcrypt.hash(password, 10);

// admin/users/route.ts
const passwordHash = await bcrypt.hash(password, 12);
```

Both code paths should use the same cost factor. The current OWASP recommendation is 10 as the minimum; 12 is preferred. Standardise on 12.

---

## Summary of Recommended Fixes (Priority Order)

| Priority | ID | Description |
|----------|----|-------------|
| P0 | CRIT-01 | Replace `Math.random()` with `crypto.randomBytes()` for API key generation |
| P0 | HIGH-02 | Encrypt OAuth access/refresh tokens at rest |
| P0 | HIGH-05 | Replace in-memory rate limiter with Redis/Upstash |
| P1 | HIGH-01 | Unconditionally enforce OAuth CSRF state validation |
| P1 | HIGH-03 | Block SSRF in content-agent URL fetch (scheme + IP allowlist) |
| P1 | HIGH-04 | Change invite acceptance from GET to POST |
| P2 | MED-03 | Require email verification for credentials sign-ups |
| P2 | MED-01 | Remove `/api/v1` and `/api/mcp` from middleware public bypass |
| P2 | LOW-01 | Re-fetch user role from DB in JWT callback |
| P2 | LOW-03 | Add Content-Security-Policy header |
| P2 | LOW-04 | Add X-Frame-Options / frame-ancestors |
| P3 | MED-02 | Restrict MCP CORS to known origin |
| P3 | MED-06 | Derive `workspaceId` from URL params rather than request body |
| P3 | MED-07 | Enforce `scheduledAt` when `status === "SCHEDULED"` |
| P3 | MED-08 | Verify workspace exists in Stripe webhook before upsert |
| P3 | LOW-02 | Exclude `inviteToken` from member create response |
| P4 | MED-04 | Prevent workspace slug enumeration via conflict responses |
| P4 | MED-05 | Allowlist profile image URLs |
| P4 | LOW-06 | Standardise bcrypt cost factor to 12 |

---

## Positive Findings

The following security controls are implemented correctly and should be maintained:

- **Prisma ORM**: All database queries use parameterised Prisma calls. No raw SQL (`$queryRaw` / `$executeRaw`) was found in the audited codebase. SQL injection risk is negligible.
- **API key hashing**: Keys are hashed with SHA-256 before storage (`src/lib/api/auth.ts:13-15`). The raw key is returned only once at creation time and never stored.
- **Workspace tenant isolation**: The pattern of checking `workspaceId` ownership via `WorkspaceMember` before returning or mutating data is consistently applied across all audited API routes.
- **Stripe webhook signature verification**: The webhook handler correctly uses `stripe.webhooks.constructEvent()` with `STRIPE_WEBHOOK_SECRET` before processing any event (`src/app/api/billing/webhook/route.ts:22-31`).
- **Zod input validation**: All API routes parse request bodies through Zod schemas before use.
- **Role hierarchy enforcement**: The `ROLE_RANK` map and `assertWorkspaceRole` utility enforce least-privilege access on settings and member management routes.
- **Bcrypt password hashing**: Passwords are hashed with bcrypt (not MD5/SHA-1) before storage.
- **CRON secret protection**: The `/api/cron/publish` endpoint validates a `CRON_SECRET` bearer token (`src/app/api/cron/publish/route.ts:14-17`).
- **OAuth state parameter**: A per-platform httpOnly, SameSite=Lax cookie is set before redirecting to the OAuth provider (`src/app/api/accounts/connect/[platform]/route.ts:77-83`). The CSRF issue (HIGH-01) is about the environment condition, not the mechanism itself.
- **Pagination limits**: All list endpoints cap `pageSize` to prevent runaway queries.
