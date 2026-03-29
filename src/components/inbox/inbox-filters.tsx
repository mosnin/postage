"use client";

import { useQueryState } from "nuqs";
import { PLATFORM_COLORS, PLATFORM_LABELS, cn } from "@/lib/utils";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SocialAccount } from "@prisma/client";

const STATUS_TABS = [
  { value: "", label: "All" },
  { value: "UNREAD", label: "Unread" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "REPLIED", label: "Replied" },
] as const;

interface InboxFiltersProps {
  socialAccounts: SocialAccount[];
  unreadCount: number;
}

export function InboxFilters({ socialAccounts, unreadCount }: InboxFiltersProps) {
  const [status, setStatus] = useQueryState("status", { defaultValue: "" });
  const [platforms, setPlatforms] = useQueryState("platform", { defaultValue: "" });
  const [accountId, setAccountId] = useQueryState("accountId", { defaultValue: "" });
  const [search, setSearch] = useQueryState("search", { defaultValue: "" });

  const activePlatforms = platforms ? platforms.split(",").filter(Boolean) : [];

  function togglePlatform(platform: string) {
    const current = new Set(activePlatforms);
    if (current.has(platform)) {
      current.delete(platform);
    } else {
      current.add(platform);
    }
    const next = Array.from(current).join(",");
    setPlatforms(next || null);
  }

  // Derive unique platforms from connected accounts
  const uniquePlatforms = Array.from(
    new Map(socialAccounts.map((a) => [a.platform, a])).values()
  );

  return (
    <aside className="w-[300px] flex-shrink-0 border-r bg-background flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="px-4 pt-5 pb-3 border-b">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Inbox</h2>
          {unreadCount > 0 && (
            <span className="inline-flex items-center justify-center rounded-full bg-blue-500 text-white text-xs font-medium px-2 py-0.5 min-w-[20px]">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="px-4 py-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search comments…"
            value={search}
            onChange={(e) => setSearch(e.target.value || null)}
            className="w-full h-8 rounded-md border bg-background pl-8 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {search && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setSearch(null)}
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Status tabs */}
      <div className="px-4 pb-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
          Status
        </p>
        <nav className="flex flex-col gap-0.5">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatus(tab.value || null)}
              className={cn(
                "flex items-center justify-between rounded-md px-2.5 py-1.5 text-sm transition-colors text-left",
                status === tab.value
                  ? "bg-accent font-medium text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              )}
            >
              <span>{tab.label}</span>
              {tab.value === "UNREAD" && unreadCount > 0 && (
                <span className="text-xs text-blue-500 font-medium">{unreadCount}</span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Platforms */}
      {uniquePlatforms.length > 0 && (
        <div className="px-4 pb-3 border-t pt-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Platforms
          </p>
          <div className="flex flex-col gap-1">
            {uniquePlatforms.map((account) => {
              const platform = account.platform;
              const color = PLATFORM_COLORS[platform] ?? "#888";
              const label = PLATFORM_LABELS[platform] ?? platform;
              const isActive = activePlatforms.includes(platform);
              return (
                <label
                  key={platform}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 cursor-pointer text-sm transition-colors",
                    isActive
                      ? "bg-accent"
                      : "hover:bg-accent/50"
                  )}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={isActive}
                    onChange={() => togglePlatform(platform)}
                  />
                  <span
                    className="size-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className={isActive ? "font-medium text-foreground" : "text-muted-foreground"}>
                    {label}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Accounts (show when multiple per platform) */}
      {socialAccounts.length > 1 && (
        <div className="px-4 pb-3 border-t pt-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Accounts
            </p>
            {accountId && (
              <Button
                variant="ghost"
                size="sm"
                className="h-5 text-xs p-0 text-muted-foreground hover:text-foreground"
                onClick={() => setAccountId(null)}
              >
                Clear
              </Button>
            )}
          </div>
          <div className="flex flex-col gap-1">
            {socialAccounts.map((account) => {
              const color = PLATFORM_COLORS[account.platform] ?? "#888";
              const isActive = accountId === account.id;
              return (
                <button
                  key={account.id}
                  onClick={() => setAccountId(isActive ? null : account.id)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-left transition-colors w-full",
                    isActive
                      ? "bg-accent font-medium"
                      : "hover:bg-accent/50 text-muted-foreground"
                  )}
                >
                  <span
                    className="size-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="truncate">{account.displayName}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Clear all filters */}
      {(status || activePlatforms.length > 0 || accountId || search) && (
        <div className="px-4 pb-4 mt-auto pt-3 border-t">
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs"
            onClick={() => {
              setStatus(null);
              setPlatforms(null);
              setAccountId(null);
              setSearch(null);
            }}
          >
            Clear all filters
          </Button>
        </div>
      )}
    </aside>
  );
}
