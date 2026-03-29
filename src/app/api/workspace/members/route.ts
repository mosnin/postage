import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { WorkspaceRole } from "@prisma/client";
import { z } from "zod";
import crypto from "crypto";

// Role hierarchy for permission checks
const ROLE_RANK: Record<WorkspaceRole, number> = {
  OWNER: 5,
  ADMIN: 4,
  MANAGER: 3,
  MEMBER: 2,
  VIEWER: 1,
};

/**
 * Assert that the given user has at least `minRole` in the workspace.
 * Returns the member record, or throws a Response-friendly error object.
 */
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

// ─── GET /api/workspace/members ───────────────────────────────────────────────

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

    // Any active member can view the member list
    await assertRole(session.user.id, workspaceId, "VIEWER");

    const members = await db.workspaceMember.findMany({
      where: { workspaceId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
      orderBy: [
        // Owner first, then by role rank descending, then by joinedAt
        { role: "asc" },
        { joinedAt: "asc" },
        { createdAt: "asc" },
      ],
    });

    // Sort by role rank (OWNER first)
    const sorted = members.sort((a, b) => {
      const diff = ROLE_RANK[b.role] - ROLE_RANK[a.role];
      if (diff !== 0) return diff;
      const aDate = a.joinedAt ?? a.createdAt;
      const bDate = b.joinedAt ?? b.createdAt;
      return new Date(aDate).getTime() - new Date(bDate).getTime();
    });

    return NextResponse.json({ members: sorted, total: sorted.length });
  } catch (err: unknown) {
    if (err && typeof err === "object" && "status" in err) {
      const e = err as { status: number; message: string };
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[GET /api/workspace/members]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── POST /api/workspace/members (invite) ─────────────────────────────────────

const inviteSchema = z.object({
  email: z.string().email(),
  role: z
    .nativeEnum(WorkspaceRole)
    .refine((r) => r !== "OWNER", "Cannot invite someone as Owner"),
  message: z.string().max(500).optional(),
});

// Member limits per plan
const MEMBER_LIMITS: Record<string, number> = {
  FREE: 3,
  STARTER: 5,
  PRO: 15,
  PRO_PLUS: 50,
};

export async function POST(request: NextRequest) {
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

    // Only Admin+ can invite
    await assertRole(session.user.id, workspaceId, "ADMIN");

    const body = await request.json();
    const parsed = inviteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { email, role, message } = parsed.data;

    // Check workspace member limit
    const workspace = await db.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        subscription: true,
        _count: { select: { members: true } },
      },
    });

    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const plan = workspace.subscription?.plan ?? "FREE";
    const limit = MEMBER_LIMITS[plan] ?? 3;

    if (workspace._count.members >= limit) {
      return NextResponse.json(
        {
          error: `Member limit reached. Your ${plan} plan supports up to ${limit} members.`,
        },
        { status: 422 }
      );
    }

    // Check if already a member or has a pending invite
    const existing = await db.workspaceMember.findFirst({
      where: {
        workspaceId,
        OR: [
          {
            user: { email },
          },
          { invitedEmail: email },
        ],
      },
    });

    if (existing) {
      if (existing.status === "ACTIVE") {
        return NextResponse.json(
          { error: "This user is already a member of this workspace." },
          { status: 409 }
        );
      }
      if (existing.status === "INVITED") {
        return NextResponse.json(
          { error: "An invitation is already pending for this email address." },
          { status: 409 }
        );
      }
    }

    // Generate invite token
    const inviteToken = crypto.randomBytes(32).toString("hex");
    const inviteExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

    // Find user by email if they already have an account
    const existingUser = await db.user.findUnique({ where: { email } });

    const member = await db.workspaceMember.create({
      data: {
        workspaceId,
        userId: existingUser?.id ?? null,
        role,
        status: "INVITED",
        invitedEmail: email,
        inviteToken,
        inviteExpiresAt,
        invitedAt: new Date(),
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });

    const inviteUrl = `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/invite/${inviteToken}`;

    // TODO: Send invite email via Resend
    // await resend.emails.send({
    //   from: "PostSyncer <noreply@postsyncer.com>",
    //   to: email,
    //   subject: `You've been invited to ${workspace.name} on PostSyncer`,
    //   react: InviteEmail({ workspaceName: workspace.name, inviteUrl, message }),
    // });

    return NextResponse.json({ member, inviteUrl }, { status: 201 });
  } catch (err: unknown) {
    if (err && typeof err === "object" && "status" in err) {
      const e = err as { status: number; message: string };
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[POST /api/workspace/members]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
