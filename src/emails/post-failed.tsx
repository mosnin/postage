import React from "react";
import { EmailLayout } from "./components/email-layout";

export interface PostFailedEmailProps {
  userName: string;
  platformName: string;
  postPreview: string;
  failureReason: string;
  retryUrl: string;
}

export default function PostFailedEmail({
  userName,
  platformName,
  postPreview,
  failureReason,
  retryUrl,
}: PostFailedEmailProps) {
  const truncatedPreview =
    postPreview.length > 200
      ? postPreview.slice(0, 200) + "…"
      : postPreview;

  const platformDisplay =
    platformName.charAt(0).toUpperCase() + platformName.slice(1);

  return (
    <EmailLayout
      previewText={`Your post failed to publish on ${platformDisplay}. Here's what happened.`}
    >
      {/* Warning header */}
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
                backgroundColor: "#fff7ed",
                border: "1px solid #fed7aa",
                borderRadius: "8px",
                padding: "16px 20px",
              }}
            >
              <table
                width="100%"
                cellPadding={0}
                cellSpacing={0}
                role="presentation"
              >
                <tbody>
                  <tr>
                    <td
                      valign="middle"
                      style={{ width: "32px", paddingRight: "12px" }}
                    >
                      <span style={{ fontSize: "24px", lineHeight: "1" }}>
                        ⚠
                      </span>
                    </td>
                    <td valign="middle">
                      <p
                        style={{
                          margin: 0,
                          fontSize: "15px",
                          fontWeight: "600",
                          color: "#9a3412",
                        }}
                      >
                        Post failed to publish on {platformDisplay}
                      </p>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Greeting + context */}
      <h1
        style={{
          margin: "0 0 8px",
          fontSize: "22px",
          fontWeight: "700",
          color: "#18181b",
          lineHeight: "1.3",
        }}
      >
        We couldn&apos;t publish your post
      </h1>

      <p
        style={{
          margin: "0 0 24px",
          fontSize: "16px",
          color: "#52525b",
          lineHeight: "1.6",
        }}
      >
        Hi {userName}, your post scheduled for {platformDisplay} encountered an
        error and wasn&apos;t published. Don&apos;t worry — your content is
        saved and you can retry at any time.
      </p>

      {/* Post preview */}
      <p
        style={{
          margin: "0 0 8px",
          fontSize: "13px",
          fontWeight: "600",
          color: "#71717a",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        Post content
      </p>

      <table
        width="100%"
        cellPadding={0}
        cellSpacing={0}
        role="presentation"
        style={{ marginBottom: "20px" }}
      >
        <tbody>
          <tr>
            <td
              style={{
                backgroundColor: "#fafafa",
                border: "1px solid #e4e4e7",
                borderLeft: "3px solid #f97316",
                borderRadius: "0 8px 8px 0",
                padding: "16px 20px",
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

      {/* Error reason */}
      <p
        style={{
          margin: "0 0 8px",
          fontSize: "13px",
          fontWeight: "600",
          color: "#71717a",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        Error details
      </p>

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
                backgroundColor: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "8px",
                padding: "14px 16px",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: "14px",
                  color: "#991b1b",
                  lineHeight: "1.6",
                  fontFamily: "monospace",
                  wordBreak: "break-word",
                }}
              >
                {failureReason}
              </p>
            </td>
          </tr>
        </tbody>
      </table>

      {/* CTA buttons */}
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
              <table cellPadding={0} cellSpacing={0} role="presentation">
                <tbody>
                  <tr>
                    <td style={{ paddingRight: "12px" }}>
                      <a
                        href={retryUrl}
                        style={{
                          display: "inline-block",
                          backgroundColor: "#f97316",
                          color: "#ffffff",
                          fontSize: "15px",
                          fontWeight: "600",
                          textDecoration: "none",
                          borderRadius: "8px",
                          padding: "12px 24px",
                          lineHeight: "1",
                        }}
                      >
                        Try Again
                      </a>
                    </td>
                    <td>
                      <a
                        href={retryUrl}
                        style={{
                          display: "inline-block",
                          backgroundColor: "transparent",
                          color: "#7c3aed",
                          fontSize: "15px",
                          fontWeight: "600",
                          textDecoration: "none",
                          borderRadius: "8px",
                          border: "1px solid #ddd6fe",
                          padding: "12px 24px",
                          lineHeight: "1",
                        }}
                      >
                        Edit Post
                      </a>
                    </td>
                  </tr>
                </tbody>
              </table>
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
        If this problem persists, please contact our support team. We&apos;re
        here to help.
      </p>
    </EmailLayout>
  );
}
