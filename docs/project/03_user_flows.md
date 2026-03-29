# User Flows

## Flow 1: New User Signup & Onboarding
1. User visits marketing site → clicks "Start For Free" or "Join with Google"
2. If Google: OAuth redirect → consent → create account → redirect to onboarding
3. If email: enter email/password → verify email → redirect to onboarding
4. **Onboarding Step 1**: Welcome screen → "What describes you best?" (Creator / Business / Agency)
5. **Onboarding Step 2**: Connect first social account → select platform → OAuth connect
6. **Onboarding Step 3**: Compose first post → prefilled example → schedule or publish
7. **Onboarding Step 4**: Invite a teammate (skippable) → enter email → send invite
8. Redirect to dashboard → "First value event" achieved (account connected + post scheduled)

## Flow 2: Compose & Schedule a Post
1. From dashboard or calendar → click "New Post" / "+"
2. Post composer opens (modal or full page)
3. Select target accounts (platform-checkboxes)
4. Type/paste content in text area
5. Character count updates per platform
6. Attach media → opens media library or local upload
7. (Optional) Add first comment text
8. (Optional) Toggle thread mode → add more parts
9. Set schedule: "Schedule for later" → date/time picker, or "Add to Queue", or "Publish Now"
10. If team with approval: click "Submit for Approval"
11. Post saved → confirmation → calendar/queue updates

## Flow 3: Approval Workflow
1. Member submits post for approval
2. Manager/Admin sees notification → "X posts pending review"
3. Opens pending post → reviews content and target platforms
4. Clicks "Approve" → post enters scheduled state
5. OR clicks "Request Changes" → enters comment → member notified
6. Member revises → resubmits
7. Once approved → publishes automatically at scheduled time

## Flow 4: View & Respond to Comments
1. Navigate to Inbox
2. See unified feed of comments/replies from all connected platforms
3. Filter by platform, account, or "unread"
4. Click comment → see context (original post, commenter info)
5. Type reply → "Reply" button → posts to platform in real time
6. Mark as "Resolved" → removed from active queue
7. (Pro+) Click "AI Suggest Reply" → gets 3 options → click one → edit if needed → send

## Flow 5: Bulk Schedule via CSV
1. Navigate to Scheduler → "Bulk Upload"
2. Download CSV template
3. Fill in: date, time, platform(s), text, media_url
4. Upload CSV
5. Validation screen: shows preview of all posts with any errors flagged
6. Fix errors inline OR skip errored rows
7. Click "Schedule All" → posts created in batch
8. Success screen: "47 posts scheduled"

## Flow 6: View Analytics
1. Navigate to Analytics
2. Default view: all connected accounts, last 30 days
3. See overview cards: total impressions, engagements, follower change
4. Scroll to per-platform breakdown (tab or accordion)
5. Click platform → see top posts, engagement breakdown, best times
6. Change date range → data refreshes
7. Export → CSV download of current view

## Flow 7: Invite Team Member
1. Navigate to Settings → Team
2. Click "Invite Member"
3. Enter email + select role (Manager, Member, Viewer)
4. Click Send → invite email sent
5. Invitee clicks link → account creation or login → added to workspace
6. Team page shows new member as "Active"

## Flow 8: Upgrade Plan
1. User hits plan limit (e.g., "You've reached 10 social accounts — upgrade to add more")
2. Banner with "Upgrade Plan" CTA
3. Pricing modal opens → highlight recommended tier
4. Click "Upgrade to Pro" → Stripe Checkout
5. Payment → redirect back → plan upgraded
6. Limits updated immediately
