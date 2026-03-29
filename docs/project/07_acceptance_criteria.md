# Acceptance Criteria

## AC-1: Authentication
- **Given** a visitor on the marketing page, **when** they click "Join with Google", **then** they are redirected to Google OAuth, and upon consent are redirected to the onboarding flow with a new account created
- **Given** an existing user, **when** they log in with email/password, **then** they are redirected to their dashboard within 2 seconds
- **Given** an unauthenticated user, **when** they visit any `/dashboard/*` route, **then** they are redirected to `/login`
- **Given** a user with an expired session, **when** they attempt an action, **then** they are redirected to login without losing their draft

## AC-2: Social Account Connections
- **Given** a user on the connections page, **when** they click "Connect Twitter/X", **then** they are redirected to Twitter OAuth; upon authorization the account appears as "Connected"
- **Given** a user who has reached their plan account limit, **when** they try to add another account, **then** they see an upgrade prompt (not a silent failure)
- **Given** a connected account with a revoked token, **when** the user navigates to the account list, **then** the account shows a "Reconnect" button and a warning

## AC-3: Post Composer
- **Given** a post with text targeting Twitter (280 chars) and LinkedIn (3000 chars), **when** the text exceeds 280 chars, **then** Twitter shows a red character counter; LinkedIn remains green
- **Given** a user selecting 3 platforms, **when** they click "Schedule", **then** 3 separate platform posts are created with the correct content and schedule time
- **Given** a Member with approval workflow enabled, **when** they click "Publish", **then** the post status becomes "Pending Approval" and an approval notification is sent to Managers

## AC-4: Content Calendar
- **Given** scheduled posts, **when** the user opens the calendar, **then** all posts appear on their scheduled date/time with platform color indicators
- **Given** a post on the calendar, **when** the user drags it to a new time slot, **then** the post's schedule time updates and the backend is notified within 1 second
- **Given** a filter applied for a specific platform, **when** the calendar renders, **then** only posts for that platform are visible

## AC-5: Analytics
- **Given** a connected account with post history, **when** the user views analytics, **then** impressions, engagements, and follower data are displayed for the selected period
- **Given** a Starter plan user, **when** they view analytics, **then** they see basic metrics only; advanced metrics show an upgrade prompt
- **Given** a date range with no posts, **when** analytics renders, **then** zero-state charts are shown with a helpful message (not an error)

## AC-6: Comments Inbox
- **Given** comments on connected accounts, **when** the user opens the inbox, **then** comments are aggregated across all platforms in reverse chronological order
- **Given** a comment in the inbox, **when** the user types a reply and clicks Send, **then** the reply is posted on the original platform and the comment is marked as replied
- **Given** a Pro+ user, **when** they click "AI Suggest Reply", **then** 3 reply options are generated (consuming 1 AI credit); they can select and edit before sending

## AC-7: Team & Approval
- **Given** an Admin, **when** they invite a new team member by email, **then** the invitee receives an invite email and appears in the team list as "Pending"
- **Given** a post submitted for approval, **when** a Manager opens it, **then** they can Approve (changes status to Scheduled), Reject (adds a comment), or Request Changes
- **Given** a Viewer, **when** they attempt to create a post via the UI, **then** the "New Post" button is hidden or disabled

## AC-8: Billing
- **Given** a user on the free trial, **when** they click "Upgrade to Pro", **then** they are taken to a Stripe Checkout page; upon payment the plan updates immediately
- **Given** a webhook for subscription.updated, **when** it arrives from Stripe, **then** the workspace plan is updated and any new limits are applied within 5 seconds
- **Given** a user who downgraded with more accounts than the new plan allows, **when** they return to the accounts page, **then** they see a warning to deactivate excess accounts

## AC-9: REST API
- **Given** a valid API key with posts:write scope, **when** a POST /api/v1/posts request is made, **then** a post is created and the response includes the post ID and scheduled time
- **Given** an invalid API key, **when** any /api/v1 endpoint is hit, **then** a 401 response is returned
- **Given** a Starter plan API key making 101 posts in a day, **when** the 101st request arrives, **then** a 429 response is returned with Retry-After header

## AC-10: Onboarding
- **Given** a brand-new user, **when** they complete all 4 onboarding steps, **then** they arrive at the dashboard with their first post scheduled and first account connected
- **Given** a user who skips "Invite Team", **when** they reach the dashboard, **then** onboarding is marked complete and the onboarding UI is not shown again
