import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { AccountsList } from "@/components/accounts/accounts-list";

export const metadata: Metadata = {
  title: "Connected Accounts",
  description: "Manage your connected social media accounts.",
};

interface PageProps {
  searchParams: Promise<{
    connected?: string;
    platform?: string;
    error?: string;
  }>;
}

export default async function AccountsPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const params = await searchParams;

  // Get user's active workspace membership
  const membership = await db.workspaceMember.findFirst({
    where: {
      userId: session.user.id,
      status: "ACTIVE",
    },
    include: {
      workspace: {
        include: { subscription: true },
      },
    },
    orderBy: { joinedAt: "asc" },
  });

  if (!membership) {
    redirect("/onboarding");
  }

  return (
    <div className="flex flex-col gap-0">
      {/* Page header */}
      <div className="border-b bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Manage your workspace settings and connected accounts
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <AccountsList
          workspaceId={membership.workspaceId}
          initialConnected={params.connected ?? null}
          initialError={params.error ?? null}
        />
      </div>
    </div>
  );
}
