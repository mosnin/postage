import { db } from "@/lib/db";
import { authenticateApiKey } from "@/lib/api/auth";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { errorResponse, successResponse } from "@/lib/api/response";
import { z } from "zod";

const updateLabelSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "color must be a valid hex color e.g. #6366f1")
    .optional(),
});

const labelSelect = {
  id: true,
  name: true,
  color: true,
  createdAt: true,
  _count: { select: { posts: true } },
} as const;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiKey(request, "labels:read");
  if (auth instanceof Response) return auth;

  const rateLimitResult = await checkRateLimit(auth.apiKeyId, auth.plan, "read");
  if (rateLimitResult instanceof Response) return rateLimitResult;

  const { id } = await params;

  const label = await db.label.findFirst({
    where: { id, workspaceId: auth.workspaceId },
    select: labelSelect,
  });

  if (!label) {
    return errorResponse("Label not found", 404, "NOT_FOUND", rateLimitResult.headers);
  }

  return successResponse(label, undefined, rateLimitResult.headers);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiKey(request, "labels:write");
  if (auth instanceof Response) return auth;

  const rateLimitResult = await checkRateLimit(auth.apiKeyId, auth.plan, "write");
  if (rateLimitResult instanceof Response) return rateLimitResult;

  const { id } = await params;

  const existing = await db.label.findFirst({
    where: { id, workspaceId: auth.workspaceId },
    select: { id: true },
  });

  if (!existing) {
    return errorResponse("Label not found", 404, "NOT_FOUND", rateLimitResult.headers);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400, "INVALID_JSON", rateLimitResult.headers);
  }

  const parsed = updateLabelSchema.safeParse(body);
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

  // Check name uniqueness if renaming
  if (parsed.data.name) {
    const nameConflict = await db.label.findFirst({
      where: {
        workspaceId: auth.workspaceId,
        name: parsed.data.name,
        id: { not: id },
      },
    });
    if (nameConflict) {
      return errorResponse(
        `A label named "${parsed.data.name}" already exists in this workspace`,
        409,
        "LABEL_ALREADY_EXISTS",
        rateLimitResult.headers
      );
    }
  }

  const label = await db.label.update({
    where: { id },
    data: parsed.data,
    select: labelSelect,
  });

  return successResponse(label, undefined, rateLimitResult.headers);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiKey(request, "labels:write");
  if (auth instanceof Response) return auth;

  const rateLimitResult = await checkRateLimit(auth.apiKeyId, auth.plan, "write");
  if (rateLimitResult instanceof Response) return rateLimitResult;

  const { id } = await params;

  const existing = await db.label.findFirst({
    where: { id, workspaceId: auth.workspaceId },
    select: { id: true },
  });

  if (!existing) {
    return errorResponse("Label not found", 404, "NOT_FOUND", rateLimitResult.headers);
  }

  await db.label.delete({ where: { id } });

  return new Response(null, {
    status: 204,
    headers: rateLimitResult.headers,
  });
}
