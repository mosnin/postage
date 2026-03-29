import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const MANAGER_ROLES = new Set(["OWNER", "ADMIN", "MANAGER"]);

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

  // Verify manager-level membership
  const membership = await db.workspaceMember.findFirst({
    where: { workspaceId, userId: session.user.id, status: "ACTIVE" },
  });

  if (!membership || !MANAGER_ROLES.has(membership.role)) {
    return NextResponse.json(
      { error: "Only managers and above can view the approval queue" },
      { status: 403 }
    );
  }

  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20")));
  const skip = (page - 1) * pageSize;

  const where = {
    workspaceId,
    approvalStatus: "PENDING" as const,
  };

  const [posts, total] = await Promise.all([
    db.post.findMany({
      where,
      include: {
        accounts: { include: { socialAccount: true } },
        media: { include: { mediaFile: true }, orderBy: { order: "asc" } },
        labels: { include: { label: true } },
        campaignPost: { include: { campaign: true } },
      },
      orderBy: { submittedForApprovalAt: "desc" },
      skip,
      take: pageSize,
    }),
    db.post.count({ where }),
  ]);

  // Fetch author info for all posts in one query
  const authorIds = posts
    .map((p) => p.authorId)
    .filter((id): id is string => id !== null);

  const authors =
    authorIds.length > 0
      ? await db.user.findMany({
          where: { id: { in: authorIds } },
          select: { id: true, name: true, email: true, image: true },
        })
      : [];

  const authorMap = new Map(authors.map((a) => [a.id, a]));

  const postsWithAuthor = posts.map((post) => ({
    ...post,
    author: post.authorId ? (authorMap.get(post.authorId) ?? null) : null,
  }));

  return NextResponse.json({
    data: postsWithAuthor,
    meta: {
      total,
      page,
      pageSize,
      hasNext: skip + pageSize < total,
    },
  });
}
