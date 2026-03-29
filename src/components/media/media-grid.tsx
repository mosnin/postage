"use client";

import { ImageIcon, Loader2 } from "lucide-react";
import { MediaItem } from "./media-item";
import type { MediaFile } from "@prisma/client";

interface MediaGridProps {
  files: MediaFile[];
  isLoading: boolean;
  selectedIds: Set<string>;
  onSelect: (id: string, selected: boolean) => void;
  onDelete: (file: MediaFile) => void;
  onOpen: (file: MediaFile) => void;
  viewMode: "grid" | "list";
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
}

export function MediaGrid({
  files,
  isLoading,
  selectedIds,
  onSelect,
  onDelete,
  onOpen,
  viewMode,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: MediaGridProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
        <ImageIcon className="h-12 w-12 opacity-30" />
        <p className="text-base font-medium">No media found</p>
        <p className="text-sm">Upload images, videos, or GIFs to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {viewMode === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {files.map((file) => (
            <MediaItem
              key={file.id}
              file={file}
              isSelected={selectedIds.has(file.id)}
              onSelect={onSelect}
              onDelete={onDelete}
              onOpen={onOpen}
              viewMode="grid"
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {files.map((file) => (
            <MediaItem
              key={file.id}
              file={file}
              isSelected={selectedIds.has(file.id)}
              onSelect={onSelect}
              onDelete={onDelete}
              onOpen={onOpen}
              viewMode="list"
            />
          ))}
        </div>
      )}

      {/* Load more */}
      {hasNextPage && (
        <div className="flex justify-center pt-4">
          <button
            onClick={onLoadMore}
            disabled={isFetchingNextPage}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-input bg-background text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50 disabled:pointer-events-none"
          >
            {isFetchingNextPage ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading…
              </>
            ) : (
              "Load more"
            )}
          </button>
        </div>
      )}
    </div>
  );
}
