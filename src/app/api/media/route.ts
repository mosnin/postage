import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PLAN_LIMITS } from "@/lib/utils";
import { z } from "zod";
import { Plan } from "@prisma/client";

// ─── GET /api/media ───────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId");
    const search = searchParams.get("search") ?? "";
    const type = searchParams.get("type") ?? "all"; // all | image | video | gif
    const folderId = searchParams.get("folderId"); // null = root
    const sort = searchParams.get("sort") ?? "newest"; // newest | oldest | name | size
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const pageSize = 40;

    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
    }

    // Verify workspace membership
    const membership = await db.workspaceMember.findFirst({
      where: { workspaceId, userId: session.user.id, status: "ACTIVE" },
    });
    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Build mime type filter
    const mimeFilter: string[] = [];
    if (type === "image") mimeFilter.push("image/jpeg", "image/png", "image/webp");
    if (type === "video") mimeFilter.push("video/mp4", "video/quicktime");
    if (type === "gif") mimeFilter.push("image/gif");

    // Build sort order
    type OrderBy =
      | { createdAt: "asc" | "desc" }
      | { name: "asc" | "desc" }
      | { size: "asc" | "desc" };
    const orderBy: OrderBy =
      sort === "oldest"
        ? { createdAt: "asc" }
        : sort === "name"
        ? { name: "asc" }
        : sort === "size"
        ? { size: "desc" }
        : { createdAt: "desc" };

    const where = {
      workspaceId,
      ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
      ...(mimeFilter.length > 0 ? { mimeType: { in: mimeFilter } } : {}),
      ...(folderId !== null ? { folderId: folderId || null } : {}),
    };

    const [files, total, storageAgg] = await Promise.all([
      db.mediaFile.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.mediaFile.count({ where }),
      db.mediaFile.aggregate({
        where: { workspaceId },
        _sum: { size: true },
      }),
    ]);

    const storageUsed = storageAgg._sum.size ?? 0;

    return NextResponse.json({
      files,
      meta: {
        total,
        page,
        pageSize,
        hasNext: page * pageSize < total,
        storageUsed,
      },
    });
  } catch (error) {
    console.error("[GET /api/media]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── POST /api/media ──────────────────────────────────────────────────────────

const createSchema = z.object({
  workspaceId: z.string().min(1),
  name: z.string().min(1),
  url: z.string().url(),
  mimeType: z.string().min(1),
  size: z.number().positive(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  duration: z.number().positive().optional(),
  folderId: z.string().optional(),
});

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
        { error: "Invalid request", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { workspaceId, name, url, mimeType, size, width, height, duration, folderId } =
      parsed.data;

    // Verify workspace membership
    const membership = await db.workspaceMember.findFirst({
      where: { workspaceId, userId: session.user.id, status: "ACTIVE" },
      include: {
        workspace: {
          include: { subscription: true },
        },
      },
    });
    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check storage quota
    const plan: Plan = membership.workspace.subscription?.plan ?? "FREE";
    const storageLimit = (PLAN_LIMITS as Record<string, { storage: number }>)[plan]?.storage ?? 0;

    if (storageLimit !== Infinity) {
      const storageAgg = await db.mediaFile.aggregate({
        where: { workspaceId },
        _sum: { size: true },
      });
      const storageUsed = storageAgg._sum.size ?? 0;

      if (storageUsed + size > storageLimit) {
        return NextResponse.json(
          { error: "Storage quota exceeded. Please upgrade your plan or delete some files." },
          { status: 422 }
        );
      }
    }

    const mediaFile = await db.mediaFile.create({
      data: {
        workspaceId,
        name,
        url,
        mimeType,
        size,
        width,
        height,
        duration,
        folderId: folderId ?? null,
        source: "upload",
      },
    });

    return NextResponse.json(mediaFile, { status: 201 });
  } catch (error) {
    console.error("[POST /api/media]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
