"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  CalendarDays,
  MessageSquare,
  Users,
  BarChart2,
  Sparkles,
  Share2,
  Check,
  Star,
  ArrowRight,
  Zap,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Platform logos (SVG inline — avoids external image deps)
// ---------------------------------------------------------------------------

const PLATFORMS: { name: string; color: string; letter: string }[] = [
  { name: "Twitter / X", color: "#000000", letter: "X" },
  { name: "Facebook", color: "#1877F2", letter: "f" },
  { name: "Instagram", color: "#E1306C", letter: "IG" },
  { name: "TikTok", color: "#010101", letter: "TK" },
  { name: "YouTube", color: "#FF0000", letter: "YT" },
  { name: "Pinterest", color: "#E60023", letter: "P" },
  { name: "Threads", color: "#000000", letter: "TH" },
  { name: "Telegram", color: "#229ED9", letter: "TG" },
  { name: "LinkedIn", color: "#0A66C2", letter: "in" },
  { name: "Bluesky", color: "#0085FF", letter: "BS" },
  { name: "Mastodon", color: "#6364FF", letter: "M" },
];

// ---------------------------------------------------------------------------
// Feature cards data
// ---------------------------------------------------------------------------

const FEATURES = [
  {
    icon: Share2,
    title: "Schedule Once. Post Everywhere.",
    description:
      "Write your content once and publish it to all 11 supported platforms simultaneously. Save hours every week.",
  },
  {
    icon: CalendarDays,
    title: "Visual Content Calendar",
    description:
      "Drag-and-drop scheduling on a beautiful visual calendar. See your entire content strategy at a glance.",
  },
  {
    icon: Sparkles,
    title: "AI Content Studio",
    description:
      "Generate captions, images, and short-form videos from URLs, PDFs, or a simple prompt — in seconds.",
  },
  {
    icon: MessageSquare,
    title: "Unified Comments Inbox",
    description:
      "All replies, comments, and DMs from every platform in a single inbox. Never miss an engagement.",
  },
  {
    icon: Users,
    title: "Team Collaboration",
    description:
      "Invite unlimited team members, assign roles, and create approval workflows to keep content on-brand.",
  },
  {
    icon: BarChart2,
    title: "Cross-Platform Analytics",
    description:
      "Track performance across every account in one dashboard. Identify what works and double down.",
  },
];

// ---------------------------------------------------------------------------
// Pricing data
// ---------------------------------------------------------------------------

interface PricingPlan {
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  description: string;
  accounts: number;
  workspaces: number;
  storage: string;
  aiCredits: number;
  highlighted: boolean;
  features: string[];
}

const PRICING_PLANS: PricingPlan[] = [
  {
    name: "Starter",
    monthlyPrice: 29,
    annualPrice: 24,
    description: "Perfect for solo creators and small brands getting started.",
    accounts: 10,
    workspaces: 1,
    storage: "50 GB",
    aiCredits: 1000,
    highlighted: false,
    features: [
      "10 social accounts",
      "1 workspace",
      "50 GB media storage",
      "1,000 AI credits / mo",
      "Unlimited scheduled posts",
      "Unlimited team members",
      "Visual content calendar",
      "Unified inbox",
      "Basic analytics",
    ],
  },
  {
    name: "Pro",
    monthlyPrice: 49,
    annualPrice: 39,
    description: "For growing teams that need more power and flexibility.",
    accounts: 15,
    workspaces: 2,
    storage: "100 GB",
    aiCredits: 1000,
    highlighted: true,
    features: [
      "15 social accounts",
      "2 workspaces",
      "100 GB media storage",
      "1,000 AI credits / mo",
      "Unlimited scheduled posts",
      "Unlimited team members",
      "Approval workflows",
      "Advanced analytics",
      "Priority support",
    ],
  },
  {
    name: "Pro Plus",
    monthlyPrice: 99,
    annualPrice: 79,
    description: "For agencies and power users who need unlimited scale.",
    accounts: 30,
    workspaces: 3,
    storage: "Unlimited",
    aiCredits: 2000,
    highlighted: false,
    features: [
      "30 social accounts",
      "3 workspaces",
      "Unlimited media storage",
      "2,000 AI credits / mo",
      "Unlimited scheduled posts",
      "Unlimited team members",
      "Custom approval workflows",
      "White-label reports",
      "Dedicated account manager",
    ],
  },
];

// ---------------------------------------------------------------------------
// Testimonials
// ---------------------------------------------------------------------------

const TESTIMONIALS = [
  {
    name: "Sarah Chen",
    role: "Content Creator, 280K followers",
    avatar: "SC",
    quote:
      "PostSyncer cut my scheduling time by 80%. I write once, and it handles the rest across all my platforms. The AI captions are surprisingly good.",
    rating: 5,
  },
  {
    name: "Marcus Rivera",
    role: "Social Media Manager @ GrowthAgency",
    avatar: "MR",
    quote:
      "Managing 20+ client accounts used to be chaos. Now I have everything in one place — calendar, inbox, analytics. My clients love the reports.",
    rating: 5,
  },
  {
    name: "Aisha Thompson",
    role: "Founder, EcoThreads",
    avatar: "AT",
    quote:
      "The AI video generation from our product URLs is a game changer. We're producing TikTok content at a fraction of the cost we used to spend.",
    rating: 5,
  },
];

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function HomePage() {
  const [isAnnual, setIsAnnual] = useState(true);

  return (
    <>
      {/* ------------------------------------------------------------------ */}
      {/* HERO                                                                */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative overflow-hidden bg-background px-4 pb-20 pt-16 sm:px-6 lg:px-8">
        {/* Decorative gradient blob */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80"
        >
          <div
            className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-primary/30 to-purple-400/20 opacity-30 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"
            style={{
              clipPath:
                "polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)",
            }}
          />
        </div>

        <div className="mx-auto max-w-4xl text-center">
          {/* Social proof badge */}
          <div className="mb-6 flex justify-center">
            <Badge
              variant="secondary"
              className="rounded-full px-4 py-1.5 text-sm font-medium"
            >
              <Star className="mr-1.5 h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
              Loved by 50,000+ creators &bull; 4.8&#9733; (2,500 reviews)
            </Badge>
          </div>

          {/* Headline */}
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl md:text-6xl lg:text-7xl">
            Create Once.{" "}
            <span className="bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
              Share Everywhere.
            </span>
          </h1>

          {/* Sub-headline */}
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
            Manage all your social accounts. Schedule content and create AI videos &amp;
            images in minutes.
          </p>

          {/* CTA buttons */}
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" className="w-full sm:w-auto" asChild>
              <Link href="/register">
                Start For Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="w-full sm:w-auto" asChild>
              <Link href="/api/auth/signin?provider=google">
                <svg
                  className="mr-2 h-4 w-4"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Join with Google
              </Link>
            </Button>
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            No credit card required &bull; 7-day free trial &bull; Cancel anytime
          </p>

          {/* Platform logos */}
          <div id="platforms" className="mt-14">
            <p className="mb-5 text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Publish to 11 platforms
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {PLATFORMS.map((platform) => (
                <div
                  key={platform.name}
                  title={platform.name}
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-white text-xs font-bold shadow-sm"
                  style={{ backgroundColor: platform.color }}
                >
                  {platform.letter}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* FEATURES                                                            */}
      {/* ------------------------------------------------------------------ */}
      <section
        id="features"
        className="bg-muted/30 px-4 py-20 sm:px-6 lg:px-8"
      >
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <Badge variant="secondary" className="mb-3">Features</Badge>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Everything you need to dominate social media
            </h2>
            <p className="mt-4 text-muted-foreground">
              One platform to schedule, create, engage, and analyze — so you can
              focus on growing your audience.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <Card
                  key={feature.title}
                  className="group relative overflow-hidden transition-shadow hover:shadow-md"
                >
                  <CardHeader className="pb-3">
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="font-semibold">{feature.title}</h3>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* PRICING                                                             */}
      {/* ------------------------------------------------------------------ */}
      <section id="pricing" className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <Badge variant="secondary" className="mb-3">Pricing</Badge>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Simple, transparent pricing
            </h2>
            <p className="mt-4 text-muted-foreground">
              All plans include a 7-day free trial, unlimited team members, and
              unlimited scheduled posts.
            </p>

            {/* Billing toggle */}
            <div className="mt-6 flex items-center justify-center gap-3">
              <span
                className={cn(
                  "text-sm font-medium",
                  !isAnnual && "text-foreground",
                  isAnnual && "text-muted-foreground"
                )}
              >
                Monthly
              </span>
              <Switch
                checked={isAnnual}
                onCheckedChange={setIsAnnual}
                aria-label="Toggle annual billing"
              />
              <span
                className={cn(
                  "text-sm font-medium",
                  isAnnual && "text-foreground",
                  !isAnnual && "text-muted-foreground"
                )}
              >
                Annual
                <Badge className="ml-2 text-xs" variant="secondary">
                  Save up to 20%
                </Badge>
              </span>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-3">
            {PRICING_PLANS.map((plan) => {
              const price = isAnnual ? plan.annualPrice : plan.monthlyPrice;
              return (
                <Card
                  key={plan.name}
                  className={cn(
                    "relative flex flex-col",
                    plan.highlighted &&
                      "border-primary shadow-lg ring-2 ring-primary"
                  )}
                >
                  {plan.highlighted && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                      <Badge className="rounded-full px-3 py-0.5 text-xs font-semibold">
                        Most Popular
                      </Badge>
                    </div>
                  )}

                  <CardHeader className="pb-4">
                    <h3 className="text-lg font-bold">{plan.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {plan.description}
                    </p>
                    <div className="mt-3 flex items-end gap-1">
                      <span className="text-4xl font-extrabold">${price}</span>
                      <span className="mb-1 text-sm text-muted-foreground">/mo</span>
                    </div>
                    {isAnnual && (
                      <p className="text-xs text-muted-foreground">
                        Billed annually (${plan.annualPrice * 12}/yr)
                      </p>
                    )}
                  </CardHeader>

                  <CardContent className="flex flex-1 flex-col">
                    <Button
                      className="w-full"
                      variant={plan.highlighted ? "default" : "outline"}
                      asChild
                    >
                      <Link href="/register">Start 7-Day Free Trial</Link>
                    </Button>

                    <ul className="mt-6 space-y-2.5">
                      {plan.features.map((feature) => (
                        <li
                          key={feature}
                          className="flex items-start gap-2 text-sm"
                        >
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            All prices in USD. Cancel anytime. No hidden fees.
          </p>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* TESTIMONIALS                                                        */}
      {/* ------------------------------------------------------------------ */}
      <section className="bg-muted/30 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <Badge variant="secondary" className="mb-3">Testimonials</Badge>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Trusted by creators worldwide
            </h2>
            <p className="mt-4 text-muted-foreground">
              Join 50,000+ creators who have transformed their social media
              workflow with PostSyncer.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <Card key={t.name} className="flex flex-col">
                <CardContent className="flex flex-1 flex-col pt-6">
                  {/* Stars */}
                  <div className="mb-4 flex gap-0.5">
                    {Array.from({ length: t.rating }).map((_, i) => (
                      <Star
                        key={i}
                        className="h-4 w-4 fill-yellow-400 text-yellow-400"
                      />
                    ))}
                  </div>

                  <blockquote className="flex-1 text-sm text-muted-foreground leading-relaxed">
                    &ldquo;{t.quote}&rdquo;
                  </blockquote>

                  <div className="mt-6 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {t.avatar}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.role}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* FINAL CTA                                                           */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative overflow-hidden px-4 py-24 sm:px-6 lg:px-8">
        {/* Background gradient */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-primary/5 via-background to-purple-500/5"
        />

        <div className="mx-auto max-w-2xl text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Zap className="h-6 w-6 text-primary" />
            </div>
          </div>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Ready to grow your social media?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Join 50,000+ creators scheduling smarter. Start your free 7-day
            trial today — no credit card required.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" className="w-full sm:w-auto" asChild>
              <Link href="/register">
                Start For Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="w-full sm:w-auto" asChild>
              <Link href="#features">See all features</Link>
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            7-day free trial &bull; No credit card required &bull; Cancel anytime
          </p>
        </div>
      </section>
    </>
  );
}
