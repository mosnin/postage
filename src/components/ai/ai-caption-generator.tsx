"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Copy, Wand2, RotateCcw, CheckCheck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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

const TONES = [
  "Professional",
  "Casual",
  "Funny",
  "Educational",
  "Inspiring",
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

const formSchema = z.object({
  platform: z.string().min(1, "Select a platform"),
  topic: z.string().min(1, "Describe what the post is about").max(1000),
  tone: z.enum(TONES),
  includeHashtags: z.boolean(),
  includeEmoji: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

interface AiCaptionGeneratorProps {
  workspaceId: string;
  onUseInPost?: (caption: string) => void;
}

export function AiCaptionGenerator({
  workspaceId,
  onUseInPost,
}: AiCaptionGeneratorProps) {
  const { toast } = useToast();
  const [captions, setCaptions] = useState<string[]>([]);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      platform: "INSTAGRAM",
      topic: "",
      tone: "Casual",
      includeHashtags: true,
      includeEmoji: true,
    },
  });

  const { register, handleSubmit, watch, setValue, formState } = form;
  const watchedValues = watch();

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const res = await fetch("/api/ai/generate-caption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, count: 3, ...values }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Generation failed");
      }
      const data = await res.json();
      return data.captions as string[];
    },
    onSuccess: (data) => {
      setCaptions(data);
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

  async function copyCaption(caption: string, idx: number) {
    await navigator.clipboard.writeText(caption);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
    toast({ title: "Copied to clipboard" });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Form panel */}
      <div className="space-y-5">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
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
            {formState.errors.platform && (
              <p className="text-xs text-destructive">
                {formState.errors.platform.message}
              </p>
            )}
          </div>

          {/* Topic */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              What&apos;s this post about?
            </label>
            <textarea
              {...register("topic")}
              rows={3}
              placeholder="E.g. Announcing our new product launch — a smart water bottle that tracks hydration..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 resize-none"
            />
            {formState.errors.topic && (
              <p className="text-xs text-destructive">
                {formState.errors.topic.message}
              </p>
            )}
          </div>

          {/* Tone */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Tone</label>
            <div className="flex flex-wrap gap-2">
              {TONES.map((tone) => (
                <button
                  key={tone}
                  type="button"
                  onClick={() => setValue("tone", tone)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    watchedValues.tone === tone
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background hover:bg-muted"
                  )}
                >
                  {tone}
                </button>
              ))}
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Include hashtags</p>
                <p className="text-xs text-muted-foreground">
                  Add relevant hashtags to the caption
                </p>
              </div>
              <Switch
                checked={watchedValues.includeHashtags}
                onCheckedChange={(v) => setValue("includeHashtags", v)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Include emoji</p>
                <p className="text-xs text-muted-foreground">
                  Sprinkle in relevant emojis
                </p>
              </div>
              <Switch
                checked={watchedValues.includeEmoji}
                onCheckedChange={(v) => setValue("includeEmoji", v)}
              />
            </div>
          </div>

          {/* Submit */}
          <Button
            type="submit"
            className="w-full gap-2"
            disabled={mutation.isPending}
          >
            <Wand2 className="h-4 w-4" />
            {mutation.isPending ? "Generating..." : "Generate Captions"}
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
        {captions.length === 0 && !mutation.isPending && (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border p-10 text-center">
            <Wand2 className="mb-3 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">
              Fill in the form and generate captions
            </p>
            <p className="mt-1 text-xs text-muted-foreground/60">
              3 options will appear here
            </p>
          </div>
        )}

        {mutation.isPending && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-28 rounded-lg border border-border bg-muted/30 animate-pulse"
              />
            ))}
          </div>
        )}

        {!mutation.isPending &&
          captions.map((caption, idx) => (
            <Card key={idx} className="group relative">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Option {idx + 1}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-3">
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {caption}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={() => copyCaption(caption, idx)}
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
                  {onUseInPost && (
                    <Button
                      variant="default"
                      size="sm"
                      className="gap-1.5 text-xs"
                      onClick={() => onUseInPost(caption)}
                    >
                      <ArrowRight className="h-3.5 w-3.5" />
                      Use in Post
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}

        {captions.length > 0 && !mutation.isPending && (
          <Button
            variant="outline"
            className="w-full gap-2 text-sm"
            onClick={() => handleSubmit(onSubmit)()}
            disabled={mutation.isPending}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Regenerate
            <Badge variant="secondary" className="ml-auto text-xs">
              1 credit
            </Badge>
          </Button>
        )}
      </div>
    </div>
  );
}
