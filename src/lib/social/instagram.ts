// ─── Instagram Publisher ──────────────────────────────────────────────────────
// Uses the Meta Graph API (instagram_basic + instagram_content_publish scopes).
// Publishing is a two-step process:
//   1. Create a media container (image / video / carousel item)
//   2. Publish the container to the feed
//
// Carousel posts require one container per slide, then a final carousel container.

import type { SocialPublisher, PublishParams, PublishResult } from "./generic-publisher";

const GRAPH_API = "https://graph.facebook.com/v18.0";
const POLL_INTERVAL_MS = 3_000;
const POLL_MAX_ATTEMPTS = 20; // ~1 minute total wait for video processing

// ─── Types ────────────────────────────────────────────────────────────────────

interface ContainerResponse {
  id: string;
}

interface StatusResponse {
  status_code: "FINISHED" | "IN_PROGRESS" | "ERROR" | "EXPIRED";
  id: string;
}

interface PublishResponse {
  id: string;
}

// ─── Class ────────────────────────────────────────────────────────────────────

export class InstagramPublisher implements SocialPublisher {
  /**
   * @param accessToken  Page/IG User access token
   * @param instagramId  The Instagram Business/Creator account ID (not the Page ID)
   */
  constructor(
    private readonly accessToken: string,
    private readonly instagramId: string
  ) {}

  async publish(params: PublishParams): Promise<PublishResult> {
    if (process.env.NODE_ENV === "development") {
      return {
        success: true,
        platformPostId: `mock_ig_${Date.now()}`,
        platformPostUrl: `https://www.instagram.com/p/mock_${Date.now()}/`,
      };
    }

    try {
      const { content, mediaUrls, isCarousel } = params;

      if (isCarousel && mediaUrls && mediaUrls.length > 1) {
        return await this.publishCarousel(content, mediaUrls);
      }

      if (mediaUrls && mediaUrls.length > 0) {
        const url = mediaUrls[0];
        const isVideo = this.isVideoUrl(url);
        return isVideo
          ? await this.publishVideo(content, url)
          : await this.publishImage(content, url);
      }

      // Text-only posts are not supported by IG — publish as a text-only reel caption
      // is also not allowed. Return a clear error.
      return {
        success: false,
        error: "Instagram requires at least one image or video to publish.",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Instagram publish error: ${message}` };
    }
  }

  // ── Single image ─────────────────────────────────────────────────────────────

  private async publishImage(caption: string, imageUrl: string): Promise<PublishResult> {
    const container = await this.createContainer({
      image_url: imageUrl,
      caption,
    });

    const published = await this.publishContainer(container.id);
    return {
      success: true,
      platformPostId: published.id,
      platformPostUrl: `https://www.instagram.com/p/${published.id}/`,
    };
  }

  // ── Single video / reel ──────────────────────────────────────────────────────

  private async publishVideo(caption: string, videoUrl: string): Promise<PublishResult> {
    const container = await this.createContainer({
      media_type: "REELS",
      video_url: videoUrl,
      caption,
    });

    await this.waitForContainerReady(container.id);
    const published = await this.publishContainer(container.id);
    return {
      success: true,
      platformPostId: published.id,
      platformPostUrl: `https://www.instagram.com/p/${published.id}/`,
    };
  }

  // ── Carousel ─────────────────────────────────────────────────────────────────

  private async publishCarousel(
    caption: string,
    mediaUrls: string[]
  ): Promise<PublishResult> {
    // Step 1: Create one container per slide (up to 10)
    const slideIds: string[] = [];
    for (const url of mediaUrls.slice(0, 10)) {
      const isVideo = this.isVideoUrl(url);
      const slide = await this.createContainer(
        isVideo
          ? { media_type: "VIDEO", video_url: url, is_carousel_item: true }
          : { image_url: url, is_carousel_item: true }
      );
      if (isVideo) await this.waitForContainerReady(slide.id);
      slideIds.push(slide.id);
    }

    // Step 2: Create the carousel container
    const carousel = await this.createContainer({
      media_type: "CAROUSEL",
      caption,
      children: slideIds.join(","),
    });

    // Step 3: Publish
    const published = await this.publishContainer(carousel.id);
    return {
      success: true,
      platformPostId: published.id,
      platformPostUrl: `https://www.instagram.com/p/${published.id}/`,
    };
  }

  // ── Graph API helpers ─────────────────────────────────────────────────────────

  private async createContainer(
    fields: Record<string, string | boolean>
  ): Promise<ContainerResponse> {
    const params = new URLSearchParams({
      access_token: this.accessToken,
      ...Object.fromEntries(
        Object.entries(fields).map(([k, v]) => [k, String(v)])
      ),
    });

    const res = await fetch(
      `${GRAPH_API}/${this.instagramId}/media`,
      { method: "POST", body: params }
    );

    if (res.status === 401 || res.status === 403) {
      throw Object.assign(new Error("Instagram auth error"), { authExpired: true });
    }

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Instagram container creation failed ${res.status}: ${body}`);
    }

    return res.json();
  }

  private async publishContainer(containerId: string): Promise<PublishResponse> {
    const params = new URLSearchParams({
      access_token: this.accessToken,
      creation_id: containerId,
    });

    const res = await fetch(
      `${GRAPH_API}/${this.instagramId}/media_publish`,
      { method: "POST", body: params }
    );

    if (res.status === 401 || res.status === 403) {
      throw Object.assign(new Error("Instagram auth error"), { authExpired: true });
    }

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Instagram publish failed ${res.status}: ${body}`);
    }

    return res.json();
  }

  private async waitForContainerReady(containerId: string): Promise<void> {
    for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

      const res = await fetch(
        `${GRAPH_API}/${containerId}?fields=status_code&access_token=${this.accessToken}`
      );

      if (!res.ok) continue;

      const data: StatusResponse = await res.json();

      if (data.status_code === "FINISHED") return;
      if (data.status_code === "ERROR" || data.status_code === "EXPIRED") {
        throw new Error(`Instagram video container status: ${data.status_code}`);
      }
      // IN_PROGRESS — keep polling
    }

    throw new Error("Timed out waiting for Instagram video container to process.");
  }

  private isVideoUrl(url: string): boolean {
    return /\.(mp4|mov|avi|mkv|webm)(\?|$)/i.test(url);
  }
}
