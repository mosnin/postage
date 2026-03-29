import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { DraftsList } from "@/components/posts/drafts-list";

export const metadata: Metadata = {
  title: "Drafts",
  description: "Manage your draft posts.",
};

export default async function DraftsPage() {
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

  return <DraftsList workspaceId={membership.workspace.id} />;
}
