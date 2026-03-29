"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { PricingTable } from "@/components/marketing/pricing-table";
import { FaqAccordion, type FaqItem } from "@/components/marketing/faq-accordion";
import { cn } from "@/lib/utils";
import { Check, ArrowRight, Zap } from "lucide-react";

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

interface Plan {
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  description: string;
  highlighted: boolean;
  cta: string;
  features: string[];
}

const PLANS: Plan[] = [
  {
    name: "Starter",
    monthlyPrice: 29,
    annualPrice: 24,
    description: "Perfect for solo creators and small brands getting started.",
    highlighted: false,
    cta: "Start Free Trial",
    features: [
      "10 social accounts",
      "1 workspace",
      "50 GB media storage",
      "1,000 AI credits / mo",
      "Unlimited scheduled posts",
      "Unlimited team members",
      "Visual content calendar",
      "Unified comments inbox",
      "Basic analytics",
      "100 API posts / day",
    ],
  },
  {
    name: "Pro",
    monthlyPrice: 49,
    annualPrice: 39,
    description: "For growing teams that need more power and flexibility.",
    highlighted: true,
    cta: "Start Free Trial",
    features: [
      "15 social accounts",
      "2 workspaces",
      "100 GB media storage",
      "1,000 AI credits / mo",
      "Unlimited scheduled posts",
      "Unlimited team members",
      "Approval workflows",
      "Advanced analytics + export",
      "Priority email support",
      "250 API posts / day",
      "MCP access",
    ],
  },
  {
    name: "Pro Plus",
    monthlyPrice: 99,
    annualPrice: 79,
    description: "For agencies and power users who need unlimited scale.",
    highlighted: false,
    cta: "Start Free Trial",
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
      "500 API posts / day",
      "MCP access",
    ],
  },
];

const TABLE_COLUMNS = [
  { name: "Starter" },
  { name: "Pro", highlighted: true },
  { name: "Pro Plus" },
];

const TABLE_SECTIONS = [
  {
    title: "Publishing",
    rows: [
      { feature: "Scheduled posts", values: ["Unlimited", "Unlimited", "Unlimited"] },
      { feature: "Connected platforms", values: [10, 15, 30] },
      { feature: "Workspaces", values: [1, 2, 3] },
      { feature: "Drafts & queue", values: [true, true, true] },
      { feature: "Bulk scheduling", values: [false, true, true] },
      { feature: "First comment", values: [false, true, true] },
      { feature: "Thread posts", values: [true, true, true] },
      { feature: "Carousel posts", values: [true, true, true] },
    ],
  },
  {
    title: "AI Content Studio",
    rows: [
      { feature: "Caption generator", values: [true, true, true] },
      { feature: "Hashtag generator", values: [true, true, true] },
      { feature: "Content agent", values: [false, true, true] },
      { feature: "AI credits / mo", values: ["1,000", "1,000", "2,000"] },
      { feature: "Blog-to-social", values: [false, true, true] },
    ],
  },
  {
    title: "Analytics",
    rows: [
      { feature: "Basic analytics", values: [true, true, true] },
      { feature: "Advanced analytics", values: [false, true, true] },
      { feature: "Analytics export", values: [false, true, true] },
      { feature: "White-label reports", values: [false, false, true] },
    ],
  },
  {
    title: "Team & Collaboration",
    rows: [
      { feature: "Team members", values: ["Unlimited", "Unlimited", "Unlimited"] },
      { feature: "Approval workflow", values: [false, true, true] },
      { feature: "Custom approval flows", values: [false, false, true] },
      { feature: "Role permissions", values: [true, true, true] },
    ],
  },
  {
    title: "Media Library",
    rows: [
      { feature: "Storage", values: ["50 GB", "100 GB", "Unlimited"] },
      { feature: "Google Drive import", values: [true, true, true] },
      { feature: "Unsplash integration", values: [true, true, true] },
    ],
  },
  {
    title: "API & Integrations",
    rows: [
      { feature: "API daily post limit", values: ["100 / day", "250 / day", "500 / day"] },
      { feature: "MCP access", values: [false, true, true] },
    ],
  },
  {
    title: "Support",
    rows: [
      { feature: "Live chat", values: [false, true, true] },
      { feature: "Priority email", values: [false, true, true] },
      { feature: "Dedicated account manager", values: [false, false, true] },
    ],
  },
];

const PRICING_FAQS: FaqItem[] = [
  {
    question: "Can I cancel anytime?",
    answer:
      "Yes — absolutely no lock-in. Cancel at any time from your account settings and you will not be charged again. Your account stays active until the end of the current billing period.",
  },
  {
    question: "Is there a free trial?",
    answer:
      "Every plan includes a 7-day free trial. No credit card is required to start. You can explore all features and cancel before the trial ends with zero obligation.",
  },
  {
    question: "What happens if I exceed my limits?",
    answer:
      "If you hit a plan limit (e.g. connected accounts or AI credits) we will show an upgrade prompt inside the app. We will never auto-charge you or cut off your existing posts — your scheduled content keeps running.",
  },
  {
    question: "Can I switch plans?",
    answer:
      "Yes — upgrade or downgrade at any time. Upgrades take effect immediately with prorated billing. Downgrades take effect at the next renewal date.",
  },
  {
    question: "Do you offer refunds?",
    answer:
      "Yes. If you are not satisfied, contact our support team within 14 days of a charge and we will issue a full refund, no questions asked.",
  },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PricingPage() {
  const [isAnnual, setIsAnnual] = useState(true);

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
            Pricing
          </Badge>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl">
            Simple, Transparent Pricing
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            All plans include unlimited team members, unlimited scheduled posts,
            and a 7-day free trial. No credit card required.
          </p>

          {/* Toggle */}
          <div className="mt-8 flex items-center justify-center gap-3">
            <span
              className={cn(
                "text-sm font-medium",
                !isAnnual ? "text-foreground" : "text-muted-foreground"
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
                isAnnual ? "text-foreground" : "text-muted-foreground"
              )}
            >
              Annual
              <Badge className="ml-2 text-xs" variant="secondary">
                Save 20%
              </Badge>
            </span>
          </div>
        </div>
      </section>

      {/* Plan cards */}
      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-6 md:grid-cols-3">
            {PLANS.map((plan) => {
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
                    <h2 className="text-lg font-bold">{plan.name}</h2>
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
                      <Link href="/register">{plan.cta}</Link>
                    </Button>
                    <ul className="mt-6 space-y-2.5">
                      {plan.features.map((feat) => (
                        <li key={feat} className="flex items-start gap-2 text-sm">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            All prices in USD. Cancel anytime. No hidden fees.
          </p>
        </div>
      </section>

      {/* Full comparison table */}
      <section className="bg-muted/30 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-10 text-center">
            <Badge variant="secondary" className="mb-3">Compare Plans</Badge>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Everything side by side
            </h2>
            <p className="mt-4 text-muted-foreground">
              Every feature, every plan — no surprises.
            </p>
          </div>
          <PricingTable columns={TABLE_COLUMNS} sections={TABLE_SECTIONS} />
        </div>
      </section>

      {/* FAQ */}
      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <div className="mb-10 text-center">
            <Badge variant="secondary" className="mb-3">FAQ</Badge>
            <h2 className="text-3xl font-bold tracking-tight">
              Pricing questions answered
            </h2>
          </div>
          <FaqAccordion items={PRICING_FAQS} />
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative overflow-hidden bg-background px-4 py-20 sm:px-6 lg:px-8">
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
            Start growing today
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Join 50,000+ creators scheduling smarter. 7-day free trial, no
            credit card required.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button size="lg" className="w-full sm:w-auto" asChild>
              <Link href="/register">
                Get Started Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="w-full sm:w-auto" asChild>
              <Link href="/contact">Talk to sales</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
