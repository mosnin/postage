"use client";

import React, { useState, useRef } from "react";
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isToday,
  differenceInMinutes,
  startOfDay,
} from "date-fns";
import {
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { CalendarPostCardWeek, PostDetailPanel, type CalendarPost } from "./calendar-post-card";

const HOUR_HEIGHT = 60; // px per hour
const TOTAL_HOURS = 24;

interface CalendarWeekViewProps {
  currentDate: Date;
  posts: CalendarPost[];
  onNewPost?: (date: Date) => void;
  onEditPost?: (post: CalendarPost) => void;
  onDeletePost?: (postId: string) => void;
}

export function DraggablePostPill({
  post,
  children,
}: {
  post: CalendarPost;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `post-${post.id}`,
    data: { post },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn("touch-none", isDragging && "opacity-40")}
    >
      {children}
    </div>
  );
}

function DroppableTimeSlot({
  date,
  hour,
  children,
}: {
  date: Date;
  hour: number;
  children?: React.ReactNode;
}) {
  const slotDate = new Date(date);
  slotDate.setHours(hour, 0, 0, 0);

  const { setNodeRef, isOver } = useDroppable({
    id: `slot-${format(date, "yyyy-MM-dd")}-${hour}`,
    data: { date: slotDate },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "relative",
        isOver && "bg-primary/5"
      )}
      style={{ height: HOUR_HEIGHT }}
    >
      {children}
    </div>
  );
}

function PostBlock({
  post,
  dayStart,
  onClick,
}: {
  post: CalendarPost;
  dayStart: Date;
  onClick: () => void;
}) {
  if (!post.scheduledAt) return null;

  const scheduledAt = new Date(post.scheduledAt);
  const minutesFromStart = differenceInMinutes(scheduledAt, dayStart);
  const top = (minutesFromStart / 60) * HOUR_HEIGHT;
  const height = Math.max(HOUR_HEIGHT * 0.75, 40); // 45 min default height

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `post-${post.id}`,
    data: { post },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "absolute left-0.5 right-0.5 z-10 touch-none",
        isDragging && "opacity-40 z-50"
      )}
      style={{ top, height }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <CalendarPostCardWeek post={post} isDragging={isDragging} />
    </div>
  );
}

export function CalendarWeekView({
  currentDate,
  posts,
  onNewPost,
  onEditPost,
  onDeletePost,
}: CalendarWeekViewProps) {
  const [selectedPost, setSelectedPost] = useState<CalendarPost | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const hours = Array.from({ length: TOTAL_HOURS }, (_, i) => i);

  // Group posts by day
  const postsByDay = new Map<string, CalendarPost[]>();
  for (const post of posts) {
    if (!post.scheduledAt) continue;
    const key = format(new Date(post.scheduledAt), "yyyy-MM-dd");
    if (!postsByDay.has(key)) postsByDay.set(key, []);
    postsByDay.get(key)!.push(post);
  }

  const handleColumnClick = (e: React.MouseEvent<HTMLDivElement>, day: Date) => {
    if (!onNewPost) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const hours = Math.floor(y / HOUR_HEIGHT);
    const minutes = Math.round(((y % HOUR_HEIGHT) / HOUR_HEIGHT) * 60 / 30) * 30;
    const clickedDate = new Date(day);
    clickedDate.setHours(hours, minutes, 0, 0);
    onNewPost(clickedDate);
  };

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* Day headers */}
      <div className="flex border-b bg-background sticky top-0 z-20">
        {/* Time gutter */}
        <div className="w-14 flex-shrink-0 border-r" />
        {/* Day columns */}
        {days.map((day) => (
          <div
            key={format(day, "yyyy-MM-dd")}
            className={cn(
              "flex-1 py-2 text-center border-r last:border-r-0",
              isToday(day) && "bg-accent/20"
            )}
          >
            <div className={cn(
              "text-xs font-medium uppercase tracking-wide",
              isToday(day) ? "text-primary" : "text-muted-foreground"
            )}>
              {format(day, "EEE")}
            </div>
            <div className={cn(
              "text-lg font-semibold mt-0.5",
              isToday(day) && "text-primary"
            )}>
              {format(day, "d")}
            </div>
          </div>
        ))}
      </div>

      {/* Scrollable time grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="flex">
          {/* Time labels */}
          <div className="w-14 flex-shrink-0 border-r">
            {hours.map((hour) => (
              <div
                key={hour}
                className="text-[10px] text-muted-foreground text-right pr-2 -translate-y-2"
                style={{ height: HOUR_HEIGHT }}
              >
                {hour === 0 ? "" : format(new Date(2000, 0, 1, hour), "h a")}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day) => {
            const dayKey = format(day, "yyyy-MM-dd");
            const dayPosts = postsByDay.get(dayKey) ?? [];
            const dayStart = startOfDay(day);

            return (
              <div
                key={dayKey}
                className={cn(
                  "flex-1 border-r last:border-r-0 relative",
                  isToday(day) && "bg-accent/5"
                )}
                onClick={(e) => handleColumnClick(e, day)}
              >
                {/* Hour lines */}
                {hours.map((hour) => (
                  <DroppableTimeSlot key={hour} date={day} hour={hour}>
                    <div className="absolute inset-x-0 top-0 border-t border-border/40" />
                    {/* Half-hour line */}
                    <div
                      className="absolute inset-x-0 border-t border-border/20 border-dashed"
                      style={{ top: HOUR_HEIGHT / 2 }}
                    />
                  </DroppableTimeSlot>
                ))}

                {/* Posts */}
                <div className="absolute inset-0 pointer-events-none">
                  <div className="relative h-full pointer-events-auto">
                    {dayPosts.map((post) => (
                      <PostBlock
                        key={post.id}
                        post={post}
                        dayStart={dayStart}
                        onClick={() => setSelectedPost(post)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
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
    </div>
  );
}
