"use client";

import { SocialAccount } from "@/types";
import { PLATFORM_LABELS, PLATFORM_COLORS, cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface PlatformSelectorProps {
  accounts: SocialAccount[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

function PlatformIcon({ platform, size = 16 }: { platform: string; size?: number }) {
  const color = PLATFORM_COLORS[platform] ?? "#888";
  const label = PLATFORM_LABELS[platform] ?? platform;

  // Simple SVG-based letter icons using brand color
  return (
    <span
      className="inline-flex items-center justify-center rounded-full font-bold text-white flex-shrink-0"
      style={{
        width: size,
        height: size,
        background: color,
        fontSize: Math.max(7, size * 0.45),
        lineHeight: 1,
      }}
      title={label}
    >
      {platform.charAt(0)}
    </span>
  );
}

export function PlatformSelector({ accounts, selectedIds, onChange }: PlatformSelectorProps) {
  function toggle(id: string) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((s) => s !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  }

  function selectAll() {
    onChange(accounts.map((a) => a.id));
  }

  function clearAll() {
    onChange([]);
  }

  const allSelected = accounts.length > 0 && selectedIds.length === accounts.length;

  if (accounts.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed text-muted-foreground text-sm">
        <span>No connected accounts. Connect accounts in Settings.</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Post to
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={allSelected ? clearAll : selectAll}
            className="text-xs text-primary hover:underline"
          >
            {allSelected ? "Deselect all" : "Select all"}
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {accounts.map((account) => {
          const selected = selectedIds.includes(account.id);
          return (
            <button
              key={account.id}
              type="button"
              onClick={() => toggle(account.id)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium transition-all",
                selected
                  ? "border-primary/40 bg-primary/5 text-primary shadow-sm"
                  : "border-border bg-background text-muted-foreground hover:border-border/80 hover:text-foreground"
              )}
            >
              <PlatformIcon platform={account.platform} size={18} />
              <span className="max-w-[120px] truncate">{account.displayName}</span>
              {selected && (
                <Check
                  className="w-3.5 h-3.5 text-primary flex-shrink-0"
                  strokeWidth={2.5}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
