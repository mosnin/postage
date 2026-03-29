"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Film, Copy, Trash2, Check, ImageIcon, ExternalLink } from "lucide-react";
import { formatBytes, formatRelative, cn } from "@/lib/utils";
import type { MediaFile } from "@prisma/client";

interface MediaItemProps {
  file: MediaFile;
  isSelected: boolean;
  onSelect: (id: string, selected: boolean) => void;
  onDelete: (file: MediaFile) => void;
  onOpen: (file: MediaFile) => void;
  viewMode: "grid" | "list";
}

function isVideo(mimeType: string) {
  return mimeType.startsWith("video/");
}

function isGif(mimeType: string) {
  return mimeType === "image/gif";
}

export function MediaItem({
  file,
  isSelected,
  onSelect,
  onDelete,
  onOpen,
  viewMode,
}: MediaItemProps) {
  const [copied, setCopied] = useState(false);
  const [imgError, setImgError] = useState(false);

  const handleCopyUrl = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(file.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: ignore
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(file);
  };

  const handleCheckbox = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(file.id, !isSelected);
  };

  if (viewMode === "list") {
    return (
      <div
        className={cn(
          "flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer group",
          isSelected
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/40 hover:bg-accent/40"
        )}
        onClick={() => onOpen(file)}
      >
        {/* Checkbox */}
        <div
          className="flex-shrink-0 w-5 h-5 rounded border-2 border-muted-foreground flex items-center justify-center cursor-pointer transition-colors hover:border-primary"
          style={{
            backgroundColor: isSelected ? "hsl(var(--primary))" : "transparent",
            borderColor: isSelected ? "hsl(var(--primary))" : undefined,
          }}
          onClick={handleCheckbox}
        >
          {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
        </div>

        {/* Thumbnail */}
        <div className="flex-shrink-0 w-10 h-10 rounded overflow-hidden bg-muted flex items-center justify-center">
          <Thumbnail file={file} imgError={imgError} onImgError={() => setImgError(true)} size={40} />
        </div>

        {/* Name */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{file.name}</p>
          <p className="text-xs text-muted-foreground">
            {file.mimeType} &middot; {formatBytes(file.size)}
          </p>
        </div>

        {/* Date */}
        <span className="text-xs text-muted-foreground hidden sm:block whitespace-nowrap">
          {formatRelative(file.createdAt)}
        </span>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleCopyUrl}
            className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title="Copy URL"
          >
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          </button>
          <button
            onClick={handleDelete}
            className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  // Grid view
  return (
    <div
      className={cn(
        "group relative rounded-lg border overflow-hidden cursor-pointer transition-all",
        isSelected
          ? "border-primary ring-2 ring-primary ring-offset-2"
          : "border-border hover:border-primary/40"
      )}
      onClick={() => onOpen(file)}
    >
      {/* Thumbnail area */}
      <div className="relative aspect-square bg-muted overflow-hidden">
        <Thumbnail
          file={file}
          imgError={imgError}
          onImgError={() => setImgError(true)}
          fill
        />

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
          {/* Top row: checkbox + open */}
          <div className="flex items-start justify-between">
            <div
              className={cn(
                "w-5 h-5 rounded border-2 border-white flex items-center justify-center transition-colors",
                isSelected ? "bg-primary border-primary" : "bg-white/20"
              )}
              onClick={handleCheckbox}
            >
              {isSelected && <Check className="h-3 w-3 text-white" />}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpen(file);
              }}
              className="p-1 rounded bg-white/20 hover:bg-white/30 text-white transition-colors"
              title="Open detail"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Bottom row: actions */}
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={handleCopyUrl}
              className="p-1.5 rounded bg-white/20 hover:bg-white/30 text-white transition-colors"
              title="Copy URL"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-green-400" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
            <button
              onClick={handleDelete}
              className="p-1.5 rounded bg-white/20 hover:bg-red-500/80 text-white transition-colors"
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Video badge */}
        {isVideo(file.mimeType) && (
          <div className="absolute top-1.5 left-1.5 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded flex items-center gap-1">
            <Film className="h-3 w-3" />
            {file.duration ? `${Math.round(file.duration)}s` : "video"}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-2 bg-background">
        <p className="text-xs font-medium truncate" title={file.name}>
          {file.name}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatBytes(file.size)} &middot; {formatRelative(file.createdAt)}
        </p>
      </div>
    </div>
  );
}

// ─── Thumbnail sub-component ──────────────────────────────────────────────────

interface ThumbnailProps {
  file: MediaFile;
  imgError: boolean;
  onImgError: () => void;
  fill?: boolean;
  size?: number;
}

function Thumbnail({ file, imgError, onImgError, fill, size }: ThumbnailProps) {
  const src = file.thumbnailUrl ?? file.url;
  const video = isVideo(file.mimeType);
  const gif = isGif(file.mimeType);

  if (video) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted text-muted-foreground">
        <Film className="h-8 w-8" />
      </div>
    );
  }

  if (!imgError && (src.startsWith("http") || src.startsWith("/"))) {
    return fill ? (
      <Image
        src={src}
        alt={file.name}
        fill
        className="object-cover"
        sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
        onError={onImgError}
        unoptimized={gif}
      />
    ) : (
      <Image
        src={src}
        alt={file.name}
        width={size ?? 40}
        height={size ?? 40}
        className="object-cover w-full h-full"
        onError={onImgError}
        unoptimized={gif}
      />
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center bg-muted text-muted-foreground">
      <ImageIcon className="h-8 w-8" />
    </div>
  );
}
