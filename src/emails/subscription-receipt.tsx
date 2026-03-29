import React from "react";
import { EmailLayout } from "./components/email-layout";

export interface SubscriptionReceiptEmailProps {
  userName: string;
  planName: string;
  amount: string;
  currency: string;
  billingDate: string;
  nextBillingDate: string;
  invoiceUrl: string;
  invoiceNumber: string;
  last4?: string;
  cardBrand?: string;
}

export default function SubscriptionReceiptEmail({
  userName,
  planName,
  amount,
  currency,
  billingDate,
  nextBillingDate,
  invoiceUrl,
  invoiceNumber,
  last4,
  cardBrand,
}: SubscriptionReceiptEmailProps) {
  const currencySymbol =
    currency.toUpperCase() === "USD"
      ? "$"
      : currency.toUpperCase() === "EUR"
      ? "€"
      : currency.toUpperCase() === "GBP"
      ? "£"
      : currency.toUpperCase() + " ";

  return (
    <EmailLayout
      previewText={`Payment receipt for PostSyncer ${planName} — ${currencySymbol}${amount}`}
    >
      {/* Success indicator */}
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
                backgroundColor: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: "8px",
                padding: "14px 16px",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#15803d",
                }}
              >
                ✓ Payment successful
              </p>
            </td>
          </tr>
        </tbody>
      </table>

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
        Your payment receipt
      </h1>

      <p
        style={{
          margin: "0 0 28px",
          fontSize: "16px",
          color: "#52525b",
          lineHeight: "1.6",
        }}
      >
        Hi {userName}, thank you for your payment. Here&apos;s your receipt for
        the <strong>PostSyncer {planName}</strong> subscription.
      </p>

      {/* Receipt details */}
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
                border: "1px solid #e4e4e7",
                borderRadius: "8px",
                overflow: "hidden",
              }}
            >
              {/* Invoice header */}
              <table
                width="100%"
                cellPadding={0}
                cellSpacing={0}
                role="presentation"
              >
                <tbody>
                  <tr>
                    <td
                      style={{
                        backgroundColor: "#fafafa",
                        borderBottom: "1px solid #e4e4e7",
                        padding: "12px 20px",
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
                              <span
                                style={{
                                  fontSize: "13px",
                                  fontWeight: "600",
                                  color: "#71717a",
                                }}
                              >
                                Invoice #{invoiceNumber}
                              </span>
                            </td>
                            <td align="right">
                              <span
                                style={{
                                  fontSize: "13px",
                                  color: "#71717a",
                                }}
                              >
                                {billingDate}
                              </span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                  </tr>

                  {/* Line item */}
                  <tr>
                    <td style={{ padding: "16px 20px" }}>
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
                                  margin: "0 0 2px",
                                  fontSize: "15px",
                                  fontWeight: "600",
                                  color: "#18181b",
                                }}
                              >
                                PostSyncer {planName}
                              </p>
                              <p
                                style={{
                                  margin: 0,
                                  fontSize: "13px",
                                  color: "#71717a",
                                }}
                              >
                                Monthly subscription
                              </p>
                            </td>
                            <td align="right">
                              <span
                                style={{
                                  fontSize: "15px",
                                  fontWeight: "600",
                                  color: "#18181b",
                                }}
                              >
                                {currencySymbol}
                                {amount}
                              </span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                  </tr>

                  {/* Divider */}
                  <tr>
                    <td style={{ padding: "0 20px" }}>
                      <hr
                        style={{
                          border: "none",
                          borderTop: "1px solid #f4f4f5",
                          margin: 0,
                        }}
                      />
                    </td>
                  </tr>

                  {/* Total */}
                  <tr>
                    <td style={{ padding: "16px 20px" }}>
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
                                  fontSize: "15px",
                                  fontWeight: "700",
                                  color: "#18181b",
                                }}
                              >
                                Total charged
                              </span>
                            </td>
                            <td align="right">
                              <span
                                style={{
                                  fontSize: "18px",
                                  fontWeight: "700",
                                  color: "#18181b",
                                }}
                              >
                                {currencySymbol}
                                {amount}
                              </span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                  </tr>

                  {/* Payment method */}
                  {last4 && (
                    <>
                      <tr>
                        <td style={{ padding: "0 20px" }}>
                          <hr
                            style={{
                              border: "none",
                              borderTop: "1px solid #f4f4f5",
                              margin: 0,
                            }}
                          />
                        </td>
                      </tr>
                      <tr>
                        <td
                          style={{
                            backgroundColor: "#fafafa",
                            borderTop: "1px solid #f4f4f5",
                            padding: "12px 20px",
                          }}
                        >
                          <p
                            style={{
                              margin: 0,
                              fontSize: "13px",
                              color: "#71717a",
                            }}
                          >
                            Paid with{" "}
                            {cardBrand
                              ? `${cardBrand} ending in ${last4}`
                              : `card ending in ${last4}`}
                          </p>
                        </td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Next billing */}
      <p
        style={{
          margin: "0 0 24px",
          fontSize: "14px",
          color: "#71717a",
          lineHeight: "1.6",
        }}
      >
        Your next billing date is{" "}
        <strong style={{ color: "#3f3f46" }}>{nextBillingDate}</strong>.
      </p>

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
                href={invoiceUrl}
                style={{
                  display: "inline-block",
                  backgroundColor: "#7c3aed",
                  color: "#ffffff",
                  fontSize: "15px",
                  fontWeight: "600",
                  textDecoration: "none",
                  borderRadius: "8px",
                  padding: "12px 28px",
                  lineHeight: "1",
                }}
              >
                Download Invoice
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
        To manage your subscription or update your billing information, visit
        your account settings. Questions? Reply to this email.
      </p>
    </EmailLayout>
  );
}
