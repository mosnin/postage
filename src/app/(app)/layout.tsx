import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Sidebar } from "@/components/layout/sidebar";
import { AppHeader } from "@/components/layout/app-header";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Fetch user's workspaces
  const memberships = await db.workspaceMember.findMany({
    where: {
      userId: session.user.id,
      status: "ACTIVE",
    },
    include: {
      workspace: {
        select: {
          id: true,
          name: true,
          slug: true,
          logoUrl: true,
        },
      },
    },
    orderBy: { joinedAt: "asc" },
  });

  const workspaces = memberships.map((m) => m.workspace);

  // Default to first workspace
  const currentWorkspace = workspaces[0];

  if (!currentWorkspace) {
    // User has no workspace — send to onboarding
    redirect("/onboarding");
  }

  // Fetch unread inbox count
  const unreadInbox = await db.comment.count({
    where: {
      workspaceId: currentWorkspace.id,
      status: "UNREAD",
    },
  });

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar (desktop) + bottom nav (mobile) */}
      <Sidebar
        currentWorkspace={currentWorkspace}
        workspaces={workspaces}
        unreadInbox={unreadInbox}
      />

      {/* Main column */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <AppHeader user={session.user} />

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          {children}
        </main>
      </div>
    </div>
  );
}
