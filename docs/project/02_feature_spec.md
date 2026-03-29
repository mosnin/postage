# Feature Specification

## F1: Authentication & Onboarding
**Scope**: V1
- OAuth login via Google and GitHub
- Email/password login with magic link fallback
- 7-day free trial on all paid plans (no credit card required at signup)
- Multi-step onboarding: connect first social account → compose first post → invite team member (optional)
- **Acceptance**: User can sign up, complete onboarding, and schedule a post in <5 minutes

## F2: Social Account Connections
**Scope**: V1
- Connect accounts via OAuth for each supported platform
- Support: Twitter/X, Facebook, Instagram, TikTok, YouTube, Pinterest, Threads, Telegram, LinkedIn, Bluesky, Mastodon
- View connection status (active, error, disconnected)
- Reconnect expired tokens
- Plan limits enforced (10/15/30 accounts)
- **Acceptance**: User can connect an account for at least 3 platforms and see status

## F3: Post Composer
**Scope**: V1
- Rich text editor with character count per platform
- Platform-specific previews (shows how post looks on each platform)
- Attach media: images, videos, GIFs (up to plan storage limit)
- Select target platforms (one or many)
- Platform-specific options: first comment, alt text, location, hashtags
- Thread/multi-part post support for X, Bluesky, Threads, Mastodon
- Carousel post support for Instagram, LinkedIn
- Duplicate post to multiple accounts
- **Acceptance**: Can compose and schedule a post to 3+ platforms simultaneously

## F4: Content Calendar
**Scope**: V1
- Monthly/weekly/daily view
- Color-coded by platform or account
- Drag-and-drop rescheduling
- Click post to preview/edit
- Filter by platform, label, status (draft/scheduled/published/failed)
- **Acceptance**: Calendar shows all scheduled posts; drag-drop reschedules correctly

## F5: Post Queue
**Scope**: V1
- Queue per account/platform
- Set optimal posting times per queue
- Reorder queue items via drag-drop
- Pause/resume queue
- **Acceptance**: Posts publish in queue order at configured times

## F6: Bulk Scheduling
**Scope**: V1
- Import CSV/Excel with columns: platforms, date, time, text, media URL
- Validation with error report before publishing
- Progress indicator during processing
- **Acceptance**: Can bulk import 50 posts from a CSV file

## F7: Media Library
**Scope**: V1
- Upload images, videos, GIFs
- Organize in folders
- Search by name/tag
- Storage usage display (vs plan limit)
- Import from Google Drive (OAuth)
- Import from Unsplash (free search)
- **Acceptance**: Upload 10 images; search returns correct results; storage indicator updates

## F8: AI Content Agent
**Scope**: V1
- Input: URL, PDF, free text, or image
- Output: Draft posts for selected platforms (platform-optimized)
- Tone selector (professional, casual, funny, educational)
- AI credits consumed per generation (1 credit = 1 generation)
- AI caption generator: enter topic → get 3 caption options
- Hashtag suggestions
- **Acceptance**: AI generates 3 platform-specific drafts from a URL input

## F9: Analytics Dashboard
**Scope**: V1
- Overview: impressions, engagements, follower growth per period
- Per-platform breakdown
- Best performing posts
- Date range selector (7d, 30d, 90d, custom)
- Export as CSV
- Starter: basic metrics (impressions, likes, comments)
- Pro/Pro Plus: advanced (reach, saves, shares, click-through)
- **Acceptance**: Analytics loads for connected accounts; date filter works

## F10: Unified Comments Inbox
**Scope**: V1
- Aggregate comments/replies from all connected platforms
- Reply inline from inbox
- Mark as read/resolved
- Filter by platform, account, status
- Hide/delete comment on platform
- AI-suggested reply (consumes AI credits)
- Basic: last 30 days of comments; Advanced: full history + AI replies
- **Acceptance**: Comments from 2+ platforms appear; can reply from inbox

## F11: Team & Workspaces
**Scope**: V1
- Create/manage workspaces (brand/client isolation)
- Invite team members by email
- Roles: Owner, Admin, Manager, Member, Viewer
- Permissions enforced at UI and API level
- Approval workflow: post goes to "Pending Approval" → reviewer approves/rejects → publishes
- **Acceptance**: Invite a team member; approval workflow prevents unauthorized publishing

## F12: Labels & Campaigns
**Scope**: V1
- Create/edit/delete labels (color-coded)
- Assign labels to posts
- Filter posts/analytics by label
- Create campaigns (group of posts with date range and goal)
- **Acceptance**: Posts can be labeled; filter returns correct results

## F13: Settings & Billing
**Scope**: V1
- Profile settings (name, email, avatar)
- Workspace settings (name, logo, timezone)
- Notification preferences
- Subscription management via Stripe Customer Portal
- Plan upgrade/downgrade
- Additional workspace purchase ($19/mo each)
- Billing history
- **Acceptance**: User can upgrade plan; Stripe portal loads; invoice history visible

## F14: REST API
**Scope**: V1
- Base URL: /api/v1
- Authentication: API key (Bearer token)
- Rate limits enforced by plan (100/250/500 posts per day)
- Endpoints: posts (CRUD), accounts (list), labels (CRUD), campaigns (CRUD), analytics (read), comments (CRUD), workspaces (list)
- API key management in settings
- **Acceptance**: Create a scheduled post via API with valid API key

## F15: MCP Integration
**Scope**: V1
- Generate MCP token in settings
- MCP server endpoint: /api/mcp
- Tools: list-workspaces, list-accounts, create-post, list-posts, get-post, update-post, delete-post, list-labels, get-analytics-summary
- Compatible with Claude Desktop, Claude Code, Cursor
- **Acceptance**: Claude can list accounts and create a post via MCP

## F16: Admin Panel
**Scope**: V1
- Super-admin role (platform-level, not workspace)
- User management (view, suspend, impersonate)
- Subscription overview
- Usage statistics
- Feature flags
- **Acceptance**: Admin can view all users; suspend an account

## F17: Marketing Website
**Scope**: V1
- Homepage with hero, features, social proof, pricing CTA
- Features page with detailed feature breakdown
- Pricing page with tier comparison and FAQs
- Platform-specific landing pages (11 platforms)
- Blog index page (static/markdown-driven)
- Free Tools index (links to tool pages)
- Compare pages (vs Buffer, Hootsuite, etc.)
- **Acceptance**: All pages render; CTAs link to signup; mobile responsive

## F18: Free Tools
**Scope**: V1 (basic versions)
- AI Caption Generator (per platform): input topic → generate caption
- Hashtag Generator: input topic → suggest hashtags
- Character Counter: per platform
- UTM Builder
- Post Formatter (line breaks)
- Image Resizer (metadata/guide only in V1)
- **Acceptance**: Free tools work without login; AI tools use server-side generation
