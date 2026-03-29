/**
 * Email sending utilities using Resend.
 * Stub implementation — wire up a real Resend client when RESEND_API_KEY is set.
 */

export interface ApprovalRequestEmailPayload {
  /** Email address of the manager to notify */
  managerEmail: string;
  managerName: string | null;
  /** Author who submitted the post */
  authorName: string | null;
  authorEmail: string | null;
  /** Short preview of the post content */
  contentPreview: string;
  postId: string;
  workspaceName: string;
}

export interface ApprovalDecisionEmailPayload {
  /** Author who submitted the post */
  authorEmail: string | null;
  authorName: string | null;
  /** Decision: approved | rejected | changes_requested */
  decision: "approved" | "rejected" | "changes_requested";
  /** Optional note from the reviewer */
  note: string | null;
  reviewerName: string | null;
  postId: string;
  workspaceName: string;
}

async function sendEmail(payload: Record<string, unknown>): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Log in development; silently skip in production without a key
    console.log("[email] RESEND_API_KEY not set, skipping email:", payload);
    return;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[email] Resend API error:", res.status, text);
    }
  } catch (err) {
    console.error("[email] Failed to send email:", err);
  }
}

/**
 * Notify a manager that a new post has been submitted for approval.
 */
export async function sendApprovalRequestEmail(
  data: ApprovalRequestEmailPayload
): Promise<void> {
  const from = process.env.EMAIL_FROM ?? "Postage <noreply@mail.postage.app>";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.postage.app";

  await sendEmail({
    from,
    to: data.managerEmail,
    subject: `New post awaiting your approval — ${data.workspaceName}`,
    html: `
      <p>Hi ${data.managerName ?? "there"},</p>
      <p><strong>${data.authorName ?? data.authorEmail ?? "A team member"}</strong> submitted a post for your review in <strong>${data.workspaceName}</strong>.</p>
      <blockquote style="border-left:3px solid #e5e7eb;padding:8px 16px;color:#6b7280;margin:16px 0;">
        ${data.contentPreview}
      </blockquote>
      <p>
        <a href="${appUrl}/approvals" style="background:#3b82f6;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">
          Review Post
        </a>
      </p>
      <p style="color:#9ca3af;font-size:12px;">This email was sent by Postage on behalf of ${data.workspaceName}.</p>
    `,
  });
}

/**
 * Notify the post author about the approval decision.
 */
export async function sendApprovalDecisionEmail(
  data: ApprovalDecisionEmailPayload
): Promise<void> {
  if (!data.authorEmail) return;

  const from = process.env.EMAIL_FROM ?? "Postage <noreply@mail.postage.app>";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.postage.app";

  const decisionLabels: Record<string, string> = {
    approved: "approved",
    rejected: "rejected",
    changes_requested: "returned with change requests",
  };

  const subjectLabels: Record<string, string> = {
    approved: "Your post was approved",
    rejected: "Your post was rejected",
    changes_requested: "Changes requested on your post",
  };

  const label = decisionLabels[data.decision] ?? data.decision;
  const subject = subjectLabels[data.decision] ?? `Post review update — ${data.workspaceName}`;

  await sendEmail({
    from,
    to: data.authorEmail,
    subject: `${subject} — ${data.workspaceName}`,
    html: `
      <p>Hi ${data.authorName ?? "there"},</p>
      <p>Your post was <strong>${label}</strong> by <strong>${data.reviewerName ?? "a manager"}</strong> in <strong>${data.workspaceName}</strong>.</p>
      ${data.note ? `<blockquote style="border-left:3px solid #e5e7eb;padding:8px 16px;color:#6b7280;margin:16px 0;">${data.note}</blockquote>` : ""}
      <p>
        <a href="${appUrl}/posts" style="background:#3b82f6;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">
          View Your Posts
        </a>
      </p>
      <p style="color:#9ca3af;font-size:12px;">This email was sent by Postage on behalf of ${data.workspaceName}.</p>
    `,
  });
}
