# Feature 20: X Communities Posting Support

**Status:** Design / Pre-implementation
**Date:** 2026-03-29
**Author:** Architecture Review

---

## Overview

X (Twitter) Communities are private, interest-based groups on the platform where members can post content visible only within that community. This feature adds the ability for PostSyncer users to target a specific X Community when scheduling or publishing a tweet, rather than broadcasting to their main public timeline.

---

## 1. X API v2 — Communities Endpoints

### 1.1 Current API Availability

As of early 2026, the X API v2 Communities endpoints sit under **Basic and Pro access tiers** and are **not available on the Free tier**. There is no dedicated "list communities I belong to" REST endpoint in the public v2 surface — the data is exposed through the GraphQL-based **Syndication API** (internal) or via the `community_id` field accepted by the tweet creation endpoint.

#### What is documented and available

| Capability | Endpoint | Notes |
|---|---|---|
| Post to a community | `POST /2/tweets` with `community_id` field | Available at Basic+ tier |
| Look up a community | `GET /2/communities/:id` | Limited beta; not in public docs |
| List user communities | No public REST endpoint | Must be fetched via workaround |

#### The `community_id` tweet creation parameter

```http
POST https://api.twitter.com/2/tweets
Authorization: Bearer <user_access_token>
Content-Type: application/json

{
  "text": "Hello community!",
  "community_id": "1234567890123456789"
}
```

Tweets posted with `community_id` are visible only within that community. The `community_id` is a numeric string (snowflake ID). The response is the same `TweetResponse` shape as a normal tweet.

#### Fetching communities a user belongs to (workaround)

There is no stable REST endpoint for listing a user's communities. The practical approaches are:

1. **User-provided community IDs:** Ask the user to paste their community IDs (found in the URL: `x.com/i/communities/<id>`). This is the most reliable approach for production.
2. **Unofficial GraphQL scraping:** Fragile, violates ToS, not suitable for a commercial product.
3. **Polling the timeline:** Impractical.

**Recommendation:** Implement a user-managed community list — users paste their community ID and name into PostSyncer. Store these in the database with a display name. This is stable, compliant, and matches what tools like Buffer and Hypefury do.

### 1.2 Required OAuth 2.0 Scopes

The existing PostSyncer Twitter OAuth scopes are:
```
tweet.read  tweet.write  users.read
```

Posting to a community uses the same `POST /2/tweets` endpoint, so **no additional OAuth scopes are required**. The `community_id` field is accepted with existing `tweet.write` scope.

However, if/when X exposes a `communities.read` scope (currently in closed beta), it should be added to allow fetching community membership programmatically. The `PLATFORMS.TWITTER.scopes` array in `src/lib/social/platforms.ts` would need:

```diff
- scopes: ["tweet.read", "tweet.write", "users.read"],
+ scopes: ["tweet.read", "tweet.write", "users.read", "communities.read"],
```

Users who connected before the scope change would need to reconnect to grant the additional scope.

---

## 2. Database Schema Changes

### 2.1 New model: `XCommunity`

Store user-managed community entries per `SocialAccount`. These are not auto-fetched from the API; they are entered by users.

```prisma
model XCommunity {
  id              String        @id @default(cuid())
  socialAccountId String
  communityId     String        // X platform community snowflake ID
  name            String        // Display name entered by user
  description     String?
  isActive        Boolean       @default(true)
  verifiedAt      DateTime?     // last time we successfully posted to it
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  socialAccount SocialAccount @relation(fields: [socialAccountId], references: [id], onDelete: Cascade)
  postAccounts  PostAccount[]

  @@unique([socialAccountId, communityId])
  @@map("x_communities")
}
```

Add the inverse relation to `SocialAccount`:

```prisma
// Inside model SocialAccount
communities XCommunity[]
```

### 2.2 Extend `PostAccount` model

Add an optional reference to an `XCommunity`. When `communityId` is non-null on a `PostAccount` row, the publisher sends the tweet to that community instead of the public timeline.

```prisma
model PostAccount {
  id              String        @id @default(cuid())
  postId          String
  socialAccountId String
  status          PostStatus    @default(SCHEDULED)
  platformPostId  String?
  publishedAt     DateTime?
  failedAt        DateTime?
  failureReason   String?
  retryCount      Int           @default(0)

  // NEW: optional X Community targeting
  xCommunityId    String?       // FK → XCommunity.id (null = post to main timeline)

  post          Post          @relation(fields: [postId], references: [id], onDelete: Cascade)
  socialAccount SocialAccount @relation(fields: [socialAccountId], references: [id], onDelete: Cascade)
  xCommunity    XCommunity?   @relation(fields: [xCommunityId], references: [id], onDelete: SetNull)

  @@unique([postId, socialAccountId])
  @@map("post_accounts")
}
```

Add the inverse relation to `XCommunity`:

```prisma
// Inside model XCommunity
postAccounts PostAccount[]
```

### 2.3 Migration plan

```sql
-- Migration: add_x_communities

CREATE TABLE x_communities (
  id               TEXT PRIMARY KEY,
  social_account_id TEXT NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
  community_id     TEXT NOT NULL,
  name             TEXT NOT NULL,
  description      TEXT,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  verified_at      TIMESTAMP,
  created_at       TIMESTAMP NOT NULL DEFAULT now(),
  updated_at       TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE(social_account_id, community_id)
);

CREATE INDEX idx_x_communities_account ON x_communities(social_account_id);

ALTER TABLE post_accounts
  ADD COLUMN x_community_id TEXT REFERENCES x_communities(id) ON DELETE SET NULL;
```

---

## 3. API Endpoints

### 3.1 `GET /api/accounts/:id/communities`

List the X communities registered for a specific Twitter/X social account.

**File:** `src/app/api/accounts/[id]/communities/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

type Params = Promise<{ id: string }>;

export async function GET(req: NextRequest, { params }: { params: Params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: accountId } = await params;

  // Verify account belongs to a workspace where the user is a member
  const account = await db.socialAccount.findUnique({
    where: { id: accountId },
    include: {
      workspace: {
        include: {
          members: { where: { userId: session.user.id, status: "ACTIVE" } },
        },
      },
      communities: {
        where: { isActive: true },
        orderBy: { name: "asc" },
      },
    },
  });

  if (!account || account.workspace.members.length === 0) {
    return NextResponse.json({ error: "Not found or forbidden" }, { status: 404 });
  }

  if (account.platform !== "TWITTER") {
    return NextResponse.json(
      { error: "Communities are only available for X/Twitter accounts" },
      { status: 400 }
    );
  }

  return NextResponse.json({ communities: account.communities });
}
```

### 3.2 `POST /api/accounts/:id/communities`

Register a new community for a Twitter account. The user provides the community ID (from the URL) and a display name.

```typescript
export async function POST(req: NextRequest, { params }: { params: Params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: accountId } = await params;
  const body = await req.json();
  const { communityId, name, description } = body;

  if (!communityId || !name) {
    return NextResponse.json(
      { error: "communityId and name are required" },
      { status: 400 }
    );
  }

  // Validate communityId is numeric (snowflake)
  if (!/^\d+$/.test(communityId)) {
    return NextResponse.json(
      { error: "communityId must be a numeric snowflake ID" },
      { status: 400 }
    );
  }

  const account = await db.socialAccount.findUnique({
    where: { id: accountId },
    include: {
      workspace: {
        include: {
          members: { where: { userId: session.user.id, status: "ACTIVE" } },
        },
      },
    },
  });

  if (!account || account.workspace.members.length === 0) {
    return NextResponse.json({ error: "Not found or forbidden" }, { status: 404 });
  }

  if (account.platform !== "TWITTER") {
    return NextResponse.json(
      { error: "Communities are only available for X/Twitter accounts" },
      { status: 400 }
    );
  }

  // Require Admin+ to manage communities
  const membership = account.workspace.members[0];
  if (!["OWNER", "ADMIN", "MANAGER"].includes(membership.role)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const community = await db.xCommunity.upsert({
    where: { socialAccountId_communityId: { socialAccountId: accountId, communityId } },
    create: { socialAccountId: accountId, communityId, name, description, isActive: true },
    update: { name, description, isActive: true },
  });

  return NextResponse.json({ community }, { status: 201 });
}
```

### 3.3 `DELETE /api/accounts/:id/communities/:communityId`

Remove (soft-delete via `isActive: false`) a community from an account.

**File:** `src/app/api/accounts/[id]/communities/[communityId]/route.ts`

```typescript
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; communityId: string }> }
) {
  // ... auth + membership check (same as POST) ...

  await db.xCommunity.update({
    where: { id: params.communityId },
    data: { isActive: false },
  });

  return NextResponse.json({ success: true });
}
```

---

## 4. Composer UI — Community Selector

### 4.1 Component: `XCommunitySelector`

**File:** `src/components/posts/x-community-selector.tsx`

This component renders below the platform selector when exactly one Twitter account is selected. It shows a dropdown of registered communities plus a "Public timeline" (default) option.

```typescript
"use client";

import { useEffect, useState } from "react";
import { Users } from "lucide-react";

interface XCommunity {
  id: string;
  communityId: string;
  name: string;
  description?: string | null;
}

interface XCommunitySelectorProps {
  accountId: string;
  value: string | null;          // XCommunity.id or null for public timeline
  onChange: (id: string | null) => void;
}

export function XCommunitySelector({
  accountId,
  value,
  onChange,
}: XCommunitySelectorProps) {
  const [communities, setCommunities] = useState<XCommunity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/accounts/${accountId}/communities`)
      .then((r) => r.json())
      .then((data) => setCommunities(data.communities ?? []))
      .catch(() => setCommunities([]))
      .finally(() => setLoading(false));
  }, [accountId]);

  if (loading) return null;
  if (communities.length === 0) return null;

  return (
    <div className="flex items-center gap-2 mt-2">
      <Users className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      <span className="text-xs text-muted-foreground font-medium">Community:</span>
      <select
        className="flex-1 text-sm border rounded-md px-2 py-1 bg-background"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="">Public timeline</option>
        {communities.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}
```

### 4.2 Integration into `PostComposer`

**File:** `src/components/posts/post-composer.tsx`

Add community selection state and render the selector when a single Twitter account is selected:

```typescript
// New state in PostComposer
const [xCommunityId, setXCommunityId] = useState<string | null>(null);

// Determine if a single Twitter account is selected
const singleTwitterAccount =
  selectedAccounts.length === 1 && selectedAccounts[0].platform === "TWITTER"
    ? selectedAccounts[0]
    : null;

// Clear community selection when Twitter account is deselected
useEffect(() => {
  if (!singleTwitterAccount) {
    setXCommunityId(null);
  }
}, [singleTwitterAccount]);
```

Render below `<PlatformSelector>`:

```tsx
{singleTwitterAccount && (
  <XCommunitySelector
    accountId={singleTwitterAccount.id}
    value={xCommunityId}
    onChange={setXCommunityId}
  />
)}
```

Pass `xCommunityId` to the post creation payload:

```typescript
// In the form submission mutation payload
{
  content,
  selectedAccountIds,
  scheduledAt,
  // ... existing fields ...
  xCommunityId,   // new field — per-account community targeting
}
```

### 4.3 Form Schema Extension

In the `composeSchema` Zod schema:

```typescript
const composeSchema = z.object({
  // ... existing fields ...
  xCommunityId: z.string().nullable().optional(),
});
```

### 4.4 Community Management UI (Settings)

**File:** `src/app/(app)/settings/accounts/[id]/communities/page.tsx` (new page)

A settings page where users add/remove communities for each Twitter account. It shows a form with two fields:
- **Community ID** — numeric ID from the community URL
- **Display name** — human-readable label shown in the composer

A "Verify" button can attempt to post a test tweet to the community (or simply store the ID without verification for now).

---

## 5. Publishing Engine Changes

### 5.1 `PublishParams` extension

**File:** `src/lib/social/generic-publisher.ts`

```typescript
export interface PublishParams {
  content: string;
  mediaUrls?: string[];
  firstComment?: string;
  threadParts?: string[];
  isCarousel?: boolean;
  platformOptions?: Record<string, unknown>;
  /** X/Twitter: if set, post is sent to this community instead of public timeline */
  xCommunityId?: string;  // the platform-level community snowflake ID (not the DB id)
}
```

Note: the `xCommunityId` passed to `PublishParams` is the **X platform snowflake ID** (the `XCommunity.communityId` field), not the PostSyncer database UUID. The publishing job must resolve the DB record to the platform ID before calling the publisher.

### 5.2 `TweetPayload` extension

**File:** `src/lib/social/twitter.ts`

```typescript
interface TweetPayload {
  text: string;
  reply?: { in_reply_to_tweet_id: string };
  media?: { media_ids: string[] };
  community_id?: string;   // new field
}
```

### 5.3 `TwitterPublisher.publish()` changes

```typescript
async publish(params: PublishParams): Promise<PublishResult> {
  if (process.env.NODE_ENV === "development") {
    return {
      success: true,
      platformPostId: `mock_tweet_${Date.now()}`,
      platformPostUrl: `https://twitter.com/i/web/status/mock_${Date.now()}`,
    };
  }

  try {
    const { content, mediaUrls, threadParts, xCommunityId } = params;

    if (threadParts && threadParts.length > 0) {
      // Community threads: only the first tweet carries community_id.
      // Subsequent replies are threaded to it and inherit community context.
      return await this.publishThread([content, ...threadParts], mediaUrls, xCommunityId);
    }

    const mediaIds = mediaUrls && mediaUrls.length > 0
      ? await this.uploadMedia(mediaUrls)
      : undefined;

    const payload: TweetPayload = { text: content };
    if (mediaIds && mediaIds.length > 0) {
      payload.media = { media_ids: mediaIds };
    }
    if (xCommunityId) {
      payload.community_id = xCommunityId;
    }

    const res = await fetch(`${TWITTER_API_BASE}/tweets`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    // ... (existing status code handling unchanged) ...
  }
}
```

Update `publishThread` signature:

```typescript
private async publishThread(
  parts: string[],
  mediaUrls?: string[],
  communityId?: string   // new param — applied only to the first tweet
): Promise<PublishResult> {
  let lastTweetId: string | undefined;
  let firstTweetId: string | undefined;

  for (let i = 0; i < parts.length; i++) {
    const mediaIds =
      i === 0 && mediaUrls && mediaUrls.length > 0
        ? await this.uploadMedia(mediaUrls)
        : undefined;

    const payload: TweetPayload = { text: parts[i] };
    if (lastTweetId) {
      payload.reply = { in_reply_to_tweet_id: lastTweetId };
    }
    if (mediaIds && mediaIds.length > 0) {
      payload.media = { media_ids: mediaIds };
    }
    // Only the first tweet in the thread carries community_id
    if (i === 0 && communityId) {
      payload.community_id = communityId;
    }

    // ... (rest unchanged) ...
  }
}
```

### 5.4 Publishing job — resolving DB community ID to platform ID

Wherever the publishing job constructs `PublishParams` (e.g., in a `publishPost` service function), it must resolve the community:

```typescript
// Pseudocode for the publish job
const postAccount = await db.postAccount.findUnique({
  where: { id: postAccountId },
  include: { xCommunity: true },
});

const publishParams: PublishParams = {
  content: post.content,
  mediaUrls,
  threadParts: post.isThread ? resolveThreadParts(post) : undefined,
  // Pass the platform snowflake ID, not the PostSyncer DB UUID
  xCommunityId: postAccount.xCommunity?.communityId ?? undefined,
};
```

---

## 6. Error Handling

### 6.1 Community no longer exists / user was removed

When a tweet is posted to a non-existent or inaccessible community, the X API returns:

```json
{
  "detail": "You are not allowed to post to this community",
  "status": 403,
  "type": "https://api.twitter.com/2/problems/not-authorized-for-resource"
}
```

or a `404` if the community ID is completely invalid.

**Handling in `TwitterPublisher`:**

```typescript
if (res.status === 403) {
  const body = await res.json().catch(() => ({ detail: "" }));
  const isCommunityError =
    typeof body.detail === "string" &&
    body.detail.toLowerCase().includes("community");

  if (isCommunityError) {
    return {
      success: false,
      error: `Community posting forbidden: ${body.detail}. The community may no longer exist or you may have been removed.`,
      // Do NOT set authExpired — the account itself is fine
    };
  }
  return { success: false, error: "Twitter auth error", authExpired: true };
}
```

**Post-failure cleanup:** After a community-related failure, the publishing job should:

1. Mark the `PostAccount` as `FAILED` with `failureReason` set to the error detail.
2. Optionally soft-delete (`isActive: false`) the `XCommunity` record to prevent future attempts.
3. Surface a notification to the workspace with a link to the community settings page.

### 6.2 User not a community member (pre-validation)

Before scheduling a post to a community, the composer should warn (but not block) if the community `verifiedAt` is null — meaning it has never been used successfully and might be invalid.

```tsx
{selectedCommunity && !selectedCommunity.verifiedAt && (
  <p className="text-xs text-amber-600 mt-1">
    This community has not been verified. Make sure you are a member before publishing.
  </p>
)}
```

### 6.3 API tier restrictions

If the workspace is on Free tier (no X API Basic access), community posting should be gated:

```typescript
// In the post creation API route
if (xCommunityId && plan === "FREE") {
  return NextResponse.json(
    { error: "Community posting requires a Pro plan or higher" },
    { status: 403 }
  );
}
```

---

## 7. Limitations and Caveats

### 7.1 No community discovery API

X does not expose a public REST endpoint to list communities a user belongs to. Users must manually enter community IDs. The community ID is visible in the browser URL when visiting a community: `https://x.com/i/communities/1234567890123456789`.

### 7.2 Communities API access tier

Posting with `community_id` requires **Basic access** ($100/month) or higher on the X API. Free tier developers cannot use this feature. Apps using the v2 Free tier will receive a `403` error when attempting community posts.

### 7.3 Thread behavior in communities

Only the first tweet of a thread needs `community_id`. Subsequent replies that reference `in_reply_to_tweet_id` inherit the community context automatically. If the first tweet's community post fails, the entire thread fails (do not attempt subsequent parts).

### 7.4 Community posts are not indexed or searchable

Community posts do not appear in public timelines, search results, or hashtag feeds. Analytics tools (including PostSyncer's analytics module) may see reduced or zero impressions for community posts because the X API does not return community-scoped metrics through the standard analytics endpoints.

### 7.5 One community per post-account pair

The current design supports targeting one community per Twitter account per post. A user cannot post the same content to multiple communities simultaneously in one PostSyncer post. To do this, users must create multiple posts or duplicate the post for each target community. This is a deliberate simplification; multi-community targeting can be added later.

### 7.6 Community membership changes

Community membership can change outside of PostSyncer (user leaves, is removed, community is deleted). Scheduled posts have no way to detect this in advance. The failure handling described in section 6.1 is the primary mitigation.

---

## 8. Implementation Checklist

### Phase 1 — Backend Foundation
- [ ] Add `XCommunity` model to `prisma/schema.prisma`
- [ ] Add `xCommunityId` FK to `PostAccount` model
- [ ] Run `prisma migrate dev --name add_x_communities`
- [ ] Implement `GET /api/accounts/[id]/communities/route.ts`
- [ ] Implement `POST /api/accounts/[id]/communities/route.ts`
- [ ] Implement `DELETE /api/accounts/[id]/communities/[communityId]/route.ts`

### Phase 2 — Publishing Engine
- [ ] Add `xCommunityId?: string` to `PublishParams` interface
- [ ] Add `community_id?: string` to `TweetPayload` interface in `twitter.ts`
- [ ] Update `TwitterPublisher.publish()` to pass `community_id` in payload
- [ ] Update `publishThread()` signature and logic for community first-tweet targeting
- [ ] Update 403 error handling to distinguish community errors from auth errors
- [ ] Update publishing job to resolve `XCommunity.communityId` from `PostAccount.xCommunityId`
- [ ] Update `verifiedAt` on successful community post

### Phase 3 — Composer UI
- [ ] Create `src/components/posts/x-community-selector.tsx`
- [ ] Extend `composeSchema` with `xCommunityId` field
- [ ] Add `xCommunityId` state to `PostComposer`
- [ ] Render `XCommunitySelector` when a single Twitter account is selected
- [ ] Pass `xCommunityId` to the post creation API payload
- [ ] Add "unverified community" warning badge in composer

### Phase 4 — Settings Page
- [ ] Create community management page at `src/app/(app)/settings/accounts/[id]/communities/page.tsx`
- [ ] Add community list with add/remove UI
- [ ] Link from account settings page

### Phase 5 — Plan Gating
- [ ] Add community posting check to post creation API (require PRO+ plan)
- [ ] Show upgrade prompt in composer if on Free plan and community is selected

---

## 9. File Change Summary

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add `XCommunity` model, add `xCommunityId` to `PostAccount` |
| `src/lib/social/generic-publisher.ts` | Add `xCommunityId` to `PublishParams` |
| `src/lib/social/twitter.ts` | Add `community_id` to `TweetPayload`, update `publish()` and `publishThread()` |
| `src/app/api/accounts/[id]/communities/route.ts` | New — GET + POST handlers |
| `src/app/api/accounts/[id]/communities/[communityId]/route.ts` | New — DELETE handler |
| `src/components/posts/x-community-selector.tsx` | New — community dropdown component |
| `src/components/posts/post-composer.tsx` | Add community state + render `XCommunitySelector` |
| `src/app/(app)/settings/accounts/[id]/communities/page.tsx` | New — community management settings page |
