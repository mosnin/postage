"use client";

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  RefreshCw,
  Trash2,
  AlertCircle,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { cn, formatRelative, PLATFORM_COLORS, PLATFORM_LABELS } from "@/lib/utils";
import type { SocialAccount } from "@prisma/client";

interface AccountCardProps {
  account: SocialAccount & { _count?: { posts: number } };
  onDisconnect: (id: string) => Promise<void>;
  onReconnect: (id: string) => Promise<void>;
}

const STATUS_CONFIG = {
  ACTIVE: {
    label: "Active",
    color: "bg-green-500",
    badgeVariant: "success" as const,
    icon: CheckCircle2,
    iconClass: "text-green-500",
  },
  ERROR: {
    label: "Error",
    color: "bg-red-500",
    badgeVariant: "destructive" as const,
    icon: AlertCircle,
    iconClass: "text-red-500",
  },
  EXPIRED: {
    label: "Expired",
    color: "bg-yellow-500",
    badgeVariant: "warning" as const,
    icon: Clock,
    iconClass: "text-yellow-500",
  },
  DISCONNECTED: {
    label: "Disconnected",
    color: "bg-gray-400",
    badgeVariant: "secondary" as const,
    icon: AlertCircle,
    iconClass: "text-gray-400",
  },
} as const;

export function AccountCard({ account, onDisconnect, onReconnect }: AccountCardProps) {
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);

  const statusConfig = STATUS_CONFIG[account.status] ?? STATUS_CONFIG.ACTIVE;
  const StatusIcon = statusConfig.icon;
  const platformLabel = PLATFORM_LABELS[account.platform] ?? account.platform;
  const platformColor = PLATFORM_COLORS[account.platform] ?? "#6b7280";
  const needsAction = account.status === "ERROR" || account.status === "EXPIRED";
  const isInactive = account.status !== "ACTIVE";

  async function handleDisconnect() {
    setIsDisconnecting(true);
    try {
      await onDisconnect(account.id);
    } finally {
      setIsDisconnecting(false);
      setDisconnectOpen(false);
    }
  }

  async function handleReconnect() {
    setIsReconnecting(true);
    try {
      await onReconnect(account.id);
    } finally {
      setIsReconnecting(false);
    }
  }

  return (
    <>
      <div
        className={cn(
          "group relative flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm transition-all",
          isInactive && "opacity-75"
        )}
      >
        {/* Platform color accent bar */}
        <div
          className="absolute inset-x-0 top-0 h-1 rounded-t-xl"
          style={{ backgroundColor: platformColor }}
        />

        {/* Header: platform icon + status */}
        <div className="flex items-start justify-between pt-1">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg text-white text-sm font-bold shadow-sm"
            style={{ backgroundColor: platformColor }}
            title={platformLabel}
          >
            {platformLabel.charAt(0)}
          </div>
          <div className="flex items-center gap-1.5">
            <span className={cn("h-2 w-2 rounded-full", statusConfig.color)} />
            <Badge variant={statusConfig.badgeVariant} className="text-xs">
              {statusConfig.label}
            </Badge>
          </div>
        </div>

        {/* Account info */}
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 shrink-0">
            {account.avatarUrl && (
              <AvatarImage src={account.avatarUrl} alt={account.displayName} />
            )}
            <AvatarFallback className="text-sm font-semibold">
              {account.displayName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-tight">
              {account.displayName}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              @{account.username}
            </p>
          </div>
        </div>

        {/* Platform badge */}
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs font-medium">
            {platformLabel}
          </Badge>
          {account._count?.posts !== undefined && (
            <span className="text-xs text-muted-foreground">
              {account._count.posts} posts
            </span>
          )}
        </div>

        {/* Status message for error/expired */}
        {needsAction && (
          <div
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium",
              account.status === "ERROR"
                ? "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400"
                : "bg-yellow-50 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400"
            )}
          >
            <StatusIcon className={cn("h-3.5 w-3.5 shrink-0", statusConfig.iconClass)} />
            <span>
              {account.status === "ERROR"
                ? "Reconnect needed"
                : "Token expired — reconnect"}
            </span>
          </div>
        )}

        {/* Last synced */}
        <p className="text-xs text-muted-foreground">
          Connected {formatRelative(account.connectedAt)}
        </p>

        {/* Actions */}
        <div className="flex gap-2">
          {(needsAction || account.status === "DISCONNECTED") && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5"
              onClick={handleReconnect}
              disabled={isReconnecting}
            >
              <RefreshCw
                className={cn("h-3.5 w-3.5", isReconnecting && "animate-spin")}
              />
              {isReconnecting ? "Reconnecting..." : "Reconnect"}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setDisconnectOpen(true)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Disconnect
          </Button>
        </div>
      </div>

      {/* Disconnect confirm dialog */}
      <Dialog open={disconnectOpen} onOpenChange={setDisconnectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Disconnect account?</DialogTitle>
            <DialogDescription>
              This will remove{" "}
              <span className="font-medium text-foreground">
                @{account.username}
              </span>{" "}
              ({platformLabel}) from your workspace. Any scheduled posts using
              this account may fail to publish.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDisconnectOpen(false)}
              disabled={isDisconnecting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDisconnect}
              disabled={isDisconnecting}
            >
              {isDisconnecting ? "Disconnecting..." : "Disconnect"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
