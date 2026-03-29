import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PLATFORM_LABELS, PLATFORM_COLORS } from "@/lib/utils";

interface PageProps {
  params: Promise<{ platform: string }>;
  searchParams: Promise<{ workspaceId?: string; error?: string }>;
}

/**
 * OAuth connect redirect page.
 *
 * This is a thin server-rendered "loading" screen that immediately redirects
 * the browser to the API OAuth initiation route
 * (`/api/accounts/connect/[platform]?workspaceId=…`).
 *
 * It exists so there is a visible transition state between clicking "Connect"
 * and landing on the external OAuth provider. If an `error` query param is
 * present it renders an error card instead of redirecting.
 */
export default async function ConnectPlatformPage({
  params,
  searchParams,
}: PageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const { platform } = await params;
  const { workspaceId, error } = await searchParams;

  const platformKey = platform.toUpperCase();
  const platformLabel = PLATFORM_LABELS[platformKey] ?? platform;
  const platformColor = PLATFORM_COLORS[platformKey] ?? "#6366f1";

  // Resolve workspaceId — fall back to user's first active workspace
  let resolvedWorkspaceId = workspaceId;
  if (!resolvedWorkspaceId) {
    const membership = await db.workspaceMember.findFirst({
      where: { userId: session.user.id, status: "ACTIVE" },
      orderBy: { joinedAt: "asc" },
      select: { workspaceId: true },
    });
    if (!membership) {
      redirect("/onboarding");
    }
    resolvedWorkspaceId = membership.workspaceId;
  }

  // Verify membership before initiating OAuth
  const membership = await db.workspaceMember.findFirst({
    where: {
      workspaceId: resolvedWorkspaceId,
      userId: session.user.id,
      status: "ACTIVE",
    },
  });

  if (!membership) {
    redirect("/settings/accounts?error=forbidden");
  }

  // If an error was returned from a previous attempt, show it instead of redirecting
  if (error) {
    return (
      <ErrorCard
        platform={platformLabel}
        color={platformColor}
        error={error}
        workspaceId={resolvedWorkspaceId}
      />
    );
  }

  // No error — immediately redirect to the API OAuth initiation endpoint.
  // The API route validates everything and redirects to the provider.
  redirect(
    `/api/accounts/connect/${platform.toLowerCase()}?workspaceId=${resolvedWorkspaceId}`
  );
}

// ─── Error card ───────────────────────────────────────────────────────────────

function ErrorCard({
  platform,
  color,
  error,
  workspaceId,
}: {
  platform: string;
  color: string;
  error: string;
  workspaceId: string;
}) {
  const errorMessages: Record<string, string> = {
    access_denied: "You denied access to your account. Please try again.",
    account_limit:
      "You have reached the maximum number of connected accounts on your current plan. Upgrade to connect more.",
    invalid_state: "The authorization request expired or is invalid. Please try again.",
    token_exchange:
      "We could not complete the connection. Please check your credentials and try again.",
    forbidden: "You do not have permission to connect accounts to this workspace.",
  };

  const message =
    errorMessages[error] ??
    "An unexpected error occurred while connecting your account. Please try again.";

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6 rounded-xl border bg-card p-8 shadow-sm">
        {/* Platform indicator */}
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white"
            style={{ backgroundColor: color }}
          >
            {platform[0]}
          </span>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Connecting</p>
            <p className="font-semibold">{platform}</p>
          </div>
        </div>

        {/* Error message */}
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <p className="text-sm font-medium text-destructive">Connection failed</p>
          <p className="mt-1 text-sm text-muted-foreground">{message}</p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <a
            href={`/settings/accounts/connect/${platform.toLowerCase()}?workspaceId=${workspaceId}`}
            className="inline-flex h-9 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
          >
            Try again
          </a>
          <a
            href="/settings/accounts"
            className="inline-flex h-9 w-full items-center justify-center rounded-md border bg-background px-4 text-sm font-medium hover:bg-accent"
          >
            Back to accounts
          </a>
        </div>
      </div>
    </div>
  );
}
