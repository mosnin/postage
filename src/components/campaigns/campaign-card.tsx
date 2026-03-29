"use client";

import Link from "next/link";
import { format } from "date-fns";
import { CalendarDays, Target, BarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CampaignStatus = "active" | "upcoming" | "completed";

export interface CampaignCardData {
  id: string;
  name: string;
  description: string | null;
  goal: string | null;
  startDate: Date | string | null;
  endDate: Date | string | null;
  dynamicStatus: CampaignStatus;
  publishedCount: number;
  _count: { posts: number };
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  CampaignStatus,
  { label: string; className: string }
> = {
  active: {
    label: "Active",
    className: "bg-green-50 text-green-700 border-green-200",
  },
  upcoming: {
    label: "Upcoming",
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
  completed: {
    label: "Completed",
    className: "bg-gray-100 text-gray-600 border-gray-200",
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

interface CampaignCardProps {
  campaign: CampaignCardData;
}

export function CampaignCard({ campaign }: CampaignCardProps) {
  const status = STATUS_CONFIG[campaign.dynamicStatus];
  const totalPosts = campaign._count.posts;
  const publishedCount = campaign.publishedCount;
  const progress = totalPosts > 0 ? (publishedCount / totalPosts) * 100 : 0;

  const dateRange = formatDateRange(campaign.startDate, campaign.endDate);

  return (
    <Link
      href={`/campaigns/${campaign.id}`}
      className="group block rounded-xl border bg-background p-5 hover:shadow-md hover:border-primary/30 transition-all"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className="font-semibold text-base leading-snug group-hover:text-primary transition-colors line-clamp-2">
          {campaign.name}
        </h3>
        <span
          className={cn(
            "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-medium",
            status.className
          )}
        >
          {status.label}
        </span>
      </div>

      {/* Date range */}
      {dateRange && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
          <CalendarDays className="h-3.5 w-3.5 shrink-0" />
          <span>{dateRange}</span>
        </div>
      )}

      {/* Goal */}
      {campaign.goal && (
        <div className="flex items-start gap-1.5 text-xs text-muted-foreground mb-3">
          <Target className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span className="line-clamp-2">{campaign.goal}</span>
        </div>
      )}

      {/* Description */}
      {campaign.description && !campaign.goal && (
        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
          {campaign.description}
        </p>
      )}

      {/* Stats */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
          <BarChart2 className="h-3 w-3" />
          {totalPosts} {totalPosts === 1 ? "post" : "posts"}
        </div>
        {totalPosts > 0 && (
          <span className="text-xs text-muted-foreground">
            {publishedCount} published
          </span>
        )}
      </div>

      {/* Progress bar */}
      {totalPosts > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>Progress</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                campaign.dynamicStatus === "completed"
                  ? "bg-gray-400"
                  : "bg-primary"
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </Link>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateRange(
  start: Date | string | null,
  end: Date | string | null
): string | null {
  if (!start && !end) return null;
  const fmt = (d: Date | string) => format(new Date(d), "MMM d");
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  if (start) return `From ${fmt(start)}`;
  if (end) return `Until ${fmt(end)}`;
  return null;
}
