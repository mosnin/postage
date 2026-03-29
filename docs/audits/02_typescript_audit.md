# TypeScript Type Safety Audit

**Project:** PostSyncer / Postage
**Date:** 2026-03-29
**Auditor:** Claude (Sonnet 4.6)
**Scope:** All files under `src/`

---

## 0. Summary

| Category | Issue Count | Severity |
|---|---|---|
| `any` types | 5 | High |
| `as never` type assertions | 5 | High |
| Missing return types | 6 | Medium |
| Unsafe type assertions | 22 | Medium–High |
| Non-null assertion misuse | 6 | Medium |
| Duplicate type definitions | 2 | Low–Medium |
| Enum vs union type opportunities | 3 | Low |
| Missing generics / weak typing | 4 | Medium |
| tsconfig strictness gaps | 2 | Medium |

---

## 1. tsconfig.json Strictness Settings

**File:** `tsconfig.json`

```json
{
  "compilerOptions": {
    "strict": true,
    ...
    "skipLibCheck": true
  }
}
```

`"strict": true` enables the core strictness flags (`strictNullChecks`, `strictFunctionTypes`, `strictBindCallApply`, etc.). That is correct.

**Missing recommended flags:**

| Flag | Default when `strict: true` | Recommendation |
|---|---|---|
| `noUncheckedIndexedAccess` | **not included in `strict`** | Add — array indexing currently returns `T` not `T \| undefined`, masking off-by-one bugs |
| `noImplicitReturns` | not included | Add — functions that sometimes return `undefined` implicitly are not flagged |
| `exactOptionalPropertyTypes` | not included | Add — prevents assigning `undefined` to optional properties |

**Recommended additions to `tsconfig.json`:**

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "exactOptionalPropertyTypes": true
  }
}
```

> **Note:** Enabling `noUncheckedIndexedAccess` will surface real latent bugs (see §6 below) but will require a round of fixes.

---

## 2. `any` Types

### 2.1 `src/app/api/admin/workspaces/route.ts:23`

```ts
const where: any = {};
```

**Problem:** Typed as `any`, bypassing all Prisma query type safety.

**Fix:** Use Prisma's generated `Prisma.WorkspaceWhereInput` type:

```ts
import type { Prisma } from "@prisma/client";

const where: Prisma.WorkspaceWhereInput = {};
```

---

### 2.2 `src/app/api/admin/users/route.ts:34`

```ts
const where: any = {};
```

**Fix:**

```ts
import type { Prisma } from "@prisma/client";

const where: Prisma.UserWhereInput = {};
```

---

### 2.3 `src/app/api/admin/users/[id]/route.ts:123`

```ts
const updateData: any = {};
```

**Fix:** Use Prisma's update input type:

```ts
import type { Prisma } from "@prisma/client";

const updateData: Prisma.UserUpdateInput = {};
```

---

### 2.4 `src/components/calendar/content-calendar.tsx:138`

```ts
if (!platformsParam.some((p) => postPlatforms.includes(p as any))) return false;
```

**Problem:** `p as any` is used to suppress a type error because `platformsParam` is likely `string[]` while `postPlatforms` has a narrower `Platform` type.

**Fix:** Type `platformsParam` correctly as `PlatformKey[]` (imported from `@/lib/social/platforms`) or use `as PlatformKey` instead of `as any`:

```ts
import type { PlatformKey } from "@/lib/social/platforms";

const platformsParam: PlatformKey[] = ...;
if (!platformsParam.some((p) => postPlatforms.includes(p))) return false;
```

---

### 2.5 `src/components/calendar/content-calendar.tsx:184`

```ts
(event: any) => {
```

**Problem:** DndKit drag event typed as `any`.

**Fix:** Import and use the proper DndKit event type:

```ts
import type { DragStartEvent } from "@dnd-kit/core";

const handleDragStart = useCallback(
  (event: DragStartEvent) => {
    const post = event.active?.data?.current?.post as CalendarPost | undefined;
    if (post) setActivePost(post);
  },
  []
);
```

---

## 3. `as never` Type Assertions

These appear in `src/app/api/analytics/route.ts` and `src/app/api/posts/route.ts` as a workaround when dynamically building Prisma `where` clauses with an optional `platform` or `status` string.

### 3.1 `src/app/api/analytics/route.ts:79, 85, 101, 295`

```ts
...(platform ? { platform: platform as never } : {}),
```

**Problem:** `as never` silences TypeScript but also silences the compiler's guard against invalid enum values at runtime.

**Fix:** Use Prisma's actual enum type. The `platform` query param should be validated and cast to `Platform` (the Prisma enum):

```ts
import { Platform } from "@prisma/client";

// Validate before use
const platformValues = Object.values(Platform);
const platformFilter = platformValues.includes(platform as Platform)
  ? (platform as Platform)
  : undefined;

// Then in queries
...(platformFilter ? { platform: platformFilter } : {}),
```

---

### 3.2 `src/app/api/posts/route.ts:269`

```ts
...(status ? { status: status as never } : {}),
```

**Fix:** Validate `status` against the `PostStatus` enum from Prisma:

```ts
import { PostStatus } from "@prisma/client";

const statusValues = Object.values(PostStatus) as string[];
const statusFilter = statusValues.includes(status ?? "")
  ? (status as PostStatus)
  : undefined;

...(statusFilter ? { status: statusFilter } : {}),
```

---

## 4. Missing Return Types on Functions

These public/exported functions lack explicit return type annotations, relying on inference. While TypeScript can infer them, explicit return types are a contract that prevents accidental signature changes and improves readability.

### 4.1 `src/lib/utils.ts:5,9,13,17` — `cn`, `formatDate`, `formatDateTime`, `formatRelative`

```ts
export function cn(...inputs: ClassValue[]) { ... }       // inferred: string
export function formatDate(date: Date | string) { ... }   // inferred: string
export function formatDateTime(date: Date | string) { ... }
export function formatRelative(date: Date | string) { ... }
```

**Fix:**

```ts
export function cn(...inputs: ClassValue[]): string { ... }
export function formatDate(date: Date | string): string { ... }
export function formatDateTime(date: Date | string): string { ... }
export function formatRelative(date: Date | string): string { ... }
```

---

### 4.2 `src/lib/mcp/server.ts:86,92` — `toolResult` and `toolError`

```ts
function toolResult(content: unknown) { ... }
function toolError(message: string) { ... }
```

These helpers have complex inferred return types. Making them explicit anchors the MCP response shape:

```ts
interface ToolResultContent {
  content: Array<{ type: "text"; text: string }>;
}

interface ToolErrorContent extends ToolResultContent {
  isError: true;
}

function toolResult(content: unknown): ToolResultContent { ... }
function toolError(message: string): ToolErrorContent { ... }
```

---

### 4.3 `src/lib/mcp/server.ts:105–460` — All `handle*` functions

Every `handle*` function (e.g. `handleListWorkspaces`, `handleCreatePost`, etc.) lacks a return type. They all return either `toolResult(...)` or `toolError(...)` which should be typed uniformly:

```ts
type ToolHandlerResult = ToolResultContent | ToolErrorContent;

async function handleListWorkspaces(auth: AuthContext): Promise<ToolHandlerResult> { ... }
```

---

## 5. Unsafe Type Assertions (`as SomeType`)

### 5.1 `src/lib/auth.ts:60`

```ts
token.role = (user as { role?: string }).role ?? "USER";
```

**Problem:** Inline type widening cast instead of extending NextAuth types.

**Fix:** Extend the `AdapterUser` / `User` type through declaration merging (already done for `Session` at line 116). Add:

```ts
declare module "next-auth" {
  interface User {
    role?: string;
  }
}
```

Then access `user.role` directly without a cast.

---

### 5.2 `src/lib/auth.ts:66–67`

```ts
session.user.id = token.id as string;
session.user.role = token.role as string;
```

**Problem:** JWT token properties are `unknown` by default. These casts are technically unsafe — `token.id` could be `undefined`.

**Fix:** Extend `JWT` via declaration merging and add null guards:

```ts
declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
  }
}

// Then in the session callback:
if (token.id) session.user.id = token.id;
if (token.role) session.user.role = token.role;
```

---

### 5.3 `src/lib/scheduler/publish-engine.ts:160,166,186,198,200`

```ts
(post.contentVariants as Record<string, string> | null) ?? {};
((post.threadParts as Array<{ content: string }> | null) ?? [])
const meta = socialAccount.metadata as Record<string, unknown>;
(meta?.instagram_id as string | undefined)
(meta?.person_urn as string | undefined)
```

**Problem:** `contentVariants`, `threadParts`, and `metadata` are Prisma `Json` fields (typed as `JsonValue`). Casting `Json` directly is inherently unsafe.

**Fix:** Create typed helper functions with runtime validation:

```ts
function parseContentVariants(raw: unknown): Record<string, string> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, string>;
  }
  return {};
}

function parseThreadParts(raw: unknown): Array<{ content: string }> {
  if (Array.isArray(raw)) {
    return raw.filter((p): p is { content: string } =>
      typeof p === "object" && p !== null && typeof (p as { content?: unknown }).content === "string"
    );
  }
  return [];
}

function parseSocialMeta(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
}
```

---

### 5.4 `src/app/api/billing/webhook/route.ts:91,105,139,153,189,202`

```ts
stripeCustomerId: subscription.customer as string,
const customerId = invoice.customer as string;
```

**Problem:** In the Stripe SDK, `subscription.customer` is typed as `string | Stripe.Customer | Stripe.DeletedCustomer`. Casting to `string` is incorrect when the customer object is expanded.

**Fix:** Use the Stripe SDK helper or check the type:

```ts
const customerId = typeof subscription.customer === "string"
  ? subscription.customer
  : subscription.customer.id;
```

---

### 5.5 `src/app/api/billing/webhook/route.ts:93,107,141,155` — Repeated plan cast

```ts
plan: plan as "STARTER" | "PRO" | "PRO_PLUS" | "FREE",
```

This pattern repeats six times across `handleSubscriptionCreated` and `handleSubscriptionUpdated`.

**Fix:** Extract a typed helper using the Prisma `Plan` enum, and fix `getPlanFromPriceId` to return `Plan` instead of `string`:

```ts
import type { Plan } from "@prisma/client";

export function getPlanFromPriceId(priceId: string): Plan {
  const map: Record<string, Plan> = { ... };
  return map[priceId] ?? "STARTER";
}
```

This removes all six casts.

---

### 5.6 `src/lib/workspace.ts:153,176`

```ts
const max = PLAN_LIMITS[workspace.plan as Plan].accounts;
const maxBytes = PLAN_LIMITS[workspace.plan as Plan].storage;
```

**Problem:** `workspace.plan` is already typed as `Plan` from Prisma. The cast `as Plan` is redundant but suggests `PLAN_LIMITS` may not match.

**Fix:** Type the `PLAN_LIMITS` key as `Plan`:

```ts
import type { Plan } from "@prisma/client";

export const PLAN_LIMITS: Record<Plan, { accounts: number; workspaces: number; storage: number; aiCredits: number; apiPostsPerDay: number }> = {
  FREE: { ... },
  STARTER: { ... },
  ...
} as const;

// Now no cast is needed:
const max = PLAN_LIMITS[workspace.plan].accounts;
```

---

### 5.7 `src/app/api/accounts/callback/[platform]/route.ts:231–250` — `normalizeProfile`

Multiple cascading `as Record<string, unknown>` casts when parsing untyped API JSON:

```ts
platformId: String((data.data as Record<string, unknown>)?.id ?? data.id),
const items = (data.items as Record<string, unknown>[]) ?? [];
const channel = items[0] as Record<string, unknown> | undefined;
```

**Fix:** Introduce platform-specific response interfaces and use Zod (already used elsewhere in the codebase) to parse/validate the profile payload:

```ts
const TwitterProfileSchema = z.object({
  data: z.object({ id: z.string(), username: z.string(), name: z.string() }).optional(),
  id: z.string().optional(),
  username: z.string().optional(),
  name: z.string().optional(),
});
```

---

### 5.8 `src/app/(app)/analytics/page.tsx:18`

```ts
const userId = session?.user?.id as string;
```

**Problem:** If `session` is `null` (unauthenticated), this cast produces `undefined as string`.

**Fix:** Use an early return guard:

```ts
if (!session?.user?.id) return null;
const userId = session.user.id; // now narrowed to string
```

---

### 5.9 `src/lib/social/linkedin.ts:206`

```ts
...(init.headers as Record<string, string> | undefined),
```

**Problem:** `RequestInit.headers` is `HeadersInit | undefined`, not `Record<string, string>`. Spreading an arbitrary `Headers` object or `string[][]` would lose data.

**Fix:**

```ts
...(init.headers instanceof Headers
  ? Object.fromEntries(init.headers.entries())
  : (init.headers as Record<string, string> | undefined)),
```

---

### 5.10 `src/components/media/storage-usage-bar.tsx:14`

```ts
const limit = (PLAN_LIMITS as Record<string, { storage: number }>)[plan]?.storage ?? 0;
```

Same as §5.6 — should use the typed `Plan` key. See fix in §5.6.

---

### 5.11 `src/hooks/use-session.ts:40–44`

```ts
id: session!.user.id,
name: session!.user.name ?? null,
```

**Assessment:** The non-null assertion `session!` is actually safe here — it is guarded by `isAuthenticated` on line 37 which checks `session?.user?.id`. The assertions are correct but could be written more clearly (see §6).

---

## 6. Non-Null Assertion Operator (`!`)

### 6.1 `src/app/api/analytics/route.ts:186, 303`

```ts
snapshotsByDay.get(key)!.push(s);
postAnalyticsMap.get(pa.postId)!.push(pa);
```

**Problem:** `Map.get()` returns `T | undefined`. The `!` is used because the map entry was just set on the line above, but this pattern is fragile.

**Fix:** Use a `getOrSet` helper pattern:

```ts
function getOrSetArray<K, V>(map: Map<K, V[]>, key: K): V[] {
  let arr = map.get(key);
  if (!arr) { arr = []; map.set(key, arr); }
  return arr;
}

getOrSetArray(snapshotsByDay, key).push(s);
```

---

### 6.2 `src/components/admin/workspace-table.tsx:338`

```ts
`https://dashboard.stripe.com/customers/${ws.subscription!.stripeCustomerId}`
```

**Problem:** `ws.subscription` could be `null`; the `!` assertion would throw if it is.

**Fix:** Guard the expression:

```ts
ws.subscription?.stripeCustomerId
  ? `https://dashboard.stripe.com/customers/${ws.subscription.stripeCustomerId}`
  : undefined
```

---

### 6.3 `src/hooks/use-workspace.ts:145`

```ts
queryFn: () => fetchWorkspace(resolvedId!),
```

**Problem:** `resolvedId` is `string | null`. The query is guarded by `enabled: !!resolvedId`, but the non-null assertion is still needed to satisfy TypeScript. This is correct in practice but brittle.

**Fix:** Use a conditional type:

```ts
queryFn: resolvedId
  ? () => fetchWorkspace(resolvedId)
  : skipToken,
```

(TanStack Query v5 provides `skipToken` for this pattern.)

---

## 7. Duplicate Type Definitions

### 7.1 `PlatformKey` defined in two places

- `src/types/index.ts:97–108`
- `src/lib/social/platforms.ts:1–14`

Both are identical union types. Consumer files must choose which to import.

**Fix:** Remove the definition from `src/types/index.ts` and re-export from `src/lib/social/platforms.ts`:

```ts
// src/types/index.ts
export type { PlatformKey } from "@/lib/social/platforms";
```

---

### 7.2 `Plan` local type alias vs Prisma import

`src/app/api/analytics/route.ts:5` declares a local `type Plan = "FREE" | "STARTER" | "PRO" | "PRO_PLUS"` which duplicates the Prisma-generated `Plan` enum.

**Fix:** Remove the local alias and import from Prisma:

```ts
import type { Plan } from "@prisma/client";
```

---

## 8. Missing Interface / Type Definitions

### 8.1 `src/lib/mcp/server.ts:103` — `Args` type is too loose

```ts
type Args = Record<string, unknown>;
```

Each MCP tool handler extracts typed fields from `Args` using `as string`, `as string[]`, etc. A better approach is to define a typed interface per tool and use Zod or discriminated union types:

```ts
interface ListAccountsArgs { workspaceId: string; }
interface CreatePostArgs {
  workspaceId: string;
  content: string;
  accountIds: string[];
  scheduledAt?: string;
  firstComment?: string;
}
// etc.
```

Then validate at the handler boundary:

```ts
async function handleCreatePost(auth: AuthContext, rawArgs: Args) {
  const args = CreatePostArgsSchema.parse(rawArgs); // throws on invalid
  ...
}
```

---

### 8.2 `src/app/api/analytics/route.ts:306–308` — Inline type aliases

```ts
type PostRow = typeof posts[0];
type PostAnalyticsRow = typeof postAnalytics[0];
type PostMetricTotals = { impressions: number; engagements: number; ... };
```

These inline `typeof` aliases are local to the `GET` function body. They should either be moved to module scope or referenced from `src/types/index.ts`.

---

### 8.3 `src/lib/social/platforms.ts:158–168` — Untyped OAuth state

The `encodeOAuthState` / `decodeOAuthState` functions use an inline object type. This should be a named interface:

```ts
export interface OAuthStatePayload {
  workspaceId: string;
  platform: string;
  redirectTo?: string;
}

export function encodeOAuthState(payload: OAuthStatePayload): string { ... }
export function decodeOAuthState(state: string): OAuthStatePayload | null { ... }
```

---

## 9. Enum vs Union Type Opportunities

### 9.1 `AppUser.role` and session role — use a string enum or const union

`src/hooks/use-session.ts:12` and `src/lib/auth.ts:119` both use `role: string`. The only valid values seen in the codebase are `"USER"` and `"SUPER_ADMIN"`.

**Fix:** Define a union type or const enum:

```ts
// src/types/index.ts
export type UserRole = "USER" | "SUPER_ADMIN";
```

And use it throughout:

```ts
interface AppUser {
  role: UserRole;
}
```

---

### 9.2 `WorkspaceSubscription.plan` and `status` — loose strings in hook types

`src/hooks/use-workspace.ts:11–12`:

```ts
export interface WorkspaceSubscription {
  plan: string;
  status: string;
```

These should use narrower types:

```ts
import type { Plan, SubscriptionStatus } from "@prisma/client";

export interface WorkspaceSubscription {
  plan: Plan;
  status: SubscriptionStatus;
}
```

Similarly `Workspace.plan: string` and `Workspace.memberRole: string` should use `Plan` and `WorkspaceRole`.

---

### 9.3 `getPlanFromPriceId` returns `string` — should return `Plan`

`src/lib/stripe.ts:55`:

```ts
export function getPlanFromPriceId(priceId: string): string { ... }
```

**Fix:** Return `Plan` (see §5.5 above).

---

## 10. Missing Generics

### 10.1 `MCPResponse.result` is `unknown`

`src/lib/mcp/server.ts:27`:

```ts
export interface MCPResponse {
  result?: unknown;
```

The JSON-RPC `result` field could be made generic in contexts where the caller knows the expected shape:

```ts
export interface MCPResponse<T = unknown> {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: T;
  error?: { code: number; message: string; data?: unknown };
}
```

---

### 10.2 `MCPTool.inputSchema.properties` uses `Record<string, unknown>`

`src/lib/mcp/tools.ts:5`:

```ts
inputSchema: {
  type: "object";
  properties: Record<string, unknown>;
  required: string[];
};
```

JSON Schema has a well-known recursive structure. Replacing `unknown` with a `JsonSchemaProperty` interface would add clarity:

```ts
interface JsonSchemaProperty {
  type: string;
  description?: string;
  enum?: string[];
  items?: JsonSchemaProperty;
}

inputSchema: {
  type: "object";
  properties: Record<string, JsonSchemaProperty>;
  required: string[];
};
```

---

### 10.3 `ApiResponse<T>` in `src/types/index.ts` is not used consistently

The `ApiResponse<T>` generic type is defined but many API routes return inline `{ data: ..., meta: ... }` objects directly rather than using this shared type. This is an opportunity to use the existing generic more broadly.

---

## 11. Summary of High-Priority Fixes

Listed in order of impact:

1. **`as never` casts on Prisma platform/status filters** (`analytics/route.ts`, `posts/route.ts`) — validate against Prisma enums using `z.nativeEnum` or `Object.values(Platform)`.
2. **`any` on Prisma where clauses** (`admin/workspaces`, `admin/users`, `admin/users/[id]`) — replace with `Prisma.XxxWhereInput`.
3. **`subscription.customer as string`** in Stripe webhook — guard with `typeof` check.
4. **JSON field casts** in `publish-engine.ts` — add runtime validators for `contentVariants`, `threadParts`, and `metadata`.
5. **`noUncheckedIndexedAccess` + `noImplicitReturns`** in `tsconfig.json` — enabling these will surface the Map index patterns and missing return statements.
6. **Duplicate `PlatformKey` type** — canonicalize in one file.
7. **`plan` cast in `workspace.ts`** — type `PLAN_LIMITS` with `Record<Plan, ...>`.
8. **`UserRole` union type** — replace `role: string` with a constrained union.
