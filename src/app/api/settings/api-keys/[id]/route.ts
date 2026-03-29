import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;

    // Find the key and verify it belongs to a workspace the user is admin+ in
    const apiKey = await db.apiKey.findUnique({
      where: { id },
      include: {
        workspace: {
          include: {
            members: {
              where: {
                userId: session.user.id,
                status: "ACTIVE",
                role: { in: ["OWNER", "ADMIN"] },
              },
            },
          },
        },
      },
    });

    if (!apiKey) {
      return NextResponse.json({ error: "API key not found" }, { status: 404 });
    }

    if (apiKey.workspace.members.length === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await db.apiKey.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/settings/api-keys/[id]]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
