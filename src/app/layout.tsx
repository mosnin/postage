import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "PostSyncer — Create Once. Share Everywhere.",
    template: "%s | PostSyncer",
  },
  description:
    "Manage all your social accounts, schedule content, and create AI videos and images — all from one dashboard. Loved by 50,000+ creators.",
  keywords: [
    "social media scheduler",
    "social media management",
    "post scheduling",
    "content calendar",
    "AI content creation",
  ],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: process.env.NEXT_PUBLIC_APP_URL,
    title: "PostSyncer — Create Once. Share Everywhere.",
    description:
      "Schedule posts across 11 platforms, create AI content, and manage your team — all in one place.",
    siteName: "PostSyncer",
  },
  twitter: {
    card: "summary_large_image",
    title: "PostSyncer — Create Once. Share Everywhere.",
    description:
      "Schedule posts across 11 platforms, create AI content, and manage your team — all in one place.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
