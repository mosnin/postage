import { db } from "@/lib/db";
import { authenticateApiKey } from "@/lib/api/auth";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { errorResponse, successResponse } from "@/lib/api/response";
import { z } from "zod";

const patchCommentSchema = z.union([
  z.object({
    status: z.enum(["READ", "RESOLVED", "UNREAD"]),
  }),
  z.object({
    isHidden: z.boolean(),
  }),
]);

async function resolveCommentForWorkspace(commentId: string, workspaceId: string) {
  const comment = await db.comment.findUnique({ where: { id: commentId } });
  if (!comment) return null;

  const account = await db.socialAccount.findUnique({
    where: { id: comment.socialAccountId },
    select: { workspaceId: true },
  });

  if (!account || account.workspaceId !== workspaceId) return null;

  return comment;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiKey(request, "comments:read");
  if (auth instanceof Response) return auth;

  const rateLimitResult = await checkRateLimit(auth.apiKeyId, auth.plan, "read");
  if (rateLimitResult instanceof Response) return rateLimitResult;

  const { id } = await params;

  const comment = await resolveCommentForWorkspace(id, auth.workspaceId);
  if (!comment) {
    return errorResponse("Comment not found", 404, "NOT_FOUND", rateLimitResult.headers);
  }

  const commentWithReplies = await db.comment.findUnique({
    where: { id },
    include: { replies: { orderBy: { sentAt: "asc" } } },
  });

  return successResponse(commentWithReplies, undefined, rateLimitResult.headers);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiKey(request, "comments:write");
  if (auth instanceof Response) return auth;

  const rateLimitResult = await checkRateLimit(auth.apiKeyId, auth.plan, "write");
  if (rateLimitResult instanceof Response) return rateLimitResult;

  const { id } = await params;

  const comment = await resolveCommentForWorkspace(id, auth.workspaceId);
  if (!comment) {
    return errorResponse("Comment not found", 404, "NOT_FOUND", rateLimitResult.headers);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400, "INVALID_JSON", rateLimitResult.headers);
  }

  const parsed = patchCommentSchema.safeParse(body);
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

  const updated = await db.comment.update({
    where: { id },
    data: parsed.data,
    include: { replies: { orderBy: { sentAt: "asc" } } },
  });

  return successResponse(updated, undefined, rateLimitResult.headers);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiKey(request, "comments:write");
  if (auth instanceof Response) return auth;

  const rateLimitResult = await checkRateLimit(auth.apiKeyId, auth.plan, "write");
  if (rateLimitResult instanceof Response) return rateLimitResult;

  const { id } = await params;

  const comment = await resolveCommentForWorkspace(id, auth.workspaceId);
  if (!comment) {
    return errorResponse("Comment not found", 404, "NOT_FOUND", rateLimitResult.headers);
  }

  await db.comment.delete({ where: { id } });

  return new Response(null, {
    status: 204,
    headers: rateLimitResult.headers,
  });
}
