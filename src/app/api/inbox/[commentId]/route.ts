import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { CommentStatus } from "@prisma/client";
import { z } from "zod";

const patchSchema = z.union([
  z.object({ status: z.enum(["READ", "RESOLVED"]) }),
  z.object({ isHidden: z.literal(true) }),
]);

async function resolveComment(commentId: string, userId: string) {
  const comment = await db.comment.findUnique({ where: { id: commentId } });
  if (!comment) return null;

  const account = await db.socialAccount.findUnique({
    where: { id: comment.socialAccountId },
  });
  if (!account) return null;

  const membership = await db.workspaceMember.findFirst({
    where: { workspaceId: account.workspaceId, userId, status: "ACTIVE" },
  });
  if (!membership) return null;

  return comment;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ commentId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { commentId } = await params;
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const comment = await resolveComment(commentId, session.user.id);
  if (!comment) {
    return NextResponse.json({ error: "Not found or forbidden" }, { status: 404 });
  }

  const updated = await db.comment.update({
    where: { id: commentId },
    data: parsed.data,
    include: { replies: { orderBy: { sentAt: "asc" } } },
  });

  return NextResponse.json({ comment: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ commentId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { commentId } = await params;
  const comment = await resolveComment(commentId, session.user.id);
  if (!comment) {
    return NextResponse.json({ error: "Not found or forbidden" }, { status: 404 });
  }

  await db.comment.delete({ where: { id: commentId } });

  return NextResponse.json({ success: true });
}
