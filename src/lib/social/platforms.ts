import { PLATFORM_COLORS, PLATFORM_LABELS } from "@/lib/utils";

export type PlatformKey =
  | "TWITTER"
  | "FACEBOOK"
  | "INSTAGRAM"
  | "TIKTOK"
  | "YOUTUBE"
  | "PINTEREST"
  | "THREADS"
  | "TELEGRAM"
  | "LINKEDIN"
  | "BLUESKY"
  | "MASTODON";

export interface PlatformConfig {
  name: string;
  color: string;
  scopes: string[];
  authUrl: string;
  tokenUrl: string;
  profileUrl: string;
  clientIdEnv: string;
  clientSecretEnv: string;
  usePKCE: boolean;
}

export const PLATFORMS: Record<PlatformKey, PlatformConfig> = {
  TWITTER: {
    name: "Twitter / X",
    color: "#1DA1F2",
    scopes: ["tweet.read", "tweet.write", "users.read"],
    authUrl: "https://twitter.com/i/oauth2/authorize",
    tokenUrl: "https://api.twitter.com/2/oauth2/token",
    profileUrl: "https://api.twitter.com/2/users/me",
    clientIdEnv: "TWITTER_CLIENT_ID",
    clientSecretEnv: "TWITTER_CLIENT_SECRET",
    usePKCE: true,
  },
  FACEBOOK: {
    name: "Facebook",
    color: "#1877F2",
    scopes: ["pages_manage_posts", "pages_read_engagement", "pages_show_list"],
    authUrl: "https://www.facebook.com/v18.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v18.0/oauth/access_token",
    profileUrl: "https://graph.facebook.com/me",
    clientIdEnv: "FACEBOOK_CLIENT_ID",
    clientSecretEnv: "FACEBOOK_CLIENT_SECRET",
    usePKCE: false,
  },
  INSTAGRAM: {
    name: "Instagram",
    color: "#E1306C",
    scopes: ["instagram_basic", "instagram_content_publish", "pages_show_list"],
    authUrl: "https://www.facebook.com/v18.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v18.0/oauth/access_token",
    profileUrl: "https://graph.facebook.com/me/accounts",
    clientIdEnv: "FACEBOOK_CLIENT_ID",
    clientSecretEnv: "FACEBOOK_CLIENT_SECRET",
    usePKCE: false,
  },
  TIKTOK: {
    name: "TikTok",
    color: "#010101",
    scopes: ["user.info.basic", "video.publish", "video.upload"],
    authUrl: "https://www.tiktok.com/v2/auth/authorize",
    tokenUrl: "https://open.tiktokapis.com/v2/oauth/token/",
    profileUrl: "https://open.tiktokapis.com/v2/user/info/",
    clientIdEnv: "TIKTOK_CLIENT_ID",
    clientSecretEnv: "TIKTOK_CLIENT_SECRET",
    usePKCE: true,
  },
  YOUTUBE: {
    name: "YouTube",
    color: "#FF0000",
    scopes: [
      "https://www.googleapis.com/auth/youtube.upload",
      "https://www.googleapis.com/auth/youtube.readonly",
    ],
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    profileUrl: "https://www.googleapis.com/youtube/v3/channels",
    clientIdEnv: "YOUTUBE_CLIENT_ID",
    clientSecretEnv: "YOUTUBE_CLIENT_SECRET",
    usePKCE: false,
  },
  PINTEREST: {
    name: "Pinterest",
    color: "#E60023",
    scopes: ["boards:read", "boards:write", "pins:read", "pins:write"],
    authUrl: "https://www.pinterest.com/oauth/",
    tokenUrl: "https://api.pinterest.com/v5/oauth/token",
    profileUrl: "https://api.pinterest.com/v5/user_account",
    clientIdEnv: "PINTEREST_CLIENT_ID",
    clientSecretEnv: "PINTEREST_CLIENT_SECRET",
    usePKCE: true,
  },
  THREADS: {
    name: "Threads",
    color: "#000000",
    scopes: ["threads_basic", "threads_content_publish"],
    authUrl: "https://threads.net/oauth/authorize",
    tokenUrl: "https://graph.threads.net/oauth/access_token",
    profileUrl: "https://graph.threads.net/me",
    clientIdEnv: "THREADS_CLIENT_ID",
    clientSecretEnv: "THREADS_CLIENT_SECRET",
    usePKCE: false,
  },
  TELEGRAM: {
    name: "Telegram",
    color: "#229ED9",
    scopes: [],
    authUrl: "https://oauth.telegram.org/auth",
    tokenUrl: "",
    profileUrl: "https://api.telegram.org/bot{token}/getMe",
    clientIdEnv: "TELEGRAM_BOT_TOKEN",
    clientSecretEnv: "TELEGRAM_BOT_TOKEN",
    usePKCE: false,
  },
  LINKEDIN: {
    name: "LinkedIn",
    color: "#0A66C2",
    scopes: ["r_liteprofile", "r_emailaddress", "w_member_social"],
    authUrl: "https://www.linkedin.com/oauth/v2/authorization",
    tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
    profileUrl: "https://api.linkedin.com/v2/me",
    clientIdEnv: "LINKEDIN_CLIENT_ID",
    clientSecretEnv: "LINKEDIN_CLIENT_SECRET",
    usePKCE: false,
  },
  BLUESKY: {
    name: "Bluesky",
    color: "#0085FF",
    scopes: ["atproto", "transition:generic"],
    authUrl: "https://bsky.social/oauth/authorize",
    tokenUrl: "https://bsky.social/xrpc/com.atproto.server.createSession",
    profileUrl: "https://bsky.social/xrpc/app.bsky.actor.getProfile",
    clientIdEnv: "BLUESKY_CLIENT_ID",
    clientSecretEnv: "BLUESKY_CLIENT_SECRET",
    usePKCE: true,
  },
  MASTODON: {
    name: "Mastodon",
    color: "#6364FF",
    scopes: ["read", "write", "follow"],
    authUrl: "https://mastodon.social/oauth/authorize",
    tokenUrl: "https://mastodon.social/oauth/token",
    profileUrl: "https://mastodon.social/api/v1/accounts/verify_credentials",
    clientIdEnv: "MASTODON_CLIENT_ID",
    clientSecretEnv: "MASTODON_CLIENT_SECRET",
    usePKCE: false,
  },
} as const;

export const PLATFORM_KEYS = Object.keys(PLATFORMS) as PlatformKey[];

/** Encode state parameter for OAuth flows */
export function encodeOAuthState(payload: {
  workspaceId: string;
  platform: string;
  redirectTo?: string;
}): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

/** Decode state parameter */
export function decodeOAuthState(state: string): {
  workspaceId: string;
  platform: string;
  redirectTo?: string;
} | null {
  try {
    return JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

/** Build the full OAuth authorization URL for a platform */
export function getPlatformOAuthUrl(
  platform: string,
  workspaceId: string,
  redirectUri: string
): string {
  const key = platform.toUpperCase() as PlatformKey;
  const config = PLATFORMS[key];
  if (!config) {
    throw new Error(`Unknown platform: ${platform}`);
  }

  const state = encodeOAuthState({ workspaceId, platform: key });

  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env[config.clientIdEnv] ?? "mock_client_id",
    redirect_uri: redirectUri,
    scope: config.scopes.join(" "),
    state,
  });

  return `${config.authUrl}?${params.toString()}`;
}

/** Mock profile data for development */
export function getMockProfile(platform: string): {
  platformId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
} {
  const key = platform.toUpperCase() as PlatformKey;
  return {
    platformId: `mock_${key.toLowerCase()}_${Date.now()}`,
    username: `demo_${key.toLowerCase()}`,
    displayName: `Demo ${PLATFORM_LABELS[key] ?? key}`,
    avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${key}`,
  };
}

export { PLATFORM_COLORS, PLATFORM_LABELS };
