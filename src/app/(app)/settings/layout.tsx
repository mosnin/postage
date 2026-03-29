import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { CreditCard, Key, Bell, User, Users, Settings2, Bot } from "lucide-react";
import { SettingsNavLink } from "@/components/settings/settings-nav-link";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  ownerOnly?: boolean;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/settings/profile", label: "Profile", icon: User },
  { href: "/settings/notifications", label: "Notifications", icon: Bell },
  { href: "/settings/billing", label: "Billing", icon: CreditCard, ownerOnly: true },
  { href: "/settings/api", label: "API Keys", icon: Key, adminOnly: true },
  { href: "/settings/mcp", label: "MCP / AI Agents", icon: Bot, adminOnly: true },
  { href: "/settings/team", label: "Team", icon: Users },
  { href: "/settings/workspace", label: "Workspace", icon: Settings2 },
];

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const membership = await db.workspaceMember.findFirst({
    where: {
      userId: session.user.id,
      status: "ACTIVE",
    },
    orderBy: { joinedAt: "asc" },
  });

  const role = membership?.role ?? "MEMBER";
  const isOwner = role === "OWNER";
  const isAdminPlus = role === "OWNER" || role === "ADMIN";

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.ownerOnly && !isOwner) return false;
    if (item.adminOnly && !isAdminPlus) return false;
    return true;
  });

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 border-r bg-muted/20">
        <div className="px-4 py-6">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4 px-2">
            Settings
          </h2>
          <nav className="space-y-1">
            {visibleItems.map((item) => {
              const Icon = item.icon;
              return (
                <SettingsNavLink key={item.href} href={item.href} icon={Icon}>
                  {item.label}
                </SettingsNavLink>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
