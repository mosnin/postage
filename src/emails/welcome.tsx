import React from "react";
import { EmailLayout } from "./components/email-layout";

export interface WelcomeEmailProps {
  userName: string;
  dashboardUrl: string;
}

const steps = [
  {
    number: "1",
    title: "Connect your first social account",
    description: "Link Twitter, LinkedIn, Instagram, and more in one place.",
  },
  {
    number: "2",
    title: "Schedule your first post",
    description: "Pick the perfect time and let PostSyncer handle the rest.",
  },
  {
    number: "3",
    title: "Invite your team",
    description: "Collaborate, review, and approve content together.",
  },
];

export default function WelcomeEmail({
  userName,
  dashboardUrl,
}: WelcomeEmailProps) {
  return (
    <EmailLayout previewText={`Welcome to PostSyncer, ${userName}! Your free trial is active.`}>
      {/* Greeting */}
      <h1
        style={{
          margin: "0 0 8px",
          fontSize: "24px",
          fontWeight: "700",
          color: "#18181b",
          lineHeight: "1.3",
        }}
      >
        Welcome to PostSyncer, {userName}!
      </h1>

      <p
        style={{
          margin: "0 0 24px",
          fontSize: "16px",
          color: "#52525b",
          lineHeight: "1.6",
        }}
      >
        We&apos;re thrilled to have you on board. Here&apos;s how to get up and
        running in minutes.
      </p>

      {/* Trial badge */}
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
                padding: "12px 16px",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: "14px",
                  color: "#15803d",
                  fontWeight: "600",
                }}
              >
                ✓ Your 7-day free trial is active — no credit card required
              </p>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Steps */}
      <p
        style={{
          margin: "0 0 16px",
          fontSize: "14px",
          fontWeight: "600",
          color: "#18181b",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        Get started in 3 steps
      </p>

      <table
        width="100%"
        cellPadding={0}
        cellSpacing={0}
        role="presentation"
        style={{ marginBottom: "32px" }}
      >
        <tbody>
          {steps.map((step, i) => (
            <tr key={step.number}>
              <td style={{ paddingBottom: i < steps.length - 1 ? "20px" : 0 }}>
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
                        style={{ width: "36px", paddingRight: "12px" }}
                      >
                        <div
                          style={{
                            width: "32px",
                            height: "32px",
                            backgroundColor: "#7c3aed",
                            borderRadius: "50%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            textAlign: "center",
                            lineHeight: "32px",
                            color: "#ffffff",
                            fontSize: "14px",
                            fontWeight: "700",
                          }}
                        >
                          {step.number}
                        </div>
                      </td>
                      <td valign="top">
                        <p
                          style={{
                            margin: "0 0 2px",
                            fontSize: "15px",
                            fontWeight: "600",
                            color: "#18181b",
                          }}
                        >
                          {step.title}
                        </p>
                        <p
                          style={{
                            margin: 0,
                            fontSize: "14px",
                            color: "#71717a",
                            lineHeight: "1.5",
                          }}
                        >
                          {step.description}
                        </p>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          ))}
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
                href={dashboardUrl}
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
                Go to Dashboard
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
          margin: "32px 0 24px",
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
        Questions? Reply to this email and we&apos;ll be happy to help. We
        read every message.
      </p>
    </EmailLayout>
  );
}
