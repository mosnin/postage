import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      newUsersThisWeek,
      newUsersThisMonth,
      totalWorkspaces,
      activeWorkspaces,
      planBreakdown,
      activeSubscriptions,
      recentSignups,
    ] = await Promise.all([
      db.user.count(),
      db.user.count({ where: { createdAt: { gte: oneWeekAgo } } }),
      db.user.count({ where: { createdAt: { gte: oneMonthAgo } } }),
      db.workspace.count(),
      db.workspace.count({
        where: {
          subscription: {
            status: { in: ["ACTIVE", "TRIALING"] },
          },
        },
      }),
      db.subscription.groupBy({
        by: ["plan"],
        _count: { plan: true },
      }),
      db.subscription.count({
        where: { status: { in: ["ACTIVE", "TRIALING"] } },
      }),
      db.user.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          role: true,
          createdAt: true,
          lastLoginAt: true,
          _count: { select: { memberships: true } },
        },
      }),
    ]);

    const planCounts: Record<string, number> = {
      FREE: 0,
      STARTER: 0,
      PRO: 0,
      PRO_PLUS: 0,
    };
    for (const row of planBreakdown) {
      planCounts[row.plan] = row._count.plan;
    }

    // Approximate MRR from active subscriptions
    const subscriptionsWithPlan = await db.subscription.findMany({
      where: { status: "ACTIVE" },
      select: { plan: true },
    });
    const PLAN_MRR: Record<string, number> = {
      FREE: 0,
      STARTER: 19,
      PRO: 49,
      PRO_PLUS: 99,
    };
    const mrr = subscriptionsWithPlan.reduce(
      (sum, s) => sum + (PLAN_MRR[s.plan] ?? 0),
      0
    );

    return NextResponse.json({
      totalUsers,
      newUsersThisWeek,
      newUsersThisMonth,
      totalWorkspaces,
      activeWorkspaces,
      planCounts,
      activeSubscriptions,
      mrr,
      recentSignups,
    });
  } catch (error) {
    console.error("[GET /api/admin/stats]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
