import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// ─── GET /api/workspace/invites/[token] (accept invite) ───────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { token } = await params;

    // Find the pending invite
    const invite = await db.workspaceMember.findUnique({
      where: { inviteToken: token },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
          },
        },
      },
    });

    if (!invite) {
      return NextResponse.json(
        { error: "Invite not found or has already been used." },
        { status: 404 }
      );
    }

    if (invite.status !== "INVITED") {
      return NextResponse.json(
        { error: "This invite has already been accepted or is no longer valid." },
        { status: 410 }
      );
    }

    // Check expiry (48 hours)
    if (
      invite.inviteExpiresAt &&
      new Date(invite.inviteExpiresAt) < new Date()
    ) {
      return NextResponse.json(
        {
          error:
            "This invite link has expired. Please ask a workspace admin to send a new invite.",
        },
        { status: 410 }
      );
    }

    // Check that the accepting user's email matches (if invite was email-specific)
    const currentUser = await db.user.findUnique({
      where: { id: session.user.id },
      select: { email: true },
    });

    if (
      invite.invitedEmail &&
      currentUser?.email &&
      invite.invitedEmail.toLowerCase() !== currentUser.email.toLowerCase()
    ) {
      return NextResponse.json(
        {
          error: `This invite was sent to ${invite.invitedEmail}. Please sign in with that email address to accept it.`,
        },
        { status: 403 }
      );
    }

    // Check the user isn't already a member of this workspace
    const existingMembership = await db.workspaceMember.findFirst({
      where: {
        workspaceId: invite.workspaceId,
        userId: session.user.id,
        id: { not: invite.id },
      },
    });

    if (existingMembership) {
      return NextResponse.json(
        { error: "You are already a member of this workspace." },
        { status: 409 }
      );
    }

    // Accept the invite
    const accepted = await db.workspaceMember.update({
      where: { id: invite.id },
      data: {
        userId: session.user.id,
        status: "ACTIVE",
        joinedAt: new Date(),
        inviteToken: null,
        inviteExpiresAt: null,
      },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
          },
        },
      },
    });

    return NextResponse.json({
      workspace: accepted.workspace,
      role: accepted.role,
      message: `You have joined ${accepted.workspace.name}.`,
    });
  } catch (err: unknown) {
    console.error("[GET /api/workspace/invites/[token]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
