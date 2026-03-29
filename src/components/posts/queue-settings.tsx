"use client";

import { useState } from "react";
import { Plus, X, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

export type TimeSlot = {
  id: string;
  time: string; // "HH:mm" 24h
};

export type DaySchedule = {
  enabled: boolean;
  slots: TimeSlot[];
};

export type QueueSchedule = Record<string, DaySchedule>;

const DAYS = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
];

function defaultSchedule(): QueueSchedule {
  return Object.fromEntries(
    DAYS.map(({ key }) => [
      key,
      {
        enabled: ["mon", "wed", "fri"].includes(key),
        slots:
          key === "mon" || key === "wed" || key === "fri"
            ? [
                { id: "1", time: "09:00" },
                { id: "2", time: "12:00" },
                { id: "3", time: "18:00" },
              ]
            : [],
      },
    ])
  );
}

interface QueueSettingsPanelProps {
  open: boolean;
  onClose: () => void;
  initialSchedule?: QueueSchedule;
  onSave: (schedule: QueueSchedule) => Promise<void>;
}

export function QueueSettingsPanel({
  open,
  onClose,
  initialSchedule,
  onSave,
}: QueueSettingsPanelProps) {
  const { toast } = useToast();
  const [schedule, setSchedule] = useState<QueueSchedule>(
    initialSchedule ?? defaultSchedule()
  );
  const [saving, setSaving] = useState(false);

  function toggleDay(dayKey: string) {
    setSchedule((prev) => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        enabled: !prev[dayKey].enabled,
      },
    }));
  }

  function addSlot(dayKey: string) {
    setSchedule((prev) => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        slots: [
          ...prev[dayKey].slots,
          { id: Date.now().toString(), time: "09:00" },
        ],
      },
    }));
  }

  function removeSlot(dayKey: string, slotId: string) {
    setSchedule((prev) => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        slots: prev[dayKey].slots.filter((s) => s.id !== slotId),
      },
    }));
  }

  function updateSlotTime(dayKey: string, slotId: string, time: string) {
    setSchedule((prev) => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        slots: prev[dayKey].slots.map((s) =>
          s.id === slotId ? { ...s, time } : s
        ),
      },
    }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(schedule);
      toast({ title: "Queue times saved" });
      onClose();
    } catch {
      toast({
        title: "Failed to save settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/40 transition-opacity",
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <div
        className={cn(
          "fixed inset-y-0 right-0 z-50 w-full max-w-md bg-background border-l shadow-xl flex flex-col transition-transform duration-300",
          open ? "translate-x-0" : "translate-x-full"
        )}
        aria-label="Queue settings"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-base font-semibold">Queue Times</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <p className="text-sm text-muted-foreground">
            Configure which days and times posts in your queue should be
            published automatically.
          </p>

          {DAYS.map(({ key, label }) => {
            const day = schedule[key];
            return (
              <div key={key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => toggleDay(key)}
                    className={cn(
                      "inline-flex items-center gap-2 text-sm font-medium rounded-md px-3 py-1.5 border transition-colors",
                      day.enabled
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted text-muted-foreground border-muted"
                    )}
                  >
                    {label}
                  </button>
                  {day.enabled && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs gap-1"
                      onClick={() => addSlot(key)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Time
                    </Button>
                  )}
                </div>

                {day.enabled && (
                  <div className="pl-4 space-y-2">
                    {day.slots.length === 0 && (
                      <p className="text-xs text-muted-foreground italic">
                        No time slots — posts won&apos;t publish on {label}.
                      </p>
                    )}
                    {day.slots.map((slot) => (
                      <div key={slot.id} className="flex items-center gap-2">
                        <Label className="sr-only">Time for {label}</Label>
                        <Input
                          type="time"
                          value={slot.time}
                          onChange={(e) =>
                            updateSlotTime(key, slot.id, e.target.value)
                          }
                          className="w-32 h-8 text-sm"
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => removeSlot(key, slot.id)}
                          aria-label={`Remove ${slot.time} slot`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="border-t px-5 py-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </div>
    </>
  );
}
