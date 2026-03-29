import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { isBefore, isAfter, startOfDay } from "date-fns";

const updateCampaignSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullish(),
  goal: z.string().max(300).nullish(),
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

async function getCampaign(campaignId: string, userId: string) {
  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    include: {
      _count: { select: { posts: true } },
      posts: {
        include: {
          post: {
            include: {
              accounts: { include: { socialAccount: true } },
              media: { include: { mediaFile: true }, orderBy: { order: "asc" } },
              labels: { include: { label: true } },
            },
          },
        },
        orderBy: { post: { createdAt: "desc" } },
      },
    },
  });
  if (!campaign) return { campaign: null, membership: null };

  const membership = await db.workspaceMember.findFirst({
    where: { workspaceId: campaign.workspaceId, userId, status: "ACTIVE" },
  });
  return { campaign, membership };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { campaign, membership } = await getCampaign(id, session.user.id);

  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const posts = campaign.posts.map((cp) => cp.post);
  const publishedCount = posts.filter((p) => p.status === "PUBLISHED").length;
  const scheduledCount = posts.filter((p) => p.status === "SCHEDULED").length;
  const draftCount = posts.filter((p) => p.status === "DRAFT").length;
  const dynamicStatus = computeCampaignStatus(campaign.startDate, campaign.endDate);

  return NextResponse.json({
    ...campaign,
    posts,
    dynamicStatus,
    publishedCount,
    scheduledCount,
    draftCount,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { campaign, membership } = await getCampaign(id, session.user.id);

  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateCampaignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 422 }
    );
  }

  const { name, description, goal, startDate, endDate } = parsed.data;

  const resolvedStart = startDate !== undefined
    ? (startDate ? new Date(startDate) : null)
    : campaign.startDate;
  const resolvedEnd = endDate !== undefined
    ? (endDate ? new Date(endDate) : null)
    : campaign.endDate;

  if (resolvedStart && resolvedEnd && resolvedEnd <= resolvedStart) {
    return NextResponse.json(
      { error: "End date must be after start date" },
      { status: 422 }
    );
  }

  try {
    const updated = await db.campaign.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(goal !== undefined ? { goal } : {}),
        ...(startDate !== undefined ? { startDate: startDate ? new Date(startDate) : null } : {}),
        ...(endDate !== undefined ? { endDate: endDate ? new Date(endDate) : null } : {}),
      },
      include: { _count: { select: { posts: true } } },
    });

    const dynamicStatus = computeCampaignStatus(updated.startDate, updated.endDate);
    return NextResponse.json({ ...updated, dynamicStatus });
  } catch (error) {
    console.error("[PATCH /api/campaigns/:id]", error);
    return NextResponse.json({ error: "Failed to update campaign" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { campaign, membership } = await getCampaign(id, session.user.id);

  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // CampaignPost junction cascades on delete
    await db.campaign.delete({ where: { id } });
    return NextResponse.json({ message: "Campaign deleted" });
  } catch (error) {
    console.error("[DELETE /api/campaigns/:id]", error);
    return NextResponse.json({ error: "Failed to delete campaign" }, { status: 500 });
  }
}
