"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Trash2, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, PLATFORM_COLORS, PLATFORM_LABELS, truncate, formatDateTime } from "@/lib/utils";

export type QueuePost = {
  id: string;
  content: string;
  status: string;
  scheduledAt: string | null;
  queuePosition: number | null;
  accounts: Array<{
    socialAccount: {
      id: string;
      platform: string;
      displayName: string;
      avatarUrl: string | null;
    };
  }>;
};

interface QueueItemProps {
  post: QueuePost;
  nextPublishAt: Date | null;
  onEdit: (id: string) => void;
  onRemove: (id: string) => void;
  isDragging?: boolean;
}

function PlatformDot({ platform }: { platform: string }) {
  const color = PLATFORM_COLORS[platform] ?? "#888";
  const label = PLATFORM_LABELS[platform] ?? platform;
  return (
    <span
      className="inline-flex items-center justify-center rounded-full font-bold text-white flex-shrink-0"
      style={{
        width: 20,
        height: 20,
        background: color,
        fontSize: 9,
        lineHeight: 1,
      }}
      title={label}
    >
      {platform.charAt(0)}
    </span>
  );
}

const STATUS_BADGE_VARIANTS: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  SCHEDULED: "default",
  DRAFT: "secondary",
  PUBLISHED: "outline",
  FAILED: "destructive",
  PUBLISHING: "secondary",
  CANCELLED: "outline",
};

export function QueueItem({
  post,
  nextPublishAt,
  onEdit,
  onRemove,
  isDragging = false,
}: QueueItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: post.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const platforms = Array.from(
    new Set(post.accounts.map((a) => a.socialAccount.platform))
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-start gap-3 rounded-lg border bg-card p-4 shadow-sm transition-shadow",
        (isDragging || isSortableDragging) && "opacity-50 shadow-lg ring-2 ring-primary"
      )}
    >
      {/* Drag handle */}
      <button
        className="mt-0.5 flex-shrink-0 cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-5 w-5" />
      </button>

      {/* Platform icons */}
      <div className="flex flex-wrap gap-1 mt-0.5 flex-shrink-0">
        {platforms.map((platform) => (
          <PlatformDot key={platform} platform={platform} />
        ))}
        {platforms.length === 0 && (
          <span className="text-xs text-muted-foreground">No platforms</span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-sm leading-snug text-foreground line-clamp-2">
          {truncate(post.content, 100)}
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5 flex-shrink-0" />
          {nextPublishAt ? (
            <span>Next publish: {formatDateTime(nextPublishAt)}</span>
          ) : post.scheduledAt ? (
            <span>Scheduled: {formatDateTime(post.scheduledAt)}</span>
          ) : (
            <span className="italic">No time set</span>
          )}
        </div>
      </div>

      {/* Status + actions */}
      <div className="flex flex-shrink-0 items-center gap-2">
        <Badge
          variant={STATUS_BADGE_VARIANTS[post.status] ?? "secondary"}
          className="text-xs capitalize hidden sm:inline-flex"
        >
          {post.status.toLowerCase().replace("_", " ")}
        </Badge>

        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={() => onEdit(post.id)}
          aria-label="Edit post"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>

        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-destructive hover:text-destructive"
          onClick={() => onRemove(post.id)}
          aria-label="Remove from queue"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
