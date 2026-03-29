// ─── Publish Engine ───────────────────────────────────────────────────────────
// Core publishing logic used by the cron job and manual publish endpoints.

import { db } from "@/lib/db";
import type { Post, PostAccount, SocialAccount, MediaFile } from "@prisma/client";
import type { PublishResult as SocialPublishResult } from "@/lib/social/generic-publisher";
import { TwitterPublisher } from "@/lib/social/twitter";
import { InstagramPublisher } from "@/lib/social/instagram";
import { LinkedInPublisher } from "@/lib/social/linkedin";
import { FacebookPublisher } from "@/lib/social/facebook";

// ─── Public Types ─────────────────────────────────────────────────────────────

export interface EnginePublishResult {
  postId: string;
  platform: string;
  socialAccountId: string;
  success: boolean;
  platformPostId?: string;
  error?: string;
}

// ─── publishDuePosts ──────────────────────────────────────────────────────────
// Called every minute by the Vercel Cron job.
// Finds all posts that are due and attempts to publish each PostAccount.

export async function publishDuePosts(): Promise<EnginePublishResult[]> {
  const now = new Date();

  // Fetch all SCHEDULED posts that are past their scheduledAt time and
  // have an acceptable approval status.
  const posts = await db.post.findMany({
    where: {
      status: "SCHEDULED",
      scheduledAt: { lte: now },
      approvalStatus: { in: ["NOT_REQUIRED", "APPROVED"] },
    },
    include: {
      accounts: {
        where: { status: { in: ["SCHEDULED", "FAILED"] } },
        include: { socialAccount: true },
      },
      media: {
        include: { mediaFile: true },
        orderBy: { order: "asc" },
      },
    },
  });

  if (posts.length === 0) return [];

  const allResults: EnginePublishResult[] = [];

  for (const post of posts) {
    const mediaFiles = post.media.map((pm) => pm.mediaFile);
    const postResults = await publishPostToAllAccounts(post, mediaFiles);
    allResults.push(...postResults);

    // Refresh the post's overall status based on all its PostAccount records
    await reconcilePostStatus(post.id);
  }

  return allResults;
}

// ─── publishPostToAllAccounts ─────────────────────────────────────────────────
// Publishes a post to every linked social account.

async function publishPostToAllAccounts(
  post: Post & {
    accounts: (PostAccount & { socialAccount: SocialAccount })[];
  },
  mediaFiles: MediaFile[]
): Promise<EnginePublishResult[]> {
  const results: EnginePublishResult[] = [];

  for (const postAccount of post.accounts) {
    const result = await publishToAccount(
      post,
      postAccount.socialAccount,
      mediaFiles
    );

    const platform = postAccount.socialAccount.platform;

    if (result.success) {
      await db.postAccount.update({
        where: { id: postAccount.id },
        data: {
          status: "PUBLISHED",
          platformPostId: result.platformPostId ?? null,
          publishedAt: new Date(),
          failureReason: null,
        },
      });
    } else {
      const newRetryCount = postAccount.retryCount + 1;
      const isFinalFailure = newRetryCount >= 3;

      await db.postAccount.update({
        where: { id: postAccount.id },
        data: {
          status: isFinalFailure ? "FAILED" : "SCHEDULED",
          retryCount: newRetryCount,
          failedAt: isFinalFailure ? new Date() : undefined,
          failureReason: result.error ?? "Unknown error",
        },
      });

      // If auth expired, mark the social account so the user knows to reconnect
      if (result.authExpired) {
        await db.socialAccount.update({
          where: { id: postAccount.socialAccountId },
          data: { status: "EXPIRED" },
        });
      }
    }

    // Write a publish log entry regardless of outcome
    await db.publishLog.create({
      data: {
        postId: post.id,
        platform,
        status: result.success ? "success" : "failure",
        response: {
          platformPostId: result.platformPostId ?? null,
          platformPostUrl: result.platformPostUrl ?? null,
          error: result.error ?? null,
          authExpired: result.authExpired ?? false,
        },
      },
    });

    results.push({
      postId: post.id,
      platform,
      socialAccountId: postAccount.socialAccountId,
      success: result.success,
      platformPostId: result.platformPostId,
      error: result.error,
    });
  }

  return results;
}

// ─── publishToAccount ─────────────────────────────────────────────────────────
// Selects the correct publisher for a social account and executes the publish.
// This function is also called directly from the manual publish route.

export async function publishToAccount(
  post: Post,
  socialAccount: SocialAccount,
  mediaFiles: MediaFile[]
): Promise<SocialPublishResult> {
  const mediaUrls = mediaFiles.map((f) => f.url);

  // Resolve per-platform content variant (falls back to base content)
  const contentVariants =
    (post.contentVariants as Record<string, string> | null) ?? {};
  const content =
    contentVariants[socialAccount.platform] ?? post.content;

  // Resolve thread parts
  const threadParts = post.isThread
    ? ((post.threadParts as Array<{ content: string }> | null) ?? []).map(
        (p) => p.content
      )
    : undefined;

  const publishParams = {
    content,
    mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
    firstComment: post.firstComment ?? undefined,
    threadParts: threadParts && threadParts.length > 0 ? threadParts : undefined,
    isCarousel: post.isCarousel,
  };

  switch (socialAccount.platform) {
    case "TWITTER": {
      const publisher = new TwitterPublisher(socialAccount.accessToken);
      return publisher.publish(publishParams);
    }

    case "INSTAGRAM": {
      const meta = socialAccount.metadata as Record<string, unknown>;
      const instagramId =
        (meta?.instagram_id as string | undefined) ??
        socialAccount.platformId;
      const publisher = new InstagramPublisher(
        socialAccount.accessToken,
        instagramId
      );
      return publisher.publish(publishParams);
    }

    case "LINKEDIN": {
      const meta = socialAccount.metadata as Record<string, unknown>;
      const personUrn =
        (meta?.person_urn as string | undefined) ??
        `urn:li:person:${socialAccount.platformId}`;
      const publisher = new LinkedInPublisher(
        socialAccount.accessToken,
        personUrn
      );
      return publisher.publish(publishParams);
    }

    case "FACEBOOK": {
      const publisher = new FacebookPublisher(
        socialAccount.accessToken,
        socialAccount.platformId
      );
      return publisher.publish(publishParams);
    }

    default: {
      // For unsupported platforms (TIKTOK, YOUTUBE, etc.) in dev return mock,
      // in production return a graceful not-implemented error.
      if (process.env.NODE_ENV === "development") {
        return {
          success: true,
          platformPostId: `mock_${socialAccount.platform.toLowerCase()}_${Date.now()}`,
        };
      }
      return {
        success: false,
        error: `Publishing to ${socialAccount.platform} is not yet supported.`,
      };
    }
  }
}

// ─── reconcilePostStatus ──────────────────────────────────────────────────────
// After all PostAccounts have been processed, determine the overall Post status:
//   - All published   → PUBLISHED
//   - All failed      → FAILED
//   - Mix             → FAILED (partial failure surface to the user)
//   - Still in flight → leave as SCHEDULED (shouldn't happen after sync run)

async function reconcilePostStatus(postId: string): Promise<void> {
  const accounts = await db.postAccount.findMany({
    where: { postId },
    select: { status: true },
  });

  if (accounts.length === 0) return;

  const statuses = accounts.map((a) => a.status);
  const allPublished = statuses.every((s) => s === "PUBLISHED");
  const allFailed = statuses.every((s) => s === "FAILED");
  const anyPublished = statuses.some((s) => s === "PUBLISHED");

  let newStatus: "PUBLISHED" | "FAILED" | "SCHEDULED" | undefined;

  if (allPublished) {
    newStatus = "PUBLISHED";
  } else if (allFailed) {
    newStatus = "FAILED";
  } else if (anyPublished) {
    // Partial success — surface as FAILED so the user can retry the rest
    newStatus = "FAILED";
  }
  // If some are still SCHEDULED (retry pending), leave the post as SCHEDULED

  if (newStatus) {
    await db.post.update({
      where: { id: postId },
      data: {
        status: newStatus,
        publishedAt: newStatus === "PUBLISHED" ? new Date() : undefined,
      },
    });
  }
}
