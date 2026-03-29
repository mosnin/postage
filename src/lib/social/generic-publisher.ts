// ─── Generic Publisher Interface ─────────────────────────────────────────────
// All social platform publishers implement this interface.

export interface PublishParams {
  content: string;
  mediaUrls?: string[];
  firstComment?: string;
  /** Thread parts for platforms that support threads (e.g. Twitter) */
  threadParts?: string[];
  /** Whether this post is a carousel */
  isCarousel?: boolean;
  /** Per-platform overrides — shape varies by publisher */
  platformOptions?: Record<string, unknown>;
}

export interface PublishResult {
  success: boolean;
  platformPostId?: string;
  platformPostUrl?: string;
  error?: string;
  /** When set, the caller should not retry before this timestamp (rate-limit) */
  retryAfter?: Date;
  /** When true, the account credentials are expired / revoked */
  authExpired?: boolean;
}

export interface SocialPublisher {
  publish(params: PublishParams): Promise<PublishResult>;
  /** Optional: refresh the OAuth token for the given account, returns new access token */
  refreshToken?(accountId: string): Promise<string>;
}
