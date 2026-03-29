import * as React from "react";
import { cn } from "@/lib/utils";
import { PLATFORM_COLORS, PLATFORM_LABELS } from "@/lib/utils";
import type { PlatformKey } from "@/types";

interface PlatformBadgeProps {
  platform: PlatformKey;
  className?: string;
}

export function PlatformBadge({ platform, className }: PlatformBadgeProps) {
  const color = PLATFORM_COLORS[platform] ?? "#6b7280";
  const label = PLATFORM_LABELS[platform] ?? platform;
  const initial = label.charAt(0).toUpperCase();

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold text-white",
        className
      )}
      style={{ backgroundColor: color }}
      title={label}
    >
      <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white/20 font-bold leading-none">
        {initial}
      </span>
      {label}
    </span>
  );
}
