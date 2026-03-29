import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateHashtags, type HashtagResult } from "@/lib/ai/openai";

// ---------------------------------------------------------------------------
// In-memory rate limiter: 5 requests per hour per IP
// ---------------------------------------------------------------------------

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

const RATE_LIMIT = 5;
const WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT - 1 };
  }

  if (entry.count >= RATE_LIMIT) {
    return { allowed: false, remaining: 0 };
  }

  entry.count += 1;
  return { allowed: true, remaining: RATE_LIMIT - entry.count };
}

function getIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const bodySchema = z.object({
  topic: z.string().min(1).max(500),
  platform: z
    .enum(["INSTAGRAM", "TWITTER", "TIKTOK", "LINKEDIN", "YOUTUBE", "FACEBOOK"])
    .default("INSTAGRAM"),
  niche: z.enum(["broad", "niche", "trending"]).default("broad"),
  count: z.number().int().min(10).max(30).default(20),
});

// ---------------------------------------------------------------------------
// Mock hashtags (fallback when no OPENAI_API_KEY)
// ---------------------------------------------------------------------------

function getMockHashtags(
  topic: string,
  count: number
): { popular: HashtagResult[]; niche: HashtagResult[]; trending: HashtagResult[] } {
  const words = topic.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(Boolean);
  const base = words[0] ?? "social";
  const secondary = words[1] ?? "media";

  const popular: HashtagResult[] = [
    { tag: `#${base}`, relevance: 95 },
    { tag: `#${base}tips`, relevance: 88 },
    { tag: `#${secondary}`, relevance: 82 },
    { tag: `#${base}life`, relevance: 78 },
    { tag: "#content", relevance: 75 },
    { tag: "#socialmedia", relevance: 72 },
    { tag: "#marketing", relevance: 70 },
    { tag: "#digital", relevance: 68 },
    { tag: "#creative", relevance: 65 },
    { tag: "#instagood", relevance: 60 },
  ].slice(0, Math.ceil(count / 3));

  const nicheResults: HashtagResult[] = [
    { tag: `#${base}${secondary}`, relevance: 85 },
    { tag: `#${base}community`, relevance: 80 },
    { tag: `#${secondary}strategy`, relevance: 76 },
    { tag: `#${base}growth`, relevance: 73 },
    { tag: "#contentcreator", relevance: 70 },
    { tag: "#nichecontent", relevance: 65 },
    { tag: "#brandbuilding", relevance: 62 },
    { tag: "#audiencegrowth", relevance: 59 },
    { tag: "#contentstrategy", relevance: 57 },
    { tag: "#organicgrowth", relevance: 54 },
  ].slice(0, Math.ceil(count / 3));

  const trending: HashtagResult[] = [
    { tag: `#${base}2025`, relevance: 90 },
    { tag: "#trending", relevance: 88 },
    { tag: `#new${base}`, relevance: 84 },
    { tag: "#viral", relevance: 80 },
    { tag: "#explore", relevance: 76 },
    { tag: "#fyp", relevance: 73 },
    { tag: "#foryou", relevance: 70 },
    { tag: "#reels", relevance: 66 },
    { tag: "#trending2025", relevance: 63 },
    { tag: "#nowtrending", relevance: 58 },
  ].slice(0, Math.ceil(count / 3));

  return { popular, niche: nicheResults, trending };
}

// ---------------------------------------------------------------------------
// Group hashtags by relevance score into popular / niche / trending
// ---------------------------------------------------------------------------

function groupHashtags(
  hashtags: HashtagResult[],
  count: number
): { popular: HashtagResult[]; niche: HashtagResult[]; trending: HashtagResult[] } {
  const sorted = [...hashtags].sort((a, b) => b.relevance - a.relevance);
  const third = Math.ceil(count / 3);

  return {
    popular: sorted.slice(0, third),
    niche: sorted.slice(third, third * 2),
    trending: sorted.slice(third * 2, count),
  };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const ip = getIp(req);
  const { allowed, remaining } = checkRateLimit(ip);

  if (!allowed) {
    return NextResponse.json(
      {
        error: "Rate limit reached. Sign up for unlimited hashtag generation.",
        rateLimited: true,
      },
      {
        status: 429,
        headers: { "X-RateLimit-Remaining": "0" },
      }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const { topic, platform, niche, count } = parsed.data;

  if (!process.env.OPENAI_API_KEY) {
    const grouped = getMockHashtags(topic, count);
    return NextResponse.json(
      { hashtags: grouped },
      { headers: { "X-RateLimit-Remaining": String(remaining) } }
    );
  }

  try {
    const results = await generateHashtags(topic, platform, count, niche);
    const grouped = groupHashtags(results, count);
    return NextResponse.json(
      { hashtags: grouped },
      { headers: { "X-RateLimit-Remaining": String(remaining) } }
    );
  } catch {
    const grouped = getMockHashtags(topic, count);
    return NextResponse.json(
      { hashtags: grouped },
      { headers: { "X-RateLimit-Remaining": String(remaining) } }
    );
  }
}
