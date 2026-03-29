import React from "react";
import { EmailLayout } from "./components/email-layout";

export interface TrialExpiringEmailProps {
  userName: string;
  daysRemaining: number;
  upgradeUrl: string;
}

const FEATURES = [
  "Unlimited scheduled posts",
  "All connected social accounts",
  "Team collaboration & approvals",
  "Analytics & performance insights",
  "AI caption & hashtag generation",
];

export default function TrialExpiringEmail({
  userName,
  daysRemaining,
  upgradeUrl,
}: TrialExpiringEmailProps) {
  const urgencyText =
    daysRemaining === 1 ? "1 day" : `${daysRemaining} days`;

  return (
    <EmailLayout
      previewText={`Your PostSyncer free trial ends in ${urgencyText}. Upgrade now to keep access.`}
    >
      {/* Urgency banner */}
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
                background: "linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)",
                borderRadius: "8px",
                padding: "16px 20px",
                textAlign: "center",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: "14px",
                  fontWeight: "700",
                  color: "#ffffff",
                  letterSpacing: "0.02em",
                }}
              >
                ⏰ Your free trial ends in {urgencyText}
              </p>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Heading */}
      <h1
        style={{
          margin: "0 0 12px",
          fontSize: "24px",
          fontWeight: "700",
          color: "#18181b",
          lineHeight: "1.3",
        }}
      >
        Don&apos;t lose access, {userName}
      </h1>

      <p
        style={{
          margin: "0 0 24px",
          fontSize: "16px",
          color: "#52525b",
          lineHeight: "1.6",
        }}
      >
        Your PostSyncer trial expires in{" "}
        <strong style={{ color: "#7c3aed" }}>{urgencyText}</strong>. Upgrade
        now to continue growing your social media presence without interruption.
      </p>

      {/* Features list */}
      <p
        style={{
          margin: "0 0 12px",
          fontSize: "14px",
          fontWeight: "600",
          color: "#18181b",
        }}
      >
        What you&apos;ll keep access to:
      </p>

      <table
        width="100%"
        cellPadding={0}
        cellSpacing={0}
        role="presentation"
        style={{ marginBottom: "28px" }}
      >
        <tbody>
          {FEATURES.map((feature) => (
            <tr key={feature}>
              <td style={{ paddingBottom: "8px" }}>
                <table cellPadding={0} cellSpacing={0} role="presentation">
                  <tbody>
                    <tr>
                      <td
                        valign="top"
                        style={{
                          width: "20px",
                          paddingRight: "8px",
                          paddingTop: "1px",
                        }}
                      >
                        <span
                          style={{
                            color: "#16a34a",
                            fontSize: "14px",
                            fontWeight: "700",
                          }}
                        >
                          ✓
                        </span>
                      </td>
                      <td valign="top">
                        <span
                          style={{
                            fontSize: "14px",
                            color: "#3f3f46",
                            lineHeight: "1.5",
                          }}
                        >
                          {feature}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Pricing summary */}
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
                padding: "20px",
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
                          margin: "0 0 12px",
                          fontSize: "14px",
                          fontWeight: "600",
                          color: "#7c3aed",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                        }}
                      >
                        Pro Plan
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <table
                        width="100%"
                        cellPadding={0}
                        cellSpacing={0}
                        role="presentation"
                      >
                        <tbody>
                          <tr>
                            <td>
                              <span
                                style={{
                                  fontSize: "32px",
                                  fontWeight: "800",
                                  color: "#18181b",
                                  lineHeight: "1",
                                }}
                              >
                                $29
                              </span>
                              <span
                                style={{
                                  fontSize: "14px",
                                  color: "#71717a",
                                  marginLeft: "4px",
                                }}
                              >
                                / month
                              </span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style={{ paddingTop: "8px" }}>
                      <p
                        style={{
                          margin: 0,
                          fontSize: "13px",
                          color: "#71717a",
                        }}
                      >
                        Cancel anytime. No hidden fees.
                      </p>
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
      >
        <tbody>
          <tr>
            <td align="center">
              <a
                href={upgradeUrl}
                style={{
                  display: "inline-block",
                  backgroundColor: "#7c3aed",
                  color: "#ffffff",
                  fontSize: "16px",
                  fontWeight: "600",
                  textDecoration: "none",
                  borderRadius: "8px",
                  padding: "13px 40px",
                  lineHeight: "1",
                }}
              >
                Upgrade Now
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
        If you have any questions about pricing or need a custom plan, reply to
        this email and we&apos;ll be happy to help.
      </p>
    </EmailLayout>
  );
}
