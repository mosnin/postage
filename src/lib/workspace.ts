import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { PLAN_LIMITS } from "@/lib/utils";
import type { Plan, WorkspaceRole } from "@prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

export type WorkspaceWithMeta = Awaited<ReturnType<typeof getUserWorkspaces>>[number];

// ─── Workspace queries ────────────────────────────────────────────────────────

/**
 * Returns all workspaces the user is an active member of, ordered by join date.
 */
export async function getUserWorkspaces(userId: string) {
  const memberships = await db.workspaceMember.findMany({
    where: { userId, status: "ACTIVE" },
    orderBy: { joinedAt: "asc" },
    include: {
      workspace: {
        include: {
          subscription: true,
          settings: true,
          _count: {
            select: {
              members: { where: { status: "ACTIVE" } },
              socialAccounts: { where: { status: "ACTIVE" } },
              posts: true,
            },
          },
        },
      },
    },
  });

  return memberships.map((m) => ({
    ...m.workspace,
    memberRole: m.role,
    memberStatus: m.status,
  }));
}

/**
 * Returns a single workspace if the user is an active member.
 * Throws a 403 NextResponse if access is denied.
 */
export async function getWorkspaceForUser(workspaceId: string, userId: string) {
  const membership = await db.workspaceMember.findUnique({
    where: {
      workspaceId_userId: { workspaceId, userId },
    },
    include: {
      workspace: {
        include: {
          subscription: true,
          settings: true,
          _count: {
            select: {
              members: { where: { status: "ACTIVE" } },
              socialAccounts: { where: { status: "ACTIVE" } },
              posts: true,
            },
          },
        },
      },
    },
  });

  if (!membership || membership.status !== "ACTIVE") {
    throw NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return {
    ...membership.workspace,
    memberRole: membership.role,
    memberStatus: membership.status,
  };
}

/**
 * Returns the user's default workspace: the first workspace they own,
 * or the first workspace they are a member of (by join date).
 * Returns null when the user has no active memberships.
 */
export async function getDefaultWorkspace(userId: string) {
  // Prefer owned workspaces first
  const owned = await db.workspaceMember.findFirst({
    where: { userId, status: "ACTIVE", role: "OWNER" },
    orderBy: { joinedAt: "asc" },
    include: {
      workspace: {
        include: {
          subscription: true,
          settings: true,
          _count: {
            select: {
              members: { where: { status: "ACTIVE" } },
              socialAccounts: { where: { status: "ACTIVE" } },
              posts: true,
            },
          },
        },
      },
    },
  });

  if (owned) {
    return { ...owned.workspace, memberRole: owned.role, memberStatus: owned.status };
  }

  const first = await db.workspaceMember.findFirst({
    where: { userId, status: "ACTIVE" },
    orderBy: { joinedAt: "asc" },
    include: {
      workspace: {
        include: {
          subscription: true,
          settings: true,
          _count: {
            select: {
              members: { where: { status: "ACTIVE" } },
              socialAccounts: { where: { status: "ACTIVE" } },
              posts: true,
            },
          },
        },
      },
    },
  });

  if (!first) return null;
  return { ...first.workspace, memberRole: first.role, memberStatus: first.status };
}

// ─── Limit checks ─────────────────────────────────────────────────────────────

/**
 * Checks whether the workspace has reached its connected-account limit for
 * its current plan. Returns the current count and the maximum allowed.
 */
export async function checkAccountLimit(
  workspaceId: string
): Promise<{ atLimit: boolean; current: number; max: number }> {
  const workspace = await db.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
    select: { plan: true },
  });

  const current = await db.socialAccount.count({
    where: { workspaceId, status: { not: "DISCONNECTED" } },
  });

  const max = PLAN_LIMITS[workspace.plan as Plan].accounts;

  return { atLimit: current >= max, current, max };
}

/**
 * Checks whether the workspace has reached its media storage limit.
 * Aggregates the `size` field of all MediaFile rows for the workspace.
 */
export async function checkStorageLimit(
  workspaceId: string
): Promise<{ atLimit: boolean; usedBytes: number; maxBytes: number }> {
  const workspace = await db.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
    select: { plan: true },
  });

  const agg = await db.mediaFile.aggregate({
    where: { workspaceId },
    _sum: { size: true },
  });

  const usedBytes = agg._sum.size ?? 0;
  const maxBytes = PLAN_LIMITS[workspace.plan as Plan].storage;

  return {
    atLimit: maxBytes !== Infinity && usedBytes >= maxBytes,
    usedBytes,
    maxBytes,
  };
}

// ─── Role assertion ───────────────────────────────────────────────────────────

const ROLE_RANK: Record<WorkspaceRole, number> = {
  VIEWER: 0,
  MEMBER: 1,
  MANAGER: 2,
  ADMIN: 3,
  OWNER: 4,
};

/**
 * Asserts that the user holds at least `minRole` in the workspace.
 * Throws a 403 NextResponse when the check fails.
 */
export async function assertWorkspaceRole(
  userId: string,
  workspaceId: string,
  minRole: WorkspaceRole
): Promise<void> {
  const membership = await db.workspaceMember.findUnique({
    where: {
      workspaceId_userId: { workspaceId, userId },
    },
    select: { role: true, status: true },
  });

  if (
    !membership ||
    membership.status !== "ACTIVE" ||
    ROLE_RANK[membership.role] < ROLE_RANK[minRole]
  ) {
    throw NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
}
