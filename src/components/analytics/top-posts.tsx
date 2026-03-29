"use client";

import * as React from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown, FileText, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { PLATFORM_LABELS, PLATFORM_COLORS } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface TopPost {
  id: string;
  content: string;
  publishedAt: Date | string | null;
  platforms: string[];
  impressions: number;
  engagements: number;
  likes: number;
  comments: number;
  shares: number | null;
}

interface TopPostsProps {
  posts: TopPost[];
  onPostClick?: (postId: string) => void;
  isPro: boolean;
}

type SortKey = "impressions" | "engagements" | "likes" | "comments" | "publishedAt";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 10;

function formatLargeNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

interface SortIconProps {
  column: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
}

function SortIcon({ column, sortKey, sortDir }: SortIconProps) {
  if (column !== sortKey) return <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />;
  return sortDir === "asc" ? (
    <ChevronUp className="h-3.5 w-3.5 text-foreground" />
  ) : (
    <ChevronDown className="h-3.5 w-3.5 text-foreground" />
  );
}

export function TopPosts({ posts, onPostClick, isPro }: TopPostsProps) {
  const [sortKey, setSortKey] = React.useState<SortKey>("impressions");
  const [sortDir, setSortDir] = React.useState<SortDir>("desc");
  const [page, setPage] = React.useState(0);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
    setPage(0);
  }

  const sorted = React.useMemo(() => {
    return [...posts].sort((a, b) => {
      let av: number;
      let bv: number;

      if (sortKey === "publishedAt") {
        av = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
        bv = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      } else {
        av = a[sortKey] ?? 0;
        bv = b[sortKey] ?? 0;
      }

      return sortDir === "asc" ? av - bv : bv - av;
    });
  }, [posts, sortKey, sortDir]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paginated = sorted.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  if (posts.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-10 flex flex-col items-center text-center">
        <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-4">
          <FileText className="h-7 w-7 text-muted-foreground" />
        </div>
        <h3 className="font-semibold text-lg mb-2">No Posts in This Period</h3>
        <p className="text-sm text-muted-foreground max-w-sm mb-5">
          Posts published during the selected date range will appear here with their performance metrics.
        </p>
        <Button variant="outline" asChild>
          <a href="/compose">Create a Post</a>
        </Button>
      </div>
    );
  }

  const thClass = "px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider";
  const sortableThClass = cn(thClass, "cursor-pointer hover:text-foreground select-none");

  function ThSortable({ col, label }: { col: SortKey; label: string }) {
    return (
      <th
        className={sortableThClass}
        onClick={() => handleSort(col)}
      >
        <div className="flex items-center gap-1">
          {label}
          <SortIcon column={col} sortKey={sortKey} sortDir={sortDir} />
        </div>
      </th>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground">Top Posts</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            {posts.length} {posts.length === 1 ? "post" : "posts"} in this period
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b border-border">
            <tr>
              <th className={cn(thClass, "text-left")}>Platform</th>
              <th className={cn(thClass, "text-left min-w-[200px]")}>Content</th>
              <ThSortable col="impressions" label="Impressions" />
              <ThSortable col="engagements" label="Engagements" />
              <ThSortable col="likes" label="Likes" />
              <ThSortable col="comments" label="Comments" />
              <ThSortable col="publishedAt" label="Published" />
              <th className={thClass} />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {paginated.map((post) => (
              <tr
                key={post.id}
                onClick={() => onPostClick?.(post.id)}
                className={cn(
                  "transition-colors",
                  onPostClick && "cursor-pointer hover:bg-muted/30"
                )}
              >
                {/* Platform badges */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 flex-wrap">
                    {post.platforms.slice(0, 3).map((p) => (
                      <span
                        key={p}
                        className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium text-white"
                        style={{ backgroundColor: PLATFORM_COLORS[p] ?? "#6366f1" }}
                        title={PLATFORM_LABELS[p] ?? p}
                      >
                        {(PLATFORM_LABELS[p] ?? p).slice(0, 2).toUpperCase()}
                      </span>
                    ))}
                    {post.platforms.length > 3 && (
                      <span className="text-xs text-muted-foreground">
                        +{post.platforms.length - 3}
                      </span>
                    )}
                  </div>
                </td>

                {/* Content preview */}
                <td className="px-4 py-3 max-w-[240px]">
                  <p className="text-sm text-foreground truncate">{post.content}</p>
                </td>

                {/* Metrics */}
                <td className="px-4 py-3 tabular-nums text-right font-medium">
                  {formatLargeNumber(post.impressions)}
                </td>
                <td className="px-4 py-3 tabular-nums text-right">
                  {formatLargeNumber(post.engagements)}
                </td>
                <td className="px-4 py-3 tabular-nums text-right">
                  {formatLargeNumber(post.likes)}
                </td>
                <td className="px-4 py-3 tabular-nums text-right">
                  {formatLargeNumber(post.comments)}
                </td>

                {/* Date */}
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                  {post.publishedAt
                    ? format(new Date(post.publishedAt), "MMM d, yyyy")
                    : "—"}
                </td>

                {/* View button */}
                <td className="px-4 py-3">
                  {onPostClick && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onPostClick(post.id);
                      }}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-5 py-3 border-t border-border flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {page * PAGE_SIZE + 1}–
            {Math.min((page + 1) * PAGE_SIZE, sorted.length)} of {sorted.length}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground tabular-nums">
              {page + 1} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
