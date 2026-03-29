"use client";

import { useState } from "react";
import { DayPicker } from "react-day-picker";
import { format } from "date-fns";
import { CalendarIcon, ClockIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import "react-day-picker/style.css";

export type ScheduleMode = "now" | "queue" | "schedule";

interface SchedulePickerProps {
  mode: ScheduleMode;
  scheduledAt: Date | null;
  timezone: string;
  onModeChange: (mode: ScheduleMode) => void;
  onScheduledAtChange: (date: Date | null) => void;
}

function padTwo(n: number) {
  return String(n).padStart(2, "0");
}

export function SchedulePicker({
  mode,
  scheduledAt,
  timezone,
  onModeChange,
  onScheduledAtChange,
}: SchedulePickerProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Date | undefined>(
    scheduledAt ?? undefined
  );
  const [hour, setHour] = useState<number>(scheduledAt?.getHours() ?? 9);
  const [minute, setMinute] = useState<number>(scheduledAt?.getMinutes() ?? 0);

  function handleDaySelect(day: Date | undefined) {
    setSelectedDay(day);
    if (day) {
      const d = new Date(day);
      d.setHours(hour, minute, 0, 0);
      onScheduledAtChange(d);
    } else {
      onScheduledAtChange(null);
    }
  }

  function handleTimeChange(newHour: number, newMinute: number) {
    setHour(newHour);
    setMinute(newMinute);
    if (selectedDay) {
      const d = new Date(selectedDay);
      d.setHours(newHour, newMinute, 0, 0);
      onScheduledAtChange(d);
    }
  }

  const options: { value: ScheduleMode; label: string; description: string }[] = [
    { value: "now", label: "Publish Now", description: "Post immediately to all selected accounts" },
    { value: "queue", label: "Add to Queue", description: "Add to your posting queue" },
    { value: "schedule", label: "Schedule for Later", description: "Pick a specific date and time" },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onModeChange(opt.value)}
            className={cn(
              "flex flex-col items-start px-3 py-2 rounded-lg border text-left transition-all text-sm",
              mode === opt.value
                ? "border-primary bg-primary/5 text-primary"
                : "border-border bg-background text-muted-foreground hover:border-border/80 hover:text-foreground"
            )}
          >
            <span className="font-medium">{opt.label}</span>
            <span className="text-xs mt-0.5 opacity-75 leading-tight">{opt.description}</span>
          </button>
        ))}
      </div>

      {mode === "schedule" && (
        <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
          {/* Date picker trigger */}
          <button
            type="button"
            onClick={() => setCalendarOpen((o) => !o)}
            className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-md border bg-background hover:bg-muted/50 transition-colors text-sm"
          >
            <CalendarIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className={selectedDay ? "text-foreground" : "text-muted-foreground"}>
              {selectedDay ? format(selectedDay, "EEEE, MMMM d, yyyy") : "Pick a date"}
            </span>
          </button>

          {calendarOpen && (
            <div className="rounded-lg border bg-background shadow-md p-2">
              <DayPicker
                mode="single"
                selected={selectedDay}
                onSelect={(day) => {
                  handleDaySelect(day);
                  setCalendarOpen(false);
                }}
                disabled={{ before: new Date() }}
                classNames={{
                  root: "text-sm",
                }}
              />
            </div>
          )}

          {/* Time picker */}
          <div className="flex items-center gap-2">
            <ClockIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <div className="flex items-center gap-1">
              <select
                value={padTwo(hour)}
                onChange={(e) => handleTimeChange(parseInt(e.target.value), minute)}
                className="px-2 py-1 rounded-md border bg-background text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={padTwo(i)}>
                    {padTwo(i)}
                  </option>
                ))}
              </select>
              <span className="text-muted-foreground font-medium">:</span>
              <select
                value={padTwo(minute)}
                onChange={(e) => handleTimeChange(hour, parseInt(e.target.value))}
                className="px-2 py-1 rounded-md border bg-background text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {[0, 15, 30, 45].map((m) => (
                  <option key={m} value={padTwo(m)}>
                    {padTwo(m)}
                  </option>
                ))}
              </select>
            </div>
            <span className="text-xs text-muted-foreground ml-1">{timezone}</span>
          </div>

          {scheduledAt && selectedDay && (
            <p className="text-xs text-muted-foreground">
              Scheduled for{" "}
              <span className="font-medium text-foreground">
                {format(scheduledAt, "EEEE, MMMM d, yyyy 'at' h:mm a")}
              </span>{" "}
              ({timezone})
            </p>
          )}
        </div>
      )}
    </div>
  );
}
