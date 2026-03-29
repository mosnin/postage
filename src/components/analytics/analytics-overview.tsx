"use client";

import * as React from "react";
import { TrendingUp, TrendingDown, Minus, Eye, Heart, UserPlus, FileText, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { MetricsChart } from "./metrics-chart";
import { Button } from "@/components/ui/button";

interface AnalyticsSummary {
  impressions: number;
  impressionsChange: number | null;
  engagements: number;
  engagementsChange: number | null;
  followerChange: number;
  followerChangeChange: number | null;
  postsPublished: number;
  isPro: boolean;
}

interface SeriesPoint {
  date: string;
  impressions: number;
  engagements: number;
  likes: number;
  comments: number;
  shares: number | null;
  reach: number | null;
  followerChange: number;
}

interface AnalyticsOverviewProps {
  summary: AnalyticsSummary;
  series: SeriesPoint[];
  workspaceId: string;
}

type ActiveMetric = "impressions" | "engagements" | "followers" | "posts";

const METRIC_OPTIONS: { key: ActiveMetric; label: string; proOnly?: boolean }[] = [
  { key: "impressions", label: "Impressions" },
  { key: "engagements", label: "Engagements" },
  { key: "followers", label: "Followers" },
  { key: "posts", label: "Posts" },
];

function formatLargeNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: number;
  change: number | null;
  iconColor: string;
  iconBg: string;
}

function StatCard({ icon: Icon, label, value, change, iconColor, iconBg }: StatCardProps) {
  const isPositive = change !== null && change > 0;
  const isNegative = change !== null && change < 0;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between mb-4">
        <div className={cn("rounded-lg p-2", iconBg)}>
          <Icon className={cn("h-5 w-5", iconColor)} />
        </div>
        {change !== null && (
          <div
            className={cn(
              "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full",
              isPositive && "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
              isNegative && "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400",
              !isPositive && !isNegative && "bg-muted text-muted-foreground"
            )}
          >
            {isPositive ? (
              <TrendingUp className="h-3 w-3" />
            ) : isNegative ? (
              <TrendingDown className="h-3 w-3" />
            ) : (
              <Minus className="h-3 w-3" />
            )}
            {change !== 0 ? `${Math.abs(change)}%` : "—"}
          </div>
        )}
      </div>
      <p className="text-2xl font-bold tracking-tight text-foreground">
        {formatLargeNumber(value)}
      </p>
      <p className="text-sm text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

export function AnalyticsOverview({ summary, series }: AnalyticsOverviewProps) {
  const [activeMetric, setActiveMetric] = React.useState<ActiveMetric>("impressions");

  const cards: StatCardProps[] = [
    {
      icon: Eye,
      label: "Total Impressions",
      value: summary.impressions,
      change: summary.impressionsChange,
      iconColor: "text-blue-600 dark:text-blue-400",
      iconBg: "bg-blue-50 dark:bg-blue-950",
    },
    {
      icon: Heart,
      label: "Total Engagements",
      value: summary.engagements,
      change: summary.engagementsChange,
      iconColor: "text-rose-600 dark:text-rose-400",
      iconBg: "bg-rose-50 dark:bg-rose-950",
    },
    {
      icon: UserPlus,
      label: "New Followers",
      value: summary.followerChange,
      change: summary.followerChangeChange,
      iconColor: "text-violet-600 dark:text-violet-400",
      iconBg: "bg-violet-50 dark:bg-violet-950",
    },
    {
      icon: FileText,
      label: "Posts Published",
      value: summary.postsPublished,
      change: null,
      iconColor: "text-amber-600 dark:text-amber-400",
      iconBg: "bg-amber-50 dark:bg-amber-950",
    },
  ];

  const chartMetrics = React.useMemo(() => {
    switch (activeMetric) {
      case "impressions":
        return [
          { key: "impressions", label: "Impressions", color: "#3b82f6", yAxisId: "left" as const },
          { key: "reach", label: "Reach", color: "#8b5cf6", yAxisId: "right" as const },
        ];
      case "engagements":
        return [
          { key: "engagements", label: "Engagements", color: "#f43f5e", yAxisId: "left" as const },
          { key: "likes", label: "Likes", color: "#fb923c", yAxisId: "right" as const },
        ];
      case "followers":
        return [
          { key: "followerChange", label: "Follower Change", color: "#8b5cf6", yAxisId: "left" as const },
        ];
      case "posts":
        return [
          { key: "impressions", label: "Impressions", color: "#3b82f6", yAxisId: "left" as const },
          { key: "engagements", label: "Engagements", color: "#f43f5e", yAxisId: "right" as const },
        ];
    }
  }, [activeMetric]);

  // Filter chart metrics for non-pro: hide reach/shares
  const visibleChartMetrics = summary.isPro
    ? chartMetrics
    : chartMetrics.filter((m) => !["reach", "shares"].includes(m.key));

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </div>

      {/* Trend chart */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <h3 className="font-semibold text-foreground">Trend Over Time</h3>
            <p className="text-sm text-muted-foreground">Performance across the selected period</p>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-input bg-background p-0.5">
            {METRIC_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setActiveMetric(opt.key)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors",
                  activeMetric === opt.key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                )}
              >
                {opt.label}
                {opt.proOnly && !summary.isPro && (
                  <Lock className="h-3 w-3 opacity-60" />
                )}
              </button>
            ))}
          </div>
        </div>

        {series.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[280px] text-center">
            <Eye className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="font-medium text-muted-foreground">No data for this period</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Publish posts and connect accounts to see trends
            </p>
          </div>
        ) : (
          <MetricsChart
            data={series}
            metrics={visibleChartMetrics}
            type="line"
            height={280}
          />
        )}

        {!summary.isPro && (
          <div className="mt-4 flex items-center gap-3 rounded-lg bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800 px-4 py-3">
            <Lock className="h-4 w-4 text-violet-600 dark:text-violet-400 shrink-0" />
            <p className="text-sm text-violet-700 dark:text-violet-300 flex-1">
              Reach, saves, and click-through metrics are available on Pro plans.
            </p>
            <Button size="sm" variant="outline" className="border-violet-300 text-violet-700 dark:border-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900">
              Upgrade
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
