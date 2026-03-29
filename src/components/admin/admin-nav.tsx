"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Building2,
  CreditCard,
  Shield,
  ChevronLeft,
  ChevronRight,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const ADMIN_NAV_ITEMS: NavItem[] = [
  { label: "Overview", href: "/admin", icon: LayoutDashboard },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Workspaces", href: "/admin/workspaces", icon: Building2 },
  { label: "Subscriptions", href: "/admin/subscriptions", icon: CreditCard },
];

export function AdminNav() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(false);

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "hidden md:flex flex-col shrink-0 h-screen sticky top-0 border-r border-border bg-zinc-950 text-zinc-100 transition-all duration-300",
          collapsed ? "w-[60px]" : "w-[220px]"
        )}
      >
        {/* Logo + Admin badge */}
        <div
          className={cn(
            "flex items-center gap-2 border-b border-zinc-800",
            collapsed ? "px-2 py-4 justify-center" : "px-4 py-4"
          )}
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-red-600">
            <Zap className="h-4 w-4 text-white" />
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold tracking-tight text-white leading-none">
                PostSyncer
              </span>
              <span className="flex items-center gap-1 mt-0.5">
                <Shield className="h-2.5 w-2.5 text-red-400" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-red-400">
                  Super Admin
                </span>
              </span>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
          {!collapsed && (
            <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Administration
            </p>
          )}
          {ADMIN_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);

            const linkContent = (
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2 py-2 text-sm font-medium transition-colors",
                  collapsed ? "justify-center px-0 w-full" : "",
                  isActive
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
              </Link>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              );
            }

            return <div key={item.href}>{linkContent}</div>;
          })}
        </nav>

        {/* Back to app link */}
        {!collapsed && (
          <div className="border-t border-zinc-800 px-4 py-3">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Back to App
            </Link>
          </div>
        )}

        {/* Collapse toggle */}
        <div className="border-t border-zinc-800 p-2">
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="flex w-full items-center justify-center rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <div className="flex w-full items-center gap-2 text-xs">
                <ChevronLeft className="h-4 w-4" />
                <span>Collapse</span>
              </div>
            )}
          </button>
        </div>
      </aside>

      {/* Mobile admin bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur-sm">
        <ul className="flex items-center justify-around px-2 py-1">
          {ADMIN_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center gap-0.5 rounded-lg px-3 py-2 text-[10px] font-medium transition-colors",
                    isActive ? "text-white" : "text-zinc-500"
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  <div
                    className={cn(
                      "flex items-center justify-center rounded-md p-1",
                      isActive && "bg-zinc-800"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </TooltipProvider>
  );
}
