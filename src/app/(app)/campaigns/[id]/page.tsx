import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { CampaignDetail } from "@/components/campaigns/campaign-detail";

export const metadata: Metadata = {
  title: "Campaign",
  description: "Campaign details and posts.",
};

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const { id } = await params;

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

  // Verify campaign belongs to this workspace
  const campaign = await db.campaign.findFirst({
    where: { id, workspaceId: membership.workspace.id },
  });

  if (!campaign) {
    notFound();
  }

  return (
    <CampaignDetail
      campaignId={id}
      workspaceId={membership.workspace.id}
    />
  );
}
