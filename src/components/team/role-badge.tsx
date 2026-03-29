import { WorkspaceRole } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface RoleBadgeProps {
  role: WorkspaceRole;
  className?: string;
}

const roleConfig: Record<
  WorkspaceRole,
  { label: string; className: string }
> = {
  OWNER: {
    label: "Owner",
    className:
      "border-transparent bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  },
  ADMIN: {
    label: "Admin",
    className:
      "border-transparent bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  },
  MANAGER: {
    label: "Manager",
    className:
      "border-transparent bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400",
  },
  MEMBER: {
    label: "Member",
    className:
      "border-transparent bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  },
  VIEWER: {
    label: "Viewer",
    className:
      "border-transparent bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  },
};

export function RoleBadge({ role, className }: RoleBadgeProps) {
  const config = roleConfig[role];
  return (
    <Badge className={cn(config.className, className)}>{config.label}</Badge>
  );
}
