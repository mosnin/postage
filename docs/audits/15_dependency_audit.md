# Dependency Audit — PostSyncer

**Date:** 2026-03-29
**Auditor:** Claude Code
**Scope:** `package.json`, `package-lock.json`, full `src/` tree

---

## Executive Summary

PostSyncer's dependency footprint is reasonable for a Next.js SaaS but has several meaningful risks. The most pressing issues are: (1) `next-auth` is pinned to a beta release (`5.0.0-beta.25`) that is now multiple versions behind and carries known session-handling instabilities, (2) the in-memory rate limiter will silently reset on every serverless cold-start—a documented comment even acknowledges it must be replaced with Redis but it hasn't been, (3) `@tanstack/react-query-devtools` is declared as a runtime dependency instead of dev, (4) `@react-email/render` and `framer-motion` are unlisted transitive consumers shipped in the production bundle without an explicit dependency declaration, (5) there is no error tracking, no structured logging, and no observability tooling of any kind, and (6) `bcryptjs 2.4.3` is four years old and unverified against recent CVEs.

Severity key: **CRITICAL** | **HIGH** | **MEDIUM** | **LOW**

---

## Section 1 — Pinned vs Range Versions

### 1a — Hard-Pinned Packages (No `^` or `~`) [HIGH]

Two packages are pinned to exact versions with no flexibility:

| Package | Pinned Version | Risk |
|---|---|---|
| `next` | `15.0.0` | Misses all patch/security releases since October 2024. Next.js 15 has had several post-GA patches for middleware, caching, and security fixes. |
| `next-auth` | `5.0.0-beta.25` | Beta software pinned to a specific pre-release (see Finding 2). |
| `eslint-config-next` | `15.0.0` | Must always match `next` exactly—this is correct, but should be updated whenever `next` is updated. |

**Recommendation:** Change `next` to `^15.0.0` and immediately run `npm update next` to get onto the latest 15.x patch release. At the time of this audit, 15.3+ is available with meaningful fixes.

### 1b — Caret-Ranged Packages with Broad Latitude [MEDIUM]

Most dependencies use `^` (caret) ranges, which allow minor and patch bumps. This is fine for stable libraries but requires a regular `npm audit` + `npm outdated` discipline. Notable packages with wide ranges:

- `openai: ^4.65.0` — the OpenAI SDK ships breaking changes in minor versions (e.g. `v5` was a major rewrite). The `^` range is fine here, but the lock file resolves to `4.104.0`, which is significantly ahead of the declared floor.
- `stripe: ^17.1.0` — lock resolves to `17.7.0`. Stripe SDKs are generally stable within a major, but the API version string `2025-02-24.acacia` hardcoded in `src/lib/stripe.ts` should be reviewed when upgrading.
- `framer-motion: ^11.11.0` — lock resolves to `11.18.2`. This library ships frequent releases; caret is appropriate.

---

## Section 2 — Security-Sensitive Package Versions

### Finding 1 — `next-auth 5.0.0-beta.25` Beta in Production [CRITICAL]

**File:** `package.json:57`

The application uses `next-auth 5.0.0-beta.25`, which is pre-release software. As of March 2026, NextAuth v5 has gone stable (`5.x.x`). The beta had known issues including:

- JWT session token expiry not always respected in middleware
- OAuth token refresh edge cases with certain providers
- The `auth()` helper returning stale session data under specific caching conditions

The credentials provider (`src/lib/auth.ts:27-54`) and JWT callbacks (`src/lib/auth.ts:56-71`) are both production-critical paths. Running beta auth middleware in production is a material risk.

**Recommendation:** Upgrade to the latest stable `next-auth@5` immediately:
```
npm install next-auth@latest @auth/prisma-adapter@latest
```
Review the NextAuth v5 stable migration notes before upgrading.

### Finding 2 — `bcryptjs 2.4.3` — Outdated, No Native Bindings [HIGH]

**File:** `package.json:49`

`bcryptjs 2.4.3` was released in 2020. This is a pure-JavaScript bcrypt implementation. While it remains functionally correct, two concerns apply:

1. **Age:** No updates in 4+ years means no response to any potential timing side-channel discoveries.
2. **Performance:** Pure-JS bcrypt is significantly slower than native alternatives. With cost factor 10 (used in `src/app/api/auth/register/route.ts:34`), password hashing blocks the event loop for ~100–200ms in a serverless context.

**Recommendation:** Migrate to `bcrypt` (native bindings via node-gyp) or `@node-rs/bcrypt` (Rust-based, zero native-build complexity, ~10x faster). Since this runs in Next.js API routes on Vercel, `@node-rs/bcrypt` is the best fit—it ships prebuilt binaries for Linux x64 and ARM.

```
npm uninstall bcryptjs @types/bcryptjs
npm install @node-rs/bcrypt
```

### Finding 3 — `stripe 17.x` — API Version String Hardcoded [MEDIUM]

**File:** `src/lib/stripe.ts:4`

```ts
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia",
});
```

The API version is hardcoded rather than being driven by the SDK's default. This is actually correct Stripe practice (explicit API versions prevent surprise behavior changes), but it means the version must be manually reviewed and updated whenever the Stripe SDK is upgraded. There is no test or lint rule enforcing this.

**Recommendation:** Document the explicit API version in a constant with a comment linking to the Stripe changelog, and add a note to the upgrade runbook to verify the API version on each Stripe SDK bump.

### Finding 4 — `next 15.0.0` Missing Security Patches [HIGH]

Next.js 15.0.0 (released October 2024) is several patch versions behind. Subsequent 15.x releases have addressed:

- Server Action CSRF vulnerability (CVE-2024-56332 class)
- Middleware matcher edge cases
- Cache poisoning edge cases in `fetch` deduplication

**Recommendation:** `npm install next@^15` and let the lockfile pull the latest 15.x.

---

## Section 3 — Unnecessary / Redundant Packages

### Finding 5 — `framer-motion` Is Installed But Unused [HIGH]

**File:** `package.json:53`

`framer-motion` is listed as a runtime dependency (`^11.11.0`, resolves to `11.18.2`). A full-text search of `src/` finds **zero imports** of `framer-motion` or any `motion.*` usage in any `.tsx` or `.ts` file. The package weighs approximately 110 KB gzipped and pulls in `motion-dom` and `motion-utils` as sub-dependencies, adding to the production JS bundle with no benefit.

**Recommendation:** Remove immediately:
```
npm uninstall framer-motion
```

### Finding 6 — `@tanstack/react-query-devtools` in Runtime Dependencies [HIGH]

**File:** `package.json:43`, `src/components/providers.tsx:27`

```ts
{process.env.NODE_ENV === "development" && <ReactQueryDevtools />}
```

The devtools are correctly gated behind a `NODE_ENV` check at runtime, but the package itself is declared in `dependencies` (not `devDependencies`). This means:

1. The package is included in production `node_modules` and shipped to Vercel.
2. Tree-shaking may not fully eliminate it from the production bundle because the import is unconditional at the module level (`import { ReactQueryDevtools } from "@tanstack/react-query-devtools"`).

**Recommendation:** Move to `devDependencies`:
```json
"devDependencies": {
  "@tanstack/react-query-devtools": "^5.56.0"
}
```
Then wrap the import with `process.env.NODE_ENV !== 'production'` dynamic import or use Next.js `next/dynamic` with `{ ssr: false }` to ensure it is never bundled.

### Finding 7 — `clsx` and `tailwind-merge` Are Redundant with Each Other Without a Wrapper [LOW]

**File:** `package.json:51-52`

The project uses both `clsx` and `tailwind-merge`. This is a common and accepted pattern in shadcn/ui projects—the `cn()` utility in `src/lib/utils.ts` composes them:

```ts
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

This is correct usage. Neither package is redundant given this design. **No action required.**

---

## Section 4 — Packages with Lighter Alternatives

### Finding 8 — `date-fns` vs Native `Intl` [MEDIUM]

**File:** `package.json:52`

`date-fns 3.6.0` resolves to `3.6.0` (lock). The library is used in **32 files** across `src/`. The breadth of usage (formatting, parsing, date arithmetic, locale-aware display) means a wholesale replacement with native `Intl` APIs would be disruptive and is **not recommended** at this stage.

However, `date-fns` v3 supports full tree-shaking with named exports, so bundle impact should be minimal provided imports use the named-function style (`import { format } from 'date-fns'`) rather than the barrel (`import * as dateFns from 'date-fns'`).

**Recommendation:** Audit imports to confirm all 32 files use named imports. No library replacement needed.

### Finding 9 — `recharts` vs Lighter Alternatives [MEDIUM]

**File:** `package.json:66`

`recharts 2.15.4` is used across 9 files (analytics dashboard, campaign cards, marketing pages). Recharts bundles the entire D3 ecosystem (`d3-array`, `d3-color`, `d3-ease`, `d3-format`, `d3-interpolate`, `d3-path`, `d3-scale`, `d3-shape`, `d3-time`, `d3-time-format`, `d3-timer`) plus `victory-vendor`. Total compressed weight is approximately 200–250 KB.

**Lighter alternatives:**
- **`chart.js` + `react-chartjs-2`**: ~60 KB gzipped, sufficient for bar/line/pie charts
- **`tremor`**: purpose-built for SaaS dashboards, ships Tailwind-styled charts with minimal bundle overhead
- **`@visx/`**: D3-powered but composable—import only what you need

**Recommendation:** For an MVP SaaS, recharts is pragmatic. If bundle size becomes a concern (Lighthouse scores, LCP on analytics page), evaluate migrating the analytics dashboard to `chart.js`. Defer this work until after v1 launch.

### Finding 10 — `react-dropzone` — Acceptable, No Lighter Alternative [LOW]

`react-dropzone 14.4.1` is used for media uploads. The HTML5 File API alone cannot replicate drag-and-drop with the accessibility and cross-browser consistency `react-dropzone` provides. **No action required.**

---

## Section 5 — Missing Production SaaS Packages

### Finding 11 — No Error Tracking (Sentry) [CRITICAL]

There is no error tracking integration anywhere in the codebase. The application catches errors in several places (Stripe webhook handler, cron publish engine, API routes) but only logs to `console.error`. In production on Vercel, `console.error` output is captured in function logs but:

- Not aggregated or searchable by default
- Not alerted on
- Not correlated with user sessions or releases

A single unhandled exception in the Stripe webhook handler, the cron publisher, or a social platform API call will fail silently unless someone is actively watching logs.

**Recommendation — Add Sentry:**
```
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

Key integration points:
- `next.config.ts`: wrap with `withSentryConfig`
- `src/app/global-error.tsx`: capture React render errors
- `src/app/api/billing/webhook/route.ts`: wrap event handlers with `Sentry.captureException`
- `src/lib/scheduler/publish-engine.ts`: wrap publish failures with Sentry before returning

### Finding 12 — No Structured Logging (Axiom / Datadog) [HIGH]

The codebase contains **67 `console.log/error/warn` statements**. In a serverless environment, these produce unstructured text logs with no:
- Correlation IDs (request tracing)
- Structured fields (workspace ID, user ID, post ID)
- Log levels queryable via a UI
- Retention beyond Vercel's 1-hour default on free plans

**Recommendation — Add Axiom:**

Axiom has a purpose-built Next.js SDK and a generous free tier:
```
npm install @axiomhq/nextjs
```

Configure via `next.config.ts`:
```ts
import { withAxiom } from '@axiomhq/nextjs';
export default withAxiom(nextConfig);
```

Then replace `console.log` with structured log objects progressively. Axiom automatically captures all `console.*` calls and adds request context (URL, method, duration) when using the `withAxiom` wrapper.

Alternatively, **Datadog** (`dd-trace`) is production-grade but heavier to configure and has no meaningful free tier. Axiom is the better starting point for an early-stage SaaS.

### Finding 13 — In-Memory Rate Limiter Must Be Replaced with Upstash Redis [CRITICAL]

**File:** `src/lib/api/rate-limit.ts`

The file itself contains this comment:
```ts
// In production, swap this backing store for Redis (e.g. Upstash) for multi-instance support.
const counters = new Map<string, CounterEntry>();
```

The in-memory `Map` resets on every cold-start. On Vercel, serverless functions can have dozens of concurrent instances. This means:

1. Each instance maintains an independent counter
2. A customer can exceed their daily API limit by a multiple of the number of active function instances
3. Counters reset silently on every deployment or cold-start

**Recommendation — Add Upstash Redis:**
```
npm install @upstash/redis @upstash/ratelimit
```

Replace the `checkRateLimit` implementation:
```ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(100, "1 d"),
  analytics: true,
});

export async function checkRateLimit(apiKeyId: string, plan: string, operation: "read" | "write") {
  const limit = getLimit(plan);
  if (limit === 0) return errorResponse("API access not available on your plan", 403, "PLAN_NOT_SUPPORTED");
  if (operation === "read") return { headers: { "X-RateLimit-Limit": String(limit) } };

  const { success, remaining, reset } = await ratelimit.limit(apiKeyId);
  if (!success) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded", code: "RATE_LIMIT_EXCEEDED" }), {
      status: 429,
      headers: { "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)) },
    });
  }
  return { headers: { "X-RateLimit-Limit": String(limit), "X-RateLimit-Remaining": String(remaining) } };
}
```

Upstash Redis is serverless-native (HTTP-based, no persistent connections), has a free tier, and integrates directly with Vercel environment variables via the Vercel integration.

### Finding 14 — No Health Check / Uptime Monitoring Endpoint [MEDIUM]

There is no `/api/health` or `/api/ping` endpoint. Without this, Vercel's uptime monitoring and external services (BetterUptime, Checkly) have no lightweight target to verify the application is responding.

**Recommendation:** Add a lightweight health route:
```ts
// src/app/api/health/route.ts
export async function GET() {
  return Response.json({ status: "ok", ts: Date.now() });
}
```

---

## Section 6 — Dev vs Runtime Dependency Placement

| Package | Current Placement | Correct Placement | Issue |
|---|---|---|---|
| `@tanstack/react-query-devtools` | `dependencies` | `devDependencies` | Shipped to production unnecessarily |
| `prisma` (CLI) | `devDependencies` | `devDependencies` | Correct — `@prisma/client` in deps is also correct |
| `tsx` | `devDependencies` | `devDependencies` | Correct — used only for `db:seed` script |
| `typescript` | `devDependencies` | `devDependencies` | Correct |
| `tailwindcss` | `devDependencies` | `devDependencies` | Correct — compiled at build time |
| `eslint` | `devDependencies` | `devDependencies` | Correct |

The only misplacement is `@tanstack/react-query-devtools` (see Finding 6).

---

## Section 7 — Missing Peer Dependency Configurations

### Finding 15 — `@react-email/render` Is a Transitive Dependency Without a Direct Declaration [MEDIUM]

**File:** `src/lib/email/resend.ts:2`

```ts
import { render } from "@react-email/render";
```

`@react-email/render` is imported directly in source code but is **not listed** in `package.json` as a dependency. It resolves at install time only because `resend` pulls it in transitively (`resend → @react-email/render`). If Resend ever drops or changes this transitive dependency, the build will break without a clear error message.

**Recommendation:** Add an explicit declaration:
```json
"@react-email/render": "^1.0.0"
```

### Finding 16 — `react` and `react-dom` Peer Requirements Not Declared for Radix UI [LOW]

All `@radix-ui/*` packages require `react >=16.8` and `react-dom >=16.8`. The project satisfies this with `react: ^18.3.1`. This is not a problem, but if `peerDependenciesMeta` is needed for `npm install --legacy-peer-deps` scenarios in CI, it should be documented.

No action required for the current setup.

---

## Section 8 — Missing Recommended Production Tools

The table below summarises all missing tooling, with severity and recommended package:

| Gap | Severity | Recommended Package | Install Command |
|---|---|---|---|
| Error tracking | CRITICAL | `@sentry/nextjs` | `npm install @sentry/nextjs` |
| Distributed rate limiting | CRITICAL | `@upstash/redis` + `@upstash/ratelimit` | `npm install @upstash/redis @upstash/ratelimit` |
| Structured logging | HIGH | `@axiomhq/nextjs` | `npm install @axiomhq/nextjs` |
| Security headers | HIGH | `next-safe-headers` or manual `next.config.ts` | `npm install next-safe-headers` |
| Dependency vulnerability scanning | HIGH | `npm audit` in CI (no package needed) | Add to GitHub Actions workflow |
| Health endpoint | MEDIUM | (custom route, no package) | See Finding 14 |
| Bundle analysis | LOW | `@next/bundle-analyzer` | `npm install -D @next/bundle-analyzer` |
| OpenAPI validation | LOW | `zod-to-openapi` or `@asteasolutions/zod-to-openapi` | For the existing v1 API |

---

## Section 9 — Complete Finding Summary

| # | Finding | Severity | Effort |
|---|---|---|---|
| 1 | `next-auth 5.0.0-beta.25` in production | CRITICAL | Low — `npm install next-auth@latest` |
| 11 | No Sentry error tracking | CRITICAL | Medium — 2–4 hours integration |
| 13 | In-memory rate limiter (not Redis-backed) | CRITICAL | Medium — 2–4 hours, see code above |
| 2 | `bcryptjs 2.4.3` — outdated, slow | HIGH | Low — swap to `@node-rs/bcrypt` |
| 4 | `next 15.0.0` missing security patches | HIGH | Low — `npm install next@^15` |
| 5 | `framer-motion` installed but unused | HIGH | Trivial — `npm uninstall framer-motion` |
| 6 | `react-query-devtools` in runtime deps | HIGH | Trivial — move to devDependencies |
| 12 | No structured logging (Axiom/Datadog) | HIGH | Medium — 1–2 hours integration |
| 8 | `date-fns` import style audit | MEDIUM | Low — grep and fix imports |
| 9 | `recharts` bundle weight | MEDIUM | High — defer to post-launch |
| 14 | No health check endpoint | MEDIUM | Trivial — 10 lines of code |
| 15 | `@react-email/render` undeclared direct dep | MEDIUM | Trivial — add to package.json |
| 3 | Stripe API version hardcoded, no upgrade notes | MEDIUM | Low — documentation only |
| 16 | Radix UI peer deps not declared | LOW | Trivial |
| 10 | `react-dropzone` — no action needed | LOW | None |

---

## Recommended Immediate Actions (Priority Order)

1. **Upgrade `next` and `next-auth` to latest stable** — unblock security patches and exit beta auth.
2. **Replace the in-memory rate limiter with Upstash Redis** — the current implementation is functionally broken in multi-instance serverless deployments.
3. **Add Sentry** — the application has no visibility into production errors. One failed Stripe webhook or failed scheduled publish goes completely undetected.
4. **Remove `framer-motion`** — zero-effort bundle size win.
5. **Move `@tanstack/react-query-devtools` to `devDependencies`** — correctness fix.
6. **Add `@react-email/render` as an explicit dependency** — prevents a future silent breakage.
7. **Add Axiom structured logging** — replace 67 `console.*` calls progressively.
8. **Run `npm audit`** — the lock file has not been audited in this review. Run immediately and address any HIGH/CRITICAL advisories.
