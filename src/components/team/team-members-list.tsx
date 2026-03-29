"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { WorkspaceRole, MemberStatus } from "@prisma/client";
import { formatDistanceToNow } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { RoleBadge } from "@/components/team/role-badge";
import { MoreHorizontal, RefreshCw, X, Shield } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface MemberUser {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

interface TeamMember {
  id: string;
  workspaceId: string;
  userId: string | null;
  role: WorkspaceRole;
  status: MemberStatus;
  invitedEmail: string | null;
  inviteToken: string | null;
  invitedAt: string | null;
  joinedAt: string | null;
  createdAt: string;
  user: MemberUser | null;
}

interface TeamMembersListProps {
  workspaceId: string;
  currentUserId: string;
  currentUserRole: WorkspaceRole;
}

const roleOrder: WorkspaceRole[] = ["OWNER", "ADMIN", "MANAGER", "MEMBER", "VIEWER"];

function roleRank(role: WorkspaceRole): number {
  return roleOrder.indexOf(role);
}

function canManage(actorRole: WorkspaceRole, targetRole: WorkspaceRole): boolean {
  if (actorRole === "OWNER") return targetRole !== "OWNER";
  if (actorRole === "ADMIN") return targetRole !== "OWNER" && targetRole !== "ADMIN";
  return false;
}

function getInitials(name: string | null, email: string | null): string {
  if (name) {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  return (email?.[0] ?? "?").toUpperCase();
}

const roleOptions: { value: WorkspaceRole; label: string }[] = [
  { value: "ADMIN", label: "Admin" },
  { value: "MANAGER", label: "Manager" },
  { value: "MEMBER", label: "Member" },
  { value: "VIEWER", label: "Viewer" },
];

export function TeamMembersList({
  workspaceId,
  currentUserId,
  currentUserRole,
}: TeamMembersListProps) {
  const queryClient = useQueryClient();
  const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null);

  const { data, isLoading } = useQuery<{ members: TeamMember[]; total: number }>({
    queryKey: ["workspace-members", workspaceId],
    queryFn: async () => {
      const res = await fetch(`/api/workspace/members?workspaceId=${workspaceId}`);
      if (!res.ok) throw new Error("Failed to fetch members");
      return res.json();
    },
  });

  const { mutate: updateRole, isPending: isUpdatingRole } = useMutation({
    mutationFn: async ({
      memberId,
      role,
    }: {
      memberId: string;
      role: WorkspaceRole;
    }) => {
      const res = await fetch(`/api/workspace/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to update role");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace-members", workspaceId] });
    },
  });

  const { mutate: updateStatus } = useMutation({
    mutationFn: async ({
      memberId,
      status,
    }: {
      memberId: string;
      status: "ACTIVE" | "SUSPENDED";
    }) => {
      const res = await fetch(`/api/workspace/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to update status");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace-members", workspaceId] });
    },
  });

  const { mutate: removeMember, isPending: isRemoving } = useMutation({
    mutationFn: async (memberId: string) => {
      const res = await fetch(`/api/workspace/members/${memberId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to remove member");
      }
      return res.json();
    },
    onSuccess: () => {
      setMemberToRemove(null);
      queryClient.invalidateQueries({ queryKey: ["workspace-members", workspaceId] });
    },
  });

  const { mutate: resendInvite } = useMutation({
    mutationFn: async (memberId: string) => {
      const res = await fetch(`/api/workspace/members/${memberId}/resend`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to resend invite");
      }
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-6 w-20" />
          </div>
        ))}
      </div>
    );
  }

  const members = data?.members ?? [];

  if (members.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        No members found.
      </div>
    );
  }

  const isAdminPlus =
    currentUserRole === "OWNER" || currentUserRole === "ADMIN";

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead className="w-[60px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((member) => {
            const displayName =
              member.user?.name ?? member.invitedEmail ?? "Unknown";
            const displayEmail =
              member.user?.email ?? member.invitedEmail ?? "";
            const isCurrentUser = member.userId === currentUserId;
            const isOwnerRow = member.role === "OWNER";
            const canEditThisMember = isAdminPlus && canManage(currentUserRole, member.role);

            return (
              <TableRow key={member.id}>
                {/* User cell */}
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarImage
                        src={member.user?.image ?? undefined}
                        alt={displayName}
                      />
                      <AvatarFallback>
                        {getInitials(member.user?.name ?? null, displayEmail)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-1.5 font-medium text-sm">
                        {displayName}
                        {isCurrentUser && (
                          <span className="text-xs text-muted-foreground">
                            (you)
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {displayEmail}
                      </div>
                    </div>
                  </div>
                </TableCell>

                {/* Role cell */}
                <TableCell>
                  {canEditThisMember && !isOwnerRow ? (
                    <Select
                      value={member.role}
                      onValueChange={(v) =>
                        updateRole({
                          memberId: member.id,
                          role: v as WorkspaceRole,
                        })
                      }
                      disabled={isUpdatingRole}
                    >
                      <SelectTrigger className="h-8 w-[120px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {roleOptions.map((opt) => (
                          <SelectItem
                            key={opt.value}
                            value={opt.value}
                            className="text-xs"
                          >
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <RoleBadge role={member.role} />
                  )}
                </TableCell>

                {/* Status cell */}
                <TableCell>
                  {member.status === "ACTIVE" && (
                    <Badge variant="success">Active</Badge>
                  )}
                  {member.status === "INVITED" && (
                    <Badge variant="warning">Pending</Badge>
                  )}
                  {member.status === "SUSPENDED" && (
                    <Badge variant="destructive">Suspended</Badge>
                  )}
                </TableCell>

                {/* Joined cell */}
                <TableCell className="text-sm text-muted-foreground">
                  {member.joinedAt
                    ? formatDistanceToNow(new Date(member.joinedAt), {
                        addSuffix: true,
                      })
                    : member.invitedAt
                    ? `Invited ${formatDistanceToNow(new Date(member.invitedAt), { addSuffix: true })}`
                    : "—"}
                </TableCell>

                {/* Actions cell */}
                <TableCell>
                  {(canEditThisMember || member.status === "INVITED") && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          aria-label="Member actions"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {member.status === "INVITED" && (
                          <>
                            <DropdownMenuItem
                              onClick={() => resendInvite(member.id)}
                            >
                              <RefreshCw className="mr-2 h-4 w-4" />
                              Resend Invite
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </>
                        )}

                        {canEditThisMember && member.status === "ACTIVE" && (
                          <DropdownMenuItem
                            onClick={() =>
                              updateStatus({
                                memberId: member.id,
                                status: "SUSPENDED",
                              })
                            }
                          >
                            <X className="mr-2 h-4 w-4" />
                            Suspend Member
                          </DropdownMenuItem>
                        )}

                        {canEditThisMember && member.status === "SUSPENDED" && (
                          <DropdownMenuItem
                            onClick={() =>
                              updateStatus({
                                memberId: member.id,
                                status: "ACTIVE",
                              })
                            }
                          >
                            <Shield className="mr-2 h-4 w-4" />
                            Restore Access
                          </DropdownMenuItem>
                        )}

                        {isOwnerRow && currentUserRole === "OWNER" && isCurrentUser && (
                          <DropdownMenuItem
                            className="text-warning"
                            onClick={() => {
                              // Transfer ownership is handled by role change to another Admin
                            }}
                          >
                            <Shield className="mr-2 h-4 w-4" />
                            Transfer Ownership
                          </DropdownMenuItem>
                        )}

                        {canEditThisMember && !isCurrentUser && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setMemberToRemove(member)}
                            >
                              <X className="mr-2 h-4 w-4" />
                              {member.status === "INVITED"
                                ? "Cancel Invite"
                                : "Remove Member"}
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* Remove confirmation dialog */}
      <AlertDialog
        open={!!memberToRemove}
        onOpenChange={(open) => !open && setMemberToRemove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {memberToRemove?.status === "INVITED"
                ? "Cancel invitation?"
                : "Remove team member?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {memberToRemove?.status === "INVITED" ? (
                <>
                  The invitation sent to{" "}
                  <span className="font-medium text-foreground">
                    {memberToRemove?.invitedEmail}
                  </span>{" "}
                  will be cancelled. They will no longer be able to join this
                  workspace with that invite link.
                </>
              ) : (
                <>
                  <span className="font-medium text-foreground">
                    {memberToRemove?.user?.name ??
                      memberToRemove?.user?.email ??
                      "This person"}
                  </span>{" "}
                  will lose access to this workspace immediately. This action
                  cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                memberToRemove && removeMember(memberToRemove.id)
              }
              disabled={isRemoving}
            >
              {memberToRemove?.status === "INVITED"
                ? "Cancel Invite"
                : "Remove Member"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
