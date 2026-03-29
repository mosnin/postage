"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Hash, Copy, RefreshCw, Sparkles, Check, ArrowRight } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Platform = "INSTAGRAM" | "TWITTER" | "TIKTOK" | "LINKEDIN" | "YOUTUBE" | "FACEBOOK";
type Niche = "broad" | "niche" | "trending";

interface HashtagItem {
  tag: string;
  relevance: number;
}

interface HashtagGroups {
  popular: HashtagItem[];
  niche: HashtagItem[];
  trending: HashtagItem[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "TWITTER", label: "Twitter / X" },
  { value: "TIKTOK", label: "TikTok" },
  { value: "LINKEDIN", label: "LinkedIn" },
  { value: "YOUTUBE", label: "YouTube" },
  { value: "FACEBOOK", label: "Facebook" },
];

const NICHES: { value: Niche; label: string; description: string }[] = [
  { value: "broad", label: "Broad", description: "Wide audience reach" },
  { value: "niche", label: "Niche", description: "Targeted community" },
  { value: "trending", label: "Trending", description: "High engagement" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function HashtagGeneratorTool() {
  const [topic, setTopic] = useState("");
  const [platform, setPlatform] = useState<Platform>("INSTAGRAM");
  const [niche, setNiche] = useState<Niche>("broad");
  const [count, setCount] = useState(20);

  const [hashtags, setHashtags] = useState<HashtagGroups | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateLimited, setRateLimited] = useState(false);

  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedSelected, setCopiedSelected] = useState(false);

  const allTags = hashtags
    ? [
        ...hashtags.popular,
        ...hashtags.niche,
        ...hashtags.trending,
      ]
    : [];

  async function handleGenerate() {
    if (!topic.trim()) return;
    setLoading(true);
    setError(null);
    setRateLimited(false);
    setHashtags(null);
    setSelectedTags(new Set());

    try {
      const res = await fetch("/api/tools/generate-hashtags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim(), platform, niche, count }),
      });

      const data = await res.json();

      if (res.status === 429) {
        setRateLimited(true);
        return;
      }

      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      setHashtags(data.hashtags);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function toggleTag(tag: string) {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        next.add(tag);
      }
      return next;
    });
  }

  async function handleCopyAll() {
    const text = allTags.map((h) => h.tag).join(" ");
    await navigator.clipboard.writeText(text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  }

  async function handleCopySelected() {
    const text = Array.from(selectedTags).join(" ");
    await navigator.clipboard.writeText(text);
    setCopiedSelected(true);
    setTimeout(() => setCopiedSelected(false), 2000);
  }

  function selectAll() {
    setSelectedTags(new Set(allTags.map((h) => h.tag)));
  }

  function clearSelection() {
    setSelectedTags(new Set());
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* Input Form */}
      <Card>
        <CardContent className="pt-6 space-y-6">
          {/* Topic */}
          <div className="space-y-2">
            <Label htmlFor="topic" className="text-sm font-medium">
              Topic or keyword
            </Label>
            <Input
              id="topic"
              placeholder="e.g. sustainable fashion, productivity tips, home cooking"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              maxLength={500}
              onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
            />
          </div>

          {/* Platform */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Platform</Label>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPlatform(p.value)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
                    platform === p.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Niche */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Strategy</Label>
            <div className="grid grid-cols-3 gap-2">
              {NICHES.map((n) => (
                <button
                  key={n.value}
                  onClick={() => setNiche(n.value)}
                  className={cn(
                    "rounded-lg border p-3 text-left transition-colors",
                    niche === n.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <p
                    className={cn(
                      "text-sm font-medium",
                      niche === n.value ? "text-primary" : "text-foreground"
                    )}
                  >
                    {n.label}
                  </p>
                  <p className="text-xs text-muted-foreground">{n.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Count Slider */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Number of hashtags:{" "}
              <span className="font-bold text-primary">{count}</span>
            </Label>
            <input
              type="range"
              min={10}
              max={30}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>10</span>
              <span>30</span>
            </div>
          </div>

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={loading || !topic.trim()}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Generating hashtags...
              </>
            ) : (
              <>
                <Hash className="mr-2 h-4 w-4" />
                Generate Hashtags
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Rate Limit */}
      {rateLimited && (
        <Card className="border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/30">
          <CardContent className="pt-6 text-center space-y-3">
            <p className="font-semibold text-orange-800 dark:text-orange-200">
              Rate limit reached
            </p>
            <p className="text-sm text-orange-700 dark:text-orange-300">
              You&apos;ve used your 5 free generations this hour. Sign up for unlimited access.
            </p>
            <Button asChild>
              <Link href="/register">
                Sign up free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Output */}
      {hashtags && (
        <div className="space-y-6">
          {/* Action bar */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">
                {allTags.length} hashtags generated
              </h2>
              {selectedTags.size > 0 && (
                <Badge variant="secondary">{selectedTags.size} selected</Badge>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={selectAll}>
                Select all
              </Button>
              {selectedTags.size > 0 && (
                <>
                  <Button variant="outline" size="sm" onClick={clearSelection}>
                    Clear
                  </Button>
                  <Button size="sm" onClick={handleCopySelected}>
                    {copiedSelected ? (
                      <>
                        <Check className="mr-1.5 h-3.5 w-3.5 text-green-400" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="mr-1.5 h-3.5 w-3.5" />
                        Copy selected
                      </>
                    )}
                  </Button>
                </>
              )}
              <Button variant="outline" size="sm" onClick={handleCopyAll}>
                {copiedAll ? (
                  <>
                    <Check className="mr-1.5 h-3.5 w-3.5 text-green-600" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="mr-1.5 h-3.5 w-3.5" />
                    Copy all
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleGenerate}
                disabled={loading}
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Hashtag groups */}
          {(
            [
              { key: "popular", label: "Popular", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-950/70 border-blue-200 dark:border-blue-800" },
              { key: "niche", label: "Niche", color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 dark:hover:bg-purple-950/70 border-purple-200 dark:border-purple-800" },
              { key: "trending", label: "Trending", color: "text-pink-600 dark:text-pink-400", bg: "bg-pink-50 hover:bg-pink-100 dark:bg-pink-950/40 dark:hover:bg-pink-950/70 border-pink-200 dark:border-pink-800" },
            ] as const
          ).map(({ key, label, color, bg }) => {
            const group = hashtags[key];
            if (!group.length) return null;
            return (
              <Card key={key}>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className={cn("h-4 w-4", color)} />
                    <h3 className={cn("font-semibold", color)}>{label}</h3>
                    <Badge variant="secondary" className="text-xs">
                      {group.length}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {group.map((item) => (
                      <button
                        key={item.tag}
                        onClick={() => toggleTag(item.tag)}
                        className={cn(
                          "rounded-full border px-3 py-1 text-sm font-medium transition-all",
                          selectedTags.has(item.tag)
                            ? "border-primary bg-primary text-primary-foreground"
                            : bg
                        )}
                      >
                        {item.tag}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* CTA */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-6 pb-6">
              <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:text-left sm:justify-between">
                <div>
                  <p className="font-semibold">Need more hashtag research tools?</p>
                  <p className="text-sm text-muted-foreground">
                    Sign up free to save hashtag sets and track performance.
                  </p>
                </div>
                <Button asChild className="shrink-0">
                  <Link href="/register">
                    Sign up free
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
