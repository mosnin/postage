import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const patchSchema = z.object({
  role: z.enum(["USER", "SUPER_ADMIN"]).optional(),
  suspended: z.boolean().optional(),
}).refine((d) => d.role !== undefined || d.suspended !== undefined, {
  message: "At least one field (role or suspended) must be provided",
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const user = await db.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        createdAt: true,
        lastLoginAt: true,
        accounts: {
          select: {
            provider: true,
            providerAccountId: true,
          },
        },
        memberships: {
          include: {
            workspace: {
              include: {
                subscription: {
                  select: { plan: true, status: true, currentPeriodEnd: true },
                },
                _count: {
                  select: { members: true, posts: true, socialAccounts: true },
                },
              },
            },
          },
          orderBy: { joinedAt: "desc" },
        },
        activityLogs: {
          take: 20,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            action: true,
            entityType: true,
            entityId: true,
            metadata: true,
            createdAt: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ data: user });
  } catch (error) {
    console.error("[GET /api/admin/users/[id]]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const existingUser = await db.user.findUnique({ where: { id } });
    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Prevent self-demotion
    if (parsed.data.role && id === session.user.id && parsed.data.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Cannot change your own role" },
        { status: 400 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {};
    if (parsed.data.role !== undefined) {
      updateData.role = parsed.data.role;
    }

    // Handle suspend: update all workspace memberships
    if (parsed.data.suspended !== undefined) {
      const newStatus = parsed.data.suspended ? "SUSPENDED" : "ACTIVE";
      await db.workspaceMember.updateMany({
        where: { userId: id },
        data: { status: newStatus },
      });
    }

    const user = await db.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });

    return NextResponse.json({ data: user });
  } catch (error) {
    console.error("[PATCH /api/admin/users/[id]]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    if (id === session.user.id) {
      return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
    }

    const existingUser = await db.user.findUnique({ where: { id } });
    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await db.user.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/admin/users/[id]]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
