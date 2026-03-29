import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import {
  CalendarDays,
  TrendingUp,
  Link as LinkIcon,
  PlusCircle,
  Upload,
  UserPlus,
  BarChart2,
  Clock,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime, PLATFORM_LABELS } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Dashboard",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getStatusVariant(
  status: string
): "default" | "secondary" | "success" | "warning" | "destructive" | "outline" {
  switch (status) {
    case "PUBLISHED":
      return "success";
    case "SCHEDULED":
      return "info" as "default"; // mapped below
    case "DRAFT":
      return "secondary";
    case "FAILED":
      return "destructive";
    case "PENDING_APPROVAL":
      return "warning";
    default:
      return "outline";
  }
}

function StatusBadge({ status }: { status: string }) {
  const label =
    status === "PENDING_APPROVAL"
      ? "Pending"
      : status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, " ");

  const className =
    status === "PUBLISHED"
      ? "bg-green-100 text-green-800 border-transparent dark:bg-green-900/30 dark:text-green-400"
      : status === "SCHEDULED"
      ? "bg-blue-100 text-blue-800 border-transparent dark:bg-blue-900/30 dark:text-blue-400"
      : status === "DRAFT"
      ? "bg-secondary text-secondary-foreground border-transparent"
      : status === "FAILED"
      ? "bg-destructive/10 text-destructive border-transparent"
      : status === "PENDING_APPROVAL"
      ? "bg-yellow-100 text-yellow-800 border-transparent dark:bg-yellow-900/30 dark:text-yellow-400"
      : "border text-foreground";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${className}`}
    >
      {label}
    </span>
  );
}

// ─── Stat card ───────────────────────────────────────────────────────────────

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ElementType;
  description?: string;
  trend?: string;
}

function StatCard({ title, value, icon: Icon, description, trend }: StatCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="mt-2 text-3xl font-bold text-foreground tabular-nums">
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
          {description && (
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          )}
          {trend && (
            <p className="mt-1 flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
              <TrendingUp className="h-3 w-3" />
              {trend}
            </p>
          )}
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
      </div>
    </div>
  );
}

function StatCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-10 w-10 rounded-lg" />
      </div>
    </div>
  );
}

// ─── Recent Posts table ───────────────────────────────────────────────────────

interface RecentPost {
  id: string;
  content: string;
  status: string;
  scheduledAt: Date | null;
  publishedAt: Date | null;
  platforms: string[];
}

function RecentPostsTable({ posts }: { posts: RecentPost[] }) {
  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
          <CalendarDays className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground">No posts yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Create your first post to get started
        </p>
        <Button asChild size="sm" className="mt-4">
          <Link href="/posts/new">
            <PlusCircle className="h-4 w-4" />
            New Post
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="pb-3 text-left text-xs font-medium text-muted-foreground">
              Platforms
            </th>
            <th className="pb-3 text-left text-xs font-medium text-muted-foreground">
              Content
            </th>
            <th className="pb-3 text-left text-xs font-medium text-muted-foreground">
              Status
            </th>
            <th className="pb-3 text-left text-xs font-medium text-muted-foreground">
              Scheduled At
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {posts.map((post) => (
            <tr key={post.id} className="group hover:bg-muted/30 transition-colors">
              <td className="py-3 pr-4">
                <div className="flex flex-wrap gap-1">
                  {post.platforms.length === 0 ? (
                    <span className="text-xs text-muted-foreground">—</span>
                  ) : (
                    post.platforms.slice(0, 3).map((platform) => (
                      <span
                        key={platform}
                        className={`platform-${platform.toLowerCase()} inline-flex h-5 items-center rounded px-1.5 text-[10px] font-semibold text-white`}
                        title={PLATFORM_LABELS[platform] ?? platform}
                      >
                        {platform.slice(0, 2)}
                      </span>
                    ))
                  )}
                  {post.platforms.length > 3 && (
                    <span className="inline-flex h-5 items-center rounded bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
                      +{post.platforms.length - 3}
                    </span>
                  )}
                </div>
              </td>
              <td className="py-3 pr-4 max-w-[280px]">
                <Link
                  href={`/posts/${post.id}`}
                  className="line-clamp-2 text-sm text-foreground hover:text-primary transition-colors"
                >
                  {post.content || <span className="text-muted-foreground italic">No content</span>}
                </Link>
              </td>
              <td className="py-3 pr-4">
                <StatusBadge status={post.status} />
              </td>
              <td className="py-3 text-xs text-muted-foreground">
                {post.scheduledAt ? (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDateTime(post.scheduledAt)}
                  </span>
                ) : post.publishedAt ? (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDateTime(post.publishedAt)}
                  </span>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RecentPostsTableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 py-2">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-4 w-32" />
        </div>
      ))}
    </div>
  );
}

// ─── Dashboard data fetching ──────────────────────────────────────────────────

async function DashboardStats({ workspaceId }: { workspaceId: string }) {
  const now = new Date();
  const startOfThisWeek = new Date(now);
  startOfThisWeek.setDate(now.getDate() - now.getDay());
  startOfThisWeek.setHours(0, 0, 0, 0);

  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);

  const [scheduledThisWeek, publishedLast30, totalReachRaw, connectedAccounts] =
    await Promise.all([
      db.post.count({
        where: {
          workspaceId,
          status: "SCHEDULED",
          scheduledAt: { gte: startOfThisWeek },
        },
      }),
      db.post.count({
        where: {
          workspaceId,
          status: "PUBLISHED",
          publishedAt: { gte: thirtyDaysAgo },
        },
      }),
      db.analyticsSnapshot.aggregate({
        where: {
          workspaceId,
          date: { gte: thirtyDaysAgo },
        },
        _sum: { impressions: true },
      }),
      db.socialAccount.count({
        where: { workspaceId, status: "ACTIVE" },
      }),
    ]);

  const totalReach = totalReachRaw._sum.impressions ?? 0;

  const formatReach = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString();
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        title="Posts Scheduled"
        value={scheduledThisWeek}
        icon={CalendarDays}
        description="This week"
      />
      <StatCard
        title="Published Posts"
        value={publishedLast30}
        icon={TrendingUp}
        description="Last 30 days"
      />
      <StatCard
        title="Total Reach"
        value={formatReach(totalReach)}
        icon={BarChart2}
        description="Impressions, last 30 days"
      />
      <StatCard
        title="Connected Accounts"
        value={connectedAccounts}
        icon={LinkIcon}
        description="Active social accounts"
      />
    </div>
  );
}

async function RecentPostsSection({ workspaceId }: { workspaceId: string }) {
  const rawPosts = await db.post.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: {
      accounts: {
        include: {
          socialAccount: { select: { platform: true } },
        },
      },
    },
  });

  const posts: RecentPost[] = rawPosts.map((p) => ({
    id: p.id,
    content: p.content,
    status: p.status,
    scheduledAt: p.scheduledAt,
    publishedAt: p.publishedAt,
    platforms: Array.from(
      new Set(p.accounts.map((a) => a.socialAccount.platform as string))
    ),
  }));

  return <RecentPostsTable posts={posts} />;
}

// ─── Quick Actions ────────────────────────────────────────────────────────────

function QuickActions() {
  const actions = [
    {
      label: "New Post",
      href: "/posts/new",
      icon: PlusCircle,
      description: "Compose & schedule",
      primary: true,
    },
    {
      label: "Upload Media",
      href: "/media",
      icon: Upload,
      description: "Add to library",
    },
    {
      label: "Invite Member",
      href: "/team",
      icon: UserPlus,
      description: "Grow your team",
    },
    {
      label: "View Analytics",
      href: "/analytics",
      icon: BarChart2,
      description: "Track performance",
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {actions.map((action) => (
        <Link
          key={action.href}
          href={action.href}
          className={`group flex items-center gap-3 rounded-xl border p-4 transition-colors ${
            action.primary
              ? "border-primary/30 bg-primary/5 hover:bg-primary/10"
              : "border-border bg-card hover:bg-accent"
          }`}
        >
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
              action.primary ? "bg-primary/15" : "bg-muted"
            }`}
          >
            <action.icon
              className={`h-5 w-5 ${
                action.primary ? "text-primary" : "text-muted-foreground"
              }`}
            />
          </div>
          <div>
            <p
              className={`text-sm font-semibold ${
                action.primary ? "text-primary" : "text-foreground"
              }`}
            >
              {action.label}
            </p>
            <p className="text-xs text-muted-foreground">{action.description}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Get the user's active workspace (same logic as layout, but we need the id here)
  const firstMembership = await db.workspaceMember.findFirst({
    where: {
      userId: session.user.id,
      status: "ACTIVE",
    },
    include: {
      workspace: { select: { id: true, name: true } },
    },
    orderBy: { joinedAt: "asc" },
  });

  if (!firstMembership) {
    redirect("/onboarding");
  }

  const workspaceId = firstMembership.workspace.id;
  const workspaceName = firstMembership.workspace.name;

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  })();

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6 lg:px-8">
      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {greeting}, {session.user.name?.split(" ")[0] ?? "there"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Here&apos;s an overview of{" "}
          <span className="font-medium text-foreground">{workspaceName}</span>
        </p>
      </div>

      {/* Stat cards */}
      <section aria-label="Key metrics">
        <Suspense
          fallback={
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <StatCardSkeleton key={i} />
              ))}
            </div>
          }
        >
          <DashboardStats workspaceId={workspaceId} />
        </Suspense>
      </section>

      {/* Recent posts */}
      <section aria-label="Recent posts">
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Recent Posts
              </h2>
              <p className="text-xs text-muted-foreground">
                Your latest 10 posts
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/queue">View all</Link>
            </Button>
          </div>

          <div className="px-5 py-4">
            <Suspense fallback={<RecentPostsTableSkeleton />}>
              <RecentPostsSection workspaceId={workspaceId} />
            </Suspense>
          </div>
        </div>
      </section>

      {/* Quick actions */}
      <section aria-label="Quick actions">
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-base font-semibold text-foreground">
              Quick Actions
            </h2>
            <p className="text-xs text-muted-foreground">
              Common tasks at your fingertips
            </p>
          </div>
          <div className="p-5">
            <QuickActions />
          </div>
        </div>
      </section>
    </div>
  );
}
