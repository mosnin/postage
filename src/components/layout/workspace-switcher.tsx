"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ChevronsUpDown,
  Plus,
  Check,
  Building2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface WorkspaceSwitcherWorkspace {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
}

interface WorkspaceSwitcherProps {
  currentWorkspace: WorkspaceSwitcherWorkspace;
  workspaces: WorkspaceSwitcherWorkspace[];
  collapsed?: boolean;
}

export function WorkspaceSwitcher({
  currentWorkspace,
  workspaces,
  collapsed = false,
}: WorkspaceSwitcherProps) {
  const router = useRouter();

  const initials = currentWorkspace.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            collapsed && "justify-center px-0"
          )}
          aria-label="Switch workspace"
        >
          {/* Workspace logo / initials */}
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
            {currentWorkspace.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={currentWorkspace.logoUrl}
                alt={currentWorkspace.name}
                className="h-full w-full rounded-md object-cover"
              />
            ) : (
              initials
            )}
          </span>

          {!collapsed && (
            <>
              <span className="flex-1 truncate text-left">
                {currentWorkspace.name}
              </span>
              <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        side="bottom"
        className="w-64"
        sideOffset={4}
      >
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
          Workspaces
        </DropdownMenuLabel>

        {workspaces.map((ws, index) => {
          const wsInitials = ws.name
            .split(" ")
            .map((w) => w[0])
            .join("")
            .slice(0, 2)
            .toUpperCase();
          const isActive = ws.id === currentWorkspace.id;
          const shortcut = index < 9 ? `⌘${index + 1}` : undefined;

          return (
            <DropdownMenuItem
              key={ws.id}
              onSelect={() => {
                if (!isActive) {
                  router.push(`/dashboard`);
                }
              }}
              className="flex items-center gap-2"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary/10 text-xs font-bold text-primary">
                {ws.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={ws.logoUrl}
                    alt={ws.name}
                    className="h-full w-full rounded object-cover"
                  />
                ) : (
                  wsInitials
                )}
              </span>
              <span className="flex-1 truncate">{ws.name}</span>
              {isActive && <Check className="h-4 w-4 text-primary" />}
              {shortcut && !isActive && (
                <DropdownMenuShortcut>{shortcut}</DropdownMenuShortcut>
              )}
            </DropdownMenuItem>
          );
        })}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onSelect={() => router.push("/onboarding/workspace")}
          className="flex items-center gap-2 text-muted-foreground"
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-dashed border-border">
            <Plus className="h-3.5 w-3.5" />
          </span>
          <span>Create Workspace</span>
          <DropdownMenuShortcut>⌘N</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
