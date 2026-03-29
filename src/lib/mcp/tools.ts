export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
  };
}

export const MCP_TOOLS: MCPTool[] = [
  {
    name: "list-workspaces",
    description: "List workspaces (and related context) your token can see.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "list-accounts",
    description: "List connected social accounts for selection when posting.",
    inputSchema: {
      type: "object",
      properties: { workspaceId: { type: "string", description: "Workspace ID" } },
      required: ["workspaceId"],
    },
  },
  {
    name: "create-post",
    description: "Create / schedule a post.",
    inputSchema: {
      type: "object",
      properties: {
        workspaceId: { type: "string", description: "Workspace ID" },
        content: { type: "string", description: "Post text content" },
        accountIds: {
          type: "array",
          items: { type: "string" },
          description: "IDs of social accounts to post to",
        },
        scheduledAt: {
          type: "string",
          description: "ISO 8601 datetime to schedule the post; omit to save as draft",
        },
        firstComment: {
          type: "string",
          description: "Optional first comment to attach to the post",
        },
      },
      required: ["workspaceId", "content", "accountIds"],
    },
  },
  {
    name: "list-posts",
    description: "List posts.",
    inputSchema: {
      type: "object",
      properties: {
        workspaceId: { type: "string", description: "Workspace ID" },
        status: {
          type: "string",
          enum: ["DRAFT", "SCHEDULED", "PUBLISHED", "FAILED"],
          description: "Filter by post status",
        },
        page: { type: "number", description: "Page number (default 1)" },
      },
      required: ["workspaceId"],
    },
  },
  {
    name: "get-post",
    description: "Get one post by ID.",
    inputSchema: {
      type: "object",
      properties: { postId: { type: "string", description: "Post ID" } },
      required: ["postId"],
    },
  },
  {
    name: "update-post",
    description: "Update a post's content or scheduled time.",
    inputSchema: {
      type: "object",
      properties: {
        postId: { type: "string", description: "Post ID" },
        content: { type: "string", description: "New post text content" },
        scheduledAt: {
          type: "string",
          description: "New ISO 8601 scheduled datetime; pass null to clear",
        },
      },
      required: ["postId"],
    },
  },
  {
    name: "delete-post",
    description: "Delete a post (destructive).",
    inputSchema: {
      type: "object",
      properties: { postId: { type: "string", description: "Post ID to delete" } },
      required: ["postId"],
    },
  },
  {
    name: "list-labels",
    description: "List all labels in a workspace.",
    inputSchema: {
      type: "object",
      properties: { workspaceId: { type: "string", description: "Workspace ID" } },
      required: ["workspaceId"],
    },
  },
  {
    name: "list-campaigns",
    description: "List campaigns.",
    inputSchema: {
      type: "object",
      properties: { workspaceId: { type: "string", description: "Workspace ID" } },
      required: ["workspaceId"],
    },
  },
  {
    name: "get-analytics-summary",
    description: "Summary analytics for a workspace.",
    inputSchema: {
      type: "object",
      properties: {
        workspaceId: { type: "string", description: "Workspace ID" },
        start: {
          type: "string",
          description: "Start date in ISO 8601 format e.g. 2025-01-01 (defaults to 30 days ago)",
        },
        end: {
          type: "string",
          description: "End date in ISO 8601 format e.g. 2025-01-31 (defaults to today)",
        },
      },
      required: ["workspaceId"],
    },
  },
  {
    name: "list-comments",
    description: "List comments from the unified inbox.",
    inputSchema: {
      type: "object",
      properties: {
        workspaceId: { type: "string", description: "Workspace ID" },
        status: {
          type: "string",
          description: "Filter by comment status e.g. UNREAD, READ, REPLIED",
        },
        page: { type: "number", description: "Page number (default 1)" },
      },
      required: ["workspaceId"],
    },
  },
];
