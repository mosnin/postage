# Test Coverage Plan — PostSyncer

## 1. Current State

No test files exist. Zero test coverage. This plan establishes a path from 0% to covering the highest-risk paths across unit, integration, and E2E layers.

---

## 2. Recommended Testing Stack

| Layer | Tools |
|---|---|
| Unit / Integration | Vitest + @testing-library/react + MSW (mock service worker) |
| E2E | Playwright |
| Database | Prisma client pointing at `DATABASE_TEST_URL` (separate test DB) |
| Auth mocking | Custom session helpers wrapping Auth.js `getServerSession` |
| Stripe mocking | MSW intercepts + `stripe-mock` for webhook signature tests |

**Why Vitest over Jest:** Native ESM, faster HMR, identical API, first-class Vite config integration (Next.js 15 uses Turbopack/Vite under the hood for tooling).

---

## 3. Top 10 Critical Test Paths (by risk)

### Unit Tests

**1. `src/lib/utils.ts` — formatDate, generateApiKey, PLAN_LIMITS**
- `formatDate` handles UTC edge cases (DST boundaries, leap years)
- `generateApiKey` calls `crypto.randomBytes`, returns correct prefix format
- `PLAN_LIMITS` object has expected keys for all plan tiers (STARTER, PRO, BUSINESS)

**2. `src/lib/api/rate-limit.ts` — counter logic, plan enforcement, 429 threshold**
- Counter increments on each call for the same key
- Counters are isolated per API key (no cross-key bleed)
- Returns `{ allowed: false, status: 429 }` exactly at the plan limit (not one before, not one after)
- Counter resets after the window expires

**3. `src/lib/scheduler/publish-engine.ts` — publishDuePosts**
- Queries only posts where `scheduledAt <= now` and `status === SCHEDULED`
- Marks posts `PUBLISHED` on success, `FAILED` on error
- Does not double-publish a post already marked `PUBLISHED`
- Handles upstream social API errors without crashing the entire batch

**4. Stripe webhook handler — each event type**
- `customer.subscription.created` → sets workspace plan + `stripeSubscriptionId`
- `customer.subscription.updated` → updates plan tier correctly on downgrade/upgrade
- `customer.subscription.deleted` → reverts workspace to FREE
- `invoice.payment_failed` → sets workspace `status` to `PAST_DUE`
- Invalid signature returns 400 without touching the database

**5. `src/lib/api/auth.ts` — API key hashing**
- Hashing the same raw key twice yields the same SHA-256 digest
- A different raw key yields a different digest (no collision under normal test inputs)
- `verifyApiKey(raw, hashed)` returns `true` for matching pair, `false` for mismatch

---

### Integration Tests (API Routes)

**6. `POST /api/auth/register` — user + workspace bootstrap**
- Creates `User`, `Workspace`, and `Subscription` rows in one transaction
- Password is stored as bcrypt hash, not plaintext
- Returns 409 if email already exists
- Returns 422 for missing required fields

**7. `POST /api/posts` — auth, ownership, status**
- Returns 401 with no session
- Returns 403 when `workspaceId` belongs to a different user
- Creates post with `status: DRAFT` when no `scheduledAt` supplied
- Creates post with `status: SCHEDULED` when valid future `scheduledAt` supplied
- Returns 422 when `content` exceeds plan character limit

**8. `GET /api/posts/calendar` — date range scoping**
- Returns only posts belonging to the authenticated workspace
- Filters by `?start=` and `?end=` query params (ISO 8601)
- Excludes posts from other workspaces even if date range matches
- Returns empty array (not 404) when no posts exist in range

**9. `POST /api/billing/webhook` — idempotency + signature**
- Processing the same Stripe event ID twice does not create duplicate DB rows
- Valid signature + known event type → 200
- Invalid signature → 400, no DB writes
- Unknown event type → 200 (ignored gracefully)

**10. `GET /api/v1/posts` — public API key auth + pagination**
- Returns 401 with missing `Authorization` header
- Returns 401 with a revoked or unknown API key
- Returns 429 when rate limit is exhausted for the key's plan
- Returns paginated results respecting `?limit=` and `?cursor=`
- Results scoped to the workspace owning the API key

---

### E2E Tests (Playwright)

**11. Full auth flow: register → onboarding → dashboard**
- User fills register form, submits, lands on `/onboarding`
- Completes onboarding steps, lands on `/dashboard`
- Refreshing dashboard does not redirect back to onboarding

**12. Compose and schedule a post**
- User opens composer, enters content, picks a future date/time
- Submits, post appears in calendar view at correct slot
- Post status shows `Scheduled`

**13. Billing: upgrade plan via Stripe Checkout (test mode)**
- User visits `/billing`, clicks upgrade
- Redirected to Stripe Checkout (test mode `pk_test_*`)
- After success redirect, dashboard reflects new plan limits

**14. Invite team member → accept → verify access**
- Owner sends invite to `teammate@example.com`
- Teammate registers/logs in via invite link
- Teammate can view workspace posts but cannot access billing

---

## 4. Sample Test Code

### Vitest unit test — rate limiter

```typescript
// src/lib/api/__tests__/rate-limit.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { checkRateLimit } from '../rate-limit';

describe('checkRateLimit', () => {
  it('allows requests under the limit', () => {
    const result = checkRateLimit('key1', 'STARTER', 'write');
    expect(result.allowed).toBe(true);
  });

  it('blocks after daily limit exceeded', () => {
    for (let i = 0; i < 100; i++) {
      checkRateLimit('key2', 'STARTER', 'write');
    }
    const result = checkRateLimit('key2', 'STARTER', 'write');
    expect(result.allowed).toBe(false);
    expect(result.status).toBe(429);
  });

  it('does not bleed counts between keys', () => {
    for (let i = 0; i < 100; i++) {
      checkRateLimit('key3', 'STARTER', 'write');
    }
    const result = checkRateLimit('key4', 'STARTER', 'write');
    expect(result.allowed).toBe(true);
  });
});
```

### Vitest integration test — posts API

```typescript
// src/app/api/posts/__tests__/route.test.ts
import { describe, it, expect } from 'vitest';
import { POST } from '../route';
import { createMockSession, createMockWorkspace } from '@/test/helpers';

describe('POST /api/posts', () => {
  it('creates a draft post when no scheduledAt is provided', async () => {
    const { workspace } = await createMockSession();
    const req = new Request('http://localhost/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Test post', workspaceId: workspace.id }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.status).toBe('DRAFT');
  });

  it('returns 401 with no session', async () => {
    const req = new Request('http://localhost/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Test post', workspaceId: 'ws_123' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});
```

### Playwright E2E — register and reach dashboard

```typescript
// e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test('user can register and reach dashboard', async ({ page }) => {
  await page.goto('/register');
  await page.fill('[name="email"]', `test+${Date.now()}@example.com`);
  await page.fill('[name="password"]', 'Password123!');
  await page.click('[type="submit"]');
  await expect(page).toHaveURL('/onboarding');
  // complete onboarding minimal step
  await page.fill('[name="workspaceName"]', 'Test Workspace');
  await page.click('[data-testid="onboarding-next"]');
  await expect(page).toHaveURL('/dashboard');
});
```

---

## 5. Setup Instructions

```bash
npm install -D vitest @vitejs/plugin-react @testing-library/react \
  @testing-library/user-event @testing-library/jest-dom \
  msw @playwright/test
npx playwright install --with-deps chromium
```

**`vitest.config.ts` (root)**

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
  resolve: {
    alias: { '@': resolve(__dirname, './src') },
  },
});
```

**`src/test/setup.ts`**

```typescript
import '@testing-library/jest-dom';
import { server } from './msw-server';
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

**`.env.test`**

```
DATABASE_TEST_URL="postgresql://postgres:postgres@localhost:5432/postsyncer_test"
NEXTAUTH_SECRET="test-secret"
STRIPE_WEBHOOK_SECRET="whsec_test"
```

Add to `package.json` scripts:

```json
{
  "test": "vitest",
  "test:ui": "vitest --ui",
  "test:coverage": "vitest run --coverage",
  "test:e2e": "playwright test",
  "test:e2e:ui": "playwright test --ui"
}
```

---

## 6. Priority Implementation Order

| Week | Focus | Risk Mitigated |
|---|---|---|
| 1 | Vitest config + `utils.ts` + `rate-limit.ts` unit tests | Developer velocity, billing limits |
| 2 | Auth register + posts API integration tests | Data integrity, auth bypass |
| 3 | Stripe webhook tests + billing integration | Revenue, subscription state corruption |
| 4 | Playwright E2E for auth flow + post scheduling | Regression on critical user journeys |

**Target after 4 weeks:** ~60% line coverage on `src/lib/`, ~80% branch coverage on API routes, E2E smoke suite covering 4 critical flows.
