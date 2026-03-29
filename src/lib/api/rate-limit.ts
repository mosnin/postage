import { PLAN_LIMITS } from "@/lib/utils";
import { errorResponse } from "./response";

// In-memory store: key → { count, resetAt }
// In production, swap this backing store for Redis (e.g. Upstash) for multi-instance support.
interface CounterEntry {
  count: number;
  resetAt: number; // Unix ms of midnight UTC (start of next day)
}

const counters = new Map<string, CounterEntry>();

function getMidnightUTC(): number {
  const now = new Date();
  const midnight = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
  );
  return midnight.getTime();
}

function getTodayKey(apiKeyId: string): string {
  const now = new Date();
  const date = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
  return `${apiKeyId}:${date}`;
}

function getLimit(plan: string): number {
  const planKey = plan.toUpperCase() as keyof typeof PLAN_LIMITS;
  return PLAN_LIMITS[planKey]?.apiPostsPerDay ?? 0;
}

/**
 * Checks the rate limit for an API key.
 * Only write operations (POST/PUT/DELETE) are counted against the daily limit.
 * Returns an object with limit/remaining headers on success, or a 429 Response on exceed.
 */
export async function checkRateLimit(
  apiKeyId: string,
  plan: string,
  operation: "read" | "write"
): Promise<{ headers: Record<string, string> } | Response> {
  const limit = getLimit(plan);

  // FREE plan has no API access
  if (limit === 0) {
    return errorResponse(
      "API access is not available on your current plan. Upgrade to STARTER or above.",
      403,
      "PLAN_NOT_SUPPORTED"
    );
  }

  const key = getTodayKey(apiKeyId);
  const now = Date.now();

  // Get or initialise counter
  let entry = counters.get(key);
  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: getMidnightUTC() };
    counters.set(key, entry);
  }

  const currentCount = entry.count;
  const remaining = Math.max(0, limit - currentCount);

  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": String(remaining),
  };

  // Only writes are counted
  if (operation === "write") {
    if (currentCount >= limit) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      return new Response(
        JSON.stringify({
          error: "Rate limit exceeded. Daily write limit reached.",
          code: "RATE_LIMIT_EXCEEDED",
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(retryAfter),
            "X-RateLimit-Limit": String(limit),
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }

    // Increment only after the guard passes
    entry.count += 1;
    headers["X-RateLimit-Remaining"] = String(limit - entry.count);
  }

  return { headers };
}
