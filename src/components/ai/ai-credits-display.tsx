"use client";

import { Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface AiCreditsDisplayProps {
  used: number;
  limit: number;
  resetAt?: Date | string | null;
  className?: string;
}

export function AiCreditsDisplay({
  used,
  limit,
  resetAt,
  className,
}: AiCreditsDisplayProps) {
  const remaining = Math.max(0, limit - used);
  const pct = limit > 0 ? (used / limit) * 100 : 0;

  const variant =
    pct >= 90
      ? "destructive"
      : pct >= 70
        ? "warning"
        : "secondary";

  const resetDate = resetAt ? new Date(resetAt) : null;
  const resetLabel = resetDate
    ? resetDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : null;

  return (
    <div className={cn("flex flex-col items-end gap-1", className)}>
      <Badge variant={variant} className="gap-1.5 px-3 py-1 text-xs font-medium">
        <Zap className="h-3 w-3" />
        {remaining.toLocaleString()} / {limit.toLocaleString()} credits remaining
        this month
      </Badge>
      {resetLabel && (
        <span className="text-xs text-muted-foreground">
          Resets on {resetLabel}
        </span>
      )}
    </div>
  );
}
