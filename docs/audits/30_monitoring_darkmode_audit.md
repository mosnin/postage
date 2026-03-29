# Audit 30: Monitoring & Observability + Dark Mode Support

**Date:** 2026-03-29
**App:** PostSyncer (`/home/user/postage`)
**Branch:** `claude/setup-saas-submodule-ENxHk`

---

## AUDIT A: Monitoring & Observability

### 1. Current State of Logging

PostSyncer currently has **no structured logging, no error-tracking SDK, and no performance monitoring**. What exists is minimal and ad-hoc:

| Location | What exists |
|---|---|
| `src/lib/db.ts` | Prisma `log: ["query","error","warn"]` in dev only |
| `src/app/api/cron/publish/route.ts` | `console.log` + `console.error` on cron start/finish |
| `src/lib/email/resend.ts` | `console.error` on send failures |
| `src/lib/mcp/server.ts` | `console.error` on tool call errors |
| API routes (most) | `console.error("[route]", error)` in catch blocks |

**Key gaps:**

- No Sentry or equivalent — unhandled errors in edge functions, React boundaries, and background jobs produce no alerts
- No structured log fields — all logs are free-form strings, unsearchable in production
- No performance tracing — slow DB queries, slow AI calls (OpenAI gpt-4o), and slow publish runs are invisible
- No uptime monitoring endpoint — the System Health card in `/admin` shows static "operational" strings, not live data
- No alerting — a 100% publish failure rate would go unnoticed until a user reports it

---

### 2. Error Tracking: Sentry Integration

**Recommended package:** `@sentry/nextjs` (official Next.js SDK, supports App Router, edge runtime, and server components)

**Installation:**

```bash
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs --saas
```

The wizard generates three config files. Below are the recommended contents for PostSyncer.

#### `sentry.client.config.ts`

```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,

  // Capture 10% of transactions in production, 100% in dev
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Replay 1% of sessions normally, 100% on errors
  replaysSessionSampleRate: 0.01,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,       // GDPR: mask PII in replays
      blockAllMedia: false,
    }),
    Sentry.browserTracingIntegration(),
  ],

  // Filter out noise
  ignoreErrors: [
    "ResizeObserver loop limit exceeded",
    "Non-Error promise rejection captured",
  ],

  beforeSend(event) {
    // Strip auth tokens from breadcrumbs
    if (event.request?.headers) {
      delete event.request.headers["Authorization"];
      delete event.request.headers["Cookie"];
    }
    return event;
  },
});
```

#### `sentry.server.config.ts`

```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,

  integrations: [
    // Capture all console.error calls as breadcrumbs
    Sentry.consoleIntegration({ levels: ["error", "warn"] }),
    // Trace Prisma queries (great for slow query detection)
    Sentry.prismaIntegration(),
  ],

  // Tag every event with the deploy URL for easy environment filtering
  initialScope: {
    tags: {
      "vercel.url": process.env.VERCEL_URL ?? "local",
      "vercel.env": process.env.VERCEL_ENV ?? "development",
    },
  },
});
```

#### `sentry.edge.config.ts`

```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});
```

#### `instrumentation.ts` (Next.js App Router entry point)

Place at `src/instrumentation.ts` (or project root, per `next.config.ts` `instrumentationHook`):

```typescript
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}
```

Enable in `next.config.ts`:

```typescript
const nextConfig: NextConfig = {
  experimental: {
    instrumentationHook: true,          // enables instrumentation.ts
    serverComponentsExternalPackages: ["@prisma/client"],
  },
  // ...existing image config...
};
```

**Required environment variables:**

```
SENTRY_DSN=https://<key>@o<org>.ingest.sentry.io/<project>
NEXT_PUBLIC_SENTRY_DSN=https://<key>@o<org>.ingest.sentry.io/<project>
SENTRY_ORG=postsyncer
SENTRY_PROJECT=postsyncer-nextjs
SENTRY_AUTH_TOKEN=<token>    # for source map uploads at build time
```

---

### 3. Application Logging: Pino (Recommended over Axiom standalone)

**Recommended stack:** Pino + `pino-pretty` (dev) + Axiom transport (production)

Pino is chosen over plain Axiom because it works in both Edge and Node runtimes, is the fastest Node.js logger, and can be shipped to any backend via transports (Axiom, Datadog, Loki).

**Installation:**

```bash
npm install pino pino-pretty @axiomhq/pino
```

#### `src/lib/logger.ts`

```typescript
import pino from "pino";

const isDev = process.env.NODE_ENV === "development";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
  base: {
    env: process.env.NODE_ENV,
    app: "postsyncer",
  },
  transport: isDev
    ? { target: "pino-pretty", options: { colorize: true } }
    : process.env.AXIOM_TOKEN
    ? {
        target: "@axiomhq/pino",
        options: {
          dataset: process.env.AXIOM_DATASET ?? "postsyncer-prod",
          token: process.env.AXIOM_TOKEN,
        },
      }
    : undefined,   // falls back to stdout JSON (useful for non-Axiom infra)
});
```

**Usage pattern for API routes:**

```typescript
import { logger } from "@/lib/logger";

// Structured fields — searchable in Axiom
logger.info({ workspaceId, platform, postId }, "publish.attempt");
logger.error({ err, postId, platform }, "publish.failed");
```

**Replace all `console.error("[cron/publish]", ...)` calls** with `logger.error({ err }, "cron.publish.error")`.

**Required environment variables:**

```
AXIOM_TOKEN=xaat-...
AXIOM_DATASET=postsyncer-prod
```

---

### 4. Performance Monitoring: Vercel Analytics + Custom Metrics

**Recommended packages:**

```bash
npm install @vercel/analytics @vercel/speed-insights
```

#### Add to `src/components/providers.tsx`

```typescript
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

// Inside the returned JSX:
<>
  {children}
  <Toaster />
  <Analytics />
  <SpeedInsights />
</>
```

**What Vercel Analytics gives you:**

- Real User Monitoring (RUM): LCP, CLS, FID, TTFB per route
- Audience breakdown by country, device, browser
- Zero sampling — every pageview is counted on paid plans

**What SpeedInsights adds:**

- Core Web Vitals score per deployment
- Regression alerts when a deploy degrades performance

**Custom client-side metrics** — track product-specific events:

```typescript
import { track } from "@vercel/analytics";

// In post-composer after successful schedule:
track("post_scheduled", { platform, workspaceId });

// In AI caption generator after generation:
track("ai_credits_consumed", { feature: "caption", credits: 5, workspaceId });
```

---

### 5. What to Monitor (Uptime & Health)

#### Endpoints to monitor externally (e.g., Better Uptime, Checkly, or UptimeRobot)

| Endpoint | Check type | Expected | Alert threshold |
|---|---|---|---|
| `GET /api/health` | HTTP 200 | `{"ok":true}` | Any non-200 |
| `GET /api/cron/publish` | Must NOT be externally reachable without `Authorization: Bearer <secret>` | 401 | If 200 without auth header |
| `POST /api/billing/webhook` | Stripe-driven, passive | — | Monitor Stripe dashboard |

**Create `src/app/api/health/route.ts`:**

```typescript
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const start = Date.now();
  try {
    // Lightweight DB liveness check
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({
      ok: true,
      db: "up",
      latencyMs: Date.now() - start,
      ts: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, db: "down", error: String(err) },
      { status: 503 }
    );
  }
}
```

#### Internal metrics to store in DB / track

| Metric | How to capture | Table/field |
|---|---|---|
| Publish success rate | Already logged in `PublishLog` | `status = "success"\|"failure"` |
| Cron run completion | Log cron result duration + success/failure count | New `CronRun` table or Axiom event |
| AI credit usage | Already in `WorkspaceSettings.aiCreditsUsed` | Query per workspace |
| API key usage | `ApiKey.lastUsedAt` updated on each use | Existing field |
| Auth errors | Sentry exception count | Sentry dashboard |

---

### 6. Alerting Rules

Configure these in Sentry's **Alert Rules** + external uptime monitor notifications:

| Rule | Condition | Channel |
|---|---|---|
| High publish failure rate | `PublishLog` failures / total > 5% in any 10-minute window | Slack #ops + email |
| Cron job missing | No cron run recorded in the last 3 minutes (cron is every 1m) | Slack #ops |
| API error spike | HTTP 5xx rate > 1% of requests (Sentry issues-based alert) | Slack #ops |
| DB connection failure | `GET /api/health` returns 503 | PagerDuty / SMS |
| Unhandled exception | New Sentry issue with `level: error` | Slack #errors |
| AI credits exhausted | `aiCreditsUsed >= aiCreditsLimit` for a workspace | Email to workspace owner |
| Past-due subscriptions > 5 | Query `subscription.status = PAST_DUE` count | Weekly email to admin |

**Sentry alert example (Sentry UI config):**

```
Alert name: "High error rate — API"
Environment: production
Conditions: Number of events > 50 in 10 minutes
Filter: level:error
Action: Notify Slack #errors
```

---

### 7. Internal Health Dashboard

The existing `/admin` page at `src/app/(app)/admin/page.tsx` already has a **System Health card**, but it shows hardcoded static strings ("operational"). It should pull live data.

**Enhanced `/api/admin/health` route** to power a real health panel:

```typescript
// src/app/api/admin/health/route.ts
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { subMinutes } from "date-fns";

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [
    dbPing,
    recentPublishLogs,
    cronLastRun,
    pendingPosts,
  ] = await Promise.all([
    db.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
    db.publishLog.findMany({
      where: { createdAt: { gte: subMinutes(new Date(), 60) } },
      select: { status: true },
    }),
    db.publishLog.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    db.post.count({ where: { status: "SCHEDULED", scheduledAt: { lte: new Date() } } }),
  ]);

  const total = recentPublishLogs.length;
  const failed = recentPublishLogs.filter(l => l.status === "failure").length;
  const failureRate = total > 0 ? (failed / total) * 100 : 0;

  return NextResponse.json({
    db: dbPing ? "up" : "down",
    publishFailureRate1h: failureRate.toFixed(1),
    lastPublishAt: cronLastRun?.createdAt ?? null,
    stuckPosts: pendingPosts,
  });
}
```

**Dashboard additions to `AdminPage`:**

- Replace static health rows with data from `/api/admin/health`
- Show `publishFailureRate1h` with a red badge when > 5%
- Show `stuckPosts` count — posts that are scheduled and overdue
- Show `lastPublishAt` with a warning if it's more than 3 minutes ago

---

### 8. Custom Metrics: AI Credits, Publish Success, API Key Usage

These metrics are already partially tracked in the database. The gaps are in surfacing them.

#### AI Credit Usage

```typescript
// Already incremented in each AI route:
//   data: { aiCreditsUsed: { increment: CREDIT_COST } }
//
// Add structured logging:
logger.info({
  event: "ai.credits.consumed",
  workspaceId,
  feature: "caption_generation",
  credits: CREDIT_COST,
  creditsRemaining: settings.aiCreditsLimit - (settings.aiCreditsUsed + CREDIT_COST),
}, "AI credits consumed");
```

#### Publish Success / Failure

```typescript
// In publish-engine.ts, after WritePublishLog:
logger.info({
  event: "post.published",
  postId: post.id,
  platform,
  success: result.success,
  durationMs: Date.now() - startedAt,
  authExpired: result.authExpired ?? false,
}, result.success ? "post.published" : "post.publish_failed");
```

#### API Key Usage

```typescript
// In src/lib/api/auth.ts (where API key auth is validated), add:
await db.apiKey.update({
  where: { id: apiKey.id },
  data: { lastUsedAt: new Date() },
});
logger.info({ event: "api_key.used", keyId: apiKey.id, workspaceId, scope }, "api_key.used");
```

---

## AUDIT B: Dark Mode Support

### 1. CSS Variables — Status: Complete

`src/app/globals.css` has a **complete, well-structured CSS variable system** for both light and dark themes using Tailwind's CSS variable convention:

- `:root` defines all 14 semantic tokens (background, foreground, card, primary, secondary, muted, accent, destructive, border, input, ring, radius)
- `.dark` class overrides all 14 tokens with appropriate dark-mode values
- `body` uses `bg-background text-foreground` — fully adaptive

**No changes needed to `globals.css`.**

---

### 2. Missing Dark Mode Toggle — Critical Gap

There is **no `ThemeProvider`, no `ThemeToggle` component, and no `next-themes` integration** anywhere in the codebase.

The `<html>` element in `src/app/layout.tsx` has `suppressHydrationWarning` (correctly added for next-themes), but there is no `ThemeProvider` wrapping `<html>`. The `.dark` class is never applied.

**Result:** Dark mode CSS variables are fully defined but completely non-functional. The app will always render in light mode regardless of system preference.

---

### 3. Is `next-themes` Installed?

```bash
# Not found in package.json dependencies or devDependencies
```

`next-themes` is **not installed**. It must be added.

```bash
npm install next-themes
```

---

### 4. Components with Hardcoded Colors That Won't Adapt to Dark Mode

The following components use Tailwind color utilities that do not reference CSS variables and will remain light-mode styled even when `.dark` is applied:

#### High Priority (status badges visible on every page)

| File | Hardcoded classes | Issue |
|---|---|---|
| `src/components/posts/posts-list.tsx:39` | `bg-gray-100 text-gray-700 border-gray-200` | DRAFT status badge |
| `src/components/posts/posts-list.tsx:48` | `bg-gray-100 text-gray-500 border-gray-200` | CANCELLED status badge |
| `src/components/posts/approval-status-badge.tsx:20` | `bg-gray-50 text-gray-500 border-gray-200` | NOT_REQUIRED status |
| `src/components/campaigns/campaign-card.tsx:40` | `bg-gray-100 text-gray-600 border-gray-200` | Draft campaign badge |
| `src/components/campaigns/campaign-detail.tsx:52` | `bg-gray-100 text-gray-600 border-gray-200` | Completed status |
| `src/components/calendar/calendar-post-card.tsx:33` | `bg-gray-400` | Fallback platform color |

#### Medium Priority (admin panel)

| File | Hardcoded classes | Issue |
|---|---|---|
| `src/components/admin/users-table.tsx` | Various `bg-gray-*` | User role/status cells |
| `src/components/admin/workspace-table.tsx` | Various `bg-gray-*` | Plan badges |
| `src/components/ui/status-badge.tsx:25` | `bg-gray-100 text-gray-700` | Already has `dark:` variants — OK |
| `src/components/team/role-badge.tsx:32` | `bg-gray-100 text-gray-700` | Already has `dark:` variants — OK |

#### Overlay backgrounds (intentionally opaque — acceptable)

| File | Classes | Notes |
|---|---|---|
| `src/components/ui/dialog.tsx:20` | `bg-black/80` | Modal overlay — fine in dark mode |
| `src/components/posts/post-composer.tsx:362` | `bg-black/60 text-white` | Image delete button overlay — fine |
| `src/components/media/media-item.tsx` | `bg-black/50`, `bg-white/20` | Hover overlay on image thumbnails — fine |

#### Fix pattern for status badge hardcoded grays:

```typescript
// Before:
className: "bg-gray-100 text-gray-700 border-gray-200"

// After (use semantic Tailwind + dark variant):
className: "bg-muted text-muted-foreground border-border"
// or, if you need explicit gray scale:
className: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700"
```

---

### 5. Dark Mode in Emails

Emails sent via Resend (`src/lib/email/resend.ts`) use HTML templates. These are rendered by email clients and are **outside the scope of next-themes**. They require a separate approach:

- Add `@media (prefers-color-scheme: dark)` CSS blocks inside `<style>` tags in each email template
- Use inline styles as a fallback (most email clients ignore external stylesheets)
- Test with [Litmus](https://litmus.com/) or [Email on Acid](https://www.emailonacid.com/)

Example snippet for email templates:

```html
<style>
  @media (prefers-color-scheme: dark) {
    body { background-color: #0f172a !important; color: #f8fafc !important; }
    .email-container { background-color: #1e293b !important; }
    .email-button { background-color: #6d28d9 !important; }
  }
</style>
```

---

### 6. System Preference Detection

`next-themes` detects `prefers-color-scheme` via the `systemTheme` value when `enableSystem={true}` is passed. The user's OS preference is automatically honored on first load with no flash (because `next-themes` injects a blocking inline script that sets the class before hydration).

---

### 7. Dark Mode Persistence (localStorage)

`next-themes` persists the user's chosen theme in `localStorage` by default under the key `"theme"`. The value is `"light"`, `"dark"`, or `"system"`.

- On page load, next-themes reads localStorage and applies the correct class before React hydrates — no FOUC
- If the stored value is `"system"`, the OS `prefers-color-scheme` media query is used
- The `suppressHydrationWarning` on `<html>` (already present in `layout.tsx`) prevents the React mismatch warning from the class injection

---

### 8. Implementation Plan

#### Step 1 — Install next-themes

```bash
npm install next-themes
```

#### Step 2 — Update `src/components/providers.tsx`

```typescript
"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";
import { Toaster } from "@/components/ui/toaster";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <ThemeProvider
      attribute="class"          // applies "dark" class to <html>
      defaultTheme="system"      // respect OS preference by default
      enableSystem               // read prefers-color-scheme
      disableTransitionOnChange  // prevents flash during theme switch
    >
      <SessionProvider>
        <QueryClientProvider client={queryClient}>
          {children}
          <Toaster />
          {process.env.NODE_ENV === "development" && <ReactQueryDevtools />}
        </QueryClientProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}
```

#### Step 3 — Create `src/components/ui/theme-toggle.tsx`

```typescript
"use client";

import * as React from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ThemeToggle() {
  const { setTheme, theme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label="Toggle theme"
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => setTheme("light")}
          className="flex items-center gap-2"
        >
          <Sun className="h-4 w-4" />
          Light
          {theme === "light" && <span className="ml-auto text-primary">✓</span>}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("dark")}
          className="flex items-center gap-2"
        >
          <Moon className="h-4 w-4" />
          Dark
          {theme === "dark" && <span className="ml-auto text-primary">✓</span>}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("system")}
          className="flex items-center gap-2"
        >
          <Monitor className="h-4 w-4" />
          System
          {theme === "system" && <span className="ml-auto text-primary">✓</span>}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

#### Step 4 — Add `ThemeToggle` to `AppHeader`

In `src/components/layout/app-header.tsx`, import and add `<ThemeToggle />` next to the notifications button:

```typescript
import { ThemeToggle } from "@/components/ui/theme-toggle";

// Inside the right-side actions div, after the Bell button:
<ThemeToggle />
```

#### Step 5 — Fix hardcoded gray status badge colors

In `src/components/posts/posts-list.tsx`, update the status map to use semantic tokens:

```typescript
DRAFT: {
  label: "Draft",
  className: "bg-muted text-muted-foreground border-border",
},
CANCELLED: {
  label: "Cancelled",
  className: "bg-muted text-muted-foreground border-border",
},
```

Apply the same pattern to `approval-status-badge.tsx`, `campaign-card.tsx`, `campaign-detail.tsx`, and `calendar-post-card.tsx`.

---

## Summary of Required Actions

### Monitoring (Priority Order)

1. **[P0] Create `/api/health` endpoint** — required by uptime monitors
2. **[P0] Install `@sentry/nextjs`** and add `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`, and update `instrumentation.ts` and `next.config.ts`
3. **[P0] Add `SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN` env vars** to Vercel project
4. **[P1] Add `pino` + Axiom transport** and create `src/lib/logger.ts`; replace all `console.error` calls in API routes and lib files with structured logger calls
5. **[P1] Install `@vercel/analytics` + `@vercel/speed-insights`** and add to `providers.tsx`
6. **[P1] Enhance `/admin` health card** to consume live data from `/api/admin/health`
7. **[P2] Configure Sentry alert rules** for error rate spikes and publish failure rate
8. **[P2] Configure external uptime monitor** (Better Uptime / UptimeRobot) pointing at `/api/health`
9. **[P2] Add structured logging** to `publish-engine.ts` and AI credit consumption routes

### Dark Mode (Priority Order)

1. **[P0] `npm install next-themes`**
2. **[P0] Wrap providers with `ThemeProvider`** in `src/components/providers.tsx`
3. **[P0] Create `ThemeToggle` component** and add to `AppHeader`
4. **[P1] Fix hardcoded gray classes** in `posts-list.tsx`, `approval-status-badge.tsx`, `campaign-card.tsx`, `campaign-detail.tsx`, `calendar-post-card.tsx`
5. **[P2] Add dark mode CSS** to Resend email templates

### Environment Variables to Add

```bash
# Sentry
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_ORG=
SENTRY_PROJECT=
SENTRY_AUTH_TOKEN=

# Logging / Axiom
AXIOM_TOKEN=
AXIOM_DATASET=postsyncer-prod
LOG_LEVEL=info
```
