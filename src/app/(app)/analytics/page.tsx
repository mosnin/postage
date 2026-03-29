import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";

export const metadata: Metadata = {
  title: "Analytics",
  description: "Cross-platform performance metrics for your social accounts.",
};

export default async function AnalyticsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const userId = session?.user?.id as string;

  const membership = await db.workspaceMember.findFirst({
    where: {
      userId,
      status: "ACTIVE",
    },
    include: {
      workspace: {
        select: {
          id: true,
          name: true,
          plan: true,
          socialAccounts: {
            where: { status: "ACTIVE" },
            select: {
              id: true,
              platform: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            },
            orderBy: { connectedAt: "asc" },
          },
        },
      },
    },
  });

  if (!membership) {
    redirect("/onboarding");
  }

  const { workspace } = membership;

  return (
    <AnalyticsDashboard
      workspaceId={workspace.id}
      workspaceName={workspace.name}
      plan={workspace.plan}
      connectedAccounts={workspace.socialAccounts}
    />
  );
}
