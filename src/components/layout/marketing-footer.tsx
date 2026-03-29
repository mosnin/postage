import Link from "next/link";
import { Zap } from "lucide-react";

const FOOTER_LINKS = {
  Product: [
    { label: "Features", href: "#features" },
    { label: "Pricing", href: "#pricing" },
    { label: "Platforms", href: "#platforms" },
    { label: "Changelog", href: "/changelog" },
    { label: "Roadmap", href: "/roadmap" },
  ],
  Resources: [
    { label: "Blog", href: "/blog" },
    { label: "Free Tools", href: "/tools" },
    { label: "Help Center", href: "/help" },
    { label: "API Docs", href: "/docs/api" },
    { label: "Status", href: "/status" },
  ],
  Company: [
    { label: "About", href: "/about" },
    { label: "Careers", href: "/careers" },
    { label: "Press", href: "/press" },
    { label: "Contact", href: "/contact" },
    { label: "Affiliates", href: "/affiliates" },
  ],
  Legal: [
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
    { label: "Cookie Policy", href: "/cookies" },
    { label: "GDPR", href: "/gdpr" },
  ],
};

const PLATFORMS = [
  "Twitter / X",
  "Facebook",
  "Instagram",
  "TikTok",
  "YouTube",
  "Pinterest",
  "Threads",
  "Telegram",
  "LinkedIn",
  "Bluesky",
  "Mastodon",
];

export function MarketingFooter() {
  return (
    <footer className="border-t border-border bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Top row */}
        <div className="grid grid-cols-2 gap-8 md:grid-cols-6">
          {/* Brand */}
          <div className="col-span-2">
            <Link href="/" className="flex items-center gap-2 font-bold text-xl tracking-tight">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <Zap className="h-4 w-4 text-primary-foreground" />
              </div>
              <span>PostSyncer</span>
            </Link>
            <p className="mt-3 text-sm text-muted-foreground max-w-xs">
              Create Once. Share Everywhere. The social media scheduling platform loved by 50,000+ creators.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {PLATFORMS.map((platform) => (
                <span
                  key={platform}
                  className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground"
                >
                  {platform}
                </span>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(FOOTER_LINKS).map(([category, links]) => (
            <div key={category}>
              <h3 className="mb-3 text-sm font-semibold">{category}</h3>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom row */}
        <div className="mt-10 border-t border-border pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} PostSyncer. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground">
            Supporting 11 platforms &bull; 50,000+ creators &bull; 4.8&#9733; rated
          </p>
        </div>
      </div>
    </footer>
  );
}
