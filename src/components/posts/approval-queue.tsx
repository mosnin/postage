"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  Clock,
  InboxIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { ApprovalStatusBadge } from "@/components/posts/approval-status-badge";
import { ApprovalReviewPanel, type PendingPost } from "@/components/posts/approval-review-panel";
import { cn, PLATFORM_COLORS, PLATFORM_LABELS, truncate } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApprovalQueueProps {
  workspaceId: string;
  /** Filter applied from the parent page */
  filter: "ALL" | "PENDING" | "APPROVED" | "REJECTED" | "CHANGES_REQUESTED";
}

// ─── Platform dot ─────────────────────────────────────────────────────────────

function PlatformDot({ platform }: { platform: string }) {
  const color = PLATFORM_COLORS[platform] ?? "#888";
  const label = PLATFORM_LABELS[platform] ?? platform;
  return (
    <span
      title={label}
      className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white shrink-0"
      style={{ backgroundColor: color }}
    >
      {platform[0]}
    </span>
  );
}

// ─── Quick action buttons ─────────────────────────────────────────────────────

function QuickActions({
  postId,
  onViewFull,
}: {
  postId: string;
  onViewFull: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const approveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/posts/${postId}/approve`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to approve");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-posts"] });
      toast({ title: "Post approved", description: "The post has been approved and scheduled." });
    },
    onError: (err: Error) => {
      toast({ title: "Could not approve", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <Button
        size="sm"
        variant="outline"
        className="h-8 gap-1.5 border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800 hover:border-green-300"
        onClick={(e) => {
          e.stopPropagation();
          approveMutation.mutate();
        }}
        disabled={approveMutation.isPending}
        title="Approve immediately"
      >
        <CheckCircle className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Approve</span>
      </Button>

      <Button
        size="sm"
        variant="outline"
        className="h-8 gap-1.5 border-orange-200 text-orange-700 hover:bg-orange-50 hover:text-orange-800 hover:border-orange-300"
        onClick={(e) => {
          e.stopPropagation();
          onViewFull();
        }}
        title="Request changes (opens review panel)"
      >
        <AlertCircle className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Changes</span>
      </Button>

      <Button
        size="sm"
        variant="outline"
        className="h-8 gap-1.5 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 hover:border-red-300"
        onClick={(e) => {
          e.stopPropagation();
          onViewFull();
        }}
        title="Reject (opens review panel)"
      >
        <XCircle className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Reject</span>
      </Button>

      <Button
        size="sm"
        variant="ghost"
        className="h-8 gap-1.5 text-muted-foreground hover:text-foreground"
        onClick={(e) => {
          e.stopPropagation();
          onViewFull();
        }}
        title="View full post"
      >
        <Eye className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">View</span>
      </Button>
    </div>
  );
}

// ─── Single post card ─────────────────────────────────────────────────────────

function PostCard({
  post,
  onViewFull,
}: {
  post: PendingPost;
  onViewFull: (post: PendingPost) => void;
}) {
  const platforms = Array.from(
    new Set(post.accounts.map((a) => a.socialAccount.platform))
  );
  const authorName =
    post.author?.name ?? post.author?.email ?? "Unknown author";
  const authorInitial = authorName.charAt(0).toUpperCase();

  return (
    <div
      className="rounded-lg border bg-card hover:shadow-sm transition-shadow cursor-pointer"
      onClick={() => onViewFull(post)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onViewFull(post)}
    >
      <div className="p-4 space-y-3">
        {/* Top row: submitter + time + platforms */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarImage
                src={post.author?.image ?? undefined}
                alt={authorName}
              />
              <AvatarFallback className="text-xs font-semibold">
                {authorInitial}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                Submitted by {authorName}
              </p>
              {post.submittedForApprovalAt && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3 shrink-0" />
                  {formatDistanceToNow(new Date(post.submittedForApprovalAt), {
                    addSuffix: true,
                  })}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {platforms.map((p) => (
              <PlatformDot key={p} platform={p} />
            ))}
          </div>
        </div>

        {/* Content preview */}
        <p className="text-sm text-foreground leading-relaxed">
          {truncate(post.content, 200)}
        </p>

        {/* Media thumbnails */}
        {post.media.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            {post.media.slice(0, 4).map((m) => {
              const thumb = m.mediaFile.thumbnailUrl ?? m.mediaFile.url;
              return (
                <div
                  key={m.mediaFile.id}
                  className="h-12 w-12 rounded-md overflow-hidden border bg-muted shrink-0"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={thumb}
                    alt={m.mediaFile.name}
                    className="h-full w-full object-cover"
                  />
                </div>
              );
            })}
            {post.media.length > 4 && (
              <div className="h-12 w-12 rounded-md border bg-muted flex items-center justify-center shrink-0">
                <span className="text-xs text-muted-foreground font-medium">
                  +{post.media.length - 4}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Labels + campaign */}
        {(post.labels.length > 0 || post.campaignPost.length > 0) && (
          <div className="flex flex-wrap gap-1.5 items-center">
            {post.labels.map((pl) => (
              <span
                key={pl.label.id}
                className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                style={{ backgroundColor: pl.label.color }}
              >
                {pl.label.name}
              </span>
            ))}
            {post.campaignPost.length > 0 && (
              <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {post.campaignPost[0].campaign.name}
              </span>
            )}
          </div>
        )}

        {/* Bottom row: status badge + action buttons */}
        <div
          className="flex items-center justify-between gap-2 pt-1"
          onClick={(e) => e.stopPropagation()}
        >
          <ApprovalStatusBadge status={post.approvalStatus} />

          {post.approvalStatus === "PENDING" && (
            <QuickActions
              postId={post.id}
              onViewFull={() => onViewFull(post)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function PostCardSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2.5">
        <Skeleton className="h-8 w-8 rounded-full shrink-0" />
        <div className="space-y-1.5 flex-1">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      <div className="flex items-center justify-between pt-1">
        <Skeleton className="h-5 w-24 rounded-full" />
        <div className="flex gap-1.5">
          <Skeleton className="h-8 w-20 rounded-md" />
          <Skeleton className="h-8 w-20 rounded-md" />
          <Skeleton className="h-8 w-16 rounded-md" />
        </div>
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ filter }: { filter: string }) {
  const messages: Record<string, { title: string; description: string }> = {
    ALL: {
      title: "No posts yet",
      description:
        "Posts submitted for approval by your team will appear here for your review.",
    },
    PENDING: {
      title: "No posts pending review",
      description:
        "When team members submit posts for approval, they will show up here. You can approve, reject, or request changes.",
    },
    APPROVED: {
      title: "No approved posts",
      description:
        "Posts you have approved will be shown here.",
    },
    REJECTED: {
      title: "No rejected posts",
      description:
        "Posts you have rejected will appear here.",
    },
    CHANGES_REQUESTED: {
      title: "No posts with change requests",
      description:
        "Posts where you have requested changes will appear here.",
    },
  };

  const msg = messages[filter] ?? messages.ALL;

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-4">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
        <InboxIcon className="h-7 w-7 text-muted-foreground" />
      </div>
      <h3 className="text-base font-semibold text-foreground">{msg.title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
        {msg.description}
      </p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ApprovalQueue({ workspaceId, filter }: ApprovalQueueProps) {
  const [reviewPost, setReviewPost] = useState<PendingPost | null>(null);
  const [reviewPanelOpen, setReviewPanelOpen] = useState(false);

  // Fetch all pending posts; for non-PENDING filters we need a different endpoint
  const { data, isLoading, error } = useQuery<{
    data: PendingPost[];
    meta: { total: number; page: number; pageSize: number; hasNext: boolean };
  }>({
    queryKey: ["pending-posts", workspaceId],
    queryFn: async () => {
      const res = await fetch(
        `/api/posts/pending?workspaceId=${workspaceId}&pageSize=50`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to load approval queue");
      }
      return res.json();
    },
    staleTime: 30_000,
  });

  const allPosts = data?.data ?? [];

  // Client-side filter for non-PENDING statuses (uses cached data from main list)
  const filteredPosts =
    filter === "ALL"
      ? allPosts
      : allPosts.filter((p) => {
          if (filter === "PENDING") return p.approvalStatus === "PENDING";
          if (filter === "APPROVED") return p.approvalStatus === "APPROVED";
          if (filter === "REJECTED") return p.approvalStatus === "REJECTED";
          if (filter === "CHANGES_REQUESTED")
            return p.approvalStatus === "CHANGES_REQUESTED";
          return true;
        });

  function openReview(post: PendingPost) {
    setReviewPost(post);
    setReviewPanelOpen(true);
  }

  function closeReview() {
    setReviewPanelOpen(false);
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <PostCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-center">
        <p className="text-sm font-medium text-destructive">
          Failed to load approval queue
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {(error as Error).message}
        </p>
      </div>
    );
  }

  if (filteredPosts.length === 0) {
    return (
      <>
        <EmptyState filter={filter} />
        <ApprovalReviewPanel
          post={reviewPost}
          open={reviewPanelOpen}
          onClose={closeReview}
        />
      </>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {filteredPosts.map((post) => (
          <PostCard key={post.id} post={post} onViewFull={openReview} />
        ))}
      </div>

      <ApprovalReviewPanel
        post={reviewPost}
        open={reviewPanelOpen}
        onClose={closeReview}
      />
    </>
  );
}
