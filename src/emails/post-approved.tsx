import React from "react";
import { EmailLayout } from "./components/email-layout";

export interface PostApprovedEmailProps {
  userName: string;
  approverName: string;
  postPreview: string;
  postUrl: string;
  workspaceName: string;
  scheduledAt?: string;
}

export default function PostApprovedEmail({
  userName,
  approverName,
  postPreview,
  postUrl,
  workspaceName,
  scheduledAt,
}: PostApprovedEmailProps) {
  const truncatedPreview =
    postPreview.length > 200
      ? postPreview.slice(0, 200) + "…"
      : postPreview;

  return (
    <EmailLayout
      previewText={`Your post in ${workspaceName} has been approved by ${approverName}.`}
    >
      {/* Success icon + heading */}
      <table
        width="100%"
        cellPadding={0}
        cellSpacing={0}
        role="presentation"
        style={{ marginBottom: "24px" }}
      >
        <tbody>
          <tr>
            <td>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  backgroundColor: "#f0fdf4",
                  borderRadius: "50%",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "24px",
                  lineHeight: "48px",
                  textAlign: "center",
                  marginBottom: "16px",
                }}
              >
                ✓
              </div>
              <h1
                style={{
                  margin: "0 0 8px",
                  fontSize: "24px",
                  fontWeight: "700",
                  color: "#18181b",
                  lineHeight: "1.3",
                }}
              >
                Your post was approved!
              </h1>
              <p
                style={{
                  margin: 0,
                  fontSize: "16px",
                  color: "#52525b",
                  lineHeight: "1.6",
                }}
              >
                Hi {userName}, great news — <strong>{approverName}</strong>{" "}
                approved your post in <strong>{workspaceName}</strong>.
                {scheduledAt
                  ? ` It's scheduled to publish on ${scheduledAt}.`
                  : " It's ready to publish."}
              </p>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Post preview card */}
      <table
        width="100%"
        cellPadding={0}
        cellSpacing={0}
        role="presentation"
        style={{ marginBottom: "28px" }}
      >
        <tbody>
          <tr>
            <td
              style={{
                backgroundColor: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: "8px",
                padding: "20px",
              }}
            >
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
      >
        <tbody>
          <tr>
            <td align="center">
              <a
                href={postUrl}
                style={{
                  display: "inline-block",
                  backgroundColor: "#16a34a",
                  color: "#ffffff",
                  fontSize: "16px",
                  fontWeight: "600",
                  textDecoration: "none",
                  borderRadius: "8px",
                  padding: "13px 32px",
                  lineHeight: "1",
                }}
              >
                View Post
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
          margin: "32px 0 20px",
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
        You&apos;re receiving this because you submitted a post for approval in{" "}
        {workspaceName}.
      </p>
    </EmailLayout>
  );
}
