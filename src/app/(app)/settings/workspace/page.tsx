import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { WorkspaceRole } from "@prisma/client";
import { WorkspaceSettingsForm } from "@/components/team/workspace-settings-form";
import { Settings } from "lucide-react";

export const metadata: Metadata = {
  title: "Workspace Settings",
  description: "Manage your workspace name, timezone, and other preferences.",
};

export default async function WorkspaceSettingsPage() {
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
          settings: true,
        },
      },
    },
  });

  if (!membership) {
    redirect("/onboarding");
  }

  const { workspace } = membership;
  const currentUserRole = membership.role as WorkspaceRole;

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div>
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Workspace Settings
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage general settings for {workspace.name}
          </p>
        </div>
      </div>

      {/* Settings form */}
      <div className="flex-1 overflow-auto p-6">
        <WorkspaceSettingsForm
          workspace={{
            id: workspace.id,
            name: workspace.name,
            slug: workspace.slug,
            logoUrl: workspace.logoUrl,
            timezone: workspace.timezone,
            settings: workspace.settings
              ? {
                  approvalRequired: workspace.settings.approvalRequired,
                }
              : null,
          }}
          currentUserRole={currentUserRole}
        />
      </div>
    </div>
  );
}
