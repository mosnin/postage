import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateCaptions } from "@/lib/ai/openai";

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
  topic: z.string().min(1).max(1000),
  platform: z.string().min(1),
  tone: z.enum(["Professional", "Casual", "Funny", "Educational", "Inspiring"]),
  length: z.enum(["Short", "Medium", "Long"]).default("Medium"),
  includeHashtags: z.boolean().default(false),
  includeEmoji: z.boolean().default(false),
});

// ---------------------------------------------------------------------------
// Mock captions (fallback when no OPENAI_API_KEY)
// ---------------------------------------------------------------------------

function getMockCaptions(platform: string, topic: string, tone: string): string[] {
  const toneMap: Record<string, string> = {
    Professional: "Here's a professional take on",
    Casual: "Just thinking about",
    Funny: "Okay but have you considered",
    Educational: "Did you know that",
    Inspiring: "Today is a great day to talk about",
  };
  const prefix = toneMap[tone] ?? "Sharing thoughts on";
  return [
    `${prefix} ${topic}. This is exactly what ${platform} users need to see today. What do you think?`,
    `${topic} — a topic that never gets old on ${platform}. Let's dive into why this matters and how you can take action right now.`,
    `If you've been following along, you know ${topic} is something we care deeply about. Here's what we've learned and what you can do with it.`,
  ];
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
        error: "Rate limit reached. Sign up for unlimited captions.",
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

  const { topic, platform, tone, length, includeHashtags, includeEmoji } =
    parsed.data;

  // Adjust count/length guidance via topic suffix
  const lengthHint =
    length === "Short"
      ? " Keep each caption concise (under 100 characters)."
      : length === "Long"
        ? " Write longer, detailed captions."
        : "";

  const topicWithHint = topic + lengthHint;

  let captions: string[];

  if (!process.env.OPENAI_API_KEY) {
    captions = getMockCaptions(platform, topic, tone);
  } else {
    try {
      captions = await generateCaptions({
        topic: topicWithHint,
        platform,
        tone,
        includeHashtags,
        includeEmoji,
        count: 3,
      });
    } catch {
      captions = getMockCaptions(platform, topic, tone);
    }
  }

  return NextResponse.json(
    { captions },
    { headers: { "X-RateLimit-Remaining": String(remaining) } }
  );
}
