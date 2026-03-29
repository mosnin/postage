# Feature 19: Auto-Plug / Post Signature

**Status:** Design / Pre-implementation
**Date:** 2026-03-29
**Author:** Architecture Review

---

## Overview

Auto-Plug lets workspace members define reusable "signature" snippets that are automatically appended to every post at compose time. A plug can be a CTA, a link, a branded hashtag, or any short block of text. Per-platform overrides handle character-limit differences between networks. Users can toggle the plug on or off per post inside the composer.

---

## 1. Data Model

### 1.1 Strategy

Rather than a standalone `PlugTemplate` table, plug configuration is stored in `WorkspaceSettings.preferences` (already `Json`, default `{}`). This avoids a migration for an initial ship and keeps workspace-scoped config co-located. If plug usage grows (versioning, analytics per-template), promoting to a dedicated table is a straight lift-and-shift.

### 1.2 Schema addition to `WorkspaceSettings`

Add a dedicated `plugTemplates` column alongside `preferences` for explicit typing and efficient querying:

```prisma
model WorkspaceSettings {
  // ... existing fields ...
  plugTemplates  Json  @default("[]")   // PlugTemplate[]
  plugsEnabled   Boolean @default(false) // workspace-level kill-switch
}
```

Migration:
```sql
ALTER TABLE workspace_settings
  ADD COLUMN plug_templates JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN plugs_enabled  BOOLEAN NOT NULL DEFAULT false;
```

### 1.3 `PlugTemplate` shape (TypeScript)

```ts
export interface PlugTemplate {
  id: string;                      // cuid, generated client-side
  name: string;                    // e.g. "Main CTA"
  isDefault: boolean;              // auto-selected in composer
  enabledPlatforms: Platform[];    // empty = all platforms

  // Per-platform content overrides. Key is Platform enum value.
  // Falls back to `defaultContent` for platforms not listed here.
  defaultContent: string;          // e.g. "Follow me → https://twitter.com/{{handle}}"
  platformContent: Partial<Record<Platform, string>>;
}
```

**Variable interpolation** (`{{handle}}`, `{{workspace}}`) is resolved server-side at publish time against the posting `SocialAccount.username` and `Workspace.name`.

### 1.4 `Post` model — per-post plug state

Store the active plug snapshot in the existing `metadata` Json field so no schema change is needed for the post model:

```ts
// post.metadata shape (extension, not replacement)
{
  plugTemplateId: string | null;   // null = plug explicitly disabled
  plugSnapshot: string | null;     // resolved text captured at save time
}
```

Using a snapshot rather than a reference means published content is immutable even when the template is later edited.

---

## 2. Per-Platform Configuration

### 2.1 Character limits

| Platform  | Hard limit        | Notes                                        |
|-----------|-------------------|----------------------------------------------|
| TWITTER   | 280               | URLs always count as 23 chars (t.co wrapping)|
| BLUESKY   | 300               | Grapheme-based                               |
| THREADS   | 500               | –                                            |
| MASTODON  | 500 (instance var)| Use 500 as conservative default              |
| LINKEDIN  | 3 000             | –                                            |
| FACEBOOK  | 63 206            | Effectively unlimited for UX purposes        |
| INSTAGRAM | 2 200             | Caption                                      |
| TIKTOK    | 2 200             | Bio/caption                                  |
| TELEGRAM  | 4 096             | –                                            |
| PINTEREST | 500               | Pin description                              |
| YOUTUBE   | 5 000             | Video description                            |

### 2.2 Character-count logic

```ts
// lib/plug-utils.ts
export const PLATFORM_LIMITS: Partial<Record<Platform, number>> = {
  TWITTER: 280,
  BLUESKY: 300,
  THREADS: 500,
  MASTODON: 500,
  LINKEDIN: 3000,
  INSTAGRAM: 2200,
  TIKTOK: 2200,
  TELEGRAM: 4096,
  PINTEREST: 500,
  YOUTUBE: 5000,
};

export function resolvePlugForPlatform(
  template: PlugTemplate,
  platform: Platform
): string {
  return template.platformContent[platform] ?? template.defaultContent;
}

export function computeCharCounts(
  body: string,
  plugText: string,
  platform: Platform
): { bodyLen: number; plugLen: number; totalLen: number; limit: number; remaining: number } {
  const separator = "\n\n";
  const totalLen = plugText
    ? body.length + separator.length + plugText.length
    : body.length;
  const limit = PLATFORM_LIMITS[platform] ?? Infinity;
  return {
    bodyLen: body.length,
    plugLen: plugText.length,
    totalLen,
    limit,
    remaining: limit - totalLen,
  };
}
```

The composer UI renders `remaining` in real-time. If `remaining < 0` the count turns red and saving is blocked.

---

## 3. Composer Integration

### 3.1 Toggle component

```tsx
// components/composer/PlugToggle.tsx
"use client";

import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { computeCharCounts, resolvePlugForPlatform } from "@/lib/plug-utils";
import type { Platform, PlugTemplate } from "@/types";

interface PlugToggleProps {
  template: PlugTemplate | null;       // default template (null = none configured)
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  onOverride: (content: string) => void; // user edited the plug text for this post
  postBody: string;
  activePlatforms: Platform[];
}

export function PlugToggle({
  template,
  enabled,
  onToggle,
  onOverride,
  postBody,
  activePlatforms,
}: PlugToggleProps) {
  if (!template) return null;

  return (
    <div className="border-t pt-3 mt-3 space-y-2">
      <div className="flex items-center gap-2">
        <Switch
          id="plug-toggle"
          checked={enabled}
          onCheckedChange={onToggle}
        />
        <Label htmlFor="plug-toggle" className="text-sm font-medium">
          Add signature
        </Label>
        <span className="text-xs text-muted-foreground">({template.name})</span>
      </div>

      {enabled && (
        <div className="space-y-1">
          {/* Per-platform character impact */}
          <div className="flex flex-wrap gap-1">
            {activePlatforms.map((platform) => {
              const plugText = resolvePlugForPlatform(template, platform);
              const counts = computeCharCounts(postBody, plugText, platform);
              const isOver = counts.remaining < 0;
              return (
                <Badge
                  key={platform}
                  variant={isOver ? "destructive" : "secondary"}
                  className="text-xs"
                >
                  {platform}: {counts.remaining >= 0 ? `${counts.remaining} left` : `${Math.abs(counts.remaining)} over`}
                </Badge>
              );
            })}
          </div>

          {/* Plug preview (editable per-post) */}
          <div className="rounded-md bg-muted/50 border border-dashed p-2">
            <p className="text-xs text-muted-foreground mb-1">Signature preview</p>
            <textarea
              className="w-full bg-transparent text-sm resize-none focus:outline-none"
              rows={2}
              defaultValue={template.defaultContent}
              onChange={(e) => onOverride(e.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
```

### 3.2 Composer state integration

Inside the existing composer form, add:

```ts
// Resolve default template from workspace settings
const defaultTemplate = plugTemplates.find((t) => t.isDefault) ?? null;

const [plugEnabled, setPlugEnabled] = useState(!!defaultTemplate);
const [plugOverride, setPlugOverride] = useState<string | null>(null);

// When building the save payload:
const plugSnapshot = plugEnabled
  ? (plugOverride ?? (defaultTemplate ? resolvePlugForPlatform(defaultTemplate, primaryPlatform) : null))
  : null;
```

The full post content sent to the API is **body only**. The plug is stored separately in `metadata.plugSnapshot` and joined at publish time (see §4.2).

---

## 4. API

### 4.1 GET/PUT `/api/workspace/settings/plugs`

```
GET  /api/workspace/settings/plugs?workspaceId=<id>
PUT  /api/workspace/settings/plugs
```

**GET response:**
```json
{
  "plugsEnabled": true,
  "plugTemplates": [
    {
      "id": "clxxx",
      "name": "Main CTA",
      "isDefault": true,
      "enabledPlatforms": [],
      "defaultContent": "Follow me for daily tips → https://twitter.com/{{handle}}",
      "platformContent": {
        "LINKEDIN": "Enjoyed this? Follow me on LinkedIn for in-depth posts on engineering leadership.\nhttps://linkedin.com/in/{{handle}}"
      }
    }
  ]
}
```

**PUT body:** same shape (full replace of the `plugTemplates` array + `plugsEnabled` flag).

### 4.2 Plug application strategy: **at publish time**

Applying the plug at publish time (not at save time) is the recommended approach:

| Concern | Apply at save | Apply at publish |
|---------|---------------|-----------------|
| Stored content is human-readable | Plug baked into `content` | Clean body in `content`; plug in `metadata.plugSnapshot` |
| Template edits affect scheduled posts | No — already baked in | Opt-in: re-resolve from template; or use snapshot for stability |
| Approval workflow diff is clean | Plug text noise in diff | Reviewers see body only |
| Character limit enforcement | Must re-check at publish | Single point of enforcement |

Implementation in the publish worker:

```ts
// lib/publisher/compose-content.ts
export function composePublishContent(
  post: Post,
  platform: Platform
): string {
  const meta = post.metadata as { plugSnapshot?: string | null };
  const plugText = meta?.plugSnapshot ?? null;
  if (!plugText) return post.content;

  // Use platform-specific separator conventions
  const separator = platform === "TWITTER" ? "\n\n" : "\n\n";
  const composed = `${post.content}${separator}${plugText}`;

  // Hard guard — should have been caught in composer but belt-and-suspenders
  const limit = PLATFORM_LIMITS[platform];
  if (limit && composed.length > limit) {
    // Truncate the body, keep plug intact (plug is the brand CTA)
    const maxBody = limit - separator.length - plugText.length;
    return `${post.content.slice(0, maxBody)}${separator}${plugText}`;
  }

  return composed;
}
```

---

## 5. Implementation Code

### 5.1 API route: `/api/workspace/settings/plugs/route.ts`

```ts
// src/app/api/workspace/settings/plugs/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const plugTemplateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(80),
  isDefault: z.boolean(),
  enabledPlatforms: z.array(z.string()),
  defaultContent: z.string().min(1).max(500),
  platformContent: z.record(z.string()).default({}),
});

const putSchema = z.object({
  workspaceId: z.string().min(1),
  plugsEnabled: z.boolean(),
  plugTemplates: z.array(plugTemplateSchema).max(20),
});

async function assertAdmin(userId: string, workspaceId: string) {
  const member = await db.workspaceMember.findFirst({
    where: { userId, workspaceId, status: "ACTIVE" },
  });
  const rank: Record<string, number> = { OWNER: 5, ADMIN: 4, MANAGER: 3, MEMBER: 2, VIEWER: 1 };
  if (!member || (rank[member.role] ?? 0) < rank.ADMIN) {
    throw { status: 403, message: "Requires ADMIN or higher" };
  }
}

// ── GET ──────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = request.nextUrl.searchParams.get("workspaceId");
    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
    }

    const settings = await db.workspaceSettings.findUnique({
      where: { workspaceId },
      select: { plugTemplates: true, plugsEnabled: true },
    });

    return NextResponse.json({
      plugsEnabled: settings?.plugsEnabled ?? false,
      plugTemplates: settings?.plugTemplates ?? [],
    });
  } catch (err: unknown) {
    if (err && typeof err === "object" && "status" in err) {
      const e = err as { status: number; message: string };
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[GET /api/workspace/settings/plugs]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ── PUT ──────────────────────────────────────────────────────────────────────

export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = putSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { workspaceId, plugsEnabled, plugTemplates } = parsed.data;

    await assertAdmin(session.user.id, workspaceId);

    // Enforce single default
    const defaults = plugTemplates.filter((t) => t.isDefault);
    if (defaults.length > 1) {
      return NextResponse.json(
        { error: "Only one template can be set as default" },
        { status: 400 }
      );
    }

    const settings = await db.workspaceSettings.upsert({
      where: { workspaceId },
      create: { workspaceId, plugsEnabled, plugTemplates: plugTemplates as never },
      update: { plugsEnabled, plugTemplates: plugTemplates as never },
    });

    return NextResponse.json({
      plugsEnabled: settings.plugsEnabled,
      plugTemplates: settings.plugTemplates,
    });
  } catch (err: unknown) {
    if (err && typeof err === "object" && "status" in err) {
      const e = err as { status: number; message: string };
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[PUT /api/workspace/settings/plugs]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

### 5.2 Settings page form: `PlugSettingsForm`

```tsx
// components/settings/PlugSettingsForm.tsx
"use client";

import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createId } from "@paralleldrive/cuid2";
import { toast } from "sonner";

const templateSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Name is required").max(80),
  isDefault: z.boolean(),
  enabledPlatforms: z.array(z.string()),
  defaultContent: z.string().min(1, "Content is required").max(500),
  platformContent: z.record(z.string()).default({}),
});

const formSchema = z.object({
  plugsEnabled: z.boolean(),
  plugTemplates: z.array(templateSchema),
});

type FormValues = z.infer<typeof formSchema>;

interface Props {
  workspaceId: string;
  initialValues: FormValues;
}

export function PlugSettingsForm({ workspaceId, initialValues }: Props) {
  const [saving, setSaving] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialValues,
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "plugTemplates",
  });

  const handleDefaultChange = (index: number) => {
    // Only one default allowed
    fields.forEach((_, i) => {
      form.setValue(`plugTemplates.${i}.isDefault`, i === index);
    });
  };

  const onSubmit = async (values: FormValues) => {
    setSaving(true);
    try {
      const res = await fetch("/api/workspace/settings/plugs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, ...values }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to save");
      }
      toast.success("Signature settings saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      {/* Master toggle */}
      <div className="flex items-center gap-3">
        <Switch
          id="plugs-enabled"
          {...form.register("plugsEnabled")}
          checked={form.watch("plugsEnabled")}
          onCheckedChange={(v) => form.setValue("plugsEnabled", v)}
        />
        <Label htmlFor="plugs-enabled" className="text-sm font-medium">
          Enable post signatures for this workspace
        </Label>
      </div>

      {/* Template list */}
      <div className="space-y-4">
        {fields.map((field, index) => (
          <Card key={field.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between">
                <Input
                  {...form.register(`plugTemplates.${index}.name`)}
                  placeholder="Template name"
                  className="h-7 text-sm font-medium w-48"
                />
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer">
                    <input
                      type="radio"
                      name="defaultTemplate"
                      checked={form.watch(`plugTemplates.${index}.isDefault`)}
                      onChange={() => handleDefaultChange(index)}
                    />
                    Default
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => remove(index)}
                    className="text-destructive hover:text-destructive h-6 px-2"
                  >
                    Remove
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Default content</Label>
                <Textarea
                  {...form.register(`plugTemplates.${index}.defaultContent`)}
                  placeholder="Follow me for daily tips → https://twitter.com/{{handle}}"
                  className="mt-1 text-sm"
                  rows={2}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Use <code>{"{{handle}}"}</code> for platform username, <code>{"{{workspace}}"}</code> for workspace name.
                </p>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">LinkedIn override (optional — longer format)</Label>
                <Textarea
                  value={form.watch(`plugTemplates.${index}.platformContent.LINKEDIN`) ?? ""}
                  onChange={(e) =>
                    form.setValue(`plugTemplates.${index}.platformContent.LINKEDIN`, e.target.value)
                  }
                  placeholder="Enjoyed this? Follow on LinkedIn for longer-form content..."
                  className="mt-1 text-sm"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            append({
              id: createId(),
              name: "New Signature",
              isDefault: fields.length === 0,
              enabledPlatforms: [],
              defaultContent: "",
              platformContent: {},
            })
          }
        >
          Add signature
        </Button>

        <Button type="submit" size="sm" disabled={saving}>
          {saving ? "Saving..." : "Save settings"}
        </Button>
      </div>
    </form>
  );
}
```

---

## 6. Variable Interpolation

Variables are resolved at publish time in the publisher worker:

```ts
// lib/publisher/interpolate-plug.ts
export function interpolatePlug(
  template: string,
  socialAccount: { username: string },
  workspace: { name: string }
): string {
  return template
    .replace(/\{\{handle\}\}/g, socialAccount.username)
    .replace(/\{\{workspace\}\}/g, workspace.name);
}
```

Supported variables:

| Variable | Resolved value |
|----------|----------------|
| `{{handle}}` | `SocialAccount.username` for the target account |
| `{{workspace}}` | `Workspace.name` |

---

## 7. Plan Gating

| Plan | Max templates | Plug feature |
|------|--------------|--------------|
| FREE | 0 | Not available |
| STARTER | 1 | Default only |
| PRO | 5 | Per-platform overrides |
| PRO_PLUS | 20 | Full access |

Enforce in the PUT handler by checking `workspace.plan` after the upsert assertion and before writing.

---

## 8. Migration Steps

1. Add `plugTemplates Json @default("[]")` and `plugsEnabled Boolean @default(false)` to `WorkspaceSettings` in `prisma/schema.prisma`.
2. Run `prisma migrate dev --name add_plug_templates`.
3. Create `src/app/api/workspace/settings/plugs/route.ts` (see §5.1).
4. Create `src/lib/plug-utils.ts` (character count helpers, §2.2).
5. Create `src/lib/publisher/compose-content.ts` (publish-time assembly, §4.2).
6. Create `src/lib/publisher/interpolate-plug.ts` (variable resolution, §6).
7. Add `PlugToggle` to the composer (§3.1).
8. Add `PlugSettingsForm` to the workspace settings page (§5.2).
9. Wire `composePublishContent` into the existing publish worker wherever platform API calls are made.
