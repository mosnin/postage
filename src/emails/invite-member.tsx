import React from "react";
import { EmailLayout } from "./components/email-layout";

export interface InviteMemberEmailProps {
  workspaceName: string;
  inviterName: string;
  role: string;
  inviteUrl: string;
  expiresInHours?: number;
}

export default function InviteMemberEmail({
  workspaceName,
  inviterName,
  role,
  inviteUrl,
  expiresInHours = 48,
}: InviteMemberEmailProps) {
  const roleDisplay =
    role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();

  return (
    <EmailLayout
      previewText={`${inviterName} has invited you to join ${workspaceName} on PostSyncer.`}
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
        You&apos;ve been invited to join PostSyncer
      </h1>

      <p
        style={{
          margin: "0 0 24px",
          fontSize: "16px",
          color: "#52525b",
          lineHeight: "1.6",
        }}
      >
        <strong>{inviterName}</strong> has invited you to join{" "}
        <strong>{workspaceName}</strong> as a{" "}
        <strong>{roleDisplay}</strong>.
      </p>

      {/* Workspace card */}
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
                backgroundColor: "#faf5ff",
                border: "1px solid #e9d5ff",
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
                    <td>
                      <p
                        style={{
                          margin: "0 0 4px",
                          fontSize: "12px",
                          fontWeight: "600",
                          color: "#7c3aed",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                        }}
                      >
                        Workspace
                      </p>
                      <p
                        style={{
                          margin: "0 0 12px",
                          fontSize: "16px",
                          fontWeight: "700",
                          color: "#18181b",
                        }}
                      >
                        {workspaceName}
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <table cellPadding={0} cellSpacing={0} role="presentation">
                        <tbody>
                          <tr>
                            <td>
                              <span
                                style={{
                                  display: "inline-block",
                                  backgroundColor: "#ede9fe",
                                  color: "#5b21b6",
                                  fontSize: "12px",
                                  fontWeight: "600",
                                  borderRadius: "4px",
                                  padding: "3px 8px",
                                }}
                              >
                                {roleDisplay}
                              </span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                  </tr>
                </tbody>
              </table>
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
                href={inviteUrl}
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
                Accept Invitation
              </a>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Expiry warning */}
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
                backgroundColor: "#fffbeb",
                border: "1px solid #fde68a",
                borderRadius: "8px",
                padding: "12px 16px",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: "14px",
                  color: "#92400e",
                  lineHeight: "1.5",
                }}
              >
                ⏱ This invitation expires in{" "}
                <strong>{expiresInHours} hours</strong>. After that, you&apos;ll
                need to request a new invite.
              </p>
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
        If you didn&apos;t expect this email, you can safely ignore it. Your
        account will not be affected.
      </p>
    </EmailLayout>
  );
}
