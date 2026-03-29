import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FaqAccordion, type FaqCategory } from "@/components/marketing/faq-accordion";
import { ArrowRight, MessageSquare } from "lucide-react";

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: "FAQ — PostSyncer",
  description:
    "Find answers to frequently asked questions about PostSyncer — billing, features, platforms, team collaboration, and more.",
  openGraph: {
    title: "Frequently Asked Questions — PostSyncer",
    description:
      "Everything you need to know about PostSyncer — from getting started to advanced API usage.",
    url: "https://postsyncer.com/faqs",
  },
};

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const FAQ_CATEGORIES: FaqCategory[] = [
  {
    category: "Getting Started",
    items: [
      {
        question: "What is PostSyncer?",
        answer:
          "PostSyncer is a social media scheduling and management platform that lets you schedule posts to 11 platforms simultaneously, generate AI content, collaborate with your team, manage a media library, and track analytics — all from one dashboard.",
      },
      {
        question: "Do I need a credit card to sign up?",
        answer:
          "No credit card is required to start your 7-day free trial. You only need to add a payment method when you choose to continue after the trial ends.",
      },
      {
        question: "How do I connect my social accounts?",
        answer:
          "After signing up, navigate to Settings → Connected Accounts and click the platform you want to add. You will be redirected through a secure OAuth flow. Most platforms are connected in under 30 seconds.",
      },
      {
        question: "Which social platforms does PostSyncer support?",
        answer:
          "PostSyncer currently supports Twitter / X, Facebook, Instagram, TikTok, YouTube, Pinterest, Threads, Telegram, LinkedIn, Bluesky, and Mastodon — 11 platforms in total.",
      },
      {
        question: "Is there a mobile app?",
        answer:
          "The PostSyncer web app is fully responsive and works great on mobile browsers. Dedicated iOS and Android apps are on our roadmap.",
      },
    ],
  },
  {
    category: "Billing",
    items: [
      {
        question: "What plans are available?",
        answer:
          "PostSyncer offers three plans: Starter ($29/mo or $24/mo billed annually), Pro ($49/mo or $39/mo annually), and Pro Plus ($99/mo or $79/mo annually). All plans include a 7-day free trial.",
      },
      {
        question: "How does annual billing work?",
        answer:
          "Choosing annual billing gives you up to 20% off compared to monthly. Your card is charged once per year for the full annual amount. You still get the same 7-day free trial before any charge.",
      },
      {
        question: "Can I cancel anytime?",
        answer:
          "Yes — there is absolutely no lock-in. Cancel at any time from your account settings. Your plan stays active until the end of the current billing period and you will not be charged again.",
      },
      {
        question: "What happens at the end of my free trial?",
        answer:
          "At the end of your 7-day trial we will prompt you to add a payment method to continue. If you do not, your account is downgraded to read-only mode — your data is kept safe for 30 days so you can reactivate at any time.",
      },
      {
        question: "Can I switch between plans?",
        answer:
          "Yes. Upgrades take effect immediately with prorated billing. Downgrades take effect at the start of your next billing cycle.",
      },
      {
        question: "Do you offer refunds?",
        answer:
          "Yes. If you are not satisfied, contact support within 14 days of a charge and we will issue a full refund — no questions asked.",
      },
      {
        question: "Do you offer discounts for non-profits or students?",
        answer:
          "Yes — we offer a 50% discount for registered non-profits and educational institutions. Contact us at billing@postsyncer.com with proof of status.",
      },
    ],
  },
  {
    category: "Features",
    items: [
      {
        question: "How many posts can I schedule?",
        answer:
          "All plans include unlimited scheduled posts. There is no cap on how many posts you can queue up.",
      },
      {
        question: "What are AI credits?",
        answer:
          "AI credits power the AI Content Studio — caption generation, hashtag suggestions, image generation, and video creation. Starter and Pro plans include 1,000 credits per month; Pro Plus includes 2,000. Credits reset on your billing date.",
      },
      {
        question: "Can I bulk schedule posts?",
        answer:
          "Yes — on Pro and Pro Plus plans you can upload a CSV file to schedule hundreds of posts at once. The CSV importer is available under Posts → Bulk Import.",
      },
      {
        question: "Does PostSyncer support posting first comments?",
        answer:
          "Yes — on Pro and Pro Plus plans you can schedule a first comment to publish automatically with your post. This is especially useful for adding hashtag sets to Instagram posts.",
      },
      {
        question: "Can I post Twitter / X threads?",
        answer:
          "Yes. The thread composer lets you write multi-part threads, preview them, and schedule them to publish in sequence.",
      },
      {
        question: "What analytics does PostSyncer provide?",
        answer:
          "Starter plans get basic analytics (reach, impressions, likes). Pro and Pro Plus plans unlock advanced analytics including follower growth, best time to post, top posts, and CSV export. Pro Plus also includes white-label PDF reports.",
      },
    ],
  },
  {
    category: "Platforms",
    items: [
      {
        question: "Does PostSyncer support Instagram Stories?",
        answer:
          "Instagram Stories scheduling is supported via a push notification. When it is time to post, PostSyncer sends a notification to your phone and the story is pre-loaded in the Instagram app for you to publish with one tap.",
      },
      {
        question: "Can I post to Facebook Groups?",
        answer:
          "Yes — connect a Facebook account and you can post to Pages and Groups that you administer.",
      },
      {
        question: "How do I connect Telegram?",
        answer:
          "Add the PostSyncer bot (@PostSyncerBot) as an administrator to your channel or group, then complete the connection in Settings → Connected Accounts.",
      },
      {
        question: "Can I connect a Mastodon account from any instance?",
        answer:
          "Yes — PostSyncer supports any Mastodon instance that uses the standard ActivityPub API. Enter your handle (e.g. user@mastodon.social) and authorize via OAuth.",
      },
      {
        question: "Does PostSyncer support LinkedIn Company Pages?",
        answer:
          "Yes — you can connect both personal LinkedIn profiles and Company Pages. You must be an admin of the Company Page.",
      },
    ],
  },
  {
    category: "Team & Collaboration",
    items: [
      {
        question: "How many team members can I invite?",
        answer:
          "All PostSyncer plans include unlimited team members at no extra cost. Invite as many colleagues, clients, or contractors as you need.",
      },
      {
        question: "What roles are available?",
        answer:
          "PostSyncer has four roles: Owner (full access, billing), Admin (manage accounts and members), Editor (create and schedule posts), and Viewer (read-only access). Role-based permissions apply across all workspaces.",
      },
      {
        question: "How do approval workflows work?",
        answer:
          "On Pro and Pro Plus plans you can enable approval workflows. When an editor submits a post for review, designated approvers receive a notification. The post only publishes once all required approvers have approved it. Pro Plus supports custom multi-step approval chains.",
      },
      {
        question: "What are workspaces?",
        answer:
          "Workspaces let you separate social accounts and team members by brand, client, or project. Starter includes 1 workspace, Pro includes 2, and Pro Plus includes 3.",
      },
    ],
  },
  {
    category: "API",
    items: [
      {
        question: "Does PostSyncer have an API?",
        answer:
          "Yes — PostSyncer offers a REST API for scheduling posts, managing accounts, and pulling analytics programmatically. Daily post limits are 100 (Starter), 250 (Pro), and 500 (Pro Plus).",
      },
      {
        question: "What is MCP access?",
        answer:
          "MCP (Model Context Protocol) is an open standard for connecting AI agents to services. Pro and Pro Plus plans include access to PostSyncer's MCP server, which lets you control PostSyncer from AI assistants and automation tools that support MCP.",
      },
      {
        question: "Where can I find API documentation?",
        answer:
          "The full API reference is available at postsyncer.com/docs/api. It includes endpoint references, authentication guides, code examples in cURL, Node.js, and Python, and a downloadable Postman collection.",
      },
      {
        question: "Are there webhooks?",
        answer:
          "Yes — PostSyncer supports webhooks for post-published, post-failed, and approval-requested events. Configure webhook endpoints in Settings → API & Integrations.",
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function FaqsPage() {
  return (
    <>
      {/* Hero */}
      <section className="border-b border-border bg-muted/30 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <Badge variant="secondary" className="mb-4 rounded-full px-4 py-1 text-sm">
            FAQ
          </Badge>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            Frequently asked questions
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Everything you need to know about PostSyncer. Can't find the answer
            you're looking for?{" "}
            <Link
              href="/contact"
              className="font-medium text-primary underline underline-offset-4 hover:no-underline"
            >
              Chat with us
            </Link>
            .
          </p>
        </div>
      </section>

      {/* FAQ accordion */}
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <FaqAccordion items={FAQ_CATEGORIES} categorised />
        </div>
      </section>

      {/* Still have questions CTA */}
      <section className="border-t border-border bg-muted/30 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <MessageSquare className="h-6 w-6 text-primary" />
            </div>
          </div>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Still have questions?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-muted-foreground">
            Our support team is available via live chat (Pro & Pro Plus) and
            email for all plans. We typically respond in under 4 hours.
          </p>
          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button size="lg" className="w-full sm:w-auto" asChild>
              <Link href="/contact">
                Contact support
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="w-full sm:w-auto" asChild>
              <Link href="/register">Start free trial</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
