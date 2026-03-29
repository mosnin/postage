import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendApprovalDecisionEmail } from "@/lib/email/resend";

const MANAGER_ROLES = new Set(["OWNER", "ADMIN", "MANAGER"]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Fetch the post with relations needed for notifications
  const post = await db.post.findUnique({
    where: { id },
    include: {
      accounts: { include: { socialAccount: true } },
      media: { include: { mediaFile: true }, orderBy: { order: "asc" } },
      labels: { include: { label: true } },
      campaignPost: { include: { campaign: true } },
    },
  });

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  // Verify manager-level membership
  const membership = await db.workspaceMember.findFirst({
    where: { workspaceId: post.workspaceId, userId: session.user.id, status: "ACTIVE" },
  });

  if (!membership || !MANAGER_ROLES.has(membership.role)) {
    return NextResponse.json(
      { error: "Only managers and above can approve posts" },
      { status: 403 }
    );
  }

  // Post must be pending approval
  if (post.approvalStatus !== "PENDING") {
    return NextResponse.json(
      { error: `Post is not pending approval (current: ${post.approvalStatus})` },
      { status: 409 }
    );
  }

  // Parse optional note from body
  let note: string | null = null;
  try {
    const body = await req.json().catch(() => ({}));
    if (typeof body?.note === "string" && body.note.trim()) {
      note = body.note.trim();
    }
  } catch {
    // body is optional
  }

  const now = new Date();

  // If no scheduledAt, schedule immediately
  const scheduledAt = post.scheduledAt ?? now;
  const newStatus = "SCHEDULED";

  const updated = await db.post.update({
    where: { id },
    data: {
      approvalStatus: "APPROVED",
      approvedById: session.user.id,
      approvedAt: now,
      approvalNote: note,
      status: newStatus,
      scheduledAt,
    },
    include: {
      accounts: { include: { socialAccount: true } },
      media: { include: { mediaFile: true }, orderBy: { order: "asc" } },
      labels: { include: { label: true } },
      campaignPost: { include: { campaign: true } },
    },
  });

  // Log activity
  await db.activityLog.create({
    data: {
      workspaceId: post.workspaceId,
      userId: session.user.id,
      action: "post.approved",
      entityType: "Post",
      entityId: post.id,
      metadata: { approvedAt: now.toISOString(), note },
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
        decision: "approved",
        note,
        reviewerName: reviewer?.name ?? null,
        postId: post.id,
        workspaceName: workspace?.name ?? "",
      }).catch((err) => console.error("[approve] email error:", err));
    }
  }

  return NextResponse.json(updated);
}
