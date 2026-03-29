"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ChevronRight,
  Pencil,
  Trash2,
  Loader2,
  AlertTriangle,
  CalendarDays,
  Target,
  FileText,
  BarChart2,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { CampaignForm } from "./campaign-form";
import { PostsList } from "@/components/posts/posts-list";
import { cn } from "@/lib/utils";
import type { CampaignCardData, CampaignStatus } from "./campaign-card";
import type { CampaignFormValues } from "./campaign-form";
import type { PostWithRelations } from "@/types";

// ─── API response type ────────────────────────────────────────────────────────

type CampaignDetailData = CampaignCardData & {
  posts: PostWithRelations[];
  scheduledCount: number;
  draftCount: number;
};

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<CampaignStatus, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-green-50 text-green-700 border-green-200" },
  upcoming: { label: "Upcoming", className: "bg-blue-50 text-blue-700 border-blue-200" },
  completed: { label: "Completed", className: "bg-gray-100 text-gray-600 border-gray-200" },
};

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  className,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border bg-background p-4", className)}>
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface CampaignDetailProps {
  campaignId: string;
  workspaceId: string;
}

export function CampaignDetail({ campaignId, workspaceId }: CampaignDetailProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // ─── Query ──────────────────────────────────────────────────────────────────

  const { data: campaign, isLoading } = useQuery<CampaignDetailData>({
    queryKey: ["campaign", campaignId],
    queryFn: async () => {
      const res = await fetch(`/api/campaigns/${campaignId}`);
      if (!res.ok) throw new Error("Failed to fetch campaign");
      return res.json();
    },
    staleTime: 30_000,
  });

  // ─── Mutations ──────────────────────────────────────────────────────────────

  const updateMutation = useMutation({
    mutationFn: async (data: CampaignFormValues) => {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          startDate: data.startDate
            ? new Date(data.startDate).toISOString()
            : null,
          endDate: data.endDate
            ? new Date(data.endDate).toISOString()
            : null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to update campaign");
      }
      return res.json();
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(["campaign", campaignId], (prev: CampaignDetailData) => ({
        ...prev,
        ...updated,
      }));
      // Invalidate list too
      queryClient.invalidateQueries({ queryKey: ["campaigns", workspaceId] });
      setEditOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/campaigns/${campaignId}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to delete campaign");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns", workspaceId] });
      router.push("/campaigns");
    },
  });

  const deletePostMutation = useMutation({
    mutationFn: async (postId: string) => {
      const res = await fetch(`/api/posts/${postId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete post");
    },
    onSuccess: (_, deletedId) => {
      queryClient.setQueryData<CampaignDetailData>(
        ["campaign", campaignId],
        (prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            posts: prev.posts.filter((p) => p.id !== deletedId),
            _count: { posts: prev._count.posts - 1 },
          };
        }
      );
    },
  });

  // ─── Loading ─────────────────────────────────────────────────────────────────

  if (isLoading || !campaign) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[campaign.dynamicStatus];
  const dateRange = formatDateRange(campaign.startDate, campaign.endDate);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/campaigns" className="hover:text-foreground transition-colors">
          Campaigns
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground font-medium truncate max-w-[240px]">
          {campaign.name}
        </span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight">{campaign.name}</h1>
            <span
              className={cn(
                "inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
                statusCfg.className
              )}
            >
              {statusCfg.label}
            </span>
          </div>

          {dateRange && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
              <CalendarDays className="h-4 w-4" />
              <span>{dateRange}</span>
            </div>
          )}
          {campaign.goal && (
            <div className="flex items-start gap-1.5 text-sm text-muted-foreground mt-1">
              <Target className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{campaign.goal}</span>
            </div>
          )}
          {campaign.description && (
            <p className="text-sm text-muted-foreground mt-1">{campaign.description}</p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive border-destructive/30 hover:border-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label="Total Posts"
          value={campaign._count.posts}
          icon={BarChart2}
        />
        <StatCard
          label="Published"
          value={campaign.publishedCount}
          icon={CheckCircle2}
          className="border-green-100"
        />
        <StatCard
          label="Scheduled"
          value={campaign.scheduledCount}
          icon={Clock}
          className="border-blue-100"
        />
        <StatCard
          label="Drafts"
          value={campaign.draftCount}
          icon={FileText}
        />
      </div>

      {/* Posts list */}
      <div>
        <h2 className="text-base font-semibold mb-3">Posts in this campaign</h2>
        <PostsList
          posts={campaign.posts}
          onDelete={(post) => deletePostMutation.mutate(post.id)}
          deletingId={deletePostMutation.variables}
          isDeleting={deletePostMutation.isPending}
          emptyMessage="No posts have been added to this campaign yet."
        />
      </div>

      {/* Edit modal */}
      <CampaignForm
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSave={(data) => updateMutation.mutate(data)}
        isPending={updateMutation.isPending}
        initialValues={campaign}
        title="Edit Campaign"
      />

      {/* Delete confirm */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete campaign?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{" "}
              <strong>&ldquo;{campaign.name}&rdquo;</strong> and unlink all{" "}
              {campaign._count.posts} associated posts. The posts themselves will not
              be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Delete campaign
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateRange(
  start: Date | string | null,
  end: Date | string | null
): string | null {
  if (!start && !end) return null;
  const fmt = (d: Date | string) => format(new Date(d), "MMM d, yyyy");
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  if (start) return `From ${fmt(start)}`;
  if (end) return `Until ${fmt(end)}`;
  return null;
}
