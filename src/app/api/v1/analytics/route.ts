import { db } from "@/lib/db";
import { authenticateApiKey } from "@/lib/api/auth";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { errorResponse, successResponse } from "@/lib/api/response";
import { Platform } from "@prisma/client";
import { startOfDay, endOfDay, subDays } from "date-fns";

type MetricTotals = {
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

function emptyTotals(): MetricTotals {
  return {
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
}

function sumSnapshots(
  snaps: Array<{
    impressions: number;
    engagements: number;
    likes: number;
    comments: number;
    shares: number;
    clicks: number;
    reach: number;
    saves: number;
    followerChange: number;
  }>
): MetricTotals {
  return snaps.reduce((acc, s) => {
    acc.impressions += s.impressions;
    acc.engagements += s.engagements;
    acc.likes += s.likes;
    acc.comments += s.comments;
    acc.shares += s.shares;
    acc.clicks += s.clicks;
    acc.reach += s.reach;
    acc.saves += s.saves;
    acc.followerChange += s.followerChange;
    return acc;
  }, emptyTotals());
}

export async function GET(request: Request) {
  const auth = await authenticateApiKey(request, "analytics:read");
  if (auth instanceof Response) return auth;

  const rateLimitResult = await checkRateLimit(auth.apiKeyId, auth.plan, "read");
  if (rateLimitResult instanceof Response) return rateLimitResult;

  const url = new URL(request.url);
  const startParam = url.searchParams.get("start");
  const endParam = url.searchParams.get("end");
  const platformParam = url.searchParams.get("platform") as Platform | null;

  // Validate platform if provided
  if (platformParam && !Object.values(Platform).includes(platformParam)) {
    return errorResponse(
      `Invalid platform. Valid values: ${Object.values(Platform).join(", ")}`,
      400,
      "INVALID_PLATFORM",
      rateLimitResult.headers
    );
  }

  // Validate and parse dates
  const end = endParam ? endOfDay(new Date(endParam)) : endOfDay(new Date());
  const start = startParam ? startOfDay(new Date(startParam)) : startOfDay(subDays(end, 29));

  if (isNaN(end.getTime()) || isNaN(start.getTime())) {
    return errorResponse(
      "Invalid date format. Use ISO 8601 dates e.g. 2025-01-01",
      400,
      "INVALID_DATE",
      rateLimitResult.headers
    );
  }

  if (start > end) {
    return errorResponse(
      "start must be before end",
      400,
      "INVALID_DATE_RANGE",
      rateLimitResult.headers
    );
  }

  const snapshotWhere = {
    workspaceId: auth.workspaceId,
    date: { gte: start, lte: end },
    ...(platformParam ? { platform: platformParam } : {}),
  };

  const [snapshots, postsCount] = await Promise.all([
    db.analyticsSnapshot.findMany({
      where: snapshotWhere,
      orderBy: { date: "asc" },
    }),
    db.post.count({
      where: {
        workspaceId: auth.workspaceId,
        publishedAt: { gte: start, lte: end },
        status: "PUBLISHED",
      },
    }),
  ]);

  // Overall summary
  const totals = sumSnapshots(snapshots);
  const summary = {
    ...totals,
    postsCount,
  };

  // Breakdown by platform
  const platformMap = new Map<Platform, MetricTotals>();
  for (const s of snapshots) {
    if (!platformMap.has(s.platform)) {
      platformMap.set(s.platform, emptyTotals());
    }
    const entry = platformMap.get(s.platform)!;
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

  const byPlatform: Record<string, MetricTotals> = {};
  platformMap.forEach((metrics, platform) => {
    byPlatform[platform] = metrics;
  });

  return successResponse(
    {
      summary,
      byPlatform,
      dateRange: {
        start: start.toISOString().slice(0, 10),
        end: end.toISOString().slice(0, 10),
      },
    },
    undefined,
    rateLimitResult.headers
  );
}
