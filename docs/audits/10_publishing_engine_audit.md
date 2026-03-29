# Publishing Engine Audit

**Date:** 2026-03-29
**Auditor:** Claude (Sonnet 4.6)
**Scope:** PostSyncer publishing engine — cron job, publish engine, and social platform publishers
**Files Reviewed:**
- `src/lib/scheduler/publish-engine.ts`
- `src/app/api/cron/publish/route.ts`
- `src/lib/social/generic-publisher.ts`
- `src/lib/social/twitter.ts`
- `src/lib/social/instagram.ts`
- `src/lib/social/linkedin.ts`
- `src/lib/social/facebook.ts`
- `src/app/api/posts/[id]/publish/route.ts`
- `src/app/api/posts/[id]/retry/route.ts`
- `src/app/api/accounts/[id]/route.ts`
- `prisma/schema.prisma`
- `vercel.json`

---

## Executive Summary

The publishing engine has a solid structural foundation: per-account retry tracking, publish logs, auth-expiry detection, and partial-failure reconciliation are all present. However, there are **seven critical-severity issues** and several medium/low issues that could cause duplicate posts, silent data loss, post stalls, or user confusion at production scale.

---

## Findings

### 1. Race Condition — No Distributed Lock on Cron Execution

**Severity: Critical**

`vercel.json` schedules the cron at `* * * * *` (every minute). The cron route has no mechanism to prevent two simultaneous invocations from processing the same posts.

In `publishDuePosts` (`publish-engine.ts:32-63`), the query fetches all `SCHEDULED` posts whose `scheduledAt <= now`. Nothing claims ownership of those rows before processing begins. If two cron invocations overlap — which can happen under Vercel's at-least-once delivery guarantee — both will independently fetch the same post set, publish to every platform twice, and increment `retryCount` independently.

**Concrete risk:** A post scheduled for 10:00 AM could be published twice to Twitter, Instagram, LinkedIn, and Facebook. The second run may also overwrite a `PUBLISHED` status back to `SCHEDULED` on a `PostAccount` that the first run already completed.

**Fix:** Use an optimistic lock or a `PUBLISHING` status transition as a claim step. Before processing a post, atomically update its status from `SCHEDULED` to `PUBLISHING` and only process it if the update affected a row (`count > 0`). Alternatively, use a distributed mutex (e.g., a PostgreSQL advisory lock keyed on the post ID) or an idempotency table (a `cron_run_id` per invocation with a unique constraint on `(post_id, cron_run_id)`).

Note: The manual publish route (`/api/posts/[id]/publish`) does set status to `PUBLISHING` before proceeding, which is the correct pattern. The cron-driven path must do the same.

---

### 2. No Exponential Backoff on Retries

**Severity: Critical**

`publishPostToAllAccounts` (`publish-engine.ts:96-116`) increments `retryCount` and sets `status` back to `SCHEDULED` on failure. The next cron tick (one minute later) will immediately re-attempt the same `PostAccount` because the query (`publish-engine.ts:40-46`) matches any `PostAccount` with `status IN ("SCHEDULED", "FAILED")`.

There is no cooldown between attempts. A transient platform outage will trigger three rapid-fire retries in three minutes, exhausting the retry budget before the platform recovers.

**The `retryAfter` field in `PublishResult` is completely ignored.** Twitter's publisher correctly returns `retryAfter` on HTTP 429, but the engine discards it and re-queues the `PostAccount` with `status: "SCHEDULED"` unconditionally.

**Fix:**
- Add a `nextRetryAt: DateTime?` column to `PostAccount`.
- On failure, set `nextRetryAt` using exponential backoff: `now + (5min * 2^retryCount)` (e.g., 5min, 10min, 20min).
- When `retryAfter` is present in the platform result, use `max(backoff, retryAfter)`.
- Filter the cron query to `nextRetryAt IS NULL OR nextRetryAt <= now`.

---

### 3. Dead Letter Handling is Incomplete

**Severity: High**

After three failures, `PostAccount.status` is set to `FAILED` and `Post.status` reconciles to `FAILED`. The `PublishLog` table captures the failure reason. However:

- There is no notification to the workspace owner or post author that publishing permanently failed.
- There is no structured "dead letter" flag or queue that a monitoring system can poll.
- The user must manually navigate to the post to discover the failure.
- `failureReason` on `PostAccount` is overwritten on each attempt, so only the final failure reason is retained (earlier errors are only in `PublishLog`).

**Fix:**
- Trigger an in-app notification (or email) when `isFinalFailure` is true.
- Consider a `PublishAlert` model or a webhook to an external alerting channel.
- Preserve `firstFailureReason` separately, or rely on `PublishLog` as the canonical failure history (currently logs are per-post, not per-account — see Finding 9).

---

### 4. Partial Failure Handling Conflates Partial and Full Failure

**Severity: High**

`reconcilePostStatus` (`publish-engine.ts:254-262`) sets the overall `Post.status` to `FAILED` when any account fails, even when others succeeded. This is documented as intentional ("surface to the user"), but the implementation has two problems:

**Problem A — Already-published accounts are retried.** The cron query (`publish-engine.ts:40-46`) includes `PostAccount` records with `status: "SCHEDULED"`. After a partial failure, re-queueing the post sets overall status back to `SCHEDULED`, but the `PUBLISHED` `PostAccount` rows remain. If the post is retried, the engine will not re-attempt the published accounts (they are excluded from the inner query at line 41), so the data is actually correct. However, the post-level status oscillation (`FAILED → SCHEDULED → FAILED/PUBLISHED`) is confusing for the UI and for any monitoring that inspects `Post.status`.

**Problem B — The `PUBLISHING` status from the manual publish route is never reset on failure.** If the manual publish route (`/api/posts/[id]/publish`) encounters an unexpected exception after setting `status: "PUBLISHING"` but before the final `db.post.update`, the post is permanently stuck in `PUBLISHING`. The cron query does not include `PUBLISHING` posts, so they are silently abandoned.

**Fix for A:** Introduce a `PARTIAL` post status to distinguish "some platforms succeeded, some failed" from "all failed." Update the UI accordingly.

**Fix for B:** Wrap the entire manual publish flow in a `try/finally` block that resets `PUBLISHING` to `FAILED` on any unhandled error.

---

### 5. OAuth Token Refresh Not Implemented

**Severity: Critical**

`generic-publisher.ts` defines an optional `refreshToken?(accountId: string): Promise<string>` method on the `SocialPublisher` interface. None of the four platform publishers implement it.

`publish-engine.ts` never calls `refreshToken`. When a token expires, the engine sets `SocialAccount.status = "EXPIRED"` and the current publish attempt fails. No automatic refresh is attempted.

This means:
- Every token expiry immediately burns a retry attempt.
- After three failed attempts all due to token expiry, the post enters dead letter state.
- The user's token is expired silently until they observe a failed post.
- Long-lived tokens (e.g., Facebook long-lived page tokens, valid 60 days) will expire without warning.

**Fix:**
- Implement `refreshToken` in each publisher that supports OAuth refresh flows (LinkedIn, Facebook, Instagram via Meta Graph API).
- In `publishToAccount`, before calling `publisher.publish()`, check `socialAccount.tokenExpiresAt`. If it is within a threshold (e.g., 10 minutes), proactively refresh and update `SocialAccount.accessToken` and `tokenExpiresAt`.
- On `authExpired: true` in the publish result, attempt a refresh before incrementing `retryCount`. Only burn a retry if the refresh itself fails.

---

### 6. Cron Job Timeout Risk

**Severity: High**

The cron route sets `export const maxDuration = 60` (60 seconds). Vercel Hobby plans cap function duration at 10 seconds; Pro/Enterprise plans allow up to 300 seconds for cron functions. At 60 seconds, this is reasonable for Pro but silently fails on Hobby.

More critically, the engine processes posts **sequentially** with `for...of` loops across both posts and their accounts (`publish-engine.ts:54-62`, `publishPostToAllAccounts:77-144`). Each `PostAccount` involves:
- One or more platform API calls (network round-trips)
- Instagram video posts: up to 20 polling iterations × 3 seconds each = **60 seconds per video post**
- Multiple DB writes per account

A single Instagram video post can consume the entire cron budget. Any subsequent posts in the same batch will not be reached. They remain `SCHEDULED` and will be picked up by the next tick, but this creates indefinite latency for high-volume workspaces.

**Fix:**
- Process posts concurrently with bounded parallelism (e.g., `Promise.allSettled` with a concurrency limiter of 3-5 posts at a time).
- Move Instagram video polling to a dedicated async job or use a webhook-based approach instead of synchronous polling inside the cron.
- Add a hard wall-clock budget check: if elapsed time exceeds 45 seconds, stop processing and leave remaining posts for the next cron tick (they will be re-fetched).

---

### 7. Platform Rate Limit Handling is Incomplete

**Severity: High**

**Twitter:** `retryAfter` is correctly populated (`twitter.ts:69-73`) but, as noted in Finding 2, the engine ignores it. The `PostAccount` is immediately re-queued as `SCHEDULED`, meaning it will be retried in the next minute regardless of the platform's backoff window.

**LinkedIn:** Rate limits throw a generic `Error("LinkedIn rate limit reached")` (`linkedin.ts:214-216`). The `retryAfter` field is never populated. The engine cannot distinguish a rate-limit error from any other error, so it applies no special handling.

**Facebook:** Same as LinkedIn — rate limit throws a generic error with no `retryAfter`.

**Instagram:** No rate-limit handling at all; HTTP 429 responses from the Graph API will hit the generic `!res.ok` branch and throw a plain error.

**Shared problem:** All four publishers lack **per-workspace rate limit state**. If a workspace has 100 scheduled posts firing simultaneously, each platform's rate limiter will be hit repeatedly. There is no token-bucket or leaky-bucket logic that paces publishing per workspace/per platform.

**Fix:**
- Make all publishers return `retryAfter` on rate-limit responses.
- Store a `rateLimitedUntil: DateTime?` field on `SocialAccount` and skip publishing attempts until that time has passed.
- Consider a per-workspace, per-platform publish queue with configurable throughput limits.

---

### 8. Thread Publishing is Not Atomic (Twitter)

**Severity: Medium**

`TwitterPublisher.publishThread` (`twitter.ts:100-159`) posts each tweet in the thread sequentially. If the network fails mid-thread (e.g., after tweet 2 of 5), the first two tweets are already live on Twitter. The engine catches the error and returns `success: false`, which causes the engine to schedule a retry. On the next attempt, the entire thread — including the already-published parts — will be re-sent, creating duplicate tweets.

**Fix:** Track the `lastTweetId` and the completed index. On partial thread failure, record `platformPostId` of the first published tweet in the `PostAccount` so a human can clean up duplicates. Alternatively, implement thread resumption by passing a `replyToTweetId` start point on retry. This is complex; the simpler mitigation is to mark threads as non-retryable after partial publication and alert the user.

---

### 9. Publishing Atomicity — Database State Consistency

**Severity: Medium**

Between `publishToAccount` returning `success: true` and the subsequent `db.postAccount.update` call (`publish-engine.ts:87-95`), the post has been published to the platform but the database still shows `SCHEDULED`. If the process crashes (OOM kill, Vercel cold restart) in this window:
- The platform post is live
- The DB record shows `SCHEDULED`
- The next cron run will attempt to publish again, creating a duplicate

This is a classic two-phase commit problem. Without a distributed transaction spanning the platform API and the database, perfect atomicity is impossible. However, the risk can be reduced.

**Fix:**
- Before calling the platform API, set `PostAccount.status = "PUBLISHING"` so the cron skips it on re-entry.
- After a successful platform response, transition `PUBLISHING → PUBLISHED`.
- If the process crashes with `PostAccount.status = "PUBLISHING"`, a recovery job can inspect the platform API to check whether the post actually went live (using `platformPostId` if it was returned).
- Add a `publishingStartedAt` timestamp to detect stale `PUBLISHING` records older than, say, 5 minutes, and treat them as needing investigation.

---

### 10. Monitoring and Alerting on Publishing Failures

**Severity: High**

The current observability is limited to:
- `console.log` / `console.error` in the cron route
- `PublishLog` table entries

There is no:
- Structured error metrics or counters
- Alerting when failure rate exceeds a threshold
- Alerting when a post enters dead-letter state (see Finding 3)
- Health endpoint or dashboard for the cron job
- Detection of cron job not running (e.g., if Vercel cron silently fails to invoke the route)

**The `PublishLog` model lacks a `socialAccountId` column.** Logs are linked to `postId` and `platform` only, making it impossible to query failure history for a specific connected account without joining through `PostAccount`.

**Fix:**
- Emit structured metrics (e.g., to Datadog, Grafana, or a custom `CronHealthLog` table) on each cron run: total processed, succeeded, failed, duration.
- Add `socialAccountId` to `PublishLog`.
- On final failure (dead letter), create an `ActivityLog` entry and trigger an in-app notification.
- Implement a "cron watchdog": a secondary cron or external uptime monitor that alerts if no successful cron run has been recorded within the last 2 minutes.

---

### 11. Queue Overflow Protection

**Severity: Medium**

There is no cap on how many posts `publishDuePosts` will process in a single invocation. A workspace that schedules 500 posts for the same minute will cause the cron to fetch and attempt all 500, with each post potentially spanning multiple platform API calls. Combined with the sequential processing model (Finding 6), this guarantees timeout and partial processing.

**Fix:**
- Add a `LIMIT` clause to the `db.post.findMany` query (e.g., 20 posts per cron run).
- Implement priority ordering (e.g., by `scheduledAt ASC` so the most overdue posts are processed first).
- Surface a metric when the queue is backlogged (posts that are more than N minutes past their `scheduledAt`).

---

### 12. Timezone Handling for Scheduled Posts

**Severity: Medium**

`Workspace.timezone` exists in the schema (`schema.prisma:87`) and `WorkspaceSettings.defaultTimezone` also exists (`schema.prisma:135`). However, `publishDuePosts` compares `scheduledAt` directly against `new Date()` (UTC) without any timezone conversion.

This is actually correct **if** `scheduledAt` is stored as absolute UTC in the database — i.e., the client converts the user's local time to UTC before saving. However, this assumption is not enforced anywhere in the engine. If a client-side bug saves `scheduledAt` as a naive local time without converting to UTC, posts will be published at the wrong time with no error.

**Fix:**
- Document and enforce the invariant that `scheduledAt` must always be stored as UTC.
- In the post-creation API route, validate that `scheduledAt` is a valid ISO 8601 UTC timestamp.
- Add a note in `publishDuePosts` clarifying the timezone assumption.
- The workspace `timezone` field appears to be unused by the publishing engine; clarify its intended purpose (display only vs. scheduling).

---

### 13. Disconnected Account Handling

**Severity: High**

When a social account is deleted via `DELETE /api/accounts/[id]`, the route (`accounts/[id]/route.ts:63`) issues:
```
await db.socialAccount.delete({ where: { id } });
```

`PostAccount` has `onDelete: Cascade` on its `SocialAccount` relation (`schema.prisma:244`). This means all `PostAccount` rows for the deleted account are silently deleted. Consequently:

- **Scheduled posts lose their target accounts silently.** If a post was scheduled to Twitter and Instagram, and the user disconnects their Twitter account, the `PostAccount` row for Twitter is cascade-deleted. The next cron run will fetch the post (if `Post.status` is still `SCHEDULED`) but find zero `PostAccount` records with `status IN ("SCHEDULED", "FAILED")`. The post will never be published to Twitter, and no error is surfaced.
- **The `warningScheduledPosts` count in the response** (`accounts/[id]/route.ts:65-68`) does warn the user, but it counts posts at the `Post` level, not the `PostAccount` level. The actual disconnect takes effect before the user can act on the warning (no confirmation gate is enforced).
- **`reconcilePostStatus`** (`publish-engine.ts:241-274`) considers only the remaining `PostAccount` rows. If all remaining accounts publish successfully, the post is marked `PUBLISHED` even though some platforms were silently skipped due to the cascade delete.

**Fix:**
- Replace cascade delete of `PostAccount` on account disconnect with a soft-delete or a status transition to `CANCELLED`.
- Add a confirmation step before disconnecting: require the user to explicitly acknowledge or reschedule affected scheduled posts.
- Alternatively, run a transaction that first cancels all `SCHEDULED` `PostAccount` rows and updates the parent `Post.status` to `FAILED` (with a reason of "account disconnected"), then deletes the `SocialAccount`.

---

## Summary Table

| # | Issue | Severity | Files Affected |
|---|-------|----------|---------------|
| 1 | No distributed lock — cron can run twice simultaneously causing duplicate publishes | **Critical** | `publish-engine.ts`, `route.ts` (cron) |
| 2 | No exponential backoff; `retryAfter` from platform is ignored | **Critical** | `publish-engine.ts`, `twitter.ts` |
| 3 | Dead letter state has no user notification or alerting | **High** | `publish-engine.ts` |
| 4 | Partial failure conflation; `PUBLISHING` status can get stuck | **High** | `publish-engine.ts`, `route.ts` (publish) |
| 5 | OAuth token refresh not implemented anywhere | **Critical** | All publisher files, `publish-engine.ts` |
| 6 | Sequential processing and Instagram video polling can exhaust the 60s cron budget | **High** | `publish-engine.ts`, `instagram.ts` |
| 7 | Platform rate limits not fully propagated; no per-workspace rate pacing | **High** | All publisher files, `publish-engine.ts` |
| 8 | Twitter thread publishing is not atomic — partial threads create duplicates on retry | **Medium** | `twitter.ts` |
| 9 | DB state written after platform API call — crash window creates duplicate publishes | **Medium** | `publish-engine.ts` |
| 10 | Insufficient monitoring; `PublishLog` missing `socialAccountId` | **High** | `publish-engine.ts`, `schema.prisma` |
| 11 | No queue size cap — large batches will timeout silently | **Medium** | `publish-engine.ts` |
| 12 | Timezone invariant unenforced; workspace timezone field unused by engine | **Medium** | `publish-engine.ts`, `schema.prisma` |
| 13 | Account disconnect silently cascade-deletes scheduled `PostAccount` rows | **High** | `accounts/[id]/route.ts`, `schema.prisma` |

---

## Recommended Priority Order

1. **Finding 1 (race condition)** — fix first; this is the most likely cause of production duplicate posts
2. **Finding 5 (token refresh)** — implement proactive token refresh to prevent unnecessary publish failures
3. **Finding 13 (account disconnect)** — replace cascade delete with soft-cancel to prevent silent post loss
4. **Finding 2 (backoff + retryAfter)** — protect against rapid retry burn and platform bans
5. **Finding 6 (timeout / sequential processing)** — add queue cap and batch concurrency
6. **Finding 4 (PUBLISHING stuck state)** — add try/finally guard in manual publish route
7. **Finding 7 (rate limits)** — store `rateLimitedUntil` on `SocialAccount`
8. **Finding 10 (monitoring)** — add structured metrics and dead-letter notifications
9. **Finding 3 (dead letter notification)** — user-facing alerting for permanent failures
10. **Findings 8, 9, 11, 12** — medium severity; address in subsequent iterations
