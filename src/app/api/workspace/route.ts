import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * GET /api/workspace
 *
 * Returns all workspaces the authenticated user belongs to, including
 * subscription details and member/account/post counts.
 *
 * Used by the workspace switcher and the `useWorkspace` client hook.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const memberships = await db.workspaceMember.findMany({
    where: {
      userId: session.user.id,
      status: "ACTIVE",
    },
    orderBy: { joinedAt: "asc" },
    include: {
      workspace: {
        include: {
          subscription: {
            select: {
              id: true,
              plan: true,
              status: true,
              trialEndsAt: true,
              currentPeriodEnd: true,
              cancelAtPeriodEnd: true,
            },
          },
          settings: {
            select: {
              aiCreditsUsed: true,
              aiCreditsLimit: true,
              approvalRequired: true,
              defaultTimezone: true,
            },
          },
          _count: {
            select: {
              members: { where: { status: "ACTIVE" } },
              socialAccounts: { where: { status: "ACTIVE" } },
              posts: true,
            },
          },
        },
      },
    },
  });

  const workspaces = memberships.map(({ workspace, role, status }) => ({
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    logoUrl: workspace.logoUrl,
    plan: workspace.plan,
    ownerId: workspace.ownerId,
    timezone: workspace.timezone,
    onboardingCompleted: workspace.onboardingCompleted,
    memberRole: role,
    memberStatus: status,
    subscription: workspace.subscription,
    settings: workspace.settings,
    _count: workspace._count,
  }));

  return NextResponse.json(workspaces);
}
