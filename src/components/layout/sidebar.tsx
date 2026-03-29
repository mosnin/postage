"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  PlusCircle,
  ListOrdered,
  FileText,
  Upload,
  MessageSquare,
  MessageCircle,
  BarChart2,
  Image,
  Tag,
  Megaphone,
  Link as LinkIcon,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { WorkspaceSwitcher } from "@/components/layout/workspace-switcher";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SidebarWorkspace {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
}

interface SidebarProps {
  currentWorkspace: SidebarWorkspace;
  workspaces: SidebarWorkspace[];
  unreadInbox?: number;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: number;
  variant?: "default" | "primary";
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: "OVERVIEW",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Calendar", href: "/calendar", icon: CalendarDays },
    ],
  },
  {
    title: "PUBLISHING",
    items: [
      {
        label: "New Post",
        href: "/posts/new",
        icon: PlusCircle,
        variant: "primary",
      },
      { label: "Queue", href: "/queue", icon: ListOrdered },
      { label: "Drafts", href: "/drafts", icon: FileText },
      { label: "Bulk Schedule", href: "/bulk-schedule", icon: Upload },
    ],
  },
  {
    title: "ENGAGE",
    items: [
      { label: "Inbox", href: "/inbox", icon: MessageSquare },
      { label: "Comments", href: "/comments", icon: MessageCircle },
    ],
  },
  {
    title: "INSIGHTS",
    items: [
      { label: "Analytics", href: "/analytics", icon: BarChart2 },
    ],
  },
  {
    title: "CONTENT",
    items: [
      { label: "Media Library", href: "/media", icon: Image },
      { label: "Labels", href: "/labels", icon: Tag },
      { label: "Campaigns", href: "/campaigns", icon: Megaphone },
    ],
  },
  {
    title: "SETTINGS",
    items: [
      { label: "Accounts", href: "/accounts", icon: LinkIcon },
      { label: "Team", href: "/team", icon: Users },
      { label: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

export function Sidebar({ currentWorkspace, workspaces, unreadInbox = 0 }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(false);

  // Inject unread badge into Inbox item
  const sectionsWithBadges = React.useMemo(
    () =>
      NAV_SECTIONS.map((section) => ({
        ...section,
        items: section.items.map((item) =>
          item.href === "/inbox" ? { ...item, badge: unreadInbox } : item
        ),
      })),
    [unreadInbox]
  );

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "hidden md:flex flex-col shrink-0 h-screen sticky top-0 border-r border-border bg-background transition-all duration-300",
          collapsed ? "w-[60px]" : "w-[240px]"
        )}
      >
        {/* Top: Logo + Workspace Switcher */}
        <div className={cn("flex items-center border-b border-border", collapsed ? "px-1 py-3 justify-center" : "px-3 py-3")}>
          {!collapsed && (
            <Link
              href="/dashboard"
              className="mr-2 flex items-center gap-1.5 text-sm font-bold tracking-tight text-foreground"
              aria-label="PostSyncer home"
            >
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary">
                <Zap className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
            </Link>
          )}
          <div className={cn("flex-1 min-w-0", collapsed && "w-full")}>
            <WorkspaceSwitcher
              currentWorkspace={currentWorkspace}
              workspaces={workspaces}
              collapsed={collapsed}
            />
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
          {sectionsWithBadges.map((section) => (
            <div key={section.title}>
              {!collapsed && (
                <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  {section.title}
                </p>
              )}
              <ul className="space-y-0.5">
                {section.items.map((item) => (
                  <NavLink
                    key={item.href}
                    item={item}
                    pathname={pathname}
                    collapsed={collapsed}
                  />
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* Collapse toggle */}
        <div className="border-t border-border p-2">
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="flex w-full items-center justify-center rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
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

      {/* Mobile bottom tab bar */}
      <MobileNav
        sections={sectionsWithBadges}
        pathname={pathname}
      />
    </TooltipProvider>
  );
}

function NavLink({
  item,
  pathname,
  collapsed,
}: {
  item: NavItem;
  pathname: string;
  collapsed: boolean;
}) {
  const Icon = item.icon;
  const isActive =
    item.href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname.startsWith(item.href);

  const isPrimary = item.variant === "primary";

  const linkContent = (
    <Link
      href={item.href}
      className={cn(
        "group flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
        collapsed ? "justify-center px-0 py-2 w-full" : "",
        isPrimary
          ? isActive
            ? "bg-primary text-primary-foreground"
            : "bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground"
          : isActive
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      )}
      aria-current={isActive ? "page" : undefined}
    >
      <Icon
        className={cn(
          "h-4 w-4 shrink-0",
          isPrimary && !isActive && "text-primary"
        )}
      />
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{item.label}</span>
          {typeof item.badge === "number" && item.badge > 0 && (
            <span className="ml-auto flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {item.badge > 99 ? "99+" : item.badge}
            </span>
          )}
        </>
      )}
    </Link>
  );

  if (collapsed) {
    return (
      <li>
        <Tooltip>
          <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
          <TooltipContent side="right" className="flex items-center gap-2">
            {item.label}
            {typeof item.badge === "number" && item.badge > 0 && (
              <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                {item.badge > 99 ? "99+" : item.badge}
              </span>
            )}
          </TooltipContent>
        </Tooltip>
      </li>
    );
  }

  return <li>{linkContent}</li>;
}

const MOBILE_NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Calendar", href: "/calendar", icon: CalendarDays },
  { label: "New Post", href: "/posts/new", icon: PlusCircle, variant: "primary" },
  { label: "Inbox", href: "/inbox", icon: MessageSquare },
  { label: "Analytics", href: "/analytics", icon: BarChart2 },
];

function MobileNav({
  sections,
  pathname,
}: {
  sections: NavSection[];
  pathname: string;
}) {
  // Pull badge from the full sections
  const inboxBadge =
    sections
      .flatMap((s) => s.items)
      .find((i) => i.href === "/inbox")?.badge ?? 0;

  const items = MOBILE_NAV_ITEMS.map((item) =>
    item.href === "/inbox" ? { ...item, badge: inboxBadge } : item
  );

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur-sm">
      <ul className="flex items-center justify-around px-2 py-1">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
          const isPrimary = item.variant === "primary";

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "relative flex flex-col items-center gap-0.5 rounded-lg px-3 py-2 text-[10px] font-medium transition-colors",
                  isPrimary
                    ? "text-primary"
                    : isActive
                    ? "text-foreground"
                    : "text-muted-foreground"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <div
                  className={cn(
                    "flex items-center justify-center rounded-md p-1",
                    isPrimary && "bg-primary/10",
                    isActive && !isPrimary && "bg-accent"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {typeof item.badge === "number" && item.badge > 0 && (
                    <span className="absolute -right-0.5 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  )}
                </div>
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
