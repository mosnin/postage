import { Suspense } from "react";
import { db } from "@/lib/db";
import {
  CreditCard,
  ExternalLink,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const PLAN_MRR: Record<string, number> = {
  FREE: 0,
  STARTER: 19,
  PRO: 49,
  PRO_PLUS: 99,
};

const PLAN_LABELS: Record<string, string> = {
  FREE: "Free",
  STARTER: "Starter",
  PRO: "Pro",
  PRO_PLUS: "Pro+",
};

const PLAN_COLORS: Record<string, string> = {
  FREE: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  STARTER: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  PRO: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  PRO_PLUS: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  ACTIVE: "default",
  TRIALING: "secondary",
  PAST_DUE: "destructive",
  CANCELED: "outline",
  PAUSED: "outline",
  UNPAID: "destructive",
};

async function SubscriptionsContent() {
  const subscriptions = await db.subscription.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      workspace: {
        select: {
          id: true,
          name: true,
          slug: true,
          owner: {
            select: { name: true, email: true },
          },
        },
      },
    },
  });

  const activeSubscriptions = subscriptions.filter((s) =>
    ["ACTIVE", "TRIALING"].includes(s.status)
  );
  const mrr = subscriptions
    .filter((s) => s.status === "ACTIVE")
    .reduce((sum, s) => sum + (PLAN_MRR[s.plan] ?? 0), 0);
  const arr = mrr * 12;
  const pastDue = subscriptions.filter((s) => s.status === "PAST_DUE").length;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Subscriptions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeSubscriptions.length}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Active + trialing
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              MRR
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${mrr.toLocaleString()}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Monthly recurring revenue
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              ARR
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${arr.toLocaleString()}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Annualized run rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
              Past Due
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold", pastDue > 0 && "text-destructive")}>
              {pastDue}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Require follow-up
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Subscriptions table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            All Subscriptions ({subscriptions.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Workspace
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Owner
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Plan
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    MRR
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Next Renewal
                  </th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                    Stripe
                  </th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-12 text-center text-muted-foreground"
                    >
                      No subscriptions found.
                    </td>
                  </tr>
                )}
                {subscriptions.map((sub) => {
                  const planMrr = sub.status === "ACTIVE" ? (PLAN_MRR[sub.plan] ?? 0) : 0;
                  return (
                    <tr
                      key={sub.id}
                      className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium">{sub.workspace.name}</p>
                          <p className="text-xs text-muted-foreground">
                            /{sub.workspace.slug}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <div>
                          <p>{sub.workspace.owner.name ?? "—"}</p>
                          <p className="text-xs truncate max-w-[160px]">
                            {sub.workspace.owner.email}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                            PLAN_COLORS[sub.plan] ?? PLAN_COLORS.FREE
                          )}
                        >
                          {PLAN_LABELS[sub.plan] ?? sub.plan}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={STATUS_VARIANT[sub.status] ?? "secondary"}>
                          {sub.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {planMrr > 0 ? `$${planMrr}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {sub.currentPeriodEnd
                          ? format(new Date(sub.currentPeriodEnd), "MMM d, yyyy")
                          : sub.trialEndsAt
                          ? `Trial ends ${format(new Date(sub.trialEndsAt), "MMM d")}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {sub.stripeCustomerId ? (
                          <a
                            href={`https://dashboard.stripe.com/customers/${sub.stripeCustomerId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            Customer
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminSubscriptionsPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
          <CreditCard className="h-5 w-5 text-green-600 dark:text-green-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Subscriptions</h1>
          <p className="text-muted-foreground text-sm">
            Revenue overview and subscription status across all workspaces.
          </p>
        </div>
      </div>

      <Suspense
        fallback={
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                </CardHeader>
                <CardContent>
                  <div className="h-8 w-16 animate-pulse rounded bg-muted" />
                </CardContent>
              </Card>
            ))}
          </div>
        }
      >
        <SubscriptionsContent />
      </Suspense>
    </div>
  );
}
