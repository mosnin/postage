"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow, format } from "date-fns";
import {
  X,
  Pencil,
  Trash2,
  CheckCircle,
  XCircle,
  AlertCircle,
  CalendarClock,
  User,
  Tag,
  Megaphone,
  Image as ImageIcon,
  Activity,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";
import { ApprovalStatusBadge } from "@/components/posts/approval-status-badge";
import { PostStatusBadge } from "@/components/posts/posts-list";
import { cn, PLATFORM_COLORS, PLATFORM_LABELS, formatDateTime } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PostDetailPanelProps {
  postId: string;
  onClose: () => void;
  /** Current user's role in the workspace, used to show/hide action buttons */
  viewerRole?: "OWNER" | "ADMIN" | "MANAGER" | "MEMBER" | "VIEWER" | string;
  /** Current user's ID, used to determine edit/delete ownership */
  viewerUserId?: string;
  /** Called after a successful delete so the parent can refresh */
  onDeleted?: (postId: string) => void;
}

interface ActivityLogEntry {
  id: string;
  action: string;
  createdAt: string;
  metadata: Record<string, unknown>;
  user: { id: string; name: string | null; image: string | null } | null;
}

interface PostDetail {
  id: string;
  content: string;
  status: string;
  approvalStatus: string | null;
  approvalNote: string | null;
  scheduledAt: string | null;
  publishedAt: string | null;
  submittedForApprovalAt: string | null;
  approvedAt: string | null;
  authorId: string | null;
  workspaceId: string;
  accounts: Array<{
    socialAccount: {
      id: string;
      platform: string;
      displayName: string;
      username: string;
      avatarUrl: string | null;
    };
  }>;
  media: Array<{
    order: number;
    mediaFile: {
      id: string;
      url: string;
      thumbnailUrl: string | null;
      mimeType: string;
      name: string;
    };
  }>;
  labels: Array<{
    label: { id: string; name: string; color: string };
  }>;
  campaignPost: Array<{
    campaign: { id: string; name: string };
  }>;
  author?: { id: string; name: string | null; email: string | null; image: string | null } | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MANAGER_ROLES = new Set(["OWNER", "ADMIN", "MANAGER"]);

function isManager(role: string | undefined): boolean {
  return MANAGER_ROLES.has(role ?? "");
}

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

function ActivityItem({ entry }: { entry: ActivityLogEntry }) {
  const actionLabels: Record<string, string> = {
    "post.created": "created this post",
    "post.updated": "updated this post",
    "post.approved": "approved this post",
    "post.rejected": "rejected this post",
    "post.changes_requested": "requested changes",
    "post.published": "published this post",
    "post.deleted": "deleted this post",
  };

  const label = actionLabels[entry.action] ?? entry.action;
  const name = entry.user?.name ?? "System";
  const initial = name.charAt(0).toUpperCase();

  return (
    <div className="flex items-start gap-2.5">
      <Avatar className="h-6 w-6 shrink-0 mt-0.5">
        <AvatarImage src={entry.user?.image ?? undefined} alt={name} />
        <AvatarFallback className="text-[9px] font-semibold">{initial}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-foreground">
          <span className="font-medium">{name}</span> {label}
        </p>
        {typeof entry.metadata?.note === "string" && entry.metadata.note && (
          <p className="text-xs text-muted-foreground mt-0.5 italic">
            &ldquo;{entry.metadata.note}&rdquo;
          </p>
        )}
        {typeof entry.metadata?.reason === "string" && entry.metadata.reason && (
          <p className="text-xs text-muted-foreground mt-0.5 italic">
            &ldquo;{entry.metadata.reason}&rdquo;
          </p>
        )}
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
        </p>
      </div>
    </div>
  );
}

// ─── Approval action form ─────────────────────────────────────────────────────

type DecisionType = "approve" | "reject" | "request_changes" | null;

function ApprovalActions({
  postId,
  onDecision,
}: {
  postId: string;
  onDecision: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [active, setActive] = useState<DecisionType>(null);
  const [note, setNote] = useState("");

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["post", postId] });
    queryClient.invalidateQueries({ queryKey: ["pending-posts"] });
  }

  const approveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/posts/${postId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: note || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to approve");
      }
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Post approved" });
      onDecision();
    },
    onError: (err: Error) =>
      toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/posts/${postId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: note }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to reject");
      }
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Post rejected" });
      onDecision();
    },
    onError: (err: Error) =>
      toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const changesMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/posts/${postId}/request-changes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to request changes");
      }
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Changes requested" });
      onDecision();
    },
    onError: (err: Error) =>
      toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const isPending =
    approveMutation.isPending || rejectMutation.isPending || changesMutation.isPending;
  const noteRequired = active === "reject" || active === "request_changes";
  const canSubmit = !isPending && active !== null && (!noteRequired || note.trim().length > 0);

  function handleSubmit() {
    if (active === "approve") approveMutation.mutate();
    else if (active === "reject") rejectMutation.mutate();
    else if (active === "request_changes") changesMutation.mutate();
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Review Decision
      </p>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className={cn(
            "flex-1 gap-1.5",
            active === "approve"
              ? "bg-green-600 text-white border-green-600 hover:bg-green-700"
              : "border-green-200 text-green-700 hover:bg-green-50"
          )}
          onClick={() => setActive(active === "approve" ? null : "approve")}
          disabled={isPending}
        >
          <CheckCircle className="h-3.5 w-3.5" />
          Approve
        </Button>
        <Button
          size="sm"
          variant="outline"
          className={cn(
            "flex-1 gap-1.5",
            active === "request_changes"
              ? "bg-orange-500 text-white border-orange-500 hover:bg-orange-600"
              : "border-orange-200 text-orange-700 hover:bg-orange-50"
          )}
          onClick={() => setActive(active === "request_changes" ? null : "request_changes")}
          disabled={isPending}
        >
          <AlertCircle className="h-3.5 w-3.5" />
          Changes
        </Button>
        <Button
          size="sm"
          variant="outline"
          className={cn(
            "flex-1 gap-1.5",
            active === "reject"
              ? "bg-red-600 text-white border-red-600 hover:bg-red-700"
              : "border-red-200 text-red-700 hover:bg-red-50"
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
          <Label htmlFor="panel-note" className="text-sm">
            {active === "approve"
              ? "Note (optional)"
              : active === "reject"
              ? "Reason (required)"
              : "What needs to change? (required)"}
          </Label>
          <Textarea
            id="panel-note"
            rows={3}
            className="resize-none text-sm"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={isPending}
            placeholder={
              active === "approve"
                ? "Looks great!"
                : active === "reject"
                ? "Please explain why…"
                : "Please describe the changes needed…"
            }
          />
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => {
                setActive(null);
                setNote("");
              }}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!canSubmit}
              onClick={handleSubmit}
              className={cn(
                active === "approve" && "bg-green-600 hover:bg-green-700",
                active === "reject" && "bg-red-600 hover:bg-red-700",
                active === "request_changes" && "bg-orange-500 hover:bg-orange-600"
              )}
            >
              {isPending ? "Submitting…" : "Confirm"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Post detail content ──────────────────────────────────────────────────────

function PostDetailContent({
  post,
  activityLog,
  viewerRole,
  viewerUserId,
  onClose,
  onDeleted,
}: {
  post: PostDetail;
  activityLog: ActivityLogEntry[];
  viewerRole?: string;
  viewerUserId?: string;
  onClose: () => void;
  onDeleted?: (postId: string) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activePlatform, setActivePlatform] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const platforms = Array.from(
    new Set(post.accounts.map((a) => a.socialAccount.platform))
  );
  const currentPlatform = activePlatform ?? platforms[0] ?? null;
  const platformIndex = platforms.indexOf(currentPlatform ?? "");
  const currentAccount =
    post.accounts.find((a) => a.socialAccount.platform === currentPlatform)
      ?.socialAccount ?? null;

  const canManage = isManager(viewerRole);
  const isOwner = post.authorId === viewerUserId;
  const canEdit =
    canManage || (isOwner && ["DRAFT", "PENDING_APPROVAL"].includes(post.status));
  const canDelete =
    canManage || (isOwner && ["DRAFT", "PENDING_APPROVAL"].includes(post.status));
  const canApprove = canManage && post.approvalStatus === "PENDING";

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/posts/${post.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to delete post");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-posts"] });
      toast({ title: "Post deleted" });
      onDeleted?.(post.id);
      onClose();
    },
    onError: (err: Error) =>
      toast({ title: "Delete failed", description: err.message, variant: "destructive" }),
  });

  return (
    <>
      {/* Header */}
      <SheetHeader className="px-5 pt-5 pb-4 border-b shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5">
            <SheetTitle className="text-base">Post Details</SheetTitle>
            <div className="flex items-center gap-1.5 flex-wrap">
              <PostStatusBadge status={post.status} />
              {post.approvalStatus && post.approvalStatus !== "NOT_REQUIRED" && (
                <ApprovalStatusBadge status={post.approvalStatus} />
              )}
            </div>
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

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        {/* Platform tabs + content preview */}
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

          {/* Content */}
          <div className="rounded-lg border bg-background p-4 space-y-2.5">
            {currentAccount && (
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarImage
                    src={currentAccount.avatarUrl ?? undefined}
                    alt={currentAccount.displayName}
                  />
                  <AvatarFallback className="text-xs font-semibold">
                    {currentAccount.displayName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-semibold">{currentAccount.displayName}</p>
                  <p className="text-xs text-muted-foreground">
                    @{currentAccount.username} · {PLATFORM_LABELS[currentPlatform!] ?? currentPlatform}
                  </p>
                </div>
              </div>
            )}
            <p className="text-sm whitespace-pre-wrap leading-relaxed text-foreground">
              {post.content || (
                <span className="text-muted-foreground italic">No content</span>
              )}
            </p>
          </div>
        </div>

        {/* Media */}
        {post.media.length > 0 && (
          <div className="px-5 py-4 border-b space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <ImageIcon className="h-3.5 w-3.5" />
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

        {/* Meta: author + schedule */}
        <div className="px-5 py-4 border-b space-y-3">
          {post.author && (
            <div className="flex items-center gap-2.5">
              <User className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={post.author.image ?? undefined} alt={post.author.name ?? ""} />
                  <AvatarFallback className="text-[10px]">
                    {(post.author.name ?? post.author.email ?? "?").charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm text-foreground">
                  {post.author.name ?? post.author.email ?? "Unknown author"}
                </span>
              </div>
            </div>
          )}

          {(post.scheduledAt || post.publishedAt) && (
            <div className="flex items-center gap-2.5">
              <CalendarClock className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm text-foreground">
                {post.publishedAt
                  ? `Published ${formatDateTime(post.publishedAt)}`
                  : post.scheduledAt
                  ? `Scheduled for ${formatDateTime(post.scheduledAt)}`
                  : null}
              </span>
            </div>
          )}
        </div>

        {/* Labels + campaign */}
        {(post.labels.length > 0 || post.campaignPost.length > 0) && (
          <div className="px-5 py-4 border-b space-y-3">
            {post.labels.length > 0 && (
              <div className="flex items-start gap-2.5">
                <Tag className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="flex flex-wrap gap-1.5">
                  {post.labels.map((pl) => (
                    <span
                      key={pl.label.id}
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                      style={{ backgroundColor: pl.label.color }}
                    >
                      {pl.label.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {post.campaignPost.length > 0 && (
              <div className="flex items-center gap-2.5">
                <Megaphone className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-foreground">
                  {post.campaignPost[0].campaign.name}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Approval note */}
        {post.approvalNote && (
          <div className="px-5 py-4 border-b">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
              Review Note
            </p>
            <p className="text-sm text-foreground leading-relaxed">
              {post.approvalNote}
            </p>
          </div>
        )}

        {/* Activity log */}
        {activityLog.length > 0 && (
          <div className="px-5 py-4 space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5" />
              Activity
            </p>
            <div className="space-y-3">
              {activityLog.map((entry) => (
                <ActivityItem key={entry.id} entry={entry} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer actions */}
      {(canEdit || canDelete || canApprove) && (
        <div className="px-5 py-4 border-t bg-muted/30 shrink-0 space-y-3">
          {canApprove && (
            <ApprovalActions postId={post.id} onDecision={onClose} />
          )}

          {(canEdit || canDelete) && (
            <>
              {canApprove && <Separator />}
              <div className="flex gap-2">
                {canEdit && (
                  <Button asChild variant="outline" size="sm" className="flex-1 gap-1.5">
                    <Link href={`/compose?postId=${post.id}`}>
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Link>
                  </Button>
                )}
                {canDelete && (
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "gap-1.5 border-red-200 text-red-700 hover:bg-red-50",
                      canEdit ? "" : "flex-1"
                    )}
                    onClick={() => setConfirmDelete(true)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this post?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The post will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteMutation.mutate()}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PostDetailPanel({
  postId,
  onClose,
  viewerRole,
  viewerUserId,
  onDeleted,
}: PostDetailPanelProps) {
  const { data, isLoading, error } = useQuery<{
    post: PostDetail;
    activityLog: ActivityLogEntry[];
  }>({
    queryKey: ["post", postId],
    queryFn: async () => {
      const [postRes, logsRes] = await Promise.all([
        fetch(`/api/posts/${postId}`),
        fetch(`/api/activity?entityId=${postId}&entityType=Post&pageSize=20`),
      ]);

      if (!postRes.ok) {
        const data = await postRes.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to load post");
      }

      const post = await postRes.json();

      // Activity log is optional — gracefully degrade if route doesn't exist
      let activityLog: ActivityLogEntry[] = [];
      if (logsRes.ok) {
        const logsData = await logsRes.json().catch(() => ({ data: [] }));
        activityLog = Array.isArray(logsData) ? logsData : (logsData.data ?? []);
      }

      // Fetch author separately if not included
      let author = post.author ?? null;
      if (!author && post.authorId) {
        const authorRes = await fetch(`/api/users/${post.authorId}`).catch(() => null);
        if (authorRes?.ok) {
          author = await authorRes.json().catch(() => null);
        }
      }

      return { post: { ...post, author }, activityLog };
    },
    staleTime: 30_000,
    enabled: !!postId,
  });

  return (
    <Sheet open={!!postId} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl flex flex-col p-0 gap-0"
      >
        {isLoading ? (
          <div className="p-5 space-y-4">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center flex-1 p-8 text-center">
            <p className="text-sm font-medium text-destructive">Failed to load post</p>
            <p className="text-xs text-muted-foreground mt-1">
              {(error as Error).message}
            </p>
            <Button variant="outline" size="sm" className="mt-4" onClick={onClose}>
              Close
            </Button>
          </div>
        ) : data ? (
          <PostDetailContent
            post={data.post}
            activityLog={data.activityLog}
            viewerRole={viewerRole}
            viewerUserId={viewerUserId}
            onClose={onClose}
            onDeleted={onDeleted}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
