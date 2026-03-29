# 22. TikTok Features (PostSyncer)

## 1. TikTok Content Posting API v2

Base URL: `https://open.tiktokapis.com/v2/post/publish/`

Two flows:
- **Direct Post**: upload video directly (max 4GB, max 10min)
- **Content Posting**: provide a publicly accessible video URL

Required OAuth scopes: `video.publish`, `video.upload`

## 2. TikTokPublisher Class

```typescript
// src/lib/social/tiktok.ts
export class TikTokPublisher implements SocialPublisher {
  async publish(params: PublishParams): Promise<PublishResult> {
    const { content, mediaUrls, accountToken, tiktokOptions } = params;

    // Step 1: Initialize upload
    const init = await this.initializeVideoUpload(accountToken, {
      post_info: {
        title: content.substring(0, 150),
        privacy_level: tiktokOptions?.privacyLevel ?? 'PUBLIC_TO_EVERYONE',
        disable_duet: tiktokOptions?.disableDuet ?? false,
        disable_stitch: tiktokOptions?.disableStitch ?? false,
        disable_comment: tiktokOptions?.disableComment ?? false,
        video_cover_timestamp_ms: 0,
        brand_content_toggle: tiktokOptions?.brandContent ?? false,
      },
      source_info: { source: 'PULL_FROM_URL', video_url: mediaUrls[0] }
    });

    // Step 2: Poll for status
    return this.pollPublishStatus(init.publish_id, accountToken);
  }

  private async initializeVideoUpload(
    token: string,
    body: object
  ): Promise<{ publish_id: string }> {
    const res = await fetch(
      'https://open.tiktokapis.com/v2/post/publish/video/init/',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json; charset=UTF-8',
        },
        body: JSON.stringify(body),
      }
    );
    const json = await res.json();
    if (json.error?.code !== 'ok') throw new TikTokApiError(json.error);
    return json.data;
  }

  private async pollPublishStatus(
    publishId: string,
    token: string
  ): Promise<PublishResult> {
    const maxAttempts = 20;
    for (let i = 0; i < maxAttempts; i++) {
      await sleep(3000);
      const res = await fetch(
        'https://open.tiktokapis.com/v2/post/publish/status/fetch/',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({ publish_id: publishId }),
        }
      );
      const json = await res.json();
      const status = json.data?.status;
      if (status === 'PUBLISH_COMPLETE') {
        return { success: true, platformPostId: json.data.publicaly_available_post_id?.[0] };
      }
      if (status === 'FAILED') throw new TikTokApiError(json.data.fail_reason);
    }
    throw new Error('TikTok publish polling timed out');
  }
}
```

## 3. TikTok-Specific Post Options

Store in `PostAccount.metadata` JSON:

```typescript
type TikTokOptions = {
  privacyLevel: 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'FOLLOWER_OF_CREATOR' | 'SELF_ONLY';
  disableDuet: boolean;
  disableStitch: boolean;
  disableComment: boolean;
  brandContent: boolean;        // requires disclosure if true
  brandOrganicToggle: boolean;  // organic brand content
};
```

`privacyLevel` defaults to `PUBLIC_TO_EVERYONE`. `brandContent: true` must surface
TikTok's required disclosure warning in the composer UI.

## 4. Video Requirements

| Property        | Requirement                                   |
|-----------------|-----------------------------------------------|
| Format          | MP4 or WebM                                   |
| Duration        | 3s – 10 min (standard); longer with allowlist |
| Max file size   | 4 GB                                          |
| Aspect ratio    | 9:16 recommended; 1:1 and 16:9 supported      |
| Min resolution  | 360p                                          |
| Min frame rate  | 23 FPS                                        |

Validate duration and size client-side before initiating upload to avoid wasted API calls.

## 5. Caption Strategy

- Max **2200 characters** for the description field (vs 150 for the `title` field)
- **3–5 hashtags** recommended; avoid hashtag stuffing (>10 hashtags reduces reach)
- `@mentions` supported and resolve to linked profiles
- Emojis encouraged — they improve engagement rate on FYP
- The `title` field (max 150 chars) is separate from the caption and displayed as the
  video title in search; populate it from the first sentence of the caption

## 6. TikTok Analytics

Fetch via `POST /v2/video/query/` with a `fields` list:

```typescript
const TIKTOK_METRICS = [
  'view_count',
  'like_count',
  'comment_count',
  'share_count',
  'reach',
  'video_views_by_section',   // FYP | Following | Search | Profile
  'average_watch_time',
  'full_video_watched_rate',
] as const;
```

Store results in `PostAnalytics.platformMetrics` JSON field keyed by metric name.
`video_views_by_section` breaks down discovery source — useful for content strategy
insights shown in the analytics dashboard.

## 7. Composer UI Additions

When a TikTok account is selected show a **TikTok Settings** panel containing:

1. **Privacy level** — dropdown with four options (Public / Friends / Followers / Only me)
2. **Allow Duet** — toggle (default on)
3. **Allow Stitch** — toggle (default on)
4. **Allow Comments** — toggle (default on)
5. **Brand content disclosure** — checkbox; when checked show TikTok's required
   disclosure copy: _"Your video will be labeled 'Paid partnership'"_
6. **Video duration indicator** — derived from the attached video file; warn if < 3s

Caption field should accept up to 2200 characters with a live counter.
Title field (optional override) accepts up to 150 characters.

## 8. Limitations

- **Video only** — image posts are not supported via the Content Posting API
- **No carousel posts** — single video per publish call
- **TikTok for Business / developer account required** — personal accounts cannot use
  the API; surface a clear error if the connected account lacks the necessary role
- **Rate limit** — 1 000 requests/day per app; surface remaining quota in admin panel
- **Scheduled posts** — the API does not support a `scheduled_publish_time` parameter;
  scheduling must be handled by PostSyncer's own job queue

## 9. Error Handling

| TikTok error code         | Meaning                          | Action                                      |
|---------------------------|----------------------------------|---------------------------------------------|
| `access_token.invalid`    | Token expired or revoked         | Trigger OAuth refresh; re-queue post        |
| `spam.risk`               | Account flagged for spam         | Surface to user; suggest waiting 24 h       |
| `video.size.exceeded`     | File > 4 GB                      | Validate before upload; reject in composer  |
| `video.duration.invalid`  | Video < 3s or > max duration     | Validate client-side; show inline error     |
| `permission.denied`       | Missing `video.publish` scope    | Prompt user to reconnect account            |
| `rate_limit_exceeded`     | Daily app quota exhausted        | Delay post to next day; notify user         |

All errors should be stored in `PostPublish.errorLog` JSON and surfaced in the
post detail view with a human-readable description and a suggested remediation step.
