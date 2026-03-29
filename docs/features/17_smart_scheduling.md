# Feature 17: Smart Scheduling / Best Time to Post

## Overview

Analyzes a workspace's historical `PostAnalytics` records to surface the top-performing (day, hour) slots per social account and platform. The result is surfaced in the composer datetime picker as "Suggested times", with a confidence rating based on sample size. New accounts fall back to hardcoded platform-generic best times until enough data is collected.

**Plan gating:** Available on STARTER, PRO, and PRO_PLUS. FREE workspaces receive the generic cold-start suggestions only.

---

## 1. Data Model

### New Prisma model: `TimeSlotEngagement`

Add to `prisma/schema.prisma` in the Analytics section:

```prisma
model TimeSlotEngagement {
  id                String   @id @default(cuid())
  socialAccountId   String
  platform          Platform
  dayOfWeek         Int      // 0 = Sunday … 6 = Saturday
  hourOfDay         Int      // 0–23 in the workspace's local timezone
  avgEngagementRate Float    // engagements / impressions; 0 when impressions = 0
  sampleSize        Int      // number of PostAnalytics rows used
  updatedAt         DateTime @updatedAt

  socialAccount SocialAccount @relation(fields: [socialAccountId], references: [id], onDelete: Cascade)

  @@unique([socialAccountId, platform, dayOfWeek, hourOfDay])
  @@map("time_slot_engagements")
}
```

Add the back-relation on `SocialAccount`:

```prisma
timeSlotEngagements TimeSlotEngagement[]
```

**Migration:** `npx prisma migrate dev --name add_time_slot_engagement`

### Relationship to existing models

- Reads from `PostAnalytics` (joined through `Post` → `PostAccount` → `SocialAccount`) to obtain per-post engagement metrics and the published timestamp.
- One `TimeSlotEngagement` row per `(socialAccountId, platform, dayOfWeek, hourOfDay)` — upserted weekly by the cron job.

### Confidence thresholds

| `sampleSize` | `confidence` label |
|---|---|
| < 5 | `"low"` |
| 5–19 | `"medium"` |
| ≥ 20 | `"high"` |

---

## 2. Algorithm

### Weekly cron job (upsert path)

For every active `SocialAccount` in every workspace:

1. Load all `PostAnalytics` rows where the linked `Post.publishedAt` is not null and `Post.status = PUBLISHED`.
2. For each row, derive `dayOfWeek` and `hourOfDay` from `Post.publishedAt` converted to the workspace timezone (`Workspace.timezone`).
3. Group by `(dayOfWeek, hourOfDay)`.
4. For each group compute:
   - `avgEngagementRate = sum(engagements) / sum(impressions)` — skip the group if `sum(impressions) = 0`.
   - `sampleSize = count of rows in the group`.
5. Upsert into `TimeSlotEngagement` (create or update).

### Query path (API)

1. Load `TimeSlotEngagement` rows for the requested `(socialAccountId, platform)`.
2. Sort descending by `avgEngagementRate`.
3. Return the top 5.
4. If zero rows exist (cold start), return the platform-generic defaults below.

### Cold-start defaults (hardcoded)

These are returned with `confidence: "low"` and `engagementRate: null`.

```typescript
const COLD_START_SLOTS: Record<string, Array<{ dayOfWeek: number; hourOfDay: number }>> = {
  TWITTER:   [{ dayOfWeek: 2, hourOfDay: 9 }, { dayOfWeek: 3, hourOfDay: 12 }, { dayOfWeek: 4, hourOfDay: 15 }, { dayOfWeek: 2, hourOfDay: 11 }, { dayOfWeek: 3, hourOfDay: 10 }],
  LINKEDIN:  [{ dayOfWeek: 2, hourOfDay: 8 }, { dayOfWeek: 3, hourOfDay: 10 }, { dayOfWeek: 4, hourOfDay: 9 }, { dayOfWeek: 2, hourOfDay: 12 }, { dayOfWeek: 3, hourOfDay: 17 }],
  INSTAGRAM: [{ dayOfWeek: 3, hourOfDay: 11 }, { dayOfWeek: 2, hourOfDay: 14 }, { dayOfWeek: 5, hourOfDay: 10 }, { dayOfWeek: 1, hourOfDay: 9 }, { dayOfWeek: 4, hourOfDay: 14 }],
  FACEBOOK:  [{ dayOfWeek: 3, hourOfDay: 13 }, { dayOfWeek: 4, hourOfDay: 11 }, { dayOfWeek: 2, hourOfDay: 14 }, { dayOfWeek: 5, hourOfDay: 12 }, { dayOfWeek: 1, hourOfDay: 10 }],
  TIKTOK:    [{ dayOfWeek: 2, hourOfDay: 19 }, { dayOfWeek: 4, hourOfDay: 17 }, { dayOfWeek: 6, hourOfDay: 11 }, { dayOfWeek: 1, hourOfDay: 20 }, { dayOfWeek: 5, hourOfDay: 18 }],
  YOUTUBE:   [{ dayOfWeek: 5, hourOfDay: 15 }, { dayOfWeek: 6, hourOfDay: 11 }, { dayOfWeek: 0, hourOfDay: 14 }, { dayOfWeek: 4, hourOfDay: 16 }, { dayOfWeek: 3, hourOfDay: 17 }],
  // All remaining platforms share a sensible generic default
  DEFAULT:   [{ dayOfWeek: 2, hourOfDay: 10 }, { dayOfWeek: 3, hourOfDay: 12 }, { dayOfWeek: 4, hourOfDay: 9 }, { dayOfWeek: 2, hourOfDay: 15 }, { dayOfWeek: 3, hourOfDay: 17 }],
};
```

---

## 3. API

### `GET /api/analytics/optimal-times`

**Query params**

| Param | Required | Description |
|---|---|---|
| `accountId` | yes | `SocialAccount.id` |
| `platform` | yes | `Platform` enum value |
| `workspaceId` | yes | For membership verification |

**Auth:** session cookie (same pattern as `/api/analytics`).

**Response shape**

```typescript
type OptimalTimeSlot = {
  dayOfWeek: number;       // 0–6
  hourOfDay: number;       // 0–23
  engagementRate: number | null;  // null for cold-start defaults
  confidence: "low" | "medium" | "high";
};

// HTTP 200
{ slots: OptimalTimeSlot[] }  // up to 5 items, best first
```

**Plan gating:** FREE workspaces receive cold-start defaults only (no DB lookup). Non-FREE plans receive personalized slots if data exists, otherwise cold-start defaults.

**Error responses:** `401 Unauthorized`, `403 Forbidden`, `400` on missing params.

---

## 4. UI Integration

### Composer datetime picker

Location: wherever `scheduledAt` is set in the post composer.

Add a "Suggested times" collapsible section beneath the datetime input:

```
┌──────────────────────────────────────────┐
│  Schedule post                            │
│  [Date picker]  [Time picker]             │
│                                           │
│  ▾ Suggested times                        │
│    Tue 10:00 am  ●●●  high                │
│    Wed 12:00 pm  ●●○  medium              │
│    Thu  9:00 am  ●○○  low                 │
│                                           │
│  [Use this time] on hover/click           │
└──────────────────────────────────────────┘
```

- Show top 3 slots (not all 5; the remaining 2 are available via "Show more").
- Clicking a slot fills the datetime picker with the next occurrence of that (dayOfWeek, hourOfDay) in the future.
- **Confidence indicator:** three-dot badge (`●●●` high, `●●○` medium, `●○○` low). Tooltip explains what confidence means.
- Cold-start slots are labeled "Generic suggestion" in a muted style.
- Fetch is triggered when the composer mounts and `accountId` + `platform` are known; results are cached in React Query with a 1-hour stale time.

---

## 5. Implementation Code

### 5a. API route — `src/app/api/analytics/optimal-times/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// ── Types ──────────────────────────────────────────────────────────────────────

type Confidence = "low" | "medium" | "high";

type OptimalTimeSlot = {
  dayOfWeek: number;
  hourOfDay: number;
  engagementRate: number | null;
  confidence: Confidence;
};

// ── Cold-start defaults ────────────────────────────────────────────────────────

const COLD_START_SLOTS: Record<string, Array<{ dayOfWeek: number; hourOfDay: number }>> = {
  TWITTER:   [{ dayOfWeek: 2, hourOfDay: 9 }, { dayOfWeek: 3, hourOfDay: 12 }, { dayOfWeek: 4, hourOfDay: 15 }, { dayOfWeek: 2, hourOfDay: 11 }, { dayOfWeek: 3, hourOfDay: 10 }],
  LINKEDIN:  [{ dayOfWeek: 2, hourOfDay: 8 }, { dayOfWeek: 3, hourOfDay: 10 }, { dayOfWeek: 4, hourOfDay: 9 }, { dayOfWeek: 2, hourOfDay: 12 }, { dayOfWeek: 3, hourOfDay: 17 }],
  INSTAGRAM: [{ dayOfWeek: 3, hourOfDay: 11 }, { dayOfWeek: 2, hourOfDay: 14 }, { dayOfWeek: 5, hourOfDay: 10 }, { dayOfWeek: 1, hourOfDay: 9 }, { dayOfWeek: 4, hourOfDay: 14 }],
  FACEBOOK:  [{ dayOfWeek: 3, hourOfDay: 13 }, { dayOfWeek: 4, hourOfDay: 11 }, { dayOfWeek: 2, hourOfDay: 14 }, { dayOfWeek: 5, hourOfDay: 12 }, { dayOfWeek: 1, hourOfDay: 10 }],
  TIKTOK:    [{ dayOfWeek: 2, hourOfDay: 19 }, { dayOfWeek: 4, hourOfDay: 17 }, { dayOfWeek: 6, hourOfDay: 11 }, { dayOfWeek: 1, hourOfDay: 20 }, { dayOfWeek: 5, hourOfDay: 18 }],
  YOUTUBE:   [{ dayOfWeek: 5, hourOfDay: 15 }, { dayOfWeek: 6, hourOfDay: 11 }, { dayOfWeek: 0, hourOfDay: 14 }, { dayOfWeek: 4, hourOfDay: 16 }, { dayOfWeek: 3, hourOfDay: 17 }],
  DEFAULT:   [{ dayOfWeek: 2, hourOfDay: 10 }, { dayOfWeek: 3, hourOfDay: 12 }, { dayOfWeek: 4, hourOfDay: 9 }, { dayOfWeek: 2, hourOfDay: 15 }, { dayOfWeek: 3, hourOfDay: 17 }],
};

function getColdStartSlots(platform: string): OptimalTimeSlot[] {
  const raw = COLD_START_SLOTS[platform] ?? COLD_START_SLOTS.DEFAULT;
  return raw.map((s) => ({ ...s, engagementRate: null, confidence: "low" as Confidence }));
}

function toConfidence(sampleSize: number): Confidence {
  if (sampleSize >= 20) return "high";
  if (sampleSize >= 5) return "medium";
  return "low";
}

// ── Handler ────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const workspaceId = searchParams.get("workspaceId");
  const accountId   = searchParams.get("accountId");
  const platform    = searchParams.get("platform");

  if (!workspaceId || !accountId || !platform) {
    return NextResponse.json(
      { error: "workspaceId, accountId and platform are required" },
      { status: 400 }
    );
  }

  // Verify membership
  const membership = await db.workspaceMember.findFirst({
    where: { workspaceId, userId: session.user.id, status: "ACTIVE" },
  });
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Get workspace plan
  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: { plan: true },
  });
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  // FREE plan: return cold-start only
  if (workspace.plan === "FREE") {
    return NextResponse.json({ slots: getColdStartSlots(platform), source: "generic" });
  }

  // Paid plans: attempt personalized lookup
  const rows = await db.timeSlotEngagement.findMany({
    where: { socialAccountId: accountId, platform: platform as never },
    orderBy: { avgEngagementRate: "desc" },
    take: 5,
  });

  if (rows.length === 0) {
    return NextResponse.json({ slots: getColdStartSlots(platform), source: "generic" });
  }

  const slots: OptimalTimeSlot[] = rows.map((r) => ({
    dayOfWeek:      r.dayOfWeek,
    hourOfDay:      r.hourOfDay,
    engagementRate: r.avgEngagementRate,
    confidence:     toConfidence(r.sampleSize),
  }));

  return NextResponse.json({ slots, source: "personalized" });
}
```

### 5b. Cron job — `src/app/api/cron/sync-engagement-slots/route.ts`

Register in `vercel.json` alongside the existing publish cron:
```json
{ "path": "/api/cron/sync-engagement-slots", "schedule": "0 3 * * 0" }
```
(Runs every Sunday at 03:00 UTC.)

```typescript
// ─── Cron: Sync TimeSlotEngagement ────────────────────────────────────────────
// Vercel Cron — runs weekly (Sunday 03:00 UTC).
// Analyzes PostAnalytics per social account and upserts TimeSlotEngagement rows.

import { db } from "@/lib/db";
import { formatInTimeZone } from "date-fns-tz";

export const runtime  = "nodejs";
export const maxDuration = 300; // 5 min — workspaces with many accounts need time

// ── Auth guard ─────────────────────────────────────────────────────────────────

function isAuthorized(req: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  return !!cronSecret && req.headers.get("Authorization") === `Bearer ${cronSecret}`;
}

// ── Core logic ─────────────────────────────────────────────────────────────────

/**
 * For a single social account, load all published PostAnalytics, group by
 * (dayOfWeek, hourOfDay) in the workspace timezone, and upsert engagement rates.
 */
async function syncAccountSlots(
  socialAccountId: string,
  platform: string,
  workspaceTimezone: string
): Promise<number> {
  // Load PostAnalytics joined to published posts for this account
  const rows = await db.postAnalytics.findMany({
    where: {
      platform: platform as never,
      post: {
        accounts: { some: { socialAccountId } },
        status: "PUBLISHED",
        publishedAt: { not: null },
      },
    },
    select: {
      impressions: true,
      engagements: true,
      post: { select: { publishedAt: true } },
    },
  });

  if (rows.length === 0) return 0;

  // Aggregate by (dayOfWeek, hourOfDay)
  type SlotKey = string; // `${dayOfWeek}:${hourOfDay}`
  const slotMap = new Map<
    SlotKey,
    { totalEngagements: number; totalImpressions: number; count: number }
  >();

  for (const row of rows) {
    const publishedAt = row.post?.publishedAt;
    if (!publishedAt) continue;

    // Convert UTC timestamp to workspace-local (dayOfWeek, hour)
    const localDay  = parseInt(formatInTimeZone(publishedAt, workspaceTimezone, "i"), 10) % 7; // date-fns-tz "i" = ISO day 1-7; map to 0-6 Sun-based
    const localHour = parseInt(formatInTimeZone(publishedAt, workspaceTimezone, "H"), 10);

    // "i" gives Mon=1…Sun=7. Convert to Sun=0…Sat=6 to match JS getDay()
    const dayOfWeek = localDay === 7 ? 0 : localDay;

    const key = `${dayOfWeek}:${localHour}`;
    const existing = slotMap.get(key) ?? { totalEngagements: 0, totalImpressions: 0, count: 0 };
    existing.totalEngagements  += row.engagements;
    existing.totalImpressions  += row.impressions;
    existing.count             += 1;
    slotMap.set(key, existing);
  }

  // Upsert each slot
  let upserted = 0;
  for (const [key, data] of slotMap.entries()) {
    const [dayStr, hourStr] = key.split(":");
    const dayOfWeek = parseInt(dayStr, 10);
    const hourOfDay = parseInt(hourStr, 10);
    const avgEngagementRate =
      data.totalImpressions > 0 ? data.totalEngagements / data.totalImpressions : 0;

    await db.timeSlotEngagement.upsert({
      where: {
        socialAccountId_platform_dayOfWeek_hourOfDay: {
          socialAccountId,
          platform: platform as never,
          dayOfWeek,
          hourOfDay,
        },
      },
      create: {
        socialAccountId,
        platform:          platform as never,
        dayOfWeek,
        hourOfDay,
        avgEngagementRate,
        sampleSize:        data.count,
      },
      update: {
        avgEngagementRate,
        sampleSize: data.count,
      },
    });
    upserted++;
  }

  return upserted;
}

// ── Handler ────────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  console.log("[cron/sync-engagement-slots] Starting at", new Date().toISOString());

  // Load all active social accounts with their workspace timezone
  const accounts = await db.socialAccount.findMany({
    where: { status: "ACTIVE" },
    select: {
      id:       true,
      platform: true,
      workspace: { select: { timezone: true } },
    },
  });

  let totalUpserted = 0;
  let errors = 0;

  for (const account of accounts) {
    try {
      const n = await syncAccountSlots(
        account.id,
        account.platform,
        account.workspace.timezone ?? "UTC"
      );
      totalUpserted += n;
    } catch (err) {
      errors++;
      console.error(
        `[cron/sync-engagement-slots] Error for account ${account.id}:`,
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  const durationMs = Date.now() - startedAt;
  console.log(
    `[cron/sync-engagement-slots] Done in ${durationMs}ms — ` +
      `${accounts.length} accounts, ${totalUpserted} slots upserted, ${errors} errors.`
  );

  return Response.json({
    ok: true,
    durationMs,
    accountsProcessed: accounts.length,
    slotsUpserted:     totalUpserted,
    errors,
  });
}
```

---

## 6. vercel.json update

```json
{
  "crons": [
    { "path": "/api/cron/publish",                 "schedule": "* * * * *" },
    { "path": "/api/cron/sync-engagement-slots",   "schedule": "0 3 * * 0" }
  ]
}
```

---

## 7. Implementation checklist

- [ ] Add `TimeSlotEngagement` model to `prisma/schema.prisma` and add back-relation on `SocialAccount`
- [ ] Run `npx prisma migrate dev --name add_time_slot_engagement`
- [ ] Create `src/app/api/analytics/optimal-times/route.ts` (Section 5a)
- [ ] Create `src/app/api/cron/sync-engagement-slots/route.ts` (Section 5b)
- [ ] Add the new cron entry to `vercel.json` (Section 6)
- [ ] Add `date-fns-tz` dependency if not already present (`npm install date-fns-tz`)
- [ ] Wire the `GET /api/analytics/optimal-times` call into the composer datetime picker
- [ ] Render top 3 suggested slots with confidence badges; "Show more" for remaining 2
- [ ] Cache API response in React Query (`staleTime: 60 * 60 * 1000`)

---

## 8. Notes & edge cases

- **Timezone handling:** `Post.publishedAt` is stored in UTC. Day/hour bucketing uses the workspace timezone so suggestions are meaningful to the team's audience.
- **Impressions = 0:** Skip the engagement rate calculation (avoid division by zero); sampleSize is still incremented so the slot is counted but will produce `avgEngagementRate = 0`.
- **Platform mismatch:** A `PostAnalytics` row with `platform = TWITTER` joined to an Instagram `SocialAccount` is filtered out by the `where.platform` clause in the cron query.
- **Stale data:** `updatedAt` on `TimeSlotEngagement` allows the UI to warn if slots are older than 30 days (e.g., account has been inactive).
- **Plan gating consistency:** The API checks `workspace.plan === "FREE"` at the handler level. The UI should also hide the "Suggested times" section for FREE workspaces and show an upgrade prompt instead.
