// ─── POST /api/posts/[id]/retry ───────────────────────────────────────────────
// Reset failed PostAccount records so the publish engine will retry them.
// - Resets retryCount to 0 for FAILED PostAccounts
// - Sets PostAccount status back to SCHEDULED
// - Sets post status back to SCHEDULED
// - Optionally pushes scheduledAt forward by 5 minutes
// Auth: NextAuth session + workspace membership check.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const retryBodySchema = z.object({
  /** When true, reschedule to now + 5 minutes instead of retrying immediately */
  delay: z.boolean().optional().default(false),
}).optional();

export async function POST(
  req: NextRequest,
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

  // ── Only retry posts that have at least one FAILED account record ────────────
  const failedAccounts = post.accounts.filter((a) => a.status === "FAILED");

  if (failedAccounts.length === 0) {
    return NextResponse.json(
      {
        error:
          "No failed accounts to retry. Post must have at least one account with status FAILED.",
      },
      { status: 422 }
    );
  }

  // ── Parse optional body ───────────────────────────────────────────────────────
  let delay = false;
  try {
    const rawBody = await req.text();
    if (rawBody) {
      const parsed = retryBodySchema.safeParse(JSON.parse(rawBody));
      if (parsed.success && parsed.data) {
        delay = parsed.data.delay ?? false;
      }
    }
  } catch {
    // body is optional — ignore parse failures
  }

  // ── Reset failed PostAccount records ─────────────────────────────────────────
  await db.postAccount.updateMany({
    where: {
      postId,
      status: "FAILED",
    },
    data: {
      status: "SCHEDULED",
      retryCount: 0,
      failedAt: null,
      failureReason: null,
    },
  });

  // ── Reschedule the post ───────────────────────────────────────────────────────
  const newScheduledAt = delay
    ? new Date(Date.now() + 5 * 60 * 1000) // +5 minutes
    : new Date(); // publish on next cron tick (now)

  await db.post.update({
    where: { id: postId },
    data: {
      status: "SCHEDULED",
      scheduledAt: newScheduledAt,
    },
  });

  await db.activityLog.create({
    data: {
      workspaceId: post.workspaceId,
      userId: session.user.id,
      action: "post.retried",
      entityType: "Post",
      entityId: postId,
      metadata: {
        delay,
        newScheduledAt: newScheduledAt.toISOString(),
        resetAccountIds: failedAccounts.map((a) => a.id),
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
    retried: failedAccounts.length,
    scheduledAt: newScheduledAt.toISOString(),
  });
}
