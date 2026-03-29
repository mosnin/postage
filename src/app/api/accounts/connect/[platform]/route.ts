import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PLAN_LIMITS } from "@/lib/utils";
import { PLATFORMS, getPlatformOAuthUrl, encodeOAuthState } from "@/lib/social/platforms";
import type { PlatformKey } from "@/lib/social/platforms";
import { cookies } from "next/headers";

type Params = Promise<{ platform: string }>;

export async function GET(
  req: NextRequest,
  { params }: { params: Params }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const { platform: rawPlatform } = await params;
  const platformKey = rawPlatform.toUpperCase() as PlatformKey;

  if (!PLATFORMS[platformKey]) {
    return NextResponse.json({ error: `Unknown platform: ${rawPlatform}` }, { status: 400 });
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
      workspace: { include: { subscription: true } },
    },
  });

  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Enforce account limit
  const plan = (membership.workspace.subscription?.plan ?? "FREE").toUpperCase() as keyof typeof PLAN_LIMITS;
  const limit = PLAN_LIMITS[plan]?.accounts ?? 0;
  const currentCount = await db.socialAccount.count({ where: { workspaceId } });

  if (currentCount >= limit) {
    const upgradeUrl = new URL("/settings/billing?reason=account_limit", req.url);
    return NextResponse.redirect(upgradeUrl);
  }

  const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const redirectUri = `${appUrl}/api/accounts/callback/${rawPlatform.toLowerCase()}`;

  // In development with no real OAuth credentials, skip to mock callback directly
  const isDev = process.env.NODE_ENV === "development";
  const hasClientId = !!process.env[PLATFORMS[platformKey].clientIdEnv];

  if (isDev && !hasClientId) {
    const state = encodeOAuthState({ workspaceId, platform: platformKey });
    const mockCallbackUrl = new URL(
      `/api/accounts/callback/${rawPlatform.toLowerCase()}`,
      appUrl
    );
    mockCallbackUrl.searchParams.set("code", "mock_auth_code");
    mockCallbackUrl.searchParams.set("state", state);
    return NextResponse.redirect(mockCallbackUrl);
  }

  // Store state in a short-lived cookie for CSRF validation
  const state = encodeOAuthState({ workspaceId, platform: platformKey });
  const cookieStore = await cookies();
  cookieStore.set(`oauth_state_${platformKey}`, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  });

  const authUrl = getPlatformOAuthUrl(platformKey, workspaceId, redirectUri);
  return NextResponse.redirect(authUrl);
}
