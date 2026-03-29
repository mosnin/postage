import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const createLabelSchema = z.object({
  workspaceId: z.string().min(1, "workspaceId is required"),
  name: z.string().min(1, "Name is required").max(50),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color")
    .default("#6366f1"),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get("workspaceId");

  if (!workspaceId) {
    return NextResponse.json(
      { error: "workspaceId query param is required" },
      { status: 400 }
    );
  }

  const membership = await db.workspaceMember.findFirst({
    where: { workspaceId, userId: session.user.id, status: "ACTIVE" },
  });

  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const labels = await db.label.findMany({
    where: { workspaceId },
    include: {
      _count: { select: { posts: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(labels);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createLabelSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 422 }
    );
  }

  const { workspaceId, name, color } = parsed.data;

  const membership = await db.workspaceMember.findFirst({
    where: { workspaceId, userId: session.user.id, status: "ACTIVE" },
  });

  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Check name uniqueness within workspace
  const existing = await db.label.findFirst({
    where: { workspaceId, name: { equals: name, mode: "insensitive" } },
  });

  if (existing) {
    return NextResponse.json(
      { error: "A label with this name already exists" },
      { status: 409 }
    );
  }

  try {
    const label = await db.label.create({
      data: { workspaceId, name, color },
      include: { _count: { select: { posts: true } } },
    });
    return NextResponse.json(label, { status: 201 });
  } catch (error) {
    console.error("[POST /api/labels]", error);
    return NextResponse.json({ error: "Failed to create label" }, { status: 500 });
  }
}
