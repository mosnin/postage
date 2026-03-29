import { HashtagGeneratorTool } from "@/components/tools/hashtag-generator-tool";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Hash, ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Free Hashtag Generator — PostSyncer",
  description:
    "Generate 10–30 targeted hashtags for Instagram, Twitter, TikTok, LinkedIn, and YouTube. Grouped by popular, niche, and trending. Free, no account required.",
};

export default function HashtagGeneratorPage() {
  return (
    <>
      {/* Header */}
      <section className="bg-muted/30 border-b px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="mb-4">
            <Button
              variant="ghost"
              size="sm"
              className="-ml-2 text-muted-foreground"
              asChild
            >
              <Link href="/tools">
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                All free tools
              </Link>
            </Button>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Hash className="h-6 w-6 text-primary" />
            </div>
            <div>
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  Free Hashtag Generator
                </h1>
                <Badge variant="secondary">Free</Badge>
              </div>
              <p className="text-muted-foreground">
                Generate 10–30 relevant hashtags for any topic, grouped into popular,
                niche, and trending categories. Works for Instagram, Twitter, TikTok,
                LinkedIn, and YouTube.
              </p>
            </div>
          </div>

          {/* Tips */}
          <div className="mt-6 rounded-lg border bg-background/70 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Hashtag Tips
            </p>
            <ul className="grid gap-1 sm:grid-cols-2">
              {[
                "Instagram: mix popular + niche for best reach",
                "Twitter: max 1–2 hashtags per tweet",
                "TikTok: use 3–5 niche + trending tags",
                "LinkedIn: 3–5 professional hashtags work best",
                "YouTube: use keywords as tags, not hashtags",
                "Avoid banned or overused hashtags",
              ].map((tip) => (
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
        <HashtagGeneratorTool />
      </section>
    </>
  );
}
