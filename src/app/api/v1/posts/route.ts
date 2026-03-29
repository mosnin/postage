import { db } from "@/lib/db";
import { authenticateApiKey } from "@/lib/api/auth";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { errorResponse, paginatedResponse, successResponse } from "@/lib/api/response";
import { PostStatus, Platform } from "@prisma/client";
import { z } from "zod";

const createPostSchema = z.object({
  content: z.string().min(1, "content is required"),
  accountIds: z.array(z.string()).min(1, "at least one accountId is required"),
  scheduledAt: z.string().datetime({ offset: true }).optional(),
  firstComment: z.string().optional(),
  labels: z.array(z.string()).optional(),
});

export async function GET(request: Request) {
  const auth = await authenticateApiKey(request, "posts:read");
  if (auth instanceof Response) return auth;

  const rateLimitResult = await checkRateLimit(auth.apiKeyId, auth.plan, "read");
  if (rateLimitResult instanceof Response) return rateLimitResult;

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("pageSize") ?? "20", 10)));
  const status = url.searchParams.get("status") as PostStatus | null;
  const platform = url.searchParams.get("platform") as Platform | null;
  const accountId = url.searchParams.get("accountId");
  const labelId = url.searchParams.get("labelId");

  const where = {
    workspaceId: auth.workspaceId,
    ...(status ? { status } : {}),
    ...(platform
      ? {
          accounts: {
            some: { socialAccount: { platform } },
          },
        }
      : {}),
    ...(accountId
      ? {
          accounts: {
            some: { socialAccountId: accountId },
          },
        }
      : {}),
    ...(labelId
      ? {
          labels: {
            some: { labelId },
          },
        }
      : {}),
  };

  const [total, posts] = await Promise.all([
    db.post.count({ where }),
    db.post.findMany({
      where,
      include: {
        accounts: {
          include: {
            socialAccount: {
              select: {
                id: true,
                platform: true,
                username: true,
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        },
        labels: {
          include: {
            label: { select: { id: true, name: true, color: true } },
          },
        },
        _count: { select: { media: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return paginatedResponse(posts, total, page, pageSize, rateLimitResult.headers);
}

export async function POST(request: Request) {
  const auth = await authenticateApiKey(request, "posts:write");
  if (auth instanceof Response) return auth;

  const rateLimitResult = await checkRateLimit(auth.apiKeyId, auth.plan, "write");
  if (rateLimitResult instanceof Response) return rateLimitResult;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400, "INVALID_JSON");
  }

  const parsed = createPostSchema.safeParse(body);
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

  const { content, accountIds, scheduledAt, firstComment, labels } = parsed.data;

  // Verify all accountIds belong to this workspace
  const accounts = await db.socialAccount.findMany({
    where: { id: { in: accountIds }, workspaceId: auth.workspaceId },
    select: { id: true },
  });

  if (accounts.length !== accountIds.length) {
    return errorResponse(
      "One or more accountIds do not belong to this workspace",
      422,
      "INVALID_ACCOUNT_IDS",
      rateLimitResult.headers
    );
  }

  // Resolve label IDs – accept either label ID or label name
  let resolvedLabelIds: string[] = [];
  if (labels && labels.length > 0) {
    const foundLabels = await db.label.findMany({
      where: {
        workspaceId: auth.workspaceId,
        OR: [{ id: { in: labels } }, { name: { in: labels } }],
      },
      select: { id: true },
    });
    resolvedLabelIds = foundLabels.map((l) => l.id);
  }

  const post = await db.post.create({
    data: {
      workspaceId: auth.workspaceId,
      authorId: auth.userId,
      content,
      firstComment: firstComment ?? null,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      status: scheduledAt ? PostStatus.SCHEDULED : PostStatus.DRAFT,
      accounts: {
        create: accountIds.map((socialAccountId) => ({
          socialAccountId,
          status: scheduledAt ? PostStatus.SCHEDULED : PostStatus.DRAFT,
        })),
      },
      labels: {
        create: resolvedLabelIds.map((labelId) => ({ labelId })),
      },
    },
    include: {
      accounts: {
        include: {
          socialAccount: {
            select: {
              id: true,
              platform: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            },
          },
        },
      },
      labels: {
        include: {
          label: { select: { id: true, name: true, color: true } },
        },
      },
    },
  });

  return new Response(JSON.stringify({ data: post }), {
    status: 201,
    headers: { "Content-Type": "application/json", ...rateLimitResult.headers },
  });
}
