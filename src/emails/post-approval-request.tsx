import React from "react";
import { EmailLayout } from "./components/email-layout";

export interface PostApprovalRequestEmailProps {
  reviewerName: string;
  submitterName: string;
  postPreview: string;
  postUrl: string;
  workspaceName: string;
  platforms?: string[];
}

const PLATFORM_COLORS: Record<string, { bg: string; text: string }> = {
  twitter: { bg: "#e7f5fe", text: "#0369a1" },
  x: { bg: "#e7f5fe", text: "#0369a1" },
  linkedin: { bg: "#e8f4fd", text: "#0a66c2" },
  instagram: { bg: "#fdf2f8", text: "#9333ea" },
  facebook: { bg: "#eff6ff", text: "#1d4ed8" },
  tiktok: { bg: "#f0fdf4", text: "#166534" },
  default: { bg: "#f4f4f5", text: "#3f3f46" },
};

function PlatformBadge({ platform }: { platform: string }) {
  const key = platform.toLowerCase();
  const colors = PLATFORM_COLORS[key] ?? PLATFORM_COLORS.default;
  const label = platform.charAt(0).toUpperCase() + platform.slice(1);

  return (
    <span
      style={{
        display: "inline-block",
        backgroundColor: colors.bg,
        color: colors.text,
        fontSize: "12px",
        fontWeight: "600",
        borderRadius: "4px",
        padding: "3px 8px",
        marginRight: "6px",
      }}
    >
      {label}
    </span>
  );
}

export default function PostApprovalRequestEmail({
  reviewerName,
  submitterName,
  postPreview,
  postUrl,
  workspaceName,
  platforms = [],
}: PostApprovalRequestEmailProps) {
  const truncatedPreview =
    postPreview.length > 200
      ? postPreview.slice(0, 200) + "…"
      : postPreview;

  return (
    <EmailLayout
      previewText={`${submitterName} submitted a post for your review in ${workspaceName}.`}
    >
      {/* Heading */}
      <h1
        style={{
          margin: "0 0 8px",
          fontSize: "24px",
          fontWeight: "700",
          color: "#18181b",
          lineHeight: "1.3",
        }}
      >
        New post waiting for your approval
      </h1>

      <p
        style={{
          margin: "0 0 24px",
          fontSize: "16px",
          color: "#52525b",
          lineHeight: "1.6",
        }}
      >
        Hi {reviewerName}, <strong>{submitterName}</strong> submitted a post in{" "}
        <strong>{workspaceName}</strong> and it needs your review before it goes
        live.
      </p>

      {/* Post preview card */}
      <table
        width="100%"
        cellPadding={0}
        cellSpacing={0}
        role="presentation"
        style={{ marginBottom: "24px" }}
      >
        <tbody>
          <tr>
            <td
              style={{
                backgroundColor: "#fafafa",
                border: "1px solid #e4e4e7",
                borderRadius: "8px",
                padding: "20px",
              }}
            >
              {/* Platform badges */}
              {platforms.length > 0 && (
                <div style={{ marginBottom: "12px" }}>
                  {platforms.map((p) => (
                    <PlatformBadge key={p} platform={p} />
                  ))}
                </div>
              )}

              {/* Post content preview */}
              <p
                style={{
                  margin: 0,
                  fontSize: "15px",
                  color: "#27272a",
                  lineHeight: "1.7",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {truncatedPreview}
              </p>

              {postPreview.length > 200 && (
                <p
                  style={{
                    margin: "8px 0 0",
                    fontSize: "13px",
                    color: "#a1a1aa",
                  }}
                >
                  Preview truncated — see full post in PostSyncer.
                </p>
              )}
            </td>
          </tr>
        </tbody>
      </table>

      {/* CTA button */}
      <table
        width="100%"
        cellPadding={0}
        cellSpacing={0}
        role="presentation"
        style={{ marginBottom: "24px" }}
      >
        <tbody>
          <tr>
            <td align="center">
              <a
                href={postUrl}
                style={{
                  display: "inline-block",
                  backgroundColor: "#7c3aed",
                  color: "#ffffff",
                  fontSize: "16px",
                  fontWeight: "600",
                  textDecoration: "none",
                  borderRadius: "8px",
                  padding: "13px 32px",
                  lineHeight: "1",
                }}
              >
                Review Post
              </a>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Divider */}
      <hr
        style={{
          border: "none",
          borderTop: "1px solid #f4f4f5",
          margin: "8px 0 20px",
        }}
      />

      <p
        style={{
          margin: 0,
          fontSize: "13px",
          color: "#a1a1aa",
          lineHeight: "1.6",
        }}
      >
        You&apos;re receiving this because you&apos;re an approver in{" "}
        {workspaceName}. You can change notification settings in your workspace
        preferences.
      </p>
    </EmailLayout>
  );
}
