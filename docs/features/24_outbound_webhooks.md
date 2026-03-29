# Feature 24: Outbound Webhook Notifications

## 1. Overview

Allow users to receive real-time HTTP POST notifications when events occur in their PostSyncer workspace. Webhooks enable integrations with external systems (Zapier, Make, custom backends) by pushing event data immediately when posts are published, fail, comments arrive, or account status changes.

---

## 2. Database Schema

```prisma
model Webhook {
  id              String    @id @default(cuid())
  workspaceId     String
  url             String
  secret          String    // HMAC signing secret
  events          String[]  // ["POST_PUBLISHED", "POST_FAILED", ...]
  isActive        Boolean   @default(true)
  failureCount    Int       @default(0)
  lastTriggeredAt DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  workspace       Workspace          @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  deliveryLogs    WebhookDeliveryLog[]
  @@index([workspaceId])
}

model WebhookDeliveryLog {
  id         String   @id @default(cuid())
  webhookId  String
  event      String
  payload    Json
  statusCode Int?
  success    Boolean
  error      String?
  duration   Int?     // ms
  createdAt  DateTime @default(now())
  webhook    Webhook  @relation(fields: [webhookId], references: [id], onDelete: Cascade)
  @@index([webhookId, createdAt])
}
```

---

## 3. Event Types

```typescript
// lib/webhooks/events.ts
export const WebhookEvent = {
  POST_PUBLISHED:       "POST_PUBLISHED",
  POST_FAILED:          "POST_FAILED",
  POST_SCHEDULED:       "POST_SCHEDULED",
  COMMENT_RECEIVED:     "COMMENT_RECEIVED",
  ACCOUNT_DISCONNECTED: "ACCOUNT_DISCONNECTED",
  MEMBER_INVITED:       "MEMBER_INVITED",
} as const;
export type WebhookEvent = (typeof WebhookEvent)[keyof typeof WebhookEvent];

export interface WebhookPayload {
  id:          string;  // delivery attempt UUID
  event:       WebhookEvent;
  workspaceId: string;
  createdAt:   string;  // ISO-8601
  data:        Record<string, unknown>;
}
```

---

## 4. Delivery System

```typescript
// lib/webhooks/deliver.ts
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import type { WebhookEvent, WebhookPayload } from "./events";

const MAX_FAILURES    = 10;
const REQUEST_TIMEOUT = 5_000;
const RETRY_DELAYS    = [5_000, 30_000, 300_000]; // 5s, 30s, 5min

function signPayload(secret: string, body: string): string {
  return "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");
}

async function attemptDelivery(url: string, secret: string, body: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type":           "application/json",
        "X-PostSyncer-Signature": signPayload(secret, body),
        "X-PostSyncer-Event":     JSON.parse(body).event,
        "User-Agent":             "PostSyncer-Webhook/1.0",
      },
      body,
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
    return { statusCode: res.status, success: res.status >= 200 && res.status < 300, duration: Date.now() - start };
  } catch (err) {
    return { statusCode: 0, success: false, error: err instanceof Error ? err.message : String(err), duration: Date.now() - start };
  }
}

export async function deliverWebhook(
  webhookId: string,
  event: WebhookEvent,
  data: Record<string, unknown>,
): Promise<void> {
  const webhook = await prisma.webhook.findUnique({ where: { id: webhookId } });
  if (!webhook?.isActive || !webhook.events.includes(event)) return;

  const payload: WebhookPayload = {
    id: crypto.randomUUID(), event, workspaceId: webhook.workspaceId,
    createdAt: new Date().toISOString(), data,
  };
  const body = JSON.stringify(payload);

  let result = await attemptDelivery(webhook.url, webhook.secret, body);
  for (let i = 0; i < RETRY_DELAYS.length && !result.success; i++) {
    await new Promise((r) => setTimeout(r, RETRY_DELAYS[i]));
    result = await attemptDelivery(webhook.url, webhook.secret, body);
  }

  await prisma.webhookDeliveryLog.create({
    data: { webhookId, event, payload: payload as object,
      statusCode: result.statusCode || null, success: result.success,
      error: result.error ?? null, duration: result.duration },
  });

  if (result.success) {
    await prisma.webhook.update({ where: { id: webhookId }, data: { failureCount: 0, lastTriggeredAt: new Date() } });
  } else {
    const newCount = webhook.failureCount + 1;
    await prisma.webhook.update({ where: { id: webhookId }, data: { failureCount: newCount, isActive: newCount < MAX_FAILURES } });
  }
}

/** Fan-out to all active matching webhooks for a workspace */
export async function dispatchEvent(workspaceId: string, event: WebhookEvent, data: Record<string, unknown>) {
  const hooks = await prisma.webhook.findMany({
    where: { workspaceId, isActive: true, events: { has: event } },
    select: { id: true },
  });
  await Promise.allSettled(hooks.map((h) => deliverWebhook(h.id, event, data)));
}
```

---

## 5. API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/webhooks` | List workspace webhooks |
| POST | `/api/webhooks` | Create webhook (enforces plan limit) |
| GET | `/api/webhooks/[id]` | Fetch single webhook |
| PUT | `/api/webhooks/[id]` | Update url / events / isActive |
| DELETE | `/api/webhooks/[id]` | Delete webhook |
| POST | `/api/webhooks/[id]/test` | Send sample `POST_PUBLISHED` payload |
| GET | `/api/webhooks/[id]/logs` | Paginated delivery logs (`?page&limit`) |

On `POST /api/webhooks`, generate the secret server-side with `crypto.randomBytes(32).toString("hex")` and never re-expose it — offer a "rotate secret" action instead.

Validate that `url` is HTTPS-only before persisting:
```typescript
if (new URL(url).protocol !== "https:") return NextResponse.json({ error: "HTTPS required" }, { status: 422 });
```

---

## 6. Integration Points

Call `dispatchEvent` as fire-and-forget after key actions in existing services:

```typescript
// lib/publish-engine.ts
import { dispatchEvent } from "@/lib/webhooks/deliver";
import { WebhookEvent }  from "@/lib/webhooks/events";

// After successful publish:
void dispatchEvent(workspaceId, WebhookEvent.POST_PUBLISHED, {
  postId: post.id, platform: result.platform, publishedAt: new Date().toISOString(),
});

// On failure:
void dispatchEvent(workspaceId, WebhookEvent.POST_FAILED, {
  postId: post.id, platform: result.platform, reason: result.error,
});
```

Similarly wire up `dispatchEvent` in:
- `account-service.ts` → `ACCOUNT_DISCONNECTED`
- `workspace-service.ts` → `MEMBER_INVITED`
- `scheduler.ts` → `POST_SCHEDULED`
- `comment-sync.ts` → `COMMENT_RECEIVED`

---

## 7. Plan Limits

```typescript
// lib/webhooks/limits.ts
export const PLAN_LIMITS: Record<string, number> = {
  STARTER:  2,
  PRO:      10,
  PRO_PLUS: -1,  // -1 = unlimited
};
```

Enforce in `POST /api/webhooks`:
```typescript
const count = await prisma.webhook.count({ where: { workspaceId: session.workspaceId } });
const limit = PLAN_LIMITS[session.plan] ?? 2;
if (limit !== -1 && count >= limit)
  return NextResponse.json({ error: "Webhook limit reached for your plan" }, { status: 403 });
```

Display remaining quota in the UI settings panel. Delivery logs are retained for 30 days; prune old rows with a nightly cron.
