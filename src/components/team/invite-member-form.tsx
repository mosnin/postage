"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle, Loader2 } from "lucide-react";

const INVITABLE_ROLES = ["ADMIN", "MANAGER", "MEMBER", "VIEWER"] as const;
type InvitableRole = (typeof INVITABLE_ROLES)[number];

const inviteSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  role: z.enum(INVITABLE_ROLES),
  message: z.string().max(500, "Message must be 500 characters or less").optional(),
});

type InviteFormValues = z.infer<typeof inviteSchema>;

interface InviteMemberFormProps {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const roleOptions: { value: InvitableRole; label: string }[] = [
  { value: "ADMIN", label: "Admin" },
  { value: "MANAGER", label: "Manager" },
  { value: "MEMBER", label: "Member" },
  { value: "VIEWER", label: "Viewer" },
];

export function InviteMemberForm({
  workspaceId,
  open,
  onOpenChange,
}: InviteMemberFormProps) {
  const queryClient = useQueryClient();
  const [successEmail, setSuccessEmail] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { role: "MEMBER" },
  });

  const selectedRole = watch("role");

  const { mutate: sendInvite, isPending } = useMutation({
    mutationFn: async (values: InviteFormValues) => {
      const res = await fetch(`/api/workspace/members?workspaceId=${workspaceId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to send invite");
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      setSuccessEmail(variables.email);
      queryClient.invalidateQueries({ queryKey: ["workspace-members", workspaceId] });
    },
  });

  function handleClose() {
    reset();
    setSuccessEmail(null);
    onOpenChange(false);
  }

  function handleInviteAnother() {
    reset();
    setSuccessEmail(null);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[480px]">
        {successEmail ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <CheckCircle className="h-12 w-12 text-green-500" />
            <DialogTitle>Invite Sent!</DialogTitle>
            <p className="text-sm text-muted-foreground">
              An invitation has been sent to{" "}
              <span className="font-medium text-foreground">{successEmail}</span>
              . They will receive an email with a link to join your workspace.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleClose}>
                Done
              </Button>
              <Button onClick={handleInviteAnother}>Invite Another</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit((v) => sendInvite(v))}>
            <DialogHeader>
              <DialogTitle>Invite Team Member</DialogTitle>
              <DialogDescription>
                Send an invitation to add someone to your workspace.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="invite-email">
                  Email address <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="colleague@example.com"
                  {...register("email")}
                />
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email.message}</p>
                )}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="invite-role">Role</Label>
                <Select
                  value={selectedRole}
                  onValueChange={(v) => setValue("role", v as InvitableRole)}
                >
                  <SelectTrigger id="invite-role">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roleOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.role && (
                  <p className="text-xs text-destructive">{errors.role.message}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {selectedRole === "ADMIN" &&
                    "Can manage all workspace settings, members, and content."}
                  {selectedRole === "MANAGER" &&
                    "Can manage content and view workspace analytics."}
                  {selectedRole === "MEMBER" &&
                    "Can create and schedule posts."}
                  {selectedRole === "VIEWER" &&
                    "Can view posts and analytics but cannot create content."}
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="invite-message">
                  Personal message{" "}
                  <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Textarea
                  id="invite-message"
                  placeholder="Add a personal note to your invitation..."
                  rows={3}
                  {...register("message")}
                />
                {errors.message && (
                  <p className="text-xs text-destructive">
                    {errors.message.message}
                  </p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send Invite
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
