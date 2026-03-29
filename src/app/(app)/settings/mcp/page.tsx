import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Bot } from "lucide-react";
import { McpSetup } from "@/components/settings/mcp-setup";

export const metadata: Metadata = {
  title: "MCP Integration",
  description: "Connect AI assistants like Claude and Cursor to PostSyncer via the Model Context Protocol.",
};

export default async function McpSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const membership = await db.workspaceMember.findFirst({
    where: {
      userId: session.user.id,
      status: "ACTIVE",
      role: { in: ["OWNER", "ADMIN"] },
    },
    include: { workspace: { select: { id: true, name: true } } },
  });

  if (!membership) {
    redirect("/settings");
  }

  const { workspace } = membership;

  // Fetch existing MCP tokens for this workspace
  const mcpTokens = await db.apiKey.findMany({
    where: {
      workspaceId: workspace.id,
      scopes: { has: "mcp" },
    },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      createdAt: true,
      lastUsedAt: true,
      expiresAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const serializedTokens = mcpTokens.map((t) => ({
    id: t.id,
    name: t.name,
    keyPrefix: t.keyPrefix,
    createdAt: t.createdAt.toISOString(),
    lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
    expiresAt: t.expiresAt?.toISOString() ?? null,
  }));

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div>
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <Bot className="h-5 w-5" />
            MCP Integration
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Connect AI assistants to {workspace.name} via the Model Context Protocol
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <McpSetup workspaceId={workspace.id} tokens={serializedTokens} />
      </div>
    </div>
  );
}
