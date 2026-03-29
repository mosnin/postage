import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

type TransactionClient = Parameters<Parameters<typeof db.$transaction>[0]>[0];

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchPost(postId: string) {
  return db.post.findUnique({
    where: { id: postId },
    include: {
      accounts: {
        include: { socialAccount: true },
      },
      media: {
        include: { mediaFile: true },
        orderBy: { order: "asc" },
      },
      labels: {
        include: { label: true },
      },
      campaignPost: {
        include: { campaign: true },
      },
      publishLogs: {
        orderBy: { attemptAt: "desc" },
        take: 10,
      },
    },
  });
}

async function verifyWorkspaceMembership(workspaceId: string, userId: string) {
  return db.workspaceMember.findFirst({
    where: { workspaceId, userId, status: "ACTIVE" },
  });
}

const MUTABLE_STATUSES = new Set(["DRAFT", "SCHEDULED", "PENDING_APPROVAL", "FAILED", "CANCELLED"]);

// ─── GET /api/posts/[id] ──────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const post = await fetchPost(id);

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const membership = await verifyWorkspaceMembership(post.workspaceId, session.user.id);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(post);
}

// ─── PUT /api/posts/[id] ──────────────────────────────────────────────────────

const updatePostSchema = z.object({
  content: z.string().min(1).optional(),
  accountIds: z.array(z.string()).min(1).optional(),
  status: z
    .enum(["DRAFT", "PENDING_APPROVAL", "SCHEDULED", "CANCELLED"])
    .optional(),
  scheduledAt: z.string().datetime().nullish(),
  firstComment: z.string().nullish(),
  isThread: z.boolean().optional(),
  threadParts: z
    .array(z.object({ id: z.string(), content: z.string() }))
    .optional(),
  labelIds: z.array(z.string()).optional(),
  campaignId: z.string().nullish(),
  mediaIds: z.array(z.string()).optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const post = await fetchPost(id);

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const membership = await verifyWorkspaceMembership(post.workspaceId, session.user.id);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!MUTABLE_STATUSES.has(post.status)) {
    return NextResponse.json(
      { error: `Cannot edit a post with status "${post.status}"` },
      { status: 409 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updatePostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 422 }
    );
  }

  const {
    content,
    accountIds,
    status,
    scheduledAt,
    firstComment,
    isThread,
    threadParts,
    labelIds,
    campaignId,
    mediaIds,
  } = parsed.data;

  // Validate accountIds if provided
  if (accountIds) {
    const accounts = await db.socialAccount.findMany({
      where: { id: { in: accountIds }, workspaceId: post.workspaceId },
    });
    if (accounts.length !== accountIds.length) {
      return NextResponse.json(
        { error: "One or more accounts are invalid" },
        { status: 422 }
      );
    }
  }

  // Validate labelIds if provided
  if (labelIds && labelIds.length > 0) {
    const labelCount = await db.label.count({
      where: { id: { in: labelIds }, workspaceId: post.workspaceId },
    });
    if (labelCount !== labelIds.length) {
      return NextResponse.json(
        { error: "One or more labels are invalid" },
        { status: 422 }
      );
    }
  }

  // Validate campaignId if provided
  if (campaignId) {
    const campaign = await db.campaign.findFirst({
      where: { id: campaignId, workspaceId: post.workspaceId },
    });
    if (!campaign) {
      return NextResponse.json({ error: "Invalid campaign" }, { status: 422 });
    }
  }

  // Validate mediaIds if provided
  if (mediaIds && mediaIds.length > 0) {
    const mediaCount = await db.mediaFile.count({
      where: { id: { in: mediaIds }, workspaceId: post.workspaceId },
    });
    if (mediaCount !== mediaIds.length) {
      return NextResponse.json(
        { error: "One or more media files are invalid" },
        { status: 422 }
      );
    }
  }

  try {
    await db.$transaction(async (tx: TransactionClient) => {
      // Update the post
      await tx.post.update({
        where: { id: post.id },
        data: {
          ...(content !== undefined ? { content } : {}),
          ...(status !== undefined
            ? {
                status,
                approvalStatus:
                  status === "PENDING_APPROVAL" ? "PENDING" : undefined,
                submittedForApprovalAt:
                  status === "PENDING_APPROVAL" ? new Date() : undefined,
              }
            : {}),
          ...(scheduledAt !== undefined
            ? { scheduledAt: scheduledAt ? new Date(scheduledAt) : null }
            : {}),
          ...(firstComment !== undefined
            ? { firstComment: firstComment ?? null }
            : {}),
          ...(isThread !== undefined ? { isThread } : {}),
          ...(threadParts !== undefined ? { threadParts } : {}),
        },
      });

      // Replace accounts if provided
      if (accountIds !== undefined) {
        await tx.postAccount.deleteMany({ where: { postId: post.id } });
        await tx.postAccount.createMany({
          data: accountIds.map((socialAccountId: string) => ({
            postId: post.id,
            socialAccountId,
            status:
              (status ?? post.status) === "DRAFT" ? "DRAFT" : "SCHEDULED",
          })),
        });
      }

      // Replace labels if provided
      if (labelIds !== undefined) {
        await tx.postLabel.deleteMany({ where: { postId: post.id } });
        if (labelIds.length > 0) {
          await tx.postLabel.createMany({
            data: labelIds.map((labelId: string) => ({
              postId: post.id,
              labelId,
            })),
          });
        }
      }

      // Replace campaign if provided
      if (campaignId !== undefined) {
        await tx.campaignPost.deleteMany({ where: { postId: post.id } });
        if (campaignId) {
          await tx.campaignPost.create({
            data: { campaignId, postId: post.id },
          });
        }
      }

      // Replace media if provided
      if (mediaIds !== undefined) {
        await tx.postMedia.deleteMany({ where: { postId: post.id } });
        if (mediaIds.length > 0) {
          await tx.postMedia.createMany({
            data: mediaIds.map((mediaFileId: string, index: number) => ({
              postId: post.id,
              mediaFileId,
              order: index,
            })),
          });
        }
      }

      // Log activity
      await tx.activityLog.create({
        data: {
          workspaceId: post.workspaceId,
          userId: session.user.id,
          action: "post.updated",
          entityType: "Post",
          entityId: post.id,
          metadata: { updatedFields: Object.keys(parsed.data) },
        },
      });
    });

    const updated = await fetchPost(post.id);
    return NextResponse.json(updated);
  } catch (error) {
    console.error("[PUT /api/posts/[id]]", error);
    return NextResponse.json(
      { error: "Failed to update post" },
      { status: 500 }
    );
  }
}

// ─── DELETE /api/posts/[id] ───────────────────────────────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const post = await fetchPost(id);

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const membership = await verifyWorkspaceMembership(post.workspaceId, session.user.id);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!MUTABLE_STATUSES.has(post.status)) {
    return NextResponse.json(
      { error: `Cannot delete a post with status "${post.status}"` },
      { status: 409 }
    );
  }

  try {
    await db.$transaction(async (tx: TransactionClient) => {
      await tx.post.delete({ where: { id: post.id } });

      await tx.activityLog.create({
        data: {
          workspaceId: post.workspaceId,
          userId: session.user.id,
          action: "post.deleted",
          entityType: "Post",
          entityId: post.id,
          metadata: { deletedAt: new Date().toISOString() },
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/posts/[id]]", error);
    return NextResponse.json(
      { error: "Failed to delete post" },
      { status: 500 }
    );
  }
}
