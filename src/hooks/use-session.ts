"use client";

import { useSession as useNextAuthSession } from "next-auth/react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AppUser {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: string;
}

export interface UseSessionReturn {
  /** The authenticated user, or null when unauthenticated / loading */
  user: AppUser | null;
  /** True while the session is being fetched */
  isLoading: boolean;
  /** True when a valid session exists */
  isAuthenticated: boolean;
  /** True when the user has the SUPER_ADMIN role */
  isAdmin: boolean;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Wraps NextAuth's `useSession` and narrows the session data to the
 * app-specific `AppUser` shape (id + role are always present when authenticated).
 */
export function useSession(): UseSessionReturn {
  const { data: session, status } = useNextAuthSession();

  const isLoading = status === "loading";
  const isAuthenticated = status === "authenticated" && !!session?.user?.id;

  const user: AppUser | null = isAuthenticated
    ? {
        id: session!.user.id,
        name: session!.user.name ?? null,
        email: session!.user.email ?? null,
        image: session!.user.image ?? null,
        role: session!.user.role ?? "USER",
      }
    : null;

  return {
    user,
    isLoading,
    isAuthenticated,
    isAdmin: user?.role === "SUPER_ADMIN" ?? false,
  };
}
