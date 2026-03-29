import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatDistanceToNow, format } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string) {
  return format(new Date(date), "MMM d, yyyy");
}

export function formatDateTime(date: Date | string) {
  return format(new Date(date), "MMM d, yyyy 'at' h:mm a");
}

export function formatRelative(date: Date | string) {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function generateApiKey(): string {
  const prefix = "ps_";
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let key = prefix;
  for (let i = 0; i < 40; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + "…";
}

// Plan limits
export const PLAN_LIMITS = {
  FREE: { accounts: 0, workspaces: 0, storage: 0, aiCredits: 0, apiPostsPerDay: 0 },
  STARTER: { accounts: 10, workspaces: 1, storage: 50 * 1024 * 1024 * 1024, aiCredits: 1000, apiPostsPerDay: 100 },
  PRO: { accounts: 15, workspaces: 2, storage: 100 * 1024 * 1024 * 1024, aiCredits: 1000, apiPostsPerDay: 250 },
  PRO_PLUS: { accounts: 30, workspaces: 3, storage: Infinity, aiCredits: 2000, apiPostsPerDay: 500 },
} as const;

export const PLATFORM_CHAR_LIMITS: Record<string, number> = {
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

export const PLATFORM_COLORS: Record<string, string> = {
  TWITTER: "#1DA1F2",
  FACEBOOK: "#1877F2",
  INSTAGRAM: "#E1306C",
  TIKTOK: "#010101",
  YOUTUBE: "#FF0000",
  PINTEREST: "#E60023",
  THREADS: "#000000",
  TELEGRAM: "#229ED9",
  LINKEDIN: "#0A66C2",
  BLUESKY: "#0085FF",
  MASTODON: "#6364FF",
};

export const PLATFORM_LABELS: Record<string, string> = {
  TWITTER: "Twitter / X",
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  TIKTOK: "TikTok",
  YOUTUBE: "YouTube",
  PINTEREST: "Pinterest",
  THREADS: "Threads",
  TELEGRAM: "Telegram",
  LINKEDIN: "LinkedIn",
  BLUESKY: "Bluesky",
  MASTODON: "Mastodon",
};
