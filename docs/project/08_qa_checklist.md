# QA Checklist

## Auth & Security
- [ ] Unauthenticated access to all /dashboard/* routes redirects to login
- [ ] CSRF protection on all form submissions
- [ ] API keys hashed in database; not returned in API responses after creation
- [ ] OAuth state parameter validated to prevent CSRF on social login
- [ ] Tenant isolation: workspace queries always scoped to current workspace ID
- [ ] Admin routes inaccessible to non-super-admin users (404, not 403)
- [ ] Rate limiting active on /api/v1/* endpoints
- [ ] Rate limiting active on /auth/* endpoints (brute force protection)
- [ ] Environment variables not exposed to client bundle

## Billing
- [ ] Stripe webhook endpoint validates signature before processing
- [ ] Stripe webhook is idempotent (reprocessing same event has no side effect)
- [ ] Plan limits enforced before social account connections
- [ ] Plan limits enforced before API key creation
- [ ] Trial expiry handled gracefully (24h grace period, not instant lockout)
- [ ] Subscription downgrade handles excess accounts without data deletion
- [ ] Billing page inaccessible to non-Owner roles

## Core Functionality
- [ ] Post can be scheduled to all 11 platforms individually
- [ ] Post scheduling respects user's timezone (stored as UTC)
- [ ] Failed posts retry with exponential backoff (max 3 retries)
- [ ] Failed posts after retries are marked "Failed" and user notified
- [ ] Calendar drag-drop updates are persisted to database
- [ ] Bulk CSV import validates all rows before creating any posts
- [ ] Media upload enforces file size and type limits per platform
- [ ] Storage limit enforced at upload time (not just displayed)

## Analytics
- [ ] Analytics data scoped to current workspace only
- [ ] Date range filter updates charts without page reload
- [ ] Analytics empty state renders cleanly (no broken charts)
- [ ] CSV export includes all visible data for selected date range

## Team & Permissions
- [ ] Owner cannot leave workspace without transferring ownership
- [ ] Member cannot publish directly when approval workflow is enabled
- [ ] Viewer cannot see "New Post" button or access /compose
- [ ] Invited user email link expires after 48 hours
- [ ] Removing a member revokes all their active sessions for that workspace
- [ ] Permission checks enforced at API layer (not just UI)

## Responsive Design
- [ ] All marketing pages render correctly on mobile (320px-768px)
- [ ] Dashboard sidebar collapses to bottom nav on mobile
- [ ] Post composer is usable on tablet (768px-1024px)
- [ ] Calendar switches to list view on mobile
- [ ] Modals scroll correctly on mobile without background scroll-lock issues

## Accessibility
- [ ] All interactive elements reachable by keyboard (Tab / Shift+Tab)
- [ ] Focus indicators visible on all interactive elements
- [ ] Images have descriptive alt text
- [ ] Color contrast ratio meets WCAG AA (4.5:1 for text)
- [ ] Error messages linked to form inputs via aria-describedby
- [ ] Screen reader announces dynamic content changes (aria-live)
- [ ] Modal focus trapped; closes on Escape key

## Performance
- [ ] Dashboard initial load < 2 seconds on 4G connection
- [ ] Analytics page loads < 3 seconds (with real data)
- [ ] Images served with proper size/format (WebP where supported)
- [ ] No client-side bundle > 250KB (gzipped) for initial route

## Edge Cases
- [ ] Long post text (5000 chars) doesn't break composer layout
- [ ] Post with no media renders correctly in calendar and preview
- [ ] Workspace with 0 connected accounts shows helpful empty state
- [ ] API with no posts returns empty array (not null or error)
- [ ] Very long team member name doesn't break team list layout
- [ ] Rapid-clicking "Schedule" doesn't create duplicate posts (debounce/disable)

## Email Notifications
- [ ] Invite email sent when team member invited
- [ ] Approval notification sent to managers when post submitted
- [ ] Post failure notification sent to post owner
- [ ] Trial expiry reminder sent at T-3 days and T-0
- [ ] Billing receipt email delivered for successful charges

## Free Tools
- [ ] Free tools work without authentication
- [ ] AI-powered free tools have rate limiting (no auth = IP-based)
- [ ] Tool output is accurate for at least 3 test inputs per tool
