"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, X, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { cn, formatBytes } from "@/lib/utils";

const ACCEPTED = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/gif": [".gif"],
  "image/webp": [".webp"],
  "video/mp4": [".mp4"],
  "video/quicktime": [".mov"],
};

const MAX_SIZE = 500 * 1024 * 1024; // 500 MB

export type UploadStatus = "pending" | "uploading" | "success" | "error";

export interface UploadingFile {
  id: string;
  file: File;
  status: UploadStatus;
  progress: number;
  error?: string;
  publicUrl?: string;
}

interface MediaUploaderProps {
  workspaceId: string;
  onUploadComplete: (mediaFileId: string) => void;
  /** When true, shows full-page drag overlay */
  isPageDragTarget?: boolean;
}

export function MediaUploader({
  workspaceId,
  onUploadComplete,
  isPageDragTarget = false,
}: MediaUploaderProps) {
  const [uploads, setUploads] = useState<UploadingFile[]>([]);

  const updateUpload = useCallback(
    (id: string, patch: Partial<UploadingFile>) => {
      setUploads((prev: UploadingFile[]) =>
        prev.map((u: UploadingFile) => (u.id === id ? { ...u, ...patch } : u))
      );
    },
    []
  );

  const uploadFile = useCallback(
    async (uploadItem: UploadingFile) => {
      updateUpload(uploadItem.id, { status: "uploading", progress: 0 });

      try {
        // 1. Get presigned upload URL
        const urlRes = await fetch("/api/media/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: uploadItem.file.name,
            mimeType: uploadItem.file.type,
            size: uploadItem.file.size,
            workspaceId,
          }),
        });

        if (!urlRes.ok) {
          const err = await urlRes.json();
          throw new Error(err.error ?? "Failed to get upload URL");
        }

        const { uploadUrl, publicUrl } = await urlRes.json();

        // 2. Upload the file (simulate progress for dev; in production use XHR with progress event)
        updateUpload(uploadItem.id, { progress: 30 });

        // In production with Vercel Blob / S3 you'd PUT to uploadUrl directly.
        // For dev we simulate by just noting the public URL.
        if (uploadUrl.includes("upload-direct")) {
          // Dev simulation: skip actual file PUT, pretend it's done
          updateUpload(uploadItem.id, { progress: 80 });
        } else {
          const putRes = await fetch(uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": uploadItem.file.type },
            body: uploadItem.file,
          });
          if (!putRes.ok) throw new Error("Upload failed");
        }

        updateUpload(uploadItem.id, { progress: 85 });

        // 3. Create MediaFile record
        const createRes = await fetch("/api/media", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId,
            name: uploadItem.file.name,
            url: publicUrl,
            mimeType: uploadItem.file.type,
            size: uploadItem.file.size,
          }),
        });

        if (!createRes.ok) {
          const err = await createRes.json();
          throw new Error(err.error ?? "Failed to save media record");
        }

        const mediaFile = await createRes.json();
        updateUpload(uploadItem.id, { status: "success", progress: 100, publicUrl });
        onUploadComplete(mediaFile.id);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed";
        updateUpload(uploadItem.id, { status: "error", error: message });
      }
    },
    [workspaceId, onUploadComplete, updateUpload]
  );

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const newUploads: UploadingFile[] = acceptedFiles.map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        status: "pending",
        progress: 0,
      }));
      setUploads((prev: UploadingFile[]) => [...prev, ...newUploads]);
      newUploads.forEach((u) => uploadFile(u));
    },
    [uploadFile]
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: ACCEPTED,
    maxSize: MAX_SIZE,
    noClick: isPageDragTarget, // when used as page target, don't auto-open on click
    onDropRejected: (rejected) => {
      const errorUploads: UploadingFile[] = rejected.map((r) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file: r.file,
        status: "error",
        progress: 0,
        error:
          r.errors[0]?.code === "file-too-large"
            ? "File exceeds 500 MB limit"
            : r.errors[0]?.message ?? "Unsupported file type",
      }));
      setUploads((prev: UploadingFile[]) => [...prev, ...errorUploads]);
    },
  });

  const removeUpload = (id: string) => {
    setUploads((prev: UploadingFile[]) => prev.filter((u: UploadingFile) => u.id !== id));
  };

  const clearCompleted = () => {
    setUploads((prev) => prev.filter((u) => u.status !== "success" && u.status !== "error"));
  };

  const activeUploads = uploads.filter((u) => u.status === "uploading" || u.status === "pending");
  const doneUploads = uploads.filter((u) => u.status === "success" || u.status === "error");

  return (
    <>
      {/* Page-level drag overlay */}
      {isPageDragTarget && isDragActive && (
        <div className="fixed inset-0 z-50 bg-primary/10 border-4 border-dashed border-primary flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-3 text-primary">
            <Upload className="h-16 w-16" />
            <p className="text-2xl font-semibold">Drop files to upload</p>
            <p className="text-sm opacity-70">Images, Videos, GIFs up to 500 MB</p>
          </div>
        </div>
      )}

      {/* Dropzone (used as the inline zone when not in page-target mode) */}
      <div
        {...getRootProps()}
        className={cn(
          "relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 transition-colors cursor-pointer",
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50 hover:bg-accent/30"
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-2 text-center">
          <Upload className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm font-medium">
            {isDragActive ? "Drop files here" : "Drag & drop files here"}
          </p>
          <p className="text-xs text-muted-foreground">
            JPG, PNG, GIF, WebP, MP4, MOV &mdash; up to 500 MB per file
          </p>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              open();
            }}
            className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Upload className="h-3.5 w-3.5" />
            Browse files
          </button>
        </div>
      </div>

      {/* Upload progress list */}
      {uploads.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">
              {activeUploads.length > 0
                ? `Uploading ${activeUploads.length} file${activeUploads.length !== 1 ? "s" : ""}…`
                : `${doneUploads.length} file${doneUploads.length !== 1 ? "s" : ""} processed`}
            </p>
            {doneUploads.length > 0 && (
              <button
                onClick={clearCompleted}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear done
              </button>
            )}
          </div>

          {uploads.map((u) => (
            <UploadRow key={u.id} upload={u} onRemove={removeUpload} />
          ))}
        </div>
      )}
    </>
  );
}

// ─── Upload row ───────────────────────────────────────────────────────────────

function UploadRow({
  upload,
  onRemove,
}: {
  upload: UploadingFile;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-2.5">
      {/* Status icon */}
      <div className="flex-shrink-0">
        {upload.status === "uploading" || upload.status === "pending" ? (
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        ) : upload.status === "success" ? (
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        ) : (
          <AlertCircle className="h-4 w-4 text-destructive" />
        )}
      </div>

      {/* File info + progress */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium truncate">{upload.file.name}</p>
          <span className="text-xs text-muted-foreground flex-shrink-0">
            {formatBytes(upload.file.size)}
          </span>
        </div>

        {upload.status === "uploading" && (
          <div className="mt-1 h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${upload.progress}%` }}
            />
          </div>
        )}

        {upload.status === "error" && (
          <p className="mt-0.5 text-xs text-destructive">{upload.error}</p>
        )}
      </div>

      {/* Remove button (only for done states) */}
      {(upload.status === "success" || upload.status === "error") && (
        <button
          onClick={() => onRemove(upload.id)}
          className="flex-shrink-0 p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
