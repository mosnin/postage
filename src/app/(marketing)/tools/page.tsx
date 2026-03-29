import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Hash,
  Type,
  Link2,
  Scissors,
  Instagram,
  Twitter,
  Linkedin,
  Youtube,
  ArrowRight,
  Clock,
} from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Free Social Media Tools — PostSyncer",
  description:
    "100+ free social media tools. AI caption generators, hashtag generators, character counters, UTM builders, and more. No account required.",
};

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

const CAPTION_PLATFORMS = [
  {
    label: "Instagram Caption Generator",
    platform: "instagram",
    icon: Instagram,
    description: "AI-crafted captions optimized for Instagram's algorithm and culture.",
  },
  {
    label: "Twitter Caption Generator",
    platform: "twitter",
    icon: Twitter,
    description: "Punchy, engaging tweets that fit within 280 characters.",
  },
  {
    label: "LinkedIn Caption Generator",
    platform: "linkedin",
    icon: Linkedin,
    description: "Thought-leadership captions for LinkedIn's professional audience.",
  },
  {
    label: "TikTok Caption Generator",
    platform: "tiktok",
    icon: Sparkles,
    description: "Trending, casual captions with hooks for TikTok's FYP.",
  },
  {
    label: "Facebook Caption Generator",
    platform: "facebook",
    icon: Sparkles,
    description: "Community-focused captions that drive Facebook engagement.",
  },
  {
    label: "YouTube Caption Generator",
    platform: "youtube",
    icon: Youtube,
    description: "SEO-friendly descriptions and captions for YouTube content.",
  },
];

interface ToolCard {
  label: string;
  href: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  comingSoon?: boolean;
}

const HASHTAG_TOOLS: ToolCard[] = [
  {
    label: "Hashtag Generator",
    href: "/tools/hashtag-generator",
    icon: Hash,
    description:
      "Generate 10–30 targeted hashtags grouped by popularity, niche, and trending.",
  },
  {
    label: "YouTube Tag Generator",
    href: "/tools/hashtag-generator?platform=YOUTUBE",
    icon: Youtube,
    description: "Find the best tags for YouTube video discoverability.",
  },
  {
    label: "UTM Campaign Builder",
    href: "/tools/utm-builder",
    icon: Link2,
    description: "Build trackable UTM links for any social media campaign.",
  },
];

const TEXT_TOOLS: ToolCard[] = [
  {
    label: "Character Counter",
    href: "/tools/character-counter",
    icon: Type,
    description:
      "Live character count for Twitter, Instagram, LinkedIn, Threads, Bluesky, and more.",
  },
  {
    label: "Twitter Thread Maker",
    href: "/tools/thread-maker",
    icon: Scissors,
    description: "Automatically split long text into numbered Twitter/Bluesky threads.",
  },
];

const COMING_SOON_TOOLS: ToolCard[] = [
  {
    label: "Instagram Feed Planner",
    href: "#",
    icon: Instagram,
    description: "Plan your Instagram grid visually before you post.",
    comingSoon: true,
  },
  {
    label: "Image Resizer Guide",
    href: "#",
    icon: Sparkles,
    description: "Up-to-date image size specs for every social media platform.",
    comingSoon: true,
  },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionHeader({ badge, title }: { badge: string; title: string }) {
  return (
    <div className="mb-6">
      <Badge variant="secondary" className="mb-2">
        {badge}
      </Badge>
      <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h2>
    </div>
  );
}

function GenericToolCard({ tool }: { tool: ToolCard }) {
  const Icon = tool.icon;
  return (
    <Card
      className={
        "group relative flex flex-col transition-shadow hover:shadow-md" +
        (tool.comingSoon ? " opacity-70" : "")
      }
    >
      <CardHeader className="pb-3">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex items-start gap-2">
          <h3 className="font-semibold leading-tight">{tool.label}</h3>
          {tool.comingSoon && (
            <Badge variant="secondary" className="shrink-0 text-xs">
              <Clock className="mr-1 h-2.5 w-2.5" />
              Soon
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        <p className="flex-1 text-sm text-muted-foreground">{tool.description}</p>
        {!tool.comingSoon && (
          <Button variant="outline" size="sm" className="mt-4 w-full" asChild>
            <Link href={tool.href}>
              Use Free
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ToolsIndexPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-background px-4 pb-14 pt-12 sm:px-6 lg:px-8">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl"
        >
          <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-primary/30 to-purple-400/20 opacity-25 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]" />
        </div>

        <div className="mx-auto max-w-3xl text-center">
          <Badge variant="secondary" className="mb-4 rounded-full px-4 py-1.5">
            <Sparkles className="mr-1.5 h-3.5 w-3.5 text-primary" />
            100+ Free Tools
          </Badge>
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl md:text-6xl">
            Free Social Media{" "}
            <span className="bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
              Tools
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
            No account required. Use our free tools to create captions, generate
            hashtags, and more — all powered by AI.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-16 px-4 pb-24 sm:px-6 lg:px-8">
        {/* AI Caption Generators */}
        <section>
          <SectionHeader badge="AI-Powered" title="Caption Generators" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CAPTION_PLATFORMS.map(({ label, platform, icon: Icon, description }) => (
              <Card
                key={platform}
                className="group relative flex flex-col transition-shadow hover:shadow-md"
              >
                <CardHeader className="pb-3">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold leading-tight">{label}</h3>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col">
                  <p className="flex-1 text-sm text-muted-foreground">{description}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 w-full"
                    asChild
                  >
                    <Link href={`/tools/caption-generator/${platform}`}>
                      Use Free
                      <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Hashtag & SEO Tools */}
        <section>
          <SectionHeader badge="Hashtags & SEO" title="Hashtag & SEO Tools" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {HASHTAG_TOOLS.map((tool) => (
              <GenericToolCard key={tool.href} tool={tool} />
            ))}
          </div>
        </section>

        {/* Text & Formatting */}
        <section>
          <SectionHeader badge="Text & Formatting" title="Text & Formatting" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TEXT_TOOLS.map((tool) => (
              <GenericToolCard key={tool.href} tool={tool} />
            ))}
          </div>
        </section>

        {/* Productivity / Coming Soon */}
        <section>
          <SectionHeader badge="Productivity" title="Coming Soon" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {COMING_SOON_TOOLS.map((tool) => (
              <GenericToolCard key={tool.label} tool={tool} />
            ))}
          </div>
        </section>

        {/* CTA Banner */}
        <section>
          <Card className="bg-gradient-to-br from-primary/10 via-background to-purple-500/10 border-primary/20">
            <CardContent className="py-12 text-center space-y-4">
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Need unlimited access?
              </h2>
              <p className="mx-auto max-w-md text-muted-foreground">
                Sign up free and get 1,000 AI credits per month, unlimited scheduled
                posts, and 11 platform integrations.
              </p>
              <div className="flex flex-col items-center justify-center gap-3 pt-2 sm:flex-row">
                <Button size="lg" asChild>
                  <Link href="/register">
                    Start For Free
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/#pricing">View Pricing</Link>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                No credit card required &bull; 7-day free trial
              </p>
            </CardContent>
          </Card>
        </section>
      </div>
    </>
  );
}
