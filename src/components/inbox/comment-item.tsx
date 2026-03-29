"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  MessageSquare,
  Check,
  EyeOff,
  Trash2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { CommentReplyForm } from "./comment-reply-form";
import { PLATFORM_COLORS, PLATFORM_LABELS, cn, formatRelative, truncate } from "@/lib/utils";
import type { Comment, CommentReply } from "@prisma/client";

export type CommentWithReplies = Comment & { replies: CommentReply[] };

interface CommentItemProps {
  comment: CommentWithReplies;
  isPro: boolean;
}

async function patchComment(id: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/inbox/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed to update comment");
  return res.json();
}

async function deleteComment(id: string) {
  const res = await fetch(`/api/inbox/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete comment");
  return res.json();
}

const STATUS_LABELS: Record<string, string> = {
  UNREAD: "Unread",
  READ: "Read",
  REPLIED: "Replied",
  RESOLVED: "Resolved",
};

export function CommentItem({ comment, isPro }: CommentItemProps) {
  const [showReply, setShowReply] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const queryClient = useQueryClient();

  const platformColor = PLATFORM_COLORS[comment.platform] ?? "#888";
  const platformLabel = PLATFORM_LABELS[comment.platform] ?? comment.platform;

  const { mutate: patch, isPending: patching } = useMutation({
    mutationFn: (body: Record<string, unknown>) => patchComment(comment.id, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["inbox"] }),
  });

  const { mutate: remove, isPending: deleting } = useMutation({
    mutationFn: () => deleteComment(comment.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["inbox"] }),
  });

  const isLoading = patching || deleting;

  return (
    <article
      className={cn(
        "relative border-b bg-background hover:bg-accent/20 transition-colors px-5 py-4",
        comment.status === "UNREAD" && "bg-blue-50/30 dark:bg-blue-950/10"
      )}
    >
      {/* Platform left border */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l"
        style={{ backgroundColor: platformColor }}
      />

      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          {comment.authorAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={comment.authorAvatar}
              alt={comment.authorName}
              className="size-9 rounded-full object-cover"
            />
          ) : (
            <div className="size-9 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-muted-foreground">
              {comment.authorName.charAt(0).toUpperCase()}
            </div>
          )}
          {/* Platform dot */}
          <span
            className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full border-2 border-background"
            style={{ backgroundColor: platformColor }}
            title={platformLabel}
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="min-w-0">
              <span className="font-medium text-sm text-foreground">
                {comment.authorName}
              </span>
              {comment.authorUsername && (
                <span className="text-xs text-muted-foreground ml-1.5">
                  @{comment.authorUsername}
                </span>
              )}
              <span className="text-xs text-muted-foreground ml-1.5">·</span>
              <span className="text-xs text-muted-foreground ml-1.5">
                {platformLabel}
              </span>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <StatusBadge status={comment.status} />
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {formatRelative(comment.publishedAt)}
              </span>
            </div>
          </div>

          {/* Post reference */}
          {comment.platformPostId && (
            <p className="text-xs text-muted-foreground mb-1.5">
              On post:{" "}
              <span className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">
                {truncate(comment.platformPostId, 48)}
              </span>
            </p>
          )}

          {/* Comment text */}
          <p className="text-sm text-foreground leading-relaxed">{comment.content}</p>

          {/* Actions */}
          <div className="flex items-center gap-1 mt-2.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs px-2 text-muted-foreground hover:text-foreground"
              onClick={() => setShowReply((v) => !v)}
              disabled={isLoading}
            >
              <MessageSquare className="size-3.5" />
              Reply
            </Button>

            {comment.status !== "RESOLVED" && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 text-xs px-2 text-muted-foreground hover:text-green-600"
                onClick={() => patch({ status: "RESOLVED" })}
                disabled={isLoading}
              >
                <Check className="size-3.5" />
                Resolve
              </Button>
            )}

            {comment.status === "UNREAD" && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 text-xs px-2 text-muted-foreground hover:text-foreground"
                onClick={() => patch({ status: "READ" })}
                disabled={isLoading}
              >
                Mark Read
              </Button>
            )}

            {!comment.isHidden && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 text-xs px-2 text-muted-foreground hover:text-amber-600"
                onClick={() => patch({ isHidden: true })}
                disabled={isLoading}
              >
                <EyeOff className="size-3.5" />
                Hide
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs px-2 text-muted-foreground hover:text-destructive"
              onClick={() => remove()}
              disabled={isLoading}
            >
              <Trash2 className="size-3.5" />
              Delete
            </Button>
          </div>

          {/* Inline reply form */}
          {showReply && (
            <CommentReplyForm
              commentId={comment.id}
              platform={comment.platform}
              isPro={isPro}
              onCancel={() => setShowReply(false)}
              onSent={() => setShowReply(false)}
            />
          )}

          {/* Reply thread */}
          {comment.replies.length > 0 && (
            <div className="mt-3">
              <button
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowReplies((v) => !v)}
              >
                {showReplies ? (
                  <ChevronUp className="size-3.5" />
                ) : (
                  <ChevronDown className="size-3.5" />
                )}
                {comment.replies.length}{" "}
                {comment.replies.length === 1 ? "reply" : "replies"}
              </button>

              {showReplies && (
                <div className="mt-2 space-y-2 pl-4 border-l-2 border-muted">
                  {comment.replies.map((reply) => (
                    <div key={reply.id} className="text-sm">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="font-medium text-xs text-foreground">
                          You
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatRelative(reply.sentAt)}
                        </span>
                      </div>
                      <p className="text-sm text-foreground leading-relaxed">
                        {reply.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    UNREAD: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
    READ: "bg-muted text-muted-foreground",
    REPLIED: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
    RESOLVED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
        styles[status] ?? "bg-muted text-muted-foreground"
      )}
    >
      {status === "UNREAD" && (
        <span className="size-1.5 rounded-full bg-blue-500 inline-block" />
      )}
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
