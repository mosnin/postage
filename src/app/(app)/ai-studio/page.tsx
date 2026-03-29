import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { AiStudioClient } from "./ai-studio-client";

export const metadata: Metadata = {
  title: "AI Studio",
  description:
    "Generate captions, hashtags, and full social content with AI.",
};

export default async function AiStudioPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const membership = await db.workspaceMember.findFirst({
    where: { userId: session.user.id, status: "ACTIVE" },
    include: {
      workspace: {
        include: {
          settings: true,
        },
      },
    },
  });

  if (!membership) {
    redirect("/onboarding");
  }

  const { workspace } = membership;
  const settings = workspace.settings;

  // Determine credits reset date: stored in settings, or compute first of next month
  const resetAt: Date =
    settings?.aiCreditsResetAt ??
    (() => {
      const d = new Date();
      return new Date(d.getFullYear(), d.getMonth() + 1, 1);
    })();

  return (
    <AiStudioClient
      workspaceId={workspace.id}
      aiCreditsUsed={settings?.aiCreditsUsed ?? 0}
      aiCreditsLimit={settings?.aiCreditsLimit ?? 1000}
      aiCreditsResetAt={resetAt.toISOString()}
    />
  );
}
