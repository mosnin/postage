import { createHash } from "crypto";
import { db } from "@/lib/db";
import { errorResponse } from "./response";

export interface AuthContext {
  apiKeyId: string;
  workspaceId: string;
  userId: string;
  scopes: string[];
  plan: string;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Authenticates a request using a Bearer token from the Authorization header.
 * Returns an AuthContext on success, or a 401 Response on failure.
 */
export async function authenticateApiKey(
  request: Request,
  requiredScope?: string
): Promise<AuthContext | Response> {
  const authHeader = request.headers.get("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return errorResponse(
      "Missing or invalid Authorization header. Use: Bearer <api_key>",
      401,
      "MISSING_AUTH"
    );
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return errorResponse("Empty API key", 401, "MISSING_AUTH");
  }

  const keyHash = hashToken(token);

  const apiKey = await db.apiKey.findUnique({
    where: { keyHash },
    include: {
      workspace: {
        select: {
          id: true,
          plan: true,
        },
      },
    },
  });

  if (!apiKey) {
    return errorResponse("Invalid API key", 401, "INVALID_API_KEY");
  }

  // Check expiry
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    return errorResponse("API key has expired", 401, "API_KEY_EXPIRED");
  }

  // Check required scope
  if (requiredScope && !apiKey.scopes.includes(requiredScope)) {
    return errorResponse(
      `Insufficient scope. Required: ${requiredScope}`,
      403,
      "INSUFFICIENT_SCOPE"
    );
  }

  // Update lastUsedAt in the background (fire and forget)
  db.apiKey
    .update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {
      // non-critical
    });

  return {
    apiKeyId: apiKey.id,
    workspaceId: apiKey.workspaceId,
    userId: apiKey.userId,
    scopes: apiKey.scopes,
    plan: apiKey.workspace.plan,
  };
}
