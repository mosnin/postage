"use client";

import * as React from "react";
import { Lock, Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { PLATFORM_LABELS, PLATFORM_COLORS } from "@/lib/utils";
import { MetricsChart } from "./metrics-chart";
import { Button } from "@/components/ui/button";

interface PlatformMetrics {
  impressions: number;
  engagements: number;
  likes: number;
  comments: number;
  shares: number | null;
  clicks: number | null;
  reach: number | null;
  saves: number | null;
  followerChange: number;
}

interface PlatformSeriesPoint {
  date: string;
  impressions: number;
  engagements: number;
  likes: number;
  comments: number;
  shares: number | null;
  reach: number | null;
  followerChange: number;
}

interface PlatformData {
  platform: string;
  accountId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  metrics: PlatformMetrics;
  series: PlatformSeriesPoint[];
}

interface PlatformBreakdownProps {
  byPlatform: PlatformData[];
  isPro: boolean;
  onConnectAccount?: () => void;
}

function formatLargeNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

interface MetricRowProps {
  label: string;
  value: number | null;
  locked?: boolean;
}

function MetricRow({ label, value, locked }: MetricRowProps) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      {locked ? (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
          <Lock className="h-3 w-3" />
          <span>Pro only</span>
        </div>
      ) : (
        <span className="text-sm font-medium tabular-nums">
          {value !== null ? formatLargeNumber(value) : "—"}
        </span>
      )}
    </div>
  );
}

interface PlatformPanelProps {
  platform: PlatformData;
  isPro: boolean;
}

function PlatformPanel({ platform, isPro }: PlatformPanelProps) {
  const color = PLATFORM_COLORS[platform.platform] ?? "#6366f1";
  const hasData = platform.metrics.impressions > 0 || platform.metrics.engagements > 0;

  const barMetrics = [
    { key: "impressions", label: "Impressions", color: "#3b82f6", yAxisId: "left" as const },
    { key: "engagements", label: "Engagements", color: "#f43f5e", yAxisId: "left" as const },
    { key: "likes", label: "Likes", color: "#fb923c", yAxisId: "left" as const },
    { key: "comments", label: "Comments", color: "#22c55e", yAxisId: "left" as const },
  ];

  return (
    <div className="space-y-5">
      {/* Account header */}
      <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/40 border border-border">
        <div
          className="h-10 w-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
          style={{ backgroundColor: color }}
        >
          {platform.displayName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{platform.displayName}</p>
          <p className="text-xs text-muted-foreground truncate">@{platform.username}</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2 py-1 rounded-full">
          <Wifi className="h-3 w-3" />
          Connected
        </div>
      </div>

      {!hasData ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div
            className="h-12 w-12 rounded-full flex items-center justify-center mb-3 text-white text-lg font-bold"
            style={{ backgroundColor: color }}
          >
            {platform.displayName.charAt(0).toUpperCase()}
          </div>
          <p className="font-medium text-muted-foreground">No data for this period</p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Data syncs after posts are published and analytics are collected
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Metrics list */}
          <div className="rounded-xl border border-border bg-card p-4">
            <h4 className="text-sm font-semibold mb-1">Metrics</h4>
            <MetricRow label="Impressions" value={platform.metrics.impressions} />
            <MetricRow label="Engagements" value={platform.metrics.engagements} />
            <MetricRow label="Likes" value={platform.metrics.likes} />
            <MetricRow label="Comments" value={platform.metrics.comments} />
            <MetricRow
              label="Shares"
              value={platform.metrics.shares}
              locked={!isPro}
            />
            <MetricRow
              label="Clicks"
              value={platform.metrics.clicks}
              locked={!isPro}
            />
            <MetricRow
              label="Reach"
              value={platform.metrics.reach}
              locked={!isPro}
            />
            <MetricRow
              label="Saves"
              value={platform.metrics.saves}
              locked={!isPro}
            />
            <MetricRow
              label="Follower Change"
              value={platform.metrics.followerChange}
            />
          </div>

          {/* Bar chart */}
          <div className="rounded-xl border border-border bg-card p-4">
            <h4 className="text-sm font-semibold mb-3">Trend</h4>
            <MetricsChart
              data={platform.series}
              metrics={barMetrics}
              type="bar"
              height={220}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function PlatformBreakdown({ byPlatform, isPro, onConnectAccount }: PlatformBreakdownProps) {
  const [activeTab, setActiveTab] = React.useState<string>(
    byPlatform[0]?.platform ?? ""
  );

  if (byPlatform.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-10 flex flex-col items-center text-center">
        <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-4">
          <WifiOff className="h-7 w-7 text-muted-foreground" />
        </div>
        <h3 className="font-semibold text-lg mb-2">No Connected Accounts</h3>
        <p className="text-sm text-muted-foreground max-w-sm mb-5">
          Connect a social account to see platform-specific analytics and performance metrics.
        </p>
        {onConnectAccount && (
          <Button onClick={onConnectAccount}>Connect Account</Button>
        )}
      </div>
    );
  }

  const activePlatform = byPlatform.find((p) => p.platform === activeTab) ?? byPlatform[0];

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center gap-0 border-b border-border overflow-x-auto scrollbar-hide">
        {byPlatform.map((platform) => {
          const color = PLATFORM_COLORS[platform.platform] ?? "#6366f1";
          const label = PLATFORM_LABELS[platform.platform] ?? platform.platform;
          const isActive = activeTab === platform.platform;

          return (
            <button
              key={platform.platform}
              onClick={() => setActiveTab(platform.platform)}
              className={cn(
                "flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
                isActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: color }}
              />
              {label}
            </button>
          );
        })}
      </div>

      {/* Panel */}
      <div className="p-5">
        {activePlatform && (
          <PlatformPanel platform={activePlatform} isPro={isPro} />
        )}

        {!isPro && (
          <div className="mt-5 flex items-center gap-3 rounded-lg bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800 px-4 py-3">
            <Lock className="h-4 w-4 text-violet-600 dark:text-violet-400 shrink-0" />
            <p className="text-sm text-violet-700 dark:text-violet-300 flex-1">
              Unlock reach, saves, shares, and click-through data with a Pro plan.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="border-violet-300 text-violet-700 dark:border-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900 shrink-0"
            >
              Upgrade to Pro
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
