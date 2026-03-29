"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams, usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WorkspaceSubscription {
  id: string;
  plan: string;
  status: string;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export interface WorkspaceSettings {
  aiCreditsUsed: number;
  aiCreditsLimit: number;
  approvalRequired: boolean;
  defaultTimezone: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  plan: string;
  ownerId: string;
  timezone: string;
  onboardingCompleted: boolean;
  memberRole: string;
  memberStatus: string;
  subscription: WorkspaceSubscription | null;
  settings: WorkspaceSettings | null;
  _count: {
    members: number;
    socialAccounts: number;
    posts: number;
  };
}

// ─── Local storage key ────────────────────────────────────────────────────────

const STORAGE_KEY = "postsyncer:active-workspace";

function getStoredWorkspaceId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function setStoredWorkspaceId(id: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // ignore
  }
}

// ─── Fetchers ─────────────────────────────────────────────────────────────────

async function fetchWorkspaces(): Promise<Workspace[]> {
  const res = await fetch("/api/workspace", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch workspaces");
  return res.json();
}

async function fetchWorkspace(id: string): Promise<Workspace> {
  const res = await fetch(`/api/workspace/${id}`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch workspace");
  return res.json();
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface UseWorkspaceReturn {
  /** The currently active workspace */
  workspace: Workspace | null;
  /** All workspaces the user belongs to */
  workspaces: Workspace[];
  /** Switch the active workspace */
  switchWorkspace: (id: string) => void;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Returns the current workspace context.
 *
 * Resolution order:
 * 1. `workspaceId` param from the URL (e.g. /w/[workspaceId]/…)
 * 2. Value stored in localStorage
 * 3. First workspace in the user's list
 */
export function useWorkspace(): UseWorkspaceReturn {
  const params = useParams<{ workspaceId?: string }>();
  const pathname = usePathname();

  // Derive initial active ID from URL param or stored value
  const urlWorkspaceId = params?.workspaceId ?? null;
  const [activeId, setActiveId] = useState<string | null>(
    urlWorkspaceId ?? getStoredWorkspaceId()
  );

  // Sync URL param changes back into state
  useEffect(() => {
    if (urlWorkspaceId) {
      setActiveId(urlWorkspaceId);
    }
  }, [urlWorkspaceId, pathname]);

  const {
    data: workspaces = [],
    isLoading: listLoading,
    error: listError,
  } = useQuery<Workspace[], Error>({
    queryKey: ["workspaces"],
    queryFn: fetchWorkspaces,
    staleTime: 60_000,
  });

  // Once workspaces load, fall back to the first one if we have no active id
  useEffect(() => {
    if (!activeId && workspaces.length > 0) {
      setActiveId(workspaces[0].id);
    }
  }, [workspaces, activeId]);

  // Determine the resolved workspace id
  const resolvedId = activeId ?? workspaces[0]?.id ?? null;

  const {
    data: workspace = null,
    isLoading: wsLoading,
    error: wsError,
  } = useQuery<Workspace, Error>({
    queryKey: ["workspace", resolvedId],
    queryFn: () => fetchWorkspace(resolvedId!),
    enabled: !!resolvedId,
    staleTime: 60_000,
    // Prefer data already in the workspaces list while re-fetching
    placeholderData: workspaces.find((w) => w.id === resolvedId) ?? undefined,
  });

  const switchWorkspace = useCallback((id: string) => {
    setActiveId(id);
    setStoredWorkspaceId(id);
  }, []);

  return {
    workspace: workspace ?? null,
    workspaces,
    switchWorkspace,
    isLoading: listLoading || wsLoading,
    error: (listError ?? wsError) as Error | null,
  };
}
