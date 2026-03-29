"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Hash, Copy, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

const PLATFORMS = [
  "INSTAGRAM",
  "TWITTER",
  "LINKEDIN",
  "FACEBOOK",
  "TIKTOK",
  "THREADS",
  "BLUESKY",
  "MASTODON",
  "YOUTUBE",
  "PINTEREST",
] as const;

const PLATFORM_LABELS: Record<string, string> = {
  TWITTER: "Twitter / X",
  INSTAGRAM: "Instagram",
  LINKEDIN: "LinkedIn",
  FACEBOOK: "Facebook",
  TIKTOK: "TikTok",
  THREADS: "Threads",
  BLUESKY: "Bluesky",
  MASTODON: "Mastodon",
  YOUTUBE: "YouTube",
  PINTEREST: "Pinterest",
};

const COUNT_OPTIONS = [5, 10, 20, 30] as const;

const formSchema = z.object({
  platform: z.string().min(1, "Select a platform"),
  topic: z.string().min(1, "Enter a topic").max(500),
  count: z.number().int(),
  niche: z.string().max(200).optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface HashtagResult {
  tag: string;
  relevance: number;
}

interface AiHashtagGeneratorProps {
  workspaceId: string;
}

export function AiHashtagGenerator({ workspaceId }: AiHashtagGeneratorProps) {
  const { toast } = useToast();
  const [hashtags, setHashtags] = useState<HashtagResult[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [allCopied, setAllCopied] = useState(false);
  const [selCopied, setSelCopied] = useState(false);

  const { register, handleSubmit, watch, setValue, formState } =
    useForm<FormValues>({
      resolver: zodResolver(formSchema),
      defaultValues: {
        platform: "INSTAGRAM",
        topic: "",
        count: 10,
        niche: "",
      },
    });

  const watchedValues = watch();

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const res = await fetch("/api/ai/generate-hashtags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          topic: values.topic,
          platform: values.platform,
          count: values.count,
          niche: values.niche || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Generation failed");
      }
      const data = await res.json();
      return data.hashtags as HashtagResult[];
    },
    onSuccess: (data) => {
      setHashtags(data);
      setSelected(new Set(data.map((h) => h.tag)));
    },
    onError: (err: Error) => {
      toast({
        title: "Generation failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  function toggleTag(tag: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }

  async function copyAll() {
    const text = hashtags.map((h) => h.tag).join(" ");
    await navigator.clipboard.writeText(text);
    setAllCopied(true);
    setTimeout(() => setAllCopied(false), 2000);
    toast({ title: "All hashtags copied" });
  }

  async function copySelected() {
    const text = hashtags
      .filter((h) => selected.has(h.tag))
      .map((h) => h.tag)
      .join(" ");
    if (!text) {
      toast({ title: "No hashtags selected", variant: "destructive" });
      return;
    }
    await navigator.clipboard.writeText(text);
    setSelCopied(true);
    setTimeout(() => setSelCopied(false), 2000);
    toast({ title: "Selected hashtags copied" });
  }

  function relevanceBadgeVariant(
    score: number
  ): "success" | "warning" | "secondary" {
    if (score >= 80) return "success";
    if (score >= 50) return "warning";
    return "secondary";
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Form panel */}
      <div className="space-y-5">
        <form onSubmit={handleSubmit((v) => mutation.mutateAsync(v))} className="space-y-5">
          {/* Topic */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Topic</label>
            <input
              {...register("topic")}
              type="text"
              placeholder="E.g. sustainable fashion, productivity tips..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            />
            {formState.errors.topic && (
              <p className="text-xs text-destructive">
                {formState.errors.topic.message}
              </p>
            )}
          </div>

          {/* Platform */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Platform</label>
            <Select
              value={watchedValues.platform}
              onValueChange={(v) => setValue("platform", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select platform" />
              </SelectTrigger>
              <SelectContent>
                {PLATFORMS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {PLATFORM_LABELS[p] ?? p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Count */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Number of hashtags</label>
            <div className="flex gap-2">
              {COUNT_OPTIONS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setValue("count", n)}
                  className={cn(
                    "flex-1 rounded-md border py-1.5 text-sm font-medium transition-colors",
                    watchedValues.count === n
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background hover:bg-muted"
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Niche */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Niche / Industry{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </label>
            <input
              {...register("niche")}
              type="text"
              placeholder="E.g. fitness, tech startups, food blogging..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            />
          </div>

          <Button
            type="submit"
            className="w-full gap-2"
            disabled={mutation.isPending}
          >
            <Hash className="h-4 w-4" />
            {mutation.isPending ? "Generating..." : "Generate Hashtags"}
            {!mutation.isPending && (
              <Badge variant="secondary" className="ml-auto text-xs">
                1 credit
              </Badge>
            )}
          </Button>
        </form>
      </div>

      {/* Results panel */}
      <div className="space-y-4">
        {hashtags.length === 0 && !mutation.isPending && (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border p-10 text-center">
            <Hash className="mb-3 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">
              Your hashtag cloud will appear here
            </p>
            <p className="mt-1 text-xs text-muted-foreground/60">
              Click to select / deselect individual hashtags
            </p>
          </div>
        )}

        {mutation.isPending && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className="h-7 rounded-full bg-muted animate-pulse"
                  style={{ width: `${60 + Math.random() * 60}px` }}
                />
              ))}
            </div>
          </div>
        )}

        {!mutation.isPending && hashtags.length > 0 && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                {selected.size} / {hashtags.length} selected
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={copySelected}
                >
                  {selCopied ? (
                    <CheckCheck className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  Copy Selected
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={copyAll}
                >
                  {allCopied ? (
                    <CheckCheck className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  Copy All
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 rounded-lg border border-border p-4">
              {hashtags.map((h) => {
                const isSelected = selected.has(h.tag);
                return (
                  <button
                    key={h.tag}
                    type="button"
                    onClick={() => toggleTag(h.tag)}
                    className={cn(
                      "group flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-all",
                      isSelected
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-muted/40 text-muted-foreground line-through opacity-50 hover:opacity-80"
                    )}
                  >
                    {h.tag}
                    <Badge
                      variant={relevanceBadgeVariant(h.relevance)}
                      className="ml-0.5 px-1.5 py-0 text-[10px]"
                    >
                      {h.relevance}
                    </Badge>
                  </button>
                );
              })}
            </div>

            <p className="text-xs text-muted-foreground">
              Relevance score: <span className="text-green-600 font-medium">80+</span> high,{" "}
              <span className="text-yellow-600 font-medium">50–79</span> medium,{" "}
              <span className="text-muted-foreground">below 50</span> low
            </p>
          </>
        )}
      </div>
    </div>
  );
}
