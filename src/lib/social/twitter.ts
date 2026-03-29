// ─── Twitter / X Publisher ────────────────────────────────────────────────────
// Uses Twitter API v2.
// Supports plain tweets, media uploads, and thread (multi-tweet) creation.

import type { SocialPublisher, PublishParams, PublishResult } from "./generic-publisher";

const TWITTER_API_BASE = "https://api.twitter.com/2";
const TWITTER_UPLOAD_BASE = "https://upload.twitter.com/1.1";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TweetPayload {
  text: string;
  reply?: { in_reply_to_tweet_id: string };
  media?: { media_ids: string[] };
}

interface TweetResponse {
  data: { id: string; text: string };
}

interface MediaUploadResponse {
  media_id_string: string;
}

// ─── Class ────────────────────────────────────────────────────────────────────

export class TwitterPublisher implements SocialPublisher {
  constructor(private readonly accessToken: string) {}

  async publish(params: PublishParams): Promise<PublishResult> {
    // Development: return mock result without hitting the API
    if (process.env.NODE_ENV === "development") {
      return {
        success: true,
        platformPostId: `mock_tweet_${Date.now()}`,
        platformPostUrl: `https://twitter.com/i/web/status/mock_${Date.now()}`,
      };
    }

    try {
      const { content, mediaUrls, threadParts } = params;

      // If this is a thread (multiple parts), post each in reply to the last
      if (threadParts && threadParts.length > 0) {
        return await this.publishThread([content, ...threadParts], mediaUrls);
      }

      // Upload media first if provided
      const mediaIds = mediaUrls && mediaUrls.length > 0
        ? await this.uploadMedia(mediaUrls)
        : undefined;

      const payload: TweetPayload = { text: content };
      if (mediaIds && mediaIds.length > 0) {
        payload.media = { media_ids: mediaIds };
      }

      const res = await fetch(`${TWITTER_API_BASE}/tweets`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (res.status === 429) {
        const retryAfterSec = parseInt(res.headers.get("x-rate-limit-reset") ?? "60", 10);
        return {
          success: false,
          error: "Twitter rate limit reached",
          retryAfter: new Date(retryAfterSec * 1000),
        };
      }

      if (res.status === 401 || res.status === 403) {
        return { success: false, error: "Twitter auth error", authExpired: true };
      }

      if (!res.ok) {
        const body = await res.text();
        return { success: false, error: `Twitter API error ${res.status}: ${body}` };
      }

      const data: TweetResponse = await res.json();
      return {
        success: true,
        platformPostId: data.data.id,
        platformPostUrl: `https://twitter.com/i/web/status/${data.data.id}`,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Twitter publish error: ${message}` };
    }
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private async publishThread(
    parts: string[],
    mediaUrls?: string[]
  ): Promise<PublishResult> {
    let lastTweetId: string | undefined;
    let firstTweetId: string | undefined;

    for (let i = 0; i < parts.length; i++) {
      // Only attach media to the first tweet in the thread
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

      const res = await fetch(`${TWITTER_API_BASE}/tweets`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (res.status === 429) {
        const retryAfterSec = parseInt(res.headers.get("x-rate-limit-reset") ?? "60", 10);
        return {
          success: false,
          error: "Twitter rate limit during thread",
          retryAfter: new Date(retryAfterSec * 1000),
        };
      }

      if (res.status === 401 || res.status === 403) {
        return { success: false, error: "Twitter auth error during thread", authExpired: true };
      }

      if (!res.ok) {
        const body = await res.text();
        return { success: false, error: `Twitter thread error at part ${i + 1}: ${body}` };
      }

      const data: TweetResponse = await res.json();
      lastTweetId = data.data.id;
      if (i === 0) firstTweetId = data.data.id;
    }

    return {
      success: true,
      platformPostId: firstTweetId,
      platformPostUrl: `https://twitter.com/i/web/status/${firstTweetId}`,
    };
  }

  private async uploadMedia(mediaUrls: string[]): Promise<string[]> {
    const ids: string[] = [];

    for (const url of mediaUrls.slice(0, 4)) {
      // Fetch the media bytes from the public URL
      const mediaRes = await fetch(url);
      if (!mediaRes.ok) {
        throw new Error(`Failed to fetch media for upload: ${url}`);
      }
      const buffer = await mediaRes.arrayBuffer();
      const contentType = mediaRes.headers.get("content-type") ?? "image/jpeg";

      // Use Twitter v1.1 simple upload endpoint
      const formData = new FormData();
      formData.append(
        "media",
        new Blob([buffer], { type: contentType }),
        "media"
      );

      const uploadRes = await fetch(
        `${TWITTER_UPLOAD_BASE}/media/upload.json`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${this.accessToken}` },
          body: formData,
        }
      );

      if (!uploadRes.ok) {
        const text = await uploadRes.text();
        throw new Error(`Twitter media upload failed: ${text}`);
      }

      const uploadData: MediaUploadResponse = await uploadRes.json();
      ids.push(uploadData.media_id_string);
    }

    return ids;
  }
}
