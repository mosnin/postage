import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PLAN_LIMITS } from "@/lib/utils";
import { Platform } from "@prisma/client";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const workspaceId = searchParams.get("workspaceId");

  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
  }

  // Verify membership
  const membership = await db.workspaceMember.findFirst({
    where: { workspaceId, userId: session.user.id, status: "ACTIVE" },
    include: {
      workspace: {
        include: { subscription: true },
      },
    },
  });

  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const accounts = await db.socialAccount.findMany({
    where: { workspaceId },
    include: {
      _count: { select: { posts: true } },
    },
    orderBy: { connectedAt: "asc" },
  });

  const plan = (membership.workspace.subscription?.plan ?? "FREE").toUpperCase() as keyof typeof PLAN_LIMITS;
  const limit = PLAN_LIMITS[plan]?.accounts ?? 0;

  return NextResponse.json({
    accounts,
    total: accounts.length,
    limit,
    plan,
  });
}
