import { db } from "@/lib/db";
import { authenticateApiKey } from "@/lib/api/auth";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { errorResponse, paginatedResponse } from "@/lib/api/response";
import { z } from "zod";

const createLabelSchema = z.object({
  name: z.string().min(1).max(100),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "color must be a valid hex color e.g. #6366f1")
    .optional()
    .default("#6366f1"),
});

export async function GET(request: Request) {
  const auth = await authenticateApiKey(request, "labels:read");
  if (auth instanceof Response) return auth;

  const rateLimitResult = await checkRateLimit(auth.apiKeyId, auth.plan, "read");
  if (rateLimitResult instanceof Response) return rateLimitResult;

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("pageSize") ?? "20", 10)));

  const where = { workspaceId: auth.workspaceId };

  const [total, labels] = await Promise.all([
    db.label.count({ where }),
    db.label.findMany({
      where,
      select: {
        id: true,
        name: true,
        color: true,
        createdAt: true,
        _count: { select: { posts: true } },
      },
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return paginatedResponse(labels, total, page, pageSize, rateLimitResult.headers);
}

export async function POST(request: Request) {
  const auth = await authenticateApiKey(request, "labels:write");
  if (auth instanceof Response) return auth;

  const rateLimitResult = await checkRateLimit(auth.apiKeyId, auth.plan, "write");
  if (rateLimitResult instanceof Response) return rateLimitResult;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400, "INVALID_JSON", rateLimitResult.headers);
  }

  const parsed = createLabelSchema.safeParse(body);
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

  const { name, color } = parsed.data;

  // Check uniqueness within workspace
  const existing = await db.label.findFirst({
    where: { workspaceId: auth.workspaceId, name },
  });
  if (existing) {
    return errorResponse(
      `A label named "${name}" already exists in this workspace`,
      409,
      "LABEL_ALREADY_EXISTS",
      rateLimitResult.headers
    );
  }

  const label = await db.label.create({
    data: { workspaceId: auth.workspaceId, name, color },
    select: {
      id: true,
      name: true,
      color: true,
      createdAt: true,
    },
  });

  return new Response(JSON.stringify({ data: label }), {
    status: 201,
    headers: { "Content-Type": "application/json", ...rateLimitResult.headers },
  });
}
