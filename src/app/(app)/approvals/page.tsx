import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ApprovalsPageClient } from "./approvals-client";

export const metadata: Metadata = {
  title: "Approval Queue",
  description: "Review and approve posts before they publish.",
};

export default async function ApprovalsPage() {
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

  const MANAGER_ROLES = ["OWNER", "ADMIN", "MANAGER"];
  if (!MANAGER_ROLES.includes(membership.role)) {
    // Non-managers can't view the approval queue
    redirect("/dashboard");
  }

  return (
    <ApprovalsPageClient
      workspaceId={membership.workspace.id}
      workspaceName={membership.workspace.name}
      viewerRole={membership.role}
      viewerUserId={session.user.id}
    />
  );
}
