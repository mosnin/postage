"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ClipboardCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ApprovalQueue } from "@/components/posts/approval-queue";

type FilterValue = "ALL" | "PENDING" | "APPROVED" | "REJECTED" | "CHANGES_REQUESTED";

interface FilterOption {
  value: FilterValue;
  label: string;
}

const FILTERS: FilterOption[] = [
  { value: "ALL", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "CHANGES_REQUESTED", label: "Changes Requested" },
];

interface ApprovalsPageClientProps {
  workspaceId: string;
  workspaceName: string;
  viewerRole: string;
  viewerUserId: string;
}

export function ApprovalsPageClient({
  workspaceId,
  workspaceName: _workspaceName,
  viewerRole: _viewerRole,
  viewerUserId: _viewerUserId,
}: ApprovalsPageClientProps) {
  const [filter, setFilter] = useState<FilterValue>("PENDING");

  // Fetch pending count for the badge
  const { data: pendingData } = useQuery<{ meta: { total: number } }>({
    queryKey: ["pending-posts", workspaceId],
    queryFn: async () => {
      const res = await fetch(
        `/api/posts/pending?workspaceId=${workspaceId}&pageSize=1`
      );
      if (!res.ok) return { data: [], meta: { total: 0 } };
      return res.json();
    },
    staleTime: 30_000,
  });

  const pendingCount = pendingData?.meta?.total ?? 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 mt-0.5">
            <ClipboardCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Approval Queue</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {pendingCount > 0 ? (
                <span>
                  <span className="font-medium text-foreground">{pendingCount}</span>{" "}
                  {pendingCount === 1 ? "post" : "posts"} awaiting review
                </span>
              ) : (
                "Review and approve posts before they publish"
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 border-b overflow-x-auto">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap shrink-0",
              filter === f.value
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/40"
            )}
          >
            {f.label}
            {f.value === "PENDING" && pendingCount > 0 && (
              <Badge
                variant="secondary"
                className="h-4 min-w-4 rounded-full px-1 text-[10px] font-semibold bg-primary/10 text-primary border-0"
              >
                {pendingCount}
              </Badge>
            )}
          </button>
        ))}
      </div>

      {/* Queue list */}
      <ApprovalQueue workspaceId={workspaceId} filter={filter} />
    </div>
  );
}
