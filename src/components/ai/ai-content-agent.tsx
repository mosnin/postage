"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import {
  Link,
  FileText,
  FileUp,
  Sparkles,
  Copy,
  CheckCheck,
  ArrowRight,
  Edit2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, PLATFORM_LABELS, PLATFORM_COLORS } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

const PLATFORMS = [
  "TWITTER",
  "INSTAGRAM",
  "LINKEDIN",
  "FACEBOOK",
  "TIKTOK",
  "THREADS",
  "BLUESKY",
  "MASTODON",
  "YOUTUBE",
  "PINTEREST",
] as const;

type InputMode = "url" | "text";
const COUNT_OPTIONS = [1, 3, 5] as const;

// Single unified form schema — both url and text are optional; validation happens at submit
const formSchema = z.object({
  url: z.string().optional(),
  text: z.string().optional(),
  platforms: z.array(z.string()).min(1, "Select at least one platform"),
  count: z.number().int().min(1).max(5),
});

type FormValues = z.infer<typeof formSchema>;

interface GeneratedPost {
  platform: string;
  content: string;
}

interface EditState {
  idx: number;
  value: string;
}

interface AiContentAgentProps {
  workspaceId: string;
  onSendToComposer?: (platform: string, content: string) => void;
}

export function AiContentAgent({
  workspaceId,
  onSendToComposer,
}: AiContentAgentProps) {
  const { toast } = useToast();
  const [inputMode, setInputMode] = useState<InputMode>("url");
  const [posts, setPosts] = useState<GeneratedPost[]>([]);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);

  const { register, handleSubmit, watch, setValue, formState } =
    useForm<FormValues>({
      resolver: zodResolver(formSchema),
      defaultValues: {
        url: "",
        text: "",
        platforms: ["INSTAGRAM", "TWITTER"],
        count: 3,
      },
    });

  const watchedPlatforms = watch("platforms");
  const watchedCount = watch("count");

  function togglePlatform(platform: string) {
    const current = watchedPlatforms;
    const next = current.includes(platform)
      ? current.filter((p) => p !== platform)
      : [...current, platform];
    setValue("platforms", next);
  }

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      // Validate at submit time based on inputMode
      if (inputMode === "url") {
        if (!values.url) throw new Error("Enter a URL");
        try {
          new URL(values.url);
        } catch {
          throw new Error("Enter a valid URL");
        }
      } else {
        if (!values.text || values.text.trim().length < 10) {
          throw new Error("Paste at least 10 characters of text");
        }
      }

      const body =
        inputMode === "url"
          ? {
              workspaceId,
              url: values.url,
              platforms: values.platforms,
              count: values.count,
            }
          : {
              workspaceId,
              text: values.text,
              platforms: values.platforms,
              count: values.count,
            };

      const res = await fetch("/api/ai/content-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Generation failed");
      }
      const data = await res.json();
      return data.posts as GeneratedPost[];
    },
    onSuccess: (data) => {
      setPosts(data);
    },
    onError: (err: Error) => {
      toast({
        title: "Generation failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  async function onSubmit(values: FormValues) {
    await mutation.mutateAsync(values);
  }

  async function copyPost(content: string, idx: number) {
    await navigator.clipboard.writeText(content);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
    toast({ title: "Copied to clipboard" });
  }

  function startEdit(idx: number, content: string) {
    setEditState({ idx, value: content });
  }

  function saveEdit() {
    if (!editState) return;
    setPosts((prev) =>
      prev.map((p, i) =>
        i === editState.idx ? { ...p, content: editState.value } : p
      )
    );
    setEditState(null);
  }

  const totalPosts = watchedPlatforms.length * watchedCount;

  return (
    <div className="space-y-6">
      {/* Input mode tabs */}
      <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-1 w-fit">
        {(
          [
            { mode: "url" as InputMode, icon: Link, label: "URL" },
            { mode: "text" as InputMode, icon: FileText, label: "Text / Blog" },
          ] as const
        ).map(({ mode, icon: Icon, label }) => (
          <button
            key={mode}
            type="button"
            onClick={() => setInputMode(mode)}
            className={cn(
              "flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              inputMode === mode
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
        <button
          type="button"
          disabled
          className="flex items-center gap-2 rounded-md px-4 py-1.5 text-sm text-muted-foreground/50 cursor-not-allowed"
        >
          <FileUp className="h-3.5 w-3.5" />
          PDF
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            Soon
          </Badge>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Settings panel */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* URL input */}
          {inputMode === "url" && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Paste a URL</label>
              <input
                {...register("url")}
                type="url"
                placeholder="https://example.com/blog/my-article"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              />
            </div>
          )}

          {/* Text input */}
          {inputMode === "text" && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Paste your content</label>
              <textarea
                {...register("text")}
                rows={6}
                placeholder="Paste a blog post, press release, newsletter, or any text content..."
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 resize-none"
              />
            </div>
          )}

          {/* Platform selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Target platforms</label>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((p) => {
                const sel = watchedPlatforms.includes(p);
                const color = PLATFORM_COLORS[p] ?? "#888";
                const label = PLATFORM_LABELS[p] ?? p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => togglePlatform(p)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                      sel
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-muted/40 text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <span
                      className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold text-white flex-shrink-0"
                      style={{ background: color }}
                    >
                      {p.charAt(0)}
                    </span>
                    {label}
                  </button>
                );
              })}
            </div>
            {formState.errors.platforms && (
              <p className="text-xs text-destructive">
                {formState.errors.platforms.message}
              </p>
            )}
          </div>

          {/* Posts per platform */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Posts per platform</label>
            <div className="flex gap-2">
              {COUNT_OPTIONS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setValue("count", n)}
                  className={cn(
                    "flex-1 rounded-md border py-1.5 text-sm font-medium transition-colors",
                    watchedCount === n
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background hover:bg-muted"
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Generate button */}
          <Button
            type="submit"
            className="w-full gap-2"
            disabled={mutation.isPending}
          >
            <Sparkles className="h-4 w-4" />
            {mutation.isPending
              ? "Generating..."
              : `Generate ${totalPosts > 0 ? totalPosts : ""} Post${totalPosts !== 1 ? "s" : ""}`}
            {!mutation.isPending && (
              <Badge variant="secondary" className="ml-auto text-xs">
                3 credits
              </Badge>
            )}
          </Button>
        </form>

        {/* Output panel */}
        <div className="space-y-4">
          {posts.length === 0 && !mutation.isPending && (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border p-10 text-center">
              <Sparkles className="mb-3 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">
                Generated posts will appear here
              </p>
              <p className="mt-1 text-xs text-muted-foreground/60">
                Each post is tailored to its target platform
              </p>
            </div>
          )}

          {mutation.isPending && (
            <div className="space-y-3">
              {Array.from({ length: Math.max(3, totalPosts) }).map((_, i) => (
                <div
                  key={i}
                  className="h-32 rounded-lg border border-border bg-muted/30 animate-pulse"
                />
              ))}
            </div>
          )}

          {!mutation.isPending &&
            posts.map((post, idx) => {
              const color = PLATFORM_COLORS[post.platform] ?? "#888";
              const label = PLATFORM_LABELS[post.platform] ?? post.platform;
              return (
                <Card key={idx}>
                  <CardHeader className="flex flex-row items-center gap-2 pb-2 pt-3 px-4">
                    <span
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white flex-shrink-0"
                      style={{ background: color }}
                    >
                      {post.platform.charAt(0)}
                    </span>
                    <span className="text-sm font-medium">{label}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {post.content.length} chars
                    </span>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 space-y-3">
                    {editState?.idx === idx ? (
                      <div className="space-y-2">
                        <textarea
                          value={editState.value}
                          onChange={(e) =>
                            setEditState({ idx, value: e.target.value })
                          }
                          rows={5}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 resize-none"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="text-xs"
                            onClick={saveEdit}
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs"
                            onClick={() => setEditState(null)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                          {post.content}
                        </p>
                        <div className="flex gap-2 flex-wrap">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 text-xs"
                            onClick={() => copyPost(post.content, idx)}
                          >
                            {copiedIdx === idx ? (
                              <>
                                <CheckCheck className="h-3.5 w-3.5 text-green-500" />
                                Copied
                              </>
                            ) : (
                              <>
                                <Copy className="h-3.5 w-3.5" />
                                Copy
                              </>
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 text-xs"
                            onClick={() => startEdit(idx, post.content)}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                            Edit
                          </Button>
                          {onSendToComposer && (
                            <Button
                              variant="default"
                              size="sm"
                              className="gap-1.5 text-xs"
                              onClick={() =>
                                onSendToComposer(post.platform, post.content)
                              }
                            >
                              <ArrowRight className="h-3.5 w-3.5" />
                              Send to Composer
                            </Button>
                          )}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              );
            })}
        </div>
      </div>
    </div>
  );
}
