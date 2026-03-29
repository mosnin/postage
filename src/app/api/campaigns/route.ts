import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { isBefore, isAfter, startOfDay } from "date-fns";

const createCampaignSchema = z.object({
  workspaceId: z.string().min(1, "workspaceId is required"),
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
  goal: z.string().max(300).optional(),
  startDate: z.string().datetime().nullish(),
  endDate: z.string().datetime().nullish(),
});

function computeCampaignStatus(
  startDate: Date | null,
  endDate: Date | null
): "active" | "upcoming" | "completed" {
  const now = startOfDay(new Date());
  if (startDate && isBefore(startDate, now) && (!endDate || isAfter(endDate, now))) {
    return "active";
  }
  if (startDate && isAfter(startDate, now)) {
    return "upcoming";
  }
  if (endDate && isBefore(endDate, now)) {
    return "completed";
  }
  return "active";
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get("workspaceId");

  if (!workspaceId) {
    return NextResponse.json(
      { error: "workspaceId query param is required" },
      { status: 400 }
    );
  }

  const membership = await db.workspaceMember.findFirst({
    where: { workspaceId, userId: session.user.id, status: "ACTIVE" },
  });
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const campaigns = await db.campaign.findMany({
    where: { workspaceId },
    include: {
      _count: { select: { posts: true } },
      posts: {
        take: 5,
        orderBy: { post: { createdAt: "desc" } },
        include: {
          post: {
            select: {
              id: true,
              status: true,
              scheduledAt: true,
              publishedAt: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Compute dynamic status and post stats
  const enriched = campaigns.map((c) => {
    const dynamicStatus = computeCampaignStatus(c.startDate, c.endDate);
    const allPosts = c.posts.map((p) => p.post);
    const publishedCount = allPosts.filter((p) => p.status === "PUBLISHED").length;

    return {
      ...c,
      dynamicStatus,
      publishedCount,
    };
  });

  return NextResponse.json(enriched);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createCampaignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 422 }
    );
  }

  const { workspaceId, name, description, goal, startDate, endDate } = parsed.data;

  const membership = await db.workspaceMember.findFirst({
    where: { workspaceId, userId: session.user.id, status: "ACTIVE" },
  });
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (startDate && endDate && new Date(endDate) <= new Date(startDate)) {
    return NextResponse.json(
      { error: "End date must be after start date" },
      { status: 422 }
    );
  }

  try {
    const campaign = await db.campaign.create({
      data: {
        workspaceId,
        name,
        description: description ?? null,
        goal: goal ?? null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
      },
      include: {
        _count: { select: { posts: true } },
      },
    });

    const dynamicStatus = computeCampaignStatus(campaign.startDate, campaign.endDate);
    return NextResponse.json({ ...campaign, dynamicStatus, publishedCount: 0 }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/campaigns]", error);
    return NextResponse.json({ error: "Failed to create campaign" }, { status: 500 });
  }
}
