"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  MoreHorizontal,
  ExternalLink,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Eye,
  PauseCircle,
} from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { WorkspaceDetailDrawer } from "@/components/admin/workspace-detail-drawer";

interface AdminWorkspace {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  createdAt: string;
  owner: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
  subscription: {
    plan: string;
    status: string;
    currentPeriodEnd: string | null;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
  } | null;
  _count: { members: number; posts: number; socialAccounts: number };
}

interface PaginationMeta {
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
}

async function fetchWorkspaces(params: {
  search: string;
  plan: string;
  status: string;
  page: number;
  pageSize: number;
}): Promise<{ data: AdminWorkspace[]; meta: PaginationMeta }> {
  const query = new URLSearchParams({
    search: params.search,
    plan: params.plan,
    status: params.status,
    page: String(params.page),
    pageSize: String(params.pageSize),
  });
  const res = await fetch(`/api/admin/workspaces?${query}`);
  if (!res.ok) throw new Error("Failed to fetch workspaces");
  return res.json();
}

async function deleteWorkspace(id: string) {
  const res = await fetch(`/api/admin/workspaces/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error ?? "Failed to delete workspace");
  }
  return res.json();
}

const PLAN_COLORS: Record<string, string> = {
  FREE: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  STARTER: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  PRO: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  PRO_PLUS: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  ACTIVE: "default",
  TRIALING: "secondary",
  PAST_DUE: "destructive",
  CANCELED: "outline",
  PAUSED: "outline",
  UNPAID: "destructive",
};

export function WorkspaceTable() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [planFilter, setPlanFilter] = React.useState("ALL");
  const [statusFilter, setStatusFilter] = React.useState("ALL");
  const [page, setPage] = React.useState(1);
  const pageSize = 20;

  const [deleteTarget, setDeleteTarget] = React.useState<AdminWorkspace | null>(null);
  const [detailWorkspace, setDetailWorkspace] = React.useState<AdminWorkspace | null>(null);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const queryKey = ["admin-workspaces", debouncedSearch, planFilter, statusFilter, page, pageSize];

  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: () =>
      fetchWorkspaces({
        search: debouncedSearch,
        plan: planFilter,
        status: statusFilter,
        page,
        pageSize,
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteWorkspace(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-workspaces"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      toast({ title: "Workspace deleted" });
      setDeleteTarget(null);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const workspaces = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, slug, owner…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <Select value={planFilter} onValueChange={(v) => { setPlanFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Plan" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Plans</SelectItem>
              <SelectItem value="FREE">Free</SelectItem>
              <SelectItem value="STARTER">Starter</SelectItem>
              <SelectItem value="PRO">Pro</SelectItem>
              <SelectItem value="PRO_PLUS">Pro+</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Status</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="TRIALING">Trialing</SelectItem>
              <SelectItem value="PAST_DUE">Past Due</SelectItem>
              <SelectItem value="CANCELED">Canceled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Name</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead className="text-right">Members</TableHead>
              <TableHead className="text-right">Posts</TableHead>
              <TableHead className="text-right">Accounts</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[48px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </TableCell>
              </TableRow>
            )}
            {isError && (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center text-destructive">
                  Failed to load workspaces.
                </TableCell>
              </TableRow>
            )}
            {!isLoading && !isError && workspaces.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                  No workspaces found.
                </TableCell>
              </TableRow>
            )}
            {workspaces.map((ws) => {
              const plan = ws.subscription?.plan ?? "FREE";
              const subStatus = ws.subscription?.status;

              return (
                <TableRow key={ws.id} className="group">
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">{ws.name}</span>
                      <span className="text-xs text-muted-foreground">{ws.slug}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm">{ws.owner.name ?? "—"}</span>
                      <span className="text-xs text-muted-foreground truncate max-w-[160px]">
                        {ws.owner.email}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium w-fit",
                          PLAN_COLORS[plan] ?? PLAN_COLORS.FREE
                        )}
                      >
                        {plan === "PRO_PLUS" ? "Pro+" : plan.charAt(0) + plan.slice(1).toLowerCase()}
                      </span>
                      {subStatus && (
                        <Badge
                          variant={STATUS_VARIANT[subStatus] ?? "secondary"}
                          className="text-[10px] px-1.5 py-0 w-fit"
                        >
                          {subStatus}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {ws._count.members}
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {ws._count.posts}
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {ws._count.socialAccounts}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {format(new Date(ws.createdAt), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem
                          className="gap-2"
                          onSelect={() => setDetailWorkspace(ws)}
                        >
                          <Eye className="h-4 w-4" />
                          View Details
                        </DropdownMenuItem>
                        {ws.subscription?.stripeCustomerId && (
                          <DropdownMenuItem
                            className="gap-2"
                            onSelect={() => {
                              window.open(
                                `https://dashboard.stripe.com/customers/${ws.subscription!.stripeCustomerId}`,
                                "_blank"
                              );
                            }}
                          >
                            <ExternalLink className="h-4 w-4" />
                            View in Stripe
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="gap-2"
                          onSelect={() => {
                            toast({
                              title: "Suspend workspace",
                              description: "Workspace suspension suspends all members.",
                            });
                          }}
                        >
                          <PauseCircle className="h-4 w-4" />
                          Suspend Workspace
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="gap-2 text-destructive focus:text-destructive"
                          onSelect={() => setDeleteTarget(ws)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete Workspace
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {meta && meta.total > pageSize && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Showing {(meta.page - 1) * meta.pageSize + 1}–
            {Math.min(meta.page * meta.pageSize, meta.total)} of {meta.total} workspaces
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Prev
            </Button>
            <span className="px-1">
              Page {meta.page} of {Math.ceil(meta.total / meta.pageSize)}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={!meta.hasNext}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete workspace?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{" "}
              <strong>{deleteTarget?.name}</strong> and all its posts, media, and
              connected accounts. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Workspace detail drawer */}
      <WorkspaceDetailDrawer
        workspace={detailWorkspace}
        onClose={() => setDetailWorkspace(null)}
      />
    </div>
  );
}
