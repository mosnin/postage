"use client";

import { useState, useCallback, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useDropzone } from "react-dropzone";
import {
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Sparkles,
  X,
  Loader2,
  MessageSquare,
  Tag,
  BookOpen,
  CheckCircle2,
} from "lucide-react";
import { cn, PLATFORM_CHAR_LIMITS } from "@/lib/utils";
import type { SocialAccount, Label, Campaign } from "@/types";
import { PlatformSelector } from "./platform-selector";
import { CharacterCounter } from "./character-counter";
import { SchedulePicker, ScheduleMode } from "./schedule-picker";
import { PostPreview } from "./post-preview";
import { ThreadComposer } from "./thread-composer";

// ─── Schema ───────────────────────────────────────────────────────────────────

const composeSchema = z.object({
  content: z.string().min(1, "Post content is required"),
  selectedAccountIds: z.array(z.string()).min(1, "Select at least one account"),
  scheduledAt: z.date().nullable(),
  firstComment: z.string().optional(),
  isThread: z.boolean(),
  threadParts: z.array(z.object({ id: z.string(), content: z.string() })),
  labelIds: z.array(z.string()),
  campaignId: z.string().nullable(),
  mediaIds: z.array(z.string()),
});

type ComposeFormValues = z.infer<typeof composeSchema>;

// ─── Media item ───────────────────────────────────────────────────────────────

interface MediaItem {
  id: string;
  url: string;
  type: "image" | "video";
  name: string;
  file?: File;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface PostComposerProps {
  workspaceId: string;
  socialAccounts: SocialAccount[];
  labels: Label[];
  campaigns: Campaign[];
  timezone: string;
}

// ─── Collapsible section ──────────────────────────────────────────────────────

function Section({
  label,
  icon,
  open,
  onToggle,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 bg-muted/30 hover:bg-muted/50 transition-colors text-sm font-medium"
      >
        <span className="flex items-center gap-2 text-muted-foreground">
          {icon}
          {label}
        </span>
        {open ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
      {open && <div className="p-3 border-t bg-background">{children}</div>}
    </div>
  );
}

// ─── Main Composer ────────────────────────────────────────────────────────────

export function PostComposer({
  workspaceId,
  socialAccounts,
  labels,
  campaigns,
  timezone,
}: PostComposerProps) {
  // Form state
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [content, setContent] = useState("");
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>("now");
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
  const [firstComment, setFirstComment] = useState("");
  const [isThread, setIsThread] = useState(false);
  const [threadParts, setThreadParts] = useState([
    { id: "part-1", content: "" },
  ]);
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [activePreviewTab, setActivePreviewTab] = useState("");

  // Section visibility
  const [showFirstComment, setShowFirstComment] = useState(false);
  const [showThread, setShowThread] = useState(false);
  const [showLabels, setShowLabels] = useState(false);
  const [showCampaign, setShowCampaign] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Tiptap editor
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false, bold: false, italic: false, code: false, codeBlock: false, blockquote: false, horizontalRule: false }),
      Placeholder.configure({
        placeholder: "What would you like to share?",
      }),
    ],
    content: "",
    onUpdate({ editor }) {
      setContent(editor.getText());
    },
    editorProps: {
      attributes: {
        class:
          "min-h-[140px] focus:outline-none text-sm leading-relaxed prose prose-sm max-w-none dark:prose-invert",
      },
    },
  });

  // Media dropzone
  const onDrop = useCallback(
    (accepted: File[]) => {
      const remaining = 4 - media.length;
      if (remaining <= 0) return;
      const toAdd = accepted.slice(0, remaining);
      const newItems: MediaItem[] = toAdd.map((file) => ({
        id: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        url: URL.createObjectURL(file),
        type: file.type.startsWith("video") ? "video" : "image",
        name: file.name,
        file,
      }));
      setMedia((prev) => [...prev, ...newItems]);
    },
    [media]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".gif", ".webp"],
      "video/*": [".mp4", ".mov", ".avi"],
    },
    maxSize: 100 * 1024 * 1024, // 100MB
    noClick: true,
  });

  const mediaInputRef = useRef<HTMLInputElement>(null);

  function removeMedia(id: string) {
    setMedia((prev) => {
      const item = prev.find((m) => m.id === id);
      if (item?.url.startsWith("blob:")) URL.revokeObjectURL(item.url);
      return prev.filter((m) => m.id !== id);
    });
  }

  // Selected accounts objects
  const selectedAccounts = socialAccounts.filter((a) =>
    selectedAccountIds.includes(a.id)
  );

  // Determine which char limit to use for thread composer
  // Use smallest limit among selected platforms that supports threads (Twitter)
  const threadCharLimit = selectedAccounts.reduce((min, a) => {
    const limit = PLATFORM_CHAR_LIMITS[a.platform];
    if (!limit) return min;
    return Math.min(min, limit);
  }, 280);

  // API mutation
  const mutation = useMutation({
    mutationFn: async (action: "draft" | "approval" | "queue" | "schedule") => {
      const body: Record<string, unknown> = {
        workspaceId,
        content,
        accountIds: selectedAccountIds,
        firstComment: firstComment || undefined,
        isThread,
        threadParts: isThread ? threadParts : [],
        labelIds: selectedLabelIds,
        campaignId: selectedCampaignId,
        mediaIds: [], // Would be uploaded first in production
      };

      if (action === "draft") {
        body.status = "DRAFT";
      } else if (action === "approval") {
        body.status = "PENDING_APPROVAL";
      } else if (action === "queue") {
        body.status = "SCHEDULED";
        body.queuedAt = new Date().toISOString();
      } else if (action === "schedule") {
        if (!scheduledAt) throw new Error("Please select a date and time");
        body.status = "SCHEDULED";
        body.scheduledAt = scheduledAt.toISOString();
      }

      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to create post");
      }

      return res.json();
    },
    onSuccess: (_, action) => {
      const messages: Record<string, string> = {
        draft: "Draft saved successfully",
        approval: "Submitted for approval",
        queue: "Added to queue",
        schedule: `Scheduled for ${scheduledAt ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(scheduledAt) : ""}`,
      };
      setSuccessMessage(messages[action] ?? "Post created");
      // Reset form
      editor?.commands.clearContent();
      setContent("");
      setSelectedAccountIds([]);
      setMedia([]);
      setFirstComment("");
      setIsThread(false);
      setThreadParts([{ id: "part-1", content: "" }]);
      setSelectedLabelIds([]);
      setSelectedCampaignId(null);
      setScheduledAt(null);
      setScheduleMode("now");
      setTimeout(() => setSuccessMessage(null), 4000);
    },
  });

  const canSubmit =
    content.trim().length > 0 &&
    selectedAccountIds.length > 0 &&
    !mutation.isPending;

  const canSchedule =
    canSubmit && scheduleMode === "schedule" && scheduledAt !== null;

  function handleAction(action: "draft" | "approval" | "queue" | "schedule") {
    if (!canSubmit) return;
    if (action === "schedule" && !canSchedule) return;
    mutation.mutate(action);
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left Panel (60%) ── */}
      <div className="flex flex-col w-[60%] border-r overflow-y-auto">
        {/* Success banner */}
        {successMessage && (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-green-50 dark:bg-green-950/30 border-b border-green-200 dark:border-green-900 text-green-700 dark:text-green-400 text-sm">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            {successMessage}
          </div>
        )}

        {/* Error banner */}
        {mutation.isError && (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-destructive/10 border-b border-destructive/20 text-destructive text-sm">
            {(mutation.error as Error)?.message ?? "Something went wrong"}
          </div>
        )}

        <div className="flex-1 p-4 space-y-4">
          {/* Platform selector */}
          <PlatformSelector
            accounts={socialAccounts}
            selectedIds={selectedAccountIds}
            onChange={(ids) => {
              setSelectedAccountIds(ids);
              // Update active preview tab if needed
              const accounts = socialAccounts.filter((a) => ids.includes(a.id));
              if (accounts.length > 0 && !accounts.find((a) => a.platform === activePreviewTab)) {
                setActivePreviewTab(accounts[0].platform);
              }
            }}
          />

          {/* Editor */}
          <div
            {...getRootProps()}
            className={cn(
              "rounded-lg border bg-background px-3 py-2 transition-colors",
              isDragActive && "border-primary bg-primary/5"
            )}
          >
            <input {...getInputProps()} />
            <EditorContent editor={editor} />
            {isDragActive && (
              <p className="text-xs text-primary mt-1">Drop images here…</p>
            )}
          </div>

          {/* Character counter */}
          <CharacterCounter content={content} selectedAccounts={selectedAccounts} />

          {/* Media attachments */}
          {media.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {media.map((item) => (
                <div
                  key={item.id}
                  className="relative w-20 h-20 rounded-md overflow-hidden border bg-muted group"
                >
                  {item.type === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.url}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                      Video
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => removeMedia(item.id)}
                    className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Expandable sections */}
          <div className="space-y-2">
            {/* First comment */}
            <Section
              label="First Comment"
              icon={<MessageSquare className="w-3.5 h-3.5" />}
              open={showFirstComment}
              onToggle={() => setShowFirstComment((v) => !v)}
            >
              <textarea
                value={firstComment}
                onChange={(e) => setFirstComment(e.target.value)}
                placeholder="Add a first comment (optional)…"
                rows={3}
                className="w-full resize-none bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
              />
            </Section>

            {/* Thread */}
            <Section
              label="Thread"
              icon={<BookOpen className="w-3.5 h-3.5" />}
              open={showThread}
              onToggle={() => {
                setShowThread((v) => !v);
                setIsThread((v) => !v);
              }}
            >
              <ThreadComposer
                parts={threadParts}
                onChange={setThreadParts}
                charLimit={threadCharLimit}
              />
            </Section>

            {/* Labels */}
            <Section
              label="Labels"
              icon={<Tag className="w-3.5 h-3.5" />}
              open={showLabels}
              onToggle={() => setShowLabels((v) => !v)}
            >
              {labels.length === 0 ? (
                <p className="text-sm text-muted-foreground">No labels created yet.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {labels.map((label) => {
                    const active = selectedLabelIds.includes(label.id);
                    return (
                      <button
                        key={label.id}
                        type="button"
                        onClick={() =>
                          setSelectedLabelIds((prev) =>
                            active ? prev.filter((id) => id !== label.id) : [...prev, label.id]
                          )
                        }
                        className={cn(
                          "px-2.5 py-1 rounded-full text-xs font-medium border transition-all",
                          active
                            ? "text-white border-transparent shadow-sm"
                            : "border-border bg-background text-muted-foreground hover:text-foreground"
                        )}
                        style={active ? { backgroundColor: label.color, borderColor: label.color } : {}}
                      >
                        {label.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </Section>

            {/* Campaign */}
            <Section
              label="Campaign"
              icon={<Sparkles className="w-3.5 h-3.5" />}
              open={showCampaign}
              onToggle={() => setShowCampaign((v) => !v)}
            >
              {campaigns.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active campaigns.</p>
              ) : (
                <select
                  value={selectedCampaignId ?? ""}
                  onChange={(e) => setSelectedCampaignId(e.target.value || null)}
                  className="w-full border rounded-md px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">No campaign</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
            </Section>
          </div>

          {/* Schedule picker */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setShowSchedule((v) => !v)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {showSchedule ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
              <span className="font-medium">
                {scheduleMode === "now"
                  ? "Publish now"
                  : scheduleMode === "queue"
                  ? "Add to queue"
                  : scheduledAt
                  ? `Scheduled: ${new Intl.DateTimeFormat("en-US", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(scheduledAt)}`
                  : "Schedule for later"}
              </span>
            </button>
            {showSchedule && (
              <SchedulePicker
                mode={scheduleMode}
                scheduledAt={scheduledAt}
                timezone={timezone}
                onModeChange={setScheduleMode}
                onScheduledAtChange={setScheduledAt}
              />
            )}
          </div>
        </div>

        {/* Bottom toolbar */}
        <div className="sticky bottom-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          {/* AI + Media row */}
          <div className="flex items-center gap-2 px-4 py-2 border-b">
            <button
              type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              onClick={() => {
                // AI assist placeholder
              }}
            >
              <Sparkles className="w-4 h-4" />
              AI Assist
            </button>
            <button
              type="button"
              onClick={() => mediaInputRef.current?.click()}
              disabled={media.length >= 4}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ImageIcon className="w-4 h-4" />
              Add Media
              {media.length > 0 && (
                <span className="text-xs bg-muted rounded-full px-1.5">{media.length}/4</span>
              )}
            </button>
            <input
              ref={mediaInputRef}
              type="file"
              multiple
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files) {
                  onDrop(Array.from(e.target.files));
                  e.target.value = "";
                }
              }}
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 px-4 py-3">
            <button
              type="button"
              disabled={!canSubmit}
              onClick={() => handleAction("draft")}
              className="px-3 py-1.5 rounded-md border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Save Draft
            </button>
            <button
              type="button"
              disabled={!canSubmit}
              onClick={() => handleAction("approval")}
              className="px-3 py-1.5 rounded-md border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Submit for Approval
            </button>
            <button
              type="button"
              disabled={!canSubmit}
              onClick={() => handleAction("queue")}
              className="px-3 py-1.5 rounded-md border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Add to Queue
            </button>
            <div className="flex-1" />
            <button
              type="button"
              disabled={scheduleMode === "schedule" ? !canSchedule : !canSubmit}
              onClick={() =>
                handleAction(
                  scheduleMode === "now"
                    ? "queue"
                    : scheduleMode === "queue"
                    ? "queue"
                    : "schedule"
                )
              }
              className="flex items-center gap-2 px-4 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
            >
              {mutation.isPending && (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              )}
              {scheduleMode === "now"
                ? "Publish Now"
                : scheduleMode === "queue"
                ? "Add to Queue"
                : "Schedule"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Right Panel (40%) — Live Preview ── */}
      <div className="flex flex-col w-[40%] bg-muted/20">
        <div className="px-4 py-3 border-b bg-background/80">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Preview
          </h2>
        </div>
        <div className="flex-1 overflow-hidden">
          <PostPreview
            accounts={socialAccounts}
            selectedAccountIds={selectedAccountIds}
            content={content}
            media={media}
            activeTab={activePreviewTab}
            onTabChange={setActivePreviewTab}
          />
        </div>
      </div>
    </div>
  );
}
