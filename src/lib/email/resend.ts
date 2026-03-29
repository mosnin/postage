import { Resend } from "resend";
import { render } from "@react-email/render";
import React from "react";

import WelcomeEmail, {
  type WelcomeEmailProps,
} from "@/emails/welcome";
import InviteMemberEmail, {
  type InviteMemberEmailProps,
} from "@/emails/invite-member";
import PostApprovalRequestEmail, {
  type PostApprovalRequestEmailProps,
} from "@/emails/post-approval-request";
import PostApprovedEmail, {
  type PostApprovedEmailProps,
} from "@/emails/post-approved";
import PostFailedEmail, {
  type PostFailedEmailProps,
} from "@/emails/post-failed";
import TrialExpiringEmail, {
  type TrialExpiringEmailProps,
} from "@/emails/trial-expiring";
import SubscriptionReceiptEmail, {
  type SubscriptionReceiptEmailProps,
} from "@/emails/subscription-receipt";
import MagicLinkEmail, {
  type MagicLinkEmailProps,
} from "@/emails/magic-link";

// Re-export prop types so callers can import them from one place
export type {
  WelcomeEmailProps,
  InviteMemberEmailProps,
  PostApprovalRequestEmailProps,
  PostApprovedEmailProps,
  PostFailedEmailProps,
  TrialExpiringEmailProps,
  SubscriptionReceiptEmailProps,
  MagicLinkEmailProps,
};

// ---------------------------------------------------------------------------
// Legacy payload types (used by existing approval routes — preserved as-is)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Resend client
// ---------------------------------------------------------------------------

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ?? "PostSyncer <hello@postsyncer.com>";

// ---------------------------------------------------------------------------
// Core send helper (React Email templates)
// ---------------------------------------------------------------------------

export async function sendEmail<T extends Record<string, unknown>>({
  to,
  subject,
  template: Template,
  props,
}: {
  to: string;
  subject: string;
  template: React.ComponentType<T>;
  props: T;
}) {
  const html = await render(React.createElement(Template, props));
  return resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject,
    html,
  });
}

// ---------------------------------------------------------------------------
// Convenience helpers — React Email templates
// ---------------------------------------------------------------------------

export async function sendWelcomeEmail(to: string, props: WelcomeEmailProps) {
  return sendEmail({
    to,
    subject: "Welcome to PostSyncer — let's get you set up",
    template: WelcomeEmail,
    props,
  });
}

export async function sendInviteEmail(
  to: string,
  props: InviteMemberEmailProps
) {
  return sendEmail({
    to,
    subject: `${props.workspaceName} has invited you to join PostSyncer`,
    template: InviteMemberEmail,
    props,
  });
}

export async function sendApprovalRequestReactEmail(
  to: string,
  props: PostApprovalRequestEmailProps
) {
  return sendEmail({
    to,
    subject: `New post waiting for your approval — ${props.workspaceName}`,
    template: PostApprovalRequestEmail,
    props,
  });
}

export async function sendPostApprovedEmail(
  to: string,
  props: PostApprovedEmailProps
) {
  return sendEmail({
    to,
    subject: `Your post was approved in ${props.workspaceName}`,
    template: PostApprovedEmail,
    props,
  });
}

export async function sendPostFailedEmail(
  to: string,
  props: PostFailedEmailProps
) {
  const platformDisplay =
    props.platformName.charAt(0).toUpperCase() +
    props.platformName.slice(1);
  return sendEmail({
    to,
    subject: `\u26A0 Post failed to publish on ${platformDisplay}`,
    template: PostFailedEmail,
    props,
  });
}

export async function sendTrialExpiringEmail(
  to: string,
  props: TrialExpiringEmailProps
) {
  return sendEmail({
    to,
    subject: `Your PostSyncer trial ends in ${props.daysRemaining} day${props.daysRemaining === 1 ? "" : "s"}`,
    template: TrialExpiringEmail,
    props,
  });
}

export async function sendSubscriptionReceiptEmail(
  to: string,
  props: SubscriptionReceiptEmailProps
) {
  return sendEmail({
    to,
    subject: `Your PostSyncer receipt — Invoice #${props.invoiceNumber}`,
    template: SubscriptionReceiptEmail,
    props,
  });
}

export async function sendMagicLinkEmail(
  to: string,
  props: MagicLinkEmailProps
) {
  return sendEmail({
    to,
    subject: "Your PostSyncer sign-in link",
    template: MagicLinkEmail,
    props,
  });
}

// ---------------------------------------------------------------------------
// Legacy helpers — plain HTML (kept for backward-compat with existing routes)
// ---------------------------------------------------------------------------

async function sendLegacyEmail(payload: Record<string, unknown>): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
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
 * @deprecated Use sendApprovalRequestReactEmail for the React Email version.
 */
export async function sendApprovalRequestEmail(
  data: ApprovalRequestEmailPayload
): Promise<void> {
  const from = process.env.EMAIL_FROM ?? "Postage <noreply@mail.postage.app>";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.postage.app";

  await sendLegacyEmail({
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
  const subject =
    subjectLabels[data.decision] ??
    `Post review update — ${data.workspaceName}`;

  await sendLegacyEmail({
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
