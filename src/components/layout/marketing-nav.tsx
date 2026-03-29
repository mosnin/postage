"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Menu,
  X,
  ChevronDown,
  Zap,
} from "lucide-react";

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  {
    label: "Platforms",
    href: "#platforms",
    dropdown: [
      { label: "Twitter / X", href: "/platforms/twitter" },
      { label: "Facebook", href: "/platforms/facebook" },
      { label: "Instagram", href: "/platforms/instagram" },
      { label: "TikTok", href: "/platforms/tiktok" },
      { label: "YouTube", href: "/platforms/youtube" },
      { label: "Pinterest", href: "/platforms/pinterest" },
      { label: "Threads", href: "/platforms/threads" },
      { label: "Telegram", href: "/platforms/telegram" },
      { label: "LinkedIn", href: "/platforms/linkedin" },
      { label: "Bluesky", href: "/platforms/bluesky" },
      { label: "Mastodon", href: "/platforms/mastodon" },
    ],
  },
  { label: "Blog", href: "/blog" },
  { label: "Free Tools", href: "/tools" },
];

export function MarketingNav() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [platformsOpen, setPlatformsOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 font-bold text-xl tracking-tight"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Zap className="h-4 w-4 text-primary-foreground" />
          </div>
          <span>PostSyncer</span>
        </Link>

        {/* Desktop Nav */}
        <ul className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) =>
            link.dropdown ? (
              <li key={link.label} className="relative">
                <button
                  onClick={() => setPlatformsOpen((v) => !v)}
                  onBlur={() => setTimeout(() => setPlatformsOpen(false), 150)}
                  className="flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  {link.label}
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 transition-transform duration-200",
                      platformsOpen && "rotate-180"
                    )}
                  />
                </button>
                {platformsOpen && (
                  <div className="absolute left-0 top-full mt-1 w-48 rounded-lg border border-border bg-popover p-1 shadow-lg">
                    {link.dropdown.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="block rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </li>
            ) : (
              <li key={link.label}>
                <Link
                  href={link.href}
                  className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  {link.label}
                </Link>
              </li>
            )
          )}
        </ul>

        {/* Desktop Auth */}
        <div className="hidden md:flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/login">Log in</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/register">Start For Free</Link>
          </Button>
        </div>

        {/* Mobile Hamburger */}
        <button
          className="md:hidden rounded-md p-2 text-muted-foreground hover:text-foreground"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-background px-4 py-4">
          <ul className="space-y-1">
            {NAV_LINKS.map((link) =>
              link.dropdown ? (
                <li key={link.label}>
                  <details className="group">
                    <summary className="flex cursor-pointer items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground list-none">
                      {link.label}
                      <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
                    </summary>
                    <ul className="mt-1 ml-4 space-y-1">
                      {link.dropdown.map((item) => (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            className="block rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
                            onClick={() => setMobileOpen(false)}
                          >
                            {item.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </details>
                </li>
              ) : (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="block rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
                    onClick={() => setMobileOpen(false)}
                  >
                    {link.label}
                  </Link>
                </li>
              )
            )}
          </ul>
          <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
            <Button variant="outline" asChild>
              <Link href="/login" onClick={() => setMobileOpen(false)}>
                Log in
              </Link>
            </Button>
            <Button asChild>
              <Link href="/register" onClick={() => setMobileOpen(false)}>
                Start For Free
              </Link>
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
