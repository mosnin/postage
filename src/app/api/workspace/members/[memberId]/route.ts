import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { WorkspaceRole, MemberStatus } from "@prisma/client";
import { z } from "zod";
import crypto from "crypto";

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

// ─── PATCH /api/workspace/members/[memberId] ──────────────────────────────────

const patchSchema = z
  .object({
    role: z.nativeEnum(WorkspaceRole).optional(),
    status: z.enum(["SUSPENDED", "ACTIVE"]).optional(),
  })
  .refine((d) => d.role !== undefined || d.status !== undefined, {
    message: "At least one of role or status must be provided",
  });

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { memberId } = await params;

    // Find the target member
    const targetMember = await db.workspaceMember.findUnique({
      where: { id: memberId },
    });

    if (!targetMember) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Requester must be Admin+
    const requester = await assertRole(
      session.user.id,
      targetMember.workspaceId,
      "ADMIN"
    );

    // Cannot change the Owner's role
    if (targetMember.role === "OWNER") {
      return NextResponse.json(
        { error: "Cannot modify the workspace owner's role" },
        { status: 403 }
      );
    }

    // Admin cannot modify other admins (only Owner can)
    if (
      targetMember.role === "ADMIN" &&
      requester.role !== "OWNER"
    ) {
      return NextResponse.json(
        { error: "Only the workspace owner can modify an admin's role" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { role, status } = parsed.data;

    // If setting a new role to ADMIN, only OWNER can do that
    if (role === "ADMIN" && requester.role !== "OWNER") {
      return NextResponse.json(
        { error: "Only the workspace owner can promote someone to Admin" },
        { status: 403 }
      );
    }

    const updated = await db.workspaceMember.update({
      where: { id: memberId },
      data: {
        ...(role !== undefined ? { role } : {}),
        ...(status !== undefined ? { status: status as MemberStatus } : {}),
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });

    return NextResponse.json({ member: updated });
  } catch (err: unknown) {
    if (err && typeof err === "object" && "status" in err) {
      const e = err as { status: number; message: string };
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[PATCH /api/workspace/members/[memberId]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── DELETE /api/workspace/members/[memberId] ─────────────────────────────────

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { memberId } = await params;

    const targetMember = await db.workspaceMember.findUnique({
      where: { id: memberId },
    });

    if (!targetMember) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Requester must be Admin+
    const requester = await assertRole(
      session.user.id,
      targetMember.workspaceId,
      "ADMIN"
    );

    // Cannot remove the Owner
    if (targetMember.role === "OWNER") {
      return NextResponse.json(
        {
          error:
            "Cannot remove the workspace owner. Transfer ownership first.",
        },
        { status: 403 }
      );
    }

    // Cannot remove yourself unless you're not the only admin
    if (targetMember.userId === session.user.id) {
      return NextResponse.json(
        {
          error:
            "You cannot remove yourself from the workspace. Transfer ownership or ask another admin to do this.",
        },
        { status: 403 }
      );
    }

    // Admin cannot remove other admins (only Owner can)
    if (targetMember.role === "ADMIN" && requester.role !== "OWNER") {
      return NextResponse.json(
        { error: "Only the workspace owner can remove an admin" },
        { status: 403 }
      );
    }

    await db.workspaceMember.delete({ where: { id: memberId } });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    if (err && typeof err === "object" && "status" in err) {
      const e = err as { status: number; message: string };
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[DELETE /api/workspace/members/[memberId]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── POST /api/workspace/members/[memberId]/resend ────────────────────────────
// Note: this is handled via a sub-route pattern, but we add resend logic here
// as a POST to this same route when the action query param is "resend"
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { memberId } = await params;

    const targetMember = await db.workspaceMember.findUnique({
      where: { id: memberId },
    });

    if (!targetMember) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    if (targetMember.status !== "INVITED") {
      return NextResponse.json(
        { error: "Member is not in a pending invite state" },
        { status: 400 }
      );
    }

    // Requester must be Admin+
    await assertRole(session.user.id, targetMember.workspaceId, "ADMIN");

    // Refresh token and expiry
    const newToken = crypto.randomBytes(32).toString("hex");
    const newExpiry = new Date(Date.now() + 48 * 60 * 60 * 1000);

    const updated = await db.workspaceMember.update({
      where: { id: memberId },
      data: {
        inviteToken: newToken,
        inviteExpiresAt: newExpiry,
        invitedAt: new Date(),
      },
    });

    const inviteUrl = `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/invite/${newToken}`;

    // TODO: Re-send invite email via Resend

    return NextResponse.json({ member: updated, inviteUrl });
  } catch (err: unknown) {
    if (err && typeof err === "object" && "status" in err) {
      const e = err as { status: number; message: string };
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[POST /api/workspace/members/[memberId]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
