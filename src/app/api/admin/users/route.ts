import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import * as bcrypt from "bcryptjs";

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["USER", "SUPER_ADMIN"]).default("USER"),
});

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") ?? "";
    const roleFilter = searchParams.get("role") ?? "ALL";
    const statusFilter = searchParams.get("status") ?? "ALL";
    const sortBy = searchParams.get("sortBy") ?? "createdAt";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10)));

    // Build where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    if (roleFilter !== "ALL") {
      where.role = roleFilter;
    }

    // Map status filter to workspace member status
    if (statusFilter === "SUSPENDED") {
      where.memberships = { some: { status: "SUSPENDED" } };
    } else if (statusFilter === "ACTIVE") {
      where.memberships = { some: { status: "ACTIVE" } };
    }

    const orderByMap: Record<string, object> = {
      createdAt: { createdAt: "desc" },
      lastLoginAt: { lastLoginAt: "desc" },
      name: { name: "asc" },
      email: { email: "asc" },
    };
    const orderBy = orderByMap[sortBy] ?? { createdAt: "desc" };

    const [total, users] = await Promise.all([
      db.user.count({ where }),
      db.user.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          role: true,
          createdAt: true,
          lastLoginAt: true,
          _count: {
            select: { memberships: true },
          },
          memberships: {
            where: { status: "ACTIVE" },
            include: {
              workspace: {
                include: {
                  subscription: {
                    select: { plan: true, status: true },
                  },
                },
              },
            },
          },
          accounts: {
            select: { provider: true },
          },
        },
      }),
    ]);

    return NextResponse.json({
      data: users,
      meta: {
        total,
        page,
        pageSize,
        hasNext: page * pageSize < total,
      },
    });
  } catch (error) {
    console.error("[GET /api/admin/users]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { name, email, password, role } = parsed.data;

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await db.user.create({
      data: { name, email, passwordHash, role },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ data: user }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/admin/users]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
