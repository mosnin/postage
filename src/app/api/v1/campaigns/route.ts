import { db } from "@/lib/db";
import { authenticateApiKey } from "@/lib/api/auth";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { errorResponse, paginatedResponse } from "@/lib/api/response";
import { z } from "zod";

const createCampaignSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  goal: z.string().optional(),
  startDate: z.string().datetime({ offset: true }).optional(),
  endDate: z.string().datetime({ offset: true }).optional(),
  status: z.enum(["active", "paused", "completed", "archived"]).optional().default("active"),
});

const campaignSelect = {
  id: true,
  name: true,
  description: true,
  goal: true,
  startDate: true,
  endDate: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { posts: true } },
} as const;

export async function GET(request: Request) {
  const auth = await authenticateApiKey(request, "campaigns:read");
  if (auth instanceof Response) return auth;

  const rateLimitResult = await checkRateLimit(auth.apiKeyId, auth.plan, "read");
  if (rateLimitResult instanceof Response) return rateLimitResult;

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("pageSize") ?? "20", 10)));
  const status = url.searchParams.get("status");

  const where = {
    workspaceId: auth.workspaceId,
    ...(status ? { status } : {}),
  };

  const [total, campaigns] = await Promise.all([
    db.campaign.count({ where }),
    db.campaign.findMany({
      where,
      select: campaignSelect,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return paginatedResponse(campaigns, total, page, pageSize, rateLimitResult.headers);
}

export async function POST(request: Request) {
  const auth = await authenticateApiKey(request, "campaigns:write");
  if (auth instanceof Response) return auth;

  const rateLimitResult = await checkRateLimit(auth.apiKeyId, auth.plan, "write");
  if (rateLimitResult instanceof Response) return rateLimitResult;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400, "INVALID_JSON", rateLimitResult.headers);
  }

  const parsed = createCampaignSchema.safeParse(body);
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

  const campaign = await db.campaign.create({
    data: {
      workspaceId: auth.workspaceId,
      ...rest,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
    },
    select: campaignSelect,
  });

  return new Response(JSON.stringify({ data: campaign }), {
    status: 201,
    headers: { "Content-Type": "application/json", ...rateLimitResult.headers },
  });
}
