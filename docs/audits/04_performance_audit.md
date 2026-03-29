# Performance Audit

**Date:** 2026-03-29
**Scope:** Next.js rendering strategy, bundle size, image optimization, Suspense boundaries

---

## Top 5 Highest-Impact Performance Fixes

### 1. No `dynamic()` imports for Recharts — ships on every page load
**File:** `src/components/analytics/metrics-chart.tsx:1–15`

Recharts is statically imported at the top of `metrics-chart.tsx`. Recharts + D3 is ~300 KB minified. It is only used on the Analytics route yet it gets bundled into the shared chunk because there is no code-splitting boundary. Fix: dynamic import with `ssr: false` (see examples below).

**Estimated saving:** ~280–320 KB removed from initial JS for all non-analytics routes.

---

### 2. No `dynamic()` imports for Tiptap editor — ships on every page load
**File:** `src/components/posts/post-composer.tsx` (imports `@tiptap/react`, `@tiptap/starter-kit`, etc.)

The full Tiptap bundle (react + starter-kit + extensions + ProseMirror) is ~250 KB minified. The composer is only rendered on `/compose`, but without a dynamic import boundary the modules are loaded eagerly. Fix: wrap `PostComposer` in a `dynamic()` import at the page level (see examples below).

**Estimated saving:** ~240–260 KB removed from all non-compose routes.

---

### 3. `analytics/page.tsx` renders `<AnalyticsDashboard>` with no Suspense boundary
**File:** `src/app/(app)/analytics/page.tsx:53–60`

The page does a DB query then passes the result directly into `<AnalyticsDashboard>`. If the dashboard component itself triggers further async work (client-side fetches, deferred data), there is no Suspense fallback — the user sees a blank region until it resolves. Add a `<Suspense>` wrapper with a skeleton fallback around the dashboard component to enable streaming.

---

### 4. `settings/billing/page.tsx`, `settings/notifications/page.tsx`, `settings/profile/page.tsx`, `settings/api/page.tsx` are full-page `"use client"` files
**Files:**
- `src/app/(app)/settings/billing/page.tsx:1`
- `src/app/(app)/settings/notifications/page.tsx:1`
- `src/app/(app)/settings/profile/page.tsx:1`
- `src/app/(app)/settings/api/page.tsx:1`

Marking an entire page as `"use client"` opts every import on that page out of server-side rendering, increases client JS, and prevents React Server Component data-fetching benefits. The static shell (headings, layout, labels) should be a server component; only the interactive form/state parts need `"use client"`. Extract interactive widgets into leaf client components; keep the page file as a server component.

---

### 5. Eight raw `<img>` tags in `post-preview.tsx` — no optimization
**File:** `src/components/posts/post-preview.tsx:55,76,111,130,161,174,219,245`

Raw `<img>` tags bypass Next.js Image Optimization (no WebP/AVIF conversion, no lazy loading, no `sizes` hints, no blur placeholder). Avatar and media preview images are loaded at full resolution on every render. Replace with `next/image`; for user-supplied external URLs add the relevant `remotePatterns` to `next.config`.

---

## Missing `loading.tsx` Files

Zero `loading.tsx` files exist anywhere under `src/app/`. All of the following route segments lack a streaming skeleton, so users see nothing (or are blocked) during navigation:

| Route segment | Path |
|---|---|
| `(app)` layout | `src/app/(app)/` |
| `dashboard` | `src/app/(app)/dashboard/` |
| `analytics` | `src/app/(app)/analytics/` |
| `compose` | `src/app/(app)/compose/` |
| `calendar` | `src/app/(app)/calendar/` |
| `queue` | `src/app/(app)/queue/` |
| `inbox` | `src/app/(app)/inbox/` |
| `media` | `src/app/(app)/media/` |
| `drafts` | `src/app/(app)/drafts/` |
| `labels` | `src/app/(app)/labels/` |
| `campaigns` | `src/app/(app)/campaigns/` |
| `campaigns/[id]` | `src/app/(app)/campaigns/[id]/` |
| `approvals` | `src/app/(app)/approvals/` |
| `ai-studio` | `src/app/(app)/ai-studio/` |
| `schedule/bulk` | `src/app/(app)/schedule/bulk/` |
| `settings` | `src/app/(app)/settings/` |
| `settings/accounts` | `src/app/(app)/settings/accounts/` |
| `settings/billing` | `src/app/(app)/settings/billing/` |
| `settings/notifications` | `src/app/(app)/settings/notifications/` |
| `settings/profile` | `src/app/(app)/settings/profile/` |
| `settings/team` | `src/app/(app)/settings/team/` |
| `settings/workspace` | `src/app/(app)/settings/workspace/` |
| `settings/api` | `src/app/(app)/settings/api/` |
| `settings/mcp` | `src/app/(app)/settings/mcp/` |
| `admin` | `src/app/(app)/admin/` |
| `admin/users` | `src/app/(app)/admin/users/` |
| `admin/workspaces` | `src/app/(app)/admin/workspaces/` |
| `admin/subscriptions` | `src/app/(app)/admin/subscriptions/` |

Minimum recommendation: add `loading.tsx` to `dashboard`, `analytics`, `compose`, and `queue` — the four highest-traffic routes.

---

## Dynamic Import Examples

### Recharts (`metrics-chart.tsx`)

```tsx
// src/components/analytics/metrics-chart.tsx
// Replace the static recharts imports with:

import dynamic from "next/dynamic";

// Move all recharts JSX into a separate file, e.g. metrics-chart-inner.tsx,
// then re-export via dynamic:
const MetricsChartInner = dynamic(
  () => import("./metrics-chart-inner"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-64 items-center justify-center rounded-xl border border-border bg-card">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    ),
  }
);

export { MetricsChartInner as MetricsChart };
```

### Tiptap editor (`compose/page.tsx`)

```tsx
// src/app/(app)/compose/page.tsx
// Replace the direct PostComposer import with:

import dynamic from "next/dynamic";

const PostComposer = dynamic(
  () => import("@/components/posts/post-composer").then((m) => m.PostComposer),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    ),
  }
);
```

---

## Server Component Conversion Opportunities

| File | Current | Recommended |
|---|---|---|
| `settings/billing/page.tsx` | Full `"use client"` page | Server page shell + `<BillingClient>` leaf component |
| `settings/notifications/page.tsx` | Full `"use client"` page | Server page shell + `<NotificationsForm>` leaf component |
| `settings/profile/page.tsx` | Full `"use client"` page | Server page shell (fetch current profile via db/auth) + `<ProfileForm>` leaf |
| `settings/api/page.tsx` | Full `"use client"` page | Server page shell + `<ApiKeysClient>` leaf |
| `dashboard/page.tsx` | Already a server component ✓ | `DashboardPage` has duplicate auth+DB call that duplicates `(app)/layout.tsx` — pass `workspaceId` via props or use a shared server context to eliminate the redundant query |

The `(app)/layout.tsx` is a well-structured server component doing auth + workspace resolution. The duplicated `workspaceMember.findFirst` in `dashboard/page.tsx:437–446` is the most immediate waste — the layout already resolved this. Consider passing `workspaceId` through a React Server Context or a slot prop to avoid the extra round-trip on every dashboard render.
