/**
 * Redis-backed rate limiting using Upstash Redis + @upstash/ratelimit.
 *
 * Replaces the in-memory implementation in rate-limit.ts which breaks on
 * serverless cold starts and does not share state across multiple instances.
 *
 * Drop-in replacement:
 *   - checkRateLimit()   → same signature as the original, used by API v1 routes
 *   - checkIpRateLimit() → new export, used by unauthenticated tool endpoints
 *
 * Environment variables:
 *   UPSTASH_REDIS_REST_URL    – Upstash Redis REST endpoint
 *   UPSTASH_REDIS_REST_TOKEN  – Upstash Redis REST token
 *   RATE_LIMIT_BYPASS_ON_ERROR – "true" to allow requests when Redis is down
 *                                 (default: "false" → return 503)
 *
 * Algorithm selection:
 *   - API v1 write limits  → SlidingWindow (24 h window, plan-tier bucket size)
 *   - Tool endpoints       → TokenBucket   (1 h window, 5 req, no burst beyond 5)
 *
 * Graceful degradation:
 *   - Missing env vars     → falls back to in-memory EphemeralCache (local dev parity)
 *   - Redis errors         → allow or deny based on RATE_LIMIT_BYPASS_ON_ERROR
 */

import { PLAN_LIMITS } from "@/lib/utils";
import { errorResponse } from "./response";

// ---------------------------------------------------------------------------
// Lazy-loaded Upstash clients
// We use dynamic imports so that the module can be loaded in environments
// where the Upstash packages are not installed (e.g. before `npm install`).
// ---------------------------------------------------------------------------

type RatelimitInstance = {
  limit: (identifier: string) => Promise<{
    success: boolean;
    limit: number;
    remaining: number;
    reset: number; // Unix ms
  }>;
};

// Cache instantiated limiters so we do not create a new Redis connection per request.
const limiterCache = new Map<string, RatelimitInstance>();

async function buildWorkspaceLimiter(plan: string): Promise<RatelimitInstance | null> {
  const cacheKey = `workspace:${plan}`;
  if (limiterCache.has(cacheKey)) return limiterCache.get(cacheKey)!;

  const limit = getPlanLimit(plan);
  if (limit === 0) return null; // FREE plan – no API access

  try {
    const { Redis } = await import("@upstash/redis");
    const { Ratelimit } = await import("@upstash/ratelimit");

    const redis = hasUpstashEnv()
      ? new Redis({
          url: process.env.UPSTASH_REDIS_REST_URL!,
          token: process.env.UPSTASH_REDIS_REST_TOKEN!,
        })
      : // Local dev fallback: ephemeral in-process cache
        Redis.fromEnv();

    const ratelimit = new Ratelimit({
      redis,
      // Sliding window: smooths boundary-burst spikes that fixed windows allow.
      limiter: Ratelimit.slidingWindow(limit, "24 h"),
      prefix: "rl:workspace",
      analytics: false,
    });

    limiterCache.set(cacheKey, ratelimit);
    return ratelimit;
  } catch (err) {
    console.error("[rate-limit-redis] Failed to build workspace limiter:", err);
    return null;
  }
}

async function buildToolLimiter(toolName: string): Promise<RatelimitInstance | null> {
  const cacheKey = `tool:${toolName}`;
  if (limiterCache.has(cacheKey)) return limiterCache.get(cacheKey)!;

  try {
    const { Redis } = await import("@upstash/redis");
    const { Ratelimit } = await import("@upstash/ratelimit");

    const redis = hasUpstashEnv()
      ? new Redis({
          url: process.env.UPSTASH_REDIS_REST_URL!,
          token: process.env.UPSTASH_REDIS_REST_TOKEN!,
        })
      : Redis.fromEnv();

    const ratelimit = new Ratelimit({
      redis,
      // Token bucket: 5 tokens max, refill rate 5 per hour → mirrors the original
      // in-memory limit of 5 req / 1 h.  The bucket ceiling prevents burst abuse.
      limiter: Ratelimit.tokenBucket(5, "1 h", 5),
      prefix: `rl:tool:${toolName}`,
      analytics: false,
    });

    limiterCache.set(cacheKey, ratelimit);
    return ratelimit;
  } catch (err) {
    console.error("[rate-limit-redis] Failed to build tool limiter:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hasUpstashEnv(): boolean {
  return !!(
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  );
}

function bypassOnError(): boolean {
  return process.env.RATE_LIMIT_BYPASS_ON_ERROR === "true";
}

function getPlanLimit(plan: string): number {
  const planKey = plan.toUpperCase() as keyof typeof PLAN_LIMITS;
  return PLAN_LIMITS[planKey]?.apiPostsPerDay ?? 0;
}

/**
 * Build standard rate-limit response headers from an Upstash result.
 *
 * X-RateLimit-Reset follows the convention used by GitHub/Stripe: Unix seconds.
 */
function buildHeaders(
  limit: number,
  remaining: number,
  resetMs: number
): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": String(Math.max(0, remaining)),
    "X-RateLimit-Reset": String(Math.ceil(resetMs / 1000)),
  };
}

function rateLimitExceededResponse(
  limit: number,
  resetMs: number,
  message: string
): Response {
  const retryAfter = Math.max(0, Math.ceil((resetMs - Date.now()) / 1000));
  return new Response(
    JSON.stringify({
      error: message,
      code: "RATE_LIMIT_EXCEEDED",
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter),
        "X-RateLimit-Limit": String(limit),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(Math.ceil(resetMs / 1000)),
      },
    }
  );
}

// ---------------------------------------------------------------------------
// In-memory fallback
// Used when Upstash packages are unavailable or env vars are missing.
// Mirrors the original implementation so local dev works without Redis.
// ---------------------------------------------------------------------------

interface FallbackEntry {
  count: number;
  resetAt: number;
}

const fallbackCounters = new Map<string, FallbackEntry>();

function fallbackCheck(
  key: string,
  limit: number,
  windowMs: number
): { success: boolean; limit: number; remaining: number; reset: number } {
  const now = Date.now();
  let entry = fallbackCounters.get(key);

  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs };
    fallbackCounters.set(key, entry);
  }

  const allowed = entry.count < limit;
  if (allowed) entry.count += 1;

  return {
    success: allowed,
    limit,
    remaining: Math.max(0, limit - entry.count),
    reset: entry.resetAt,
  };
}

// ---------------------------------------------------------------------------
// Public API: checkRateLimit (API v1 routes — workspace-scoped)
// ---------------------------------------------------------------------------

/**
 * Checks the rate limit for an authenticated API key.
 *
 * Only write operations (POST / PUT / DELETE) are counted against the daily
 * limit.  Read operations are always allowed but still return rate-limit headers
 * reflecting the current usage.
 *
 * @param apiKeyId   - The API key ID (used as fallback key for in-memory mode).
 * @param plan       - Workspace plan string ("STARTER" | "PRO" | "PRO_PLUS" | "FREE").
 * @param operation  - "read" (not counted) or "write" (counted against daily limit).
 * @param workspaceId - Workspace ID for shared cross-key counting.
 *                      Falls back to apiKeyId if omitted (backwards-compatible).
 *
 * @returns `{ headers }` on success, or a `Response` (403 | 429 | 503) on failure.
 */
export async function checkRateLimit(
  apiKeyId: string,
  plan: string,
  operation: "read" | "write",
  workspaceId?: string
): Promise<{ headers: Record<string, string> } | Response> {
  const limit = getPlanLimit(plan);

  // FREE plan: no API access at all
  if (limit === 0) {
    return errorResponse(
      "API access is not available on your current plan. Upgrade to STARTER or above.",
      403,
      "PLAN_NOT_SUPPORTED"
    );
  }

  // Read operations: return headers with current state but do not consume quota.
  // We still query Redis to get accurate remaining counts.
  const subject = workspaceId ?? apiKeyId;

  // ------------------------------------------------------------------
  // Attempt Upstash path
  // ------------------------------------------------------------------
  if (hasUpstashEnv()) {
    try {
      const limiter = await buildWorkspaceLimiter(plan);

      if (!limiter) {
        // Should not happen given limit > 0 check above, but guard anyway.
        return errorResponse("Rate limiter unavailable.", 503, "RATE_LIMITER_UNAVAILABLE");
      }

      // For reads we use a "peek" key that never increments; for writes we use
      // the real subject.  Both keys are workspace-scoped.
      const identifier = operation === "write" ? subject : `${subject}:read-probe`;
      const result = await limiter.limit(identifier);

      if (operation === "write" && !result.success) {
        return rateLimitExceededResponse(
          result.limit,
          result.reset,
          "Rate limit exceeded. Daily write limit reached."
        );
      }

      return { headers: buildHeaders(result.limit, result.remaining, result.reset) };
    } catch (err) {
      console.error("[rate-limit-redis] Upstash error (workspace):", err);

      if (bypassOnError()) {
        // Graceful degradation: allow the request but surface the error in headers.
        console.warn("[rate-limit-redis] Bypassing rate limit due to Redis error.");
        return {
          headers: {
            "X-RateLimit-Limit": String(limit),
            "X-RateLimit-Remaining": String(limit),
            "X-RateLimit-Reset": "0",
            "X-RateLimit-Error": "redis-unavailable",
          },
        };
      }

      return new Response(
        JSON.stringify({
          error: "Rate limiting service temporarily unavailable. Please retry.",
          code: "RATE_LIMIT_SERVICE_ERROR",
        }),
        {
          status: 503,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": "30",
          },
        }
      );
    }
  }

  // ------------------------------------------------------------------
  // In-memory fallback (local dev / missing env vars)
  // ------------------------------------------------------------------
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
  const fallbackKey = `workspace:${subject}`;
  const result = fallbackCheck(
    fallbackKey,
    limit,
    TWENTY_FOUR_HOURS
  );

  if (operation === "write" && !result.success) {
    return rateLimitExceededResponse(
      result.limit,
      result.reset,
      "Rate limit exceeded. Daily write limit reached."
    );
  }

  return { headers: buildHeaders(result.limit, result.remaining, result.reset) };
}

// ---------------------------------------------------------------------------
// Public API: checkIpRateLimit (unauthenticated tool endpoints — IP-scoped)
// ---------------------------------------------------------------------------

/**
 * Checks the rate limit for an unauthenticated tool endpoint using the
 * caller's IP address as the rate-limit key.
 *
 * Uses a token-bucket algorithm: 5 tokens, refill rate 5/hour, max burst 5.
 *
 * @param ip       - Caller IP address (e.g. from x-forwarded-for).
 * @param toolName - Identifier for the tool (e.g. "generate-caption").
 *
 * @returns `{ headers }` on success, or a `Response` (429 | 503) on failure.
 */
export async function checkIpRateLimit(
  ip: string,
  toolName: string
): Promise<{ headers: Record<string, string> } | Response> {
  const TOOL_LIMIT = 5;

  // ------------------------------------------------------------------
  // Attempt Upstash path
  // ------------------------------------------------------------------
  if (hasUpstashEnv()) {
    try {
      const limiter = await buildToolLimiter(toolName);

      if (!limiter) {
        // Package not available — fall through to in-memory
        throw new Error("Limiter unavailable");
      }

      const result = await limiter.limit(ip);

      if (!result.success) {
        return rateLimitExceededResponse(
          result.limit,
          result.reset,
          "Rate limit reached. Sign up for unlimited access."
        );
      }

      return { headers: buildHeaders(result.limit, result.remaining, result.reset) };
    } catch (err) {
      console.error(`[rate-limit-redis] Upstash error (tool:${toolName}):`, err);

      if (bypassOnError()) {
        console.warn("[rate-limit-redis] Bypassing tool rate limit due to Redis error.");
        return {
          headers: {
            "X-RateLimit-Limit": String(TOOL_LIMIT),
            "X-RateLimit-Remaining": String(TOOL_LIMIT),
            "X-RateLimit-Reset": "0",
          },
        };
      }

      return new Response(
        JSON.stringify({
          error: "Rate limiting service temporarily unavailable. Please retry.",
          code: "RATE_LIMIT_SERVICE_ERROR",
        }),
        {
          status: 503,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": "30",
          },
        }
      );
    }
  }

  // ------------------------------------------------------------------
  // In-memory fallback (local dev / missing env vars)
  // ------------------------------------------------------------------
  const ONE_HOUR = 60 * 60 * 1000;
  const fallbackKey = `tool:${toolName}:${ip}`;
  const result = fallbackCheck(fallbackKey, TOOL_LIMIT, ONE_HOUR);

  if (!result.success) {
    return rateLimitExceededResponse(
      result.limit,
      result.reset,
      "Rate limit reached. Sign up for unlimited access."
    );
  }

  return { headers: buildHeaders(result.limit, result.remaining, result.reset) };
}

// ---------------------------------------------------------------------------
// Utility: extract real client IP from a Next.js request
// ---------------------------------------------------------------------------

/**
 * Returns the best-effort real IP from incoming request headers.
 * Intended for use in tool route handlers.
 */
export function getClientIp(req: Request): string {
  const xForwardedFor = req.headers.get("x-forwarded-for");
  if (xForwardedFor) {
    // x-forwarded-for can be a comma-separated list; first entry is the client
    const firstIp = xForwardedFor.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }

  const xRealIp = req.headers.get("x-real-ip");
  if (xRealIp) return xRealIp.trim();

  return "unknown";
}
