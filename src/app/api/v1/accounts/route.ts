import { db } from "@/lib/db";
import { authenticateApiKey } from "@/lib/api/auth";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { paginatedResponse } from "@/lib/api/response";
import { Platform, AccountStatus } from "@prisma/client";

export async function GET(request: Request) {
  const auth = await authenticateApiKey(request, "accounts:read");
  if (auth instanceof Response) return auth;

  const rateLimitResult = await checkRateLimit(auth.apiKeyId, auth.plan, "read");
  if (rateLimitResult instanceof Response) return rateLimitResult;

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("pageSize") ?? "20", 10)));
  const platform = url.searchParams.get("platform") as Platform | null;
  const status = url.searchParams.get("status") as AccountStatus | null;

  const where = {
    workspaceId: auth.workspaceId,
    ...(platform ? { platform } : {}),
    ...(status ? { status } : {}),
  };

  const [total, accounts] = await Promise.all([
    db.socialAccount.count({ where }),
    db.socialAccount.findMany({
      where,
      select: {
        id: true,
        platform: true,
        platformId: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        status: true,
        connectedAt: true,
        updatedAt: true,
        _count: { select: { posts: true } },
      },
      orderBy: { connectedAt: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return paginatedResponse(accounts, total, page, pageSize, rateLimitResult.headers);
}
