import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateApiKey } from "@/lib/utils";
import { z } from "zod";
import * as crypto from "crypto";

const ALLOWED_SCOPES = [
  "posts:read",
  "posts:write",
  "accounts:read",
  "analytics:read",
  "comments:read",
  "comments:write",
  "labels:read",
  "labels:write",
  "campaigns:read",
  "campaigns:write",
] as const;

const createSchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.enum(ALLOWED_SCOPES)).min(1),
  workspaceId: z.string(),
  expiresAt: z.string().datetime().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId");

    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
    }

    // Verify user is admin+ in this workspace
    const membership = await db.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId: session.user.id,
        status: "ACTIVE",
        role: { in: ["OWNER", "ADMIN"] },
      },
    });

    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const apiKeys = await db.apiKey.findMany({
      where: { workspaceId },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
        user: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ apiKeys });
  } catch (error) {
    console.error("[GET /api/settings/api-keys]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { name, scopes, workspaceId, expiresAt } = parsed.data;

    // Verify user is admin+ in this workspace
    const membership = await db.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId: session.user.id,
        status: "ACTIVE",
        role: { in: ["OWNER", "ADMIN"] },
      },
    });

    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Generate the raw key (shown once)
    const rawKey = generateApiKey();

    // Hash it for storage
    const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

    // Store prefix for display (first 10 chars: "ps_" + 7 chars)
    const keyPrefix = rawKey.slice(0, 10);

    const apiKey = await db.apiKey.create({
      data: {
        workspaceId,
        userId: session.user.id,
        name,
        keyHash,
        keyPrefix,
        scopes,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    // Return the full raw key once — it cannot be retrieved again
    return NextResponse.json({ apiKey, rawKey }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/settings/api-keys]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
