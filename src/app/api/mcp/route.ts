import { NextRequest, NextResponse } from "next/server";
import { handleMCPRequest, type MCPRequest } from "@/lib/mcp/server";

export const runtime = "nodejs";

function extractBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  return token || null;
}

function jsonRpcError(id: string | number | null, code: number, message: string) {
  return NextResponse.json(
    { jsonrpc: "2.0", id, error: { code, message } },
    {
      status: 200, // JSON-RPC errors always return HTTP 200
      headers: { "Content-Type": "application/json" },
    }
  );
}

export async function POST(request: NextRequest) {
  // Parse body
  let body: MCPRequest;
  try {
    body = await request.json();
  } catch {
    return jsonRpcError(null, -32700, "Parse error: request body is not valid JSON");
  }

  // Basic JSON-RPC 2.0 structure check
  if (!body || body.jsonrpc !== "2.0" || typeof body.method !== "string") {
    return jsonRpcError(body?.id ?? null, -32600, "Invalid Request: not a valid JSON-RPC 2.0 object");
  }

  // Allow unauthenticated "initialize" and "ping" through — they carry no user data
  const publicMethods = new Set(["initialize", "ping"]);
  const token = extractBearerToken(request) ?? "";

  if (!publicMethods.has(body.method) && !token) {
    return jsonRpcError(
      body.id ?? null,
      -32001,
      "Unauthorized: provide a Bearer token via the Authorization header"
    );
  }

  try {
    const response = await handleMCPRequest(body, token);
    return NextResponse.json(response, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
      },
    });
  } catch (err) {
    console.error("[POST /api/mcp]", err);
    return jsonRpcError(body.id ?? null, -32603, "Internal server error");
  }
}

// Handle CORS preflight
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}
