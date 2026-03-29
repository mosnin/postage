"use client";

import { useQueryState } from "nuqs";
import { Search, Grid, List, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type MediaType = "all" | "image" | "video" | "gif";
type SortOption = "newest" | "oldest" | "name" | "size";
type ViewMode = "grid" | "list";

const TYPE_OPTIONS: { label: string; value: MediaType }[] = [
  { label: "All", value: "all" },
  { label: "Images", value: "image" },
  { label: "Videos", value: "video" },
  { label: "GIFs", value: "gif" },
];

const SORT_OPTIONS: { label: string; value: SortOption }[] = [
  { label: "Newest", value: "newest" },
  { label: "Oldest", value: "oldest" },
  { label: "Name", value: "name" },
  { label: "Size", value: "size" },
];

interface MediaFiltersProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

export function MediaFilters({ viewMode, onViewModeChange }: MediaFiltersProps) {
  const [search, setSearch] = useQueryState("search", { defaultValue: "" });
  const [type, setType] = useQueryState<MediaType>("type", {
    defaultValue: "all",
    parse: (v: string) => (["all", "image", "video", "gif"].includes(v) ? (v as MediaType) : "all"),
  });
  const [sort, setSort] = useQueryState<SortOption>("sort", {
    defaultValue: "newest",
    parse: (v: string) =>
      (["newest", "oldest", "name", "size"] as string[]).includes(v)
        ? (v as SortOption)
        : "newest",
  });

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {/* Left: Search + Type filter */}
      <div className="flex flex-1 items-center gap-2 min-w-0">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            placeholder="Search media..."
            value={search}
            onChange={(e) => setSearch(e.target.value || null)}
            className="w-full h-9 rounded-md border border-input bg-background pl-9 pr-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
          />
        </div>

        {/* Type filter pills */}
        <div className="flex items-center gap-1 rounded-md border border-input bg-background p-1">
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setType(opt.value === "all" ? null : opt.value)}
              className={cn(
                "px-3 py-1 rounded text-sm font-medium transition-colors",
                type === opt.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Right: Sort + View toggle */}
      <div className="flex items-center gap-2">
        {/* Folder breadcrumb placeholder */}
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
          <FolderOpen className="h-4 w-4" />
          <span className="text-sm">All files</span>
        </Button>

        {/* Sort */}
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortOption)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* View toggle */}
        <div className="flex items-center gap-1 rounded-md border border-input bg-background p-1">
          <button
            onClick={() => onViewModeChange("grid")}
            className={cn(
              "p-1.5 rounded transition-colors",
              viewMode === "grid"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            )}
            title="Grid view"
          >
            <Grid className="h-4 w-4" />
          </button>
          <button
            onClick={() => onViewModeChange("list")}
            className={cn(
              "p-1.5 rounded transition-colors",
              viewMode === "list"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            )}
            title="List view"
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
