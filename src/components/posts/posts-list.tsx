"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  Pencil,
  Trash2,
  Copy,
  MoreHorizontal,
  CalendarClock,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { cn, PLATFORM_COLORS, PLATFORM_LABELS, truncate } from "@/lib/utils";
import type { PostWithRelations } from "@/types";

// ─── Status badge config ──────────────────────────────────────────────────────

const STATUS_CONFIG = {
  DRAFT: { label: "Draft", className: "bg-gray-100 text-gray-700 border-gray-200" },
  PENDING_APPROVAL: {
    label: "Pending Approval",
    className: "bg-yellow-50 text-yellow-700 border-yellow-200",
  },
  SCHEDULED: { label: "Scheduled", className: "bg-blue-50 text-blue-700 border-blue-200" },
  PUBLISHING: { label: "Publishing", className: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  PUBLISHED: { label: "Published", className: "bg-green-50 text-green-700 border-green-200" },
  FAILED: { label: "Failed", className: "bg-red-50 text-red-700 border-red-200" },
  CANCELLED: { label: "Cancelled", className: "bg-gray-100 text-gray-500 border-gray-200" },
} as const;

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

// ─── Props ────────────────────────────────────────────────────────────────────

interface PostsListProps {
  posts: PostWithRelations[];
  onDelete?: (post: PostWithRelations) => void;
  onEdit?: (post: PostWithRelations) => void;
  onDuplicate?: (post: PostWithRelations) => void;
  emptyMessage?: string;
  isDeleting?: boolean;
  deletingId?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PostsList({
  posts,
  onDelete,
  onEdit,
  onDuplicate,
  emptyMessage = "No posts found.",
  isDeleting,
  deletingId,
}: PostsListProps) {
  const [confirmDelete, setConfirmDelete] = useState<PostWithRelations | null>(null);

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <FileText className="h-10 w-10 text-muted-foreground/40 mb-3" />
        <p className="text-muted-foreground text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground w-[120px]">
                Platform(s)
              </th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                Content
              </th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground w-[140px]">
                Status
              </th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground w-[160px]">
                Scheduled
              </th>
              <th className="px-4 py-2.5 text-right font-medium text-muted-foreground w-[60px]">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {posts.map((post) => {
              const statusConfig =
                STATUS_CONFIG[post.status as keyof typeof STATUS_CONFIG] ??
                STATUS_CONFIG.DRAFT;
              const platforms = post.accounts.map((a) => a.socialAccount.platform);
              const uniquePlatforms = Array.from(new Set(platforms));

              return (
                <tr
                  key={post.id}
                  className={cn(
                    "hover:bg-muted/30 transition-colors",
                    isDeleting && deletingId === post.id && "opacity-50"
                  )}
                >
                  {/* Platforms */}
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {uniquePlatforms.length > 0 ? (
                        uniquePlatforms.map((p) => (
                          <PlatformDot key={p} platform={p} />
                        ))
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </div>
                  </td>

                  {/* Content */}
                  <td className="px-4 py-3">
                    <p className="text-sm line-clamp-2 text-foreground">
                      {truncate(post.content, 120)}
                    </p>
                    {post.labels.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {post.labels.map((label) => (
                          <span
                            key={label.id}
                            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                            style={{ backgroundColor: label.color }}
                          >
                            {label.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                        statusConfig.className
                      )}
                    >
                      {statusConfig.label}
                    </span>
                  </td>

                  {/* Scheduled */}
                  <td className="px-4 py-3">
                    {post.scheduledAt ? (
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                        {format(new Date(post.scheduledAt), "MMM d, h:mm a")}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        {onEdit ? (
                          <DropdownMenuItem onClick={() => onEdit(post)}>
                            <Pencil className="h-3.5 w-3.5 mr-2" />
                            Edit
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem asChild>
                            <Link href={`/compose?postId=${post.id}`}>
                              <Pencil className="h-3.5 w-3.5 mr-2" />
                              Edit
                            </Link>
                          </DropdownMenuItem>
                        )}
                        {onDuplicate && (
                          <DropdownMenuItem onClick={() => onDuplicate(post)}>
                            <Copy className="h-3.5 w-3.5 mr-2" />
                            Duplicate
                          </DropdownMenuItem>
                        )}
                        {onDelete && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setConfirmDelete(post)}
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this post?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The post will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (confirmDelete && onDelete) {
                  onDelete(confirmDelete);
                  setConfirmDelete(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─── Status badge (standalone export for reuse) ───────────────────────────────

export function PostStatusBadge({ status }: { status: string }) {
  const config =
    STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.DRAFT;
  return (
    <Badge
      variant="outline"
      className={cn("text-xs font-medium", config.className)}
    >
      {config.label}
    </Badge>
  );
}
