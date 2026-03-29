# Edge Cases & Error Scenarios

## Authentication
- Expired OAuth token for a connected social account → show "Reconnect" banner; don't lose draft posts
- User tries to sign up with email already used via Google OAuth → merge accounts or show clear error
- Magic link expired (>15 min) → show "link expired, request new one"
- Session expires mid-compose → save draft to localStorage; redirect to login; restore draft after re-auth

## Social Account Connections
- OAuth revoked by user on platform side → detect via API error; show "Reconnect [Platform]" prompt
- Platform API rate limit hit → queue retry with exponential backoff; show "delayed" status not "failed"
- User tries to connect more accounts than plan allows → gate with upgrade prompt, don't silently fail
- Same account connected to two different workspaces → allow (platform permits); track per-workspace
- Platform changes API scopes → show "additional permissions required" reconnect flow

## Post Composer & Publishing
- Post text exceeds platform character limit → red counter; block submit until resolved
- Media file too large (>video limit per platform) → client-side validation before upload; show platform limits
- Publishing fails after schedule time → mark as "Failed", notify user, allow manual retry
- Network timeout during publish → optimistic UI + background confirmation; don't double-post
- User edits a post that's already been published on some platforms → warn; only re-publish to un-published platforms
- Thread post: middle part deleted → renumber remaining parts; warn about gap in thread
- Duplicate post submitted twice → idempotency check on content + schedule time; show warning

## Scheduling & Queue
- Two posts scheduled at same time for same account → allow; platform decides order
- Queue paused but publish time arrives → skip, move to next available time when unpaused
- Bulk CSV import: row with invalid date format → flag row in validation; skip row, allow rest to proceed
- DST time change causes schedule to shift → store all times in UTC; display in user's local timezone
- Post in queue for account that was later disconnected → mark "Requires reconnection"; don't attempt to publish

## Media Library
- Upload fails mid-transfer → show error; preserve partial metadata; allow retry
- Storage limit reached → gate new uploads with upgrade prompt; don't silently fail
- Unsplash API down → graceful fallback: "Unsplash is unavailable, upload directly"
- Google Drive auth expired → prompt reconnect; preserve the selected file reference
- Image format not supported by target platform → warn before scheduling

## Analytics
- Platform API returns no data (new account, no posts) → show "No data yet" empty state, not an error
- Analytics sync fails for one platform → show partial data with "Some platforms couldn't sync" notice
- Date range selected with no posts → show zero-state charts, not broken UI
- Very high numbers (viral post) → format with K/M suffix; no overflow

## Team & Permissions
- Owner leaves workspace without transferring ownership → block leave action; require ownership transfer first
- Invite email bounces → show "Delivery failed" in team list; allow resend
- Role downgraded for user currently in compose → permissions enforced on next action, not mid-session
- Approval workflow: approver's account suspended → posts remain pending; other approvers can action
- Member attempts API call above their permission level → 403 with clear error message

## Billing
- Stripe webhook fails → idempotent webhook handler; retry up to 3 times; alert on persistent failure
- Plan downgraded with more accounts than new plan allows → don't delete accounts; show "X accounts over limit — choose which to deactivate"
- Stripe customer deleted externally → recreate on next billing action; log anomaly
- Trial expires while user is in dashboard → show upgrade modal; don't lock out immediately (grace period: 24h)
- Charge fails (expired card) → email user; show banner; allow 7-day grace period before restricting

## API & MCP
- Invalid API key → 401 with clear "Invalid or expired API key" message
- Rate limit exceeded → 429 with Retry-After header and plan limit info
- MCP token expired → return MCP error indicating re-authentication needed
- Malformed request body → 400 with field-level validation errors (not generic 500)

## General
- Workspace deleted → all posts/analytics purged; subscription cancelled
- Account deletion → GDPR-compliant data deletion; confirmation email
- Two users edit same post simultaneously → last-write-wins with optimistic locking; show "Another user saved changes" toast
