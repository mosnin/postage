"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus,
  Pencil,
  Trash2,
  Tag,
  Check,
  X,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Label as FormLabel } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { Label } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type LabelWithCount = Label & { _count: { posts: number } };

interface LabelsManagerProps {
  workspaceId: string;
}

// ─── Preset colors ────────────────────────────────────────────────────────────

const PRESET_COLORS = [
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#10b981", // emerald
  "#14b8a6", // teal
  "#3b82f6", // blue
  "#06b6d4", // cyan
  "#64748b", // slate
];

// ─── Zod schema ───────────────────────────────────────────────────────────────

const labelFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(50, "Max 50 characters"),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Enter a valid hex color (e.g. #6366f1)"),
});

type LabelFormValues = z.infer<typeof labelFormSchema>;

// ─── Color picker ─────────────────────────────────────────────────────────────

function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  const isCustom = !PRESET_COLORS.includes(value);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {PRESET_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            className={cn(
              "h-7 w-7 rounded-full border-2 transition-all hover:scale-110",
              value === color ? "border-foreground scale-110" : "border-transparent"
            )}
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <div
          className="h-7 w-7 rounded-full border flex-shrink-0"
          style={{ backgroundColor: isCustom ? value : "#ffffff" }}
        />
        <Input
          placeholder="#6366f1"
          value={isCustom ? value : ""}
          onChange={(e) => {
            const v = e.target.value.trim();
            if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) onChange(v);
          }}
          className="h-8 text-sm font-mono w-32"
          maxLength={7}
        />
        <span className="text-xs text-muted-foreground">Custom hex</span>
      </div>
    </div>
  );
}

// ─── Label chip preview ───────────────────────────────────────────────────────

function LabelChip({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium text-white"
      style={{ backgroundColor: color }}
    >
      <Tag className="h-3 w-3" />
      {name || "Label preview"}
    </span>
  );
}

// ─── Create / Edit Modal ──────────────────────────────────────────────────────

interface LabelModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: LabelFormValues) => void;
  isPending: boolean;
  initialValues?: LabelFormValues;
  title: string;
}

function LabelModal({
  open,
  onClose,
  onSave,
  isPending,
  initialValues,
  title,
}: LabelModalProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<LabelFormValues>({
    resolver: zodResolver(labelFormSchema),
    defaultValues: initialValues ?? { name: "", color: "#6366f1" },
  });

  const name = watch("name");
  const color = watch("color");

  function handleClose() {
    reset();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSave)} className="space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <FormLabel htmlFor="label-name">Name</FormLabel>
            <Input
              id="label-name"
              placeholder="e.g. Product Launch"
              {...register("name")}
              autoFocus
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          {/* Color picker */}
          <div className="space-y-1.5">
            <FormLabel>Color</FormLabel>
            <ColorPicker
              value={color}
              onChange={(c) => setValue("color", c, { shouldValidate: true })}
            />
            {errors.color && (
              <p className="text-xs text-destructive">{errors.color.message}</p>
            )}
          </div>

          {/* Preview */}
          <div className="space-y-1.5">
            <FormLabel>Preview</FormLabel>
            <div className="flex items-center gap-2">
              <LabelChip name={name} color={color} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save label
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function LabelsManager({ workspaceId }: LabelsManagerProps) {
  const queryClient = useQueryClient();
  const router = useRouter();

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<LabelWithCount | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LabelWithCount | null>(null);

  // ─── Query ──────────────────────────────────────────────────────────────────

  const { data: labels = [], isLoading } = useQuery<LabelWithCount[]>({
    queryKey: ["labels", workspaceId],
    queryFn: async () => {
      const res = await fetch(`/api/labels?workspaceId=${workspaceId}`);
      if (!res.ok) throw new Error("Failed to fetch labels");
      return res.json();
    },
    staleTime: 30_000,
  });

  // ─── Mutations ──────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: async (data: LabelFormValues) => {
      const res = await fetch("/api/labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, ...data }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to create label");
      }
      return res.json() as Promise<LabelWithCount>;
    },
    onSuccess: (newLabel) => {
      queryClient.setQueryData<LabelWithCount[]>(
        ["labels", workspaceId],
        (prev = []) => [...prev, newLabel].sort((a, b) => a.name.localeCompare(b.name))
      );
      setCreateOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<LabelFormValues>;
    }) => {
      const res = await fetch(`/api/labels/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to update label");
      }
      return res.json() as Promise<LabelWithCount>;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<LabelWithCount[]>(
        ["labels", workspaceId],
        (prev = []) =>
          prev
            .map((l) => (l.id === updated.id ? updated : l))
            .sort((a, b) => a.name.localeCompare(b.name))
      );
      setEditTarget(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/labels/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to delete label");
      }
    },
    onSuccess: (_, id) => {
      queryClient.setQueryData<LabelWithCount[]>(
        ["labels", workspaceId],
        (prev = []) => prev.filter((l) => l.id !== id)
      );
      setDeleteTarget(null);
    },
  });

  // ─── Render ──────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Labels</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Organise posts with colour-coded labels.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          New Label
        </Button>
      </div>

      {/* Empty state */}
      {labels.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-16 text-center">
          <Tag className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="font-medium text-muted-foreground">No labels yet</p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Create your first label to start organising posts.
          </p>
          <Button className="mt-4" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            New Label
          </Button>
        </div>
      )}

      {/* Labels grid */}
      {labels.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {labels.map((label) => (
            <LabelRow
              key={label.id}
              label={label}
              onEdit={() => setEditTarget(label)}
              onDelete={() => setDeleteTarget(label)}
              onClickChip={() =>
                router.push(`/calendar?label=${label.id}`)
              }
            />
          ))}
        </div>
      )}

      {/* Create modal */}
      <LabelModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSave={(data) => createMutation.mutate(data)}
        isPending={createMutation.isPending}
        title="New Label"
      />

      {/* Edit modal */}
      {editTarget && (
        <LabelModal
          open={!!editTarget}
          onClose={() => setEditTarget(null)}
          onSave={(data) =>
            updateMutation.mutate({ id: editTarget.id, data })
          }
          isPending={updateMutation.isPending}
          initialValues={{ name: editTarget.name, color: editTarget.color }}
          title="Edit Label"
        />
      )}

      {/* Delete dialog */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete label?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && (
                <>
                  This will remove{" "}
                  <strong>&ldquo;{deleteTarget.name}&rdquo;</strong> from all{" "}
                  <strong>{deleteTarget._count.posts}</strong>{" "}
                  {deleteTarget._count.posts === 1 ? "post" : "posts"} and
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
                deleteTarget && deleteMutation.mutate(deleteTarget.id)
              }
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Delete label
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Label row ────────────────────────────────────────────────────────────────

interface LabelRowProps {
  label: LabelWithCount;
  onEdit: () => void;
  onDelete: () => void;
  onClickChip: () => void;
}

function LabelRow({ label, onEdit, onDelete, onClickChip }: LabelRowProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-background p-3 hover:bg-muted/30 transition-colors group">
      {/* Color swatch */}
      <div
        className="h-8 w-8 rounded-full flex-shrink-0 border"
        style={{ backgroundColor: label.color }}
      />

      {/* Label chip (clickable → calendar) */}
      <button
        onClick={onClickChip}
        className="flex-1 min-w-0 text-left"
        title={`View posts with label "${label.name}"`}
      >
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium text-white max-w-full truncate"
          style={{ backgroundColor: label.color }}
        >
          {label.name}
        </span>
        <span className="block text-xs text-muted-foreground mt-0.5">
          {label._count.posts} {label._count.posts === 1 ? "post" : "posts"}
        </span>
      </button>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onEdit}
          title="Edit label"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={onDelete}
          title="Delete label"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
