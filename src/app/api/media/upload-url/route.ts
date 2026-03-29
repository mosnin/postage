import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const requestSchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  size: z.number().positive(),
  workspaceId: z.string().min(1),
});

const ACCEPTED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "video/mp4",
  "video/quicktime",
]);

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { fileName, mimeType, size, workspaceId } = parsed.data;

    // Verify workspace membership
    const membership = await db.workspaceMember.findFirst({
      where: { workspaceId, userId: session.user.id, status: "ACTIVE" },
    });
    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Validate mime type
    if (!ACCEPTED_MIME_TYPES.has(mimeType)) {
      return NextResponse.json(
        { error: "Unsupported file type. Accepted: JPEG, PNG, GIF, WebP, MP4, MOV" },
        { status: 400 }
      );
    }

    // Validate file size
    if (size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File exceeds the 500 MB size limit" },
        { status: 400 }
      );
    }

    // Generate a unique file ID and construct paths
    const fileId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const ext = fileName.split(".").pop() ?? "";
    const storedName = `${fileId}${ext ? `.${ext}` : ""}`;

    // In production this would call Vercel Blob / S3 presign.
    // In development we return a direct upload path to a local API route.
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const uploadUrl = `${appUrl}/api/media/upload-direct?fileId=${fileId}&workspaceId=${workspaceId}`;
    const publicUrl = `${appUrl}/uploads/${workspaceId}/${storedName}`;

    return NextResponse.json({ uploadUrl, publicUrl, fileId });
  } catch (error) {
    console.error("[POST /api/media/upload-url]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
