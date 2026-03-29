import { db } from "@/lib/db";
import { authenticateApiKey } from "@/lib/api/auth";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { errorResponse, successResponse } from "@/lib/api/response";
import { PostStatus } from "@prisma/client";
import { z } from "zod";

const postInclude = {
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
  media: {
    include: {
      mediaFile: {
        select: { id: true, name: true, url: true, mimeType: true, size: true },
      },
    },
    orderBy: { order: "asc" as const },
  },
} as const;

const updatePostSchema = z.object({
  content: z.string().min(1).optional(),
  scheduledAt: z.string().datetime({ offset: true }).nullable().optional(),
  firstComment: z.string().nullable().optional(),
  status: z.nativeEnum(PostStatus).optional(),
  labels: z.array(z.string()).optional(),
});

async function getPost(id: string, workspaceId: string) {
  return db.post.findFirst({
    where: { id, workspaceId },
    include: postInclude,
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiKey(request, "posts:read");
  if (auth instanceof Response) return auth;

  const rateLimitResult = await checkRateLimit(auth.apiKeyId, auth.plan, "read");
  if (rateLimitResult instanceof Response) return rateLimitResult;

  const { id } = await params;
  const post = await getPost(id, auth.workspaceId);

  if (!post) {
    return errorResponse("Post not found", 404, "NOT_FOUND", rateLimitResult.headers);
  }

  return successResponse(post, undefined, rateLimitResult.headers);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiKey(request, "posts:write");
  if (auth instanceof Response) return auth;

  const rateLimitResult = await checkRateLimit(auth.apiKeyId, auth.plan, "write");
  if (rateLimitResult instanceof Response) return rateLimitResult;

  const { id } = await params;

  const existing = await db.post.findFirst({
    where: { id, workspaceId: auth.workspaceId },
    select: { id: true, status: true },
  });

  if (!existing) {
    return errorResponse("Post not found", 404, "NOT_FOUND", rateLimitResult.headers);
  }

  // Prevent editing already-published posts
  if (existing.status === "PUBLISHED" || existing.status === "PUBLISHING") {
    return errorResponse(
      "Cannot edit a post that is published or currently publishing",
      422,
      "POST_NOT_EDITABLE",
      rateLimitResult.headers
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400, "INVALID_JSON", rateLimitResult.headers);
  }

  const parsed = updatePostSchema.safeParse(body);
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

  const { labels, scheduledAt, ...rest } = parsed.data;

  // Resolve label updates
  let labelUpdate: object | undefined;
  if (labels !== undefined) {
    const foundLabels = await db.label.findMany({
      where: {
        workspaceId: auth.workspaceId,
        OR: [{ id: { in: labels } }, { name: { in: labels } }],
      },
      select: { id: true },
    });
    labelUpdate = {
      deleteMany: {},
      create: foundLabels.map((l) => ({ labelId: l.id })),
    };
  }

  const post = await db.post.update({
    where: { id },
    data: {
      ...rest,
      ...(scheduledAt !== undefined
        ? { scheduledAt: scheduledAt ? new Date(scheduledAt) : null }
        : {}),
      ...(labelUpdate ? { labels: labelUpdate } : {}),
    },
    include: postInclude,
  });

  return successResponse(post, undefined, rateLimitResult.headers);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiKey(request, "posts:write");
  if (auth instanceof Response) return auth;

  const rateLimitResult = await checkRateLimit(auth.apiKeyId, auth.plan, "write");
  if (rateLimitResult instanceof Response) return rateLimitResult;

  const { id } = await params;

  const existing = await db.post.findFirst({
    where: { id, workspaceId: auth.workspaceId },
    select: { id: true },
  });

  if (!existing) {
    return errorResponse("Post not found", 404, "NOT_FOUND", rateLimitResult.headers);
  }

  await db.post.delete({ where: { id } });

  return new Response(null, {
    status: 204,
    headers: rateLimitResult.headers,
  });
}
