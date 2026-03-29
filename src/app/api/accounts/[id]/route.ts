import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getPlatformOAuthUrl } from "@/lib/social/platforms";

type Params = Promise<{ id: string }>;

async function resolveAccount(accountId: string, userId: string) {
  const account = await db.socialAccount.findUnique({
    where: { id: accountId },
    include: {
      workspace: {
        include: {
          members: { where: { userId, status: "ACTIVE" } },
          subscription: true,
        },
      },
    },
  });

  if (!account) return { account: null, membership: null };

  const membership = account.workspace.members[0] ?? null;
  return { account, membership };
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Params }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { account, membership } = await resolveAccount(id, session.user.id);

  if (!account || !membership) {
    return NextResponse.json({ error: "Not found or forbidden" }, { status: 404 });
  }

  // Require Admin or above to disconnect accounts
  const allowedRoles = ["OWNER", "ADMIN"];
  if (!allowedRoles.includes(membership.role)) {
    return NextResponse.json(
      { error: "Insufficient permissions. Admin role required." },
      { status: 403 }
    );
  }

  // Check if any scheduled posts reference this account
  const scheduledPostCount = await db.postAccount.count({
    where: {
      socialAccountId: id,
      post: {
        status: { in: ["SCHEDULED", "PENDING_APPROVAL"] },
      },
    },
  });

  // Delete proceeds even if posts exist (cascade will handle PostAccount rows)
  await db.socialAccount.delete({ where: { id } });

  return NextResponse.json({
    success: true,
    warningScheduledPosts: scheduledPostCount > 0 ? scheduledPostCount : undefined,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Params }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { account, membership } = await resolveAccount(id, session.user.id);

  if (!account || !membership) {
    return NextResponse.json({ error: "Not found or forbidden" }, { status: 404 });
  }

  // Build reconnect URL — redirect back to OAuth connect flow
  const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const redirectUri = `${appUrl}/api/accounts/callback/${account.platform.toLowerCase()}`;
  const connectUrl = getPlatformOAuthUrl(
    account.platform,
    account.workspaceId,
    redirectUri
  );

  return NextResponse.json({ connectUrl });
}
