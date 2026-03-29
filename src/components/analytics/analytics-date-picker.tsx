"use client";

import * as React from "react";
import { useQueryState } from "nuqs";
import { format, subDays } from "date-fns";
import { CalendarIcon, ChevronDown } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PRESETS = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
] as const;

interface AnalyticsDatePickerProps {
  className?: string;
}

export function AnalyticsDatePicker({ className }: AnalyticsDatePickerProps) {
  const [start, setStart] = useQueryState("start");
  const [end, setEnd] = useQueryState("end");
  const [showCustom, setShowCustom] = React.useState(false);
  const [customRange, setCustomRange] = React.useState<DateRange | undefined>();
  const containerRef = React.useRef<HTMLDivElement>(null);

  const activePreset = React.useMemo(() => {
    if (!start || !end) return "30d";
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffDays = Math.round(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    ) + 1;
    const found = PRESETS.find((p) => p.days === diffDays);
    return found ? found.label : "custom";
  }, [start, end]);

  function applyPreset(days: number) {
    const endDate = new Date();
    const startDate = subDays(endDate, days - 1);
    setStart(format(startDate, "yyyy-MM-dd"));
    setEnd(format(endDate, "yyyy-MM-dd"));
    setShowCustom(false);
  }

  function applyCustomRange() {
    if (customRange?.from) {
      setStart(format(customRange.from, "yyyy-MM-dd"));
      setEnd(format(customRange.to ?? customRange.from, "yyyy-MM-dd"));
      setShowCustom(false);
    }
  }

  // Close on outside click
  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowCustom(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const displayLabel = React.useMemo(() => {
    if (activePreset !== "custom") return activePreset;
    if (start && end) {
      return `${format(new Date(start), "MMM d")} – ${format(new Date(end), "MMM d, yyyy")}`;
    }
    return "Custom";
  }, [activePreset, start, end]);

  return (
    <div ref={containerRef} className={cn("relative flex items-center gap-1", className)}>
      {/* Quick presets */}
      <div className="flex items-center rounded-lg border border-input bg-background p-0.5">
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            onClick={() => applyPreset(preset.days)}
            className={cn(
              "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
              activePreset === preset.label
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Custom date range */}
      <div className="relative">
        <Button
          variant={activePreset === "custom" ? "default" : "outline"}
          size="sm"
          onClick={() => setShowCustom((v) => !v)}
          className="gap-1.5"
        >
          <CalendarIcon className="h-3.5 w-3.5" />
          {activePreset === "custom" ? displayLabel : "Custom"}
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>

        {showCustom && (
          <div className="absolute right-0 top-full mt-2 z-50 rounded-xl border border-border bg-popover shadow-xl p-4 min-w-[320px]">
            <p className="text-sm font-medium mb-3 text-foreground">Select date range</p>
            <div className="flex gap-3 mb-4">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground mb-1 block">From</label>
                <input
                  type="date"
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={customRange?.from ? format(customRange.from, "yyyy-MM-dd") : ""}
                  max={customRange?.to ? format(customRange.to, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd")}
                  onChange={(e) =>
                    setCustomRange((prev) => ({
                      from: e.target.value ? new Date(e.target.value + "T00:00:00") : undefined,
                      to: prev?.to,
                    }))
                  }
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-muted-foreground mb-1 block">To</label>
                <input
                  type="date"
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={customRange?.to ? format(customRange.to, "yyyy-MM-dd") : ""}
                  min={customRange?.from ? format(customRange.from, "yyyy-MM-dd") : undefined}
                  max={format(new Date(), "yyyy-MM-dd")}
                  onChange={(e) =>
                    setCustomRange((prev) => ({
                      from: prev?.from,
                      to: e.target.value ? new Date(e.target.value + "T00:00:00") : undefined,
                    }))
                  }
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setShowCustom(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={applyCustomRange}
                disabled={!customRange?.from}
              >
                Apply
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
