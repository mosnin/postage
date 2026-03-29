"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow, format } from "date-fns";
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  User,
  Calendar,
  MessageSquare,
  X,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import { ApprovalStatusBadge } from "@/components/posts/approval-status-badge";
import { cn, PLATFORM_LABELS, PLATFORM_COLORS, truncate } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface MediaItem {
  mediaFile: {
    id: string;
    url: string;
    thumbnailUrl: string | null;
    mimeType: string;
    name: string;
  };
}

interface SocialAccountItem {
  socialAccount: {
    id: string;
    platform: string;
    displayName: string;
    username: string;
    avatarUrl: string | null;
  };
}

interface LabelItem {
  label: {
    id: string;
    name: string;
    color: string;
  };
}

interface CampaignPost {
  campaign: {
    id: string;
    name: string;
  };
}

interface Author {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

export interface PendingPost {
  id: string;
  content: string;
  status: string;
  approvalStatus: string | null;
  approvalNote: string | null;
  scheduledAt: string | Date | null;
  submittedForApprovalAt: string | Date | null;
  accounts: SocialAccountItem[];
  media: MediaItem[];
  labels: LabelItem[];
  campaignPost: CampaignPost[];
  author: Author | null;
}

interface ApprovalReviewPanelProps {
  post: PendingPost | null;
  open: boolean;
  onClose: () => void;
  /** Called when a decision is submitted successfully */
  onDecision?: (postId: string, decision: "approved" | "rejected" | "changes_requested") => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function PlatformTab({
  platform,
  active,
  onClick,
}: {
  platform: string;
  active: boolean;
  onClick: () => void;
}) {
  const color = PLATFORM_COLORS[platform] ?? "#888";
  const label = PLATFORM_LABELS[platform] ?? platform;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground hover:text-foreground"
      )}
    >
      <span
        className="inline-flex h-3 w-3 items-center justify-center rounded-full text-[7px] font-bold text-white shrink-0"
        style={{ backgroundColor: color }}
      >
        {platform[0]}
      </span>
      {label}
    </button>
  );
}

function PostContentPreview({
  content,
  platform,
  account,
}: {
  content: string;
  platform: string;
  account: SocialAccountItem["socialAccount"] | null;
}) {
  const displayName = account?.displayName ?? "Unknown";
  const username = account?.username ?? "";
  const avatarUrl = account?.avatarUrl ?? null;

  return (
    <div className="rounded-lg border bg-background p-4 space-y-3 text-sm">
      <div className="flex items-center gap-2.5">
        <Avatar className="h-9 w-9 shrink-0">
          <AvatarImage src={avatarUrl ?? undefined} alt={displayName} />
          <AvatarFallback className="text-xs font-semibold">
            {displayName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="font-semibold text-sm">{displayName}</p>
          {username && (
            <p className="text-xs text-muted-foreground">
              @{username} · {PLATFORM_LABELS[platform] ?? platform}
            </p>
          )}
        </div>
      </div>
      <p className="whitespace-pre-wrap leading-relaxed text-sm">{content || <span className="text-muted-foreground italic">No content</span>}</p>
    </div>
  );
}

// ─── Decision form ────────────────────────────────────────────────────────────

type DecisionType = "approve" | "reject" | "request_changes" | null;

function DecisionForm({
  postId,
  onDecision,
}: {
  postId: string;
  onDecision: (decision: "approved" | "rejected" | "changes_requested") => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [active, setActive] = useState<DecisionType>(null);
  const [note, setNote] = useState("");

  const approveMutation = useMutation({
    mutationFn: async (note: string) => {
      const res = await fetch(`/api/posts/${postId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: note || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to approve post");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-posts"] });
      toast({ title: "Post approved", description: "The post has been approved and scheduled." });
      onDecision("approved");
      resetForm();
    },
    onError: (err: Error) => {
      toast({ title: "Failed to approve", description: err.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (reason: string) => {
      const res = await fetch(`/api/posts/${postId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to reject post");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-posts"] });
      toast({ title: "Post rejected", description: "The post has been rejected." });
      onDecision("rejected");
      resetForm();
    },
    onError: (err: Error) => {
      toast({ title: "Failed to reject", description: err.message, variant: "destructive" });
    },
  });

  const changesMutation = useMutation({
    mutationFn: async (note: string) => {
      const res = await fetch(`/api/posts/${postId}/request-changes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to request changes");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-posts"] });
      toast({ title: "Changes requested", description: "The author has been notified." });
      onDecision("changes_requested");
      resetForm();
    },
    onError: (err: Error) => {
      toast({ title: "Failed to request changes", description: err.message, variant: "destructive" });
    },
  });

  const isPending =
    approveMutation.isPending || rejectMutation.isPending || changesMutation.isPending;

  function resetForm() {
    setActive(null);
    setNote("");
  }

  function handleSubmit() {
    if (active === "approve") {
      approveMutation.mutate(note);
    } else if (active === "reject") {
      if (!note.trim()) return;
      rejectMutation.mutate(note.trim());
    } else if (active === "request_changes") {
      if (!note.trim()) return;
      changesMutation.mutate(note.trim());
    }
  }

  const submitLabel =
    active === "approve"
      ? "Confirm Approval"
      : active === "reject"
      ? "Confirm Rejection"
      : "Send Change Request";

  const noteRequired = active === "reject" || active === "request_changes";
  const canSubmit = !isPending && (active !== null) && (!noteRequired || note.trim().length > 0);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={active === "approve" ? "default" : "outline"}
          className={cn(
            "flex-1 gap-1.5",
            active === "approve"
              ? "bg-green-600 hover:bg-green-700 text-white border-green-600"
              : "border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800"
          )}
          onClick={() => setActive(active === "approve" ? null : "approve")}
          disabled={isPending}
        >
          <CheckCircle className="h-3.5 w-3.5" />
          Approve
        </Button>

        <Button
          size="sm"
          variant={active === "request_changes" ? "default" : "outline"}
          className={cn(
            "flex-1 gap-1.5",
            active === "request_changes"
              ? "bg-orange-500 hover:bg-orange-600 text-white border-orange-500"
              : "border-orange-200 text-orange-700 hover:bg-orange-50 hover:text-orange-800"
          )}
          onClick={() => setActive(active === "request_changes" ? null : "request_changes")}
          disabled={isPending}
        >
          <AlertCircle className="h-3.5 w-3.5" />
          Request Changes
        </Button>

        <Button
          size="sm"
          variant={active === "reject" ? "default" : "outline"}
          className={cn(
            "flex-1 gap-1.5",
            active === "reject"
              ? "bg-red-600 hover:bg-red-700 text-white border-red-600"
              : "border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
          )}
          onClick={() => setActive(active === "reject" ? null : "reject")}
          disabled={isPending}
        >
          <XCircle className="h-3.5 w-3.5" />
          Reject
        </Button>
      </div>

      {active !== null && (
        <div className="space-y-2 animate-in slide-in-from-top-1 duration-150">
          <Label htmlFor="decision-note" className="text-sm">
            {active === "approve"
              ? "Note for the author (optional)"
              : active === "reject"
              ? "Rejection reason (required)"
              : "What needs to change? (required)"}
          </Label>
          <Textarea
            id="decision-note"
            placeholder={
              active === "approve"
                ? "Great post! Going live as scheduled."
                : active === "reject"
                ? "This post doesn't align with our brand guidelines because…"
                : "Please update the copy to reflect the new pricing and remove the outdated link."
            }
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="resize-none text-sm"
            disabled={isPending}
          />
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={resetForm}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={cn(
                active === "approve" && "bg-green-600 hover:bg-green-700",
                active === "reject" && "bg-red-600 hover:bg-red-700",
                active === "request_changes" && "bg-orange-500 hover:bg-orange-600"
              )}
            >
              {isPending ? "Submitting…" : submitLabel}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ApprovalReviewPanel({
  post,
  open,
  onClose,
  onDecision,
}: ApprovalReviewPanelProps) {
  const [activePlatform, setActivePlatform] = useState<string | null>(null);

  const platforms = post
    ? Array.from(new Set(post.accounts.map((a) => a.socialAccount.platform)))
    : [];

  const currentPlatform = activePlatform ?? platforms[0] ?? null;
  const currentAccount =
    post?.accounts.find((a) => a.socialAccount.platform === currentPlatform)
      ?.socialAccount ?? null;

  const platformIndex = platforms.indexOf(currentPlatform ?? "");

  function handleDecision(decision: "approved" | "rejected" | "changes_requested") {
    if (post) {
      onDecision?.(post.id, decision);
    }
    onClose();
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl flex flex-col p-0 gap-0"
      >
        {post ? (
          <>
            {/* Header */}
            <SheetHeader className="px-5 pt-5 pb-4 border-b shrink-0">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <SheetTitle className="text-base">Review Post</SheetTitle>
                  <ApprovalStatusBadge status={post.approvalStatus} />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 -mt-0.5"
                  onClick={onClose}
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </Button>
              </div>
            </SheetHeader>

            {/* Body */}
            <div className="flex-1 overflow-y-auto">
              {/* Submitter info */}
              <div className="px-5 py-4 border-b">
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarImage
                      src={post.author?.image ?? undefined}
                      alt={post.author?.name ?? "Author"}
                    />
                    <AvatarFallback className="text-xs font-semibold">
                      {(post.author?.name ?? post.author?.email ?? "?")
                        .charAt(0)
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {post.author?.name ?? post.author?.email ?? "Unknown author"}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      {post.submittedForApprovalAt && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          Submitted{" "}
                          {formatDistanceToNow(new Date(post.submittedForApprovalAt), {
                            addSuffix: true,
                          })}
                        </span>
                      )}
                      {post.scheduledAt && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(post.scheduledAt), "MMM d, h:mm a")}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Platform tabs + preview */}
              <div className="px-5 py-4 border-b space-y-3">
                {platforms.length > 1 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                      disabled={platformIndex <= 0}
                      onClick={() => setActivePlatform(platforms[platformIndex - 1])}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    {platforms.map((platform) => (
                      <PlatformTab
                        key={platform}
                        platform={platform}
                        active={platform === currentPlatform}
                        onClick={() => setActivePlatform(platform)}
                      />
                    ))}
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                      disabled={platformIndex >= platforms.length - 1}
                      onClick={() => setActivePlatform(platforms[platformIndex + 1])}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}

                {currentPlatform && (
                  <PostContentPreview
                    content={post.content}
                    platform={currentPlatform}
                    account={currentAccount}
                  />
                )}
              </div>

              {/* Media thumbnails */}
              {post.media.length > 0 && (
                <div className="px-5 py-4 border-b space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Media ({post.media.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {post.media.map((m) => {
                      const isVideo = m.mediaFile.mimeType.startsWith("video/");
                      const thumb = m.mediaFile.thumbnailUrl ?? m.mediaFile.url;
                      return (
                        <div
                          key={m.mediaFile.id}
                          className="relative h-16 w-16 rounded-md overflow-hidden border bg-muted shrink-0"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={thumb}
                            alt={m.mediaFile.name}
                            className="h-full w-full object-cover"
                          />
                          {isVideo && (
                            <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                              <span className="text-white text-[10px] font-bold">VIDEO</span>
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Labels + campaign */}
              {(post.labels.length > 0 || post.campaignPost.length > 0) && (
                <div className="px-5 py-4 border-b space-y-3">
                  {post.labels.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Labels
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {post.labels.map((pl) => (
                          <span
                            key={pl.label.id}
                            className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white"
                            style={{ backgroundColor: pl.label.color }}
                          >
                            {pl.label.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {post.campaignPost.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Campaign
                      </p>
                      <p className="text-sm text-foreground">
                        {post.campaignPost[0].campaign.name}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Previous review note */}
              {post.approvalNote && (
                <div className="px-5 py-4 border-b">
                  <div className="flex items-start gap-2">
                    <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Previous Review Note
                      </p>
                      <p className="text-sm text-foreground">{post.approvalNote}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer: decision form */}
            {post.approvalStatus === "PENDING" && (
              <div className="px-5 py-4 border-t bg-muted/30 shrink-0">
                <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">
                  Your Decision
                </p>
                <DecisionForm postId={post.id} onDecision={handleDecision} />
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
            No post selected
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
