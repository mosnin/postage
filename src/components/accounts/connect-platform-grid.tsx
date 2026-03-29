"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, ExternalLink, Plus, Zap } from "lucide-react";
// ExternalLink used in the upgrade link
import { cn, PLATFORM_COLORS, PLATFORM_LABELS } from "@/lib/utils";
import { PLATFORM_KEYS } from "@/lib/social/platforms";
import type { PlatformKey } from "@/lib/social/platforms";

interface ConnectPlatformGridProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  connectedPlatformCounts: Partial<Record<PlatformKey, number>>;
  accountCount: number;
  accountLimit: number;
}

export function ConnectPlatformGrid({
  open,
  onOpenChange,
  workspaceId,
  connectedPlatformCounts,
  accountCount,
  accountLimit,
}: ConnectPlatformGridProps) {
  const [connectingPlatform, setConnectingPlatform] = useState<PlatformKey | null>(null);

  const isAtLimit = accountCount >= accountLimit;

  function handleConnect(platform: PlatformKey) {
    if (isAtLimit) return;
    setConnectingPlatform(platform);
    const url = `/api/accounts/connect/${platform.toLowerCase()}?workspaceId=${workspaceId}`;
    window.location.href = url;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Connect an Account</DialogTitle>
          <DialogDescription>
            Select a platform to connect via OAuth. You are using{" "}
            <span className="font-medium text-foreground">
              {accountCount} of {accountLimit}
            </span>{" "}
            available accounts.
          </DialogDescription>
        </DialogHeader>

        {isAtLimit && (
          <div className="flex items-start gap-3 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 dark:border-yellow-900/50 dark:bg-yellow-950/20">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-600 dark:text-yellow-500" />
            <div className="flex-1 text-sm">
              <p className="font-medium text-yellow-800 dark:text-yellow-400">
                Account limit reached
              </p>
              <p className="mt-0.5 text-yellow-700 dark:text-yellow-500">
                Upgrade your plan to connect more accounts.
              </p>
              <a
                href="/settings/billing"
                className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-yellow-800 underline underline-offset-2 hover:text-yellow-900 dark:text-yellow-400 dark:hover:text-yellow-300"
              >
                <Zap className="h-3 w-3" />
                Upgrade plan
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {PLATFORM_KEYS.map((platform) => {
            const count = connectedPlatformCounts[platform] ?? 0;
            const color = PLATFORM_COLORS[platform] ?? "#6b7280";
            const label = PLATFORM_LABELS[platform] ?? platform;
            const isConnecting = connectingPlatform === platform;
            const disabled = isAtLimit || isConnecting;

            return (
              <button
                key={platform}
                onClick={() => handleConnect(platform)}
                disabled={disabled}
                className={cn(
                  "group relative flex flex-col items-center gap-2.5 rounded-xl border bg-card p-4 text-center transition-all",
                  "hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  disabled
                    ? "cursor-not-allowed opacity-50"
                    : "cursor-pointer hover:bg-accent/30"
                )}
              >
                {/* Platform icon */}
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-white text-base font-bold shadow-sm transition-transform group-hover:scale-105"
                  style={{ backgroundColor: color }}
                >
                  {label.charAt(0)}
                </div>

                {/* Platform name */}
                <span className="line-clamp-2 text-xs font-medium leading-tight">
                  {label}
                </span>

                {/* Connected count badge */}
                {count > 0 && (
                  <Badge
                    variant="secondary"
                    className="absolute -right-1.5 -top-1.5 h-5 min-w-5 justify-center px-1.5 text-[10px]"
                  >
                    {count}
                  </Badge>
                )}

                {/* Add indicator */}
                {!disabled && (
                  <div className="absolute bottom-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary/10 opacity-0 transition-opacity group-hover:opacity-100">
                    <Plus className="h-2.5 w-2.5 text-primary" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
