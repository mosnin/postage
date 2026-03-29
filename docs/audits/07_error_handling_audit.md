# Error Handling Audit — PostSyncer

**Date:** 2026-03-29
**Auditor:** Claude Code
**Scope:** `src/app/` routes, `src/components/`, `src/lib/`

---

## Executive Summary

The codebase has a solid foundation for error handling — Zod validation on API inputs, TanStack Query with per-component loading/error states, a global `<Toaster />`, and `useToast` in key components. However, there are significant gaps across all twelve audit categories. The most critical issues are: **zero `error.tsx` / `loading.tsx` / `not-found.tsx` files** in any route segment, **missing `try/catch` wrappers** around un-wrapped DB calls in several API routes, **silent mutation failures** in high-value components (`DraftsList`, `LabelsManger`, `MediaLibrary`, `CampaignsDashboard`, `InviteMemberForm`, `TeamMembersList`, `WorkspaceSettingsForm`, `CommentReplyForm`), and **no global error boundary** in the client tree.

---

## 1. Missing `error.tsx` Files

Next.js App Router uses co-located `error.tsx` files to catch and display unhandled errors thrown by Server Components and route handlers. **None exist anywhere in this project.**

### Files That Must Be Created

| Route Segment | File to Create |
|---|---|
| App root | `src/app/error.tsx` |
| `(app)` group | `src/app/(app)/error.tsx` |
| `(auth)` group | `src/app/(auth)/error.tsx` |
| `(marketing)` group | `src/app/(marketing)/error.tsx` |
| `(app)/settings` | `src/app/(app)/settings/error.tsx` |
| `(app)/admin` | `src/app/(app)/admin/error.tsx` |
| `(app)/campaigns/[id]` | `src/app/(app)/campaigns/[id]/error.tsx` |

**Impact:** Any unhandled exception thrown during server-side rendering (e.g., a database failure, a misconfigured environment variable, or an unexpected Prisma error) will crash the entire page with a generic Next.js 500 screen and provide no recovery path for the user.

---

## 2. Missing `loading.tsx` Files

`loading.tsx` files create instant loading UI using React Suspense. No route segment has one.

### Files That Must Be Created

| Route Segment | Reason |
|---|---|
| `src/app/(app)/loading.tsx` | App shell loads DB data for sidebar + header on every request |
| `src/app/(app)/dashboard/loading.tsx` | `DashboardStats` and `RecentPostsSection` are async server components wrapped in `<Suspense>` but there is no route-level fallback |
| `src/app/(app)/analytics/loading.tsx` | `AnalyticsDashboard` depends on `AnalyticsResponse` from a slow query |
| `src/app/(app)/inbox/loading.tsx` | Inbox counts and social account list are server-fetched |
| `src/app/(app)/campaigns/[id]/loading.tsx` | Detail page triggers a campaign DB query on every navigation |
| `src/app/(app)/settings/loading.tsx` | Settings layout fetches workspace membership |

**Note:** Several pages (`DraftsList`, `QueueManager`, `AccountsList`, `CampaignsDashboard`) are pure client components that fetch data via TanStack Query and show their own skeleton states correctly. Route-level `loading.tsx` is still valuable for the initial SSR waterfall.

---

## 3. Missing `not-found.tsx` Files

`notFound()` is called in `src/app/(app)/campaigns/[id]/page.tsx` when a campaign is not found, but there is no matching `not-found.tsx` to render a user-friendly page.

### Files That Must Be Created

| Route Segment | File |
|---|---|
| App root | `src/app/not-found.tsx` |
| `(app)/campaigns/[id]` | `src/app/(app)/campaigns/[id]/not-found.tsx` |

**Impact:** Without these files Next.js renders its default 404 page, which is unstyled and off-brand.

---

## 4. API Routes Missing `try/catch` Around DB Calls

Most API routes use a `try/catch` pattern for the critical mutation path. However, several routes make direct DB calls outside any error boundary.

### Routes with No Top-Level `try/catch`

| File | Affected Handler | Risk |
|---|---|---|
| `src/app/api/inbox/route.ts` | `GET` | Prisma errors on `comment.findMany` / `comment.count` are unhandled and will produce an unformatted 500 response |
| `src/app/api/posts/[id]/approve/route.ts` | `POST` | The `db.post.update()` and `db.activityLog.create()` calls after the `try/catch` block are not wrapped — any Prisma exception after approval logic runs will return a crash |
| `src/app/api/posts/[id]/reject/route.ts` | `POST` | Same pattern — `db.post.update()` and `db.activityLog.create()` after the body-parsing `try/catch` are unguarded |
| `src/app/api/posts/[id]/request-changes/route.ts` | `POST` | Same pattern as approve/reject |
| `src/app/api/posts/[id]/publish/route.ts` | `POST` | The entire publish loop (`publishToAccount`, `db.postAccount.update`, `db.publishLog.create`) has no `try/catch` — a transient DB error will throw uncaught |
| `src/app/api/analytics/route.ts` | `GET` | All DB queries are outside any `try/catch` — a Prisma error propagates as a 500 with no `{ error }` JSON body |
| `src/app/api/campaigns/route.ts` | `GET` | `db.campaign.findMany()` is unguarded |
| `src/app/api/accounts/route.ts` | `GET` | `db.socialAccount.findMany()` is unguarded |

**Best Practice:** Wrap the entire handler body (or at minimum the DB fan-out section) in `try/catch` and return `NextResponse.json({ error: "Internal server error" }, { status: 500 })`.

---

## 5. Missing Error Boundaries Around Client Components

There is no `ErrorBoundary` component in the codebase and the `Providers` tree in `src/components/providers.tsx` does not include one. Any unhandled JavaScript exception inside a client component (e.g., a `JSON.parse` failure, a null-dereference on unexpected API data shape) will crash the entire React tree.

### Critical Gaps

- `src/components/providers.tsx` — No error boundary wrapping the application tree.
- `src/app/(app)/layout.tsx` — The main `<main>` content area has no error boundary. A single page crash takes down the sidebar/header too.
- `src/app/(app)/analytics/page.tsx` — `AnalyticsDashboard` renders complex chart components. There is no boundary to isolate a charting library crash.
- `src/app/(app)/inbox/page.tsx` — `InboxFeed` uses `useInfiniteQuery` which surfaces errors inline, but the outer render tree is unprotected.

### Recommendation

Create `src/components/error-boundary.tsx` as a reusable class-based React error boundary and wrap critical subtrees:
- `(app)/layout.tsx` — wrap `{children}`
- `providers.tsx` — wrap the entire app tree as a last-resort catcher

---

## 6. Unhandled Promise Rejections

### Silently Swallowed Errors

| File | Line(s) | Issue |
|---|---|---|
| `src/components/inbox/comment-reply-form.tsx` | `handleAiSuggest` catch block | AI suggestion failure is caught and swallowed with a comment `// silently fail — user can type manually`. No feedback is shown to the user that AI failed — they may wait indefinitely or assume it is loading. |
| `src/app/api/posts/[id]/approve/route.ts` | Line 118 | `sendApprovalDecisionEmail(...).catch(console.error)` — email failures are logged but not surfaced. Acceptable for email, but worth noting that authors receive no fallback notification. |
| `src/app/api/posts/[id]/reject/route.ts` | Line 119 | Same as above. |
| `src/app/api/posts/[id]/request-changes/route.ts` | Line 119 | Same as above. |

### Missing `onError` in Mutations (No User Feedback)

These `useMutation` calls throw errors correctly but have **no `onError` callback**, so failures silently fail:

| File | Mutation | Missing Feedback |
|---|---|---|
| `src/components/posts/drafts-list.tsx` | `deleteMutation` | Delete failure shows no toast or inline error |
| `src/components/labels/labels-manager.tsx` | `createMutation`, `updateMutation`, `deleteMutation` | All three label mutations have no `onError` — label CRUD failures are silent |
| `src/components/media/media-library.tsx` | `deleteMutation`, `bulkDeleteMutation` | Media deletion failure produces no feedback |
| `src/components/campaigns/campaigns-dashboard.tsx` | `createMutation` | Campaign creation failure is silent |
| `src/components/team/invite-member-form.tsx` | `sendInvite` mutation | Invite failures throw correctly but `onError` is absent — the dialog stays open but no error message appears |
| `src/components/team/team-members-list.tsx` | `updateRole`, `updateStatus`, `removeMember`, `resendInvite` | All four team mutations lack `onError` — role changes and removals fail silently |
| `src/components/team/workspace-settings-form.tsx` | `saveSettings`, `deleteWorkspace` | Workspace save/delete failures are silent |
| `src/components/inbox/comment-reply-form.tsx` | `sendReply` | Reply send failure has no `onError` |

---

## 7. Missing Loading States in Components

### Components with No Loading UI

| File | Issue |
|---|---|
| `src/components/team/team-members-list.tsx` | `isLoading` is checked and skeletons render, but `isError` is never checked — if the member fetch fails, the component renders an empty list with no error message |
| `src/components/labels/labels-manager.tsx` | Loading spinner shown, but `isError` state is never handled — failure renders an empty label list |
| `src/components/campaigns/campaigns-dashboard.tsx` | `isLoading` spinner shown, but `isError` is not handled — campaign fetch failure renders the empty state as if there are no campaigns |
| `src/components/posts/drafts-list.tsx` | `isLoading` spinner shown, but `isError` is absent |
| `src/components/posts/queue-manager.tsx` | `isLoading` skeleton shown, but `isError` from the queue fetch is not handled — failed queue load shows the component as if the queue is empty |
| `src/app/(app)/settings/billing/page.tsx` | `isLoading` skeleton shown. If billing data fetch fails, `data` is `undefined` and the page renders in a broken half-loaded state (no `isError` branch) |

---

## 8. Missing Empty States (No-Data Scenarios)

Most major list views handle the empty state well. The following gaps were found:

| File / Component | Missing Empty State |
|---|---|
| `src/app/(app)/analytics/page.tsx` → `AnalyticsDashboard` | Handles no-accounts state, but if `data.topPosts` is empty the `<TopPosts>` section renders with no empty state message |
| `src/app/(app)/inbox/page.tsx` → `InboxFeed` | Empty state message varies by filter, but there is no differentiated state for "no accounts connected at all" vs "no comments" |
| `src/app/(app)/queue/page.tsx` → `QueueManager` → `QueueList` | If the queue is empty the list component needs confirmation that an empty state message is rendered (not confirmed from reading `queue-list.tsx`) |
| `src/app/(app)/calendar/page.tsx` | Calendar page renders `ContentCalendar`; an empty state for weeks with no posts is not verified |
| `src/app/(app)/admin/users/page.tsx` | Admin user table has no confirmed empty state for zero users |

---

## 9. Form Submission Error Handling

### Well-Handled Forms

- `src/app/(auth)/login/page.tsx` — Inline `serverError` state, field-level Zod errors.
- `src/app/(app)/settings/profile/page.tsx` — `onError` toast on both profile and password mutations.
- `src/app/(app)/settings/billing/page.tsx` — `onError` toast on portal and checkout mutations.
- `src/components/posts/post-composer.tsx` — Inline error banner on `mutation.isError`.
- `src/components/team/invite-member-form.tsx` — Field-level Zod errors, success state shown.

### Gaps

| File | Issue |
|---|---|
| `src/components/team/invite-member-form.tsx` | `onError` is missing on the `sendInvite` mutation — the form has no error display path when the API returns a non-2xx response (e.g., "Member limit reached" 422) |
| `src/components/campaigns/campaign-form.tsx` | The form receives `onSave` and `isPending` from parent but the parent `createMutation` in `CampaignsDashboard` has no `onError` — API errors never reach the form UI |
| `src/components/team/workspace-settings-form.tsx` | `saveSettings` mutation has no `onError` callback — save failures do not notify the user |
| `src/app/(auth)/register/page.tsx` | Not reviewed in detail, but should be audited to ensure registration errors (e.g., duplicate email) are surfaced to the user |

---

## 10. Network Error Handling in TanStack Query Hooks

### Global Configuration Gap

`src/components/providers.tsx` configures `QueryClient` with no `retry` override for mutations, no global `onError` handler, and no network-status detection. By default, TanStack Query silently retries queries 3 times with exponential back-off but **mutations are not retried at all** — a transient network blip on a form submit will fail without any indication.

```typescript
// src/components/providers.tsx — current configuration
new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      refetchOnWindowFocus: false,
    },
    // Missing: mutations default error handler
    // Missing: queries default error handler
  },
})
```

### Recommendation

Add a global `defaultOptions.mutations.onError` that shows a generic toast for any mutation that doesn't supply its own `onError`.

### Specific Query Gaps (No Error State Rendering)

| File | Query | Gap |
|---|---|---|
| `src/components/campaigns/campaigns-dashboard.tsx` | `["campaigns", workspaceId]` | `isError` not destructured or handled |
| `src/components/posts/drafts-list.tsx` | `["drafts", ...]` | `isError` not destructured or handled |
| `src/components/posts/queue-manager.tsx` | `["queue", workspaceId]` | `isError` not destructured or handled |
| `src/components/team/team-members-list.tsx` | `["workspace-members", ...]` | `isError` not destructured or handled |
| `src/components/labels/labels-manager.tsx` | `["labels", workspaceId]` | `isError` not destructured or handled |
| `src/app/(app)/settings/billing/page.tsx` | `["billing"]` | `isError` not destructured or handled |

---

## 11. Toast Notifications for Async Operations

### Well-Covered Operations (Toast Present)

- Account connect/disconnect (`accounts-list.tsx`)
- Post approve/reject (`approval-queue.tsx`, `approval-review-panel.tsx`)
- Profile save / password change (`settings/profile/page.tsx`)
- Billing portal / checkout (`settings/billing/page.tsx`)
- Queue pause/resume (`queue-manager.tsx`)
- Post detail panel publish/retry/delete (`post-detail-panel.tsx`)
- AI caption/hashtag generation (`ai-caption-generator.tsx`, `ai-hashtag-generator.tsx`)
- Admin user role/status mutations (`admin/users-table.tsx`)

### Operations Without Toast Notifications

| Operation | Component | Missing Toast Type |
|---|---|---|
| Draft delete (success) | `drafts-list.tsx` | Success confirmation |
| Draft delete (failure) | `drafts-list.tsx` | Error |
| Label create/update/delete | `labels-manager.tsx` | All three — success and error |
| Media delete / bulk delete | `media-library.tsx` | Error only (success relies on optimistic UI) |
| Campaign create (failure) | `campaigns-dashboard.tsx` | Error |
| Team member role change | `team-members-list.tsx` | Success + error |
| Team member suspend/activate | `team-members-list.tsx` | Success + error |
| Team member remove | `team-members-list.tsx` | Success + error |
| Invite resend | `team-members-list.tsx` | Success + error |
| Workspace settings save | `workspace-settings-form.tsx` | Error (success uses inline state) |
| Workspace delete | `workspace-settings-form.tsx` | Error |
| Comment reply send | `comment-reply-form.tsx` | Success + error |
| Invite member (failure) | `invite-member-form.tsx` | Error |

---

## 12. 404 Handling — Missing `not-found.tsx` Files

As noted in Section 3, `notFound()` is called in `src/app/(app)/campaigns/[id]/page.tsx` but no `not-found.tsx` exists anywhere in the project. The default Next.js 404 page will be shown.

### Additional 404 Risk

The following routes call `.findUnique()` or `.findFirst()` with a dynamic `[id]` segment but do **not** call `notFound()` when the entity is absent — they would render broken UI or redirect unexpectedly:

| Page | Dynamic Param | Current Behavior on Missing Entity |
|---|---|---|
| `src/app/(app)/campaigns/[id]/page.tsx` | `id` | Correctly calls `notFound()` |
| All other dynamic app pages | — | No dynamic `[id]` pages exist beyond campaigns |

For completeness, API routes return `{ status: 404 }` correctly; the gap is only in the UI layer.

---

## Summary Table

| Category | Severity | Count of Issues |
|---|---|---|
| Missing `error.tsx` files | High | 7 route segments |
| Missing `loading.tsx` files | Medium | 6 route segments |
| Missing `not-found.tsx` files | Medium | 2 locations |
| API routes without `try/catch` | High | 8 routes |
| No error boundary in client tree | High | 0 boundaries exist |
| Unhandled promise rejections | Medium | 4 locations |
| Missing `onError` in mutations | High | 14 mutations across 8 components |
| Missing `isError` handling in queries | Medium | 6 queries |
| Missing loading states | Medium | 6 components |
| Missing empty states | Low | 5 components |
| Form error feedback gaps | High | 4 forms |
| Missing toast notifications | Medium | 14 operations |

---

## Recommended Priority Order

1. **Add `error.tsx` at `src/app/error.tsx` and `src/app/(app)/error.tsx`** — these two files catch the majority of unhandled server errors.
2. **Add global `onError` handler to `QueryClient` defaults** in `providers.tsx` — catches all unhandled mutation failures at once.
3. **Add `onError` + `useToast` to the 8 components with missing mutation error handling** — `drafts-list`, `labels-manager`, `media-library`, `campaigns-dashboard`, `invite-member-form`, `team-members-list`, `workspace-settings-form`, `comment-reply-form`.
4. **Wrap the remaining un-guarded API route DB calls in `try/catch`** — especially `inbox/route.ts` and the approve/reject/publish routes.
5. **Add `isError` branches to the 6 query hooks** with no error state.
6. **Create `src/app/not-found.tsx`** for the global 404 page.
7. **Add `loading.tsx` files** for the 6 high-traffic route segments.
8. **Add an `ErrorBoundary` component** and wrap `(app)/layout.tsx` children.
