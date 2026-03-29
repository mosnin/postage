"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import {
  Loader2,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Zap,
} from "lucide-react";
import { cn, formatDate, PLAN_LIMITS } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BillingData {
  workspaceId: string;
  subscription: {
    plan: "FREE" | "STARTER" | "PRO" | "PRO_PLUS";
    status: "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "PAUSED" | "UNPAID";
    trialEndsAt: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    stripeCustomerId: string | null;
  } | null;
  usage: {
    accountsUsed: number;
    workspacesUsed: number;
    aiCreditsUsed: number;
    storageUsedBytes: number;
  };
  invoices: {
    id: string;
    date: string;
    description: string;
    amount: number;
    currency: string;
    status: string;
    invoiceUrl: string | null;
  }[];
}

interface PlanConfig {
  key: "STARTER" | "PRO" | "PRO_PLUS";
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  monthlyPriceId: string;
  annualPriceId: string;
  features: string[];
  highlight?: boolean;
}

// ─── Plan configs ─────────────────────────────────────────────────────────────

const PLANS: PlanConfig[] = [
  {
    key: "STARTER",
    name: "Starter",
    monthlyPrice: 19,
    annualPrice: 15,
    monthlyPriceId: process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID ?? "price_starter_monthly",
    annualPriceId: process.env.NEXT_PUBLIC_STRIPE_STARTER_ANNUAL_PRICE_ID ?? "price_starter_annual",
    features: [
      "10 social accounts",
      "1 workspace",
      "1,000 AI credits/mo",
      "50 GB storage",
      "100 scheduled posts/day",
    ],
  },
  {
    key: "PRO",
    name: "Pro",
    monthlyPrice: 49,
    annualPrice: 39,
    monthlyPriceId: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID ?? "price_pro_monthly",
    annualPriceId: process.env.NEXT_PUBLIC_STRIPE_PRO_ANNUAL_PRICE_ID ?? "price_pro_annual",
    features: [
      "15 social accounts",
      "2 workspaces",
      "1,000 AI credits/mo",
      "100 GB storage",
      "250 scheduled posts/day",
      "Analytics dashboard",
    ],
    highlight: true,
  },
  {
    key: "PRO_PLUS",
    name: "Pro Plus",
    monthlyPrice: 99,
    annualPrice: 79,
    monthlyPriceId: process.env.NEXT_PUBLIC_STRIPE_PRO_PLUS_PRICE_ID ?? "price_pro_plus_monthly",
    annualPriceId: process.env.NEXT_PUBLIC_STRIPE_PRO_PLUS_ANNUAL_PRICE_ID ?? "price_pro_plus_annual",
    features: [
      "30 social accounts",
      "3 workspaces",
      "2,000 AI credits/mo",
      "Unlimited storage",
      "500 scheduled posts/day",
      "Priority support",
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function bytesToGB(bytes: number): number {
  return Math.round((bytes / (1024 ** 3)) * 10) / 10;
}

function UsageBar({ used, max, label }: { used: number; max: number; label: string }) {
  const pct = max === Infinity ? 0 : Math.min((used / max) * 100, 100);
  const isWarning = pct >= 80;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">
          {max === Infinity ? `${used} / Unlimited` : `${used} / ${max}`}
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            isWarning ? "bg-orange-500" : "bg-primary"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    TRIALING: "bg-blue-100 text-blue-700",
    ACTIVE: "bg-green-100 text-green-700",
    PAST_DUE: "bg-orange-100 text-orange-700",
    CANCELED: "bg-gray-100 text-gray-600",
    PAUSED: "bg-yellow-100 text-yellow-700",
    UNPAID: "bg-red-100 text-red-700",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variants[status] ?? "bg-gray-100 text-gray-600"
      )}
    >
      {status === "TRIALING" ? "Trial" : status.charAt(0) + status.slice(1).toLowerCase().replace("_", " ")}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function BillingPage() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const [billingInterval, setBillingInterval] = useState<"monthly" | "annual">("monthly");

  // Show success/cancel toasts from Stripe redirect
  useEffect(() => {
    if (searchParams.get("success") === "true") {
      toast({
        title: "Subscription activated",
        description: "Your plan has been updated successfully.",
      });
    }
    if (searchParams.get("canceled") === "true") {
      toast({
        title: "Checkout canceled",
        description: "No changes were made to your subscription.",
        variant: "destructive",
      });
    }
  }, [searchParams, toast]);

  const { data, isLoading } = useQuery<BillingData>({
    queryKey: ["billing"],
    queryFn: async () => {
      const res = await fetch("/api/billing/data");
      if (!res.ok) throw new Error("Failed to load billing info");
      return res.json();
    },
    staleTime: 30_000,
  });

  const portalMutation = useMutation({
    mutationFn: async () => {
      if (!data?.workspaceId) throw new Error("No workspace");
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: data.workspaceId }),
      });
      if (!res.ok) throw new Error("Failed to open portal");
      return res.json() as Promise<{ url: string }>;
    },
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: async (priceId: string) => {
      if (!data?.workspaceId) throw new Error("No workspace");
      const res = await fetch("/api/billing/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId, workspaceId: data.workspaceId }),
      });
      if (!res.ok) throw new Error("Failed to create checkout");
      return res.json() as Promise<{ url: string }>;
    },
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const subscription = data?.subscription;
  const usage = data?.usage;
  const currentPlan = subscription?.plan ?? "FREE";
  const planLimits = PLAN_LIMITS[currentPlan];

  // Trial days remaining
  const trialDaysLeft =
    subscription?.status === "TRIALING" && subscription.trialEndsAt
      ? Math.max(
          0,
          Math.ceil(
            (new Date(subscription.trialEndsAt).getTime() - Date.now()) /
              (1000 * 60 * 60 * 24)
          )
        )
      : null;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage your subscription, usage, and payment details.
        </p>
      </div>

      <Separator />

      {/* Trial banner */}
      {trialDaysLeft !== null && (
        <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
          <Zap className="h-5 w-5 text-blue-600 shrink-0" />
          <div className="flex-1 text-sm">
            <span className="font-medium text-blue-900">
              Your 7-day free trial ends in {trialDaysLeft} day{trialDaysLeft !== 1 ? "s" : ""}.
            </span>{" "}
            <span className="text-blue-700">
              Upgrade now to keep access to all features.
            </span>
          </div>
          <Button
            size="sm"
            onClick={() => {
              const pro = PLANS.find((p) => p.key === "PRO")!;
              const priceId =
                billingInterval === "annual" ? pro.annualPriceId : pro.monthlyPriceId;
              checkoutMutation.mutate(priceId);
            }}
            disabled={checkoutMutation.isPending}
          >
            {checkoutMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Upgrade Now"
            )}
          </Button>
        </div>
      )}

      {/* Current plan card */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle>Current Plan</CardTitle>
            <CardDescription className="mt-1">
              You are on the{" "}
              <span className="font-medium text-foreground">
                {currentPlan === "PRO_PLUS" ? "Pro Plus" : currentPlan.charAt(0) + currentPlan.slice(1).toLowerCase()}
              </span>{" "}
              plan.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {subscription && <StatusBadge status={subscription.status} />}
            {subscription?.cancelAtPeriodEnd && (
              <Badge variant="outline" className="text-orange-600 border-orange-300">
                Cancels {subscription.currentPeriodEnd ? formatDate(subscription.currentPeriodEnd) : "soon"}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {subscription?.currentPeriodEnd && subscription.status === "ACTIVE" && (
            <p className="text-sm text-muted-foreground">
              Renews on{" "}
              <span className="font-medium text-foreground">
                {formatDate(subscription.currentPeriodEnd)}
              </span>
            </p>
          )}

          {/* Usage meters */}
          {usage && (
            <div className="space-y-3 pt-1">
              <UsageBar
                label="Social Accounts"
                used={usage.accountsUsed}
                max={planLimits.accounts}
              />
              <UsageBar
                label="Workspaces"
                used={usage.workspacesUsed}
                max={planLimits.workspaces}
              />
              <UsageBar
                label="AI Credits"
                used={usage.aiCreditsUsed}
                max={planLimits.aiCredits}
              />
              <UsageBar
                label="Storage"
                used={bytesToGB(usage.storageUsedBytes)}
                max={planLimits.storage === Infinity ? Infinity : bytesToGB(planLimits.storage)}
              />
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              onClick={() => portalMutation.mutate()}
              disabled={portalMutation.isPending || !subscription?.stripeCustomerId}
              variant="outline"
            >
              {portalMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="mr-2 h-4 w-4" />
              )}
              Manage Subscription
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Plans comparison */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Plans</CardTitle>
              <CardDescription>Upgrade or change your plan at any time.</CardDescription>
            </div>
            {/* Annual / Monthly toggle */}
            <div className="flex items-center gap-1 rounded-lg border p-1 bg-muted/30">
              <button
                type="button"
                onClick={() => setBillingInterval("monthly")}
                className={cn(
                  "rounded-md px-3 py-1 text-sm font-medium transition-colors",
                  billingInterval === "monthly"
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setBillingInterval("annual")}
                className={cn(
                  "rounded-md px-3 py-1 text-sm font-medium transition-colors",
                  billingInterval === "annual"
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Annual
                <span className="ml-1.5 rounded-full bg-green-100 px-1.5 py-0.5 text-xs text-green-700 font-semibold">
                  -20%
                </span>
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {PLANS.map((plan) => {
              const isCurrent = plan.key === currentPlan;
              const price =
                billingInterval === "annual" ? plan.annualPrice : plan.monthlyPrice;
              const priceId =
                billingInterval === "annual" ? plan.annualPriceId : plan.monthlyPriceId;

              const planOrder = ["STARTER", "PRO", "PRO_PLUS"];
              const isUpgrade =
                planOrder.indexOf(plan.key) > planOrder.indexOf(currentPlan);

              return (
                <div
                  key={plan.key}
                  className={cn(
                    "relative rounded-xl border p-5 flex flex-col",
                    isCurrent && "border-primary ring-1 ring-primary",
                    plan.highlight && !isCurrent && "border-primary/50"
                  )}
                >
                  {plan.highlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-primary text-primary-foreground text-xs font-semibold rounded-full px-3 py-1">
                        Most Popular
                      </span>
                    </div>
                  )}
                  {isCurrent && (
                    <div className="absolute -top-3 right-4">
                      <span className="bg-green-600 text-white text-xs font-semibold rounded-full px-3 py-1">
                        Current
                      </span>
                    </div>
                  )}

                  <div className="mb-4">
                    <h3 className="text-base font-semibold">{plan.name}</h3>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-3xl font-bold">${price}</span>
                      <span className="text-muted-foreground text-sm">/mo</span>
                    </div>
                    {billingInterval === "annual" && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Billed ${price * 12}/year
                      </p>
                    )}
                  </div>

                  <ul className="space-y-2 mb-6 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    className="w-full"
                    variant={isCurrent ? "outline" : "default"}
                    disabled={
                      isCurrent ||
                      !isUpgrade ||
                      (checkoutMutation.isPending && checkoutMutation.variables === priceId)
                    }
                    onClick={() => {
                      if (!isCurrent && isUpgrade) {
                        checkoutMutation.mutate(priceId);
                      }
                    }}
                  >
                    {checkoutMutation.isPending && checkoutMutation.variables === priceId ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isCurrent ? (
                      "Current Plan"
                    ) : isUpgrade ? (
                      "Upgrade"
                    ) : (
                      "Downgrade"
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Billing history */}
      <Card>
        <CardHeader>
          <CardTitle>Billing History</CardTitle>
          <CardDescription>Your recent invoices and payment records.</CardDescription>
        </CardHeader>
        <CardContent>
          {!data?.invoices || data.invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No invoices yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="py-2 text-left font-medium">Date</th>
                    <th className="py-2 text-left font-medium">Description</th>
                    <th className="py-2 text-right font-medium">Amount</th>
                    <th className="py-2 text-right font-medium">Status</th>
                    <th className="py-2 text-right font-medium">Invoice</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.invoices.map((inv) => (
                    <tr key={inv.id}>
                      <td className="py-3 text-muted-foreground">
                        {formatDate(inv.date)}
                      </td>
                      <td className="py-3">{inv.description}</td>
                      <td className="py-3 text-right tabular-nums">
                        {new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency: inv.currency.toUpperCase(),
                        }).format(inv.amount / 100)}
                      </td>
                      <td className="py-3 text-right">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                            inv.status === "paid"
                              ? "bg-green-100 text-green-700"
                              : "bg-orange-100 text-orange-700"
                          )}
                        >
                          {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        {inv.invoiceUrl ? (
                          <a
                            href={inv.invoiceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            Download
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
