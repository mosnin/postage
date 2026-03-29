import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PlatformHero } from "@/components/marketing/platform-hero";
import { ArrowRight, Check } from "lucide-react";

// ---------------------------------------------------------------------------
// Platform data
// ---------------------------------------------------------------------------

interface PlatformData {
  slug: string;
  name: string;
  letter: string;
  color: string;
  tagline: string;
  description: string;
  bullets: string[];
  stat: string;
  statLabel: string;
  steps: { title: string; description: string }[];
  extraFeatures: string[];
  metaDescription: string;
}

const PLATFORM_DATA: Record<string, PlatformData> = {
  twitter: {
    slug: "twitter",
    name: "Twitter / X",
    letter: "X",
    color: "#000000",
    tagline: "Twitter / X Scheduler — Post at peak times, every time.",
    description:
      "Schedule tweets, threads, and replies for Twitter / X with PostSyncer. Reach your audience at the perfect moment without being glued to your phone.",
    bullets: [
      "Schedule single tweets and full Twitter threads",
      "First-comment scheduling for boosted engagement",
      "Auto-recycle evergreen tweets to stay active",
    ],
    stat: "500M+",
    statLabel: "monthly active users on X",
    steps: [
      {
        title: "Connect your X account",
        description: "Authorize PostSyncer in seconds — no developer setup needed.",
      },
      {
        title: "Write and schedule",
        description:
          "Compose tweets or full threads in our editor, set your date and time, and confirm.",
      },
      {
        title: "PostSyncer publishes for you",
        description:
          "Sit back while PostSyncer posts at precisely the scheduled time.",
      },
    ],
    extraFeatures: [
      "280-character counter with real-time validation",
      "Thread composer with numbered turns",
      "Hashtag recommendations powered by AI",
      "Best-time suggestions based on your audience",
    ],
    metaDescription:
      "Schedule tweets and threads for Twitter / X with PostSyncer. Reach your audience at the perfect time, automatically.",
  },
  facebook: {
    slug: "facebook",
    name: "Facebook",
    letter: "f",
    color: "#1877F2",
    tagline: "Facebook Scheduler — Keep your Page active, effortlessly.",
    description:
      "Schedule Facebook posts, stories, and albums to any Page or Group with PostSyncer. Maintain a consistent presence without the daily grind.",
    bullets: [
      "Schedule to Facebook Pages and Groups",
      "Photo albums and carousel posts",
      "Optimal posting time recommendations",
    ],
    stat: "3B+",
    statLabel: "monthly active users on Facebook",
    steps: [
      {
        title: "Connect your Facebook Page",
        description: "Link your Page or Group via our secure OAuth flow.",
      },
      {
        title: "Create and queue posts",
        description:
          "Write your post, attach media, and choose a time — or use the AI assistant.",
      },
      {
        title: "Publish automatically",
        description: "PostSyncer delivers your content to Facebook on schedule.",
      },
    ],
    extraFeatures: [
      "Rich-text post editor",
      "Support for link previews",
      "Page Insights sync for analytics",
      "Bulk import via CSV",
    ],
    metaDescription:
      "Schedule Facebook posts to any Page or Group with PostSyncer. Maintain consistent engagement on autopilot.",
  },
  instagram: {
    slug: "instagram",
    name: "Instagram",
    letter: "IG",
    color: "#E1306C",
    tagline: "Instagram Scheduler — Your feed, perfectly curated.",
    description:
      "Schedule Instagram feed posts, Reels, Stories, and carousels with PostSyncer. Preview your grid, write captions, and queue hashtags — all in one place.",
    bullets: [
      "Feed posts, Reels, Stories, and carousels",
      "Visual grid preview before you publish",
      "Auto-post first comment with hashtag sets",
    ],
    stat: "2B+",
    statLabel: "monthly active users on Instagram",
    steps: [
      {
        title: "Connect your Instagram Business account",
        description: "Link via Facebook Login — requires an Instagram Business or Creator account.",
      },
      {
        title: "Design your content",
        description:
          "Upload media, craft captions, and see exactly how your grid will look.",
      },
      {
        title: "Schedule and relax",
        description:
          "PostSyncer publishes at your chosen time and adds your first comment automatically.",
      },
    ],
    extraFeatures: [
      "Hashtag sets for instant reuse",
      "2,200-character caption editor",
      "Unsplash integration for stock photos",
      "Stories scheduling via push notification",
    ],
    metaDescription:
      "Schedule Instagram posts, Reels, and carousels with PostSyncer. Preview your grid and automate hashtag comments.",
  },
  tiktok: {
    slug: "tiktok",
    name: "TikTok",
    letter: "TK",
    color: "#010101",
    tagline: "TikTok Scheduler — Go viral on your schedule.",
    description:
      "Plan and schedule TikTok videos with PostSyncer. Get AI-generated captions and hashtags, post at peak hours, and grow your following on autopilot.",
    bullets: [
      "Schedule TikTok videos with captions and hashtags",
      "AI video captions optimized for TikTok's algorithm",
      "Post at your audience's peak engagement hours",
    ],
    stat: "1.5B+",
    statLabel: "monthly active users on TikTok",
    steps: [
      {
        title: "Connect your TikTok account",
        description: "Authorize PostSyncer via TikTok's official OAuth.",
      },
      {
        title: "Upload your video",
        description:
          "Add your video file, write an AI-assisted caption, and pick your hashtags.",
      },
      {
        title: "Schedule and publish",
        description: "PostSyncer uploads and publishes at your scheduled time.",
      },
    ],
    extraFeatures: [
      "2,200-character caption editor",
      "AI hashtag suggestions tuned for TikTok",
      "Content agent: generate 30-day TikTok plans",
      "Analytics: views, likes, shares, and watch-time",
    ],
    metaDescription:
      "Schedule TikTok videos with PostSyncer. AI captions, trending hashtags, and peak-time scheduling for maximum reach.",
  },
  youtube: {
    slug: "youtube",
    name: "YouTube",
    letter: "YT",
    color: "#FF0000",
    tagline: "YouTube Scheduler — Upload on autopilot.",
    description:
      "Schedule YouTube videos, Shorts, and community posts with PostSyncer. Set titles, descriptions, tags, and thumbnails in advance.",
    bullets: [
      "Schedule YouTube videos and Shorts",
      "Set titles, descriptions, tags, and thumbnails",
      "Community post scheduling",
    ],
    stat: "2.7B+",
    statLabel: "monthly logged-in users on YouTube",
    steps: [
      {
        title: "Connect your YouTube channel",
        description: "Link via Google OAuth — no developer keys required.",
      },
      {
        title: "Prepare your upload",
        description:
          "Set your video title, description, tags, thumbnail, and visibility settings.",
      },
      {
        title: "Publish on schedule",
        description: "PostSyncer triggers the upload at the exact time you choose.",
      },
    ],
    extraFeatures: [
      "5,000-character description editor",
      "Custom thumbnail upload",
      "Public / Unlisted / Private visibility options",
      "YouTube Shorts support",
    ],
    metaDescription:
      "Schedule YouTube videos and Shorts with PostSyncer. Set titles, descriptions, thumbnails, and publish on autopilot.",
  },
  pinterest: {
    slug: "pinterest",
    name: "Pinterest",
    letter: "P",
    color: "#E60023",
    tagline: "Pinterest Scheduler — Pin at the perfect moment.",
    description:
      "Schedule pins to any Pinterest board with PostSyncer. Reach pinners when they are most active and drive consistent traffic to your site.",
    bullets: [
      "Schedule pins to any board",
      "Add destination URLs and alt text",
      "Optimal pin-time recommendations",
    ],
    stat: "465M+",
    statLabel: "monthly active users on Pinterest",
    steps: [
      {
        title: "Connect your Pinterest account",
        description: "Link via Pinterest OAuth in under 30 seconds.",
      },
      {
        title: "Create your pin",
        description: "Upload an image, write a description, and add your destination link.",
      },
      {
        title: "Schedule and track",
        description: "PostSyncer pins at the scheduled time and tracks clicks in analytics.",
      },
    ],
    extraFeatures: [
      "500-character description editor",
      "Board selection per post",
      "Link tracking integration",
      "Bulk pin scheduling via CSV",
    ],
    metaDescription:
      "Schedule Pinterest pins with PostSyncer. Drive consistent traffic with perfectly timed pins to any board.",
  },
  threads: {
    slug: "threads",
    name: "Threads",
    letter: "TH",
    color: "#000000",
    tagline: "Threads Scheduler — Build your Threads presence automatically.",
    description:
      "Schedule posts and threads for Meta's Threads app with PostSyncer. Stay active without being online all day.",
    bullets: [
      "Schedule Threads posts and multi-part threads",
      "500-character limit with real-time counter",
      "Cross-post from Instagram or X with one click",
    ],
    stat: "175M+",
    statLabel: "monthly active users on Threads",
    steps: [
      {
        title: "Connect your Threads account",
        description: "Link via Meta OAuth — uses your existing Instagram Business account.",
      },
      {
        title: "Compose your thread",
        description: "Write a single post or chain multiple turns into a full thread.",
      },
      {
        title: "Publish on autopilot",
        description: "PostSyncer posts to Threads at your chosen time.",
      },
    ],
    extraFeatures: [
      "Multi-part thread composer",
      "Cross-platform repurposing from Instagram",
      "AI caption suggestions tuned for Threads",
      "Engagement analytics",
    ],
    metaDescription:
      "Schedule Threads posts and threads with PostSyncer. Stay active on Threads without being online all day.",
  },
  telegram: {
    slug: "telegram",
    name: "Telegram",
    letter: "TG",
    color: "#229ED9",
    tagline: "Telegram Scheduler — Keep your channel fresh around the clock.",
    description:
      "Schedule messages, images, and files to any Telegram channel or group with PostSyncer. Automate broadcasts and keep subscribers engaged.",
    bullets: [
      "Schedule text, images, and file messages",
      "Broadcast to channels and groups",
      "Rich-text formatting with Markdown support",
    ],
    stat: "900M+",
    statLabel: "monthly active users on Telegram",
    steps: [
      {
        title: "Connect your Telegram channel",
        description: "Add the PostSyncer bot as an admin to your channel.",
      },
      {
        title: "Write your message",
        description: "Compose text, attach media or files, and format with Markdown.",
      },
      {
        title: "Schedule and broadcast",
        description: "PostSyncer sends the message to your channel at the right time.",
      },
    ],
    extraFeatures: [
      "4,096-character message limit",
      "Markdown and HTML formatting",
      "File and document attachments",
      "Silent message option",
    ],
    metaDescription:
      "Schedule Telegram messages and broadcasts with PostSyncer. Keep your channel active around the clock, automatically.",
  },
  linkedin: {
    slug: "linkedin",
    name: "LinkedIn",
    letter: "in",
    color: "#0A66C2",
    tagline: "LinkedIn Scheduler — Build thought leadership on autopilot.",
    description:
      "Schedule LinkedIn posts, articles, and carousels with PostSyncer. Grow your professional network and establish authority without logging in every day.",
    bullets: [
      "Schedule LinkedIn posts and document carousels",
      "Post from personal profiles and Company Pages",
      "AI captions optimized for LinkedIn's algorithm",
    ],
    stat: "1B+",
    statLabel: "members on LinkedIn",
    steps: [
      {
        title: "Connect your LinkedIn profile or Page",
        description: "Authorize via LinkedIn OAuth — takes under a minute.",
      },
      {
        title: "Write your post",
        description:
          "Use the AI assistant to craft a post, or write your own and attach media or documents.",
      },
      {
        title: "Schedule and grow",
        description: "PostSyncer publishes at peak business hours for maximum reach.",
      },
    ],
    extraFeatures: [
      "3,000-character post editor",
      "Document carousel scheduling",
      "Company Page support",
      "LinkedIn analytics integration",
    ],
    metaDescription:
      "Schedule LinkedIn posts and carousels with PostSyncer. Grow your professional network and build thought leadership automatically.",
  },
  bluesky: {
    slug: "bluesky",
    name: "Bluesky",
    letter: "BS",
    color: "#0085FF",
    tagline: "Bluesky Scheduler — Grow your Bluesky following on autopilot.",
    description:
      "Schedule posts and threads for Bluesky with PostSyncer. The open social web deserves consistent, quality content — let us handle the timing.",
    bullets: [
      "Schedule Bluesky posts and thread replies",
      "300-character limit with live counter",
      "Cross-post from X or Threads in one click",
    ],
    stat: "30M+",
    statLabel: "registered users on Bluesky",
    steps: [
      {
        title: "Connect your Bluesky account",
        description: "Enter your Bluesky handle and generate an app password.",
      },
      {
        title: "Compose your post",
        description: "Write up to 300 characters, add links, images, or quote-posts.",
      },
      {
        title: "Publish automatically",
        description: "PostSyncer posts to Bluesky at your scheduled time.",
      },
    ],
    extraFeatures: [
      "Thread starter and reply scheduling",
      "App password — no main password required",
      "Cross-platform repurposing from X",
      "Engagement analytics",
    ],
    metaDescription:
      "Schedule Bluesky posts and threads with PostSyncer. Grow your following on the open social web, automatically.",
  },
  mastodon: {
    slug: "mastodon",
    name: "Mastodon",
    letter: "M",
    color: "#6364FF",
    tagline: "Mastodon Scheduler — Stay active on the open web.",
    description:
      "Schedule toots for any Mastodon instance with PostSyncer. Reach your federated community consistently without being online all the time.",
    bullets: [
      "Schedule toots to any Mastodon instance",
      "CW (content warning) and visibility controls",
      "Cross-post from other platforms to Mastodon",
    ],
    stat: "8M+",
    statLabel: "monthly active users across Mastodon",
    steps: [
      {
        title: "Connect your Mastodon account",
        description: "Authorize PostSyncer on your chosen Mastodon instance via OAuth.",
      },
      {
        title: "Write your toot",
        description:
          "Compose up to 500 characters, add media, set visibility, and add a content warning if needed.",
      },
      {
        title: "Schedule and federate",
        description: "PostSyncer publishes your toot at the perfect time.",
      },
    ],
    extraFeatures: [
      "500-character editor",
      "Content Warning (CW) field",
      "Public / Unlisted / Followers-only / Direct visibility",
      "Any Mastodon instance supported",
    ],
    metaDescription:
      "Schedule Mastodon toots with PostSyncer. Stay consistently active on any Mastodon instance with automated scheduling.",
  },
};

// ---------------------------------------------------------------------------
// Static params
// ---------------------------------------------------------------------------

export function generateStaticParams() {
  return Object.keys(PLATFORM_DATA).map((platform) => ({ platform }));
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
  const data = PLATFORM_DATA[platform];
  if (!data) {
    return { title: "Platform Not Found — PostSyncer" };
  }
  return {
    title: `${data.name} Scheduler — PostSyncer`,
    description: data.metaDescription,
    openGraph: {
      title: `${data.name} Scheduler — PostSyncer`,
      description: data.metaDescription,
      url: `https://postsyncer.com/platforms/${platform}`,
    },
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function PlatformPage({
  params,
}: {
  params: Promise<{ platform: string }>;
}) {
  const { platform } = await params;
  const data = PLATFORM_DATA[platform];
  if (!data) notFound();

  return (
    <>
      {/* Hero */}
      <PlatformHero
        platformName={data.name}
        platformLetter={data.letter}
        platformColor={data.color}
        tagline={data.tagline}
        description={data.description}
        bullets={data.bullets}
        stat={data.stat}
        statLabel={data.statLabel}
      />

      {/* How it works */}
      <section className="bg-muted/30 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-12 text-center">
            <Badge variant="secondary" className="mb-3">How it works</Badge>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Up and running in 3 steps
            </h2>
          </div>
          <div className="grid gap-8 sm:grid-cols-3">
            {data.steps.map((step, i) => (
              <div key={i} className="relative flex flex-col items-center text-center">
                <div
                  className="mb-4 flex h-12 w-12 items-center justify-center rounded-full text-white text-lg font-bold shadow-md"
                  style={{ backgroundColor: data.color }}
                >
                  {i + 1}
                </div>
                {/* Connector line */}
                {i < data.steps.length - 1 && (
                  <div
                    className="absolute left-[calc(50%+24px)] top-6 hidden h-0.5 w-[calc(100%-48px)] sm:block"
                    style={{ backgroundColor: `${data.color}33` }}
                  />
                )}
                <h3 className="font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Extra features */}
      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-10 text-center">
            <Badge variant="secondary" className="mb-3">
              {data.name}-specific features
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight">
              Built for {data.name}
            </h2>
            <p className="mt-4 text-muted-foreground">
              PostSyncer supports {data.name}-specific capabilities out of the
              box — no workarounds needed.
            </p>
          </div>
          <ul className="mx-auto grid max-w-2xl gap-3 sm:grid-cols-2">
            {data.extraFeatures.map((feat) => (
              <li key={feat} className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{feat}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden bg-background px-4 py-20 sm:px-6 lg:px-8">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-primary/5 via-background to-purple-500/5"
        />
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Start scheduling {data.name} today
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            7-day free trial. No credit card required. Connect your {data.name}{" "}
            account in seconds.
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

      {/* Other platforms */}
      <section className="bg-muted/30 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h3 className="mb-6 text-lg font-semibold">
            PostSyncer also supports:
          </h3>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {Object.values(PLATFORM_DATA)
              .filter((p) => p.slug !== platform)
              .map((p) => (
                <Link key={p.slug} href={`/platforms/${p.slug}`}>
                  <Card className="cursor-pointer transition-shadow hover:shadow-md">
                    <CardContent className="flex items-center gap-2 px-4 py-2">
                      <div
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-white text-xs font-bold"
                        style={{ backgroundColor: p.color }}
                      >
                        {p.letter}
                      </div>
                      <span className="text-sm font-medium">{p.name}</span>
                    </CardContent>
                  </Card>
                </Link>
              ))}
          </div>
        </div>
      </section>
    </>
  );
}
