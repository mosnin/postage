# Permissions Matrix

## Roles

| Role | Scope | Description |
|------|-------|-------------|
| Super Admin | Platform | Can manage all workspaces, users, subscriptions |
| Owner | Workspace | Full control; can delete workspace, transfer ownership |
| Admin | Workspace | All owner actions except delete workspace / transfer ownership |
| Manager | Workspace | Manage posts, approve content, view analytics; cannot manage team |
| Member | Workspace | Create/edit their own posts; submit for approval |
| Viewer | Workspace | Read-only access to calendar, analytics, inbox |
| API Key | Workspace | Scoped to specific permissions (read-only, posts, accounts, analytics) |

## Workspace Permissions

| Action | Super Admin | Owner | Admin | Manager | Member | Viewer |
|--------|-------------|-------|-------|---------|--------|--------|
| View dashboard | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| View calendar | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| View analytics | ✓ | ✓ | ✓ | ✓ | — | ✓ |
| View inbox | ✓ | ✓ | ✓ | ✓ | — | ✓ |
| Create post (draft) | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Edit own post | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Edit any post | ✓ | ✓ | ✓ | ✓ | — | — |
| Delete own post | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Delete any post | ✓ | ✓ | ✓ | ✓ | — | — |
| Publish directly | ✓ | ✓ | ✓ | ✓ | * | — |
| Submit for approval | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Approve/reject posts | ✓ | ✓ | ✓ | ✓ | — | — |
| Reply to comments | ✓ | ✓ | ✓ | ✓ | — | — |
| Manage media library | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Manage labels | ✓ | ✓ | ✓ | ✓ | — | — |
| Manage campaigns | ✓ | ✓ | ✓ | ✓ | — | — |
| Connect social accounts | ✓ | ✓ | ✓ | — | — | — |
| Disconnect social accounts | ✓ | ✓ | ✓ | — | — | — |
| Invite team members | ✓ | ✓ | ✓ | — | — | — |
| Manage team roles | ✓ | ✓ | ✓ | — | — | — |
| Remove team members | ✓ | ✓ | ✓ | — | — | — |
| Manage workspace settings | ✓ | ✓ | ✓ | — | — | — |
| Manage billing | ✓ | ✓ | — | — | — | — |
| Delete workspace | ✓ | ✓ | — | — | — | — |
| Transfer ownership | ✓ | ✓ | — | — | — | — |
| Manage API keys | ✓ | ✓ | ✓ | — | — | — |
| Access admin panel | ✓ | — | — | — | — | — |

`*` Member "Publish directly" depends on workspace setting: if approval workflow is enabled, Members must submit for approval

## Route Middleware Rules

| Route Pattern | Minimum Role | Notes |
|---------------|-------------|-------|
| /dashboard/* | Member | All authenticated workspace members |
| /calendar/* | Member | |
| /compose | Member | |
| /analytics/* | Viewer | Viewers can see analytics |
| /inbox/* | Manager | |
| /media/* | Member | |
| /settings/workspace | Admin | |
| /settings/billing | Owner | |
| /settings/team | Admin | |
| /settings/api | Admin | |
| /admin/* | Super Admin | Platform admin only |
| /api/v1/* | API Key | Scoped per-key permissions |

## API Key Permission Scopes
- `posts:read` — list/get posts
- `posts:write` — create/update/delete posts
- `accounts:read` — list connected accounts
- `analytics:read` — access analytics data
- `comments:read` — list/get comments
- `comments:write` — reply/hide/delete comments
- `labels:read` / `labels:write`
- `campaigns:read` / `campaigns:write`
