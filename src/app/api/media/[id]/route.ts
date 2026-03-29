import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Find the file and verify workspace membership in one query
    const mediaFile = await db.mediaFile.findUnique({
      where: { id },
      include: {
        workspace: {
          include: {
            members: {
              where: { userId: session.user.id, status: "ACTIVE" },
            },
          },
        },
      },
    });

    if (!mediaFile) {
      return NextResponse.json({ error: "Media file not found" }, { status: 404 });
    }

    if (mediaFile.workspace.members.length === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // In production: delete from Vercel Blob / S3 here
    // e.g. await del(mediaFile.url);

    await db.mediaFile.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/media/[id]]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const mediaFile = await db.mediaFile.findUnique({
      where: { id },
      include: {
        workspace: {
          include: {
            members: {
              where: { userId: session.user.id, status: "ACTIVE" },
            },
          },
        },
      },
    });

    if (!mediaFile) {
      return NextResponse.json({ error: "Media file not found" }, { status: 404 });
    }

    if (mediaFile.workspace.members.length === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(mediaFile);
  } catch (error) {
    console.error("[GET /api/media/[id]]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
