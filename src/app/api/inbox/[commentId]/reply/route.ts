import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const replySchema = z.object({
  content: z.string().min(1).max(4096),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ commentId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { commentId } = await params;

  const comment = await db.comment.findUnique({ where: { id: commentId } });
  if (!comment) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  // Verify workspace ownership
  const account = await db.socialAccount.findUnique({
    where: { id: comment.socialAccountId },
  });
  if (!account) {
    return NextResponse.json({ error: "Social account not found" }, { status: 404 });
  }

  const membership = await db.workspaceMember.findFirst({
    where: {
      workspaceId: account.workspaceId,
      userId: session.user.id,
      status: "ACTIVE",
    },
  });
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = replySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  // In production this would also call the platform API to post the reply.
  const [reply] = await db.$transaction([
    db.commentReply.create({
      data: {
        commentId,
        content: parsed.data.content,
        sentById: session.user.id,
      },
    }),
    db.comment.update({
      where: { id: commentId },
      data: { status: "REPLIED" },
    }),
  ]);

  return NextResponse.json({ reply }, { status: 201 });
}
