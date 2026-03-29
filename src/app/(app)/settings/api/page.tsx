"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import {
  Loader2,
  Key,
  Plus,
  Trash2,
  Copy,
  CheckCheck,
  AlertTriangle,
} from "lucide-react";
import { cn, formatDate, formatRelative } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApiKeyRecord {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  user: { id: string; name: string | null; email: string | null };
}

const ALL_SCOPES = [
  { value: "posts:read", label: "Posts", description: "Read posts and drafts" },
  { value: "posts:write", label: "Posts", description: "Create and update posts" },
  { value: "accounts:read", label: "Accounts", description: "Read connected social accounts" },
  { value: "analytics:read", label: "Analytics", description: "Read analytics data" },
  { value: "comments:read", label: "Comments", description: "Read inbox comments" },
  { value: "comments:write", label: "Comments", description: "Reply to comments" },
  { value: "labels:read", label: "Labels", description: "Read labels" },
  { value: "labels:write", label: "Labels", description: "Create and manage labels" },
  { value: "campaigns:read", label: "Campaigns", description: "Read campaigns" },
  { value: "campaigns:write", label: "Campaigns", description: "Create and manage campaigns" },
] as const;

const createKeySchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  scopes: z.array(z.string()).min(1, "Select at least one scope"),
});

type CreateKeyFormValues = z.infer<typeof createKeySchema>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function useCopy(duration = 2000) {
  const [copied, setCopied] = useState(false);
  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), duration);
  };
  return { copied, copy };
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ApiKeysPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newRawKey, setNewRawKey] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ApiKeyRecord | null>(null);

  const { copied: keyCopied, copy: copyKey } = useCopy();

  // Fetch current workspace ID
  const { data: wsData } = useQuery({
    queryKey: ["current-workspace"],
    queryFn: async () => {
      const res = await fetch("/api/settings/workspace-id");
      if (!res.ok) throw new Error("Failed to get workspace");
      return res.json() as Promise<{ workspaceId: string }>;
    },
  });

  const resolvedWorkspaceId = wsData?.workspaceId ?? null;

  const { data: keysData, isLoading } = useQuery<{ apiKeys: ApiKeyRecord[] }>({
    queryKey: ["api-keys", resolvedWorkspaceId],
    queryFn: async () => {
      const res = await fetch(`/api/settings/api-keys?workspaceId=${resolvedWorkspaceId}`);
      if (!res.ok) throw new Error("Failed to load API keys");
      return res.json();
    },
    enabled: !!resolvedWorkspaceId,
  });

  const form = useForm<CreateKeyFormValues>({
    resolver: zodResolver(createKeySchema),
    defaultValues: { name: "", scopes: [] },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateKeyFormValues) => {
      const res = await fetch("/api/settings/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, workspaceId: resolvedWorkspaceId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to create key");
      }
      return res.json() as Promise<{ apiKey: ApiKeyRecord; rawKey: string }>;
    },
    onSuccess: ({ rawKey }) => {
      setNewRawKey(rawKey);
      setShowCreateDialog(false);
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/settings/api-keys/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete key");
    },
    onSuccess: () => {
      toast({ title: "API key deleted" });
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const apiKeys = keysData?.apiKeys ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">API Keys</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage API keys for programmatic access to PostSyncer.
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create API Key
        </Button>
      </div>

      <Separator />

      {/* Keys table */}
      <Card>
        <CardHeader>
          <CardTitle>Your Keys</CardTitle>
          <CardDescription>
            Keys give access to your workspace data. Only the key prefix is shown here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : apiKeys.length === 0 ? (
            <div className="text-center py-10">
              <Key className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">No API keys yet.</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => setShowCreateDialog(true)}
              >
                Create your first key
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="py-2 text-left font-medium">Name</th>
                    <th className="py-2 text-left font-medium">Key</th>
                    <th className="py-2 text-left font-medium">Scopes</th>
                    <th className="py-2 text-left font-medium">Last Used</th>
                    <th className="py-2 text-left font-medium">Created</th>
                    <th className="py-2 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {apiKeys.map((key) => (
                    <tr key={key.id}>
                      <td className="py-3 font-medium">{key.name}</td>
                      <td className="py-3">
                        <code className="rounded bg-muted px-2 py-0.5 text-xs font-mono">
                          {key.keyPrefix}…
                        </code>
                      </td>
                      <td className="py-3">
                        <div className="flex flex-wrap gap-1">
                          {key.scopes.slice(0, 3).map((s) => (
                            <Badge key={s} variant="secondary" className="text-xs">
                              {s}
                            </Badge>
                          ))}
                          {key.scopes.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{key.scopes.length - 3}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {key.lastUsedAt ? formatRelative(key.lastUsedAt) : "Never"}
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {formatDate(key.createdAt)}
                      </td>
                      <td className="py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setDeleteTarget(key)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create key dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
            <DialogDescription>
              Give the key a name and select the permissions it should have.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={form.handleSubmit((data) => createMutation.mutate(data))}
            className="space-y-4 py-2"
          >
            <div>
              <Label htmlFor="keyName">Key Name</Label>
              <Input
                id="keyName"
                placeholder="e.g. Production App"
                className="mt-1"
                {...form.register("name")}
              />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive mt-1">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>

            <div>
              <Label className="mb-2 block">Scopes</Label>
              <Controller
                control={form.control}
                name="scopes"
                render={({ field }) => (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {ALL_SCOPES.map((scope) => {
                      const checked = field.value.includes(scope.value);
                      return (
                        <label
                          key={scope.value}
                          className={cn(
                            "flex items-start gap-3 rounded-md border p-3 cursor-pointer transition-colors",
                            checked
                              ? "border-primary bg-primary/5"
                              : "border-border hover:bg-muted/40"
                          )}
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5 h-4 w-4 accent-primary"
                            checked={checked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                field.onChange([...field.value, scope.value]);
                              } else {
                                field.onChange(
                                  field.value.filter((v) => v !== scope.value)
                                );
                              }
                            }}
                          />
                          <div>
                            <p className="text-sm font-medium leading-none">
                              {scope.value}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {scope.description}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              />
              {form.formState.errors.scopes && (
                <p className="text-xs text-destructive mt-1">
                  {form.formState.errors.scopes.message}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowCreateDialog(false);
                  form.reset();
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Create Key
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Show newly created key — one time only */}
      <Dialog open={!!newRawKey} onOpenChange={(open) => !open && setNewRawKey(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>API Key Created</DialogTitle>
            <DialogDescription>
              Copy your API key now. You won&apos;t be able to see it again.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2 rounded-lg border bg-muted p-3">
              <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0" />
              <p className="text-xs text-muted-foreground">
                Store this key somewhere safe. It cannot be retrieved after you close this dialog.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-md border bg-background px-3 py-2 font-mono text-sm break-all">
                {newRawKey}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => newRawKey && copyKey(newRawKey)}
              >
                {keyCopied ? (
                  <CheckCheck className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setNewRawKey(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete API Key</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-medium text-foreground">{deleteTarget?.name}</span>?
              Any integrations using this key will stop working immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
