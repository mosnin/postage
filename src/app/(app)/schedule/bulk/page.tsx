import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { BulkScheduler } from "@/components/posts/bulk-scheduler";

export const metadata: Metadata = {
  title: "Bulk Scheduler",
  description: "Schedule multiple posts at once by uploading a CSV file.",
};

export default async function BulkSchedulePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const membership = await db.workspaceMember.findFirst({
    where: { userId: session.user.id, status: "ACTIVE" },
    include: {
      workspace: {
        include: {
          socialAccounts: {
            where: { status: "ACTIVE" },
            select: { platform: true },
          },
        },
      },
    },
  });

  if (!membership) {
    redirect("/onboarding");
  }

  const { workspace } = membership;
  const connectedPlatforms = workspace.socialAccounts.map((a) => a.platform as string);

  return (
    <div className="flex flex-col h-screen bg-background">
      <div className="flex items-center justify-between px-6 py-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Bulk Scheduler</h1>
          <p className="text-sm text-muted-foreground">
            Upload a CSV to schedule up to 200 posts at once
          </p>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <BulkScheduler
          workspaceId={workspace.id}
          connectedPlatforms={connectedPlatforms}
        />
      </div>
    </div>
  );
}
