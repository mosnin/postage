import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { WorkspaceRole } from "@prisma/client";
import { z } from "zod";

const ROLE_RANK: Record<WorkspaceRole, number> = {
  OWNER: 5,
  ADMIN: 4,
  MANAGER: 3,
  MEMBER: 2,
  VIEWER: 1,
};

async function assertRole(
  userId: string,
  workspaceId: string,
  minRole: WorkspaceRole
) {
  const member = await db.workspaceMember.findFirst({
    where: { userId, workspaceId, status: "ACTIVE" },
  });

  if (!member) {
    throw { status: 403, message: "Forbidden: not a workspace member" };
  }

  if (ROLE_RANK[member.role] < ROLE_RANK[minRole]) {
    throw {
      status: 403,
      message: `Forbidden: requires ${minRole} or higher`,
    };
  }

  return member;
}

// ─── GET /api/workspace/settings ──────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = request.nextUrl.searchParams.get("workspaceId");
    if (!workspaceId) {
      return NextResponse.json(
        { error: "workspaceId is required" },
        { status: 400 }
      );
    }

    await assertRole(session.user.id, workspaceId, "VIEWER");

    const workspace = await db.workspace.findUnique({
      where: { id: workspaceId },
      include: { settings: true },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ workspace });
  } catch (err: unknown) {
    if (err && typeof err === "object" && "status" in err) {
      const e = err as { status: number; message: string };
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[GET /api/workspace/settings]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── PATCH /api/workspace/settings ────────────────────────────────────────────

const patchSchema = z.object({
  workspaceId: z.string().min(1),
  name: z.string().min(1).max(64).optional(),
  slug: z
    .string()
    .min(2)
    .max(48)
    .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens")
    .optional(),
  timezone: z.string().min(1).optional(),
  logoUrl: z.string().url().nullable().optional(),
  approvalRequired: z.boolean().optional(),
});

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { workspaceId, name, slug, timezone, logoUrl, approvalRequired } =
      parsed.data;

    // Admin+ required to update settings
    await assertRole(session.user.id, workspaceId, "ADMIN");

    // Check slug uniqueness if updating
    if (slug) {
      const existing = await db.workspace.findFirst({
        where: { slug, id: { not: workspaceId } },
      });
      if (existing) {
        return NextResponse.json(
          { error: "This slug is already taken. Please choose a different one." },
          { status: 409 }
        );
      }
    }

    // Update workspace fields
    const workspaceUpdate: Record<string, unknown> = {};
    if (name !== undefined) workspaceUpdate.name = name;
    if (slug !== undefined) workspaceUpdate.slug = slug;
    if (timezone !== undefined) workspaceUpdate.timezone = timezone;
    if (logoUrl !== undefined) workspaceUpdate.logoUrl = logoUrl;

    const workspace = await db.workspace.update({
      where: { id: workspaceId },
      data: workspaceUpdate,
      include: { settings: true },
    });

    // Update workspace settings
    if (approvalRequired !== undefined || timezone !== undefined) {
      const settingsUpdate: Record<string, unknown> = {};
      if (approvalRequired !== undefined)
        settingsUpdate.approvalRequired = approvalRequired;
      if (timezone !== undefined)
        settingsUpdate.defaultTimezone = timezone;

      await db.workspaceSettings.upsert({
        where: { workspaceId },
        create: {
          workspaceId,
          ...settingsUpdate,
        },
        update: settingsUpdate,
      });
    }

    const updatedWorkspace = await db.workspace.findUnique({
      where: { id: workspaceId },
      include: { settings: true },
    });

    return NextResponse.json({ workspace: updatedWorkspace });
  } catch (err: unknown) {
    if (err && typeof err === "object" && "status" in err) {
      const e = err as { status: number; message: string };
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[PATCH /api/workspace/settings]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── DELETE /api/workspace/settings (delete workspace) ────────────────────────

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = request.nextUrl.searchParams.get("workspaceId");
    if (!workspaceId) {
      return NextResponse.json(
        { error: "workspaceId is required" },
        { status: 400 }
      );
    }

    // Only the Owner can delete the workspace
    const member = await db.workspaceMember.findFirst({
      where: { userId: session.user.id, workspaceId, status: "ACTIVE" },
    });

    if (!member || member.role !== "OWNER") {
      return NextResponse.json(
        { error: "Only the workspace owner can delete this workspace." },
        { status: 403 }
      );
    }

    await db.workspace.delete({ where: { id: workspaceId } });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    if (err && typeof err === "object" && "status" in err) {
      const e = err as { status: number; message: string };
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[DELETE /api/workspace/settings]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
