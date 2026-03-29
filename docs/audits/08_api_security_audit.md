# API Security Audit

**Date:** 2026-03-29
**Scope:** Core API routes — posts, accounts, media, workspace members, billing webhook, media upload-url
**Severity:** Critical > High > Medium > Low

---

## Summary

| # | Severity | File | Issue |
|---|----------|------|-------|
| 1 | Critical | `accounts/route.ts:34` | `accessToken` / `refreshToken` leaked in GET response |
| 2 | Critical | `posts/route.ts:276` | `socialAccount` objects (with tokens) included in GET list response |
| 3 | Critical | `middleware.ts:35-36` | All `/api/v1/*` and `/api/mcp/*` routes bypass auth middleware |
| 4 | High | `media/route.ts:99–109` | Client-supplied `url` accepted verbatim — no origin validation |
| 5 | High | `media/upload-url/route.ts:67–68` | Predictable file ID, extension extracted from untrusted `fileName` |
| 6 | High | `members/route.ts:239` | `inviteUrl` containing raw token returned in API response body |
| 7 | Medium | `posts/route.ts:264` | `status` query param cast to `never` with no enum validation |
| 8 | Medium | `billing/webhook/route.ts:91-92` | `workspaceId` sourced from unverifiable Stripe metadata |
| 9 | Low | `middleware.ts:46` | Middleware only guards `/dashboard`; other app routes left unprotected |

---

## Finding 1 — Critical: OAuth Tokens Leaked in Accounts Response

**File:** `src/app/api/accounts/route.ts`, lines 34–50

`db.socialAccount.findMany` returns full records with no field selection. The `SocialAccount` model (schema lines 180–181) contains `accessToken` and `refreshToken` as plain `String` columns. Every call to `GET /api/accounts` sends those values to the browser in cleartext.

```ts
// Current — leaks accessToken + refreshToken
const accounts = await db.socialAccount.findMany({
  where: { workspaceId },
  include: { _count: { select: { posts: true } } },
});
```

**Fix:** Use `select` to exclude sensitive fields, or add a serialiser that strips them.

```ts
const accounts = await db.socialAccount.findMany({
  where: { workspaceId },
  select: {
    id: true, platform: true, platformId: true,
    username: true, displayName: true, avatarUrl: true,
    status: true, scopes: true, connectedAt: true,
    _count: { select: { posts: true } },
  },
});
```

---

## Finding 2 — Critical: OAuth Tokens Leaked via Posts List Response

**File:** `src/app/api/posts/route.ts`, lines 274–279

`GET /api/posts` includes `{ accounts: { include: { socialAccount: true } } }`. This pulls in the full `SocialAccount` record — including `accessToken` / `refreshToken` — for every post returned.

```ts
// Current
accounts: { include: { socialAccount: true } },
```

**Fix:** Replace with a `select` that excludes token fields in both the list and the single-post response (lines 206–220).

```ts
accounts: {
  include: {
    socialAccount: {
      select: {
        id: true, platform: true, username: true, displayName: true, avatarUrl: true,
      },
    },
  },
},
```

Apply the same fix to the `postWithRelations` query at line 204.

---

## Finding 3 — Critical: Middleware Bypasses Auth for Entire `/api/v1` and `/api/mcp` Namespaces

**File:** `src/middleware.ts`, lines 34–36

```ts
path.startsWith("/api/v1") ||
path.startsWith("/api/mcp") ||
path.startsWith("/api/webhooks");
```

Any route under these prefixes skips the middleware auth check entirely. If future routes are added under `/api/v1` or `/api/mcp` that rely on middleware for protection, they will be publicly accessible by default. Webhook routes are intentionally public, but the catch-all for `/api/v1` is too broad.

**Fix:** Either remove the `/api/v1` bypass entirely (let individual route handlers handle auth, as they already do), or scope it to specific known-public paths. If the intent is that all v1 routes are authenticated, rely on per-route `auth()` checks and remove the middleware bypass.

---

## Finding 4 — High: Arbitrary URL Accepted for Media Record Creation

**File:** `src/app/api/media/route.ts`, lines 99–109 and 162–175

The POST schema accepts a caller-supplied `url: z.string().url()`. The application stores whatever URL the client sends and later serves it as a trusted asset. This allows:
- Storing URLs pointing to external domains the workspace does not own
- Cross-workspace pollution if a user crafts a URL referencing another workspace's storage path
- Open redirect / SSRF if the URL is later fetched server-side

**Fix:** Validate that the `url` matches the expected storage origin (e.g., `process.env.NEXT_PUBLIC_APP_URL` or the Vercel Blob / S3 domain). Reject any URL that does not start with the known upload prefix.

```ts
const ALLOWED_URL_PREFIX = process.env.NEXT_PUBLIC_APP_URL + "/uploads/";
if (!url.startsWith(ALLOWED_URL_PREFIX)) {
  return NextResponse.json({ error: "Invalid media URL" }, { status: 400 });
}
```

---

## Finding 5 — High: Predictable File ID and Unsafe Extension Extraction

**File:** `src/app/api/media/upload-url/route.ts`, lines 67–69

```ts
const fileId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
const ext = fileName.split(".").pop() ?? "";
const storedName = `${fileId}${ext ? `.${ext}` : ""}`;
```

Two issues:
1. `Date.now()` + 7 chars of `Math.random()` is guessable (~35 bits of entropy). Use `crypto.randomUUID()` or `crypto.randomBytes(16).toString("hex")` instead.
2. Extension is taken from the untrusted client-supplied `fileName`. An attacker can pass `fileName: "shell.php.jpg"` — `pop()` returns `"jpg"` which is safe here, but `"shell.php"` returns `"php"`. The stored name would be `<id>.php`, which could be served with a dangerous content type. Since MIME type is already validated, derive the extension from `mimeType`, not `fileName`.

```ts
const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif",
  "image/webp": "webp", "video/mp4": "mp4", "video/quicktime": "mov",
};
const ext = MIME_TO_EXT[mimeType] ?? "";
const fileId = crypto.randomUUID();
const storedName = ext ? `${fileId}.${ext}` : fileId;
```

---

## Finding 6 — High: Invite Token Returned in Response Body

**File:** `src/app/api/workspace/members/route.ts`, line 239

```ts
return NextResponse.json({ member, inviteUrl }, { status: 201 });
```

`inviteUrl` contains the raw 64-hex-char invite token in the URL. This is logged by any API gateway, CDN, browser devtools network tab, and server-side logging infrastructure. The token should only be transmitted via email.

**Fix:** Remove `inviteUrl` from the JSON response. Return only `{ member }`. The invite URL is constructed and sent by the email delivery path (the commented-out Resend call). If a "resend invite" feature is needed, create a separate admin-only endpoint.

---

## Finding 7 — Medium: Unvalidated `status` Query Parameter in Posts List

**File:** `src/app/api/posts/route.ts`, lines 264–269

```ts
const status = searchParams.get("status");
const where = {
  workspaceId,
  ...(status ? { status: status as never } : {}),
};
```

The `status` value is passed to Prisma without validation. An invalid enum string causes Prisma to throw, which is caught and returns a 500. Enumerate valid values explicitly.

**Fix:**

```ts
const POST_STATUSES = ["DRAFT", "PENDING_APPROVAL", "SCHEDULED", "PUBLISHED", "CANCELLED", "FAILED"] as const;
type PostStatus = typeof POST_STATUSES[number];

const rawStatus = searchParams.get("status");
const status = POST_STATUSES.includes(rawStatus as PostStatus) ? rawStatus as PostStatus : undefined;
```

---

## Finding 8 — Medium: Subscription State Driven by Unverified Stripe Metadata

**File:** `src/app/api/billing/webhook/route.ts`, lines 72–76

```ts
const workspaceId = subscription.metadata?.workspaceId;
if (!workspaceId) { console.warn(...); return; }
```

Stripe verifies the webhook signature (correctly implemented at lines 23–31), so the event payload is trusted. However, `metadata.workspaceId` is set when the checkout session is created client-side. If the checkout creation endpoint does not enforce that `workspaceId` belongs to the authenticated user, an attacker could trigger subscription upgrades for arbitrary workspaces. This is a defense-in-depth gap rather than a direct bypass.

**Fix:** In the subscription creation endpoint (not audited here), verify that the `workspaceId` being attached to Stripe metadata is owned by the authenticated session before creating the checkout session. In the webhook handler, add a cross-check:

```ts
const workspace = await db.workspace.findUnique({ where: { id: workspaceId } });
if (!workspace) { console.warn("[Webhook] Unknown workspaceId in metadata"); return; }
```

---

## Finding 9 — Low: Middleware Auth Guard Limited to `/dashboard`

**File:** `src/middleware.ts`, line 46

```ts
if (!isLoggedIn && path.startsWith("/dashboard")) {
```

Any app routes outside `/dashboard` (e.g., `/settings`, `/workspace`, `/billing`) are not redirected to login by the middleware. If those pages render sensitive server components without their own auth check, they could be accessed by unauthenticated users.

**Fix:** Broaden the redirect guard to cover all non-public app routes, or adopt an allow-list approach:

```ts
const isAppRoute = !isPublic && !AUTH_ROUTES.some(r => path.startsWith(r));
if (!isLoggedIn && isAppRoute) {
  const loginUrl = new URL("/login", nextUrl);
  loginUrl.searchParams.set("callbackUrl", path);
  return NextResponse.redirect(loginUrl);
}
```

---

## What Is Already Well-Implemented

- **Authentication** — all API routes call `auth()` first and return 401 on missing session.
- **Workspace membership checks** — every route verifies the caller is an active workspace member before any DB read.
- **IDOR prevention in posts** — `workspaceId` is cross-checked against all supplied IDs (accounts, labels, campaigns, media).
- **Role-based access in members route** — `assertRole()` with a rank hierarchy prevents privilege escalation in invitations.
- **Stripe signature verification** — `stripe.webhooks.constructEvent` is called correctly before any event processing.
- **File type validation in upload-url** — MIME type is checked against an allow-list before issuing upload credentials.
- **Input validation** — Zod schemas are present on all mutation endpoints (POST body parsing).
- **Storage quota enforcement** — checked server-side before committing media records.
- **Pagination limits** — `pageSize` is capped at 50 in posts and uses a fixed 40 in media.
