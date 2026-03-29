"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  MoreHorizontal,
  UserX,
  UserCheck,
  Shield,
  User as UserIcon,
  Trash2,
  ChevronLeft,
  ChevronRight,
  LogIn,
  Eye,
  Loader2,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { UserDetailDrawer } from "@/components/admin/user-detail-drawer";

interface AdminUser {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: "USER" | "SUPER_ADMIN";
  createdAt: string;
  lastLoginAt: string | null;
  _count: { memberships: number };
  memberships: Array<{
    workspace: {
      subscription: { plan: string; status: string } | null;
    };
  }>;
  accounts: Array<{ provider: string }>;
}

interface PaginationMeta {
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
}

async function fetchUsers(params: {
  search: string;
  role: string;
  status: string;
  sortBy: string;
  page: number;
  pageSize: number;
}): Promise<{ data: AdminUser[]; meta: PaginationMeta }> {
  const query = new URLSearchParams({
    search: params.search,
    role: params.role,
    status: params.status,
    sortBy: params.sortBy,
    page: String(params.page),
    pageSize: String(params.pageSize),
  });
  const res = await fetch(`/api/admin/users?${query}`);
  if (!res.ok) throw new Error("Failed to fetch users");
  return res.json();
}

async function patchUser(id: string, data: { role?: string; suspended?: boolean }) {
  const res = await fetch(`/api/admin/users/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error ?? "Failed to update user");
  }
  return res.json();
}

async function deleteUser(id: string) {
  const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error ?? "Failed to delete user");
  }
  return res.json();
}

function getPlanFromUser(user: AdminUser): string {
  const plan = user.memberships[0]?.workspace?.subscription?.plan;
  return plan ?? "FREE";
}

function isSuspended(user: AdminUser): boolean {
  // A user is considered suspended if ALL their memberships are suspended
  // We check via the status filter — here we use a heuristic
  return user.memberships.length > 0 &&
    user.memberships.every((m: { workspace: { subscription: { plan: string; status: string } | null } }) => {
      // We don't have member status in the list response; use accounts presence or a flag
      // In actual usage, this is shown via the status filter on the API side
      return false;
    });
}

const PLAN_COLORS: Record<string, string> = {
  FREE: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  STARTER: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  PRO: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  PRO_PLUS: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
};

export function UsersTable() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState("ALL");
  const [statusFilter, setStatusFilter] = React.useState("ALL");
  const [sortBy, setSortBy] = React.useState("createdAt");
  const [page, setPage] = React.useState(1);
  const pageSize = 20;

  const [deleteTarget, setDeleteTarget] = React.useState<AdminUser | null>(null);
  const [detailUser, setDetailUser] = React.useState<AdminUser | null>(null);

  // Debounce search
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const queryKey = ["admin-users", debouncedSearch, roleFilter, statusFilter, sortBy, page, pageSize];

  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: () =>
      fetchUsers({
        search: debouncedSearch,
        role: roleFilter,
        status: statusFilter,
        sortBy,
        page,
        pageSize,
      }),
  });

  const patchMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { role?: string; suspended?: boolean } }) =>
      patchUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: "User updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      toast({ title: "User deleted" });
      setDeleteTarget(null);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const users = data?.data ?? [];
  const meta = data?.meta;

  function getUserInitials(user: AdminUser): string {
    if (user.name) {
      return user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
    }
    return (user.email?.[0] ?? "U").toUpperCase();
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or email…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Roles</SelectItem>
              <SelectItem value="USER">User</SelectItem>
              <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Status</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="SUSPENDED">Suspended</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={(v) => { setSortBy(v); setPage(1); }}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="createdAt">Created Date</SelectItem>
              <SelectItem value="lastLoginAt">Last Login</SelectItem>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="email">Email</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>User</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead className="text-right">Workspaces</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead>Last Login</TableHead>
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
                  Failed to load users.
                </TableCell>
              </TableRow>
            )}
            {!isLoading && !isError && users.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                  No users found.
                </TableCell>
              </TableRow>
            )}
            {users.map((user) => {
              const plan = getPlanFromUser(user);
              const initials = getUserInitials(user);

              return (
                <TableRow key={user.id} className="group">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.image ?? undefined} alt={user.name ?? ""} />
                        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-sm truncate max-w-[140px]">
                        {user.name ?? "—"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {user.email}
                  </TableCell>
                  <TableCell>
                    {user.role === "SUPER_ADMIN" ? (
                      <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0 gap-1">
                        <Shield className="h-3 w-3" />
                        Admin
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1">
                        <UserIcon className="h-3 w-3" />
                        User
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                        PLAN_COLORS[plan] ?? PLAN_COLORS.FREE
                      )}
                    >
                      {plan === "PRO_PLUS" ? "Pro+" : plan.charAt(0) + plan.slice(1).toLowerCase()}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {user._count.memberships}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {format(new Date(user.createdAt), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {user.lastLoginAt
                      ? formatDistanceToNow(new Date(user.lastLoginAt), { addSuffix: true })
                      : "Never"}
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
                          onSelect={() => setDetailUser(user)}
                        >
                          <Eye className="h-4 w-4" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="gap-2"
                          onSelect={() =>
                            patchMutation.mutate({
                              id: user.id,
                              data: { suspended: true },
                            })
                          }
                        >
                          <UserX className="h-4 w-4" />
                          Suspend User
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="gap-2"
                          onSelect={() =>
                            patchMutation.mutate({
                              id: user.id,
                              data: { suspended: false },
                            })
                          }
                        >
                          <UserCheck className="h-4 w-4" />
                          Unsuspend User
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {user.role === "USER" ? (
                          <DropdownMenuItem
                            className="gap-2"
                            onSelect={() =>
                              patchMutation.mutate({
                                id: user.id,
                                data: { role: "SUPER_ADMIN" },
                              })
                            }
                          >
                            <Shield className="h-4 w-4" />
                            Make Super Admin
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            className="gap-2"
                            onSelect={() =>
                              patchMutation.mutate({
                                id: user.id,
                                data: { role: "USER" },
                              })
                            }
                          >
                            <UserIcon className="h-4 w-4" />
                            Remove Admin Role
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="gap-2"
                          onSelect={() => {
                            // Impersonate: generate a session token and redirect
                            // This is a placeholder — full implementation requires a custom sign-in flow
                            toast({
                              title: "Impersonation",
                              description: "Impersonation flow requires server-side session override.",
                            });
                          }}
                        >
                          <LogIn className="h-4 w-4" />
                          Impersonate
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="gap-2 text-destructive focus:text-destructive"
                          onSelect={() => setDeleteTarget(user)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete User
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
            {Math.min(meta.page * meta.pageSize, meta.total)} of {meta.total} users
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

      {/* Delete confirm dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{" "}
              <strong>{deleteTarget?.name ?? deleteTarget?.email}</strong> and all their
              data. This action cannot be undone.
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

      {/* User detail drawer */}
      <UserDetailDrawer
        userId={detailUser?.id ?? null}
        onClose={() => setDetailUser(null)}
      />
    </div>
  );
}
