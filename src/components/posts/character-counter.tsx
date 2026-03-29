"use client";

import { SocialAccount } from "@/types";
import { PLATFORM_CHAR_LIMITS, PLATFORM_LABELS, cn } from "@/lib/utils";

interface CharacterCounterProps {
  content: string;
  selectedAccounts: SocialAccount[];
}

export function CharacterCounter({ content, selectedAccounts }: CharacterCounterProps) {
  if (selectedAccounts.length === 0) return null;

  // Deduplicate by platform — only show one counter per platform
  const seenPlatforms = new Set<string>();
  const platformAccounts = selectedAccounts.filter((a) => {
    if (seenPlatforms.has(a.platform)) return false;
    seenPlatforms.add(a.platform);
    return true;
  });

  const charCount = content.length;

  return (
    <div className="flex flex-wrap gap-2 py-1">
      {platformAccounts.map((account) => {
        const limit = PLATFORM_CHAR_LIMITS[account.platform];
        if (!limit) return null;
        const remaining = limit - charCount;
        const isOver = remaining < 0;
        const isWarning = remaining >= 0 && remaining < limit * 0.1;

        return (
          <div
            key={account.platform}
            className={cn(
              "flex items-center gap-1.5 text-xs rounded-md px-2 py-1 border",
              isOver
                ? "border-destructive/40 bg-destructive/5 text-destructive"
                : isWarning
                ? "border-yellow-400/40 bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400"
                : "border-border bg-muted/40 text-muted-foreground"
            )}
          >
            <span className="font-medium">{PLATFORM_LABELS[account.platform] ?? account.platform}</span>
            <span className="font-mono">
              {isOver ? (
                <span className="font-semibold">-{Math.abs(remaining)}</span>
              ) : (
                <span>{remaining}</span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
