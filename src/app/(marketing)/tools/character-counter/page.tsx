import { CharacterCounterTool } from "@/components/tools/character-counter-tool";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Type, ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Free Character Counter — PostSyncer",
  description:
    "Live character counter for Twitter, Instagram, LinkedIn, Threads, Bluesky, Telegram, and more. See at a glance which platforms fit your post.",
};

export default function CharacterCounterPage() {
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
              <Type className="h-6 w-6 text-primary" />
            </div>
            <div>
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  Character Counter
                </h1>
                <Badge variant="secondary">Free</Badge>
              </div>
              <p className="text-muted-foreground">
                Paste your post and instantly see how it measures up against every major
                platform&apos;s character limit — all at once.
              </p>
            </div>
          </div>

          {/* Platform limits summary */}
          <div className="mt-6 rounded-lg border bg-background/70 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Platform Character Limits
            </p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-3">
              {[
                { platform: "Twitter / X", limit: "280" },
                { platform: "Bluesky", limit: "300" },
                { platform: "Threads", limit: "500" },
                { platform: "Mastodon", limit: "500" },
                { platform: "Instagram", limit: "2,200" },
                { platform: "LinkedIn", limit: "3,000" },
                { platform: "Telegram", limit: "4,096" },
              ].map(({ platform, limit }) => (
                <div key={platform} className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">{platform}</span>
                  <span className="font-mono font-semibold text-foreground">{limit}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Tool */}
      <section className="px-4 py-10 sm:px-6 lg:px-8">
        <CharacterCounterTool />
      </section>
    </>
  );
}
