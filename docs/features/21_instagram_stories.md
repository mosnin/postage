# 21. Instagram Stories Scheduling

## 1. Overview

Allow scheduling Instagram Stories (single image or video, 9:16 format, 24h TTL).
Stories are ephemeral by nature; PostSyncer queues and publishes them at the scheduled
time via the Instagram Graph API container flow, identical to feed posts with one
additional parameter.

## 2. PostType Extension

Add `postType` to the `Post` model (or `PostAccount` for per-platform overrides):

```prisma
enum PostType {
  FEED
  STORY
  REEL
}

model Post {
  // ... existing fields
  postType PostType @default(FEED)
}
```

Migration: `npx prisma migrate dev --name add_post_type_enum`

No existing rows are affected — the default value keeps all current posts as `FEED`.

## 3. Instagram Graph API Flow

Stories use the same 2-step container flow as feed posts.

### Step 1 — Create media container

```
POST https://graph.facebook.com/v19.0/{ig-user-id}/media
  ?image_url=<CDN_URL>          # or video_url for VIDEO
  &media_type=IMAGE             # IMAGE | VIDEO
  &is_stories=true              # Stories-specific flag
  &access_token={token}
```

Response: `{ "id": "<container_id>" }`

### Step 2 — Publish container

```
POST https://graph.facebook.com/v19.0/{ig-user-id}/media_publish
  ?creation_id=<container_id>
  &access_token={token}
```

Response: `{ "id": "<media_id>" }`

### Stories constraints

| Property | Limit |
|----------|-------|
| Image formats | JPG, PNG |
| Image size | Max 8 MB |
| Image dimensions | 1080x1920 px (9:16) recommended |
| Video formats | MP4, MOV |
| Video duration | Max 60 seconds |
| Video size | Max 100 MB |
| TTL | Expires automatically after 24 hours |

> Note: `caption` is ignored by the API for Stories; do not expose the field in the
> Story composer UI to avoid user confusion.

## 4. Publisher Code

Extend `InstagramPublisher` (e.g. `lib/publishers/instagram.ts`):

```typescript
async publishStory(params: {
  mediaUrl: string;
  mediaType: 'IMAGE' | 'VIDEO';
}) {
  // Step 1: Create container
  const container = await this.createMediaContainer({
    media_url: params.mediaUrl,
    media_type: params.mediaType,
    is_stories: true,
  });

  // Step 2: Poll until container status is FINISHED (required for VIDEO)
  if (params.mediaType === 'VIDEO') {
    await this.waitForContainer(container.id);
  }

  // Step 3: Publish
  return this.publishContainer(container.id);
}
```

Update the top-level `publish(post)` dispatcher to branch on `post.postType`:

```typescript
switch (post.postType) {
  case 'STORY': return publisher.publishStory(params);
  case 'REEL':  return publisher.publishReel(params);
  default:      return publisher.publishFeed(params);
}
```

## 5. Composer UI Changes

- **PostType toggle** — render only when Instagram is among the selected accounts:
  `"Feed Post" | "Story" | "Reel"` (segmented control / tab strip)
- **Story preview** — phone frame mockup:
  ```tsx
  <div className="relative w-[375px] h-[667px] border-4 border-gray-800 rounded-3xl overflow-hidden bg-black">
    <MediaPreview src={mediaUrl} className="object-cover w-full h-full" />
  </div>
  ```
- **Media validation** — warn (non-blocking) when selected media deviates from 9:16:
  ```typescript
  const ratio = width / height;
  if (Math.abs(ratio - (9 / 16)) > 0.05) {
    setWarning('Best results at 1080x1920 px (9:16 aspect ratio).');
  }
  ```
- **Caption field** — hide when `postType === 'STORY'` (API ignores it).
- **Scheduling** — no UI changes needed; existing date/time picker works unchanged.

## 6. Limitations

- Interactive stickers (polls, questions, sliders, quizzes) are not available via the
  Graph API and cannot be scheduled.
- Instagram Highlights management is not supported via the API.
- Reels require `media_type=REELS` and a separate `publishReel()` method (out of scope
  for this feature; tracked separately).
- Stories cannot be cross-posted to Facebook Pages via the same container call.
- The API does not support scheduling a Story directly; PostSyncer's job queue handles
  the delay and calls `publishStory()` at the target time.

## 7. Analytics

Stories insights endpoint:

```
GET /{media-id}/insights
  ?metric=reach,impressions,replies,exits,taps_forward,taps_back
  &access_token={token}
```

Extend `PostAnalytics` (or `AnalyticsSnapshot`) with a `storyMetrics` JSON field:

```prisma
model PostAnalytics {
  // ... existing fields
  storyMetrics Json? // null for non-Story posts
}
```

Shape of `storyMetrics`:

```typescript
interface StoryMetrics {
  reach:        number;
  impressions:  number;
  replies:      number;
  exits:        number;
  tapsForward:  number;
  tapsBack:     number;
  /** Derived: percentage of viewers who exited early */
  exitRate:     number;
}
```

Fetch insights 1 hour after publish (Stories insights are not immediately available)
via a delayed job. Since Stories expire after 24 hours, insights must be pulled within
that window — schedule the analytics job for T+2h and T+23h to capture both early and
final numbers.
