import type {
  User,
  Workspace,
  WorkspaceMember,
  SocialAccount,
  Post,
  PostAccount,
  MediaFile,
  Label,
  Campaign,
  Subscription,
  ApiKey,
  Comment,
  AnalyticsSnapshot,
} from "@prisma/client";

export type {
  User,
  Workspace,
  WorkspaceMember,
  SocialAccount,
  Post,
  PostAccount,
  MediaFile,
  Label,
  Campaign,
  Subscription,
  ApiKey,
  Comment,
  AnalyticsSnapshot,
};

// Extended types with relations
export type WorkspaceWithRelations = Workspace & {
  members: WorkspaceMember[];
  subscription: Subscription | null;
  socialAccounts: SocialAccount[];
};

export type PostWithRelations = Post & {
  accounts: (PostAccount & { socialAccount: SocialAccount })[];
  media: MediaFile[];
  labels: Label[];
};

export type SocialAccountWithPlatform = SocialAccount & {
  _count?: { posts: number };
};

export type MemberWithUser = WorkspaceMember & {
  user: User | null;
};

// API response types
export type ApiResponse<T> = {
  data: T;
  meta?: {
    total: number;
    page: number;
    pageSize: number;
    hasNext: boolean;
  };
};

export type ApiError = {
  error: string;
  code?: string;
  details?: Record<string, string[]>;
};

// Compose types
export type ComposeDraft = {
  content: string;
  contentVariants: Record<string, string>;
  selectedAccountIds: string[];
  scheduledAt: Date | null;
  mediaIds: string[];
  firstComment: string;
  isThread: boolean;
  threadParts: string[];
  labels: string[];
  campaigns: string[];
};

// Analytics types
export type AnalyticsSummary = {
  impressions: number;
  engagements: number;
  likes: number;
  comments: number;
  shares: number;
  followerChange: number;
  postsCount: number;
};

// Platform types
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
