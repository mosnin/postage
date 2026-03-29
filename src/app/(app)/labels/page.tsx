import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { LabelsManager } from "@/components/labels/labels-manager";

export const metadata: Metadata = {
  title: "Labels",
  description: "Organise your posts with colour-coded labels.",
};

export default async function LabelsPage() {
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

  return <LabelsManager workspaceId={membership.workspace.id} />;
}
