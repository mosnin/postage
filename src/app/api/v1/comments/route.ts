import { db } from "@/lib/db";
import { authenticateApiKey } from "@/lib/api/auth";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { errorResponse, paginatedResponse } from "@/lib/api/response";
import { CommentStatus, Platform } from "@prisma/client";
import { z } from "zod";

const createReplySchema = z.object({
  commentId: z.string().min(1),
  content: z.string().min(1).max(4096),
});

export async function GET(request: Request) {
  const auth = await authenticateApiKey(request, "comments:read");
  if (auth instanceof Response) return auth;

  const rateLimitResult = await checkRateLimit(auth.apiKeyId, auth.plan, "read");
  if (rateLimitResult instanceof Response) return rateLimitResult;

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("pageSize") ?? "20", 10)));
  const platform = url.searchParams.get("platform") as Platform | null;
  const status = url.searchParams.get("status") as CommentStatus | null;
  const accountId = url.searchParams.get("accountId");
  const search = url.searchParams.get("search") ?? "";

  // Collect account IDs scoped to the workspace
  const accountWhere = accountId
    ? { id: accountId, workspaceId: auth.workspaceId }
    : { workspaceId: auth.workspaceId };

  const socialAccounts = await db.socialAccount.findMany({
    where: accountWhere,
    select: { id: true },
  });

  const socialAccountIds = socialAccounts.map((a) => a.id);

  if (socialAccountIds.length === 0) {
    return paginatedResponse([], 0, page, pageSize, rateLimitResult.headers);
  }

  const where = {
    socialAccountId: { in: socialAccountIds },
    ...(platform ? { platform } : {}),
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { content: { contains: search, mode: "insensitive" as const } },
            { authorName: { contains: search, mode: "insensitive" as const } },
            { authorUsername: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [total, comments] = await Promise.all([
    db.comment.count({ where }),
    db.comment.findMany({
      where,
      include: {
        replies: { orderBy: { sentAt: "asc" } },
      },
      orderBy: { publishedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return paginatedResponse(comments, total, page, pageSize, rateLimitResult.headers);
}

export async function POST(request: Request) {
  const auth = await authenticateApiKey(request, "comments:write");
  if (auth instanceof Response) return auth;

  const rateLimitResult = await checkRateLimit(auth.apiKeyId, auth.plan, "write");
  if (rateLimitResult instanceof Response) return rateLimitResult;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400, "INVALID_JSON", rateLimitResult.headers);
  }

  const parsed = createReplySchema.safeParse(body);
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

  const { commentId, content } = parsed.data;

  // Verify the comment belongs to this workspace
  const commentRecord = await db.comment.findUnique({
    where: { id: commentId },
  });

  if (!commentRecord) {
    return errorResponse("Comment not found", 404, "NOT_FOUND", rateLimitResult.headers);
  }

  const socialAccount = await db.socialAccount.findUnique({
    where: { id: commentRecord.socialAccountId },
    select: { workspaceId: true },
  });

  if (!socialAccount || socialAccount.workspaceId !== auth.workspaceId) {
    return errorResponse(
      "Comment not found or does not belong to this workspace",
      404,
      "NOT_FOUND",
      rateLimitResult.headers
    );
  }

  // Create reply and update comment status in a transaction
  // In production this would also call the platform API to post the reply.
  const [reply] = await db.$transaction([
    db.commentReply.create({
      data: {
        commentId,
        content,
        sentById: auth.userId,
      },
    }),
    db.comment.update({
      where: { id: commentId },
      data: { status: "REPLIED" },
    }),
  ]);

  return new Response(JSON.stringify({ data: reply }), {
    status: 201,
    headers: { "Content-Type": "application/json", ...rateLimitResult.headers },
  });
}
