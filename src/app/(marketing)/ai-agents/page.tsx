import { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Code2,
  ListChecks,
  Layers,
  MessageSquare,
  BarChart3,
  Tags,
  Megaphone,
  Calendar,
  Pencil,
  Trash2,
  Eye,
  Users,
} from "lucide-react";
import { MCP_TOOLS } from "@/lib/mcp/tools";

export const metadata: Metadata = {
  title: "AI Agents & MCP | PostSyncer",
  description:
    "Connect Claude, Cursor, and other AI assistants to PostSyncer via the Model Context Protocol. Manage your social media with natural language.",
};

// ---------------------------------------------------------------------------
// Tool icon map
// ---------------------------------------------------------------------------

const TOOL_ICONS: Record<string, React.ElementType> = {
  "list-workspaces": Layers,
  "list-accounts": Users,
  "create-post": Pencil,
  "list-posts": ListChecks,
  "get-post": Eye,
  "update-post": Pencil,
  "delete-post": Trash2,
  "list-labels": Tags,
  "list-campaigns": Megaphone,
  "get-analytics-summary": BarChart3,
  "list-comments": MessageSquare,
};

// ---------------------------------------------------------------------------
// Compatible clients
// ---------------------------------------------------------------------------

const CLIENTS = [
  {
    name: "Claude Desktop",
    description: "Anthropic's native desktop app. Add PostSyncer as an MCP server and chat your way to scheduled posts.",
    badge: "Official",
    href: "https://claude.ai/download",
  },
  {
    name: "Cursor",
    description: "The AI-first code editor. Use PostSyncer tools directly in your coding workflow to publish content.",
    badge: "Popular",
    href: "https://cursor.com",
  },
  {
    name: "Any MCP client",
    description: "PostSyncer speaks standard JSON-RPC 2.0 over HTTP — works with any client that supports MCP.",
    badge: "Universal",
    href: "https://modelcontextprotocol.io",
  },
];

// ---------------------------------------------------------------------------
// Code example
// ---------------------------------------------------------------------------

const CODE_EXAMPLE = `// Claude creates and schedules a post via MCP
You: "Draft a LinkedIn post about our new product launch
      and schedule it for tomorrow at 9 AM."

Claude: I'll create and schedule that for you.
        [Calling list-workspaces…]
        [Calling list-accounts (workspaceId: "ws_abc")…]
        [Calling create-post…]

        Done! Your LinkedIn post is scheduled for
        March 30, 2026 at 9:00 AM.

        Post preview:
        "Excited to announce our new product…"`;

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AiAgentsPage() {
  return (
    <>
      {/* ------------------------------------------------------------------ */}
      {/* Hero                                                                 */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative overflow-hidden bg-background px-4 pb-20 pt-20 sm:px-6 lg:px-8">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl"
        >
          <div
            className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-primary/30 to-violet-400/20 opacity-30 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"
            style={{
              clipPath:
                "polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)",
            }}
          />
        </div>

        <div className="mx-auto max-w-3xl text-center">
          <Badge variant="secondary" className="mb-4 rounded-full px-4 py-1 text-sm">
            Model Context Protocol
          </Badge>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl">
            PostSyncer for{" "}
            <span className="text-primary">AI Agents & MCP</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Connect Claude, Cursor, and other AI assistants to PostSyncer. Schedule posts,
            read analytics, and manage your social presence — all through natural language.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button size="lg" className="w-full sm:w-auto" asChild>
              <Link href="/register">
                Get Started Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="w-full sm:w-auto" asChild>
              <a
                href="https://docs.postsyncer.com/mcp"
                target="_blank"
                rel="noopener noreferrer"
              >
                Read the docs
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Compatible clients                                                   */}
      {/* ------------------------------------------------------------------ */}
      <section className="bg-muted/30 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-10 text-center">
            <Badge variant="secondary" className="mb-3">Compatible clients</Badge>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Works with the AI tools you already use
            </h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {CLIENTS.map((client) => (
              <Card key={client.name} className="flex flex-col">
                <CardHeader className="pb-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Bot className="h-5 w-5 text-primary" />
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {client.badge}
                    </Badge>
                  </div>
                  <CardTitle className="text-base">{client.name}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col justify-between gap-4">
                  <p className="text-sm text-muted-foreground">{client.description}</p>
                  <a
                    href={client.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                  >
                    Learn more <ArrowRight className="h-3.5 w-3.5" />
                  </a>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Tool list                                                            */}
      {/* ------------------------------------------------------------------ */}
      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-10 text-center">
            <Badge variant="secondary" className="mb-3">11 MCP tools</Badge>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Everything your AI needs
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              PostSyncer exposes a full set of MCP tools so your AI assistant can act —
              not just advise.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MCP_TOOLS.map((tool) => {
              const Icon = TOOL_ICONS[tool.name] ?? Code2;
              return (
                <div
                  key={tool.name}
                  className="flex gap-3 rounded-lg border bg-card p-4 transition-colors hover:bg-muted/30"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold font-mono">{tool.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground leading-snug">
                      {tool.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Code example                                                         */}
      {/* ------------------------------------------------------------------ */}
      <section className="bg-muted/30 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <Badge variant="secondary" className="mb-3">See it in action</Badge>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Just ask — your AI handles the rest
              </h2>
              <p className="mt-4 text-muted-foreground">
                Claude calls PostSyncer's MCP tools in the background. No copy-pasting, no
                tab-switching — your assistant drafts, schedules, and publishes while you focus
                on strategy.
              </p>
              <ul className="mt-6 space-y-2.5">
                {[
                  "Describe the post you want in plain English",
                  "Your AI picks the right accounts and time",
                  "Post is created — confirm or adjust",
                  "Analytics fetched when you ask",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border bg-zinc-950 shadow-xl">
              <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-3">
                <div className="h-3 w-3 rounded-full bg-red-500" />
                <div className="h-3 w-3 rounded-full bg-yellow-500" />
                <div className="h-3 w-3 rounded-full bg-green-500" />
                <span className="ml-2 text-xs text-zinc-400 font-mono">Claude Desktop</span>
              </div>
              <pre className="overflow-x-auto p-5 text-xs font-mono leading-relaxed text-zinc-300 whitespace-pre-wrap">
                {CODE_EXAMPLE}
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Setup guide                                                          */}
      {/* ------------------------------------------------------------------ */}
      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="mb-10 text-center">
            <Badge variant="secondary" className="mb-3">Get started in minutes</Badge>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Three steps to AI-powered posting
            </h2>
          </div>
          <div className="space-y-8">
            {[
              {
                step: "1",
                title: "Create your PostSyncer account",
                description:
                  "Sign up free — no credit card required. Connect your social accounts and create your first workspace.",
              },
              {
                step: "2",
                title: "Generate an MCP token",
                description: (
                  <>
                    In <strong>Settings → MCP / AI Agents</strong>, generate a token scoped to
                    your workspace. Copy it — it is only shown once.
                  </>
                ),
              },
              {
                step: "3",
                title: "Add PostSyncer to your AI client",
                description: (
                  <>
                    Paste this snippet into your Claude Desktop or Cursor MCP config and restart
                    the app. Your assistant will immediately have access to all 11 PostSyncer
                    tools.
                  </>
                ),
                code: JSON.stringify(
                  {
                    mcpServers: {
                      postsyncer: {
                        url: "https://app.postsyncer.com/api/mcp",
                        headers: { Authorization: "Bearer YOUR_MCP_TOKEN" },
                      },
                    },
                  },
                  null,
                  2
                ),
              },
            ].map(({ step, title, description, code }) => (
              <div key={step} className="flex gap-5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm">
                  {step}
                </div>
                <div className="space-y-2 pt-1">
                  <p className="font-semibold">{title}</p>
                  <p className="text-sm text-muted-foreground">{description}</p>
                  {code && (
                    <pre className="overflow-x-auto rounded-lg border bg-muted/50 p-4 text-xs font-mono">
                      {code}
                    </pre>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* CTA                                                                  */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative overflow-hidden bg-background px-4 py-20 sm:px-6 lg:px-8">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-primary/5 via-background to-violet-500/5"
        />
        <div className="mx-auto max-w-2xl text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <Bot className="h-7 w-7 text-primary" />
            </div>
          </div>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Let AI handle the scheduling
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            PostSyncer MCP is available on Pro and Pro Plus plans. Start your free trial today
            — no credit card required.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button size="lg" className="w-full sm:w-auto" asChild>
              <Link href="/register">
                Get Started Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="w-full sm:w-auto" asChild>
              <Link href="/pricing">View pricing</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
