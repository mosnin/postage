import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { subDays, startOfDay, endOfDay, eachDayOfInterval, format } from "date-fns";
type Plan = "FREE" | "STARTER" | "PRO" | "PRO_PLUS";

type SnapshotTotals = {
  impressions: number;
  engagements: number;
  likes: number;
  comments: number;
  shares: number;
  clicks: number;
  reach: number;
  saves: number;
  followerChange: number;
};

const STARTER_METRICS = ["impressions", "likes", "comments"] as const;

function isPlanAllowed(plan: Plan): boolean {
  return plan === "PRO" || plan === "PRO_PLUS";
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const workspaceId = searchParams.get("workspaceId");
  const startParam = searchParams.get("start");
  const endParam = searchParams.get("end");
  const platform = searchParams.get("platform") ?? undefined;

  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
  }

  // Verify membership
  const membership = await db.workspaceMember.findFirst({
    where: {
      workspaceId,
      userId: session.user.id,
      status: "ACTIVE",
    },
  });

  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Get workspace + plan
  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: { plan: true },
  });

  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const isPro = isPlanAllowed(workspace.plan);

  // Resolve date range
  const end = endParam ? endOfDay(new Date(endParam)) : endOfDay(new Date());
  const start = startParam ? startOfDay(new Date(startParam)) : startOfDay(subDays(end, 29));

  // Previous period for % change (same duration)
  const periodMs = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - periodMs);

  // Build where clause
  const snapshotWhere = {
    workspaceId,
    date: { gte: start, lte: end },
    ...(platform ? { platform: platform as never } : {}),
  };

  const prevSnapshotWhere = {
    workspaceId,
    date: { gte: prevStart, lte: prevEnd },
    ...(platform ? { platform: platform as never } : {}),
  };

  // Fetch snapshots for current and previous period in parallel
  const [snapshots, prevSnapshots, socialAccounts, posts] = await Promise.all([
    db.analyticsSnapshot.findMany({
      where: snapshotWhere,
      orderBy: { date: "asc" },
    }),
    db.analyticsSnapshot.findMany({
      where: prevSnapshotWhere,
    }),
    db.socialAccount.findMany({
      where: {
        workspaceId,
        status: "ACTIVE",
        ...(platform ? { platform: platform as never } : {}),
      },
      select: { id: true, platform: true, username: true, displayName: true, avatarUrl: true },
    }),
    db.post.findMany({
      where: {
        workspaceId,
        publishedAt: { gte: start, lte: end },
        status: "PUBLISHED",
      },
      select: {
        id: true,
        content: true,
        publishedAt: true,
        accounts: {
          select: {
            socialAccount: { select: { platform: true } },
          },
        },
      },
    }),
  ]);

  // Aggregate totals for current period
  function sumSnapshots(snaps: typeof snapshots): SnapshotTotals {
    return snaps.reduce(
      (acc: SnapshotTotals, s: typeof snapshots[0]) => ({
        impressions: acc.impressions + s.impressions,
        engagements: acc.engagements + s.engagements,
        likes: acc.likes + s.likes,
        comments: acc.comments + s.comments,
        shares: acc.shares + s.shares,
        clicks: acc.clicks + s.clicks,
        reach: acc.reach + s.reach,
        saves: acc.saves + s.saves,
        followerChange: acc.followerChange + s.followerChange,
      }),
      {
        impressions: 0,
        engagements: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        clicks: 0,
        reach: 0,
        saves: 0,
        followerChange: 0,
      }
    );
  }

  const currentTotals = sumSnapshots(snapshots);
  const prevTotals = sumSnapshots(prevSnapshots);

  function pctChange(current: number, prev: number): number | null {
    if (prev === 0) return null;
    return Math.round(((current - prev) / prev) * 100 * 10) / 10;
  }

  const summary = {
    impressions: currentTotals.impressions,
    impressionsChange: pctChange(currentTotals.impressions, prevTotals.impressions),
    engagements: currentTotals.engagements,
    engagementsChange: pctChange(currentTotals.engagements, prevTotals.engagements),
    likes: currentTotals.likes,
    comments: currentTotals.comments,
    shares: isPro ? currentTotals.shares : null,
    clicks: isPro ? currentTotals.clicks : null,
    reach: isPro ? currentTotals.reach : null,
    saves: isPro ? currentTotals.saves : null,
    followerChange: currentTotals.followerChange,
    followerChangeChange: pctChange(currentTotals.followerChange, prevTotals.followerChange),
    postsPublished: posts.length,
    postsPublishedChange: pctChange(posts.length, 0), // prev period posts not fetched, null-safe
    plan: workspace.plan,
    isPro,
    starterMetrics: STARTER_METRICS,
  };

  // Build per-day series
  const days = eachDayOfInterval({ start, end });
  const snapshotsByDay = new Map<string, typeof snapshots[0][]>();
  for (const s of snapshots) {
    const key = format(new Date(s.date), "yyyy-MM-dd");
    if (!snapshotsByDay.has(key)) snapshotsByDay.set(key, []);
    snapshotsByDay.get(key)!.push(s);
  }

  const series = days.map((day: Date) => {
    const key = format(day, "yyyy-MM-dd");
    const daySnaps = snapshotsByDay.get(key) ?? [];
    const totals = sumSnapshots(daySnaps);
    return {
      date: key,
      impressions: totals.impressions,
      engagements: totals.engagements,
      likes: totals.likes,
      comments: totals.comments,
      shares: isPro ? totals.shares : null,
      reach: isPro ? totals.reach : null,
      followerChange: totals.followerChange,
    };
  });

  // Per-platform breakdown
  const platformMap = new Map<string, ReturnType<typeof sumSnapshots>>();
  for (const s of snapshots) {
    const key = s.platform;
    if (!platformMap.has(key)) {
      platformMap.set(key, {
        impressions: 0,
        engagements: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        clicks: 0,
        reach: 0,
        saves: 0,
        followerChange: 0,
      });
    }
    const entry = platformMap.get(key)!;
    entry.impressions += s.impressions;
    entry.engagements += s.engagements;
    entry.likes += s.likes;
    entry.comments += s.comments;
    entry.shares += s.shares;
    entry.clicks += s.clicks;
    entry.reach += s.reach;
    entry.saves += s.saves;
    entry.followerChange += s.followerChange;
  }

  type SocialAccountRow = typeof socialAccounts[0];
  const byPlatform = socialAccounts.map((account: SocialAccountRow) => {
    const metrics = platformMap.get(account.platform) ?? {
      impressions: 0,
      engagements: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      clicks: 0,
      reach: 0,
      saves: 0,
      followerChange: 0,
    };

    // Per-day series for this platform
    const platformSeries = days.map((day: Date) => {
      const key = format(day, "yyyy-MM-dd");
      const daySnaps = (snapshotsByDay.get(key) ?? []).filter(
        (s) => s.platform === account.platform
      );
      const t = sumSnapshots(daySnaps);
      return {
        date: key,
        impressions: t.impressions,
        engagements: t.engagements,
        likes: t.likes,
        comments: t.comments,
        shares: isPro ? t.shares : null,
        reach: isPro ? t.reach : null,
        followerChange: t.followerChange,
      };
    });

    return {
      platform: account.platform,
      accountId: account.id,
      username: account.username,
      displayName: account.displayName,
      avatarUrl: account.avatarUrl,
      metrics: {
        impressions: metrics.impressions,
        engagements: metrics.engagements,
        likes: metrics.likes,
        comments: metrics.comments,
        shares: isPro ? metrics.shares : null,
        clicks: isPro ? metrics.clicks : null,
        reach: isPro ? metrics.reach : null,
        saves: isPro ? metrics.saves : null,
        followerChange: metrics.followerChange,
      },
      series: platformSeries,
    };
  });

  // Top posts with analytics
  const postIds = posts.map((p: { id: string }) => p.id);
  const postAnalytics =
    postIds.length > 0
      ? await db.postAnalytics.findMany({
          where: {
            postId: { in: postIds },
            ...(platform ? { platform: platform as never } : {}),
          },
        })
      : [];

  const postAnalyticsMap = new Map<string, typeof postAnalytics[0][]>();
  for (const pa of postAnalytics) {
    if (!postAnalyticsMap.has(pa.postId)) postAnalyticsMap.set(pa.postId, []);
    postAnalyticsMap.get(pa.postId)!.push(pa);
  }

  type PostRow = typeof posts[0];
  type PostAnalyticsRow = typeof postAnalytics[0];
  type PostMetricTotals = { impressions: number; engagements: number; likes: number; comments: number; shares: number };

  const topPosts = posts
    .map((post: PostRow) => {
      const paList = postAnalyticsMap.get(post.id) ?? [];
      const totals = paList.reduce(
        (acc: PostMetricTotals, pa: PostAnalyticsRow) => ({
          impressions: acc.impressions + pa.impressions,
          engagements: acc.engagements + pa.engagements,
          likes: acc.likes + pa.likes,
          comments: acc.comments + pa.comments,
          shares: acc.shares + pa.shares,
        }),
        { impressions: 0, engagements: 0, likes: 0, comments: 0, shares: 0 }
      );

      const platforms = post.accounts.map((a: PostRow["accounts"][0]) => a.socialAccount.platform);

      return {
        id: post.id,
        content: post.content,
        publishedAt: post.publishedAt,
        platforms,
        impressions: totals.impressions,
        engagements: totals.engagements,
        likes: totals.likes,
        comments: totals.comments,
        shares: isPro ? totals.shares : null,
      };
    })
    .sort((a: { impressions: number }, b: { impressions: number }) => b.impressions - a.impressions);

  return NextResponse.json({
    summary,
    series,
    byPlatform,
    topPosts,
    dateRange: {
      start: format(start, "yyyy-MM-dd"),
      end: format(end, "yyyy-MM-dd"),
    },
  });
}
