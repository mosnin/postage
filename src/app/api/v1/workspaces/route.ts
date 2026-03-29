import { db } from "@/lib/db";
import { authenticateApiKey } from "@/lib/api/auth";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { paginatedResponse } from "@/lib/api/response";

export async function GET(request: Request) {
  // No specific scope required — base API access is sufficient
  const auth = await authenticateApiKey(request);
  if (auth instanceof Response) return auth;

  const rateLimitResult = await checkRateLimit(auth.apiKeyId, auth.plan, "read");
  if (rateLimitResult instanceof Response) return rateLimitResult;

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("pageSize") ?? "20", 10)));

  const where = {
    members: {
      some: {
        userId: auth.userId,
        status: "ACTIVE" as const,
      },
    },
  };

  const [total, workspaces] = await Promise.all([
    db.workspace.count({ where }),
    db.workspace.findMany({
      where,
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        plan: true,
        timezone: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            socialAccounts: true,
            members: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return paginatedResponse(workspaces, total, page, pageSize, rateLimitResult.headers);
}
