"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";

const profileSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  image: z.string().url("Must be a valid URL").or(z.literal("")).optional(),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type ProfileFormValues = z.infer<typeof profileSchema>;
type PasswordFormValues = z.infer<typeof passwordSchema>;

export default function ProfilePage() {
  const { data: session, update: updateSession } = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: userData } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const res = await fetch("/api/settings/profile");
      if (!res.ok) throw new Error("Failed to load profile");
      return res.json();
    },
  });

  const isOAuthUser = !userData?.user?.hasPassword;

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: session?.user?.name ?? "",
      image: session?.user?.image ?? "",
    },
  });

  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const profileMutation = useMutation({
    mutationFn: async (data: ProfileFormValues) => {
      const res = await fetch("/api/settings/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          image: data.image || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to update profile");
      }
      return res.json();
    },
    onSuccess: async (data) => {
      await updateSession({ name: data.user.name, image: data.user.image });
      toast({ title: "Profile updated", description: "Your changes have been saved." });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const passwordMutation = useMutation({
    mutationFn: async (data: PasswordFormValues) => {
      const res = await fetch("/api/settings/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to update password");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Password updated", description: "Your password has been changed successfully." });
      passwordForm.reset();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const avatarName = profileForm.watch("name") || session?.user?.name || "U";
  const avatarImage = profileForm.watch("image") || session?.user?.image;
  const initials = avatarName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage your personal information and account settings.
        </p>
      </div>

      <Separator />

      {/* Profile Info */}
      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
          <CardDescription>Update your display name and avatar.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={profileForm.handleSubmit((data) => profileMutation.mutate(data))}
            className="space-y-5"
          >
            {/* Avatar preview */}
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={avatarImage ?? undefined} alt={avatarName} />
                <AvatarFallback className="text-lg">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <Label htmlFor="image" className="text-sm font-medium">
                  Avatar URL
                </Label>
                <Input
                  id="image"
                  placeholder="https://example.com/avatar.png"
                  className="mt-1"
                  {...profileForm.register("image")}
                />
                {profileForm.formState.errors.image && (
                  <p className="text-xs text-destructive mt-1">
                    {profileForm.formState.errors.image.message}
                  </p>
                )}
              </div>
            </div>

            {/* Name */}
            <div>
              <Label htmlFor="name">Display Name</Label>
              <Input
                id="name"
                className="mt-1"
                {...profileForm.register("name")}
              />
              {profileForm.formState.errors.name && (
                <p className="text-xs text-destructive mt-1">
                  {profileForm.formState.errors.name.message}
                </p>
              )}
            </div>

            {/* Email (read-only) */}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={session?.user?.email ?? ""}
                className="mt-1 bg-muted"
                readOnly
                disabled
              />
              <p className="text-xs text-muted-foreground mt-1">
                {isOAuthUser
                  ? "Email cannot be changed for OAuth accounts."
                  : "Contact support to change your email address."}
              </p>
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={profileMutation.isPending || !profileForm.formState.isDirty}
              >
                {profileMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save Changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Change Password — only for credentials users */}
      {!isOAuthUser && (
        <Card>
          <CardHeader>
            <CardTitle>Change Password</CardTitle>
            <CardDescription>
              Update your password to keep your account secure.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={passwordForm.handleSubmit((data) => passwordMutation.mutate(data))}
              className="space-y-4"
            >
              <div>
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  className="mt-1"
                  autoComplete="current-password"
                  {...passwordForm.register("currentPassword")}
                />
                {passwordForm.formState.errors.currentPassword && (
                  <p className="text-xs text-destructive mt-1">
                    {passwordForm.formState.errors.currentPassword.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  className="mt-1"
                  autoComplete="new-password"
                  {...passwordForm.register("newPassword")}
                />
                {passwordForm.formState.errors.newPassword && (
                  <p className="text-xs text-destructive mt-1">
                    {passwordForm.formState.errors.newPassword.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  className="mt-1"
                  autoComplete="new-password"
                  {...passwordForm.register("confirmPassword")}
                />
                {passwordForm.formState.errors.confirmPassword && (
                  <p className="text-xs text-destructive mt-1">
                    {passwordForm.formState.errors.confirmPassword.message}
                  </p>
                )}
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={passwordMutation.isPending}>
                  {passwordMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Update Password
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
