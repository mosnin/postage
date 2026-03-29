import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(_request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const membership = await db.workspaceMember.findFirst({
      where: {
        userId: session.user.id,
        status: "ACTIVE",
        role: { in: ["OWNER", "ADMIN"] },
      },
      orderBy: { joinedAt: "asc" },
      select: { workspaceId: true },
    });

    if (!membership) {
      return NextResponse.json({ error: "No admin workspace found" }, { status: 404 });
    }

    return NextResponse.json({ workspaceId: membership.workspaceId });
  } catch (error) {
    console.error("[GET /api/settings/workspace-id]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
