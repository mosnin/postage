import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const updateLabelSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color")
    .optional(),
});

async function getLabel(labelId: string, userId: string) {
  const label = await db.label.findUnique({
    where: { id: labelId },
    include: { _count: { select: { posts: true } } },
  });
  if (!label) return { label: null, membership: null };

  const membership = await db.workspaceMember.findFirst({
    where: { workspaceId: label.workspaceId, userId, status: "ACTIVE" },
  });
  return { label, membership };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { label, membership } = await getLabel(id, session.user.id);

  if (!label) {
    return NextResponse.json({ error: "Label not found" }, { status: 404 });
  }
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateLabelSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 422 }
    );
  }

  const { name, color } = parsed.data;

  // Check name uniqueness if changing name
  if (name && name !== label.name) {
    const existing = await db.label.findFirst({
      where: {
        workspaceId: label.workspaceId,
        name: { equals: name, mode: "insensitive" },
        id: { not: id },
      },
    });
    if (existing) {
      return NextResponse.json(
        { error: "A label with this name already exists" },
        { status: 409 }
      );
    }
  }

  try {
    const updated = await db.label.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(color !== undefined ? { color } : {}),
      },
      include: { _count: { select: { posts: true } } },
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("[PATCH /api/labels/:id]", error);
    return NextResponse.json({ error: "Failed to update label" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { label, membership } = await getLabel(id, session.user.id);

  if (!label) {
    return NextResponse.json({ error: "Label not found" }, { status: 404 });
  }
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // PostLabel records cascade via Prisma schema (onDelete: Cascade)
    await db.label.delete({ where: { id } });
    return NextResponse.json(
      { message: "Label deleted", postCount: label._count.posts },
      { status: 200 }
    );
  } catch (error) {
    console.error("[DELETE /api/labels/:id]", error);
    return NextResponse.json({ error: "Failed to delete label" }, { status: 500 });
  }
}
