"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  FileText,
  Pencil,
  Trash2,
  Loader2,
  ChevronDown,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { cn, truncate, PLATFORM_COLORS, PLATFORM_LABELS } from "@/lib/utils";
import type { PostWithRelations } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DraftsListProps {
  workspaceId: string;
}

type SortOption = "newest" | "oldest";

const SORT_LABELS: Record<SortOption, string> = {
  newest: "Newest first",
  oldest: "Oldest first",
};

// ─── Platform dot ─────────────────────────────────────────────────────────────

function PlatformDot({ platform }: { platform: string }) {
  const color = PLATFORM_COLORS[platform] ?? "#888";
  const label = PLATFORM_LABELS[platform] ?? platform;
  return (
    <span
      title={label}
      className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold text-white shrink-0"
      style={{ backgroundColor: color }}
    >
      {platform[0]}
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DraftsList({ workspaceId }: DraftsListProps) {
  const queryClient = useQueryClient();

  const [sort, setSort] = useState<SortOption>("newest");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [deleteTarget, setDeleteTarget] = useState<PostWithRelations | null>(null);

  // ─── Query ──────────────────────────────────────────────────────────────────

  const { data, isLoading } = useQuery<{
    data: PostWithRelations[];
    meta: { total: number };
  }>({
    queryKey: ["drafts", workspaceId, sort],
    queryFn: async () => {
      const params = new URLSearchParams({
        workspaceId,
        status: "DRAFT",
        pageSize: "100",
      });
      const res = await fetch(`/api/posts?${params}`);
      if (!res.ok) throw new Error("Failed to fetch drafts");
      return res.json();
    },
    staleTime: 30_000,
  });

  const allDrafts = data?.data ?? [];

  // Compute available platforms
  const allPlatforms = Array.from(
    new Set(
      allDrafts.flatMap((p) =>
        p.accounts.map((a) => a.socialAccount.platform)
      )
    )
  ).sort();

  // Filter by platform
  const filtered =
    platformFilter === "all"
      ? allDrafts
      : allDrafts.filter((p) =>
          p.accounts.some((a) => a.socialAccount.platform === platformFilter)
        );

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    const da = new Date(a.createdAt).getTime();
    const db = new Date(b.createdAt).getTime();
    return sort === "newest" ? db - da : da - db;
  });

  // ─── Delete mutation ─────────────────────────────────────────────────────

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/posts/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to delete draft");
      }
    },
    onSuccess: (_, id) => {
      queryClient.setQueryData(
        ["drafts", workspaceId, sort],
        (prev: { data: PostWithRelations[]; meta: { total: number } } | undefined) => {
          if (!prev) return prev;
          return {
            data: prev.data.filter((p) => p.id !== id),
            meta: { total: prev.meta.total - 1 },
          };
        }
      );
      setDeleteTarget(null);
    },
  });

  // ─── Render ──────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Drafts</h1>
        {sorted.length > 0 && (
          <Badge variant="secondary" className="text-sm font-medium px-2.5 py-0.5">
            {allDrafts.length}
          </Badge>
        )}
      </div>

      {/* Toolbar */}
      {allDrafts.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          {/* Sort */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                {SORT_LABELS[sort]}
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {(Object.keys(SORT_LABELS) as SortOption[]).map((s) => (
                <DropdownMenuItem
                  key={s}
                  onClick={() => setSort(s)}
                  className={cn(sort === s && "font-medium")}
                >
                  {SORT_LABELS[s]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Platform filter */}
          {allPlatforms.length > 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Filter className="h-3.5 w-3.5" />
                  {platformFilter === "all"
                    ? "All platforms"
                    : PLATFORM_LABELS[platformFilter] ?? platformFilter}
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem
                  onClick={() => setPlatformFilter("all")}
                  className={cn(platformFilter === "all" && "font-medium")}
                >
                  All platforms
                </DropdownMenuItem>
                {allPlatforms.map((p) => (
                  <DropdownMenuItem
                    key={p}
                    onClick={() => setPlatformFilter(p)}
                    className={cn(platformFilter === p && "font-medium")}
                  >
                    <span
                      className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold text-white mr-2"
                      style={{ backgroundColor: PLATFORM_COLORS[p] ?? "#888" }}
                    >
                      {p[0]}
                    </span>
                    {PLATFORM_LABELS[p] ?? p}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <span className="text-xs text-muted-foreground ml-auto">
            Showing {sorted.length} of {allDrafts.length}
          </span>
        </div>
      )}

      {/* Empty state */}
      {allDrafts.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-16 text-center">
          <FileText className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="font-medium text-muted-foreground">No drafts yet</p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Posts saved as drafts will appear here.
          </p>
          <Button className="mt-4" asChild>
            <Link href="/compose">Create a post</Link>
          </Button>
        </div>
      )}

      {/* No results after filter */}
      {allDrafts.length > 0 && sorted.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-muted-foreground text-sm">
            No drafts match the selected filter.
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={() => setPlatformFilter("all")}
          >
            Clear filter
          </Button>
        </div>
      )}

      {/* Table */}
      {sorted.length > 0 && (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground w-[100px]">
                  Platform(s)
                </th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                  Content
                </th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground w-[140px]">
                  Created
                </th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground w-[100px]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sorted.map((post) => {
                const platforms = Array.from(
                  new Set(
                    post.accounts.map((a) => a.socialAccount.platform)
                  )
                );

                return (
                  <tr
                    key={post.id}
                    className={cn(
                      "hover:bg-muted/30 transition-colors",
                      deleteMutation.isPending &&
                        deleteMutation.variables === post.id &&
                        "opacity-50"
                    )}
                  >
                    {/* Platforms */}
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {platforms.length > 0 ? (
                          platforms.map((p) => (
                            <PlatformDot key={p} platform={p} />
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </td>

                    {/* Content */}
                    <td className="px-4 py-3">
                      <p className="text-sm line-clamp-2 text-foreground">
                        {truncate(post.content, 150)}
                      </p>
                      {post.labels.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {post.labels.map((label) => (
                            <span
                              key={label.id}
                              className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                              style={{ backgroundColor: label.color }}
                            >
                              {label.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>

                    {/* Created */}
                    <td className="px-4 py-3">
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(post.createdAt), "MMM d, yyyy")}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          asChild
                          title="Edit draft"
                        >
                          <Link href={`/compose?postId=${post.id}`}>
                            <Pencil className="h-3.5 w-3.5" />
                            <span className="sr-only">Edit</span>
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          title="Delete draft"
                          onClick={() => setDeleteTarget(post)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span className="sr-only">Delete</span>
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete dialog */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this draft?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The draft will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
              }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Delete draft
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
