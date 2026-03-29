"use client";

import { useEffect, useRef } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import { Loader2, MessageSquare } from "lucide-react";
import { CommentItem, type CommentWithReplies } from "./comment-item";
import { cn } from "@/lib/utils";

interface FetchInboxParams {
  workspaceId: string;
  status: string;
  platform: string;
  accountId: string;
  search: string;
  pageParam: number;
}

interface InboxPage {
  comments: CommentWithReplies[];
  total: number;
  hasNext: boolean;
  plan: string;
}

async function fetchInbox({
  workspaceId,
  status,
  platform,
  accountId,
  search,
  pageParam,
}: FetchInboxParams): Promise<InboxPage> {
  const params = new URLSearchParams({ workspaceId, page: String(pageParam), pageSize: "20" });
  if (status) params.set("status", status);
  if (platform) params.set("platform", platform);
  if (accountId) params.set("accountId", accountId);
  if (search) params.set("search", search);

  const res = await fetch(`/api/inbox?${params.toString()}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Failed to load inbox");
  }
  return res.json();
}

interface InboxFeedProps {
  workspaceId: string;
}

export function InboxFeed({ workspaceId }: InboxFeedProps) {
  const [status] = useQueryState("status", { defaultValue: "" });
  const [platform] = useQueryState("platform", { defaultValue: "" });
  const [accountId] = useQueryState("accountId", { defaultValue: "" });
  const [search] = useQueryState("search", { defaultValue: "" });

  const sentinelRef = useRef<HTMLDivElement>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError, error } =
    useInfiniteQuery({
      queryKey: ["inbox", workspaceId, status, platform, accountId, search],
      queryFn: ({ pageParam }) =>
        fetchInbox({ workspaceId, status, platform, accountId, search, pageParam }),
      initialPageParam: 1,
      getNextPageParam: (lastPage, allPages) =>
        lastPage.hasNext ? allPages.length + 1 : undefined,
    });

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const isPro =
    data?.pages[0]?.plan === "PRO" || data?.pages[0]?.plan === "PRO_PLUS";

  const allComments = data?.pages.flatMap((p) => p.comments) ?? [];
  const total = data?.pages[0]?.total ?? 0;

  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto">
        {Array.from({ length: 5 }).map((_, i) => (
          <CommentSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex-1 flex items-center justify-center text-destructive text-sm p-8">
        {(error as Error).message ?? "Failed to load comments"}
      </div>
    );
  }

  if (allComments.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
        <MessageSquare className="size-10 text-muted-foreground/40" />
        <div>
          <p className="font-medium text-sm">No comments found</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {status || platform || search
              ? "Try adjusting your filters"
              : "Comments from your connected accounts will appear here"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Total count header */}
      <div className="px-5 py-2.5 border-b bg-muted/30 sticky top-0 z-10 backdrop-blur">
        <p className="text-xs text-muted-foreground">
          {total.toLocaleString()} {total === 1 ? "comment" : "comments"}
        </p>
      </div>

      {allComments.map((comment) => (
        <CommentItem key={comment.id} comment={comment} isPro={isPro} />
      ))}

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} className="h-4" />

      {isFetchingNextPage && (
        <div className="flex justify-center py-4">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </div>
      )}

      {!hasNextPage && allComments.length > 0 && (
        <p className="text-center text-xs text-muted-foreground py-4">
          All comments loaded
        </p>
      )}
    </div>
  );
}

function CommentSkeleton() {
  return (
    <div className="border-b px-5 py-4 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="size-9 rounded-full bg-muted flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-3 w-24 bg-muted rounded" />
            <div className="h-3 w-16 bg-muted rounded" />
          </div>
          <div className="h-3 w-full bg-muted rounded" />
          <div className="h-3 w-3/4 bg-muted rounded" />
          <div className="flex gap-2 mt-1">
            <div className="h-6 w-14 bg-muted rounded" />
            <div className="h-6 w-14 bg-muted rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}
