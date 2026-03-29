"use client";

import { formatBytes, PLAN_LIMITS } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Plan } from "@prisma/client";

interface StorageUsageBarProps {
  used: number; // bytes
  plan: Plan;
  className?: string;
}

export function StorageUsageBar({ used, plan, className }: StorageUsageBarProps) {
  const limit = (PLAN_LIMITS as Record<string, { storage: number }>)[plan]?.storage ?? 0;
  const isUnlimited = limit === Infinity;
  const percentage = isUnlimited ? 0 : Math.min(100, Math.round((used / limit) * 100));

  const barColor =
    percentage >= 90
      ? "bg-destructive"
      : percentage >= 70
      ? "bg-amber-500"
      : "bg-primary";

  return (
    <div className={cn("flex items-center gap-3", className)}>
      {!isUnlimited && (
        <div className="flex-1 min-w-[120px]">
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", barColor)}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      )}
      <span className="text-sm text-muted-foreground whitespace-nowrap">
        {isUnlimited ? (
          <>{formatBytes(used)} used &mdash; Unlimited</>
        ) : (
          <>
            {formatBytes(used)} of {formatBytes(limit)} used
          </>
        )}
      </span>
    </div>
  );
}
