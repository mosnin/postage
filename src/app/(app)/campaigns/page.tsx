import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { CampaignsDashboard } from "@/components/campaigns/campaigns-dashboard";

export const metadata: Metadata = {
  title: "Campaigns",
  description: "Manage your social media campaigns.",
};

export default async function CampaignsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const membership = await db.workspaceMember.findFirst({
    where: { userId: session.user.id, status: "ACTIVE" },
    include: {
      workspace: { select: { id: true, name: true } },
    },
    orderBy: { joinedAt: "asc" },
  });

  if (!membership) {
    redirect("/onboarding");
  }

  return <CampaignsDashboard workspaceId={membership.workspace.id} />;
}
