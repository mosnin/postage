import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Check, X, ArrowRight, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

type ComparisonValue = boolean | string;

interface ComparisonRow {
  feature: string;
  postSyncer: ComparisonValue;
  competitor: ComparisonValue;
}

interface CompetitorData {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  competitorStartingPrice: string;
  postSyncerStartingPrice: string;
  winReasons: string[];
  table: ComparisonRow[];
  metaDescription: string;
}

const COMPETITOR_DATA: Record<string, CompetitorData> = {
  buffer: {
    slug: "buffer",
    name: "Buffer",
    tagline: "PostSyncer vs Buffer",
    description:
      "Buffer is a popular social media tool, but PostSyncer offers more platforms, unlimited team members, and AI-powered content creation at a lower price.",
    competitorStartingPrice: "$6/mo",
    postSyncerStartingPrice: "$24/mo (annual)",
    winReasons: [
      "11 platforms vs Buffer's 6 — post to Telegram, Mastodon, and Bluesky",
      "Unlimited team members on every plan vs Buffer's per-seat pricing",
      "Built-in AI content studio with caption, hashtag, and video generation",
      "Unified comments inbox so you never miss an engagement",
      "MCP server for AI agent integrations",
    ],
    table: [
      { feature: "Connected platforms", postSyncer: "11", competitor: "6" },
      { feature: "Unlimited team members", postSyncer: true, competitor: false },
      { feature: "Approval workflow", postSyncer: true, competitor: true },
      { feature: "AI caption generator", postSyncer: true, competitor: false },
      { feature: "AI hashtag generator", postSyncer: true, competitor: false },
      { feature: "Blog-to-social", postSyncer: true, competitor: false },
      { feature: "Unified comments inbox", postSyncer: true, competitor: true },
      { feature: "Bulk scheduling", postSyncer: true, competitor: true },
      { feature: "Media library", postSyncer: true, competitor: true },
      { feature: "Google Drive import", postSyncer: true, competitor: false },
      { feature: "API access", postSyncer: true, competitor: false },
      { feature: "MCP integration", postSyncer: true, competitor: false },
      { feature: "Telegram scheduling", postSyncer: true, competitor: false },
      { feature: "Mastodon scheduling", postSyncer: true, competitor: false },
      { feature: "Bluesky scheduling", postSyncer: true, competitor: false },
      { feature: "7-day free trial", postSyncer: true, competitor: true },
    ],
    metaDescription:
      "PostSyncer vs Buffer: more platforms, unlimited team members, and AI content tools for less. See the full comparison.",
  },
  hootsuite: {
    slug: "hootsuite",
    name: "Hootsuite",
    tagline: "PostSyncer vs Hootsuite",
    description:
      "Hootsuite is a household name, but its pricing is steep and team seats cost extra. PostSyncer delivers more AI-powered features at a fraction of the cost.",
    competitorStartingPrice: "$99/mo",
    postSyncerStartingPrice: "$24/mo (annual)",
    winReasons: [
      "Starting price 4× lower than Hootsuite's $99/mo entry plan",
      "Unlimited team members included vs Hootsuite's per-seat add-ons",
      "Modern AI content studio vs Hootsuite's bolt-on OwlyWriter",
      "Built-in MCP server for AI agent workflows",
      "No complex enterprise contracts — cancel anytime",
    ],
    table: [
      { feature: "Starting price / mo", postSyncer: "$24 (annual)", competitor: "$99" },
      { feature: "Team members", postSyncer: "Unlimited", competitor: "1 (extra cost)" },
      { feature: "Connected platforms", postSyncer: "11", competitor: "35+" },
      { feature: "AI caption generator", postSyncer: true, competitor: true },
      { feature: "AI video generation", postSyncer: true, competitor: false },
      { feature: "Blog-to-social", postSyncer: true, competitor: false },
      { feature: "Approval workflow", postSyncer: true, competitor: true },
      { feature: "Advanced analytics", postSyncer: true, competitor: true },
      { feature: "Bulk scheduling", postSyncer: true, competitor: true },
      { feature: "Media library", postSyncer: true, competitor: true },
      { feature: "API access", postSyncer: true, competitor: true },
      { feature: "MCP integration", postSyncer: true, competitor: false },
      { feature: "Telegram scheduling", postSyncer: true, competitor: false },
      { feature: "Mastodon scheduling", postSyncer: true, competitor: false },
      { feature: "No lock-in contract", postSyncer: true, competitor: false },
    ],
    metaDescription:
      "PostSyncer vs Hootsuite: 4× cheaper with unlimited team members and more AI features. See the full comparison.",
  },
  later: {
    slug: "later",
    name: "Later",
    tagline: "PostSyncer vs Later",
    description:
      "Later is great for Instagram, but PostSyncer supports 11 platforms and adds powerful AI content creation and team collaboration tools.",
    competitorStartingPrice: "$16.67/mo",
    postSyncerStartingPrice: "$24/mo (annual)",
    winReasons: [
      "11 platforms vs Later's limited platform support",
      "AI video and image generation from a URL or prompt",
      "Unlimited team members vs Later's per-seat pricing",
      "Unified inbox for comments and DMs across all platforms",
      "Full-featured API and MCP integration",
    ],
    table: [
      { feature: "Connected platforms", postSyncer: "11", competitor: "6" },
      { feature: "Team members", postSyncer: "Unlimited", competitor: "Limited by plan" },
      { feature: "Approval workflow", postSyncer: true, competitor: true },
      { feature: "AI caption generator", postSyncer: true, competitor: true },
      { feature: "AI hashtag generator", postSyncer: true, competitor: true },
      { feature: "AI video generation", postSyncer: true, competitor: false },
      { feature: "Blog-to-social", postSyncer: true, competitor: false },
      { feature: "Bulk scheduling", postSyncer: true, competitor: true },
      { feature: "Visual content calendar", postSyncer: true, competitor: true },
      { feature: "Unified comments inbox", postSyncer: true, competitor: false },
      { feature: "API access", postSyncer: true, competitor: false },
      { feature: "MCP integration", postSyncer: true, competitor: false },
      { feature: "Telegram scheduling", postSyncer: true, competitor: false },
      { feature: "Twitter thread scheduling", postSyncer: true, competitor: false },
      { feature: "7-day free trial", postSyncer: true, competitor: false },
    ],
    metaDescription:
      "PostSyncer vs Later: 11 platforms, unlimited team members, and AI video creation vs Later's Instagram-focused approach.",
  },
  "sprout-social": {
    slug: "sprout-social",
    name: "Sprout Social",
    tagline: "PostSyncer vs Sprout Social",
    description:
      "Sprout Social is enterprise-grade — and enterprise-priced. PostSyncer gives you 90% of the features at less than 20% of the cost, with a friendlier interface.",
    competitorStartingPrice: "$249/mo",
    postSyncerStartingPrice: "$24/mo (annual)",
    winReasons: [
      "Starting price 10× lower than Sprout Social's $249/mo",
      "Unlimited team members at no extra charge",
      "AI content studio built in — not an add-on",
      "MCP server for next-generation AI agent workflows",
      "No lengthy onboarding or enterprise sales process",
    ],
    table: [
      { feature: "Starting price / mo", postSyncer: "$24 (annual)", competitor: "$249" },
      { feature: "Team members", postSyncer: "Unlimited", competitor: "5 (extra cost)" },
      { feature: "Connected platforms", postSyncer: "11", competitor: "9" },
      { feature: "AI caption generator", postSyncer: true, competitor: true },
      { feature: "AI hashtag generator", postSyncer: true, competitor: false },
      { feature: "AI video generation", postSyncer: true, competitor: false },
      { feature: "Blog-to-social", postSyncer: true, competitor: false },
      { feature: "Approval workflow", postSyncer: true, competitor: true },
      { feature: "Advanced analytics", postSyncer: true, competitor: true },
      { feature: "Analytics export", postSyncer: true, competitor: true },
      { feature: "Media library", postSyncer: true, competitor: true },
      { feature: "API access", postSyncer: true, competitor: true },
      { feature: "MCP integration", postSyncer: true, competitor: false },
      { feature: "No lock-in contract", postSyncer: true, competitor: false },
      { feature: "7-day free trial", postSyncer: true, competitor: false },
    ],
    metaDescription:
      "PostSyncer vs Sprout Social: get 90% of the features at less than 20% of the cost. See the full comparison.",
  },
  agorapulse: {
    slug: "agorapulse",
    name: "Agorapulse",
    tagline: "PostSyncer vs Agorapulse",
    description:
      "Agorapulse is a solid tool for agencies, but PostSyncer adds AI content generation, MCP integration, and supports more emerging platforms at a better price.",
    competitorStartingPrice: "$49/mo",
    postSyncerStartingPrice: "$24/mo (annual)",
    winReasons: [
      "Unlimited team members vs Agorapulse's per-user billing",
      "AI content studio for captions, hashtags, and video generation",
      "MCP server for AI agent and automation workflows",
      "Supports Telegram, Mastodon, and Bluesky — Agorapulse does not",
      "50% cheaper on entry plan with more AI features included",
    ],
    table: [
      { feature: "Starting price / mo", postSyncer: "$24 (annual)", competitor: "$49" },
      { feature: "Team members", postSyncer: "Unlimited", competitor: "2 (extra cost)" },
      { feature: "Connected platforms", postSyncer: "11", competitor: "7" },
      { feature: "AI caption generator", postSyncer: true, competitor: true },
      { feature: "AI hashtag generator", postSyncer: true, competitor: false },
      { feature: "AI video generation", postSyncer: true, competitor: false },
      { feature: "Blog-to-social", postSyncer: true, competitor: false },
      { feature: "Approval workflow", postSyncer: true, competitor: true },
      { feature: "Unified inbox", postSyncer: true, competitor: true },
      { feature: "Advanced analytics", postSyncer: true, competitor: true },
      { feature: "Bulk scheduling", postSyncer: true, competitor: true },
      { feature: "API access", postSyncer: true, competitor: true },
      { feature: "MCP integration", postSyncer: true, competitor: false },
      { feature: "Telegram scheduling", postSyncer: true, competitor: false },
      { feature: "Mastodon scheduling", postSyncer: true, competitor: false },
      { feature: "7-day free trial", postSyncer: true, competitor: true },
    ],
    metaDescription:
      "PostSyncer vs Agorapulse: more platforms, unlimited team members, and AI content tools at half the price.",
  },
};

// ---------------------------------------------------------------------------
// Static params
// ---------------------------------------------------------------------------

export function generateStaticParams() {
  return Object.keys(COMPETITOR_DATA).map((competitor) => ({ competitor }));
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export async function generateMetadata({
  params,
}: {
  params: Promise<{ competitor: string }>;
}): Promise<Metadata> {
  const { competitor } = await params;
  const data = COMPETITOR_DATA[competitor];
  if (!data) return { title: "Comparison — PostSyncer" };
  return {
    title: `PostSyncer vs ${data.name} — Full Comparison`,
    description: data.metaDescription,
    openGraph: {
      title: `PostSyncer vs ${data.name}`,
      description: data.metaDescription,
      url: `https://postsyncer.com/compare/${competitor}`,
    },
  };
}

// ---------------------------------------------------------------------------
// Cell helper
// ---------------------------------------------------------------------------

function CompareCell({
  value,
  positive,
}: {
  value: ComparisonValue;
  positive?: boolean;
}) {
  if (typeof value === "boolean") {
    return value ? (
      <Check
        className={cn(
          "mx-auto h-5 w-5",
          positive ? "text-emerald-500" : "text-muted-foreground"
        )}
        aria-label="Yes"
      />
    ) : (
      <X
        className="mx-auto h-5 w-5 text-rose-400"
        aria-label="No"
      />
    );
  }
  return (
    <span
      className={cn(
        "text-sm font-medium",
        positive ? "text-foreground" : "text-muted-foreground"
      )}
    >
      {value}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function ComparisonPage({
  params,
}: {
  params: Promise<{ competitor: string }>;
}) {
  const { competitor } = await params;
  const data = COMPETITOR_DATA[competitor];
  if (!data) notFound();

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-background px-4 pb-16 pt-16 sm:px-6 lg:px-8">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl"
        >
          <div
            className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-primary/30 to-purple-400/20 opacity-30 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"
            style={{
              clipPath:
                "polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)",
            }}
          />
        </div>

        <div className="mx-auto max-w-3xl text-center">
          <Badge variant="secondary" className="mb-4 rounded-full px-4 py-1 text-sm">
            Comparison
          </Badge>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            {data.tagline}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            {data.description}
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button size="lg" className="w-full sm:w-auto" asChild>
              <Link href="/register">
                Try PostSyncer Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="w-full sm:w-auto" asChild>
              <Link href="/pricing">See pricing</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Pricing comparison */}
      <section className="bg-muted/30 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="mb-10 text-center">
            <Badge variant="secondary" className="mb-3">Pricing</Badge>
            <h2 className="text-3xl font-bold tracking-tight">
              See the price difference
            </h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <Card className="border-primary ring-2 ring-primary">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                    <Zap className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <span className="font-bold">PostSyncer</span>
                  <Badge className="ml-auto text-xs">Recommended</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-extrabold">
                  {data.postSyncerStartingPrice}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Starting price</p>
                <ul className="mt-4 space-y-1.5">
                  <li className="flex items-center gap-1.5 text-sm">
                    <Check className="h-4 w-4 text-primary" />
                    7-day free trial
                  </li>
                  <li className="flex items-center gap-1.5 text-sm">
                    <Check className="h-4 w-4 text-primary" />
                    No credit card required
                  </li>
                  <li className="flex items-center gap-1.5 text-sm">
                    <Check className="h-4 w-4 text-primary" />
                    Cancel anytime
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                    <span className="text-xs font-bold text-muted-foreground">
                      {data.name.slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <span className="font-bold">{data.name}</span>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-extrabold text-muted-foreground">
                  {data.competitorStartingPrice}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Starting price</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Comparison table */}
      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="mb-10 text-center">
            <Badge variant="secondary" className="mb-3">Feature Comparison</Badge>
            <h2 className="text-3xl font-bold tracking-tight">
              Head-to-head feature comparison
            </h2>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[480px] border-collapse text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Feature
                  </th>
                  <th className="px-4 py-3 text-center font-semibold text-primary">
                    PostSyncer
                  </th>
                  <th className="px-4 py-3 text-center font-semibold text-muted-foreground">
                    {data.name}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.table.map((row, i) => (
                  <tr
                    key={i}
                    className="border-t border-border hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium">{row.feature}</td>
                    <td className="px-4 py-3 text-center bg-primary/5">
                      <CompareCell value={row.postSyncer} positive />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <CompareCell value={row.competitor} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Why PostSyncer wins */}
      <section className="bg-muted/30 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="mb-10 text-center">
            <Badge variant="secondary" className="mb-3">Why PostSyncer</Badge>
            <h2 className="text-3xl font-bold tracking-tight">
              Why teams choose PostSyncer over {data.name}
            </h2>
          </div>
          <ul className="space-y-4">
            {data.winReasons.map((reason, i) => (
              <li
                key={i}
                className="flex items-start gap-3 rounded-xl border border-border bg-background p-4"
              >
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {i + 1}
                </div>
                <p className="text-sm leading-relaxed">{reason}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative overflow-hidden bg-background px-4 py-20 sm:px-6 lg:px-8">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-primary/5 via-background to-purple-500/5"
        />
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Make the switch today
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Import your existing scheduled posts and be up and running in
            minutes. 7-day free trial, no credit card required.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button size="lg" className="w-full sm:w-auto" asChild>
              <Link href="/register">
                Try PostSyncer Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="w-full sm:w-auto" asChild>
              <Link href="/pricing">Compare pricing</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Other comparisons */}
      <section className="bg-muted/30 px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-6 text-sm font-medium text-muted-foreground">
            See how PostSyncer compares to other tools:
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {Object.values(COMPETITOR_DATA)
              .filter((c) => c.slug !== competitor)
              .map((c) => (
                <Link key={c.slug} href={`/compare/${c.slug}`}>
                  <Badge
                    variant="secondary"
                    className="cursor-pointer px-3 py-1.5 text-sm transition-colors hover:bg-secondary/80"
                  >
                    PostSyncer vs {c.name}
                  </Badge>
                </Link>
              ))}
          </div>
        </div>
      </section>
    </>
  );
}
