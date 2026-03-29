import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { ContentCalendar } from "@/components/calendar/content-calendar";

export const metadata: Metadata = {
  title: "Content Calendar",
  description: "Visualize and manage your scheduled posts across all platforms.",
};

export default async function CalendarPage() {
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
          labels: { orderBy: { name: "asc" } },
          settings: true,
        },
      },
    },
  });

  if (!membership) {
    redirect("/onboarding");
  }

  const { workspace } = membership;

  return (
    <div className="flex flex-col h-screen bg-background">
      <div className="flex items-center justify-between px-6 py-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Content Calendar</h1>
          <p className="text-sm text-muted-foreground">
            Schedule and visualize posts across all your connected accounts
          </p>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <ContentCalendar
          workspaceId={workspace.id}
          socialAccounts={workspace.socialAccounts}
          labels={workspace.labels}
        />
      </div>
    </div>
  );
}
