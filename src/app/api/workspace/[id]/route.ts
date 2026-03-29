import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

type Params = Promise<{ id: string }>;

/**
 * GET /api/workspace/[id]
 *
 * Returns a single workspace by id, provided the authenticated user is an
 * active member. Includes subscription, settings, and aggregate counts.
 */
export async function GET(req: NextRequest, { params }: { params: Params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Verify active membership in one query
  const membership = await db.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: id,
        userId: session.user.id,
      },
    },
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

  if (!membership || membership.status !== "ACTIVE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { workspace, role, status } = membership;

  return NextResponse.json({
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
  });
}
