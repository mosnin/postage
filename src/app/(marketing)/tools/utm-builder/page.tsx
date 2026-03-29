import { UtmBuilderTool } from "@/components/tools/utm-builder-tool";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Free UTM Campaign Builder — PostSyncer",
  description:
    "Build UTM tracking URLs for your social media campaigns. Free UTM parameter builder — no account required.",
};

export default function UtmBuilderPage() {
  return (
    <>
      {/* Header */}
      <section className="bg-muted/30 border-b px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl">
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
              <Link2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  UTM Campaign Builder
                </h1>
                <Badge variant="secondary">Free</Badge>
              </div>
              <p className="text-muted-foreground">
                Build trackable UTM URLs for your social media campaigns. Measure where
                your traffic is coming from in Google Analytics or any analytics tool.
              </p>
            </div>
          </div>

          {/* Explainer */}
          <div className="mt-6 rounded-lg border bg-background/70 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              What are UTM parameters?
            </p>
            <p className="text-sm text-muted-foreground">
              UTM parameters are tags added to a URL that let analytics tools track
              which campaign, platform, or ad drove a specific visitor to your site.
              They&apos;re essential for measuring the ROI of social media campaigns.
            </p>
            <div className="mt-3 rounded bg-muted px-3 py-2 font-mono text-xs text-muted-foreground break-all">
              https://yoursite.com?
              <span className="text-primary">utm_source=twitter</span>
              &amp;<span className="text-purple-500">utm_medium=social</span>
              &amp;<span className="text-pink-500">utm_campaign=spring_sale</span>
            </div>
          </div>
        </div>
      </section>

      {/* Tool */}
      <section className="px-4 py-10 sm:px-6 lg:px-8">
        <UtmBuilderTool />
      </section>
    </>
  );
}
