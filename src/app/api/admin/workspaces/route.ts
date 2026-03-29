import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

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
    const planFilter = searchParams.get("plan") ?? "ALL";
    const statusFilter = searchParams.get("status") ?? "ALL";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10)));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { slug: { contains: search, mode: "insensitive" } },
        { owner: { email: { contains: search, mode: "insensitive" } } },
      ];
    }

    if (planFilter !== "ALL") {
      where.subscription = { plan: planFilter };
    }

    if (statusFilter !== "ALL") {
      where.subscription = {
        ...where.subscription,
        status: statusFilter,
      };
    }

    const [total, workspaces] = await Promise.all([
      db.workspace.count({ where }),
      db.workspace.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          owner: {
            select: { id: true, name: true, email: true, image: true },
          },
          subscription: {
            select: {
              plan: true,
              status: true,
              currentPeriodEnd: true,
              stripeCustomerId: true,
              stripeSubscriptionId: true,
            },
          },
          _count: {
            select: {
              members: true,
              posts: true,
              socialAccounts: true,
            },
          },
        },
      }),
    ]);

    return NextResponse.json({
      data: workspaces,
      meta: {
        total,
        page,
        pageSize,
        hasNext: page * pageSize < total,
      },
    });
  } catch (error) {
    console.error("[GET /api/admin/workspaces]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
