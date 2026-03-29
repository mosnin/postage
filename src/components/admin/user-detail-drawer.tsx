"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Shield,
  Building2,
  Clock,
  CreditCard,
  Github,
  Chrome,
  X,
  Loader2,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface UserDetail {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: "USER" | "SUPER_ADMIN";
  createdAt: string;
  lastLoginAt: string | null;
  accounts: Array<{ provider: string; providerAccountId: string }>;
  memberships: Array<{
    id: string;
    role: string;
    status: string;
    joinedAt: string | null;
    workspace: {
      id: string;
      name: string;
      slug: string;
      subscription: {
        plan: string;
        status: string;
        currentPeriodEnd: string | null;
      } | null;
      _count: { members: number; posts: number; socialAccounts: number };
    };
  }>;
  activityLogs: Array<{
    id: string;
    action: string;
    entityType: string | null;
    entityId: string | null;
    metadata: Record<string, unknown>;
    createdAt: string;
  }>;
}

async function fetchUserDetail(id: string): Promise<{ data: UserDetail }> {
  const res = await fetch(`/api/admin/users/${id}`);
  if (!res.ok) throw new Error("Failed to fetch user");
  return res.json();
}

const PROVIDER_ICONS: Record<string, React.ElementType> = {
  github: Github,
  google: Chrome,
};

const PLAN_LABEL: Record<string, string> = {
  FREE: "Free",
  STARTER: "Starter",
  PRO: "Pro",
  PRO_PLUS: "Pro+",
};

interface UserDetailDrawerProps {
  userId: string | null;
  onClose: () => void;
}

export function UserDetailDrawer({ userId, onClose }: UserDetailDrawerProps) {
  const open = !!userId;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-user-detail", userId],
    queryFn: () => fetchUserDetail(userId!),
    enabled: !!userId,
  });

  const user = data?.data;

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : (user?.email?.[0] ?? "U").toUpperCase();

  // Close on Escape
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/40 transition-opacity",
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
        aria-hidden
      />

      {/* Drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col bg-background shadow-2xl transition-transform duration-300",
          open ? "translate-x-0" : "translate-x-full"
        )}
        aria-label="User detail"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-base font-semibold">User Details</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {isError && (
            <div className="flex h-64 items-center justify-center text-destructive text-sm">
              Failed to load user details.
            </div>
          )}
          {user && (
            <div className="space-y-6 p-6">
              {/* Identity */}
              <div className="flex items-start gap-4">
                <Avatar className="h-14 w-14">
                  <AvatarImage src={user.image ?? undefined} alt={user.name ?? ""} />
                  <AvatarFallback className="text-lg">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-base font-semibold">{user.name ?? "Unnamed"}</p>
                    {user.role === "SUPER_ADMIN" && (
                      <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0 gap-1 text-xs">
                        <Shield className="h-3 w-3" />
                        Super Admin
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Joined {format(new Date(user.createdAt), "MMM d, yyyy")}
                  </p>
                  {user.lastLoginAt && (
                    <p className="text-xs text-muted-foreground">
                      Last login{" "}
                      {formatDistanceToNow(new Date(user.lastLoginAt), { addSuffix: true })}
                    </p>
                  )}
                </div>
              </div>

              <Separator />

              {/* Linked Accounts */}
              {user.accounts.length > 0 && (
                <div>
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Linked Accounts
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {user.accounts.map((acc) => {
                      const Icon = PROVIDER_ICONS[acc.provider] ?? Shield;
                      return (
                        <div
                          key={`${acc.provider}-${acc.providerAccountId}`}
                          className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm"
                        >
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <span className="capitalize font-medium">{acc.provider}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Workspaces */}
              <div>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Workspaces ({user.memberships.length})
                </h3>
                {user.memberships.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No workspaces.</p>
                ) : (
                  <div className="space-y-2">
                    {user.memberships.map((m) => {
                      const plan = m.workspace.subscription?.plan ?? "FREE";
                      return (
                        <div
                          key={m.id}
                          className="flex items-center gap-3 rounded-lg border border-border p-3"
                        >
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-muted">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {m.workspace.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {m.role.charAt(0) + m.role.slice(1).toLowerCase()} ·{" "}
                              {m.workspace._count.members} members ·{" "}
                              {m.workspace._count.posts} posts
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-xs font-medium text-muted-foreground">
                              {PLAN_LABEL[plan] ?? plan}
                            </span>
                            <Badge
                              variant={m.status === "ACTIVE" ? "secondary" : "destructive"}
                              className="text-[10px] px-1.5 py-0"
                            >
                              {m.status}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Subscription History */}
              <div>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Subscription Details
                </h3>
                {user.memberships.length === 0 ||
                user.memberships.every((m) => !m.workspace.subscription) ? (
                  <p className="text-sm text-muted-foreground">No active subscriptions.</p>
                ) : (
                  <div className="space-y-2">
                    {user.memberships
                      .filter((m) => m.workspace.subscription)
                      .map((m) => {
                        const sub = m.workspace.subscription!;
                        return (
                          <div
                            key={m.id}
                            className="flex items-center gap-3 rounded-lg border border-border p-3"
                          >
                            <CreditCard className="h-4 w-4 text-muted-foreground" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">{m.workspace.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {PLAN_LABEL[sub.plan] ?? sub.plan} · {sub.status}
                              </p>
                            </div>
                            {sub.currentPeriodEnd && (
                              <p className="text-xs text-muted-foreground whitespace-nowrap">
                                Renews {format(new Date(sub.currentPeriodEnd), "MMM d")}
                              </p>
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>

              {/* Activity Log */}
              <div>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Recent Activity
                </h3>
                {user.activityLogs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No activity logged.</p>
                ) : (
                  <div className="space-y-2">
                    {user.activityLogs.map((log) => (
                      <div
                        key={log.id}
                        className="flex items-start gap-2 text-sm"
                      >
                        <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <span className="font-mono text-xs text-foreground">
                            {log.action}
                          </span>
                          {log.entityType && (
                            <span className="ml-1.5 text-xs text-muted-foreground">
                              on {log.entityType}
                            </span>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
