import { parseISO, isValid } from "date-fns";

const VALID_PLATFORMS = [
  "TWITTER",
  "FACEBOOK",
  "INSTAGRAM",
  "TIKTOK",
  "YOUTUBE",
  "PINTEREST",
  "THREADS",
  "TELEGRAM",
  "LINKEDIN",
  "BLUESKY",
  "MASTODON",
] as const;

const PLATFORM_CHAR_LIMITS: Record<string, number> = {
  TWITTER: 280,
  FACEBOOK: 63206,
  INSTAGRAM: 2200,
  TIKTOK: 2200,
  YOUTUBE: 5000,
  PINTEREST: 500,
  THREADS: 500,
  TELEGRAM: 4096,
  LINKEDIN: 3000,
  BLUESKY: 300,
  MASTODON: 500,
};

export type BulkRow = {
  platforms: string;
  scheduled_at: string;
  content: string;
  media_url?: string;
  first_comment?: string;
  labels?: string;
};

export type ValidationResult = {
  valid: boolean;
  warnings: string[];
  errors: string[];
};

export function validateBulkRow(
  row: Record<string, string>,
  connectedPlatforms: string[]
): ValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  const rawPlatforms = row.platforms ?? "";
  if (!rawPlatforms.trim()) {
    errors.push("Platforms field is required");
  } else {
    const platformList = rawPlatforms
      .split(";")
      .map((p) => p.trim().toUpperCase())
      .filter(Boolean);

    for (const p of platformList) {
      if (!VALID_PLATFORMS.includes(p as (typeof VALID_PLATFORMS)[number])) {
        errors.push(`Platform '${p}' not recognized`);
      } else if (!connectedPlatforms.includes(p)) {
        warnings.push(`Platform '${p}' is not connected to this workspace`);
      }
    }

    const content = row.content ?? "";
    for (const p of platformList) {
      const limit = PLATFORM_CHAR_LIMITS[p];
      if (limit && content.length > limit) {
        warnings.push(`Content exceeds ${p} limit (${content.length}/${limit} chars)`);
      }
    }
  }

  const rawDate = row.scheduled_at ?? "";
  if (!rawDate.trim()) {
    errors.push("scheduled_at field is required");
  } else {
    const parsed = parseISO(rawDate);
    if (!isValid(parsed)) {
      errors.push(`Invalid date format: '${rawDate}'. Use ISO 8601 (e.g. 2025-06-15T09:00:00Z)`);
    } else if (parsed < new Date()) {
      warnings.push("Scheduled time is in the past");
    }
  }

  if (!(row.content ?? "").trim()) {
    errors.push("content field is required");
  }

  return { valid: errors.length === 0, warnings, errors };
}
