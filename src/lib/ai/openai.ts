import OpenAI from "openai";

function getOpenAI(): OpenAI {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? "placeholder" });
}

// ─── Caption Generation ───────────────────────────────────────────────────────

export async function generateCaptions(params: {
  topic: string;
  platform: string;
  tone: string;
  includeHashtags: boolean;
  includeEmoji: boolean;
  count?: number;
}): Promise<string[]> {
  const count = params.count ?? 3;
  const hashtagNote = params.includeHashtags
    ? "Include relevant hashtags at the end."
    : "Do NOT include hashtags.";
  const emojiNote = params.includeEmoji
    ? "Sprinkle in relevant emojis throughout the caption."
    : "Do NOT use emojis.";

  const prompt = `You are an expert social media copywriter. Generate exactly ${count} distinct social media captions for ${params.platform}.

Topic / context: ${params.topic}
Tone: ${params.tone}
${hashtagNote}
${emojiNote}

Platform-specific guidelines:
- TWITTER/X: Keep under 280 characters each. Punchy and engaging.
- INSTAGRAM: Up to 2200 chars. Storytelling style, strong hook in first line.
- LINKEDIN: Professional, thought-leadership angle, up to 3000 chars.
- FACEBOOK: Conversational, community-focused, up to 500 chars recommended.
- TIKTOK: Casual, trending language, hook in first line, up to 150 chars.
- THREADS: Conversational, up to 500 chars.
- BLUESKY: Concise, up to 300 chars.
- MASTODON: Community-focused, up to 500 chars.
- Other platforms: Adapt appropriately.

Return ONLY a valid JSON array of ${count} caption strings, no extra text, no markdown fences:
["caption 1", "caption 2", "caption 3"]`;

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.85,
    max_tokens: 1200,
  });

  const raw = response.choices[0]?.message?.content?.trim() ?? "[]";
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.slice(0, count).map(String);
  } catch {
    // fallback: split by newlines
    const lines = raw
      .split("\n")
      .map((l) => l.replace(/^[\d\.\-\*\s]+/, "").trim())
      .filter(Boolean);
    if (lines.length > 0) return lines.slice(0, count);
  }
  return [raw];
}

// ─── Hashtag Generation ───────────────────────────────────────────────────────

export interface HashtagResult {
  tag: string;
  relevance: number; // 0–100
}

export async function generateHashtags(
  topic: string,
  platform: string,
  count: number,
  niche?: string
): Promise<HashtagResult[]> {
  const nicheNote = niche ? `Niche / industry: ${niche}.` : "";

  const prompt = `You are a social media hashtag research expert. Generate exactly ${count} hashtags for a ${platform} post.

Topic: ${topic}
${nicheNote}

Rules:
- Mix of high-volume, medium-volume, and niche-specific hashtags
- No spaces within hashtags, include the # symbol
- Vary from broad to specific
- Relevant to the topic and ${platform} culture
- For each hashtag provide a relevance score 0-100 (100 = perfectly on-topic)

Return ONLY a valid JSON array, no markdown, no extra text:
[{"tag":"#example","relevance":95},{"tag":"#another","relevance":80}]`;

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
    max_tokens: 800,
  });

  const raw = response.choices[0]?.message?.content?.trim() ?? "[]";
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .slice(0, count)
        .map((item: { tag?: string; relevance?: number }) => ({
          tag: String(item.tag ?? "").startsWith("#")
            ? String(item.tag)
            : `#${item.tag}`,
          relevance: Math.min(100, Math.max(0, Number(item.relevance ?? 50))),
        }));
    }
  } catch {
    // best-effort: extract hashtags from raw text
    const tags = raw.match(/#\w+/g) ?? [];
    return tags
      .slice(0, count)
      .map((tag, i) => ({ tag, relevance: Math.max(50, 100 - i * 5) }));
  }
  return [];
}

// ─── Content Agent ────────────────────────────────────────────────────────────

export interface GeneratedPost {
  platform: string;
  content: string;
}

async function fetchUrlContent(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; PostSyncer/1.0; +https://postsyncer.com)",
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
  }
  const html = await response.text();
  // Strip HTML tags, collapse whitespace, truncate to ~4000 chars
  const text = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4000);
  return text;
}

async function generatePostsFromContent(
  sourceContent: string,
  platforms: string[],
  count: number
): Promise<GeneratedPost[]> {
  const totalPosts = platforms.length * count;

  const prompt = `You are an expert social media content strategist. Based on the source content below, create social media posts.

Source content:
"""
${sourceContent.slice(0, 3000)}
"""

Generate ${count} post(s) for each of these platforms: ${platforms.join(", ")}.
That is ${totalPosts} posts total.

For each platform follow its character limits and style:
- TWITTER/X: ≤280 chars, punchy
- INSTAGRAM: storytelling, hook first, up to 2200 chars, include hashtags
- LINKEDIN: professional, thought-leadership, up to 3000 chars
- FACEBOOK: conversational, community-focused
- TIKTOK: casual, trending language, ≤150 chars
- THREADS/BLUESKY/MASTODON: concise, ≤500 chars

Return ONLY a valid JSON array, no markdown fences:
[{"platform":"TWITTER","content":"post text"},{"platform":"INSTAGRAM","content":"post text"}]`;

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.8,
    max_tokens: 2000,
  });

  const raw = response.choices[0]?.message?.content?.trim() ?? "[]";
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((item: { platform?: string; content?: string }) => ({
        platform: String(item.platform ?? "UNKNOWN"),
        content: String(item.content ?? ""),
      }));
    }
  } catch {
    return [];
  }
  return [];
}

export async function generateFromUrl(
  url: string,
  platforms: string[],
  count: number
): Promise<GeneratedPost[]> {
  const content = await fetchUrlContent(url);
  return generatePostsFromContent(content, platforms, count);
}

export async function generateFromText(
  text: string,
  platforms: string[],
  count: number
): Promise<GeneratedPost[]> {
  return generatePostsFromContent(text, platforms, count);
}

// ─── Reply Suggestions ────────────────────────────────────────────────────────

export async function suggestReplies(
  commentText: string,
  postContext: string
): Promise<string[]> {
  const prompt = `You are a social media community manager. Suggest 3 thoughtful, authentic reply options to the following comment.

Original post context: ${postContext || "A social media post"}

Comment to reply to:
"${commentText}"

Guidelines:
- Each reply should be distinct in tone (e.g., friendly, professional, playful)
- Keep replies concise (under 150 chars each)
- Sound human and genuine, not robotic
- Directly address the comment

Return ONLY a valid JSON array of 3 strings, no markdown:
["reply 1", "reply 2", "reply 3"]`;

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.8,
    max_tokens: 400,
  });

  const raw = response.choices[0]?.message?.content?.trim() ?? "[]";
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.slice(0, 3).map(String);
  } catch {
    const lines = raw
      .split("\n")
      .map((l) => l.replace(/^[\d\.\-\*\s"]+|["]+$/g, "").trim())
      .filter(Boolean);
    if (lines.length > 0) return lines.slice(0, 3);
  }
  return [];
}
