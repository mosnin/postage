import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/posts/queue — fetch all queued posts for workspace
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId");

    if (!workspaceId) {
      return NextResponse.json(
        { error: "Missing required param: workspaceId" },
        { status: 400 }
      );
    }

    const membership = await db.workspaceMember.findFirst({
      where: { workspaceId, userId: session.user.id, status: "ACTIVE" },
    });

    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const posts = await db.post.findMany({
      where: {
        workspaceId,
        status: "SCHEDULED",
        queuePosition: { not: null },
      },
      include: {
        accounts: {
          include: { socialAccount: true },
        },
        labels: {
          include: { label: true },
        },
        _count: { select: { media: true } },
      },
      orderBy: { queuePosition: "asc" },
    });

    return NextResponse.json({ posts });
  } catch (error) {
    console.error("[GET /api/posts/queue]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/posts/queue — reorder queue by providing new ordered post IDs
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { orderedPostIds, workspaceId } = body as {
      orderedPostIds: string[];
      workspaceId: string;
    };

    if (!workspaceId || !Array.isArray(orderedPostIds)) {
      return NextResponse.json(
        { error: "Missing required fields: workspaceId, orderedPostIds" },
        { status: 400 }
      );
    }

    const membership = await db.workspaceMember.findFirst({
      where: { workspaceId, userId: session.user.id, status: "ACTIVE" },
    });

    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Verify all posts belong to this workspace
    const posts = await db.post.findMany({
      where: { id: { in: orderedPostIds }, workspaceId },
      select: { id: true },
    });

    if (posts.length !== orderedPostIds.length) {
      return NextResponse.json(
        { error: "One or more post IDs are invalid or not in this workspace" },
        { status: 400 }
      );
    }

    // Update all positions in a transaction
    await db.$transaction(
      orderedPostIds.map((postId, index) =>
        db.post.update({
          where: { id: postId },
          data: { queuePosition: index },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[PATCH /api/posts/queue]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
