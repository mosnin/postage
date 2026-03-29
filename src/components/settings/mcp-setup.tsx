"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Copy,
  Check,
  Key,
  Trash2,
  ExternalLink,
  Plus,
  Eye,
  EyeOff,
  Bot,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { formatRelative } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface McpToken {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
}

interface McpSetupProps {
  workspaceId: string;
  tokens: McpToken[];
}

// ---------------------------------------------------------------------------
// Copy button
// ---------------------------------------------------------------------------

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7 gap-1.5 px-2">
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : label}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Token row
// ---------------------------------------------------------------------------

function TokenRow({
  token,
  onRevoke,
}: {
  token: McpToken;
  onRevoke: (id: string) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b last:border-0">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
          <Key className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{token.name}</p>
          <p className="text-xs text-muted-foreground font-mono">
            {token.keyPrefix}••••••••••••••
          </p>
        </div>
      </div>
      <div className="ml-4 flex shrink-0 items-center gap-3">
        <div className="hidden text-right text-xs text-muted-foreground sm:block">
          {token.lastUsedAt ? (
            <span>Used {formatRelative(token.lastUsedAt)}</span>
          ) : (
            <span>Never used</span>
          )}
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="sr-only">Revoke token</span>
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Revoke MCP token?</AlertDialogTitle>
              <AlertDialogDescription>
                Revoking <strong>{token.name}</strong> will immediately invalidate it. Any AI
                assistant configured with this token will lose access.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => onRevoke(token.id)}
              >
                Revoke
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function McpSetup({ workspaceId, tokens: initialTokens }: McpSetupProps) {
  const { toast } = useToast();
  const [tokens, setTokens] = useState<McpToken[]>(initialTokens);
  const [isGenerating, setIsGenerating] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);

  const mcpEndpoint = "https://app.postsyncer.com/api/mcp";

  const claudeConfig = JSON.stringify(
    {
      mcpServers: {
        postsyncer: {
          url: mcpEndpoint,
          headers: { Authorization: `Bearer ${newToken ?? "YOUR_MCP_TOKEN"}` },
        },
      },
    },
    null,
    2
  );

  async function generateToken() {
    setIsGenerating(true);
    try {
      const res = await fetch("/api/settings/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `MCP Token ${new Date().toLocaleDateString()}`,
          scopes: ["mcp"],
          workspaceId,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to generate token");
      }

      const data = await res.json();
      setNewToken(data.rawKey);
      setShowToken(true);
      setTokens((prev) => [data.apiKey, ...prev]);

      toast({ title: "MCP token generated", description: "Copy it now — it won't be shown again." });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to generate token",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  }

  async function revokeToken(id: string) {
    try {
      const res = await fetch(`/api/settings/api-keys/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to revoke token");
      setTokens((prev) => prev.filter((t) => t.id !== id));
      if (newToken) {
        const revoked = tokens.find((t) => t.id === id);
        if (revoked) setNewToken(null);
      }
      toast({ title: "Token revoked" });
    } catch {
      toast({ title: "Error", description: "Failed to revoke token", variant: "destructive" });
    }
  }

  return (
    <div className="space-y-8">
      {/* New token banner */}
      {newToken && (
        <Card className="border-green-500/50 bg-green-50/50 dark:bg-green-950/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-green-700 dark:text-green-400">
              <Check className="h-4 w-4" />
              Token generated — copy it now
            </CardTitle>
            <CardDescription>
              This token will not be shown again. Store it somewhere safe.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 rounded-md border bg-background px-3 py-2">
              <code className="flex-1 truncate text-xs font-mono select-all">
                {showToken ? newToken : "••••••••••••••••••••••••••••••••••••••••••••••"}
              </code>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 shrink-0"
                onClick={() => setShowToken((v) => !v)}
              >
                {showToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </Button>
              <CopyButton text={newToken} label="Copy" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generate */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="h-4 w-4" />
            MCP Tokens
          </CardTitle>
          <CardDescription>
            Generate tokens to connect AI assistants like Claude Desktop or Cursor to this
            workspace.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={generateToken} disabled={isGenerating} className="gap-2">
            <Plus className="h-4 w-4" />
            {isGenerating ? "Generating…" : "Generate MCP Token"}
          </Button>

          {tokens.length > 0 ? (
            <div className="rounded-md border">
              {tokens.map((token) => (
                <TokenRow key={token.id} token={token} onRevoke={revokeToken} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No MCP tokens yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Setup guide */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Setup Guide</CardTitle>
          <CardDescription>
            Follow these steps to connect an AI assistant to PostSyncer.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step 1 */}
          <div className="flex gap-4">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
              1
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Generate an MCP token above</p>
              <p className="text-sm text-muted-foreground">
                Click "Generate MCP Token" and copy the token shown — it is only displayed once.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-4">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
              2
            </div>
            <div className="w-full space-y-2">
              <p className="text-sm font-medium">
                Add PostSyncer to your AI client config
              </p>
              <p className="text-sm text-muted-foreground">
                For <strong>Claude Desktop</strong>, edit{" "}
                <code className="text-xs bg-muted px-1 py-0.5 rounded">
                  ~/Library/Application Support/Claude/claude_desktop_config.json
                </code>{" "}
                (macOS) or{" "}
                <code className="text-xs bg-muted px-1 py-0.5 rounded">
                  %APPDATA%\Claude\claude_desktop_config.json
                </code>{" "}
                (Windows):
              </p>
              <div className="relative rounded-md border bg-muted/50">
                <div className="absolute right-2 top-2">
                  <CopyButton text={claudeConfig} label="Copy" />
                </div>
                <pre className="overflow-x-auto p-4 pr-20 text-xs font-mono">{claudeConfig}</pre>
              </div>
              <p className="text-sm text-muted-foreground">
                For <strong>Cursor</strong>, add the same block under{" "}
                <code className="text-xs bg-muted px-1 py-0.5 rounded">mcpServers</code> in your
                Cursor MCP settings.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex gap-4">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
              3
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Restart your AI client</p>
              <p className="text-sm text-muted-foreground">
                Restart Claude Desktop or Cursor — PostSyncer will appear in the available tools
                list. Ask your assistant to "list my workspaces" to verify the connection.
              </p>
            </div>
          </div>

          {/* Endpoint reference */}
          <div className="rounded-md border bg-muted/30 p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">MCP endpoint</p>
                <code className="text-xs font-mono text-muted-foreground">{mcpEndpoint}</code>
              </div>
              <CopyButton text={mcpEndpoint} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">Tip</Badge>
            <p className="text-xs text-muted-foreground">
              Tokens are workspace-scoped. Generate one token per AI client for easy revocation.
            </p>
          </div>

          <Button variant="outline" size="sm" className="gap-2" asChild>
            <a
              href="https://docs.postsyncer.com/mcp"
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Full documentation
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
