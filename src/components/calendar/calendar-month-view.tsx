"use client";

import { useState } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  format,
} from "date-fns";
import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";
import { CalendarPostCardPill, PostDetailPanel, type CalendarPost } from "./calendar-post-card";
import { DraggablePostPill } from "./calendar-week-view";

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_VISIBLE_PILLS = 3;

interface CalendarMonthViewProps {
  currentDate: Date;
  posts: CalendarPost[];
  onNewPost?: (date: Date) => void;
  onEditPost?: (post: CalendarPost) => void;
  onDeletePost?: (postId: string) => void;
}

interface DroppableDayCellProps {
  date: Date;
  posts: CalendarPost[];
  isCurrentMonth: boolean;
  onNewPost?: (date: Date) => void;
  onEditPost?: (post: CalendarPost) => void;
  onDeletePost?: (postId: string) => void;
}

function DroppableDayCell({
  date,
  posts,
  isCurrentMonth,
  onNewPost,
  onEditPost,
  onDeletePost,
}: DroppableDayCellProps) {
  const [expanded, setExpanded] = useState(false);
  const [selectedPost, setSelectedPost] = useState<CalendarPost | null>(null);

  const { setNodeRef, isOver } = useDroppable({
    id: `day-${format(date, "yyyy-MM-dd")}`,
    data: { date },
  });

  const visiblePosts = expanded ? posts : posts.slice(0, MAX_VISIBLE_PILLS);
  const hiddenCount = posts.length - MAX_VISIBLE_PILLS;
  const today = isToday(date);

  return (
    <>
      <div
        ref={setNodeRef}
        className={cn(
          "min-h-[120px] p-1.5 border-b border-r relative group transition-colors",
          !isCurrentMonth && "bg-muted/30",
          isOver && "bg-primary/5 ring-inset ring-1 ring-primary/30",
          today && "bg-accent/20"
        )}
      >
        {/* Day number */}
        <div className="flex items-start justify-between mb-1">
          <span
            className={cn(
              "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full",
              today
                ? "bg-primary text-primary-foreground"
                : !isCurrentMonth
                ? "text-muted-foreground/50"
                : "text-foreground"
            )}
          >
            {format(date, "d")}
          </span>
          {/* + button on hover */}
          <button
            onClick={() => onNewPost?.(date)}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted"
            aria-label={`New post for ${format(date, "MMM d")}`}
          >
            <Plus className="h-3 w-3 text-muted-foreground" />
          </button>
        </div>

        {/* Post pills */}
        <div className="space-y-0.5">
          {visiblePosts.map((post) => (
            <DraggablePostPill key={post.id} post={post}>
              <CalendarPostCardPill
                post={post}
                onClick={() => setSelectedPost(post)}
              />
            </DraggablePostPill>
          ))}

          {!expanded && hiddenCount > 0 && (
            <button
              onClick={() => setExpanded(true)}
              className="text-[10px] text-muted-foreground hover:text-foreground pl-1.5 transition-colors"
            >
              +{hiddenCount} more
            </button>
          )}
          {expanded && hiddenCount > 0 && (
            <button
              onClick={() => setExpanded(false)}
              className="text-[10px] text-muted-foreground hover:text-foreground pl-1.5 transition-colors"
            >
              Show less
            </button>
          )}
        </div>
      </div>

      {/* Post detail panel */}
      {selectedPost && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20"
            onClick={() => setSelectedPost(null)}
          />
          <PostDetailPanel
            post={selectedPost}
            onClose={() => setSelectedPost(null)}
            onEdit={onEditPost}
            onDelete={onDeletePost}
          />
        </>
      )}
    </>
  );
}

export function CalendarMonthView({
  currentDate,
  posts,
  onNewPost,
  onEditPost,
  onDeletePost,
}: CalendarMonthViewProps) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  // Group posts by day
  const postsByDay = new Map<string, CalendarPost[]>();
  for (const post of posts) {
    if (!post.scheduledAt) continue;
    const key = format(new Date(post.scheduledAt), "yyyy-MM-dd");
    if (!postsByDay.has(key)) postsByDay.set(key, []);
    postsByDay.get(key)!.push(post);
  }

  return (
    <div className="flex-1 overflow-auto">
      {/* Day of week headers */}
      <div className="grid grid-cols-7 border-b sticky top-0 bg-background z-10">
        {DAYS_OF_WEEK.map((day) => (
          <div
            key={day}
            className="py-2 text-center text-xs font-medium text-muted-foreground uppercase tracking-wide border-r last:border-r-0"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayPosts = postsByDay.get(key) ?? [];
          return (
            <DroppableDayCell
              key={key}
              date={day}
              posts={dayPosts}
              isCurrentMonth={isSameMonth(day, currentDate)}
              onNewPost={onNewPost}
              onEditPost={onEditPost}
              onDeletePost={onDeletePost}
            />
          );
        })}
      </div>
    </div>
  );
}
