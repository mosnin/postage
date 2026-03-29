// ─── POST /api/posts/[id]/publish ─────────────────────────────────────────────
// Immediately publish a post (manual "Publish Now").
// Allowed for posts in DRAFT, SCHEDULED, or FAILED state.
// Auth: NextAuth session + workspace membership check.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { publishToAccount } from "@/lib/scheduler/publish-engine";

const PUBLISHABLE_STATUSES = new Set(["DRAFT", "SCHEDULED", "FAILED", "CANCELLED"]);

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: postId } = await params;

  // ── Fetch post + verify workspace membership ─────────────────────────────────
  const post = await db.post.findUnique({
    where: { id: postId },
    include: {
      accounts: {
        include: { socialAccount: true },
      },
      media: {
        include: { mediaFile: true },
        orderBy: { order: "asc" },
      },
    },
  });

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const membership = await db.workspaceMember.findFirst({
    where: {
      workspaceId: post.workspaceId,
      userId: session.user.id,
      status: "ACTIVE",
    },
  });

  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ── State guard ──────────────────────────────────────────────────────────────
  if (!PUBLISHABLE_STATUSES.has(post.status)) {
    return NextResponse.json(
      {
        error: `Cannot manually publish a post with status "${post.status}". ` +
          `Allowed statuses: ${Array.from(PUBLISHABLE_STATUSES).join(", ")}.`,
      },
      { status: 409 }
    );
  }

  if (post.accounts.length === 0) {
    return NextResponse.json(
      { error: "Post has no linked social accounts." },
      { status: 422 }
    );
  }

  // ── Set the post to PUBLISHING so the cron skips it mid-run ─────────────────
  await db.post.update({
    where: { id: postId },
    data: { status: "PUBLISHING" },
  });

  const mediaFiles = post.media.map((pm) => pm.mediaFile);

  const publishResults: Array<{
    socialAccountId: string;
    platform: string;
    success: boolean;
    platformPostId?: string;
    error?: string;
  }> = [];

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

      if (result.authExpired) {
        await db.socialAccount.update({
          where: { id: postAccount.socialAccountId },
          data: { status: "EXPIRED" },
        });
      }
    }

    await db.publishLog.create({
      data: {
        postId,
        platform,
        status: result.success ? "success" : "failure",
        response: {
          platformPostId: result.platformPostId ?? null,
          platformPostUrl: result.platformPostUrl ?? null,
          error: result.error ?? null,
          authExpired: result.authExpired ?? false,
          triggeredBy: "manual",
        },
      },
    });

    publishResults.push({
      socialAccountId: postAccount.socialAccountId,
      platform,
      success: result.success,
      platformPostId: result.platformPostId,
      error: result.error,
    });
  }

  // ── Determine final post status ───────────────────────────────────────────────
  const allPublished = publishResults.every((r) => r.success);
  const anyPublished = publishResults.some((r) => r.success);
  const newStatus = allPublished
    ? "PUBLISHED"
    : anyPublished
    ? "FAILED" // partial — surface for retry
    : "FAILED";

  await db.post.update({
    where: { id: postId },
    data: {
      status: newStatus,
      publishedAt: allPublished ? new Date() : undefined,
    },
  });

  await db.activityLog.create({
    data: {
      workspaceId: post.workspaceId,
      userId: session.user.id,
      action: "post.published",
      entityType: "Post",
      entityId: postId,
      metadata: {
        trigger: "manual",
        results: publishResults,
      },
    },
  });

  // Return the refreshed post
  const updatedPost = await db.post.findUnique({
    where: { id: postId },
    include: {
      accounts: { include: { socialAccount: true } },
      media: { include: { mediaFile: true }, orderBy: { order: "asc" } },
      labels: { include: { label: true } },
      publishLogs: { orderBy: { attemptAt: "desc" }, take: 10 },
    },
  });

  return NextResponse.json({
    post: updatedPost,
    results: publishResults,
  });
}
