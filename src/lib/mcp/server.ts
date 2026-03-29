import { createHash } from "crypto";
import { db } from "@/lib/db";
import { MCP_TOOLS } from "./tools";
import { PostStatus } from "@prisma/client";
import { startOfDay, endOfDay, subDays } from "date-fns";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MCPRequest {
  jsonrpc: "2.0";
  id: string | number | null;
  method: string;
  params?: {
    name?: string;
    arguments?: Record<string, unknown>;
    protocolVersion?: string;
    capabilities?: Record<string, unknown>;
    clientInfo?: { name: string; version: string };
  };
}

export interface MCPResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

interface AuthContext {
  apiKeyId: string;
  workspaceId: string;
  userId: string;
  scopes: string[];
  plan: string;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

async function authenticateMcpToken(token: string): Promise<AuthContext | null> {
  const keyHash = createHash("sha256").update(token).digest("hex");

  const apiKey = await db.apiKey.findUnique({
    where: { keyHash },
    include: { workspace: { select: { id: true, plan: true } } },
  });

  if (!apiKey) return null;
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return null;
  if (!apiKey.scopes.includes("mcp")) return null;

  // Fire-and-forget last used update
  db.apiKey
    .update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  return {
    apiKeyId: apiKey.id,
    workspaceId: apiKey.workspaceId,
    userId: apiKey.userId,
    scopes: apiKey.scopes,
    plan: apiKey.workspace.plan,
  };
}

// ---------------------------------------------------------------------------
// JSON-RPC helpers
// ---------------------------------------------------------------------------

function okResult(id: string | number | null, result: unknown): MCPResponse {
  return { jsonrpc: "2.0", id, result };
}

function rpcError(
  id: string | number | null,
  code: number,
  message: string,
  data?: unknown
): MCPResponse {
  return { jsonrpc: "2.0", id, error: { code, message, ...(data !== undefined ? { data } : {}) } };
}

function toolResult(content: unknown): { content: Array<{ type: "text"; text: string }> } {
  return {
    content: [{ type: "text", text: JSON.stringify(content, null, 2) }],
  };
}

function toolError(message: string): { isError: true; content: Array<{ type: "text"; text: string }> } {
  return {
    isError: true,
    content: [{ type: "text", text: message }],
  };
}

// ---------------------------------------------------------------------------
// Tool handlers
// ---------------------------------------------------------------------------

type Args = Record<string, unknown>;

async function handleListWorkspaces(auth: AuthContext) {
  // Find all workspaces for the token's user (same user can have many memberships)
  const memberships = await db.workspaceMember.findMany({
    where: { userId: auth.userId, status: "ACTIVE" },
    include: {
      workspace: {
        select: {
          id: true,
          name: true,
          slug: true,
          plan: true,
          timezone: true,
          _count: { select: { members: true, socialAccounts: true } },
        },
      },
    },
  });
  return toolResult({ workspaces: memberships.map((m) => ({ ...m.workspace, role: m.role })) });
}

async function handleListAccounts(auth: AuthContext, args: Args) {
  const workspaceId = args.workspaceId as string;
  if (!workspaceId) return toolError("workspaceId is required");

  // Verify access
  const member = await db.workspaceMember.findFirst({
    where: { userId: auth.userId, workspaceId, status: "ACTIVE" },
  });
  if (!member) return toolError("Workspace not found or access denied");

  const accounts = await db.socialAccount.findMany({
    where: { workspaceId },
    select: {
      id: true,
      platform: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      status: true,
    },
    orderBy: { connectedAt: "asc" },
  });
  return toolResult({ accounts });
}

async function handleCreatePost(auth: AuthContext, args: Args) {
  const workspaceId = args.workspaceId as string;
  const content = args.content as string;
  const accountIds = args.accountIds as string[];
  const scheduledAt = args.scheduledAt as string | undefined;
  const firstComment = args.firstComment as string | undefined;

  if (!workspaceId) return toolError("workspaceId is required");
  if (!content) return toolError("content is required");
  if (!accountIds || accountIds.length === 0) return toolError("accountIds must be a non-empty array");

  const member = await db.workspaceMember.findFirst({
    where: { userId: auth.userId, workspaceId, status: "ACTIVE" },
  });
  if (!member) return toolError("Workspace not found or access denied");

  const accounts = await db.socialAccount.findMany({
    where: { id: { in: accountIds }, workspaceId },
    select: { id: true },
  });
  if (accounts.length !== accountIds.length) {
    return toolError("One or more accountIds do not belong to this workspace");
  }

  const status = scheduledAt ? PostStatus.SCHEDULED : PostStatus.DRAFT;

  const post = await db.post.create({
    data: {
      workspaceId,
      authorId: auth.userId,
      content,
      firstComment: firstComment ?? null,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      status,
      accounts: {
        create: accountIds.map((socialAccountId) => ({ socialAccountId, status })),
      },
    },
    include: {
      accounts: {
        include: {
          socialAccount: {
            select: { id: true, platform: true, username: true, displayName: true },
          },
        },
      },
    },
  });
  return toolResult({ post });
}

async function handleListPosts(auth: AuthContext, args: Args) {
  const workspaceId = args.workspaceId as string;
  if (!workspaceId) return toolError("workspaceId is required");

  const member = await db.workspaceMember.findFirst({
    where: { userId: auth.userId, workspaceId, status: "ACTIVE" },
  });
  if (!member) return toolError("Workspace not found or access denied");

  const page = Math.max(1, Number(args.page ?? 1));
  const pageSize = 20;
  const status = args.status as PostStatus | undefined;

  const where = {
    workspaceId,
    ...(status ? { status } : {}),
  };

  const [total, posts] = await Promise.all([
    db.post.count({ where }),
    db.post.findMany({
      where,
      include: {
        accounts: {
          include: {
            socialAccount: {
              select: { id: true, platform: true, username: true, displayName: true },
            },
          },
        },
        labels: { include: { label: { select: { id: true, name: true, color: true } } } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return toolResult({ posts, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
}

async function handleGetPost(auth: AuthContext, args: Args) {
  const postId = args.postId as string;
  if (!postId) return toolError("postId is required");

  const post = await db.post.findFirst({
    where: { id: postId, workspace: { members: { some: { userId: auth.userId, status: "ACTIVE" } } } },
    include: {
      accounts: {
        include: {
          socialAccount: {
            select: { id: true, platform: true, username: true, displayName: true, avatarUrl: true },
          },
        },
      },
      labels: { include: { label: { select: { id: true, name: true, color: true } } } },
    },
  });

  if (!post) return toolError("Post not found");
  return toolResult({ post });
}

async function handleUpdatePost(auth: AuthContext, args: Args) {
  const postId = args.postId as string;
  if (!postId) return toolError("postId is required");

  const existing = await db.post.findFirst({
    where: { id: postId, workspace: { members: { some: { userId: auth.userId, status: "ACTIVE" } } } },
    select: { id: true, status: true },
  });

  if (!existing) return toolError("Post not found");
  if (existing.status === "PUBLISHED" || existing.status === "PUBLISHING") {
    return toolError("Cannot edit a post that is published or currently publishing");
  }

  const updateData: Record<string, unknown> = {};
  if (args.content !== undefined) updateData.content = args.content;
  if (args.scheduledAt !== undefined) {
    updateData.scheduledAt = args.scheduledAt ? new Date(args.scheduledAt as string) : null;
  }

  const post = await db.post.update({
    where: { id: postId },
    data: updateData,
    include: {
      accounts: {
        include: {
          socialAccount: {
            select: { id: true, platform: true, username: true, displayName: true },
          },
        },
      },
    },
  });
  return toolResult({ post });
}

async function handleDeletePost(auth: AuthContext, args: Args) {
  const postId = args.postId as string;
  if (!postId) return toolError("postId is required");

  const existing = await db.post.findFirst({
    where: { id: postId, workspace: { members: { some: { userId: auth.userId, status: "ACTIVE" } } } },
    select: { id: true },
  });

  if (!existing) return toolError("Post not found");

  await db.post.delete({ where: { id: postId } });
  return toolResult({ success: true, deletedId: postId });
}

async function handleListLabels(auth: AuthContext, args: Args) {
  const workspaceId = args.workspaceId as string;
  if (!workspaceId) return toolError("workspaceId is required");

  const member = await db.workspaceMember.findFirst({
    where: { userId: auth.userId, workspaceId, status: "ACTIVE" },
  });
  if (!member) return toolError("Workspace not found or access denied");

  const labels = await db.label.findMany({
    where: { workspaceId },
    select: { id: true, name: true, color: true, createdAt: true, _count: { select: { posts: true } } },
    orderBy: { name: "asc" },
  });
  return toolResult({ labels });
}

async function handleListCampaigns(auth: AuthContext, args: Args) {
  const workspaceId = args.workspaceId as string;
  if (!workspaceId) return toolError("workspaceId is required");

  const member = await db.workspaceMember.findFirst({
    where: { userId: auth.userId, workspaceId, status: "ACTIVE" },
  });
  if (!member) return toolError("Workspace not found or access denied");

  const campaigns = await db.campaign.findMany({
    where: { workspaceId },
    select: {
      id: true,
      name: true,
      description: true,
      goal: true,
      startDate: true,
      endDate: true,
      status: true,
      createdAt: true,
      _count: { select: { posts: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return toolResult({ campaigns });
}

async function handleGetAnalyticsSummary(auth: AuthContext, args: Args) {
  const workspaceId = args.workspaceId as string;
  if (!workspaceId) return toolError("workspaceId is required");

  const member = await db.workspaceMember.findFirst({
    where: { userId: auth.userId, workspaceId, status: "ACTIVE" },
  });
  if (!member) return toolError("Workspace not found or access denied");

  const endDate = args.end ? endOfDay(new Date(args.end as string)) : endOfDay(new Date());
  const startDate = args.start
    ? startOfDay(new Date(args.start as string))
    : startOfDay(subDays(endDate, 29));

  const [snapshots, postsCount] = await Promise.all([
    db.analyticsSnapshot.findMany({
      where: { workspaceId, date: { gte: startDate, lte: endDate } },
    }),
    db.post.count({
      where: {
        workspaceId,
        publishedAt: { gte: startDate, lte: endDate },
        status: "PUBLISHED",
      },
    }),
  ]);

  const totals = snapshots.reduce(
    (acc, s) => {
      acc.impressions += s.impressions;
      acc.engagements += s.engagements;
      acc.likes += s.likes;
      acc.comments += s.comments;
      acc.shares += s.shares;
      acc.clicks += s.clicks;
      acc.reach += s.reach;
      acc.saves += s.saves;
      acc.followerChange += s.followerChange;
      return acc;
    },
    {
      impressions: 0,
      engagements: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      clicks: 0,
      reach: 0,
      saves: 0,
      followerChange: 0,
    }
  );

  return toolResult({
    summary: { ...totals, postsCount },
    dateRange: {
      start: startDate.toISOString().slice(0, 10),
      end: endDate.toISOString().slice(0, 10),
    },
  });
}

async function handleListComments(auth: AuthContext, args: Args) {
  const workspaceId = args.workspaceId as string;
  if (!workspaceId) return toolError("workspaceId is required");

  const member = await db.workspaceMember.findFirst({
    where: { userId: auth.userId, workspaceId, status: "ACTIVE" },
  });
  if (!member) return toolError("Workspace not found or access denied");

  const page = Math.max(1, Number(args.page ?? 1));
  const pageSize = 20;

  const socialAccounts = await db.socialAccount.findMany({
    where: { workspaceId },
    select: { id: true },
  });
  const socialAccountIds = socialAccounts.map((a) => a.id);

  if (socialAccountIds.length === 0) {
    return toolResult({ comments: [], total: 0, page, pageSize, totalPages: 0 });
  }

  const where = {
    socialAccountId: { in: socialAccountIds },
    ...(args.status ? { status: args.status as string } : {}),
  };

  const [total, comments] = await Promise.all([
    db.comment.count({ where }),
    db.comment.findMany({
      where,
      include: { replies: { orderBy: { sentAt: "asc" } } },
      orderBy: { publishedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return toolResult({ comments, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export async function handleMCPRequest(body: MCPRequest, token: string): Promise<MCPResponse> {
  const { id, method, params } = body;

  // "initialize" requires no auth — it's the handshake
  if (method === "initialize") {
    return okResult(id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "postsyncer", version: "1.0.0" },
    });
  }

  // All other methods require a valid MCP token
  const auth = await authenticateMcpToken(token);
  if (!auth) {
    return rpcError(id, -32001, "Unauthorized: invalid or expired MCP token");
  }

  // tools/list — return the tool catalogue
  if (method === "tools/list") {
    return okResult(id, { tools: MCP_TOOLS });
  }

  // tools/call — dispatch to the right handler
  if (method === "tools/call") {
    const toolName = params?.name;
    const args = (params?.arguments ?? {}) as Args;

    if (!toolName) {
      return rpcError(id, -32602, "Invalid params: missing tool name");
    }

    try {
      let result: unknown;

      switch (toolName) {
        case "list-workspaces":
          result = await handleListWorkspaces(auth);
          break;
        case "list-accounts":
          result = await handleListAccounts(auth, args);
          break;
        case "create-post":
          result = await handleCreatePost(auth, args);
          break;
        case "list-posts":
          result = await handleListPosts(auth, args);
          break;
        case "get-post":
          result = await handleGetPost(auth, args);
          break;
        case "update-post":
          result = await handleUpdatePost(auth, args);
          break;
        case "delete-post":
          result = await handleDeletePost(auth, args);
          break;
        case "list-labels":
          result = await handleListLabels(auth, args);
          break;
        case "list-campaigns":
          result = await handleListCampaigns(auth, args);
          break;
        case "get-analytics-summary":
          result = await handleGetAnalyticsSummary(auth, args);
          break;
        case "list-comments":
          result = await handleListComments(auth, args);
          break;
        default:
          return rpcError(id, -32601, `Method not found: unknown tool "${toolName}"`);
      }

      return okResult(id, result);
    } catch (err) {
      console.error(`[MCP tools/call] tool=${toolName}`, err);
      return rpcError(id, -32603, "Internal error executing tool");
    }
  }

  // ping — lightweight health-check
  if (method === "ping") {
    return okResult(id, {});
  }

  return rpcError(id, -32601, `Method not found: "${method}"`);
}
