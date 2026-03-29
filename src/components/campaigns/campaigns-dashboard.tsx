"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Megaphone, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CampaignCard } from "./campaign-card";
import { CampaignForm } from "./campaign-form";
import type { CampaignCardData } from "./campaign-card";
import type { CampaignFormValues } from "./campaign-form";

interface CampaignsDashboardProps {
  workspaceId: string;
}

export function CampaignsDashboard({ workspaceId }: CampaignsDashboardProps) {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);

  const { data: campaigns = [], isLoading } = useQuery<CampaignCardData[]>({
    queryKey: ["campaigns", workspaceId],
    queryFn: async () => {
      const res = await fetch(`/api/campaigns?workspaceId=${workspaceId}`);
      if (!res.ok) throw new Error("Failed to fetch campaigns");
      return res.json();
    },
    staleTime: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: async (data: CampaignFormValues) => {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          ...data,
          startDate: data.startDate
            ? new Date(data.startDate).toISOString()
            : undefined,
          endDate: data.endDate
            ? new Date(data.endDate).toISOString()
            : undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to create campaign");
      }
      return res.json() as Promise<CampaignCardData>;
    },
    onSuccess: (newCampaign) => {
      queryClient.setQueryData<CampaignCardData[]>(
        ["campaigns", workspaceId],
        (prev = []) => [newCampaign, ...prev]
      );
      setCreateOpen(false);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Campaigns</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Group posts into campaigns and track their progress.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          New Campaign
        </Button>
      </div>

      {/* Empty state */}
      {campaigns.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-16 text-center">
          <Megaphone className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="font-medium text-muted-foreground">No campaigns yet</p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Create your first campaign to group related posts together.
          </p>
          <Button className="mt-4" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            New Campaign
          </Button>
        </div>
      )}

      {/* Campaign cards grid */}
      {campaigns.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((campaign) => (
            <CampaignCard key={campaign.id} campaign={campaign} />
          ))}
        </div>
      )}

      {/* Create modal */}
      <CampaignForm
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSave={(data) => createMutation.mutate(data)}
        isPending={createMutation.isPending}
        title="New Campaign"
      />
    </div>
  );
}
