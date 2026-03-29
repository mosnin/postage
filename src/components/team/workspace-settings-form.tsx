"use client";

import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { WorkspaceRole } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, Upload, Trash2, AlertTriangle } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";

// IANA timezone list (representative subset)
const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "America/Honolulu",
  "America/Toronto",
  "America/Vancouver",
  "America/Sao_Paulo",
  "America/Argentina/Buenos_Aires",
  "America/Bogota",
  "America/Lima",
  "America/Mexico_City",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Rome",
  "Europe/Amsterdam",
  "Europe/Stockholm",
  "Europe/Warsaw",
  "Europe/Athens",
  "Europe/Istanbul",
  "Europe/Moscow",
  "Africa/Cairo",
  "Africa/Johannesburg",
  "Africa/Lagos",
  "Africa/Nairobi",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Dhaka",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Australia/Brisbane",
  "Australia/Perth",
  "Pacific/Auckland",
  "Pacific/Honolulu",
];

const settingsSchema = z.object({
  name: z.string().min(1, "Workspace name is required").max(64, "Name must be 64 characters or less"),
  slug: z
    .string()
    .min(2, "Slug must be at least 2 characters")
    .max(48, "Slug must be 48 characters or less")
    .regex(
      /^[a-z0-9-]+$/,
      "Slug can only contain lowercase letters, numbers, and hyphens"
    ),
  timezone: z.string().min(1, "Timezone is required"),
  approvalRequired: z.boolean(),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

interface WorkspaceSettingsFormProps {
  workspace: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    timezone: string;
    settings: {
      approvalRequired: boolean;
    } | null;
  };
  currentUserRole: WorkspaceRole;
}

export function WorkspaceSettingsForm({
  workspace,
  currentUserRole,
}: WorkspaceSettingsFormProps) {
  const [logoPreview, setLogoPreview] = useState<string | null>(
    workspace.logoUrl
  );
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdminPlus =
    currentUserRole === "OWNER" || currentUserRole === "ADMIN";
  const isOwner = currentUserRole === "OWNER";

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      name: workspace.name,
      slug: workspace.slug,
      timezone: workspace.timezone,
      approvalRequired: workspace.settings?.approvalRequired ?? false,
    },
  });

  const currentSlug = watch("slug");
  const approvalRequired = watch("approvalRequired");

  const { mutate: saveSettings, isPending: isSaving } = useMutation({
    mutationFn: async (values: SettingsFormValues) => {
      // If there's a logo file, we'd upload it first (simplified here to URL)
      const body: Record<string, unknown> = { ...values, workspaceId: workspace.id };
      if (logoFile) {
        // In a full implementation, upload to storage and get URL
        // For now, we pass the file name as a placeholder
        body.logoUrl = logoPreview;
      }

      const res = await fetch("/api/workspace/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to save settings");
      }
      return res.json();
    },
    onSuccess: () => {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    },
  });

  const { mutate: deleteWorkspace, isPending: isDeleting } = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/workspace/settings?workspaceId=${workspace.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to delete workspace");
      }
      return res.json();
    },
    onSuccess: () => {
      window.location.href = "/onboarding";
    },
  });

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  return (
    <div className="max-w-2xl space-y-8">
      {/* General section */}
      <section>
        <h2 className="text-base font-semibold mb-1">General</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Basic information about your workspace.
        </p>

        <form
          onSubmit={handleSubmit((v) => saveSettings(v))}
          className="space-y-6"
        >
          {/* Logo */}
          <div className="grid gap-2">
            <Label>Workspace logo</Label>
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-lg border bg-muted flex items-center justify-center overflow-hidden">
                {logoPreview ? (
                  <Image
                    src={logoPreview}
                    alt="Workspace logo"
                    width={64}
                    height={64}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-xl font-bold text-muted-foreground">
                    {workspace.name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!isAdminPlus}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Upload
                </Button>
                {logoPreview && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setLogoPreview(null);
                      setLogoFile(null);
                    }}
                    disabled={!isAdminPlus}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove
                  </Button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoChange}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              PNG, JPG, or SVG. Recommended size: 256x256px.
            </p>
          </div>

          {/* Workspace name */}
          <div className="grid gap-2">
            <Label htmlFor="ws-name">
              Workspace name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="ws-name"
              placeholder="Acme Corp"
              disabled={!isAdminPlus}
              {...register("name")}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          {/* Workspace slug */}
          <div className="grid gap-2">
            <Label htmlFor="ws-slug">
              Workspace slug <span className="text-destructive">*</span>
            </Label>
            <Input
              id="ws-slug"
              placeholder="acme-corp"
              disabled={!isAdminPlus}
              {...register("slug")}
            />
            {errors.slug && (
              <p className="text-xs text-destructive">{errors.slug.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Your workspace URL:{" "}
              <span className="font-mono text-foreground">
                postsyncer.com/w/{currentSlug || workspace.slug}
              </span>
            </p>
          </div>

          {/* Timezone */}
          <div className="grid gap-2">
            <Label htmlFor="ws-timezone">Timezone</Label>
            <Select
              defaultValue={workspace.timezone}
              onValueChange={(v) => setValue("timezone", v, { shouldDirty: true })}
              disabled={!isAdminPlus}
            >
              <SelectTrigger id="ws-timezone">
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.timezone && (
              <p className="text-xs text-destructive">
                {errors.timezone.message}
              </p>
            )}
          </div>

          {/* Approval workflow */}
          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor="approval-switch"
                    className="text-sm font-medium cursor-pointer"
                  >
                    Require approval before publishing
                  </Label>
                  {!isAdminPlus && (
                    <Badge variant="secondary" className="text-xs">
                      Admin only
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Members must submit posts for review before publishing
                </p>
              </div>
              <Switch
                id="approval-switch"
                checked={approvalRequired}
                onCheckedChange={(checked) =>
                  setValue("approvalRequired", checked, { shouldDirty: true })
                }
                disabled={!isAdminPlus}
              />
            </div>
          </div>

          {/* Save button */}
          <div className="flex items-center gap-3">
            <Button
              type="submit"
              disabled={isSaving || !isDirty || !isAdminPlus}
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
            {saveSuccess && (
              <p className="text-sm text-green-600 dark:text-green-400">
                Settings saved successfully.
              </p>
            )}
            {!isAdminPlus && (
              <p className="text-sm text-muted-foreground">
                You need Admin or higher permissions to edit workspace settings.
              </p>
            )}
          </div>
        </form>
      </section>

      <Separator />

      {/* Danger zone */}
      <section>
        <h2 className="text-base font-semibold text-destructive mb-1 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          Danger Zone
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          Irreversible and destructive actions.
        </p>

        <div className="rounded-lg border border-destructive/30 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium text-sm">Delete this workspace</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                All posts, accounts, and data will be permanently deleted. This
                cannot be undone.
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={!isOwner}
                >
                  Delete Workspace
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete workspace?</AlertDialogTitle>
                  <AlertDialogDescription className="space-y-3">
                    <span className="block">
                      This will permanently delete the{" "}
                      <span className="font-semibold text-foreground">
                        {workspace.name}
                      </span>{" "}
                      workspace, including:
                    </span>
                    <ul className="list-disc list-inside space-y-1 text-xs">
                      <li>All scheduled and published posts</li>
                      <li>All connected social accounts</li>
                      <li>All media files and analytics data</li>
                      <li>All team members and their access</li>
                    </ul>
                    <span className="block font-medium text-destructive">
                      This action is irreversible.
                    </span>
                    <span className="block mt-3">
                      Type{" "}
                      <span className="font-mono font-semibold text-foreground">
                        {workspace.name}
                      </span>{" "}
                      to confirm:
                    </span>
                    <Input
                      value={deleteConfirmName}
                      onChange={(e) => setDeleteConfirmName(e.target.value)}
                      placeholder={workspace.name}
                      className={cn(
                        "mt-2",
                        deleteConfirmName === workspace.name &&
                          "border-destructive"
                      )}
                    />
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel
                    onClick={() => setDeleteConfirmName("")}
                  >
                    Cancel
                  </AlertDialogCancel>
                  <Button
                    variant="destructive"
                    disabled={
                      deleteConfirmName !== workspace.name || isDeleting
                    }
                    onClick={() => deleteWorkspace()}
                  >
                    {isDeleting && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Delete Workspace
                  </Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
          {!isOwner && (
            <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Only the workspace owner can delete this workspace.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
