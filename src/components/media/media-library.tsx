"use client";

import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import {
  Upload,
  Trash2,
  X,
  Copy,
  Check,
  Film,
  ImageIcon,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { MediaFilters } from "./media-filters";
import { MediaGrid } from "./media-grid";
import { MediaUploader } from "./media-uploader";
import { StorageUsageBar } from "./storage-usage-bar";
import { formatBytes, formatDateTime, cn } from "@/lib/utils";
import type { MediaFile } from "@prisma/client";
import type { Plan } from "@prisma/client";

interface MediaLibraryResponse {
  files: MediaFile[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
    hasNext: boolean;
    storageUsed: number;
  };
}

interface MediaLibraryProps {
  workspaceId: string;
  plan: Plan;
}

export function MediaLibrary({ workspaceId, plan }: MediaLibraryProps) {
  const queryClient = useQueryClient();

  // Filter state (nuqs)
  const [search] = useQueryState("search", { defaultValue: "" });
  const [type] = useQueryState("type", { defaultValue: "all" });
  const [sort] = useQueryState("sort", { defaultValue: "newest" });

  // Local state
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [page, setPage] = useState(1);
  const [allFiles, setAllFiles] = useState<MediaFile[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showUploader, setShowUploader] = useState(false);
  const [isPageDragActive, setIsPageDragActive] = useState(false);
  const [detailFile, setDetailFile] = useState<MediaFile | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MediaFile | null>(null);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [storageUsed, setStorageUsed] = useState(0);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Reset pages when filters change
  useEffect(() => {
    setPage(1);
    setAllFiles([]);
  }, [search, type, sort]);

  // ─── Query ──────────────────────────────────────────────────────────────────

  const queryKey = ["media", workspaceId, search, type, sort, page];

  const { data, isLoading, isFetching } = useQuery<MediaLibraryResponse>({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams({
        workspaceId,
        page: String(page),
        sort,
      });
      if (search) params.set("search", search);
      if (type !== "all") params.set("type", type);
      const res = await fetch(`/api/media?${params}`);
      if (!res.ok) throw new Error("Failed to fetch media");
      return res.json();
    },
    staleTime: 30_000,
  });

  // Accumulate pages
  useEffect(() => {
    if (data?.files) {
      if (page === 1) {
        setAllFiles(data.files);
      } else {
        setAllFiles((prev: MediaFile[]) => {
          const ids = new Set(prev.map((f: MediaFile) => f.id));
          return [...prev, ...data.files.filter((f: MediaFile) => !ids.has(f.id))];
        });
      }
    }
    if (data?.meta?.storageUsed !== undefined) {
      setStorageUsed(data.meta.storageUsed);
    }
  }, [data, page]);

  // ─── Mutations ──────────────────────────────────────────────────────────────

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/media/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to delete");
      }
    },
    onSuccess: (_: void, id: string) => {
      setAllFiles((prev: MediaFile[]) => prev.filter((f: MediaFile) => f.id !== id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      if (detailFile?.id === id) setDetailFile(null);
      // Invalidate to refresh storage count
      queryClient.invalidateQueries({ queryKey: ["media", workspaceId] });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(
        ids.map((id) =>
          fetch(`/api/media/${id}`, { method: "DELETE" }).then((r) => {
            if (!r.ok) throw new Error(`Failed to delete ${id}`);
          })
        )
      );
    },
    onSuccess: (_: void, ids: string[]) => {
      const deleted = new Set(ids);
      setAllFiles((prev: MediaFile[]) => prev.filter((f: MediaFile) => !deleted.has(f.id)));
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["media", workspaceId] });
    },
  });

  // ─── Page drag detection ─────────────────────────────────────────────────

  useEffect(() => {
    let dragCounter = 0;
    const onDragEnter = () => {
      dragCounter++;
      setIsPageDragActive(true);
    };
    const onDragLeave = () => {
      dragCounter--;
      if (dragCounter <= 0) {
        dragCounter = 0;
        setIsPageDragActive(false);
      }
    };
    const onDrop = () => {
      dragCounter = 0;
      setIsPageDragActive(false);
    };
    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, []);

  // ─── Handlers ────────────────────────────────────────────────────────────

  const handleSelect = useCallback((id: string, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const handleUploadComplete = useCallback(() => {
    // Refresh from page 1
    setPage(1);
    setAllFiles([]);
    queryClient.invalidateQueries({ queryKey: ["media", workspaceId] });
  }, [queryClient, workspaceId]);

  const handleCopyDetailUrl = async () => {
    if (!detailFile) return;
    await navigator.clipboard.writeText(detailFile.url);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const confirmDelete = (file: MediaFile) => {
    setDeleteTarget(file);
  };

  const executeDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id);
    setDeleteTarget(null);
  };

  const executeBulkDelete = () => {
    bulkDeleteMutation.mutate(Array.from(selectedIds));
    setBulkDeleteConfirm(false);
  };

  const hasNext = data?.meta?.hasNext ?? false;

  return (
    <div className="relative flex h-full">
      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b bg-background/95 backdrop-blur flex-shrink-0">
          <div className="flex items-center gap-4 min-w-0">
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Media Library</h1>
              <StorageUsageBar used={storageUsed} plan={plan} className="mt-0.5" />
            </div>
          </div>
          <Button onClick={() => setShowUploader((v: boolean) => !v)}>
            <Upload className="h-4 w-4" />
            Upload Media
          </Button>
        </div>

        {/* Upload zone (collapsible) */}
        {showUploader && (
          <div className="px-6 py-4 border-b bg-muted/30 flex-shrink-0">
            <MediaUploader
              workspaceId={workspaceId}
              onUploadComplete={handleUploadComplete}
              isPageDragTarget={isPageDragActive}
            />
          </div>
        )}

        {/* Page-level drop zone (invisible, full-page) */}
        {isPageDragActive && !showUploader && (
          <div
            className="fixed inset-0 z-50 bg-primary/10 border-4 border-dashed border-primary flex items-center justify-center"
            onDrop={(e) => {
              e.preventDefault();
              setShowUploader(true);
            }}
            onDragOver={(e) => e.preventDefault()}
          >
            <div className="flex flex-col items-center gap-3 text-primary pointer-events-none">
              <Upload className="h-16 w-16" />
              <p className="text-2xl font-semibold">Drop files to upload</p>
              <p className="text-sm opacity-70">Images, Videos, GIFs up to 500 MB</p>
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div className="px-6 py-3 border-b flex-shrink-0">
          <MediaFilters viewMode={viewMode} onViewModeChange={setViewMode} />
        </div>

        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 px-6 py-2 bg-primary/5 border-b flex-shrink-0">
            <span className="text-sm font-medium">
              {selectedIds.size} file{selectedIds.size !== 1 ? "s" : ""} selected
            </span>
            <div className="flex-1" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
            >
              Deselect all
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setBulkDeleteConfirm(true)}
            >
              <Trash2 className="h-4 w-4" />
              Delete selected
            </Button>
          </div>
        )}

        {/* Grid */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <MediaGrid
            files={allFiles}
            isLoading={isLoading}
            selectedIds={selectedIds}
            onSelect={handleSelect}
            onDelete={confirmDelete}
            onOpen={setDetailFile}
            viewMode={viewMode}
            hasNextPage={hasNext}
            isFetchingNextPage={isFetching && page > 1}
            onLoadMore={() => setPage((p: number) => p + 1)}
          />
        </div>
      </div>

      {/* Detail side panel */}
      {detailFile && (
        <DetailPanel
          file={detailFile}
          copiedUrl={copiedUrl}
          isDeleting={deleteMutation.isPending && deleteMutation.variables === detailFile.id}
          onCopyUrl={handleCopyDetailUrl}
          onDelete={() => confirmDelete(detailFile)}
          onClose={() => setDetailFile(null)}
        />
      )}

      {/* Delete confirm dialog */}
      {deleteTarget && (
        <ConfirmDialog
          title="Delete media file?"
          description={`"${deleteTarget.name}" will be permanently deleted and removed from all posts.`}
          confirmLabel="Delete"
          isDestructive
          isPending={deleteMutation.isPending}
          onConfirm={executeDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Bulk delete confirm dialog */}
      {bulkDeleteConfirm && (
        <ConfirmDialog
          title={`Delete ${selectedIds.size} files?`}
          description="These files will be permanently deleted and removed from all posts."
          confirmLabel={`Delete ${selectedIds.size} files`}
          isDestructive
          isPending={bulkDeleteMutation.isPending}
          onConfirm={executeBulkDelete}
          onCancel={() => setBulkDeleteConfirm(false)}
        />
      )}
    </div>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

interface DetailPanelProps {
  file: MediaFile;
  copiedUrl: boolean;
  isDeleting: boolean;
  onCopyUrl: () => void;
  onDelete: () => void;
  onClose: () => void;
}

function DetailPanel({
  file,
  copiedUrl,
  isDeleting,
  onCopyUrl,
  onDelete,
  onClose,
}: DetailPanelProps) {
  const isVideo = file.mimeType.startsWith("video/");
  const isGif = file.mimeType === "image/gif";

  return (
    <div className="w-80 flex-shrink-0 border-l bg-background flex flex-col overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h2 className="text-sm font-semibold">File Details</h2>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Preview */}
      <div className="relative bg-muted aspect-square flex items-center justify-center overflow-hidden">
        {isVideo ? (
          <video
            src={file.url}
            controls
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="relative w-full h-full">
            {file.url.startsWith("http") || file.url.startsWith("/") ? (
              <Image
                src={file.url}
                alt={file.name}
                fill
                className="object-contain"
                unoptimized={isGif}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                <ImageIcon className="h-16 w-16 opacity-30" />
              </div>
            )}
          </div>
        )}
        {isVideo && (
          <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded flex items-center gap-1">
            <Film className="h-3 w-3" />
            {file.duration ? `${Math.round(file.duration)}s` : "video"}
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Name */}
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Name</p>
          <p className="text-sm font-medium break-all">{file.name}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <MetaField label="Type" value={file.mimeType} />
          <MetaField label="Size" value={formatBytes(file.size)} />
          {file.width && file.height && (
            <MetaField label="Dimensions" value={`${file.width} × ${file.height}`} />
          )}
          {file.duration && (
            <MetaField label="Duration" value={`${file.duration.toFixed(1)}s`} />
          )}
          <MetaField label="Added" value={formatDateTime(file.createdAt)} />
        </div>
      </div>

      {/* Actions */}
      <div className="p-4 border-t space-y-2">
        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={onCopyUrl}
        >
          {copiedUrl ? (
            <>
              <Check className="h-4 w-4 text-green-500" />
              URL copied!
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              Copy URL
            </>
          )}
        </Button>

        <Button
          variant="destructive"
          className="w-full gap-2"
          onClick={onDelete}
          disabled={isDeleting}
        >
          {isDeleting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
          Delete file
        </Button>
      </div>
    </div>
  );
}

function MetaField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-sm font-medium break-all">{value}</p>
    </div>
  );
}

// ─── Confirm Dialog ───────────────────────────────────────────────────────────

interface ConfirmDialogProps {
  title: string;
  description: string;
  confirmLabel: string;
  isDestructive?: boolean;
  isPending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDialog({
  title,
  description,
  confirmLabel,
  isDestructive,
  isPending,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-sm rounded-xl border bg-background p-6 shadow-xl mx-4">
        <div className="flex items-start gap-3 mb-4">
          {isDestructive && (
            <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
          )}
          <div>
            <h3 className="font-semibold text-base">{title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
          <Button
            variant={isDestructive ? "destructive" : "default"}
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
