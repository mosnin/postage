import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { InboxFeed } from "@/components/inbox/inbox-feed";
import { InboxFilters } from "@/components/inbox/inbox-filters";

export const metadata: Metadata = {
  title: "Inbox",
  description: "Manage comments from all your connected social accounts in one place.",
};

export default async function InboxPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const membership = await db.workspaceMember.findFirst({
    where: {
      userId: session.user.id,
      status: "ACTIVE",
    },
    include: {
      workspace: {
        include: {
          socialAccounts: {
            where: { status: "ACTIVE" },
            orderBy: { connectedAt: "asc" },
          },
          subscription: true,
        },
      },
    },
  });

  if (!membership) {
    redirect("/onboarding");
  }

  const { workspace } = membership;

  // Count unread comments for accounts in this workspace
  const socialAccountIds = workspace.socialAccounts.map(
    (a: { id: string }) => a.id
  );

  const unreadCount = await db.comment.count({
    where: {
      socialAccountId: { in: socialAccountIds },
      status: "UNREAD",
    },
  });

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar filters */}
      <InboxFilters
        socialAccounts={workspace.socialAccounts}
        unreadCount={unreadCount}
      />

      {/* Main feed */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Page header */}
        <div className="flex items-center justify-between px-6 py-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex-shrink-0">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Comments Inbox</h1>
            <p className="text-sm text-muted-foreground">
              Unified view of comments across all your social accounts
            </p>
          </div>
        </div>

        {/* Feed */}
        <InboxFeed workspaceId={workspace.id} />
      </main>
    </div>
  );
}
