import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const start = searchParams.get("start");
    const end = searchParams.get("end");
    const workspaceId = searchParams.get("workspaceId");

    if (!start || !end || !workspaceId) {
      return NextResponse.json(
        { error: "Missing required params: start, end, workspaceId" },
        { status: 400 }
      );
    }

    const startDate = new Date(start);
    const endDate = new Date(end);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid date format. Use ISO 8601." },
        { status: 400 }
      );
    }

    // Verify workspace membership
    const membership = await db.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId: session.user.id,
        status: "ACTIVE",
      },
    });

    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const posts = await db.post.findMany({
      where: {
        workspaceId,
        scheduledAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        accounts: {
          include: {
            socialAccount: true,
          },
        },
        labels: {
          include: {
            label: true,
          },
        },
        _count: {
          select: { media: true },
        },
      },
      orderBy: {
        scheduledAt: "asc",
      },
    });

    return NextResponse.json({ posts });
  } catch (error) {
    console.error("[GET /api/posts/calendar]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
