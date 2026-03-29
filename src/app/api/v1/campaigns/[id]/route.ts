import { db } from "@/lib/db";
import { authenticateApiKey } from "@/lib/api/auth";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { errorResponse, successResponse } from "@/lib/api/response";
import { z } from "zod";

const updateCampaignSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().nullable().optional(),
  goal: z.string().nullable().optional(),
  startDate: z.string().datetime({ offset: true }).nullable().optional(),
  endDate: z.string().datetime({ offset: true }).nullable().optional(),
  status: z.enum(["active", "paused", "completed", "archived"]).optional(),
});

const campaignInclude = {
  _count: { select: { posts: true } },
  posts: {
    include: {
      post: {
        select: {
          id: true,
          content: true,
          status: true,
          scheduledAt: true,
          publishedAt: true,
        },
      },
    },
    orderBy: { postId: "asc" as const },
    take: 10,
  },
} as const;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiKey(request, "campaigns:read");
  if (auth instanceof Response) return auth;

  const rateLimitResult = await checkRateLimit(auth.apiKeyId, auth.plan, "read");
  if (rateLimitResult instanceof Response) return rateLimitResult;

  const { id } = await params;

  const campaign = await db.campaign.findFirst({
    where: { id, workspaceId: auth.workspaceId },
    include: campaignInclude,
  });

  if (!campaign) {
    return errorResponse("Campaign not found", 404, "NOT_FOUND", rateLimitResult.headers);
  }

  return successResponse(campaign, undefined, rateLimitResult.headers);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiKey(request, "campaigns:write");
  if (auth instanceof Response) return auth;

  const rateLimitResult = await checkRateLimit(auth.apiKeyId, auth.plan, "write");
  if (rateLimitResult instanceof Response) return rateLimitResult;

  const { id } = await params;

  const existing = await db.campaign.findFirst({
    where: { id, workspaceId: auth.workspaceId },
    select: { id: true },
  });

  if (!existing) {
    return errorResponse("Campaign not found", 404, "NOT_FOUND", rateLimitResult.headers);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400, "INVALID_JSON", rateLimitResult.headers);
  }

  const parsed = updateCampaignSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: parsed.error.flatten().fieldErrors,
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json", ...rateLimitResult.headers },
      }
    );
  }

  const { startDate, endDate, ...rest } = parsed.data;

  const campaign = await db.campaign.update({
    where: { id },
    data: {
      ...rest,
      ...(startDate !== undefined
        ? { startDate: startDate ? new Date(startDate) : null }
        : {}),
      ...(endDate !== undefined
        ? { endDate: endDate ? new Date(endDate) : null }
        : {}),
    },
    include: campaignInclude,
  });

  return successResponse(campaign, undefined, rateLimitResult.headers);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiKey(request, "campaigns:write");
  if (auth instanceof Response) return auth;

  const rateLimitResult = await checkRateLimit(auth.apiKeyId, auth.plan, "write");
  if (rateLimitResult instanceof Response) return rateLimitResult;

  const { id } = await params;

  const existing = await db.campaign.findFirst({
    where: { id, workspaceId: auth.workspaceId },
    select: { id: true },
  });

  if (!existing) {
    return errorResponse("Campaign not found", 404, "NOT_FOUND", rateLimitResult.headers);
  }

  await db.campaign.delete({ where: { id } });

  return new Response(null, {
    status: 204,
    headers: rateLimitResult.headers,
  });
}
