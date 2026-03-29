"use client";

import { useState, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis, restrictToWindowEdges } from "@dnd-kit/modifiers";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";
import { QueueItem, QueuePost } from "./queue-item";
import { Inbox } from "lucide-react";

// Queue time slots type (mirror QueueSchedule from queue-settings)
type DaySchedule = { enabled: boolean; slots: Array<{ id: string; time: string }> };
type QueueSchedule = Record<string, DaySchedule>;

const DAY_INDEX: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

/**
 * Given the queue schedule and starting from now, compute the next N publish times.
 */
function getNextPublishTimes(schedule: QueueSchedule, count: number): Date[] {
  const results: Date[] = [];
  const now = new Date();
  const cursor = new Date(now);
  cursor.setSeconds(0, 0);

  let attempts = 0;
  while (results.length < count && attempts < 5000) {
    attempts++;
    const dayOfWeek = cursor.getDay(); // 0=sun
    const dayKey = Object.keys(DAY_INDEX).find(
      (k) => DAY_INDEX[k] === dayOfWeek
    );

    if (dayKey) {
      const day = schedule[dayKey];
      if (day?.enabled) {
        const sortedSlots = [...day.slots].sort((a, b) =>
          a.time.localeCompare(b.time)
        );
        for (const slot of sortedSlots) {
          const [hStr, mStr] = slot.time.split(":");
          const candidate = new Date(cursor);
          candidate.setHours(Number(hStr), Number(mStr), 0, 0);
          if (candidate > now) {
            results.push(new Date(candidate));
            if (results.length === count) break;
          }
        }
      }
    }

    // Advance to next day
    cursor.setDate(cursor.getDate() + 1);
    cursor.setHours(0, 0, 0, 0);
  }

  return results;
}

interface QueueListProps {
  posts: QueuePost[];
  workspaceId: string;
  schedule: QueueSchedule | null;
  onEditPost: (id: string) => void;
}

export function QueueList({
  posts: initialPosts,
  workspaceId,
  schedule,
  onEditPost,
}: QueueListProps) {
  const [posts, setPosts] = useState<QueuePost[]>(initialPosts);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Keep local state in sync if parent data changes (e.g. after refetch)
  // We only reset when the IDs differ to avoid fighting with optimistic update
  const postIds = initialPosts.map((p) => p.id).join(",");
  const localIds = posts.map((p) => p.id).join(",");
  if (postIds !== localIds) {
    setPosts(initialPosts);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const reorderMutation = useMutation({
    mutationFn: async (orderedPostIds: string[]) => {
      const res = await fetch("/api/posts/queue", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedPostIds, workspaceId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to reorder queue");
      }
    },
    onError: (error) => {
      toast({
        title: "Reorder failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
      // Rollback to server state
      queryClient.invalidateQueries({ queryKey: ["queue", workspaceId] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (postId: string) => {
      const res = await fetch(`/api/posts/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queuePosition: null, status: "DRAFT" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to remove post");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["queue", workspaceId] });
    },
    onError: (error) => {
      toast({
        title: "Failed to remove post",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      setPosts((currentPosts) => {
        const oldIndex = currentPosts.findIndex((p) => p.id === active.id);
        const newIndex = currentPosts.findIndex((p) => p.id === over.id);
        const reordered = arrayMove(currentPosts, oldIndex, newIndex);
        // Fire PATCH in background
        reorderMutation.mutate(reordered.map((p) => p.id));
        return reordered;
      });
    },
    [reorderMutation]
  );

  const handleRemove = useCallback(
    (postId: string) => {
      // Optimistic UI remove
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      removeMutation.mutate(postId);
    },
    [removeMutation]
  );

  // Compute next publish times for each slot
  const publishTimes =
    schedule ? getNextPublishTimes(schedule, posts.length) : [];

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
        <Inbox className="h-12 w-12 text-muted-foreground/40" />
        <p className="text-base font-medium text-muted-foreground">
          Your queue is empty
        </p>
        <p className="text-sm text-muted-foreground max-w-xs">
          Add posts to your queue when composing to fill your schedule
          automatically.
        </p>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToWindowEdges]}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={posts.map((p) => p.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-2">
          {posts.map((post, index) => (
            <QueueItem
              key={post.id}
              post={post}
              nextPublishAt={publishTimes[index] ?? null}
              onEdit={onEditPost}
              onRemove={handleRemove}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
