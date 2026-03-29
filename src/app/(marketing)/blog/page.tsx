import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, CalendarDays, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: "Blog — PostSyncer",
  description:
    "Social media tips, product updates, and content strategy guides from the PostSyncer team.",
  openGraph: {
    title: "Blog — PostSyncer",
    description:
      "Social media tips, product updates, and content strategy guides from the PostSyncer team.",
    url: "https://postsyncer.com/blog",
  },
};

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  date: string;
  readTime: number;
  featured?: boolean;
  thumbnailBg: string;
}

const POSTS: BlogPost[] = [
  {
    slug: "how-to-schedule-instagram-posts",
    title: "How to Schedule Instagram Posts for Maximum Reach in 2026",
    excerpt:
      "Learn the best times to post on Instagram, how to use the content calendar, and how AI can help you create scroll-stopping captions in seconds.",
    category: "Guides",
    date: "March 20, 2026",
    readTime: 8,
    featured: true,
    thumbnailBg: "from-pink-500/30 to-rose-500/10",
  },
  {
    slug: "ai-content-strategy",
    title: "The AI-Powered Content Strategy That Grew Our Audience 3× in 90 Days",
    excerpt:
      "We used PostSyncer's AI content agent to generate a 90-day social calendar from scratch. Here is exactly what we did and what worked.",
    category: "Case Studies",
    date: "March 12, 2026",
    readTime: 6,
    thumbnailBg: "from-purple-500/30 to-indigo-500/10",
  },
  {
    slug: "best-times-to-post-2026",
    title: "The Best Times to Post on Every Platform in 2026",
    excerpt:
      "We analysed over 10 million posts across 11 platforms. Here are the definitive best times to post on Instagram, TikTok, X, LinkedIn, and more.",
    category: "Research",
    date: "March 5, 2026",
    readTime: 10,
    thumbnailBg: "from-cyan-500/30 to-blue-500/10",
  },
  {
    slug: "team-collaboration-social-media",
    title: "How to Set Up a Social Media Approval Workflow for Your Team",
    excerpt:
      "Approval workflows stop off-brand posts before they go live. Here is how to set up multi-step approvals in PostSyncer in under 10 minutes.",
    category: "Guides",
    date: "February 26, 2026",
    readTime: 5,
    thumbnailBg: "from-orange-500/30 to-yellow-500/10",
  },
  {
    slug: "twitter-threads-guide",
    title: "Twitter / X Threads: The Complete Guide to Going Viral",
    excerpt:
      "Thread posts outperform single tweets by 7× on average. Here is how to craft, schedule, and optimise threads with PostSyncer.",
    category: "Platform Guides",
    date: "February 18, 2026",
    readTime: 7,
    thumbnailBg: "from-slate-500/30 to-gray-500/10",
  },
  {
    slug: "social-media-analytics-guide",
    title: "A Beginner's Guide to Social Media Analytics (and What to Actually Measure)",
    excerpt:
      "Vanity metrics are not enough. Learn which KPIs actually matter, how to track them across platforms, and how to use data to inform your content strategy.",
    category: "Guides",
    date: "February 10, 2026",
    readTime: 9,
    thumbnailBg: "from-emerald-500/30 to-teal-500/10",
  },
];

const CATEGORIES = [
  "All",
  "Guides",
  "Case Studies",
  "Research",
  "Platform Guides",
  "Product Updates",
];

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function PostCard({ post, large = false }: { post: BlogPost; large?: boolean }) {
  return (
    <Link href={`/blog/${post.slug}`} className="group block h-full">
      <Card className="h-full overflow-hidden transition-shadow hover:shadow-md">
        {/* Thumbnail placeholder */}
        <div
          className={cn(
            "w-full bg-gradient-to-br",
            post.thumbnailBg,
            large ? "h-56 sm:h-72" : "h-40"
          )}
          role="img"
          aria-label={`Cover image for: ${post.title}`}
        />
        <CardHeader className={cn("pb-2", large && "pt-6")}>
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="text-xs">
              {post.category}
            </Badge>
          </div>
          <h2
            className={cn(
              "font-bold leading-snug group-hover:text-primary transition-colors",
              large ? "text-2xl sm:text-3xl mt-2" : "text-base mt-1"
            )}
          >
            {post.title}
          </h2>
        </CardHeader>
        <CardContent className="space-y-3">
          <p
            className={cn(
              "text-muted-foreground leading-relaxed",
              large ? "text-base" : "text-sm line-clamp-3"
            )}
          >
            {post.excerpt}
          </p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" />
              {post.date}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {post.readTime} min read
            </span>
          </div>
          {large && (
            <div className="pt-2">
              <Button variant="default" size="sm" className="group/btn">
                Read article
                <ArrowRight className="ml-2 h-3.5 w-3.5 transition-transform group-hover/btn:translate-x-0.5" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function BlogPage() {
  const featured = POSTS.find((p) => p.featured);
  const rest = POSTS.filter((p) => !p.featured);

  return (
    <div className="bg-background">
      {/* Hero */}
      <section className="border-b border-border bg-muted/30 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <Badge variant="secondary" className="mb-4 rounded-full px-4 py-1 text-sm">
            Blog
          </Badge>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            Social media insights &amp; guides
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Tips, tutorials, and strategies from the PostSyncer team — so you
            can grow your audience faster.
          </p>
        </div>
      </section>

      {/* Main content */}
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-12 lg:flex-row">
            {/* Posts */}
            <div className="flex-1 min-w-0">
              {/* Featured post */}
              {featured && (
                <div className="mb-12">
                  <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Featured
                  </p>
                  <PostCard post={featured} large />
                </div>
              )}

              {/* Grid of remaining posts */}
              <div>
                <p className="mb-6 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Latest articles
                </p>
                <div className="grid gap-6 sm:grid-cols-2">
                  {rest.map((post) => (
                    <PostCard key={post.slug} post={post} />
                  ))}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <aside className="w-full shrink-0 lg:w-56">
              <div className="sticky top-20 space-y-8">
                {/* Categories */}
                <div>
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                    Categories
                  </h3>
                  <ul className="space-y-1">
                    {CATEGORIES.map((cat) => (
                      <li key={cat}>
                        <button className="w-full rounded-md px-3 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                          {cat}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* CTA */}
                <div className="rounded-xl border border-border bg-muted/30 p-4">
                  <h3 className="font-semibold">Get started free</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Schedule posts to 11 platforms. 7-day trial, no card
                    needed.
                  </p>
                  <Button size="sm" className="mt-4 w-full" asChild>
                    <Link href="/register">Try PostSyncer</Link>
                  </Button>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </div>
  );
}
