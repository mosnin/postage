"use client";

import { useCallback, useState } from "react";
import { useQueryState, parseAsString, parseAsArrayOf } from "nuqs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  startOfDay,
  endOfDay,
  format,
  parseISO,
} from "date-fns";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import { restrictToWindowEdges } from "@dnd-kit/modifiers";
import { CalendarToolbar } from "./calendar-toolbar";
import { CalendarMonthView } from "./calendar-month-view";
import { CalendarWeekView } from "./calendar-week-view";
import { CalendarPostCardPill, type CalendarPost } from "./calendar-post-card";
import type { SocialAccount, Label } from "@prisma/client";

type CalendarView = "month" | "week" | "day";

interface ContentCalendarProps {
  workspaceId: string;
  socialAccounts: SocialAccount[];
  labels: Label[];
  initialDate?: string;
}

async function fetchCalendarPosts(
  workspaceId: string,
  start: Date,
  end: Date
): Promise<CalendarPost[]> {
  const params = new URLSearchParams({
    workspaceId,
    start: start.toISOString(),
    end: end.toISOString(),
  });
  const res = await fetch(`/api/posts/calendar?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch calendar posts");
  const data = await res.json();
  return data.posts as CalendarPost[];
}

async function reschedulePost(postId: string, scheduledAt: Date): Promise<void> {
  const res = await fetch(`/api/posts/${postId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scheduledAt: scheduledAt.toISOString() }),
  });
  if (!res.ok) throw new Error("Failed to reschedule post");
}

function getDateRange(view: CalendarView, date: Date): { start: Date; end: Date } {
  if (view === "month") {
    const monthStart = startOfMonth(date);
    const monthEnd = endOfMonth(date);
    return {
      start: startOfWeek(monthStart, { weekStartsOn: 0 }),
      end: endOfWeek(monthEnd, { weekStartsOn: 0 }),
    };
  } else if (view === "week") {
    return {
      start: startOfWeek(date, { weekStartsOn: 0 }),
      end: endOfWeek(date, { weekStartsOn: 0 }),
    };
  } else {
    return {
      start: startOfDay(date),
      end: endOfDay(date),
    };
  }
}

export function ContentCalendar({
  workspaceId,
  socialAccounts,
  labels,
  initialDate,
}: ContentCalendarProps) {
  const queryClient = useQueryClient();

  // URL state
  const [viewParam, setViewParam] = useQueryState(
    "view",
    parseAsString.withDefault("month")
  );
  const [dateParam, setDateParam] = useQueryState(
    "date",
    parseAsString.withDefault(format(new Date(), "yyyy-MM-dd"))
  );
  const [platformsParam, setPlatformsParam] = useQueryState(
    "platforms",
    parseAsArrayOf(parseAsString).withDefault([])
  );
  const [statusesParam, setStatusesParam] = useQueryState(
    "statuses",
    parseAsArrayOf(parseAsString).withDefault([])
  );
  const [labelIdsParam, setLabelIdsParam] = useQueryState(
    "labels",
    parseAsArrayOf(parseAsString).withDefault([])
  );

  const view = (viewParam as CalendarView) || "month";
  const currentDate = (() => {
    try {
      return parseISO(dateParam);
    } catch {
      return new Date();
    }
  })();

  const { start, end } = getDateRange(view, currentDate);

  // Fetch posts
  const { data: allPosts = [], isLoading } = useQuery({
    queryKey: ["calendar-posts", workspaceId, start.toISOString(), end.toISOString()],
    queryFn: () => fetchCalendarPosts(workspaceId, start, end),
  });

  // Filter posts
  const posts = allPosts.filter((post) => {
    if (platformsParam.length > 0) {
      const postPlatforms = post.accounts.map((a) => a.socialAccount.platform);
      if (!platformsParam.some((p) => postPlatforms.includes(p as any))) return false;
    }
    if (statusesParam.length > 0) {
      if (!statusesParam.includes(post.status)) return false;
    }
    if (labelIdsParam.length > 0) {
      const postLabelIds = post.labels.map((pl) => pl.labelId);
      if (!labelIdsParam.some((id) => postLabelIds.includes(id))) return false;
    }
    return true;
  });

  // Reschedule mutation with optimistic update
  const rescheduleMutation = useMutation({
    mutationFn: ({ postId, scheduledAt }: { postId: string; scheduledAt: Date }) =>
      reschedulePost(postId, scheduledAt),
    onMutate: async ({ postId, scheduledAt }: { postId: string; scheduledAt: Date }) => {
      const queryKey = ["calendar-posts", workspaceId, start.toISOString(), end.toISOString()];
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<CalendarPost[]>(queryKey);
      queryClient.setQueryData<CalendarPost[]>(queryKey, (old) =>
        old?.map((p) =>
          p.id === postId ? { ...p, scheduledAt } : p
        ) ?? []
      );
      return { previous, queryKey };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(context.queryKey, context.previous);
      }
    },
    onSettled: (_data, _err, _vars, context) => {
      if (context?.queryKey) {
        queryClient.invalidateQueries({ queryKey: context.queryKey });
      }
    },
  });

  // Drag state
  const [activePost, setActivePost] = useState<CalendarPost | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragStart = useCallback(
    (event: any) => {
      const post = event.active?.data?.current?.post as CalendarPost | undefined;
      if (post) setActivePost(post);
    },
    []
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActivePost(null);
      const { active, over } = event;
      if (!over) return;

      const post = active.data.current?.post as CalendarPost | undefined;
      const targetDate = over.data.current?.date as Date | undefined;

      if (!post || !targetDate) return;

      let newScheduledAt: Date;
      if (post.scheduledAt) {
        const original = new Date(post.scheduledAt);
        newScheduledAt = new Date(targetDate);
        newScheduledAt.setHours(original.getHours(), original.getMinutes(), 0, 0);
      } else {
        newScheduledAt = new Date(targetDate);
        newScheduledAt.setHours(9, 0, 0, 0);
      }

      rescheduleMutation.mutate({ postId: post.id, scheduledAt: newScheduledAt });
    },
    [rescheduleMutation]
  );

  const handleNewPost = useCallback((date?: Date) => {
    const params = new URLSearchParams();
    if (date) params.set("scheduledAt", date.toISOString());
    window.location.href = `/compose?${params.toString()}`;
  }, []);

  const handleEditPost = useCallback((post: CalendarPost) => {
    window.location.href = `/compose?postId=${post.id}`;
  }, []);

  const handleDeletePost = useCallback(
    async (postId: string) => {
      if (!confirm("Delete this post?")) return;
      const res = await fetch(`/api/posts/${postId}`, { method: "DELETE" });
      if (res.ok) {
        queryClient.invalidateQueries({
          queryKey: ["calendar-posts", workspaceId],
        });
      }
    },
    [queryClient, workspaceId]
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      modifiers={[restrictToWindowEdges]}
    >
      <div className="flex flex-col h-full bg-background">
        <CalendarToolbar
          view={view}
          date={currentDate}
          onViewChange={(v) => setViewParam(v)}
          onDateChange={(d) => setDateParam(format(d, "yyyy-MM-dd"))}
          platforms={platformsParam}
          onPlatformsChange={setPlatformsParam}
          statuses={statusesParam}
          onStatusesChange={setStatusesParam}
          labelIds={labelIdsParam}
          onLabelIdsChange={setLabelIdsParam}
          socialAccounts={socialAccounts}
          labels={labels}
          onNewPost={handleNewPost}
        />

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <div className="h-6 w-6 border-2 border-current border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Loading posts…</span>
            </div>
          </div>
        ) : view === "month" ? (
          <CalendarMonthView
            currentDate={currentDate}
            posts={posts}
            onNewPost={handleNewPost}
            onEditPost={handleEditPost}
            onDeletePost={handleDeletePost}
          />
        ) : (
          <CalendarWeekView
            currentDate={currentDate}
            posts={posts}
            onNewPost={handleNewPost}
            onEditPost={handleEditPost}
            onDeletePost={handleDeletePost}
          />
        )}
      </div>

      {/* Drag overlay */}
      <DragOverlay modifiers={[restrictToWindowEdges]}>
        {activePost && (
          <div className="w-48 shadow-xl rotate-2 opacity-90">
            <CalendarPostCardPill post={activePost} isDragging />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
