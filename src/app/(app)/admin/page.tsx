import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  Users,
  Building2,
  CreditCard,
  TrendingUp,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { format, formatDistanceToNow } from "date-fns";

const PLAN_MRR: Record<string, number> = {
  FREE: 0,
  STARTER: 19,
  PRO: 49,
  PRO_PLUS: 99,
};

async function getAdminStats() {
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    newUsersThisWeek,
    totalWorkspaces,
    activeSubscriptions,
    planBreakdown,
    recentSignups,
    overdueSubscriptions,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { createdAt: { gte: oneWeekAgo } } }),
    db.workspace.count(),
    db.subscription.count({
      where: { status: { in: ["ACTIVE", "TRIALING"] } },
    }),
    db.subscription.groupBy({
      by: ["plan"],
      _count: { plan: true },
      where: { status: { in: ["ACTIVE", "TRIALING"] } },
    }),
    db.user.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        createdAt: true,
        lastLoginAt: true,
        _count: { select: { memberships: true } },
        memberships: {
          take: 1,
          where: { status: "ACTIVE" },
          include: {
            workspace: {
              include: {
                subscription: { select: { plan: true } },
              },
            },
          },
        },
      },
    }),
    db.subscription.count({ where: { status: "PAST_DUE" } }),
  ]);

  // Calculate MRR
  const activeSubsWithPlan = await db.subscription.findMany({
    where: { status: "ACTIVE" },
    select: { plan: true },
  });
  const mrr = activeSubsWithPlan.reduce((sum, s) => sum + (PLAN_MRR[s.plan] ?? 0), 0);

  const planCounts: Record<string, number> = {
    FREE: 0,
    STARTER: 0,
    PRO: 0,
    PRO_PLUS: 0,
  };
  for (const row of planBreakdown) {
    planCounts[row.plan] = row._count.plan;
  }

  return {
    totalUsers,
    newUsersThisWeek,
    totalWorkspaces,
    activeSubscriptions,
    mrr,
    planCounts,
    recentSignups,
    overdueSubscriptions,
  };
}

function StatCard({
  title,
  value,
  sub,
  icon: Icon,
  iconClass,
}: {
  title: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  iconClass?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={`flex h-8 w-8 items-center justify-center rounded-md ${iconClass ?? "bg-muted"}`}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{typeof value === "number" ? value.toLocaleString() : value}</div>
        {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

async function AdminDashboardContent() {
  const stats = await getAdminStats();

  const planOrder = ["FREE", "STARTER", "PRO", "PRO_PLUS"] as const;
  const planLabels: Record<string, string> = {
    FREE: "Free",
    STARTER: "Starter",
    PRO: "Pro",
    PRO_PLUS: "Pro+",
  };

  return (
    <div className="space-y-8">
      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Users"
          value={stats.totalUsers}
          sub={`+${stats.newUsersThisWeek} this week`}
          icon={Users}
          iconClass="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
        />
        <StatCard
          title="Active Workspaces"
          value={stats.totalWorkspaces}
          sub={`${stats.activeSubscriptions} with active subscriptions`}
          icon={Building2}
          iconClass="bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400"
        />
        <StatCard
          title="Monthly Recurring Revenue"
          value={`$${stats.mrr.toLocaleString()}`}
          sub="From active subscriptions"
          icon={CreditCard}
          iconClass="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
        />
        <StatCard
          title="Past Due"
          value={stats.overdueSubscriptions}
          sub="Require attention"
          icon={AlertTriangle}
          iconClass={
            stats.overdueSubscriptions > 0
              ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
              : "bg-muted text-muted-foreground"
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Plan Breakdown */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              Plan Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {planOrder.map((plan) => {
              const count = stats.planCounts[plan] ?? 0;
              const total = Object.values(stats.planCounts).reduce((a, b) => a + b, 0);
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;

              const barColors: Record<string, string> = {
                FREE: "bg-zinc-400",
                STARTER: "bg-blue-500",
                PRO: "bg-violet-500",
                PRO_PLUS: "bg-amber-500",
              };

              return (
                <div key={plan} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{planLabels[plan]}</span>
                    <span className="text-muted-foreground">
                      {count} ({pct}%)
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${barColors[plan]}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* System Health */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Shield className="h-4 w-4 text-muted-foreground" />
              System Health
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: "Auth Provider", status: "operational" },
              { label: "Database", status: "operational" },
              { label: "Stripe Billing", status: stats.overdueSubscriptions > 5 ? "degraded" : "operational" },
              { label: "Background Jobs", status: "operational" },
              { label: "Email Service", status: "operational" },
            ].map(({ label, status }) => (
              <div key={label} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{label}</span>
                <span
                  className={`flex items-center gap-1.5 font-medium ${
                    status === "operational"
                      ? "text-green-600 dark:text-green-400"
                      : status === "degraded"
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {status === "operational" ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <AlertTriangle className="h-3.5 w-3.5" />
                  )}
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Quick Links */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Quick Stats
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: "Starter workspaces", value: stats.planCounts.STARTER ?? 0 },
              { label: "Pro workspaces", value: stats.planCounts.PRO ?? 0 },
              { label: "Pro+ workspaces", value: stats.planCounts.PRO_PLUS ?? 0 },
              { label: "Free workspaces", value: stats.planCounts.FREE ?? 0 },
              { label: "Super admins", value: "(see users)" },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-semibold">{value}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Recent Signups */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Users className="h-4 w-4 text-muted-foreground" />
            Recent Signups
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {stats.recentSignups.length === 0 && (
              <p className="text-sm text-muted-foreground">No recent signups.</p>
            )}
            {stats.recentSignups.map((user) => {
              const initials = user.name
                ? user.name
                    .split(" ")
                    .map((n: string) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()
                : (user.email?.[0] ?? "U").toUpperCase();

              const plan =
                user.memberships[0]?.workspace?.subscription?.plan ?? "FREE";
              const planLabel: Record<string, string> = {
                FREE: "Free",
                STARTER: "Starter",
                PRO: "Pro",
                PRO_PLUS: "Pro+",
              };

              return (
                <div
                  key={user.id}
                  className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/50 transition-colors"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.image ?? undefined} alt={user.name ?? ""} />
                    <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{user.name ?? "Unnamed"}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {user.role === "SUPER_ADMIN" && (
                      <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0 text-[10px]">
                        Admin
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {planLabel[plan]}
                    </span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default async function AdminPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Admin Overview</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Platform-wide metrics and management.
        </p>
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
        <AdminDashboardContent />
      </Suspense>
    </div>
  );
}
