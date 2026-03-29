# Database Performance Audit — PostSyncer

**Date:** 2026-03-29
**Scope:** `prisma/schema.prisma` + all files under `src/app/api/`
**Auditor:** Claude Code (automated)

---

## Executive Summary

The codebase shows generally solid query practices—pagination is present on most list endpoints, `select` clauses are used in many places, and transactions are correctly used for multi-step writes. However, **14 concrete issues** were identified across six categories:

| Severity | Count |
|----------|-------|
| High     | 5     |
| Medium   | 7     |
| Low      | 2     |

The highest-impact changes are: adding missing indexes to the schema (affects every read path), collapsing the serial `postAccount.update` loop in the publish engine into a single bulk query, and removing duplicate post fetches that follow immediately after transactions.

---

## 1. Missing Database Indexes

**File:** `prisma/schema.prisma`

None of the high-frequency filter columns have explicit indexes. Prisma only creates indexes for `@id`, `@unique`, and `@@unique` fields. Every other lookup does a sequential scan.

### 1a. `Post` — no index on `(workspaceId, status)` or `(workspaceId, scheduledAt)` [HIGH]

Every list endpoint (`GET /api/posts`, calendar, queue, pending, cron) filters posts by `workspaceId` and optionally `status` or `scheduledAt`. Without a compound index, each query scans the full `posts` table.

The cron job query at `src/lib/scheduler/publish-engine.ts:33–48` is the most critical — it runs every minute and filters on `status = 'SCHEDULED'` and `scheduledAt <= now`.

**Recommended addition to `Post` model:**
```prisma
@@index([workspaceId, status])
@@index([workspaceId, scheduledAt])
@@index([workspaceId, approvalStatus])   // pending approval queue
@@index([workspaceId, publishedAt])      // analytics top-posts query
@@index([authorId])                      // pending queue author lookup
```

### 1b. `AnalyticsSnapshot` — no index on `(workspaceId, date)` [HIGH]

`src/app/api/analytics/route.ts:89–93` and `src/app/api/v1/analytics/route.ts:111–115` both query snapshots by `workspaceId` + date range. The only existing constraint is `@@unique([socialAccountId, date])`, which doesn't help workspaceId-scoped range queries.

**Recommended addition to `AnalyticsSnapshot` model:**
```prisma
@@index([workspaceId, date])
@@index([workspaceId, platform, date])   // platform-filtered analytics
```

### 1c. `Comment` — no index on `socialAccountId` or `(socialAccountId, status)` [HIGH]

`src/app/api/inbox/route.ts:77–88` and `src/app/api/v1/comments/route.ts:59–69` both query `WHERE socialAccountId IN (...)` with optional `status` and `publishedAt` filters. The only unique constraint is `@@unique([platform, platformId])`.

**Recommended addition to `Comment` model:**
```prisma
@@index([socialAccountId, status])
@@index([socialAccountId, publishedAt])
@@index([workspaceId, status])           // direct workspace-scoped inbox queries
```

### 1d. `ActivityLog` — no index on `(workspaceId, createdAt)` [MEDIUM]

`ActivityLog` is written frequently (every post create/update/delete/publish) and will grow large. Any future audit-log query filtering by workspace will do full scans.

**Recommended addition to `ActivityLog` model:**
```prisma
@@index([workspaceId, createdAt])
@@index([entityType, entityId])          // "find all logs for post X"
```

### 1e. `WorkspaceMember` — no index on `(workspaceId, userId, status)` [HIGH]

The `verifyWorkspaceMembership` helper (`src/app/api/posts/[id]/route.ts:36–39`) and equivalent inline checks appear in nearly every route handler. The existing `@@unique([workspaceId, userId])` covers the compound lookup for confirmed members but not the status filter added to every query (`status: "ACTIVE"`).

**Recommended addition to `WorkspaceMember` model:**
```prisma
@@index([workspaceId, userId, status])
@@index([userId, status])                // GET /api/workspace lists all user memberships
@@index([inviteToken])                   // already @unique, no extra index needed
```

### 1f. `MediaFile` — no index on `(workspaceId, createdAt)` or `(workspaceId, folderId)` [MEDIUM]

`src/app/api/media/route.ts:65–71` queries by `workspaceId`, `folderId`, `mimeType`, and sorts by `createdAt` / `name` / `size`. Without indexes these operations scan all workspace files.

**Recommended addition to `MediaFile` model:**
```prisma
@@index([workspaceId, folderId])
@@index([workspaceId, createdAt])
@@index([workspaceId, mimeType])
```

### 1g. `PostAccount` — no index on `(postId, status)` [MEDIUM]

`reconcilePostStatus` in `src/lib/scheduler/publish-engine.ts:242–244` and the retry route query `WHERE postId = X AND status = 'FAILED'` both need this.

**Recommended addition to `PostAccount` model:**
```prisma
@@index([postId, status])
@@index([socialAccountId, status])
```

### 1h. `PublishLog` — no index on `(postId, attemptAt)` [LOW]

Multiple routes include `publishLogs: { orderBy: { attemptAt: 'desc' }, take: 10 }`. Without an index on `postId`, each of these fetches scans the entire publish_logs table filtered by post.

**Recommended addition to `PublishLog` model:**
```prisma
@@index([postId, attemptAt])
```

---

## 2. N+1 Query Problems

### 2a. Publish engine — serial per-account DB writes inside a loop [HIGH]

**File:** `src/lib/scheduler/publish-engine.ts:77–145`

```ts
// Lines 77–145: for each postAccount:
for (const postAccount of post.accounts) {
  // ... publish ...
  await db.postAccount.update({ ... });   // 1 query per account
  await db.publishLog.create({ ... });    // 1 query per account
}
```

For a post targeting 5 social accounts this is 10 sequential `UPDATE`/`INSERT` queries per post. Under load (many due posts) this becomes O(posts × accounts) sequential round-trips.

**Recommendation:** Collect results from the publish loop, then use `db.$transaction([...updates])` (or `updateMany` where feasible) to flush all `postAccount` updates in a single round-trip, followed by `createMany` for `publishLogs`.

### 2b. `POST /api/posts/[id]/publish` — same serial loop pattern [HIGH]

**File:** `src/app/api/posts/[id]/publish/route.ts:89–152`

Identical N+1 pattern: one `db.postAccount.update` and one `db.publishLog.create` per account inside a `for` loop.

### 2c. `GET /api/posts/pending` — author data fetched in a second query [MEDIUM]

**File:** `src/app/api/posts/pending/route.ts:61–73`

```ts
// Line 61–73: after fetching posts, a second query loads author User rows
const authorIds = posts.map((p) => p.authorId).filter(...)
const authors = await db.user.findMany({ where: { id: { in: authorIds } } })
```

This is avoidable by adding `include: { author: { select: { id, name, email, image } } }` directly on the post query, which would let Prisma join the data in one query. The current approach issues two queries and does the join in JavaScript.

**Recommendation:**
```ts
// In the db.post.findMany call, add:
include: {
  // ... existing includes ...
  author: { select: { id: true, name: true, email: true, image: true } },
}
```

Note: `Post.authorId` is already a relation field that references `User`. Prisma can resolve it in a single query using a join.

---

## 3. Inefficient Queries That Should Use Aggregations

### 3a. `GET /api/admin/stats` — two separate subscription queries for MRR [MEDIUM]

**File:** `src/app/api/admin/stats/route.ts:74–87`

The route first calls `db.subscription.groupBy({ by: ['plan'], _count: { plan: true } })` (line 40–43) to get plan counts, then makes a **second** query `db.subscription.findMany({ where: { status: 'ACTIVE' }, select: { plan: true } })` (line 74–77) to calculate MRR. The plan distribution data fetched in the first query is sufficient to calculate MRR — no second query is needed.

**Recommendation:** Compute MRR from the already-fetched `planBreakdown` groupBy result:
```ts
const mrr = planBreakdown.reduce(
  (sum, row) => sum + (PLAN_MRR[row.plan] ?? 0) * row._count.plan,
  0
);
```
This eliminates the second subscription query entirely.

### 3b. `GET /api/media` — storage aggregation runs on every page request [MEDIUM]

**File:** `src/app/api/media/route.ts:65–77`

```ts
const [files, total, storageAgg] = await Promise.all([
  db.mediaFile.findMany({ ... }),
  db.mediaFile.count({ where }),
  db.mediaFile.aggregate({ where: { workspaceId }, _sum: { size: true } }),
]);
```

The `storageAgg` query sums all file sizes for the workspace on every pagination request. With many files this is an expensive full-scan aggregate. Consider caching the storage total (e.g. in `WorkspaceSettings.storageUsed`, kept in sync on upload/delete), or returning it only on the first page.

### 3c. `GET /api/analytics` — per-day platform series calculated in JavaScript [LOW]

**File:** `src/app/api/analytics/route.ts:248–265`

The per-platform daily series is computed by looping through `days`, then filtering `snapshotsByDay` by `platform` on every iteration. This is O(days × accounts × snapshotsPerDay) in JavaScript. For 30 days with 5 accounts this is manageable, but it could instead be computed in a single grouped database query.

**Recommendation:** Use `db.analyticsSnapshot.groupBy({ by: ['platform', 'date'], _sum: { impressions: true, ... } })` to get the aggregated series directly from PostgreSQL.

---

## 4. Missing `select` Clauses — Fetching Too Many Fields

### 4a. `fetchPost` helper — fetches entire `socialAccount` rows [MEDIUM]

**File:** `src/app/api/posts/[id]/route.ts:12–33`

```ts
accounts: {
  include: { socialAccount: true },  // fetches ALL columns including accessToken, refreshToken
}
```

`SocialAccount` has `accessToken` and `refreshToken` stored as `@db.Text`. These large fields are fetched on every single post GET/PUT/DELETE and returned to the client. They should be excluded from API responses entirely.

**Recommendation:** Replace `include: { socialAccount: true }` with:
```ts
include: {
  socialAccount: {
    select: {
      id: true, platform: true, username: true,
      displayName: true, avatarUrl: true, status: true,
    },
  },
}
```

This pattern is used correctly in `src/app/api/v1/posts/route.ts:65–71` but not in the main posts routes, calendar, queue, pending, approve, publish, or retry routes.

### 4b. `GET /api/accounts` — fetches full `socialAccount` rows including tokens [MEDIUM]

**File:** `src/app/api/accounts/route.ts:34–40`

```ts
const accounts = await db.socialAccount.findMany({
  where: { workspaceId },
  include: { _count: { select: { posts: true } } },
  // No `select` — fetches accessToken, refreshToken for ALL accounts
});
```

Tokens are fetched and returned to the client in the account listing response. Add a `select` clause that omits `accessToken`, `refreshToken`, and `tokenExpiresAt`.

### 4c. `GET /api/campaigns/[id]` — full post graph fetched on every campaign GET [MEDIUM]

**File:** `src/app/api/campaigns/[id]/route.ts:33–51`

The `getCampaign` helper fetches `posts → post → accounts → socialAccount` (full row, including tokens) and `posts → post → media → mediaFile` on every GET, PATCH, and DELETE request. PATCH and DELETE only need `campaign.workspaceId` to verify membership; they load the entire post graph unnecessarily.

**Recommendation:** Create a lightweight `getCampaignForAuth` helper that only fetches `{ id, workspaceId }`, used for PATCH/DELETE. Keep the full include only for GET.

---

## 5. Missing Pagination

### 5a. `GET /api/posts/calendar` — no pagination, unbounded date range [HIGH]

**File:** `src/app/api/posts/calendar/route.ts:47–73`

```ts
const posts = await db.post.findMany({
  where: {
    workspaceId,
    scheduledAt: { gte: startDate, lte: endDate },
  },
  // No `take` or pagination
});
```

The caller controls `start` and `end` — there is no server-side cap on the date range or the number of posts returned. A user requesting an entire year could return thousands of posts in a single response.

**Recommendation:** Add a maximum date range cap (e.g. 90 days) and/or add `take` with a reasonable limit and document the constraint.

### 5b. `GET /api/posts/queue` — no pagination [MEDIUM]

**File:** `src/app/api/posts/queue/route.ts:31–47`

The queue endpoint returns **all** SCHEDULED posts with a `queuePosition` set. For a workspace with hundreds of queued posts this is a large unbounded response.

**Recommendation:** Add pagination (`page`, `pageSize`) consistent with the other post list endpoints.

### 5c. `GET /api/workspace/members` — no pagination [LOW]

**File:** `src/app/api/workspace/members/route.ts:64–93`

Returns all workspace members in a single query. For workspaces at the PRO_PLUS tier (up to 50 members) this is acceptable, but the endpoint also loads the associated `user` for each member. Add pagination to remain consistent as limits increase.

### 5d. `GET /api/campaigns` — no pagination [MEDIUM]

**File:** `src/app/api/campaigns/route.ts:56–77`

Returns all campaigns with a nested `posts` preview (5 per campaign) and `_count`. A workspace could accumulate many campaigns over time with no bounds on this response.

**Recommendation:** Add `take`/`skip` pagination consistent with other list endpoints.

---

## 6. Queries That Should Use Transactions

### 6a. `POST /api/posts/[id]/approve` — activity log and post update are separate queries [MEDIUM]

**File:** `src/app/api/posts/[id]/approve/route.ts:71–99`

```ts
const updated = await db.post.update({ ... });    // line 71
await db.activityLog.create({ ... });              // line 89 — separate, not in a transaction
```

If the process crashes or throws between these two statements, the post is approved but the activity log is missing. Wrap both in `db.$transaction(...)`.

### 6b. `POST /api/posts/[id]/publish` — status updates and activity log outside a transaction [MEDIUM]

**File:** `src/app/api/posts/[id]/publish/route.ts:99–183`

Multiple `db.postAccount.update`, `db.publishLog.create`, `db.post.update`, `db.socialAccount.update`, and `db.activityLog.create` calls occur as sequential top-level awaits with no wrapping transaction. A partial failure leaves the database in an inconsistent state (e.g. some `postAccount` records updated as PUBLISHED, but the parent `post.status` still `PUBLISHING`).

**Recommendation:** After all external publish API calls complete (which must remain outside the transaction), wrap the DB bookkeeping writes—all `postAccount.update`, `publishLog.create`, final `post.update`, and `activityLog.create`—in a single `db.$transaction`.

### 6c. `POST /api/posts/[id]/retry` — three separate writes [LOW]

**File:** `src/app/api/posts/[id]/retry/route.ts:85–124`

```ts
await db.postAccount.updateMany({ ... });   // line 85
await db.post.update({ ... });               // line 103
await db.activityLog.create({ ... });        // line 111
```

All three should be atomic. A crash after the first write leaves `postAccount` records in SCHEDULED state but the parent post still in FAILED state.

---

## 7. Missing Compound Indexes for Common Query Patterns

### 7a. `AnalyticsSnapshot` — missing compound index for the cron analytics sync pattern

**File:** `prisma/schema.prisma:377–397`

The `@@unique([socialAccountId, date])` constraint exists, but the primary query pattern in both analytics routes filters by `workspaceId` + optional `platform` + date range. The existing unique constraint does not accelerate these queries.

**Recommended:**
```prisma
@@index([workspaceId, platform, date])
```

### 7b. `Post` — missing index for the cron job's hot query path

**File:** `prisma/schema.prisma:197–231` and `src/lib/scheduler/publish-engine.ts:33–48`

The cron query is:
```sql
WHERE status = 'SCHEDULED'
  AND scheduledAt <= now
  AND approvalStatus IN ('NOT_REQUIRED', 'APPROVED')
```

A compound index on `(status, scheduledAt)` or `(status, approvalStatus, scheduledAt)` is the optimal covering index for this query pattern.

**Recommended:**
```prisma
@@index([status, scheduledAt])
@@index([status, approvalStatus, scheduledAt])
```

---

## 8. Opportunities for Database-Level Computed Fields

### 8a. Campaign `status` — computed in JavaScript on every request

**File:** `src/app/api/campaigns/route.ts:79–89`, `src/app/api/campaigns/[id]/route.ts:78–82`

The `computeCampaignStatus` function is duplicated in both files and runs in JavaScript on every request. The `Campaign.status` column exists in the schema but is never written (default `"active"`, never updated). The dynamic status could either:

1. Be stored as a real DB column, updated by a cron job or on writes (simpler, cheaper reads).
2. Be computed as a PostgreSQL generated column (not directly supported by Prisma, but possible via a raw migration).

At minimum, the duplicate helper should be deduplicated into a shared utility.

### 8b. `publishedCount` and `scheduledCount` on Campaign — computed via JS filter

**File:** `src/app/api/campaigns/[id]/route.ts:79–81`

```ts
const publishedCount = posts.filter((p) => p.status === "PUBLISHED").length;
const scheduledCount = posts.filter((p) => p.status === "SCHEDULED").length;
```

This requires loading all `CampaignPost → Post` rows into memory. Consider using `db.campaignPost.count({ where: { campaignId, post: { status: "PUBLISHED" } } })` or using Prisma's `_count` with a filter, or groupBy at the database level.

---

## Consolidated Schema Changes

Below is the complete set of `@@index` additions recommended for `prisma/schema.prisma`. These can be applied in a single migration.

```prisma
model User {
  // ... existing fields ...
  @@map("users")
}

model WorkspaceMember {
  // ... existing fields ...
  @@unique([workspaceId, userId])
  @@index([workspaceId, userId, status])   // ADD — membership verification on every request
  @@index([userId, status])                // ADD — workspace list for a user
  @@map("workspace_members")
}

model Post {
  // ... existing fields ...
  @@index([workspaceId, status])           // ADD — list + filter endpoints
  @@index([workspaceId, scheduledAt])      // ADD — calendar endpoint
  @@index([workspaceId, approvalStatus])   // ADD — pending approval queue
  @@index([workspaceId, publishedAt])      // ADD — analytics top-posts
  @@index([status, scheduledAt])           // ADD — cron job hot path
  @@index([status, approvalStatus, scheduledAt]) // ADD — cron job filtered path
  @@index([authorId])                      // ADD — author lookups
  @@map("posts")
}

model PostAccount {
  // ... existing fields ...
  @@unique([postId, socialAccountId])
  @@index([postId, status])                // ADD — reconcile + retry queries
  @@index([socialAccountId, status])       // ADD — per-account status queries
  @@map("post_accounts")
}

model PublishLog {
  // ... existing fields ...
  @@index([postId, attemptAt])             // ADD — publish log includes on post fetches
  @@map("publish_logs")
}

model MediaFile {
  // ... existing fields ...
  @@index([workspaceId, folderId])         // ADD — folder browsing
  @@index([workspaceId, createdAt])        // ADD — default sort
  @@index([workspaceId, mimeType])         // ADD — type filter
  @@map("media_files")
}

model AnalyticsSnapshot {
  // ... existing fields ...
  @@unique([socialAccountId, date])
  @@index([workspaceId, date])             // ADD — date-range analytics queries
  @@index([workspaceId, platform, date])   // ADD — platform-filtered analytics
  @@map("analytics_snapshots")
}

model Comment {
  // ... existing fields ...
  @@unique([platform, platformId])
  @@index([socialAccountId, status])       // ADD — inbox queries
  @@index([socialAccountId, publishedAt])  // ADD — date-sorted inbox
  @@index([workspaceId, status])           // ADD — workspace-scoped inbox
  @@map("comments")
}

model ActivityLog {
  // ... existing fields ...
  @@index([workspaceId, createdAt])        // ADD — audit log queries
  @@index([entityType, entityId])          // ADD — entity-specific logs
  @@map("activity_logs")
}
```

---

## Issue Reference Table

| # | Severity | Category | File | Line(s) | Issue |
|---|----------|----------|------|---------|-------|
| 1 | HIGH | Missing Index | `prisma/schema.prisma` | Post model | No index on `(workspaceId, status)`, `(workspaceId, scheduledAt)` |
| 2 | HIGH | Missing Index | `prisma/schema.prisma` | AnalyticsSnapshot | No index on `(workspaceId, date)` |
| 3 | HIGH | Missing Index | `prisma/schema.prisma` | Comment | No index on `(socialAccountId, status)` |
| 4 | HIGH | Missing Index | `prisma/schema.prisma` | WorkspaceMember | No index on `(workspaceId, userId, status)` |
| 5 | HIGH | Missing Pagination | `src/app/api/posts/calendar/route.ts` | 47–73 | No row cap on date range query |
| 6 | HIGH | N+1 | `src/lib/scheduler/publish-engine.ts` | 77–145 | Serial `postAccount.update` + `publishLog.create` per account |
| 7 | HIGH | N+1 | `src/app/api/posts/[id]/publish/route.ts` | 89–152 | Same serial write pattern as #6 |
| 8 | MEDIUM | Missing Index | `prisma/schema.prisma` | PostAccount | No index on `(postId, status)` |
| 9 | MEDIUM | Missing Index | `prisma/schema.prisma` | MediaFile | No indexes on workspace + sort/filter columns |
| 10 | MEDIUM | Missing Index | `prisma/schema.prisma` | ActivityLog | No index on `(workspaceId, createdAt)` |
| 11 | MEDIUM | N+1 | `src/app/api/posts/pending/route.ts` | 61–73 | Author data fetched in second query instead of join |
| 12 | MEDIUM | Inefficient Query | `src/app/api/admin/stats/route.ts` | 74–87 | Second subscription query to compute MRR, data already available |
| 13 | MEDIUM | Missing `select` | `src/app/api/posts/[id]/route.ts` | 13 | `socialAccount: true` fetches tokens |
| 14 | MEDIUM | Missing `select` | `src/app/api/accounts/route.ts` | 34–40 | Full `socialAccount` rows including tokens returned to client |
| 15 | MEDIUM | Missing `select` | `src/app/api/campaigns/[id]/route.ts` | 33–51 | Full post graph with tokens loaded even for PATCH/DELETE |
| 16 | MEDIUM | Missing Pagination | `src/app/api/posts/queue/route.ts` | 31–47 | No pagination on queue listing |
| 17 | MEDIUM | Missing Pagination | `src/app/api/campaigns/route.ts` | 56–77 | No pagination on campaign list |
| 18 | MEDIUM | Transaction | `src/app/api/posts/[id]/approve/route.ts` | 71–99 | Post update and activity log not atomic |
| 19 | MEDIUM | Transaction | `src/app/api/posts/[id]/publish/route.ts` | 99–183 | DB bookkeeping writes after publish not atomic |
| 20 | MEDIUM | Inefficient Query | `src/app/api/media/route.ts` | 65–77 | Storage aggregate on every page request |
| 21 | LOW | Missing Index | `prisma/schema.prisma` | PublishLog | No index on `(postId, attemptAt)` |
| 22 | LOW | Missing Pagination | `src/app/api/workspace/members/route.ts` | 64–93 | No pagination on member list |
| 23 | LOW | Transaction | `src/app/api/posts/[id]/retry/route.ts` | 85–124 | Three sequential writes not atomic |
| 24 | LOW | Computed Field | `src/app/api/campaigns/route.ts` | 79–89 | `computeCampaignStatus` duplicated; campaign status not persisted |
