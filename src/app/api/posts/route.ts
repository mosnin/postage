import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

type TransactionClient = Parameters<Parameters<typeof db.$transaction>[0]>[0];

const createPostSchema = z.object({
  workspaceId: z.string().min(1, "workspaceId is required"),
  content: z.string().min(1, "content is required"),
  accountIds: z.array(z.string()).min(1, "Select at least one account"),
  status: z
    .enum(["DRAFT", "PENDING_APPROVAL", "SCHEDULED", "CANCELLED"])
    .default("DRAFT"),
  scheduledAt: z.string().datetime().nullish(),
  firstComment: z.string().optional(),
  isThread: z.boolean().default(false),
  threadParts: z
    .array(z.object({ id: z.string(), content: z.string() }))
    .default([]),
  labelIds: z.array(z.string()).default([]),
  campaignId: z.string().nullish(),
  mediaIds: z.array(z.string()).default([]),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createPostSchema.safeParse(body);
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
    workspaceId,
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

  // Verify user is a member of the workspace
  const membership = await db.workspaceMember.findFirst({
    where: {
      workspaceId,
      userId: session.user.id,
      status: "ACTIVE",
    },
  });

  if (!membership) {
    return NextResponse.json(
      { error: "You do not have access to this workspace" },
      { status: 403 }
    );
  }

  // Verify all accountIds belong to this workspace
  const accounts = await db.socialAccount.findMany({
    where: {
      id: { in: accountIds },
      workspaceId,
    },
  });

  if (accounts.length !== accountIds.length) {
    return NextResponse.json(
      { error: "One or more accounts are invalid" },
      { status: 422 }
    );
  }

  // Verify labels belong to this workspace
  if (labelIds.length > 0) {
    const labelCount = await db.label.count({
      where: { id: { in: labelIds }, workspaceId },
    });
    if (labelCount !== labelIds.length) {
      return NextResponse.json(
        { error: "One or more labels are invalid" },
        { status: 422 }
      );
    }
  }

  // Verify campaign belongs to this workspace
  if (campaignId) {
    const campaign = await db.campaign.findFirst({
      where: { id: campaignId, workspaceId },
    });
    if (!campaign) {
      return NextResponse.json({ error: "Invalid campaign" }, { status: 422 });
    }
  }

  // Verify media belongs to this workspace
  if (mediaIds.length > 0) {
    const mediaCount = await db.mediaFile.count({
      where: { id: { in: mediaIds }, workspaceId },
    });
    if (mediaCount !== mediaIds.length) {
      return NextResponse.json(
        { error: "One or more media files are invalid" },
        { status: 422 }
      );
    }
  }

  try {
    const post = await db.$transaction(async (tx: TransactionClient) => {
      // Create the post
      const created = await tx.post.create({
        data: {
          workspaceId,
          authorId: session.user.id,
          content,
          status,
          scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
          firstComment: firstComment ?? null,
          isThread,
          threadParts: isThread ? threadParts : [],
          approvalStatus:
            status === "PENDING_APPROVAL" ? "PENDING" : "NOT_REQUIRED",
          submittedForApprovalAt:
            status === "PENDING_APPROVAL" ? new Date() : null,
        },
      });

      // Create PostAccount records
      await tx.postAccount.createMany({
        data: accountIds.map((socialAccountId: string) => ({
          postId: created.id,
          socialAccountId,
          status: status === "DRAFT" ? "DRAFT" : "SCHEDULED",
        })),
      });

      // Attach labels
      if (labelIds.length > 0) {
        await tx.postLabel.createMany({
          data: labelIds.map((labelId: string) => ({
            postId: created.id,
            labelId,
          })),
        });
      }

      // Attach campaign
      if (campaignId) {
        await tx.campaignPost.create({
          data: { campaignId, postId: created.id },
        });
      }

      // Attach media
      if (mediaIds.length > 0) {
        await tx.postMedia.createMany({
          data: mediaIds.map((mediaFileId: string, index: number) => ({
            postId: created.id,
            mediaFileId,
            order: index,
          })),
        });
      }

      // Log activity
      await tx.activityLog.create({
        data: {
          workspaceId,
          userId: session.user.id,
          action: "post.created",
          entityType: "Post",
          entityId: created.id,
          metadata: { status, accountCount: accountIds.length },
        },
      });

      return created;
    });

    // Return post with relations
    const postWithRelations = await db.post.findUniqueOrThrow({
      where: { id: post.id },
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
      },
    });

    return NextResponse.json(postWithRelations, { status: 201 });
  } catch (error) {
    console.error("[POST /api/posts]", error);
    return NextResponse.json(
      { error: "Failed to create post" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get("workspaceId");

  if (!workspaceId) {
    return NextResponse.json(
      { error: "workspaceId query param is required" },
      { status: 400 }
    );
  }

  // Verify membership
  const membership = await db.workspaceMember.findFirst({
    where: {
      workspaceId,
      userId: session.user.id,
      status: "ACTIVE",
    },
  });

  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20")));
  const status = searchParams.get("status");
  const skip = (page - 1) * pageSize;

  const where = {
    workspaceId,
    ...(status ? { status: status as never } : {}),
  };

  const [posts, total] = await Promise.all([
    db.post.findMany({
      where,
      include: {
        accounts: { include: { socialAccount: true } },
        media: { include: { mediaFile: true }, orderBy: { order: "asc" as const } },
        labels: { include: { label: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    db.post.count({ where }),
  ]);

  return NextResponse.json({
    data: posts,
    meta: {
      total,
      page,
      pageSize,
      hasNext: skip + pageSize < total,
    },
  });
}
