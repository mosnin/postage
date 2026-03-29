"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AccountCard } from "@/components/accounts/account-card";
import { ConnectPlatformGrid } from "@/components/accounts/connect-platform-grid";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Link2Off,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import type { SocialAccount } from "@prisma/client";
import type { PlatformKey } from "@/lib/social/platforms";

interface AccountsListProps {
  workspaceId: string;
  initialConnected?: string | null;
  initialError?: string | null;
}

interface AccountsResponse {
  accounts: (SocialAccount & { _count: { posts: number } })[];
  total: number;
  limit: number;
  plan: string;
}

export function AccountsList({
  workspaceId,
  initialConnected,
  initialError,
}: AccountsListProps) {
  const [platformPickerOpen, setPlatformPickerOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery<AccountsResponse>({
    queryKey: ["accounts", workspaceId],
    queryFn: async () => {
      const res = await fetch(`/api/accounts?workspaceId=${workspaceId}`);
      if (!res.ok) throw new Error("Failed to load accounts");
      return res.json();
    },
    // Show success/error toasts from OAuth redirect on first load
    ...(initialConnected || initialError
      ? { staleTime: 0 }
      : {}),
  });

  // Show toast from OAuth callback on mount
  useEffect(() => {
    if (initialConnected) {
      toast({
        title: "Account connected",
        description: "Your account has been connected successfully.",
      });
    }
    if (initialError) {
      toast({
        title: "Connection failed",
        description: initialError,
        variant: "destructive",
      });
    }
    // Only run on initial mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const disconnectMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/accounts/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to disconnect account");
      }
      return res.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["accounts", workspaceId] });
      toast({
        title: "Account disconnected",
        description:
          result.warningScheduledPosts
            ? `Account removed. ${result.warningScheduledPosts} scheduled post(s) may be affected.`
            : "Account removed from your workspace.",
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Failed to disconnect",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const reconnectMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/accounts/${id}`, { method: "PATCH" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to initiate reconnect");
      }
      return res.json() as Promise<{ connectUrl: string }>;
    },
    onSuccess: ({ connectUrl }) => {
      window.location.href = connectUrl;
    },
    onError: (err: Error) => {
      toast({
        title: "Failed to reconnect",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const accounts = data?.accounts ?? [];
  const limit = data?.limit ?? 0;
  const plan = data?.plan ?? "FREE";

  // Build per-platform connected counts for the picker
  const connectedPlatformCounts = accounts.reduce<Partial<Record<PlatformKey, number>>>(
    (acc, account) => {
      const key = account.platform as PlatformKey;
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    },
    {}
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <AccountsHeader
          count={0}
          limit={0}
          plan=""
          onConnect={() => {}}
          loading
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <AccountCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center">
        <p className="text-sm font-medium text-destructive">
          Failed to load connected accounts.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() =>
            queryClient.invalidateQueries({ queryKey: ["accounts", workspaceId] })
          }
        >
          <RefreshCw className="mr-2 h-3.5 w-3.5" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AccountsHeader
        count={accounts.length}
        limit={limit}
        plan={plan}
        onConnect={() => setPlatformPickerOpen(true)}
      />

      {accounts.length === 0 ? (
        <EmptyState onConnect={() => setPlatformPickerOpen(true)} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              onDisconnect={(id) => disconnectMutation.mutateAsync(id)}
              onReconnect={(id) => reconnectMutation.mutateAsync(id).then(() => {})}
            />
          ))}
        </div>
      )}

      <ConnectPlatformGrid
        open={platformPickerOpen}
        onOpenChange={setPlatformPickerOpen}
        workspaceId={workspaceId}
        connectedPlatformCounts={connectedPlatformCounts}
        accountCount={accounts.length}
        accountLimit={limit}
      />
    </div>
  );
}

function AccountsHeader({
  count,
  limit,
  plan,
  onConnect,
  loading = false,
}: {
  count: number;
  limit: number;
  plan: string;
  onConnect: () => void;
  loading?: boolean;
}) {
  const usagePercent = limit > 0 ? Math.min(100, (count / limit) * 100) : 0;
  const isNearLimit = usagePercent >= 80;
  const isAtLimit = count >= limit && limit > 0;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Connected Accounts</h1>
        {loading ? (
          <Skeleton className="mt-1.5 h-4 w-48" />
        ) : (
          <div className="mt-1.5 flex items-center gap-2">
            <p className="text-sm text-muted-foreground">
              <span
                className={cn(
                  "font-medium",
                  isNearLimit ? "text-yellow-600 dark:text-yellow-500" : "text-foreground",
                  isAtLimit && "text-red-600 dark:text-red-500"
                )}
              >
                {count} of {limit}
              </span>{" "}
              accounts connected
            </p>
            {plan && (
              <Badge variant="outline" className="text-xs capitalize">
                {plan.toLowerCase().replace("_", " ")} plan
              </Badge>
            )}
          </div>
        )}

        {/* Usage bar */}
        {!loading && limit > 0 && (
          <div className="mt-2 h-1.5 w-48 overflow-hidden rounded-full bg-secondary">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                isAtLimit
                  ? "bg-red-500"
                  : isNearLimit
                  ? "bg-yellow-500"
                  : "bg-primary"
              )}
              style={{ width: `${usagePercent}%` }}
            />
          </div>
        )}
      </div>

      <Button
        onClick={onConnect}
        disabled={loading || isAtLimit}
        className="shrink-0 gap-2"
      >
        <Plus className="h-4 w-4" />
        Connect Account
      </Button>
    </div>
  );
}

function EmptyState({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <Link2Off className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="mt-4 text-base font-semibold">No accounts connected yet</h3>
      <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">
        Connect your first social account to start scheduling and publishing posts.
      </p>
      <Button className="mt-6 gap-2" onClick={onConnect}>
        <Plus className="h-4 w-4" />
        Connect your first account
      </Button>
    </div>
  );
}

function AccountCardSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-card p-5">
      <div className="flex items-start justify-between">
        <Skeleton className="h-9 w-9 rounded-lg" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <Skeleton className="h-5 w-20 rounded-full" />
      <Skeleton className="h-3 w-36" />
      <div className="flex gap-2">
        <Skeleton className="h-8 flex-1 rounded-md" />
        <Skeleton className="h-8 flex-1 rounded-md" />
      </div>
    </div>
  );
}
