# Feature 25: Advanced Analytics

## Overview

PostSyncer advanced analytics gives users actionable intelligence about when to post,
who their audience is, what content performs best, and how they compare to competitors.
Features are gated by plan to drive PRO and PRO_PLUS upgrades.

---

## 1. Engagement Heatmap (Best Time to Post)

### Goal
Surface the optimal day/hour combinations for each social account based on historical
engagement data already captured in `PostAnalytics`.

### Data Model

```prisma
model TimeSlotEngagement {
  id                String   @id @default(cuid())
  accountId         String
  dayOfWeek         Int      // 0 = Sunday … 6 = Saturday
  hourOfDay         Int      // 0–23 UTC
  avgEngagementRate Float
  sampleSize        Int
  updatedAt         DateTime @updatedAt

  @@unique([accountId, dayOfWeek, hourOfDay])
  @@index([accountId])
}
```

### Population Logic

Weekly cron (`lib/jobs/heatmap-rollup.ts`):

```
FOR each active socialAccount:
  SELECT dayOfWeek, hourOfDay,
         AVG(engagementRate) AS avg,
         COUNT(*)            AS n
  FROM   PostAnalytics
  WHERE  socialAccountId = ?
    AND  publishedAt >= NOW() - INTERVAL '30 days'
  GROUP  BY dayOfWeek, hourOfDay
  UPSERT INTO TimeSlotEngagement
```

Use Prisma `upsert` with `@@unique` constraint. Minimum `sampleSize` of 3 before
the cell is considered reliable; render unreliable cells with reduced opacity.

### API

```
GET /api/analytics/heatmap?accountId=<id>&days=30
```

Response:

```json
{
  "accountId": "...",
  "cells": [
    { "day": 1, "hour": 9, "avgEngagementRate": 0.042, "sampleSize": 14 }
  ],
  "bestSlot": { "day": 1, "hour": 9 }
}
```

Authorization: `socialAccount.userId === session.user.id`.

### UI Component

`components/analytics/HeatmapChart.tsx` — SVG 7×24 grid:

- X-axis: hours 0–23, Y-axis: days Sun–Sat
- Color scale: `#e5e7eb` (gray, zero) → `#16a34a` (green, max)
- Tooltip on hover: day name, hour range, engagement rate, sample count
- Highlight best slot with a ring indicator
- Loading skeleton: gray placeholder grid

---

## 2. Audience Demographics

### Platform Availability

| Platform  | Age Ranges | Gender Split | Top Locations | Other                      |
|-----------|------------|--------------|---------------|----------------------------|
| Instagram | Yes        | Yes          | Yes           | —                          |
| Facebook  | Yes        | Yes          | Yes           | —                          |
| Twitter/X | No         | No           | No            | Not available via public API|
| LinkedIn  | No         | No           | No            | Job function, seniority, industry |

### Data Model

```prisma
model AudienceDemographicSnapshot {
  id              String   @id @default(cuid())
  socialAccountId String
  platform        Platform
  ageRanges       Json     // [{ "range": "18-24", "percentage": 23 }]
  genderSplit     Json     // { "male": 45, "female": 52, "other": 3 }
  topLocations    Json     // [{ "name": "New York", "percentage": 8 }]
  professionalData Json?   // LinkedIn only: { jobFunctions, seniorities, industries }
  capturedAt      DateTime @default(now())

  @@index([socialAccountId, capturedAt])
}
```

### Fetch Strategy

Weekly cron (`lib/jobs/demographics-sync.ts`):

1. For each PRO+ account with Instagram/Facebook/LinkedIn token:
   - Call platform Insights API with appropriate scopes
   - Insert new `AudienceDemographicSnapshot` row (never mutate historical rows)
2. Retain last 12 snapshots per account for trend analysis

### API

```
GET /api/analytics/demographics?accountId=<id>
```

Returns the most recent snapshot plus a 12-week trend for follower count.

### UI

`components/analytics/DemographicsPanel.tsx`:

- **Age / Gender**: donut chart (Recharts `PieChart`)
- **Locations**: horizontal bar chart, top 10 cities or countries
- **LinkedIn**: stacked bar chart for job functions × seniority
- Tab switcher when account has multiple platforms

---

## 3. Content Performance Insights

### Metrics Computed On-Demand (last 30 days)

| Insight             | Query                                                          |
|---------------------|----------------------------------------------------------------|
| Top 10 posts        | `PostAnalytics ORDER BY engagementRate DESC LIMIT 10`          |
| Content type split  | `GROUP BY contentType` → avg engagement rate per type          |
| Hashtag performance | Explode `hashtags[]` array, `GROUP BY tag` → avg reach         |

Content type enum: `VIDEO`, `IMAGE`, `CAROUSEL`, `TEXT`, `LINK`.

### API

```
GET /api/analytics/content-insights?accountId=<id>&days=30
```

### AI Insight Summary (PRO_PLUS)

After computing the above metrics, call GPT-4o with a structured prompt:

```
Given these content performance statistics for a {platform} account,
identify 3 concise, actionable insights. Focus on patterns a marketer
can act on this week. Return JSON: { insights: string[] }
```

- Cache the AI summary in Redis for 24 hours (key: `ai-insight:{accountId}:{date}`)
- Regenerate on explicit user refresh (rate-limited: max 5/day per account)
- Display as a highlighted callout card above the charts

---

## 4. Competitor Benchmarking (PRO_PLUS only)

### Data Model

```prisma
model CompetitorHandle {
  id              String   @id @default(cuid())
  workspaceId     String
  platform        Platform
  handle          String
  displayName     String?
  createdAt       DateTime @default(now())

  snapshots       CompetitorSnapshot[]

  @@unique([workspaceId, platform, handle])
}

model CompetitorSnapshot {
  id                 String           @id @default(cuid())
  competitorHandleId String
  followerCount      Int?
  postCount          Int?
  avgPostsPerWeek    Float?
  capturedAt         DateTime         @default(now())

  competitorHandle   CompetitorHandle @relation(fields: [competitorHandleId], references: [id])

  @@index([competitorHandleId, capturedAt])
}
```

### Collection Strategy

- **Instagram**: public profile via Instagram Basic Display or scrape-safe Graph API
- **LinkedIn**: public profile follower count (limited — degrade gracefully)
- **Twitter/X**: public profile API v2 (`/users/by/username/:username`)
- Weekly cron; respect platform rate limits with exponential back-off
- Ethical constraints: public data only, no credential sharing, no scraping behind login walls

### Limits

- Max 5 competitor handles per workspace (enforced at API and DB level)
- Retain 52 weekly snapshots per handle (1 year)

### API

```
POST /api/analytics/competitors          # add handle
DELETE /api/analytics/competitors/:id   # remove handle
GET  /api/analytics/competitors?workspaceId=<id>  # list + latest snapshot
```

### UI

`components/analytics/CompetitorBenchmark.tsx`:

- Line chart: follower growth (own account vs each competitor, last 12 weeks)
- Bar chart: avg posts per week comparison
- Status badge: "Data as of {date}" with manual refresh button (rate-limited)

---

## 5. Plan Gating

| Feature                   | FREE | PRO | PRO_PLUS |
|---------------------------|------|-----|----------|
| Engagement Heatmap        | —    | Yes | Yes      |
| Audience Demographics     | —    | Yes | Yes      |
| Content Performance       | —    | Yes | Yes      |
| AI Insight Summary        | —    | —   | Yes      |
| Competitor Benchmarking   | —    | —   | Yes (max 5) |

Enforcement:

- Middleware `lib/analytics/gate.ts` checks `workspace.plan` before each analytics handler
- Frontend: upsell modal (`components/UpsellModal.tsx`) with plan comparison table on locked features

---

## 6. Implementation Priority

| Phase | Feature                    | Depends On                        | Estimate |
|-------|----------------------------|-----------------------------------|----------|
| 1     | Engagement Heatmap         | Feature 17 (Smart Scheduling)     | 3 days   |
| 2     | Audience Demographics      | Platform OAuth scopes widened     | 4 days   |
| 3     | Content Performance + AI   | OpenAI integration, Redis cache   | 3 days   |
| 4     | Competitor Benchmarking    | CompetitorHandle model, cron infra| 5 days   |

Phase 1 reuses the `TimeSlotEngagement` model already referenced in Feature 17 —
confirm schema consistency before migrating.

---

## 7. Shared Infrastructure

- **Cron runner**: existing BullMQ queue; add `analytics-rollup` and `demographics-sync` job types
- **Charts**: Recharts already in dependency tree; add `d3-scale` for heatmap color interpolation
- **Caching**: Redis (`ioredis`) for AI summaries and expensive aggregation queries (TTL 1–24 h)
- **Error handling**: if a platform API call fails, log to Sentry and skip that account silently;
  do not fail the entire cron batch
