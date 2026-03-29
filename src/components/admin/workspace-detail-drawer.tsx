"use client";

import * as React from "react";
import {
  X,
  ExternalLink,
  Users,
  FileText,
  Share2,
  CreditCard,
  Calendar,
} from "lucide-react";
import { format } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface AdminWorkspace {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  createdAt: string;
  owner: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
  subscription: {
    plan: string;
    status: string;
    currentPeriodEnd: string | null;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
  } | null;
  _count: { members: number; posts: number; socialAccounts: number };
}

const PLAN_COLORS: Record<string, string> = {
  FREE: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  STARTER: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  PRO: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  PRO_PLUS: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
};

const PLAN_LABEL: Record<string, string> = {
  FREE: "Free",
  STARTER: "Starter",
  PRO: "Pro",
  PRO_PLUS: "Pro+",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  ACTIVE: "default",
  TRIALING: "secondary",
  PAST_DUE: "destructive",
  CANCELED: "outline",
  PAUSED: "outline",
  UNPAID: "destructive",
};

interface WorkspaceDetailDrawerProps {
  workspace: AdminWorkspace | null;
  onClose: () => void;
}

export function WorkspaceDetailDrawer({ workspace, onClose }: WorkspaceDetailDrawerProps) {
  const open = !!workspace;

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const plan = workspace?.subscription?.plan ?? "FREE";
  const subStatus = workspace?.subscription?.status;

  const ownerInitials = workspace?.owner.name
    ? workspace.owner.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : (workspace?.owner.email?.[0] ?? "O").toUpperCase();

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/40 transition-opacity",
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
        aria-hidden
      />

      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col bg-background shadow-2xl transition-transform duration-300",
          open ? "translate-x-0" : "translate-x-full"
        )}
        aria-label="Workspace detail"
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-base font-semibold">Workspace Details</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {workspace && (
          <div className="flex-1 overflow-y-auto">
            <div className="space-y-6 p-6">
              {/* Identity */}
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-lg font-bold">
                  {workspace.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-semibold">{workspace.name}</p>
                  <p className="text-sm text-muted-foreground">/{workspace.slug}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Created {format(new Date(workspace.createdAt), "MMM d, yyyy")}
                  </p>
                </div>
              </div>

              <Separator />

              {/* Plan + Subscription */}
              <div>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Subscription
                </h3>
                <div className="rounded-lg border border-border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Plan</span>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                        PLAN_COLORS[plan]
                      )}
                    >
                      {PLAN_LABEL[plan] ?? plan}
                    </span>
                  </div>
                  {subStatus && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Status</span>
                      <Badge variant={STATUS_VARIANT[subStatus] ?? "secondary"}>
                        {subStatus}
                      </Badge>
                    </div>
                  )}
                  {workspace.subscription?.currentPeriodEnd && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Next Renewal</span>
                      <span className="text-sm font-medium flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {format(new Date(workspace.subscription.currentPeriodEnd), "MMM d, yyyy")}
                      </span>
                    </div>
                  )}
                  {workspace.subscription?.stripeCustomerId && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Stripe Customer</span>
                      <a
                        href={`https://dashboard.stripe.com/customers/${workspace.subscription.stripeCustomerId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        {workspace.subscription.stripeCustomerId.slice(0, 14)}…
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                  {workspace.subscription?.stripeSubscriptionId && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Stripe Sub</span>
                      <a
                        href={`https://dashboard.stripe.com/subscriptions/${workspace.subscription.stripeSubscriptionId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        {workspace.subscription.stripeSubscriptionId.slice(0, 14)}…
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Owner */}
              <div>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Owner
                </h3>
                <div className="flex items-center gap-3 rounded-lg border border-border p-3">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={workspace.owner.image ?? undefined} />
                    <AvatarFallback className="text-xs">{ownerInitials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{workspace.owner.name ?? "Unnamed"}</p>
                    <p className="text-xs text-muted-foreground truncate">{workspace.owner.email}</p>
                  </div>
                </div>
              </div>

              {/* Usage Stats */}
              <div>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Usage Stats
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="flex flex-col items-center gap-1 rounded-lg border border-border p-3 text-center">
                    <Users className="h-5 w-5 text-muted-foreground" />
                    <span className="text-xl font-bold">{workspace._count.members}</span>
                    <span className="text-xs text-muted-foreground">Members</span>
                  </div>
                  <div className="flex flex-col items-center gap-1 rounded-lg border border-border p-3 text-center">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <span className="text-xl font-bold">{workspace._count.posts}</span>
                    <span className="text-xs text-muted-foreground">Posts</span>
                  </div>
                  <div className="flex flex-col items-center gap-1 rounded-lg border border-border p-3 text-center">
                    <Share2 className="h-5 w-5 text-muted-foreground" />
                    <span className="text-xl font-bold">{workspace._count.socialAccounts}</span>
                    <span className="text-xs text-muted-foreground">Accounts</span>
                  </div>
                </div>
              </div>

              {/* Billing link */}
              {workspace.subscription?.stripeCustomerId && (
                <div>
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Billing
                  </h3>
                  <a
                    href={`https://dashboard.stripe.com/customers/${workspace.subscription.stripeCustomerId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm hover:bg-muted transition-colors"
                  >
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1">View in Stripe Dashboard</span>
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
