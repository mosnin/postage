"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { PauseCircle, PlayCircle, Settings2, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { QueueList } from "./queue-list";
import { QueueSettingsPanel, QueueSchedule } from "./queue-settings";
import type { QueuePost } from "./queue-item";
import { useToast } from "@/components/ui/use-toast";

interface QueueManagerProps {
  workspaceId: string;
  initialPosts: QueuePost[];
  timezone: string;
}

const SCHEDULE_STORAGE_KEY = "postsyncer_queue_schedule";
const PAUSED_STORAGE_KEY = "postsyncer_queue_paused";

function loadSchedule(): QueueSchedule | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SCHEDULE_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as QueueSchedule) : null;
  } catch {
    return null;
  }
}

function saveSchedule(schedule: QueueSchedule): void {
  localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify(schedule));
}

export function QueueManager({
  workspaceId,
  initialPosts,
  timezone,
}: QueueManagerProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isPaused, setIsPaused] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(PAUSED_STORAGE_KEY) === "true";
  });
  const [schedule, setSchedule] = useState<QueueSchedule | null>(loadSchedule);

  const { data, isLoading } = useQuery<{ posts: QueuePost[] }>({
    queryKey: ["queue", workspaceId],
    queryFn: async () => {
      const res = await fetch(
        `/api/posts/queue?workspaceId=${encodeURIComponent(workspaceId)}`
      );
      if (!res.ok) throw new Error("Failed to fetch queue");
      return res.json();
    },
    initialData: { posts: initialPosts },
    staleTime: 30_000,
  });

  const posts = data?.posts ?? [];

  function togglePause() {
    const next = !isPaused;
    setIsPaused(next);
    localStorage.setItem(PAUSED_STORAGE_KEY, String(next));
    toast({
      title: next ? "Queue paused" : "Queue resumed",
      description: next
        ? "Posts will not be published until you resume."
        : "Posts will be published on schedule.",
    });
  }

  async function handleSaveSchedule(newSchedule: QueueSchedule) {
    saveSchedule(newSchedule);
    setSchedule(newSchedule);
  }

  function handleEditPost(id: string) {
    router.push(`/compose/${id}`);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {posts.length} post{posts.length !== 1 ? "s" : ""} in queue
            {isPaused && (
              <span className="ml-2 text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                Paused
              </span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings2 className="h-4 w-4" />
            Configure Times
          </Button>

          <Button
            variant={isPaused ? "default" : "outline"}
            size="sm"
            className="gap-2"
            onClick={togglePause}
          >
            {isPaused ? (
              <>
                <PlayCircle className="h-4 w-4" />
                Resume Queue
              </>
            ) : (
              <>
                <PauseCircle className="h-4 w-4" />
                Pause Queue
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Queue list */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <QueueList
            posts={posts}
            workspaceId={workspaceId}
            schedule={schedule}
            onEditPost={handleEditPost}
          />
        )}
      </div>

      {/* Settings panel */}
      <QueueSettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        initialSchedule={schedule ?? undefined}
        onSave={handleSaveSchedule}
      />
    </div>
  );
}
