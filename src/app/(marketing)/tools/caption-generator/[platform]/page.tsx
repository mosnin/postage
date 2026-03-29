import { CaptionGeneratorTool } from "@/components/tools/caption-generator-tool";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

// ---------------------------------------------------------------------------
// Platform config
// ---------------------------------------------------------------------------

const PLATFORM_CONFIG: Record<
  string,
  {
    label: string;
    displayName: string;
    description: string;
    tips: string[];
    charLimit: number;
  }
> = {
  instagram: {
    label: "Instagram",
    displayName: "Instagram Caption Generator",
    description:
      "Generate engaging, algorithm-friendly Instagram captions with the right tone, length, and hashtags — powered by AI.",
    tips: [
      "Start with a strong hook in the first line",
      "Add a call-to-action (e.g. 'Save this for later')",
      "Use 3–5 relevant hashtags for best reach",
      "Optimal length: 138–150 characters",
    ],
    charLimit: 2200,
  },
  twitter: {
    label: "Twitter / X",
    displayName: "Twitter / X Caption Generator",
    description:
      "Craft punchy, engaging tweets that fit within 280 characters and drive retweets, likes, and replies.",
    tips: [
      "Keep it under 280 characters",
      "Use 1–2 hashtags maximum",
      "Ask a question to boost replies",
      "Add a strong opinion or hot take",
    ],
    charLimit: 280,
  },
  linkedin: {
    label: "LinkedIn",
    displayName: "LinkedIn Caption Generator",
    description:
      "Create thought-leadership posts and professional captions for LinkedIn that generate comments and shares.",
    tips: [
      "Start with a bold first-person statement",
      "Use line breaks for readability",
      "End with a question to spark discussion",
      "Optimal: 1,300–2,000 characters",
    ],
    charLimit: 3000,
  },
  tiktok: {
    label: "TikTok",
    displayName: "TikTok Caption Generator",
    description:
      "Generate casual, trendy TikTok captions with hooks that land on the FYP and drive views.",
    tips: [
      "Keep it short — under 150 characters",
      "Use trending sounds/topics as context",
      "Include 3–5 trending hashtags",
      "Add FYP-friendly terms like 'POV:' or 'Tell me you…'",
    ],
    charLimit: 2200,
  },
  facebook: {
    label: "Facebook",
    displayName: "Facebook Caption Generator",
    description:
      "Write community-focused Facebook captions that spark conversations and drive organic reach.",
    tips: [
      "Ask a question to encourage comments",
      "Tag relevant pages or people",
      "Use 1–2 hashtags at most",
      "Keep under 80 characters for best reach",
    ],
    charLimit: 63206,
  },
  youtube: {
    label: "YouTube",
    displayName: "YouTube Description Generator",
    description:
      "Create SEO-optimized YouTube descriptions and captions that help your videos rank and get more views.",
    tips: [
      "Include primary keywords in first 100 characters",
      "Add timestamps for long videos",
      "Link to related content",
      "Use chapters for better UX",
    ],
    charLimit: 5000,
  },
};

const PLATFORMS = Object.keys(PLATFORM_CONFIG);

// ---------------------------------------------------------------------------
// Static params
// ---------------------------------------------------------------------------

export async function generateStaticParams() {
  return PLATFORMS.map((platform) => ({ platform }));
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export async function generateMetadata({
  params,
}: {
  params: Promise<{ platform: string }>;
}): Promise<Metadata> {
  const { platform } = await params;
  const config = PLATFORM_CONFIG[platform];
  if (!config) return {};

  return {
    title: `Free ${config.displayName} — PostSyncer`,
    description: config.description,
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function CaptionGeneratorPage({
  params,
}: {
  params: Promise<{ platform: string }>;
}) {
  const { platform } = await params;
  const config = PLATFORM_CONFIG[platform];

  if (!config) notFound();

  return (
    <>
      {/* Header */}
      <section className="bg-muted/30 border-b px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="mb-4">
            <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" asChild>
              <Link href="/tools">
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                All free tools
              </Link>
            </Button>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div>
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  {config.displayName}
                </h1>
                <Badge variant="secondary">Free</Badge>
              </div>
              <p className="text-muted-foreground">{config.description}</p>
            </div>
          </div>

          {/* Tips */}
          <div className="mt-6 rounded-lg border bg-background/70 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {config.label} Tips
            </p>
            <ul className="grid gap-1 sm:grid-cols-2">
              {config.tips.map((tip) => (
                <li
                  key={tip}
                  className="flex items-start gap-2 text-sm text-muted-foreground"
                >
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Tool */}
      <section className="px-4 py-10 sm:px-6 lg:px-8">
        <CaptionGeneratorTool
          platform={platform}
          platformLabel={config.label}
        />
      </section>
    </>
  );
}
