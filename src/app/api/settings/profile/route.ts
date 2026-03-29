import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import * as bcrypt from "bcryptjs";

export async function GET(_request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        passwordHash: true,
        accounts: { select: { provider: true } },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        hasPassword: !!user.passwordHash,
        oauthProviders: user.accounts.map((a) => a.provider),
      },
    });
  } catch (error) {
    console.error("[GET /api/settings/profile]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

const patchSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    image: z.string().url().nullable().optional(),
    currentPassword: z.string().optional(),
    newPassword: z.string().min(8).max(100).optional(),
    confirmPassword: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.newPassword || data.currentPassword) {
        return !!(data.currentPassword && data.newPassword && data.confirmPassword);
      }
      return true;
    },
    {
      message: "All password fields are required when changing password",
      path: ["currentPassword"],
    }
  )
  .refine(
    (data) => {
      if (data.newPassword && data.confirmPassword) {
        return data.newPassword === data.confirmPassword;
      }
      return true;
    },
    {
      message: "Passwords do not match",
      path: ["confirmPassword"],
    }
  );

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { name, image, currentPassword, newPassword } = parsed.data;

    const user = await db.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Handle password change
    if (currentPassword && newPassword) {
      if (!user.passwordHash) {
        return NextResponse.json(
          { error: "Password change is not available for OAuth accounts" },
          { status: 400 }
        );
      }

      const valid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!valid) {
        return NextResponse.json(
          { error: "Current password is incorrect" },
          { status: 400 }
        );
      }

      const newHash = await bcrypt.hash(newPassword, 12);

      const updatedUser = await db.user.update({
        where: { id: session.user.id },
        data: {
          ...(name !== undefined && { name }),
          ...(image !== undefined && { image }),
          passwordHash: newHash,
        },
        select: { id: true, name: true, email: true, image: true },
      });

      return NextResponse.json({ user: updatedUser });
    }

    // Handle profile update without password change
    const updatedUser = await db.user.update({
      where: { id: session.user.id },
      data: {
        ...(name !== undefined && { name }),
        ...(image !== undefined && { image }),
      },
      select: { id: true, name: true, email: true, image: true },
    });

    return NextResponse.json({ user: updatedUser });
  } catch (error) {
    console.error("[PATCH /api/settings/profile]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
