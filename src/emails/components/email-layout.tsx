import React from "react";

interface EmailLayoutProps {
  children: React.ReactNode;
  previewText?: string;
}

export function EmailLayout({ children, previewText }: EmailLayoutProps) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        <title>PostSyncer</title>
        {previewText && (
          <style>{`
            .preview-text {
              display: none;
              overflow: hidden;
              max-height: 0;
              max-width: 0;
              opacity: 0;
            }
          `}</style>
        )}
      </head>
      <body
        style={{
          margin: 0,
          padding: 0,
          backgroundColor: "#f4f4f5",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          WebkitTextSizeAdjust: "100%",
          // @ts-expect-error — vendor prefix not in React.CSSProperties but valid in email clients
          MsTextSizeAdjust: "100%",
        }}
      >
        {/* Preview text for email clients */}
        {previewText && (
          <div className="preview-text" aria-hidden="true">
            {previewText}
            {/* Pad preview text so body content doesn't bleed in */}
            {"\u00A0\u200C".repeat(50)}
          </div>
        )}

        {/* Outer wrapper */}
        <table
          width="100%"
          cellPadding={0}
          cellSpacing={0}
          role="presentation"
          style={{ backgroundColor: "#f4f4f5", padding: "40px 16px" }}
        >
          <tbody>
            <tr>
              <td align="center">
                {/* Logo header */}
                <table
                  width="100%"
                  cellPadding={0}
                  cellSpacing={0}
                  role="presentation"
                  style={{ maxWidth: "560px" }}
                >
                  <tbody>
                    <tr>
                      <td
                        align="center"
                        style={{ paddingBottom: "24px" }}
                      >
                        <table
                          cellPadding={0}
                          cellSpacing={0}
                          role="presentation"
                        >
                          <tbody>
                            <tr>
                              <td
                                style={{
                                  backgroundColor: "#7c3aed",
                                  borderRadius: "10px",
                                  padding: "8px 14px",
                                  display: "inline-block",
                                }}
                              >
                                <span
                                  style={{
                                    color: "#ffffff",
                                    fontSize: "18px",
                                    fontWeight: "700",
                                    letterSpacing: "-0.3px",
                                    fontFamily:
                                      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                                  }}
                                >
                                  PostSyncer
                                </span>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>

                    {/* White card */}
                    <tr>
                      <td
                        style={{
                          backgroundColor: "#ffffff",
                          borderRadius: "12px",
                          padding: "40px 40px 32px",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                        }}
                      >
                        {children}
                      </td>
                    </tr>

                    {/* Footer */}
                    <tr>
                      <td
                        align="center"
                        style={{ paddingTop: "24px" }}
                      >
                        <p
                          style={{
                            margin: 0,
                            fontSize: "12px",
                            color: "#71717a",
                            lineHeight: "1.6",
                            textAlign: "center",
                          }}
                        >
                          &copy; 2026 PostSyncer. All rights reserved.
                          <br />
                          <a
                            href="https://postsyncer.com/unsubscribe"
                            style={{
                              color: "#71717a",
                              textDecoration: "underline",
                            }}
                          >
                            Unsubscribe
                          </a>
                          {" · "}
                          <a
                            href="https://postsyncer.com/privacy"
                            style={{
                              color: "#71717a",
                              textDecoration: "underline",
                            }}
                          >
                            Privacy Policy
                          </a>
                        </p>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  );
}
