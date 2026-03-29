"use client";

import React from "react";
import { useQueryState } from "nuqs";
import { format, addMonths, subMonths, addWeeks, subWeeks, startOfToday } from "date-fns";
import { ChevronLeft, ChevronRight, Plus, CalendarDays, LayoutGrid, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { PLATFORM_LABELS } from "@/lib/utils";
import type { SocialAccount, Label } from "@prisma/client";

type CalendarView = "month" | "week" | "day";

interface CalendarToolbarProps {
  view: CalendarView;
  date: Date;
  onViewChange: (view: CalendarView) => void;
  onDateChange: (date: Date) => void;
  platforms: string[];
  onPlatformsChange: (platforms: string[]) => void;
  statuses: string[];
  onStatusesChange: (statuses: string[]) => void;
  labelIds: string[];
  onLabelIdsChange: (ids: string[]) => void;
  socialAccounts: SocialAccount[];
  labels: Label[];
  onNewPost?: (date?: Date) => void;
}

const VIEW_OPTIONS: { value: CalendarView; label: string; icon: React.ReactNode }[] = [
  { value: "month", label: "Month", icon: <LayoutGrid className="h-3.5 w-3.5" /> },
  { value: "week", label: "Week", icon: <CalendarDays className="h-3.5 w-3.5" /> },
  { value: "day", label: "Day", icon: <Clock className="h-3.5 w-3.5" /> },
];

const STATUS_OPTIONS = [
  { value: "DRAFT", label: "Draft" },
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "PUBLISHED", label: "Published" },
  { value: "FAILED", label: "Failed" },
  { value: "PENDING_APPROVAL", label: "Pending Approval" },
];

function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: { value: string; label: string; color?: string }[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  return (
    <div className="relative group">
      <button
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm border transition-colors",
          "hover:bg-muted hover:border-border",
          selected.length > 0
            ? "bg-primary/10 border-primary/40 text-primary"
            : "bg-background border-border text-muted-foreground"
        )}
      >
        {label}
        {selected.length > 0 && (
          <span className="bg-primary text-primary-foreground rounded-full w-4 h-4 text-[10px] flex items-center justify-center font-bold">
            {selected.length}
          </span>
        )}
      </button>
      <div className="absolute top-full left-0 mt-1 z-50 bg-background border rounded-md shadow-lg py-1 min-w-[160px] hidden group-focus-within:block group-hover:block">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => toggle(opt.value)}
            className="w-full text-left flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted transition-colors"
          >
            <span
              className={cn(
                "w-4 h-4 rounded border flex items-center justify-center flex-shrink-0",
                selected.includes(opt.value)
                  ? "bg-primary border-primary"
                  : "border-muted-foreground"
              )}
            >
              {selected.includes(opt.value) && (
                <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="currentColor">
                  <path d="M8.5 2L4 7.5 1.5 5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </span>
            {opt.color && (
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: opt.color }}
              />
            )}
            <span className="truncate">{opt.label}</span>
          </button>
        ))}
        {selected.length > 0 && (
          <>
            <div className="border-t my-1" />
            <button
              onClick={() => onChange([])}
              className="w-full text-left px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors"
            >
              Clear all
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function CalendarToolbar({
  view,
  date,
  onViewChange,
  onDateChange,
  platforms,
  onPlatformsChange,
  statuses,
  onStatusesChange,
  labelIds,
  onLabelIdsChange,
  socialAccounts,
  labels,
  onNewPost,
}: CalendarToolbarProps) {
  const navigatePrev = () => {
    if (view === "month") onDateChange(subMonths(date, 1));
    else if (view === "week") onDateChange(subWeeks(date, 1));
    else onDateChange(new Date(date.getTime() - 86400000));
  };

  const navigateNext = () => {
    if (view === "month") onDateChange(addMonths(date, 1));
    else if (view === "week") onDateChange(addWeeks(date, 1));
    else onDateChange(new Date(date.getTime() + 86400000));
  };

  const navigateToday = () => {
    onDateChange(startOfToday());
  };

  const dateLabel =
    view === "month"
      ? format(date, "MMMM yyyy")
      : view === "week"
      ? `${format(date, "MMM d")} – ${format(addWeeks(date, 0), "MMM d, yyyy")}`
      : format(date, "EEEE, MMMM d, yyyy");

  const platformOptions = Array.from(
    new Set(socialAccounts.map((a) => a.platform))
  ).map((p) => ({ value: p, label: PLATFORM_LABELS[p] ?? p }));

  const labelOptions = labels.map((l) => ({
    value: l.id,
    label: l.name,
    color: l.color,
  }));

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex-wrap">
      {/* Left: View toggle */}
      <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
        {VIEW_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onViewChange(opt.value)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
              view === opt.value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {opt.icon}
            {opt.label}
          </button>
        ))}
      </div>

      {/* Center: Date navigation */}
      <div className="flex items-center gap-1">
        <button
          onClick={navigatePrev}
          className="p-1.5 rounded-md hover:bg-muted transition-colors"
          aria-label="Previous"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          onClick={navigateToday}
          className="px-3 py-1.5 rounded-md text-sm font-medium hover:bg-muted transition-colors border"
        >
          Today
        </button>
        <button
          onClick={navigateNext}
          className="p-1.5 rounded-md hover:bg-muted transition-colors"
          aria-label="Next"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <h2 className="text-sm font-semibold ml-2 min-w-[180px]">{dateLabel}</h2>
      </div>

      {/* Right: Filters + New Post */}
      <div className="flex items-center gap-2">
        {platformOptions.length > 0 && (
          <MultiSelectDropdown
            label="Platform"
            options={platformOptions}
            selected={platforms}
            onChange={onPlatformsChange}
          />
        )}
        <MultiSelectDropdown
          label="Status"
          options={STATUS_OPTIONS}
          selected={statuses}
          onChange={onStatusesChange}
        />
        {labelOptions.length > 0 && (
          <MultiSelectDropdown
            label="Label"
            options={labelOptions}
            selected={labelIds}
            onChange={onLabelIdsChange}
          />
        )}
        <button
          onClick={() => onNewPost?.()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          New Post
        </button>
      </div>
    </div>
  );
}
