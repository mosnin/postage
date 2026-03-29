import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { QueueManager } from "@/components/posts/queue-manager";

export const metadata: Metadata = {
  title: "Post Queue",
  description: "Manage your scheduled post queue and publishing times.",
};

export default async function QueuePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const membership = await db.workspaceMember.findFirst({
    where: { userId: session.user.id, status: "ACTIVE" },
    include: {
      workspace: {
        include: {
          socialAccounts: { where: { status: "ACTIVE" }, orderBy: { connectedAt: "asc" } },
          settings: true,
        },
      },
    },
  });

  if (!membership) {
    redirect("/onboarding");
  }

  const { workspace } = membership;

  // Fetch initial queue posts server-side
  const queuePosts = await db.post.findMany({
    where: {
      workspaceId: workspace.id,
      status: "SCHEDULED",
      queuePosition: { not: null },
    },
    include: {
      accounts: { include: { socialAccount: true } },
      labels: { include: { label: true } },
      _count: { select: { media: true } },
    },
    orderBy: { queuePosition: "asc" },
  });

  return (
    <div className="flex flex-col h-screen bg-background">
      <div className="flex items-center justify-between px-6 py-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Post Queue</h1>
          <p className="text-sm text-muted-foreground">
            Manage and reorder your scheduled posts
          </p>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <QueueManager
          workspaceId={workspace.id}
          initialPosts={JSON.parse(JSON.stringify(queuePosts))}
          timezone={workspace.settings?.defaultTimezone ?? workspace.timezone ?? "UTC"}
        />
      </div>
    </div>
  );
}
