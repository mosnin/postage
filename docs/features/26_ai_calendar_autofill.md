# Feature 26: AI Content Calendar Auto-Fill

**Plan gate:** PRO+ only · **AI credit cost:** 50 credits per generation

---

## 1. User Flow

1. User opens the Calendar page and clicks **"Auto-fill Calendar"** button (top-right).
2. A modal opens with four fields: Brand Niche, Content Pillars (3 topics), Posting Frequency (posts/week), Target Platforms (multi-select).
3. On submit, a `POST /api/ai/calendar-autofill` request is made; a loading spinner shows.
4. A **preview grid** renders 30 suggestion cards (date · platform · title · caption snippet · content type · hashtags). Each card has Approve / Reject toggle.
5. Clicking **"Create Approved Posts"** bulk-creates all approved suggestions as `DRAFT` posts with `scheduledAt` set to the suggested date.

---

## 2. API Endpoint

```
POST /api/ai/calendar-autofill
Authorization: session cookie (PRO+ workspace required)

Body:
{
  "brandNiche": "fitness coaching",
  "contentPillars": ["nutrition", "mindset", "workouts"],
  "frequency": 5,
  "platforms": ["INSTAGRAM", "LINKEDIN"],
  "month": "2026-04"
}

Response 200:
{
  "suggestions": [
    {
      "title": "Monday Motivation: 5-min morning routine",
      "caption": "Start your week strong...",
      "platform": "INSTAGRAM",
      "suggestedDate": "2026-04-06",
      "contentType": "REEL",
      "hashtags": ["#FitnessCoach", "#MorningRoutine"]
    }
    // ... 29 more
  ]
}

Error responses:
  402  { "error": "PRO_REQUIRED" }
  402  { "error": "INSUFFICIENT_CREDITS" }
  422  { "error": "VALIDATION_ERROR", "details": "..." }
```

---

## 3. AI Prompts

### System Prompt

```
You are an expert social media content strategist specialising in calendar planning.
Your task is to generate a structured monthly content calendar as valid JSON.
Rules:
- Return ONLY a raw JSON array, no markdown fences, no commentary.
- Spread posts evenly across the requested month, respecting the posting frequency.
- Rotate through the provided content pillars to ensure variety.
- Tailor caption tone and length to each platform's best practices:
    INSTAGRAM: storytelling, hook first, ≤2200 chars
    LINKEDIN: professional / thought-leadership, ≤3000 chars
    TWITTER/X: punchy, ≤280 chars
    TIKTOK: casual, trending language, ≤150 chars
    FACEBOOK: conversational, ≤500 chars
- contentType must be one of: POST, REEL, STORY, CAROUSEL, VIDEO, ARTICLE.
- Each hashtags array should contain 5–10 relevant tags (include # prefix).
- suggestedDate must be an ISO date string (YYYY-MM-DD) within the requested month.
```

### User Prompt Template

```
Generate exactly {{count}} social media post ideas for a {{brandNiche}} brand.

Content pillars: {{contentPillars.join(", ")}}
Posting frequency: {{frequency}} posts per week
Platforms: {{platforms.join(", ")}}
Month: {{month}} (YYYY-MM)

Return a JSON array where every element matches this shape:
{
  "title": "short internal title",
  "caption": "full post caption",
  "platform": "PLATFORM_ENUM",
  "suggestedDate": "YYYY-MM-DD",
  "contentType": "TYPE_ENUM",
  "hashtags": ["#tag1", "#tag2"]
}
```

---

## 4. Implementation Code

### API Route — `src/app/api/ai/calendar-autofill/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import openai from "@/lib/ai/openai-client"; // raw OpenAI instance
import { z } from "zod";

const CREDIT_COST = 50;

const bodySchema = z.object({
  brandNiche: z.string().min(2).max(100),
  contentPillars: z.array(z.string()).length(3),
  frequency: z.number().int().min(1).max(14),
  platforms: z.array(z.string()).min(1).max(8),
  month: z.string().regex(/^\d{4}-\d{2}$/),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: session.user.workspaceId },
    select: { plan: true, aiCredits: true },
  });

  if (!workspace || !["PRO", "BUSINESS"].includes(workspace.plan)) {
    return NextResponse.json({ error: "PRO_REQUIRED" }, { status: 402 });
  }
  if ((workspace.aiCredits ?? 0) < CREDIT_COST) {
    return NextResponse.json({ error: "INSUFFICIENT_CREDITS" }, { status: 402 });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const { brandNiche, contentPillars, frequency, platforms, month } = parsed.data;
  const [year, mon] = month.split("-").map(Number);
  const daysInMonth = new Date(year, mon, 0).getDate();
  const count = Math.min(frequency * Math.ceil(daysInMonth / 7), 30);

  const systemPrompt = `You are an expert social media content strategist specialising in calendar planning.
Return ONLY a raw JSON array, no markdown fences, no commentary.
Spread posts evenly across the requested month at the given frequency.
Rotate through content pillars. Match caption tone/length to each platform.
contentType: one of POST, REEL, STORY, CAROUSEL, VIDEO, ARTICLE.
hashtags: 5–10 tags with # prefix. suggestedDate: YYYY-MM-DD within the month.`;

  const userPrompt = `Generate exactly ${count} social media post ideas for a ${brandNiche} brand.
Content pillars: ${contentPillars.join(", ")}
Posting frequency: ${frequency} posts/week
Platforms: ${platforms.join(", ")}
Month: ${month}

Each item: {"title":"...","caption":"...","platform":"...","suggestedDate":"YYYY-MM-DD","contentType":"...","hashtags":["#..."]}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.8,
    max_tokens: 4000,
  });

  const raw = completion.choices[0]?.message?.content?.trim() ?? "[]";
  let suggestions: unknown[];
  try {
    suggestions = JSON.parse(raw);
    if (!Array.isArray(suggestions)) throw new Error("not array");
  } catch {
    return NextResponse.json({ error: "AI_PARSE_ERROR" }, { status: 500 });
  }

  // Deduct credits atomically
  await prisma.workspace.update({
    where: { id: session.user.workspaceId },
    data: { aiCredits: { decrement: CREDIT_COST } },
  });

  return NextResponse.json({ suggestions });
}
```

### Modal Component — `src/components/calendar/CalendarAutofillModal.tsx`

```tsx
"use client";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Suggestion {
  title: string; caption: string; platform: string;
  suggestedDate: string; contentType: string; hashtags: string[];
}

export function CalendarAutofillModal({ open, onClose, month }: {
  open: boolean; onClose: () => void; month: string;
}) {
  const [step, setStep] = useState<"form" | "preview">("form");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [approved, setApproved] = useState<Set<number>>(new Set());
  const [form, setForm] = useState({
    brandNiche: "", contentPillars: ["", "", ""], frequency: 5, platforms: ["INSTAGRAM"],
  });

  async function generate() {
    setLoading(true);
    const res = await fetch("/api/ai/calendar-autofill", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, month }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { alert(data.error); return; }
    setSuggestions(data.suggestions);
    setApproved(new Set(data.suggestions.map((_: unknown, i: number) => i)));
    setStep("preview");
  }

  async function createPosts() {
    const toCreate = suggestions.filter((_, i) => approved.has(i));
    await fetch("/api/posts/bulk-draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ posts: toCreate }),
    });
    onClose();
  }

  function toggleApprove(i: number) {
    setApproved(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Auto-fill Calendar — {month}</DialogTitle>
        </DialogHeader>

        {step === "form" && (
          <div className="space-y-4">
            <Input placeholder="Brand niche (e.g. fitness coaching)"
              value={form.brandNiche} onChange={e => setForm(f => ({ ...f, brandNiche: e.target.value }))} />
            {form.contentPillars.map((p, i) => (
              <Input key={i} placeholder={`Content pillar ${i + 1}`} value={p}
                onChange={e => setForm(f => { const cp = [...f.contentPillars]; cp[i] = e.target.value; return { ...f, contentPillars: cp }; })} />
            ))}
            <Input type="number" placeholder="Posts per week" value={form.frequency}
              onChange={e => setForm(f => ({ ...f, frequency: Number(e.target.value) }))} />
            <Button onClick={generate} disabled={loading} className="w-full">
              {loading ? "Generating… (50 AI credits)" : "Generate 30 Post Ideas"}
            </Button>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-2">
            {suggestions.map((s, i) => (
              <div key={i} className={`p-3 border rounded flex justify-between items-start gap-2 ${approved.has(i) ? "border-green-500 bg-green-50" : "opacity-50"}`}>
                <div>
                  <p className="font-medium text-sm">{s.suggestedDate} · {s.platform} · {s.contentType}</p>
                  <p className="text-xs text-muted-foreground">{s.title}</p>
                </div>
                <Button size="sm" variant={approved.has(i) ? "default" : "outline"} onClick={() => toggleApprove(i)}>
                  {approved.has(i) ? "Approved" : "Rejected"}
                </Button>
              </div>
            ))}
            <Button onClick={createPosts} className="w-full mt-4">
              Create {approved.size} Draft Posts
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

---

## 5. Plan Gating Summary

| Check | Detail |
|---|---|
| Plan | `workspace.plan` must be `PRO` or `BUSINESS`; return `402 PRO_REQUIRED` otherwise |
| Credits | Deduct **50 AI credits** atomically via `{ decrement: 50 }` after successful generation |
| UI hint | Show credit cost on the generate button; disable if credits < 50 |
| Upsell | On `PRO_REQUIRED` response, redirect to `/settings/billing?ref=calendar-autofill` |
