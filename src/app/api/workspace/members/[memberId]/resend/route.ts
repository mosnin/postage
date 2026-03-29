import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { WorkspaceRole } from "@prisma/client";
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
    throw { status: 403, message: `Forbidden: requires ${minRole} or higher` };
  }
  return member;
}

// ─── POST /api/workspace/members/[memberId]/resend ────────────────────────────

export async function POST(
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
      include: {
        workspace: { select: { id: true, name: true } },
      },
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
    console.error("[POST /api/workspace/members/[memberId]/resend]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
