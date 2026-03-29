import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CalendarDays,
  MessageSquare,
  Users,
  BarChart2,
  Sparkles,
  Share2,
  Image,
  Code2,
  Wrench,
  ArrowRight,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: "Features — PostSyncer",
  description:
    "Explore every feature PostSyncer offers: multi-platform scheduling, AI content studio, team collaboration, analytics, and more.",
  openGraph: {
    title: "Features — PostSyncer",
    description:
      "Everything you need to schedule, create, engage, and analyze social media in one place.",
    url: "https://postsyncer.com/features",
  },
};

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

interface FeatureSection {
  id: string;
  badge: string;
  icon: React.ElementType;
  heading: string;
  subheading: string;
  bullets: string[];
  screenshotAlt: string;
  screenshotBg: string;
}

const SECTIONS: FeatureSection[] = [
  {
    id: "scheduling",
    badge: "Scheduling & Publishing",
    icon: Share2,
    heading: "Schedule once. Publish everywhere.",
    subheading:
      "Write your content once and let PostSyncer handle delivery to all 11 supported platforms at exactly the right time — down to the second.",
    bullets: [
      "Unlimited scheduled posts across all plans",
      "Bulk scheduling: upload hundreds of posts via CSV",
      "Auto-recycle evergreen content",
      "Publish first comments, threads, and carousels",
      "Platform-specific caption customization per post",
    ],
    screenshotAlt: "Scheduling interface showing multi-platform post composer",
    screenshotBg: "from-blue-500/20 to-indigo-500/10",
  },
  {
    id: "calendar",
    badge: "Content Calendar",
    icon: CalendarDays,
    heading: "Your entire strategy at a glance.",
    subheading:
      "A drag-and-drop visual calendar that shows every scheduled post, draft, and approved piece of content across all your accounts.",
    bullets: [
      "Month, week, and day views",
      "Drag and drop to reschedule in seconds",
      "Filter by platform, account, or status",
      "Colour-coded post types for instant clarity",
      "Share read-only calendar links with clients",
    ],
    screenshotAlt: "Content calendar with drag-and-drop scheduling",
    screenshotBg: "from-emerald-500/20 to-teal-500/10",
  },
  {
    id: "ai",
    badge: "AI Content Studio",
    icon: Sparkles,
    heading: "Create content at the speed of thought.",
    subheading:
      "Generate captions, hashtags, images, and short-form videos from a URL, PDF, or simple prompt — powered by the latest AI models.",
    bullets: [
      "AI caption and hashtag generator",
      "Blog-to-social: turn any article into posts for every platform",
      "AI video generation from product URLs",
      "Content agent: full content calendar generation from a brief",
      "1,000–2,000 AI credits per month depending on plan",
    ],
    screenshotAlt: "AI content studio generating captions and hashtags",
    screenshotBg: "from-purple-500/20 to-pink-500/10",
  },
  {
    id: "team",
    badge: "Team Collaboration & Approvals",
    icon: Users,
    heading: "Keep your entire team on-brand.",
    subheading:
      "Invite unlimited team members, assign granular roles, and set up multi-step approval workflows so every post gets the green light before going live.",
    bullets: [
      "Unlimited team members on every plan",
      "Roles: Owner, Admin, Editor, Viewer",
      "Multi-step approval workflows (Pro & Pro Plus)",
      "Inline comments and revision requests",
      "Audit log for every action",
    ],
    screenshotAlt: "Team collaboration and approval workflow interface",
    screenshotBg: "from-orange-500/20 to-yellow-500/10",
  },
  {
    id: "analytics",
    badge: "Analytics & Insights",
    icon: BarChart2,
    heading: "Know exactly what drives growth.",
    subheading:
      "Cross-platform analytics in a single dashboard. Track reach, engagement, follower growth, and top-performing content — then export it all.",
    bullets: [
      "Unified metrics across all platforms",
      "Post-level performance breakdown",
      "Follower growth over time",
      "Best time to post recommendations",
      "CSV export and white-label PDF reports (Pro Plus)",
    ],
    screenshotAlt: "Analytics dashboard showing cross-platform metrics",
    screenshotBg: "from-cyan-500/20 to-blue-500/10",
  },
  {
    id: "inbox",
    badge: "Unified Comments Inbox",
    icon: MessageSquare,
    heading: "Never miss an engagement.",
    subheading:
      "All replies, comments, mentions, and DMs from every platform collected in a single, streamlined inbox. Respond without switching tabs.",
    bullets: [
      "Unified feed from all connected accounts",
      "Filter by platform, account, or keyword",
      "Reply without leaving PostSyncer",
      "Mark as done to keep the inbox clean",
      "Assign conversations to team members",
    ],
    screenshotAlt: "Unified inbox showing comments from multiple platforms",
    screenshotBg: "from-rose-500/20 to-pink-500/10",
  },
  {
    id: "media",
    badge: "Media Library",
    icon: Image,
    heading: "A home for all your brand assets.",
    subheading:
      "Store, organise, and reuse images, videos, and GIFs directly in PostSyncer. Import from Google Drive or browse Unsplash — all without leaving the composer.",
    bullets: [
      "50 GB – Unlimited storage depending on plan",
      "Drag-and-drop media uploader",
      "Google Drive import",
      "Unsplash integration for free stock photos",
      "Tag and search media by keyword",
    ],
    screenshotAlt: "Media library with image grid and upload interface",
    screenshotBg: "from-violet-500/20 to-purple-500/10",
  },
  {
    id: "api",
    badge: "API & MCP Integration",
    icon: Code2,
    heading: "Build and automate without limits.",
    subheading:
      "A developer-friendly REST API and MCP (Model Context Protocol) server let you schedule posts, pull analytics, and build custom workflows programmatically.",
    bullets: [
      "100–500 API post requests per day by plan",
      "MCP server for AI agent integration (Pro & Pro Plus)",
      "Webhooks for post status events",
      "Full API documentation with code examples",
      "Postman collection included",
    ],
    screenshotAlt: "API documentation and code example interface",
    screenshotBg: "from-slate-500/20 to-gray-500/10",
  },
  {
    id: "tools",
    badge: "Free Tools",
    icon: Wrench,
    heading: "Handy tools — free, no login required.",
    subheading:
      "A suite of standalone tools to help any creator, whether or not they are a PostSyncer customer.",
    bullets: [
      "Twitter / X character counter",
      "Hashtag generator",
      "Best time to post calculator",
      "Instagram bio link builder",
      "Social media image resizer",
    ],
    screenshotAlt: "Free tools landing page showing available utilities",
    screenshotBg: "from-green-500/20 to-emerald-500/10",
  },
];

// ---------------------------------------------------------------------------
// Screenshot placeholder
// ---------------------------------------------------------------------------

function ScreenshotPlaceholder({
  alt,
  bg,
}: {
  alt: string;
  bg: string;
}) {
  return (
    <div
      className={cn(
        "flex h-64 w-full items-center justify-center rounded-2xl bg-gradient-to-br border border-border/50 shadow-inner",
        bg
      )}
      role="img"
      aria-label={alt}
    >
      <span className="text-xs text-muted-foreground/60 px-4 text-center">
        {alt}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function FeaturesPage() {
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
            Features
          </Badge>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl">
            Everything you need to{" "}
            <span className="bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
              dominate social media
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            One platform to schedule, create, engage, and analyze — so you can
            focus on growing your audience.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button size="lg" className="w-full sm:w-auto" asChild>
              <Link href="/register">
                Start For Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="w-full sm:w-auto" asChild>
              <Link href="/pricing">See pricing</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Feature sections — alternating layout */}
      {SECTIONS.map((section, i) => {
        const Icon = section.icon;
        const isEven = i % 2 === 0;
        return (
          <section
            key={section.id}
            id={section.id}
            className={cn(
              "px-4 py-20 sm:px-6 lg:px-8",
              !isEven && "bg-muted/30"
            )}
          >
            <div className="mx-auto max-w-6xl">
              <div
                className={cn(
                  "flex flex-col items-center gap-12 lg:flex-row",
                  !isEven && "lg:flex-row-reverse"
                )}
              >
                {/* Text */}
                <div className="flex-1 space-y-5">
                  <Badge variant="secondary" className="w-fit">
                    <Icon className="mr-1.5 h-3.5 w-3.5" />
                    {section.badge}
                  </Badge>
                  <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                    {section.heading}
                  </h2>
                  <p className="text-muted-foreground leading-relaxed">
                    {section.subheading}
                  </p>
                  <ul className="space-y-2.5">
                    {section.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2 text-sm">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Screenshot placeholder */}
                <div className="flex-1 w-full">
                  <ScreenshotPlaceholder
                    alt={section.screenshotAlt}
                    bg={section.screenshotBg}
                  />
                </div>
              </div>
            </div>
          </section>
        );
      })}

      {/* Bottom CTA */}
      <section className="relative overflow-hidden bg-background px-4 py-20 sm:px-6 lg:px-8">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-primary/5 via-background to-purple-500/5"
        />
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Ready to try every feature?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Start your free 7-day trial today. No credit card required.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button size="lg" className="w-full sm:w-auto" asChild>
              <Link href="/register">
                Get Started Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="w-full sm:w-auto" asChild>
              <Link href="/pricing">View pricing</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
