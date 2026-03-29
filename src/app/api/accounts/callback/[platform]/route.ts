import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  PLATFORMS,
  decodeOAuthState,
  getMockProfile,
} from "@/lib/social/platforms";
import type { PlatformKey } from "@/lib/social/platforms";
import { cookies } from "next/headers";
import { Platform } from "@prisma/client";

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
    return redirectWithError(req, `Unknown platform: ${rawPlatform}`);
  }

  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const stateParam = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return redirectWithError(req, `OAuth error: ${error}`);
  }

  if (!code || !stateParam) {
    return redirectWithError(req, "Missing code or state parameter");
  }

  // Decode and validate state
  const statePayload = decodeOAuthState(stateParam);
  if (!statePayload || statePayload.platform !== platformKey) {
    return redirectWithError(req, "Invalid state parameter");
  }

  const { workspaceId } = statePayload;

  // Validate cookie state in production (CSRF protection)
  if (process.env.NODE_ENV === "production") {
    const cookieStore = await cookies();
    const cookieState = cookieStore.get(`oauth_state_${platformKey}`)?.value;
    if (!cookieState || cookieState !== stateParam) {
      return redirectWithError(req, "State mismatch — possible CSRF attack");
    }
    cookieStore.delete(`oauth_state_${platformKey}`);
  }

  // Verify membership
  const membership = await db.workspaceMember.findFirst({
    where: { workspaceId, userId: session.user.id, status: "ACTIVE" },
  });

  if (!membership) {
    return redirectWithError(req, "Forbidden: not a member of this workspace");
  }

  // Exchange code for token and fetch profile
  let accessToken: string;
  let refreshToken: string | undefined;
  let tokenExpiresAt: Date | undefined;
  let profile: {
    platformId: string;
    username: string;
    displayName: string;
    avatarUrl: string;
  };

  const isDev = process.env.NODE_ENV === "development";
  const hasClientId = !!process.env[PLATFORMS[platformKey].clientIdEnv];

  if (isDev && (!hasClientId || code === "mock_auth_code")) {
    // Mock flow for development
    accessToken = `mock_access_token_${platformKey}_${Date.now()}`;
    refreshToken = `mock_refresh_token_${platformKey}_${Date.now()}`;
    tokenExpiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // 60 days
    profile = getMockProfile(platformKey);
  } else {
    // Real token exchange
    const tokenResult = await exchangeCodeForToken(
      platformKey,
      code,
      req
    );
    if (!tokenResult) {
      return redirectWithError(req, "Failed to exchange authorization code for token");
    }
    accessToken = tokenResult.accessToken;
    refreshToken = tokenResult.refreshToken;
    tokenExpiresAt = tokenResult.expiresAt;
    profile = tokenResult.profile;
  }

  // Upsert the social account
  const socialAccount = await db.socialAccount.upsert({
    where: {
      workspaceId_platform_platformId: {
        workspaceId,
        platform: platformKey as Platform,
        platformId: profile.platformId,
      },
    },
    create: {
      workspaceId,
      platform: platformKey as Platform,
      platformId: profile.platformId,
      username: profile.username,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      status: "ACTIVE",
      accessToken,
      refreshToken: refreshToken ?? null,
      tokenExpiresAt: tokenExpiresAt ?? null,
      scopes: PLATFORMS[platformKey].scopes,
      connectedAt: new Date(),
    },
    update: {
      username: profile.username,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      status: "ACTIVE",
      accessToken,
      refreshToken: refreshToken ?? null,
      tokenExpiresAt: tokenExpiresAt ?? null,
      scopes: PLATFORMS[platformKey].scopes,
      updatedAt: new Date(),
    },
  });

  const successUrl = new URL("/settings/accounts", req.url);
  successUrl.searchParams.set("connected", socialAccount.id);
  successUrl.searchParams.set("platform", platformKey);
  return NextResponse.redirect(successUrl);
}

function redirectWithError(req: NextRequest, message: string): NextResponse {
  const url = new URL("/settings/accounts", req.url);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url);
}

async function exchangeCodeForToken(
  platformKey: PlatformKey,
  code: string,
  req: NextRequest
): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  profile: {
    platformId: string;
    username: string;
    displayName: string;
    avatarUrl: string;
  };
} | null> {
  const config = PLATFORMS[platformKey];
  const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const redirectUri = `${appUrl}/api/accounts/callback/${platformKey.toLowerCase()}`;

  try {
    const tokenRes = await fetch(config.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: process.env[config.clientIdEnv] ?? "",
        client_secret: process.env[config.clientSecretEnv] ?? "",
        redirect_uri: redirectUri,
        code,
      }).toString(),
    });

    if (!tokenRes.ok) return null;

    const tokenData = await tokenRes.json();
    const accessToken: string = tokenData.access_token;
    const refreshToken: string | undefined = tokenData.refresh_token;
    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000)
      : undefined;

    // Fetch profile
    const profileRes = await fetch(config.profileUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!profileRes.ok) return null;

    const profileData = await profileRes.json();

    // Normalize profile per platform
    const profile = normalizeProfile(platformKey, profileData);
    if (!profile) return null;

    return { accessToken, refreshToken, expiresAt, profile };
  } catch {
    return null;
  }
}

function normalizeProfile(
  platformKey: PlatformKey,
  data: Record<string, unknown>
): {
  platformId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
} | null {
  try {
    switch (platformKey) {
      case "TWITTER":
        return {
          platformId: String((data.data as Record<string, unknown>)?.id ?? data.id),
          username: String((data.data as Record<string, unknown>)?.username ?? data.username),
          displayName: String((data.data as Record<string, unknown>)?.name ?? data.name),
          avatarUrl: String(
            (data.data as Record<string, unknown>)?.profile_image_url ?? ""
          ),
        };
      case "LINKEDIN":
        return {
          platformId: String(data.id),
          username: String(data.vanityName ?? data.id),
          displayName: `${data.localizedFirstName ?? ""} ${data.localizedLastName ?? ""}`.trim(),
          avatarUrl: "",
        };
      case "YOUTUBE": {
        const items = (data.items as Record<string, unknown>[]) ?? [];
        const channel = items[0] as Record<string, unknown> | undefined;
        const snippet = (channel?.snippet ?? {}) as Record<string, unknown>;
        const thumbnails = (snippet.thumbnails ?? {}) as Record<string, unknown>;
        const defaultThumb = (thumbnails.default ?? {}) as Record<string, unknown>;
        return {
          platformId: String(channel?.id ?? ""),
          username: String(snippet.customUrl ?? channel?.id ?? ""),
          displayName: String(snippet.title ?? ""),
          avatarUrl: String(defaultThumb.url ?? ""),
        };
      }
      default:
        return {
          platformId: String(data.id ?? data.sub ?? ""),
          username: String(data.username ?? data.screen_name ?? data.handle ?? data.id ?? ""),
          displayName: String(data.name ?? data.display_name ?? data.username ?? ""),
          avatarUrl: String(
            data.profile_image_url ??
              data.avatar ??
              data.picture ??
              data.profile_pic_url ??
              ""
          ),
        };
    }
  } catch {
    return null;
  }
}
