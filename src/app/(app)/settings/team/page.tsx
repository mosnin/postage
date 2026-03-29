import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { WorkspaceRole } from "@prisma/client";
import { TeamMembersList } from "@/components/team/team-members-list";
import { InviteMemberTrigger } from "@/components/team/invite-member-trigger";
import { Users } from "lucide-react";

export const metadata: Metadata = {
  title: "Team Members",
  description: "Manage your workspace team members and their roles.",
};

export default async function TeamPage() {
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
          _count: {
            select: { members: true },
          },
        },
      },
    },
  });

  if (!membership) {
    redirect("/onboarding");
  }

  const { workspace } = membership;
  const currentUserRole = membership.role as WorkspaceRole;
  const isAdminPlus =
    currentUserRole === "OWNER" || currentUserRole === "ADMIN";

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div>
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Members
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {workspace._count.members}{" "}
            {workspace._count.members === 1 ? "member" : "members"}
          </p>
        </div>

        {isAdminPlus && (
          <InviteMemberTrigger workspaceId={workspace.id} />
        )}
      </div>

      {/* Members list */}
      <div className="flex-1 overflow-auto p-6">
        <div className="rounded-lg border bg-card">
          <TeamMembersList
            workspaceId={workspace.id}
            currentUserId={session.user.id}
            currentUserRole={currentUserRole}
          />
        </div>
      </div>
    </div>
  );
}
