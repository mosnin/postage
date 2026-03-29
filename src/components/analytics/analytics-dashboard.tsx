"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import { format, subDays } from "date-fns";
import { Download, Zap, BarChart2, Loader2, AlertCircle, WifiOff } from "lucide-react";
type Plan = "FREE" | "STARTER" | "PRO" | "PRO_PLUS";
import { Button } from "@/components/ui/button";
import { AnalyticsDatePicker } from "./analytics-date-picker";
import { AnalyticsOverview } from "./analytics-overview";
import { PlatformBreakdown } from "./platform-breakdown";
import { TopPosts } from "./top-posts";
import { cn } from "@/lib/utils";

interface ConnectedAccount {
  id: string;
  platform: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

interface AnalyticsDashboardProps {
  workspaceId: string;
  workspaceName: string;
  plan: Plan;
  connectedAccounts: ConnectedAccount[];
}

interface AnalyticsResponse {
  summary: {
    impressions: number;
    impressionsChange: number | null;
    engagements: number;
    engagementsChange: number | null;
    likes: number;
    comments: number;
    shares: number | null;
    clicks: number | null;
    reach: number | null;
    saves: number | null;
    followerChange: number;
    followerChangeChange: number | null;
    postsPublished: number;
    postsPublishedChange: number | null;
    plan: Plan;
    isPro: boolean;
    starterMetrics: string[];
  };
  series: Array<{
    date: string;
    impressions: number;
    engagements: number;
    likes: number;
    comments: number;
    shares: number | null;
    reach: number | null;
    followerChange: number;
  }>;
  byPlatform: Array<{
    platform: string;
    accountId: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    metrics: {
      impressions: number;
      engagements: number;
      likes: number;
      comments: number;
      shares: number | null;
      clicks: number | null;
      reach: number | null;
      saves: number | null;
      followerChange: number;
    };
    series: Array<{
      date: string;
      impressions: number;
      engagements: number;
      likes: number;
      comments: number;
      shares: number | null;
      reach: number | null;
      followerChange: number;
    }>;
  }>;
  topPosts: Array<{
    id: string;
    content: string;
    publishedAt: string | null;
    platforms: string[];
    impressions: number;
    engagements: number;
    likes: number;
    comments: number;
    shares: number | null;
  }>;
  dateRange: {
    start: string;
    end: string;
  };
}

const isStarterPlan = (plan: Plan) => plan === "FREE" || plan === "STARTER";

function downloadCSV(data: AnalyticsResponse, filename: string) {
  const rows: string[][] = [
    ["Date", "Impressions", "Engagements", "Likes", "Comments", "Follower Change"],
    ...data.series.map((s) => [
      s.date,
      String(s.impressions),
      String(s.engagements),
      String(s.likes),
      String(s.comments),
      String(s.followerChange),
    ]),
  ];

  const csv = rows.map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function AnalyticsDashboard({
  workspaceId,
  plan,
  connectedAccounts,
}: AnalyticsDashboardProps) {
  const [start] = useQueryState("start");
  const [end] = useQueryState("end");
  const [platform] = useQueryState("platform");

  // Default to last 30 days if no params
  const resolvedStart =
    start ?? format(subDays(new Date(), 29), "yyyy-MM-dd");
  const resolvedEnd = end ?? format(new Date(), "yyyy-MM-dd");

  const { data, isLoading, isError, error } = useQuery<AnalyticsResponse>({
    queryKey: ["analytics", workspaceId, resolvedStart, resolvedEnd, platform],
    queryFn: async () => {
      const params = new URLSearchParams({
        workspaceId,
        start: resolvedStart,
        end: resolvedEnd,
      });
      if (platform) params.set("platform", platform);

      const res = await fetch(`/api/analytics?${params.toString()}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to load analytics");
      }
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const showStarterBanner = isStarterPlan(plan);

  function handleExportCSV() {
    if (!data) return;
    const filename = `analytics-${resolvedStart}-${resolvedEnd}.csv`;
    downloadCSV(data, filename);
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Page header */}
      <div className="sticky top-0 z-20 flex items-center justify-between px-6 py-3.5 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-8 w-8 rounded-lg bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center shrink-0">
            <BarChart2 className="h-4.5 w-4.5 text-violet-600 dark:text-violet-400" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight truncate">Analytics</h1>
            <p className="text-xs text-muted-foreground hidden sm:block">
              Cross-platform performance metrics
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <AnalyticsDatePicker />
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            disabled={!data || isLoading}
            className="gap-1.5 hidden sm:flex"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
          {/* Starter upgrade banner */}
          {showStarterBanner && (
            <div className="flex items-center gap-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-4 py-3">
              <Zap className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                  Upgrade for Advanced Analytics
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                  Unlock reach, saves, shares, and click-through rate metrics with a Pro plan.
                </p>
              </div>
              <Button
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 text-white border-0 shrink-0"
                asChild
              >
                <a href="/settings/billing">Upgrade to Pro</a>
              </Button>
            </div>
          )}

          {/* No connected accounts */}
          {connectedAccounts.length === 0 && (
            <div className="rounded-xl border border-border bg-card p-10 flex flex-col items-center text-center">
              <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-4">
                <WifiOff className="h-7 w-7 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg mb-2">No Connected Accounts</h3>
              <p className="text-sm text-muted-foreground max-w-sm mb-5">
                Connect a social account to start collecting analytics and see how your
                content performs across platforms.
              </p>
              <Button asChild>
                <a href="/settings/accounts">Connect a Social Account</a>
              </Button>
            </div>
          )}

          {/* Loading skeleton */}
          {isLoading && connectedAccounts.length > 0 && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading analytics...</p>
            </div>
          )}

          {/* Error state */}
          {isError && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-destructive">Failed to load analytics</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {error instanceof Error ? error.message : "An unexpected error occurred."}
                </p>
              </div>
            </div>
          )}

          {/* Main content */}
          {data && !isLoading && (
            <>
              <AnalyticsOverview
                summary={data.summary}
                series={data.series}
                workspaceId={workspaceId}
              />

              <div>
                <h2 className="text-base font-semibold mb-3 text-foreground">
                  Platform Breakdown
                </h2>
                <PlatformBreakdown
                  byPlatform={data.byPlatform}
                  isPro={data.summary.isPro}
                  onConnectAccount={() => {
                    window.location.href = "/settings/accounts";
                  }}
                />
              </div>

              <div>
                <h2 className="text-base font-semibold mb-3 text-foreground">
                  Top Performing Posts
                </h2>
                <TopPosts
                  posts={data.topPosts}
                  isPro={data.summary.isPro}
                  onPostClick={(id) => {
                    window.location.href = `/posts/${id}`;
                  }}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
