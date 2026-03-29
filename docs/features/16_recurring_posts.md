# Feature 16: Recurring Posts

## Overview

Recurring Posts allows users to schedule a post once and have it automatically republish on a configurable cadence — daily, weekly, monthly, or a custom CRON expression. After each successful publish the engine clones the template post and schedules the next occurrence, leaving a clean audit trail of every individual publication.

---

## 1. Database Schema Changes

### New enum: `RecurringFrequency`

```prisma
enum RecurringFrequency {
  DAILY
  WEEKLY
  MONTHLY
  CUSTOM
}
```

### New model: `RecurringSchedule`

```prisma
model RecurringSchedule {
  id              String             @id @default(cuid())
  workspaceId     String
  templatePostId  String             // the master Post record used as the content template
  frequency       RecurringFrequency
  cronExpression  String             // always populated; preset frequencies map to standard cron strings
  timezone        String             @default("UTC")
  nextRunAt       DateTime
  lastRunAt       DateTime?
  isActive        Boolean            @default(true)
  failureCount    Int                @default(0)  // consecutive failures; auto-pauses at threshold
  pausedAt        DateTime?
  pauseReason     String?
  createdAt       DateTime           @default(now())
  updatedAt       DateTime           @updatedAt

  workspace    Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  templatePost Post      @relation("RecurringTemplate", fields: [templatePostId], references: [id], onDelete: Cascade)
  spawnedPosts Post[]    @relation("RecurringSpawned")

  @@index([workspaceId, isActive])
  @@index([nextRunAt, isActive])
  @@map("recurring_schedules")
}
```

### Additions to existing `Post` model

Two new optional fields link spawned posts back to their schedule:

```prisma
model Post {
  // ... existing fields ...

  // Recurring posts
  recurringScheduleId        String?                // set on spawned posts
  recurringSchedule          RecurringSchedule?     @relation("RecurringSpawned", fields: [recurringScheduleId], references: [id], onDelete: SetNull)
  ownedRecurringSchedules    RecurringSchedule[]    @relation("RecurringTemplate")
}
```

### Additions to `Workspace` model

```prisma
model Workspace {
  // ... existing fields ...
  recurringSchedules RecurringSchedule[]
}
```

### Plan limits (applied in API layer, not schema)

| Plan     | Max active recurring schedules |
|----------|-------------------------------|
| FREE     | 0 (feature disabled)          |
| STARTER  | 3                             |
| PRO      | 20                            |
| PRO_PLUS | unlimited                     |

---

## 2. API Endpoints

All endpoints sit under `/api/recurring-schedules` and require an authenticated session with active workspace membership.

### POST `/api/recurring-schedules`

Create a new recurring schedule attached to an existing post.

**Request body**

```jsonc
{
  "workspaceId": "clx...",
  "templatePostId": "clx...",        // must be a DRAFT or PUBLISHED post owned by the workspace
  "frequency": "WEEKLY",             // DAILY | WEEKLY | MONTHLY | CUSTOM
  "cronExpression": "0 9 * * 1",     // required for CUSTOM; auto-generated for presets
  "timezone": "America/New_York",    // IANA timezone string
  "firstRunAt": "2026-04-07T09:00:00Z" // ISO datetime for the initial run
}
```

**Responses**

- `201 Created` — returns the created `RecurringSchedule` with `templatePost` included
- `402 Payment Required` — plan limit reached
- `403 Forbidden` — workspace access denied
- `422 Unprocessable Entity` — validation failure

---

### GET `/api/recurring-schedules?workspaceId=clx...`

List all recurring schedules for a workspace, including the template post and the 5 most-recent spawned posts per schedule.

**Query params**

| Param       | Default | Notes                          |
|-------------|---------|-------------------------------|
| workspaceId | —       | required                       |
| isActive    | —       | `true` / `false` filter        |
| page        | 1       |                                |
| pageSize    | 20      | max 50                         |

**Response**

```jsonc
{
  "data": [ /* RecurringSchedule[] with relations */ ],
  "meta": { "total": 4, "page": 1, "pageSize": 20, "hasNext": false }
}
```

---

### PATCH `/api/recurring-schedules/[id]`

Update frequency, cron expression, timezone, nextRunAt, or pause/resume the schedule.

**Request body** (all fields optional)

```jsonc
{
  "frequency": "MONTHLY",
  "cronExpression": "0 9 1 * *",
  "timezone": "Europe/London",
  "nextRunAt": "2026-05-01T09:00:00Z",
  "isActive": false   // pause the schedule
}
```

**Response** — updated `RecurringSchedule`

---

### DELETE `/api/recurring-schedules/[id]`

Permanently deletes the schedule. Already-published spawned posts are preserved. The template post is NOT deleted.

**Response** — `204 No Content`

---

## 3. UI — RecurrencePicker Component

The recurrence picker lives inside the post composer as a collapsible section below the scheduling controls. It is only shown when `scheduledAt` is set.

### Component: `RecurrencePicker`

```tsx
// src/components/composer/RecurrencePicker.tsx
"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type RecurringFrequency = "DAILY" | "WEEKLY" | "MONTHLY" | "CUSTOM";

export interface RecurrenceValue {
  enabled: boolean;
  frequency: RecurringFrequency;
  cronExpression: string;   // canonical cron string the server will store
  timezone: string;
}

interface RecurrencePickerProps {
  value: RecurrenceValue;
  onChange: (value: RecurrenceValue) => void;
  timezone: string;         // workspace default timezone
  plan: "FREE" | "STARTER" | "PRO" | "PRO_PLUS";
  className?: string;
}

const PRESET_CRONS: Record<Exclude<RecurringFrequency, "CUSTOM">, string> = {
  DAILY:   "0 9 * * *",
  WEEKLY:  "0 9 * * 1",
  MONTHLY: "0 9 1 * *",
};

const FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  DAILY:   "Daily",
  WEEKLY:  "Weekly",
  MONTHLY: "Monthly",
  CUSTOM:  "Custom CRON",
};

const PLAN_ALLOWS_RECURRING: Record<RecurrencePickerProps["plan"], boolean> = {
  FREE:     false,
  STARTER:  true,
  PRO:      true,
  PRO_PLUS: true,
};

export function RecurrencePicker({
  value,
  onChange,
  timezone,
  plan,
  className,
}: RecurrencePickerProps) {
  const [cronError, setCronError] = useState<string | null>(null);
  const allowed = PLAN_ALLOWS_RECURRING[plan];

  function handleToggle(enabled: boolean) {
    onChange({ ...value, enabled });
  }

  function handleFrequencyChange(freq: RecurringFrequency) {
    const cronExpression =
      freq === "CUSTOM" ? value.cronExpression : PRESET_CRONS[freq];
    onChange({ ...value, frequency: freq, cronExpression });
    setCronError(null);
  }

  function handleCronChange(raw: string) {
    const trimmed = raw.trim();
    const valid = isValidCron(trimmed);
    setCronError(valid ? null : "Invalid CRON expression (5 fields required)");
    onChange({ ...value, cronExpression: trimmed });
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* Toggle row */}
      <div className="flex items-center gap-3">
        <Switch
          id="recurrence-toggle"
          checked={value.enabled}
          onCheckedChange={handleToggle}
          disabled={!allowed}
        />
        <Label htmlFor="recurrence-toggle" className="cursor-pointer">
          Repeat this post
        </Label>
        {!allowed && (
          <Badge variant="outline" className="text-xs">
            Starter plan+
          </Badge>
        )}
      </div>

      {/* Expanded controls */}
      {value.enabled && allowed && (
        <div className="ml-9 space-y-3 rounded-lg border bg-muted/40 p-3">
          {/* Frequency selector */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Frequency</Label>
            <Select
              value={value.frequency}
              onValueChange={(v) => handleFrequencyChange(v as RecurringFrequency)}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(
                  ["DAILY", "WEEKLY", "MONTHLY", "CUSTOM"] as RecurringFrequency[]
                ).map((freq) => (
                  <SelectItem key={freq} value={freq}>
                    {FREQUENCY_LABELS[freq]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Custom CRON input */}
          {value.frequency === "CUSTOM" && (
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">
                CRON expression{" "}
                <span className="font-mono text-[10px] opacity-60">
                  (min hr dom mon dow)
                </span>
              </Label>
              <Input
                className="font-mono text-sm"
                placeholder="0 9 * * 1"
                value={value.cronExpression}
                onChange={(e) => handleCronChange(e.target.value)}
              />
              {cronError && (
                <p className="text-xs text-destructive">{cronError}</p>
              )}
            </div>
          )}

          {/* Human-readable summary */}
          <p className="text-xs text-muted-foreground">
            {describeSchedule(value, timezone)}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function isValidCron(expr: string): boolean {
  const fields = expr.split(/\s+/);
  return fields.length === 5;
}

function describeSchedule(value: RecurrenceValue, timezone: string): string {
  const tz = value.timezone || timezone;
  switch (value.frequency) {
    case "DAILY":
      return `Publishes every day at 9:00 AM (${tz})`;
    case "WEEKLY":
      return `Publishes every Monday at 9:00 AM (${tz})`;
    case "MONTHLY":
      return `Publishes on the 1st of each month at 9:00 AM (${tz})`;
    case "CUSTOM":
      return `Runs on schedule: ${value.cronExpression} (${tz})`;
  }
}
```

### Integration in composer

```tsx
// Inside the post composer form, after the scheduledAt DateTimePicker:

<RecurrencePicker
  value={recurrence}
  onChange={setRecurrence}
  timezone={workspace.timezone}
  plan={workspace.plan}
/>
```

When the form is submitted with recurrence enabled the client makes two sequential calls:

1. `POST /api/posts` — creates the template post (status `SCHEDULED`, `scheduledAt` = first run time)
2. `POST /api/recurring-schedules` — registers the recurring schedule linked to the new post

---

## 4. Publishing Engine Changes

### Overview of the recurring publish flow

```
publishDuePosts() [every minute]
  └── processRecurringSchedules()   <-- new function
        └── for each due schedule:
              1. clone template post → new SCHEDULED post
              2. update schedule: lastRunAt = now, nextRunAt = computeNextRun(cron, tz)
              3. reset failureCount on success
```

After `publishDuePosts` processes normal posts, the engine also calls `processRecurringSchedules` which fires off the cloning.

### Modified `publishDuePosts` (additions only, existing logic unchanged)

```typescript
// src/lib/scheduler/publish-engine.ts  — additions

import { parseExpression } from "cron-parser";   // npm: cron-parser

// Add this call at the end of publishDuePosts(), after reconcilePostStatus loop:
await processRecurringSchedules();
```

### New function: `processRecurringSchedules`

```typescript
/**
 * Finds all active recurring schedules whose nextRunAt is in the past,
 * clones their template post, and advances nextRunAt.
 *
 * Called at the end of every publishDuePosts() run.
 */
export async function processRecurringSchedules(): Promise<void> {
  const now = new Date();

  const dueSchedules = await db.recurringSchedule.findMany({
    where: {
      isActive: true,
      nextRunAt: { lte: now },
    },
    include: {
      templatePost: {
        include: {
          accounts: { include: { socialAccount: true } },
          media: { include: { mediaFile: true }, orderBy: { order: "asc" } },
          labels: true,
        },
      },
    },
  });

  for (const schedule of dueSchedules) {
    await spawnRecurringPost(schedule);
  }
}

// ─── spawnRecurringPost ───────────────────────────────────────────────────────
// Clones the template post as a new SCHEDULED post and advances the schedule.

async function spawnRecurringPost(
  schedule: RecurringSchedule & {
    templatePost: Post & {
      accounts: (PostAccount & { socialAccount: SocialAccount })[];
      media: (PostMedia & { mediaFile: MediaFile })[];
      labels: PostLabel[];
    };
  }
): Promise<void> {
  const template = schedule.templatePost;

  // Guard: if ALL social accounts on the template are disconnected/expired,
  // pause the schedule rather than spawning a doomed post.
  const activeAccounts = template.accounts.filter(
    (pa) =>
      pa.socialAccount.status === "ACTIVE" &&
      pa.socialAccount.status !== "DISCONNECTED"
  );

  if (activeAccounts.length === 0) {
    await pauseSchedule(
      schedule.id,
      "All linked social accounts are disconnected."
    );
    return;
  }

  try {
    await db.$transaction(async (tx) => {
      // 1. Clone the post
      const spawned = await tx.post.create({
        data: {
          workspaceId: schedule.workspaceId,
          authorId: template.authorId,
          content: template.content,
          contentVariants: template.contentVariants ?? {},
          status: "SCHEDULED",
          scheduledAt: schedule.nextRunAt,
          firstComment: template.firstComment,
          isThread: template.isThread,
          threadParts: template.threadParts ?? [],
          isCarousel: template.isCarousel,
          carouselSlides: template.carouselSlides ?? [],
          approvalStatus: "NOT_REQUIRED",
          recurringScheduleId: schedule.id,
        },
      });

      // 2. Clone PostAccount rows (only active accounts)
      await tx.postAccount.createMany({
        data: activeAccounts.map((pa) => ({
          postId: spawned.id,
          socialAccountId: pa.socialAccountId,
          status: "SCHEDULED" as const,
        })),
      });

      // 3. Clone media attachments
      if (template.media.length > 0) {
        await tx.postMedia.createMany({
          data: template.media.map((pm) => ({
            postId: spawned.id,
            mediaFileId: pm.mediaFileId,
            order: pm.order,
            altText: pm.altText,
          })),
        });
      }

      // 4. Clone labels
      if (template.labels.length > 0) {
        await tx.postLabel.createMany({
          data: template.labels.map((pl) => ({
            postId: spawned.id,
            labelId: pl.labelId,
          })),
        });
      }

      // 5. Advance the schedule
      const nextRunAt = computeNextRun(schedule.cronExpression, schedule.timezone);
      await tx.recurringSchedule.update({
        where: { id: schedule.id },
        data: {
          lastRunAt: new Date(),
          nextRunAt,
          failureCount: 0,   // reset on successful spawn
        },
      });

      // 6. Activity log
      await tx.activityLog.create({
        data: {
          workspaceId: schedule.workspaceId,
          action: "recurring.spawned",
          entityType: "Post",
          entityId: spawned.id,
          metadata: {
            recurringScheduleId: schedule.id,
            templatePostId: template.id,
            nextRunAt: nextRunAt.toISOString(),
          },
        },
      });
    });
  } catch (err) {
    console.error(`[recurring] Failed to spawn for schedule ${schedule.id}:`, err);
    await handleSpawnFailure(schedule.id, schedule.failureCount);
  }
}

// ─── computeNextRun ───────────────────────────────────────────────────────────

function computeNextRun(cronExpression: string, timezone: string): Date {
  // cron-parser resolves the NEXT occurrence after "now" respecting the timezone.
  const interval = parseExpression(cronExpression, {
    currentDate: new Date(),
    tz: timezone,
  });
  return interval.next().toDate();
}

// ─── handleSpawnFailure ───────────────────────────────────────────────────────
// Increments the failure counter and auto-pauses after 3 consecutive failures.

async function handleSpawnFailure(
  scheduleId: string,
  currentFailureCount: number
): Promise<void> {
  const newCount = currentFailureCount + 1;
  const shouldPause = newCount >= 3;

  await db.recurringSchedule.update({
    where: { id: scheduleId },
    data: {
      failureCount: newCount,
      ...(shouldPause
        ? {
            isActive: false,
            pausedAt: new Date(),
            pauseReason: "Auto-paused after 3 consecutive spawn failures.",
          }
        : {}),
    },
  });

  if (shouldPause) {
    console.warn(
      `[recurring] Schedule ${scheduleId} auto-paused after 3 failures.`
    );
    // TODO: send in-app notification / email to workspace owner
  }
}

// ─── pauseSchedule ────────────────────────────────────────────────────────────

async function pauseSchedule(scheduleId: string, reason: string): Promise<void> {
  await db.recurringSchedule.update({
    where: { id: scheduleId },
    data: {
      isActive: false,
      pausedAt: new Date(),
      pauseReason: reason,
    },
  });
  console.warn(`[recurring] Schedule ${scheduleId} paused: ${reason}`);
}
```

---

## 5. API Route Handler — POST `/api/recurring-schedules`

```typescript
// src/app/api/recurring-schedules/route.ts

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { parseExpression } from "cron-parser";

// ─── Plan limits ──────────────────────────────────────────────────────────────

const PLAN_LIMITS: Record<string, number> = {
  FREE:     0,
  STARTER:  3,
  PRO:      20,
  PRO_PLUS: Infinity,
};

// ─── Validation schema ────────────────────────────────────────────────────────

const PRESET_CRONS: Record<string, string> = {
  DAILY:   "0 9 * * *",
  WEEKLY:  "0 9 * * 1",
  MONTHLY: "0 9 1 * *",
};

const createScheduleSchema = z
  .object({
    workspaceId:    z.string().min(1),
    templatePostId: z.string().min(1),
    frequency:      z.enum(["DAILY", "WEEKLY", "MONTHLY", "CUSTOM"]),
    cronExpression: z.string().optional(),
    timezone:       z.string().default("UTC"),
    firstRunAt:     z.string().datetime(),
  })
  .superRefine((data, ctx) => {
    if (data.frequency === "CUSTOM") {
      if (!data.cronExpression) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["cronExpression"],
          message: "cronExpression is required for CUSTOM frequency",
        });
        return;
      }
      try {
        parseExpression(data.cronExpression);
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["cronExpression"],
          message: "Invalid CRON expression",
        });
      }
    }
  });

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createScheduleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 422 }
    );
  }

  const { workspaceId, templatePostId, frequency, timezone, firstRunAt } =
    parsed.data;

  // Resolve the cron expression (use preset for non-CUSTOM frequencies)
  const cronExpression =
    frequency === "CUSTOM"
      ? parsed.data.cronExpression!
      : PRESET_CRONS[frequency];

  // ── Authorization ────────────────────────────────────────────────────────────
  const membership = await db.workspaceMember.findFirst({
    where: { workspaceId, userId: session.user.id, status: "ACTIVE" },
  });
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ── Plan limit check ─────────────────────────────────────────────────────────
  const workspace = await db.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
    select: { plan: true },
  });

  const limit = PLAN_LIMITS[workspace.plan] ?? 0;
  if (limit === 0) {
    return NextResponse.json(
      { error: "Recurring posts are not available on your current plan." },
      { status: 402 }
    );
  }

  if (limit !== Infinity) {
    const activeCount = await db.recurringSchedule.count({
      where: { workspaceId, isActive: true },
    });
    if (activeCount >= limit) {
      return NextResponse.json(
        {
          error: `Your plan allows a maximum of ${limit} active recurring schedules.`,
          code:  "PLAN_LIMIT_REACHED",
        },
        { status: 402 }
      );
    }
  }

  // ── Verify template post ownership ───────────────────────────────────────────
  const templatePost = await db.post.findFirst({
    where: { id: templatePostId, workspaceId },
  });
  if (!templatePost) {
    return NextResponse.json(
      { error: "Template post not found or does not belong to this workspace" },
      { status: 422 }
    );
  }

  // ── Create recurring schedule ─────────────────────────────────────────────────
  try {
    const schedule = await db.recurringSchedule.create({
      data: {
        workspaceId,
        templatePostId,
        frequency,
        cronExpression,
        timezone,
        nextRunAt: new Date(firstRunAt),
        isActive: true,
      },
      include: {
        templatePost: {
          include: {
            accounts: { include: { socialAccount: true } },
          },
        },
      },
    });

    // Log activity
    await db.activityLog.create({
      data: {
        workspaceId,
        userId: session.user.id,
        action: "recurring.created",
        entityType: "RecurringSchedule",
        entityId: schedule.id,
        metadata: { frequency, cronExpression, timezone },
      },
    });

    return NextResponse.json(schedule, { status: 201 });
  } catch (error) {
    console.error("[POST /api/recurring-schedules]", error);
    return NextResponse.json(
      { error: "Failed to create recurring schedule" },
      { status: 500 }
    );
  }
}

// ─── GET handler ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get("workspaceId");
  if (!workspaceId) {
    return NextResponse.json(
      { error: "workspaceId is required" },
      { status: 400 }
    );
  }

  const membership = await db.workspaceMember.findFirst({
    where: { workspaceId, userId: session.user.id, status: "ACTIVE" },
  });
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const page     = Math.max(1, parseInt(searchParams.get("page")     ?? "1"));
  const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20")));
  const isActive = searchParams.get("isActive");

  const where = {
    workspaceId,
    ...(isActive !== null ? { isActive: isActive === "true" } : {}),
  };

  const [schedules, total] = await Promise.all([
    db.recurringSchedule.findMany({
      where,
      include: {
        templatePost: {
          include: { accounts: { include: { socialAccount: true } } },
        },
        spawnedPosts: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
      orderBy: { createdAt: "desc" },
      skip:  (page - 1) * pageSize,
      take:  pageSize,
    }),
    db.recurringSchedule.count({ where }),
  ]);

  return NextResponse.json({
    data: schedules,
    meta: { total, page, pageSize, hasNext: (page - 1) * pageSize + pageSize < total },
  });
}
```

---

## 6. Edge Cases

### 6a. Publish failure on a spawned post

Spawned posts go through the normal `publishDuePosts` flow with the existing retry logic (up to 3 attempts per `PostAccount`). If the spawned post ultimately fails:

- The `PostAccount` records are marked `FAILED`.
- `reconcilePostStatus` marks the spawned `Post` as `FAILED`.
- **The recurring schedule is not paused** — a single post failure does not affect future recurrences. The schedule advances `nextRunAt` and continues normally.
- A `PublishLog` entry records the failure with platform-level detail.
- An in-app notification (future work) alerts the user that one occurrence failed.

### 6b. Disconnected / expired social account

Handled in `spawnRecurringPost` before cloning:

1. The engine checks `socialAccount.status` for each account linked to the template.
2. If ALL accounts are `DISCONNECTED` or `EXPIRED`, the schedule is paused immediately with `pauseReason = "All linked social accounts are disconnected."`.
3. If SOME accounts are still active, the spawned post is created with only those accounts; the disconnected ones are silently skipped. A `PublishLog` entry notes the skipped accounts.
4. When the user reconnects an account, they should manually resume the schedule via `PATCH /api/recurring-schedules/[id]` with `{ "isActive": true }`. The engine does not auto-resume.

### 6c. Timezone changes

The `RecurringSchedule.timezone` field is respected at every `computeNextRun` call via `cron-parser`'s `tz` option, so the wall-clock time stays constant even across DST transitions. For example, a schedule for "every Monday at 9 AM America/New_York" will fire at 9 AM local time in both EST and EDT automatically.

If the workspace default timezone changes after schedules are created, existing schedules retain their own `timezone` field and are unaffected. Users who want to shift an existing schedule's timezone must `PATCH` it explicitly.

### 6d. Max recurring posts per plan

Enforced at `POST /api/recurring-schedules` creation time:

| Plan     | Limit          | Behavior on breach                      |
|----------|----------------|-----------------------------------------|
| FREE     | 0              | `402` with upgrade prompt               |
| STARTER  | 3 active       | `402 PLAN_LIMIT_REACHED`                |
| PRO      | 20 active      | `402 PLAN_LIMIT_REACHED`                |
| PRO_PLUS | unlimited      | always allowed                          |

Paused (inactive) schedules do NOT count against the limit. This incentivizes pausing over deleting.

### 6e. Template post deleted

The `templatePostId` foreign key is set to `onDelete: Cascade`, so deleting the template post cascades and deletes all associated `RecurringSchedule` rows. Already-spawned posts survive because their `recurringScheduleId` uses `onDelete: SetNull`.

### 6f. Clock skew / cron job misfire

The cron job runs every minute. If a run is delayed (e.g., Vercel cold start), `nextRunAt: { lte: now }` ensures that all overdue schedules are processed in the next available run — no recurrences are permanently skipped.

### 6g. Concurrent cron invocations

If two cron invocations run simultaneously (unlikely but possible), both could attempt to spawn the same schedule. Mitigation: wrap the `recurringSchedule.update` (step 5 of the transaction) with an optimistic check:

```typescript
// Only update if nextRunAt has not already been advanced by another worker:
await tx.recurringSchedule.updateMany({
  where: { id: schedule.id, nextRunAt: schedule.nextRunAt }, // optimistic lock
  data: { lastRunAt: new Date(), nextRunAt },
});
```

If the update affects 0 rows, skip the spawn — another worker already processed it.

---

## 7. User Flow

```
1. User opens the Post Composer.
2. Writes their post content, selects social accounts.
3. Sets a scheduled date/time for the first publication.
4. Toggles "Repeat this post" in the RecurrencePicker.
5. Selects frequency: Daily / Weekly / Monthly / Custom CRON.
6. (Optional) Adjusts the timezone.
7. Clicks "Schedule".
   → Client calls POST /api/posts  (creates template post, status=SCHEDULED)
   → Client calls POST /api/recurring-schedules  (links schedule to post)
8. First occurrence: the cron engine publishes the post at scheduledAt,
   marks it PUBLISHED, then processRecurringSchedules() clones a new
   SCHEDULED post for the next occurrence and advances nextRunAt.
9. User can view all recurring schedules in Settings > Recurring Posts,
   where they can edit cadence, pause, or delete the schedule.
10. Each published occurrence appears in the standard Posts feed, linked
    back to the schedule for traceability.
```

---

## 8. Migration

```sql
-- Migration: add recurring_frequency enum and recurring_schedules table

CREATE TYPE "RecurringFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM');

CREATE TABLE "recurring_schedules" (
  "id"              TEXT NOT NULL PRIMARY KEY,
  "workspaceId"     TEXT NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "templatePostId"  TEXT NOT NULL REFERENCES "posts"("id") ON DELETE CASCADE,
  "frequency"       "RecurringFrequency" NOT NULL,
  "cronExpression"  TEXT NOT NULL,
  "timezone"        TEXT NOT NULL DEFAULT 'UTC',
  "nextRunAt"       TIMESTAMP(3) NOT NULL,
  "lastRunAt"       TIMESTAMP(3),
  "isActive"        BOOLEAN NOT NULL DEFAULT true,
  "failureCount"    INT NOT NULL DEFAULT 0,
  "pausedAt"        TIMESTAMP(3),
  "pauseReason"     TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL
);

CREATE INDEX "recurring_schedules_workspaceId_isActive_idx"
  ON "recurring_schedules"("workspaceId", "isActive");
CREATE INDEX "recurring_schedules_nextRunAt_isActive_idx"
  ON "recurring_schedules"("nextRunAt", "isActive");

-- Add back-reference columns to posts
ALTER TABLE "posts"
  ADD COLUMN "recurringScheduleId" TEXT REFERENCES "recurring_schedules"("id") ON DELETE SET NULL;
```

---

## 9. Dependencies

| Package        | Purpose                                      |
|----------------|----------------------------------------------|
| `cron-parser`  | Parse and advance CRON expressions with TZ   |

Install: `npm install cron-parser`

`cron-parser` is already a common dependency in Next.js scheduling setups. It handles all DST-aware next-run computation and validates custom expressions server-side.

---

## 10. Future Enhancements

- **End date / max occurrences** — auto-deactivate the schedule after N runs or after a given date.
- **Per-occurrence content variation** — rotate through a content list rather than repeating verbatim.
- **Analytics rollup** — aggregate engagement across all occurrences of a recurring post.
- **In-app + email notifications** — notify users when a recurrence is auto-paused or when an occurrence fails to publish.
- **Approval workflow for recurring posts** — optionally require human approval before each cloned post goes live.
