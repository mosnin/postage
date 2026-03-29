import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { PostComposer } from "@/components/posts/post-composer";

export const metadata: Metadata = {
  title: "Compose",
  description: "Create and schedule posts across all your social platforms.",
};

export default async function ComposePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  // Get user's first active workspace membership
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
          campaigns: {
            where: { status: "active" },
            orderBy: { name: "asc" },
          },
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
          <h1 className="text-xl font-semibold tracking-tight">Compose</h1>
          <p className="text-sm text-muted-foreground">
            Create and schedule posts across your connected accounts
          </p>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <PostComposer
          workspaceId={workspace.id}
          socialAccounts={workspace.socialAccounts}
          labels={workspace.labels}
          campaigns={workspace.campaigns}
          timezone={workspace.settings?.defaultTimezone ?? workspace.timezone ?? "UTC"}
        />
      </div>
    </div>
  );
}
