# Feature 18: Blog to Social

Convert any blog post URL into platform-ready social drafts via AI Studio.

---

## 1. User Flow

1. User opens AI Studio and pastes a blog URL into the "Blog to Social" input.
2. Client POSTs `{ url, platforms[] }` to `/api/ai/blog-to-social`.
3. Server validates the URL (SSRF check), fetches the page, and extracts structured content.
4. Extracted content is passed to GPT-4o with per-platform prompts.
5. API returns `{ posts: [{platform, content, hashtags[]}] }`.
6. User reviews drafts in a preview panel and hits "Create All" to bulk-schedule them.

---

## 2. Content Extraction

No external scraping service — native `fetch()` + regex only.

```ts
function extractBlogContent(html: string): { title: string; description: string; body: string } {
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ?? "";
  const description =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1]?.trim() ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i)?.[1]?.trim() ??
    "";
  const bodyMatch =
    html.match(/<article[^>]*>([\s\S]*?)<\/article>/i)?.[1] ??
    html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)?.[1] ??
    html;
  const body = bodyMatch
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 3000);
  return { title, description, body };
}
```

---

## 3. Platform Adaptations (AI Prompts)

All prompts receive the same context block:

```
Title: {title}
Description: {description}
Body: {body}
```

| Platform    | Prompt instruction |
|-------------|-------------------|
| Twitter/X   | "Write a 5-tweet thread of key takeaways. Number each tweet 1/5–5/5. Each tweet must be ≤280 chars. Be punchy and insight-driven." |
| LinkedIn    | "Write a professional 200-word LinkedIn post summarising the key argument and ending with a thought-provoking question. No hashtags in the body." |
| Instagram   | "Write an engaging Instagram caption with a strong opening hook, 3–4 sentences of value, a call-to-action, then exactly 10 relevant hashtags on a new line." |
| Bluesky     | "Write a single concise take (≤300 chars) that captures the core insight and naturally references the article link as {url}." |

Return format for all platforms:
```json
[{"platform":"TWITTER","content":"...","hashtags":[]},
 {"platform":"LINKEDIN","content":"...","hashtags":[]},
 {"platform":"INSTAGRAM","content":"...","hashtags":["#tag1","#tag2"]},
 {"platform":"BLUESKY","content":"...","hashtags":[]}]
```

---

## 4. API Endpoint

**`POST /api/ai/blog-to-social`**

```ts
// src/app/api/ai/blog-to-social/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const BLOCKED = [
  /^127\./,/^10\./,/^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,/^::1$/,/^localhost$/i,
];

function isSsrfBlocked(hostname: string): boolean {
  return BLOCKED.some((re) => re.test(hostname));
}

function extract(html: string) {
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ?? "";
  const description =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1]?.trim() ?? "";
  const raw =
    html.match(/<article[^>]*>([\s\S]*?)<\/article>/i)?.[1] ??
    html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)?.[1] ?? html;
  const body = raw
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 3000);
  return { title, description, body };
}

const PLATFORM_INSTRUCTIONS: Record<string, string> = {
  TWITTER:   "Write a 5-tweet thread of key takeaways, numbered 1/5–5/5, each ≤280 chars.",
  LINKEDIN:  "Write a professional 200-word LinkedIn post ending with a thought-provoking question.",
  INSTAGRAM: "Write an engaging caption with a hook, 3–4 value sentences, CTA, then 10 hashtags.",
  BLUESKY:   "Write a single concise take ≤300 chars that captures the core insight.",
};

export async function POST(req: NextRequest) {
  const { url, platforms } = await req.json();
  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "url required" }, { status: 400 });
  }

  let parsed: URL;
  try { parsed = new URL(url); } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }
  if (!["http:", "https:"].includes(parsed.protocol) || isSsrfBlocked(parsed.hostname)) {
    return NextResponse.json({ error: "URL not allowed" }, { status: 400 });
  }

  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; PostSyncer/1.0)" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return NextResponse.json({ error: "Fetch failed" }, { status: 502 });

  const { title, description, body } = extract(await res.text());
  const targets: string[] = Array.isArray(platforms) && platforms.length
    ? platforms.map((p: string) => p.toUpperCase())
    : Object.keys(PLATFORM_INSTRUCTIONS);

  const instructions = targets
    .map((p) => `${p}: ${PLATFORM_INSTRUCTIONS[p] ?? "Write a suitable social post."}`)
    .join("\n");

  const prompt = `You are an expert social media strategist.

Title: ${title}
Description: ${description}
Body: ${body}

Generate one post per platform using these instructions:
${instructions}

Return ONLY a valid JSON array, no markdown:
[{"platform":"...","content":"...","hashtags":[]}]`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o", temperature: 0.8, max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = completion.choices[0]?.message?.content?.trim() ?? "[]";
  try {
    const posts = JSON.parse(raw);
    return NextResponse.json({ posts });
  } catch {
    return NextResponse.json({ error: "AI parse error", raw }, { status: 500 });
  }
}
```

---

## 5. SSRF Protection

Before fetching, `isSsrfBlocked()` rejects hostnames matching:

| Range | Regex |
|---|---|
| Loopback | `^127\.` / `^::1$` / `^localhost$` |
| RFC 1918 private | `^10\.` / `^192\.168\.` / `^172\.(16–31)\.` |
| Link-local (AWS metadata) | `^169\.254\.` |

Only `http:` and `https:` protocols are accepted; `file:`, `ftp:`, etc. are rejected.

> **Note:** For production, add a DNS-rebinding guard by resolving the hostname to an IP with `dns.lookup()` and re-running the block-list check against the resolved IP before fetching.
