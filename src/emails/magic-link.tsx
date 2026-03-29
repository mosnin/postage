import React from "react";
import { EmailLayout } from "./components/email-layout";

export interface MagicLinkEmailProps {
  userEmail: string;
  magicUrl: string;
  expiresInMinutes?: number;
}

export default function MagicLinkEmail({
  userEmail,
  magicUrl,
  expiresInMinutes = 15,
}: MagicLinkEmailProps) {
  return (
    <EmailLayout
      previewText={`Your PostSyncer sign-in link — expires in ${expiresInMinutes} minutes.`}
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
        Sign in to PostSyncer
      </h1>

      <p
        style={{
          margin: "0 0 28px",
          fontSize: "16px",
          color: "#52525b",
          lineHeight: "1.6",
        }}
      >
        Click the button below to sign in to your account. This link expires in{" "}
        <strong>{expiresInMinutes} minutes</strong> and can only be used once.
      </p>

      {/* CTA button */}
      <table
        width="100%"
        cellPadding={0}
        cellSpacing={0}
        role="presentation"
        style={{ marginBottom: "28px" }}
      >
        <tbody>
          <tr>
            <td align="center">
              <a
                href={magicUrl}
                style={{
                  display: "inline-block",
                  backgroundColor: "#7c3aed",
                  color: "#ffffff",
                  fontSize: "17px",
                  fontWeight: "700",
                  textDecoration: "none",
                  borderRadius: "8px",
                  padding: "15px 40px",
                  lineHeight: "1",
                  letterSpacing: "-0.1px",
                }}
              >
                Sign In to PostSyncer
              </a>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Fallback link */}
      <p
        style={{
          margin: "0 0 28px",
          fontSize: "13px",
          color: "#71717a",
          lineHeight: "1.6",
          textAlign: "center",
        }}
      >
        If the button doesn&apos;t work, copy and paste this link into your
        browser:
        <br />
        <a
          href={magicUrl}
          style={{
            color: "#7c3aed",
            textDecoration: "underline",
            wordBreak: "break-all",
            fontSize: "12px",
          }}
        >
          {magicUrl}
        </a>
      </p>

      {/* Divider */}
      <hr
        style={{
          border: "none",
          borderTop: "1px solid #f4f4f5",
          margin: "8px 0 24px",
        }}
      />

      {/* Security tip */}
      <table
        width="100%"
        cellPadding={0}
        cellSpacing={0}
        role="presentation"
        style={{ marginBottom: "16px" }}
      >
        <tbody>
          <tr>
            <td
              style={{
                backgroundColor: "#f8fafc",
                border: "1px solid #e4e4e7",
                borderRadius: "8px",
                padding: "14px 16px",
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
                      valign="top"
                      style={{ width: "20px", paddingRight: "10px" }}
                    >
                      <span style={{ fontSize: "14px" }}>🔒</span>
                    </td>
                    <td valign="top">
                      <p
                        style={{
                          margin: "0 0 4px",
                          fontSize: "13px",
                          fontWeight: "600",
                          color: "#3f3f46",
                        }}
                      >
                        Security tip
                      </p>
                      <p
                        style={{
                          margin: 0,
                          fontSize: "13px",
                          color: "#71717a",
                          lineHeight: "1.5",
                        }}
                      >
                        PostSyncer will never ask for your password via email.
                        Never share this link with anyone.
                      </p>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>

      <p
        style={{
          margin: 0,
          fontSize: "13px",
          color: "#a1a1aa",
          lineHeight: "1.6",
        }}
      >
        This sign-in link was requested for{" "}
        <span style={{ color: "#71717a" }}>{userEmail}</span>. If you
        didn&apos;t request this, you can safely ignore this email — your
        account will not be affected.
      </p>
    </EmailLayout>
  );
}
