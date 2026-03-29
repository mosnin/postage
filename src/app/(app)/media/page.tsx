import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { MediaLibrary } from "@/components/media/media-library";
import type { Plan } from "@prisma/client";

export const metadata: Metadata = {
  title: "Media Library",
  description: "Upload and manage images, videos, and GIFs for your posts.",
};

export default async function MediaPage() {
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
          subscription: true,
        },
      },
    },
  });

  if (!membership) {
    redirect("/onboarding");
  }

  const { workspace } = membership;
  const plan: Plan = workspace.subscription?.plan ?? "FREE";

  return (
    <NuqsAdapter>
      <div className="flex flex-col h-screen bg-background overflow-hidden">
        <MediaLibrary workspaceId={workspace.id} plan={plan} />
      </div>
    </NuqsAdapter>
  );
}
