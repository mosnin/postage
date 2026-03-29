export interface PaginationMeta {
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
}

interface RateLimitHeaders {
  "X-RateLimit-Limit"?: string;
  "X-RateLimit-Remaining"?: string;
}

const BASE_HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
};

export function successResponse<T>(
  data: T,
  meta?: PaginationMeta,
  rateLimitHeaders?: RateLimitHeaders
): Response {
  const body = meta ? { data, meta } : { data };
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      ...BASE_HEADERS,
      ...rateLimitHeaders,
    },
  });
}

export function errorResponse(
  message: string,
  status: number,
  code?: string,
  rateLimitHeaders?: RateLimitHeaders
): Response {
  const body: { error: string; code?: string } = { error: message };
  if (code) body.code = code;
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...BASE_HEADERS,
      ...rateLimitHeaders,
    },
  });
}

export function paginatedResponse<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number,
  rateLimitHeaders?: RateLimitHeaders
): Response {
  const meta: PaginationMeta = {
    total,
    page,
    pageSize,
    hasNext: page * pageSize < total,
  };
  return successResponse(items, meta, rateLimitHeaders);
}
