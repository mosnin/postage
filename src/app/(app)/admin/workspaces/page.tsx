import { Building2 } from "lucide-react";
import { WorkspaceTable } from "@/components/admin/workspace-table";

export default function AdminWorkspacesPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/30">
          <Building2 className="h-5 w-5 text-violet-600 dark:text-violet-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Workspace Management</h1>
          <p className="text-muted-foreground text-sm">
            View, inspect, suspend, or delete workspaces across the platform.
          </p>
        </div>
      </div>

      <WorkspaceTable />
    </div>
  );
}
