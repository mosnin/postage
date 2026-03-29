// ─── LinkedIn Publisher ───────────────────────────────────────────────────────
// Uses LinkedIn API v2 — UGC Posts endpoint.
// Supports text-only posts and single-image posts.

import type { SocialPublisher, PublishParams, PublishResult } from "./generic-publisher";

const LINKEDIN_API = "https://api.linkedin.com/v2";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RegisterUploadRequest {
  registerUploadRequest: {
    recipes: string[];
    owner: string;
    serviceRelationships: Array<{
      relationshipType: string;
      identifier: string;
    }>;
  };
}

interface RegisterUploadResponse {
  value: {
    uploadMechanism: {
      "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest": {
        uploadUrl: string;
      };
    };
    asset: string;
  };
}

interface UgcPostPayload {
  author: string;
  lifecycleState: "PUBLISHED";
  specificContent: {
    "com.linkedin.ugc.ShareContent": {
      shareCommentary: { text: string };
      shareMediaCategory: "NONE" | "IMAGE";
      media?: Array<{
        status: "READY";
        media: string;
        title?: { text: string };
      }>;
    };
  };
  visibility: {
    "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC";
  };
}

interface UgcPostResponse {
  id: string;
}

// ─── Class ────────────────────────────────────────────────────────────────────

export class LinkedInPublisher implements SocialPublisher {
  /**
   * @param accessToken  OAuth 2.0 access token with w_member_social scope
   * @param personUrn    The LinkedIn member URN, e.g. "urn:li:person:XXXXXXXX"
   */
  constructor(
    private readonly accessToken: string,
    private readonly personUrn: string
  ) {}

  async publish(params: PublishParams): Promise<PublishResult> {
    if (process.env.NODE_ENV === "development") {
      return {
        success: true,
        platformPostId: `mock_li_${Date.now()}`,
        platformPostUrl: `https://www.linkedin.com/feed/update/urn:li:share:mock_${Date.now()}/`,
      };
    }

    try {
      const { content, mediaUrls } = params;

      const imageUrn =
        mediaUrls && mediaUrls.length > 0
          ? await this.uploadImage(mediaUrls[0])
          : undefined;

      const postId = await this.createUgcPost(content, imageUrn);

      return {
        success: true,
        platformPostId: postId,
        platformPostUrl: `https://www.linkedin.com/feed/update/${postId}/`,
      };
    } catch (err) {
      const isAuthError =
        err instanceof Error &&
        (err as Error & { authExpired?: boolean }).authExpired;

      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: `LinkedIn publish error: ${message}`,
        authExpired: isAuthError,
      };
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private async uploadImage(imageUrl: string): Promise<string> {
    // Step 1: Register the upload
    const registerBody: RegisterUploadRequest = {
      registerUploadRequest: {
        recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
        owner: this.personUrn,
        serviceRelationships: [
          {
            relationshipType: "OWNER",
            identifier: "urn:li:userGeneratedContent",
          },
        ],
      },
    };

    const registerRes = await this.apiFetch(
      `${LINKEDIN_API}/assets?action=registerUpload`,
      {
        method: "POST",
        body: JSON.stringify(registerBody),
      }
    );

    const registerData: RegisterUploadResponse = await registerRes.json();
    const uploadUrl =
      registerData.value.uploadMechanism[
        "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"
      ].uploadUrl;
    const asset = registerData.value.asset;

    // Step 2: Fetch the image bytes and PUT them to LinkedIn's upload URL
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) {
      throw new Error(`Failed to fetch image for LinkedIn upload: ${imageUrl}`);
    }
    const imgBuffer = await imgRes.arrayBuffer();

    const putRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/octet-stream",
      },
      body: imgBuffer,
    });

    if (!putRes.ok) {
      const body = await putRes.text();
      throw new Error(`LinkedIn image PUT failed ${putRes.status}: ${body}`);
    }

    return asset;
  }

  private async createUgcPost(
    text: string,
    imageAssetUrn?: string
  ): Promise<string> {
    const payload: UgcPostPayload = {
      author: this.personUrn,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text },
          shareMediaCategory: imageAssetUrn ? "IMAGE" : "NONE",
          ...(imageAssetUrn
            ? {
                media: [
                  {
                    status: "READY",
                    media: imageAssetUrn,
                  },
                ],
              }
            : {}),
        },
      },
      visibility: {
        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
      },
    };

    const res = await this.apiFetch(`${LINKEDIN_API}/ugcPosts`, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const data: UgcPostResponse = await res.json();
    return data.id;
  }

  private async apiFetch(url: string, init: RequestInit): Promise<Response> {
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
        ...(init.headers as Record<string, string> | undefined),
      },
    });

    if (res.status === 401 || res.status === 403) {
      throw Object.assign(new Error("LinkedIn auth error"), { authExpired: true });
    }

    if (res.status === 429) {
      throw new Error("LinkedIn rate limit reached");
    }

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`LinkedIn API error ${res.status}: ${body}`);
    }

    return res;
  }
}
