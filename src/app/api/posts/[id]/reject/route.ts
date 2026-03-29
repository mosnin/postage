import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendApprovalDecisionEmail } from "@/lib/email/resend";

const MANAGER_ROLES = new Set(["OWNER", "ADMIN", "MANAGER"]);

const rejectSchema = z.object({
  reason: z.string().min(1, "A rejection reason is required"),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = rejectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 422 }
    );
  }

  const { reason } = parsed.data;

  const post = await db.post.findUnique({
    where: { id },
    select: {
      id: true,
      workspaceId: true,
      authorId: true,
      approvalStatus: true,
      content: true,
    },
  });

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const membership = await db.workspaceMember.findFirst({
    where: { workspaceId: post.workspaceId, userId: session.user.id, status: "ACTIVE" },
  });

  if (!membership || !MANAGER_ROLES.has(membership.role)) {
    return NextResponse.json(
      { error: "Only managers and above can reject posts" },
      { status: 403 }
    );
  }

  if (post.approvalStatus !== "PENDING") {
    return NextResponse.json(
      { error: `Post is not pending approval (current: ${post.approvalStatus})` },
      { status: 409 }
    );
  }

  const now = new Date();

  const updated = await db.post.update({
    where: { id },
    data: {
      approvalStatus: "REJECTED",
      approvalNote: reason,
      status: "DRAFT",
    },
    include: {
      accounts: { include: { socialAccount: true } },
      media: { include: { mediaFile: true }, orderBy: { order: "asc" } },
      labels: { include: { label: true } },
      campaignPost: { include: { campaign: true } },
    },
  });

  await db.activityLog.create({
    data: {
      workspaceId: post.workspaceId,
      userId: session.user.id,
      action: "post.rejected",
      entityType: "Post",
      entityId: post.id,
      metadata: { rejectedAt: now.toISOString(), reason },
    },
  });

  // Notify author
  if (post.authorId) {
    const [author, reviewer, workspace] = await Promise.all([
      db.user.findUnique({ where: { id: post.authorId }, select: { name: true, email: true } }),
      db.user.findUnique({ where: { id: session.user.id }, select: { name: true } }),
      db.workspace.findUnique({ where: { id: post.workspaceId }, select: { name: true } }),
    ]);

    if (author?.email) {
      sendApprovalDecisionEmail({
        authorEmail: author.email,
        authorName: author.name,
        decision: "rejected",
        note: reason,
        reviewerName: reviewer?.name ?? null,
        postId: post.id,
        workspaceName: workspace?.name ?? "",
      }).catch((err) => console.error("[reject] email error:", err));
    }
  }

  return NextResponse.json(updated);
}
