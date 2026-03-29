"use client";

import { useState } from "react";
import { format } from "date-fns";
import { cn, PLATFORM_COLORS, truncate } from "@/lib/utils";
import { X, Edit, Trash2, Clock } from "lucide-react";
import type { Post, PostAccount, SocialAccount, Label, PostLabel, Platform } from "@prisma/client";

type CalendarPost = Post & {
  accounts: (PostAccount & { socialAccount: SocialAccount })[];
  labels: (PostLabel & { label: Label })[];
  _count: { media: number };
};

interface CalendarPostCardProps {
  post: CalendarPost;
  variant: "pill" | "week";
  isDragging?: boolean;
  onEdit?: (post: CalendarPost) => void;
  onDelete?: (postId: string) => void;
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === "SCHEDULED"
      ? "bg-green-500"
      : status === "DRAFT"
      ? "bg-yellow-400"
      : status === "FAILED"
      ? "bg-red-500"
      : status === "PUBLISHED"
      ? "bg-blue-500"
      : "bg-gray-400";
  return <span className={cn("inline-block w-1.5 h-1.5 rounded-full flex-shrink-0", color)} />;
}

function PlatformDot({ platform }: { platform: string | Platform }) {
  const color = PLATFORM_COLORS[platform] ?? "#888";
  return (
    <span
      className="inline-block w-2 h-2 rounded-full flex-shrink-0"
      style={{ backgroundColor: color }}
    />
  );
}

export function CalendarPostCardPill({
  post,
  isDragging,
  onClick,
}: {
  post: CalendarPost;
  isDragging?: boolean;
  onClick?: () => void;
}) {
  const primaryAccount = post.accounts[0];
  const platform = primaryAccount?.socialAccount?.platform ?? "";
  const color = PLATFORM_COLORS[platform] ?? "#6366f1";
  const extraAccounts = post.accounts.length - 1;

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium truncate",
        "hover:brightness-95 transition-all cursor-pointer select-none",
        isDragging && "opacity-60 rotate-1 scale-105 shadow-lg"
      )}
      style={{ backgroundColor: `${color}20`, borderLeft: `3px solid ${color}` }}
    >
      <StatusDot status={post.status} />
      <span className="truncate">{truncate(post.content, 40)}</span>
      {extraAccounts > 0 && (
        <span className="text-[10px] text-muted-foreground ml-auto flex-shrink-0">
          +{extraAccounts}
        </span>
      )}
    </button>
  );
}

export function CalendarPostCardWeek({
  post,
  isDragging,
  onClick,
}: {
  post: CalendarPost;
  isDragging?: boolean;
  onClick?: () => void;
}) {
  const primaryAccount = post.accounts[0];
  const platform = primaryAccount?.socialAccount?.platform ?? "";
  const color = PLATFORM_COLORS[platform] ?? "#6366f1";

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left p-1.5 rounded-sm text-xs flex flex-col gap-0.5",
        "hover:brightness-95 transition-all cursor-pointer select-none",
        isDragging && "opacity-60 rotate-1 scale-105 shadow-lg"
      )}
      style={{ backgroundColor: `${color}18`, borderLeft: `3px solid ${color}` }}
    >
      <div className="flex items-center gap-1">
        <StatusDot status={post.status} />
        {post.scheduledAt && (
          <span className="text-[10px] text-muted-foreground font-mono">
            {format(new Date(post.scheduledAt), "h:mm a")}
          </span>
        )}
      </div>
      <p className="truncate leading-tight font-medium" style={{ color }}>
        {truncate(post.content, 60)}
      </p>
      {post.accounts.length > 0 && (
        <div className="flex items-center gap-0.5 mt-0.5">
          {post.accounts.slice(0, 3).map((a) => (
            <PlatformDot key={a.id} platform={a.socialAccount.platform} />
          ))}
          {post.accounts.length > 3 && (
            <span className="text-[9px] text-muted-foreground">+{post.accounts.length - 3}</span>
          )}
        </div>
      )}
    </button>
  );
}

export function PostDetailPanel({
  post,
  onClose,
  onEdit,
  onDelete,
}: {
  post: CalendarPost;
  onClose: () => void;
  onEdit?: (post: CalendarPost) => void;
  onDelete?: (postId: string) => void;
}) {
  const platforms = post.accounts.map((a) => a.socialAccount.platform);
  const primaryPlatform = platforms[0] ?? "";
  const color = PLATFORM_COLORS[primaryPlatform] ?? "#6366f1";

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-80 bg-background border-l shadow-xl flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderLeftColor: color, borderLeftWidth: 4 }}>
        <div className="flex items-center gap-2">
          <StatusDot status={post.status} />
          <span className="text-sm font-semibold capitalize">
            {post.status.toLowerCase().replace("_", " ")}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {post.scheduledAt && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>{format(new Date(post.scheduledAt), "EEE, MMM d, yyyy 'at' h:mm a")}</span>
          </div>
        )}

        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
            Content
          </p>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{post.content}</p>
        </div>

        {post.accounts.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Platforms
            </p>
            <div className="flex flex-wrap gap-1.5">
              {post.accounts.map((a) => {
                const pColor = PLATFORM_COLORS[a.socialAccount.platform] ?? "#888";
                return (
                  <span
                    key={a.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{ backgroundColor: `${pColor}20`, color: pColor }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: pColor }}
                    />
                    {a.socialAccount.displayName}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {post.labels.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Labels
            </p>
            <div className="flex flex-wrap gap-1">
              {post.labels.map((pl) => (
                <span
                  key={pl.labelId}
                  className="px-2 py-0.5 rounded-full text-xs font-medium text-white"
                  style={{ backgroundColor: pl.label.color }}
                >
                  {pl.label.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {post._count.media > 0 && (
          <div className="text-sm text-muted-foreground">
            {post._count.media} media attachment{post._count.media !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-4 border-t flex gap-2">
        {onEdit && (
          <button
            onClick={() => onEdit(post)}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Edit className="h-3.5 w-3.5" />
            Edit
          </button>
        )}
        {onDelete && (
          <button
            onClick={() => onDelete(post.id)}
            className="flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

export type { CalendarPost };
