// ─── Facebook Publisher ───────────────────────────────────────────────────────
// Uses Meta Graph API v18.
// Publishes to a Facebook Page feed.
// Supports: text posts, single photo, multi-photo (batch upload).

import type { SocialPublisher, PublishParams, PublishResult } from "./generic-publisher";

const GRAPH_API = "https://graph.facebook.com/v18.0";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PhotoUploadResponse {
  id: string;
}

interface FeedPostResponse {
  id: string;
}

// ─── Class ────────────────────────────────────────────────────────────────────

export class FacebookPublisher implements SocialPublisher {
  /**
   * @param accessToken  Page access token
   * @param pageId       Facebook Page ID
   */
  constructor(
    private readonly accessToken: string,
    private readonly pageId: string
  ) {}

  async publish(params: PublishParams): Promise<PublishResult> {
    if (process.env.NODE_ENV === "development") {
      return {
        success: true,
        platformPostId: `mock_fb_${Date.now()}`,
        platformPostUrl: `https://www.facebook.com/mock_${Date.now()}`,
      };
    }

    try {
      const { content, mediaUrls } = params;

      if (mediaUrls && mediaUrls.length > 1) {
        return await this.publishMultiPhoto(content, mediaUrls);
      }

      if (mediaUrls && mediaUrls.length === 1) {
        return await this.publishPhoto(content, mediaUrls[0]);
      }

      return await this.publishText(content);
    } catch (err) {
      const isAuthError =
        err instanceof Error &&
        (err as Error & { authExpired?: boolean }).authExpired;

      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: `Facebook publish error: ${message}`,
        authExpired: isAuthError,
      };
    }
  }

  // ── Text-only post ───────────────────────────────────────────────────────────

  private async publishText(message: string): Promise<PublishResult> {
    const params = new URLSearchParams({
      access_token: this.accessToken,
      message,
    });

    const res = await this.apiFetch(
      `${GRAPH_API}/${this.pageId}/feed`,
      { method: "POST", body: params }
    );

    const data: FeedPostResponse = await res.json();
    return {
      success: true,
      platformPostId: data.id,
      platformPostUrl: `https://www.facebook.com/${data.id}`,
    };
  }

  // ── Single photo post ────────────────────────────────────────────────────────

  private async publishPhoto(
    message: string,
    photoUrl: string
  ): Promise<PublishResult> {
    const params = new URLSearchParams({
      access_token: this.accessToken,
      url: photoUrl,
      caption: message,
    });

    const res = await this.apiFetch(
      `${GRAPH_API}/${this.pageId}/photos`,
      { method: "POST", body: params }
    );

    const data: PhotoUploadResponse = await res.json();
    return {
      success: true,
      platformPostId: data.id,
      platformPostUrl: `https://www.facebook.com/photo/?fbid=${data.id}`,
    };
  }

  // ── Multi-photo post (carousel-style via /feed with attached_media) ───────────

  private async publishMultiPhoto(
    message: string,
    photoUrls: string[]
  ): Promise<PublishResult> {
    // Step 1: Upload each photo as unpublished
    const mediaFbids: string[] = [];
    for (const url of photoUrls.slice(0, 10)) {
      const uploadParams = new URLSearchParams({
        access_token: this.accessToken,
        url,
        published: "false",
      });

      const uploadRes = await this.apiFetch(
        `${GRAPH_API}/${this.pageId}/photos`,
        { method: "POST", body: uploadParams }
      );

      const uploadData: PhotoUploadResponse = await uploadRes.json();
      mediaFbids.push(uploadData.id);
    }

    // Step 2: Create a single post that references all uploaded photos
    const feedBody: Record<string, unknown> = {
      access_token: this.accessToken,
      message,
      attached_media: mediaFbids.map((id) => ({ media_fbid: id })),
    };

    const res = await this.apiFetch(
      `${GRAPH_API}/${this.pageId}/feed`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(feedBody),
      }
    );

    const data: FeedPostResponse = await res.json();
    return {
      success: true,
      platformPostId: data.id,
      platformPostUrl: `https://www.facebook.com/${data.id}`,
    };
  }

  // ── Fetch wrapper ────────────────────────────────────────────────────────────

  private async apiFetch(url: string, init: RequestInit): Promise<Response> {
    const res = await fetch(url, init);

    if (res.status === 401 || res.status === 403) {
      throw Object.assign(new Error("Facebook auth error"), { authExpired: true });
    }

    if (res.status === 429) {
      throw new Error("Facebook rate limit reached");
    }

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Facebook API error ${res.status}: ${body}`);
    }

    return res;
  }
}
