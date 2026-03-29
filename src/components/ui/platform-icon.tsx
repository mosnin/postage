import * as React from "react";
import { cn } from "@/lib/utils";
import { PLATFORM_COLORS, PLATFORM_LABELS } from "@/lib/utils";
import type { PlatformKey } from "@/types";

interface PlatformIconProps {
  platform: PlatformKey;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

const sizeMap = {
  sm: { circle: "h-6 w-6 text-xs", label: "text-xs" },
  md: { circle: "h-8 w-8 text-sm", label: "text-sm" },
  lg: { circle: "h-10 w-10 text-base", label: "text-sm" },
};

export function PlatformIcon({
  platform,
  size = "md",
  showLabel = false,
  className,
}: PlatformIconProps) {
  const color = PLATFORM_COLORS[platform] ?? "#6b7280";
  const label = PLATFORM_LABELS[platform] ?? platform;
  const initial = label.charAt(0).toUpperCase();
  const { circle, label: labelSize } = sizeMap[size];

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-full font-semibold text-white shrink-0",
          circle
        )}
        style={{ backgroundColor: color }}
        aria-label={label}
        title={label}
      >
        {initial}
      </span>
      {showLabel && (
        <span className={cn("font-medium text-foreground", labelSize)}>
          {label}
        </span>
      )}
    </span>
  );
}
