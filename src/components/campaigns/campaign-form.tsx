"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type { CampaignCardData } from "./campaign-card";

// ─── Schema ───────────────────────────────────────────────────────────────────

const campaignFormSchema = z
  .object({
    name: z.string().min(1, "Name is required").max(100, "Max 100 characters"),
    description: z.string().max(500, "Max 500 characters").optional(),
    goal: z.string().max(300, "Max 300 characters").optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return new Date(data.endDate) > new Date(data.startDate);
      }
      return true;
    },
    { message: "End date must be after start date", path: ["endDate"] }
  );

export type CampaignFormValues = z.infer<typeof campaignFormSchema>;

// ─── Props ────────────────────────────────────────────────────────────────────

interface CampaignFormProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: CampaignFormValues) => void;
  isPending: boolean;
  initialValues?: Partial<CampaignCardData>;
  title?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CampaignForm({
  open,
  onClose,
  onSave,
  isPending,
  initialValues,
  title = "New Campaign",
}: CampaignFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignFormSchema),
    defaultValues: buildDefaults(initialValues),
  });

  // Re-populate when initialValues change (e.g. opening edit modal again)
  useEffect(() => {
    if (open) {
      reset(buildDefaults(initialValues));
    }
  }, [open, initialValues, reset]);

  function handleClose() {
    reset();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSave)} className="space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="campaign-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="campaign-name"
              placeholder="e.g. Spring Launch 2025"
              {...register("name")}
              autoFocus
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="campaign-description">Description</Label>
            <Textarea
              id="campaign-description"
              placeholder="What is this campaign about?"
              rows={2}
              {...register("description")}
            />
            {errors.description && (
              <p className="text-xs text-destructive">
                {errors.description.message}
              </p>
            )}
          </div>

          {/* Goal */}
          <div className="space-y-1.5">
            <Label htmlFor="campaign-goal">Goal</Label>
            <Input
              id="campaign-goal"
              placeholder="e.g. Drive 1000 clicks to launch page"
              {...register("goal")}
            />
            {errors.goal && (
              <p className="text-xs text-destructive">{errors.goal.message}</p>
            )}
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="campaign-start">Start date</Label>
              <Input
                id="campaign-start"
                type="date"
                {...register("startDate")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="campaign-end">End date</Label>
              <Input
                id="campaign-end"
                type="date"
                {...register("endDate")}
              />
              {errors.endDate && (
                <p className="text-xs text-destructive">
                  {errors.endDate.message}
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save campaign
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDateInputValue(d: Date | string | null | undefined): string {
  if (!d) return "";
  try {
    return new Date(d).toISOString().split("T")[0];
  } catch {
    return "";
  }
}

function buildDefaults(
  v?: Partial<CampaignCardData>
): CampaignFormValues {
  return {
    name: v?.name ?? "",
    description: v?.description ?? "",
    goal: v?.goal ?? "",
    startDate: toDateInputValue(v?.startDate),
    endDate: toDateInputValue(v?.endDate),
  };
}
