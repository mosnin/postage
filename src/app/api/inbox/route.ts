import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { CommentStatus, Platform } from "@prisma/client";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const workspaceId = searchParams.get("workspaceId");
  const platform = searchParams.get("platform") as Platform | null;
  const status = searchParams.get("status") as CommentStatus | null;
  const search = searchParams.get("search") ?? "";
  const accountId = searchParams.get("accountId");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(
    50,
    Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10))
  );

  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
  }

  // Verify user belongs to workspace
  const membership = await db.workspaceMember.findFirst({
    where: { workspaceId, userId: session.user.id, status: "ACTIVE" },
    include: {
      workspace: { include: { subscription: true } },
    },
  });

  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Plan gating: Starter → last 30 days only
  const plan = membership.workspace.subscription?.plan ?? "FREE";
  const isStarter = plan === "STARTER";
  const cutoff = isStarter ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) : undefined;

  // Collect social account IDs for this workspace
  const accountWhere = accountId
    ? { id: accountId, workspaceId }
    : { workspaceId };

  const socialAccounts = await db.socialAccount.findMany({
    where: accountWhere,
    select: { id: true },
  });

  const socialAccountIds = socialAccounts.map((a: { id: string }) => a.id);

  if (socialAccountIds.length === 0) {
    return NextResponse.json({ comments: [], total: 0, hasNext: false });
  }

  const where = {
    socialAccountId: { in: socialAccountIds },
    ...(platform ? { platform } : {}),
    ...(status ? { status } : {}),
    ...(cutoff ? { publishedAt: { gte: cutoff } } : {}),
    ...(search
      ? {
          OR: [
            { content: { contains: search, mode: "insensitive" as const } },
            { authorName: { contains: search, mode: "insensitive" as const } },
            { authorUsername: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [total, comments] = await Promise.all([
    db.comment.count({ where }),
    db.comment.findMany({
      where,
      include: {
        replies: { orderBy: { sentAt: "asc" } },
      },
      orderBy: { publishedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return NextResponse.json({
    comments,
    total,
    hasNext: page * pageSize < total,
    plan,
  });
}
