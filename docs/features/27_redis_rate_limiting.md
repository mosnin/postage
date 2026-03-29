# Feature 27: Redis / Upstash Rate Limiting

## 1. Problems with the Current In-Memory Approach

PostSyncer runs on Next.js deployed to a serverless edge environment (Vercel / similar).
The current implementation (`src/lib/api/rate-limit.ts`) keeps counters in a plain
JavaScript `Map` that lives inside the Node.js module scope:

```ts
const counters = new Map<string, CounterEntry>();
```

This has three critical flaws:

| Problem | Impact |
|---|---|
| **Cold-start resets** | Each new serverless function invocation starts with an empty `Map`. A client that hit the limit in a warm instance can immediately bypass it on a cold instance. |
| **No cross-instance sharing** | Multiple concurrent instances (horizontal scale-out) each maintain independent counters. The effective limit is `N * limit` where N is the number of live instances. |
| **Memory leak** | The `Map` grows without bound. Entries for stale API keys or rotated keys are never evicted. |

The free-tool routes (`/api/tools/generate-caption`, `/api/tools/generate-hashtags`)
duplicate a second bespoke in-memory limiter inside the route file itself, compounding
the same problems for IP-based limiting.

---

## 2. Architecture: Upstash Redis

[Upstash](https://upstash.com) provides a serverless Redis compatible with edge
runtimes. The `@upstash/ratelimit` package wraps it with battle-tested algorithms
backed by atomic Lua scripts, so no race conditions occur even across thousands of
concurrent instances.

### Packages

```bash
npm install @upstash/redis @upstash/ratelimit
```

### Environment Variables

```env
# Required – obtain from https://console.upstash.com
UPSTASH_REDIS_REST_URL=https://<your-instance>.upstash.io
UPSTASH_REDIS_REST_TOKEN=<your-token>

# Optional – enables graceful degradation when Redis is unavailable
RATE_LIMIT_BYPASS_ON_ERROR=false
```

---

## 3. Rate Limit Algorithms

### 3.1 Fixed Window (current approach parity)

Counts requests in a fixed time bucket (e.g. a calendar day).
Simple but can allow 2× the limit at a window boundary (burst at end + start).

```
Bucket: [00:00 UTC ──────────── 23:59 UTC]
         ↑ counter resets here
```

### 3.2 Sliding Window (recommended for API v1)

A weighted combination of the previous window's count and the current window's count,
proportional to how far through the current window we are.  Smooths boundary bursts.

```
effective_count = prev_count × (1 - elapsed_fraction) + curr_count
```

Use case: workspace-scoped daily post limits.

### 3.3 Token Bucket (recommended for tool endpoints)

A bucket that fills at a constant rate (`refillRate` tokens per `interval`).
Bursts are allowed up to `maxTokens`. Good for short-window, bursty traffic.

```
tokens available = min(maxTokens, stored_tokens + elapsed × refillRate)
```

Use case: unauthenticated IP-based tool endpoints (allow 5 requests per hour with
no burst beyond 5).

---

## 4. Rate Limit Tiers per Plan

Derived directly from `PLAN_LIMITS` in `src/lib/utils.ts`:

| Plan | Daily write limit | Window algorithm |
|---|---|---|
| `FREE` | 0 (no API access) | — |
| `STARTER` | 100 posts/day | Sliding window, 24 h |
| `PRO` | 250 posts/day | Sliding window, 24 h |
| `PRO_PLUS` | 500 posts/day | Sliding window, 24 h |

Read operations are not counted against the daily limit (same behaviour as today).

IP-based tool endpoints (unauthenticated):

| Endpoint | Limit | Algorithm |
|---|---|---|
| `POST /api/tools/generate-caption` | 5 req / 1 h | Token bucket |
| `POST /api/tools/generate-hashtags` | 5 req / 1 h | Token bucket |

---

## 5. Per-Endpoint vs Global Rate Limiting

**API v1 (authenticated, workspace-scoped)**

- One global daily write counter per workspace+plan, shared across all v1 endpoints.
- Key format: `rl:workspace:{workspaceId}:{YYYY-MM-DD}`
- This mirrors the product intent: "N posts created via API per day".

**Tool endpoints (unauthenticated, IP-scoped)**

- Per-endpoint limiter so caption and hashtag quotas are independent.
- Key format: `rl:tool:{endpoint}:{ip}` (Upstash appends the window suffix automatically).

---

## 6. Rate Limit Headers

All responses include the standard headers:

| Header | Description |
|---|---|
| `X-RateLimit-Limit` | Maximum requests allowed in the window |
| `X-RateLimit-Remaining` | Requests remaining in the current window |
| `X-RateLimit-Reset` | Unix timestamp (seconds) when the window resets |

On a `429` response, `Retry-After` (seconds until reset) is also included.

---

## 7. IP-Based Rate Limiting (Free Tools)

The tool routes extract the real client IP in order of preference:

1. `x-forwarded-for` (first entry, stripped of port)
2. `x-real-ip`
3. Fallback: `"unknown"` (treated as a shared bucket — effectively a global limit
   for requests with no IP header, which is acceptable for a fallback)

---

## 8. Workspace-Based Rate Limiting (API v1)

After `authenticateApiKey` resolves, the `auth.workspaceId` value is used as the
rate-limit subject. This ensures:

- Multiple API keys belonging to the same workspace share the same daily budget.
- Rotating an API key does not reset the counter.
- The plan tier is read from `auth.plan` which is already validated by the auth middleware.

---

## 9. Graceful Degradation

If Upstash is unreachable (network partition, misconfiguration, cold Redis instance):

- When `RATE_LIMIT_BYPASS_ON_ERROR=true` (default `false`): the function returns
  `{ success: true, limit, remaining: limit, reset: 0 }` — effectively allowing the
  request through with a warning logged to `console.error`.
- When `RATE_LIMIT_BYPASS_ON_ERROR=false` (strict mode): the function returns a
  `503 Service Unavailable` response so the client knows to retry.

The `allowOnError` flag is exposed in `createRateLimiter` so individual call sites
can override the default.

---

## 10. Full Replacement Implementation

See `src/lib/api/rate-limit-redis.ts` for the complete implementation.

### Drop-in migration steps

1. Install dependencies:
   ```bash
   npm install @upstash/redis @upstash/ratelimit
   ```

2. Add environment variables to `.env.local` and your deployment provider.

3. Replace the import in every API route:
   ```diff
   - import { checkRateLimit } from "@/lib/api/rate-limit";
   + import { checkRateLimit } from "@/lib/api/rate-limit-redis";
   ```
   The function signature is **identical** to the existing `checkRateLimit` export so
   no other changes are needed in the v1 routes.

4. Replace the inline limiters in tool routes with `checkIpRateLimit`:
   ```ts
   import { checkIpRateLimit } from "@/lib/api/rate-limit-redis";

   export async function POST(req: NextRequest) {
     const ip = getIp(req);
     const result = await checkIpRateLimit(ip, "generate-caption");
     if (result instanceof Response) return result;
     // result.headers carries X-RateLimit-* headers
   }
   ```

5. (Optional) In `next.config.js` / middleware, ensure `x-forwarded-for` is
   trusted only from your CDN/proxy.

---

## 11. Key Naming Conventions

```
rl:workspace:{workspaceId}          # sliding-window daily write limit
rl:tool:{toolName}:{ip}             # token-bucket per-IP tool limit
```

Upstash `@upstash/ratelimit` appends its own window suffix internally, so the keys
above are the identifier passed to `ratelimit.limit(identifier)`.

---

## 12. Testing Without Upstash (Local Dev)

If `UPSTASH_REDIS_REST_URL` is not set, the module falls back to an ephemeral
in-memory store (same behaviour as today).  This is intentional — developers should
not need a Redis instance to run the app locally.

```ts
// src/lib/api/rate-limit-redis.ts automatically detects missing env vars
// and falls back to the in-memory Upstash ephemeral store via:
//   new Redis({ enableAutoPipelining: true }) — noop client
// or the @upstash/ratelimit EphemeralCache option
```
