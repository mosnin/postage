"use client";

import { useState, useMemo } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PLATFORM_CHAR_LIMITS } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Copy, Check, Trash2 } from "lucide-react";

// ---------------------------------------------------------------------------
// Platforms to display (ordered by descending limit for a sensible layout)
// ---------------------------------------------------------------------------

const COUNTER_PLATFORMS = [
  { key: "TWITTER", label: "Twitter / X" },
  { key: "BLUESKY", label: "Bluesky" },
  { key: "THREADS", label: "Threads" },
  { key: "MASTODON", label: "Mastodon" },
  { key: "INSTAGRAM", label: "Instagram" },
  { key: "LINKEDIN", label: "LinkedIn" },
  { key: "TELEGRAM", label: "Telegram" },
] as const;

type PlatformKey = (typeof COUNTER_PLATFORMS)[number]["key"];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CharacterCounterTool() {
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);

  const charCount = text.length;
  const wordCount = text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
  const lineCount = text === "" ? 0 : text.split("\n").length;

  const platformStatus = useMemo(() => {
    return COUNTER_PLATFORMS.map(({ key, label }) => {
      const limit = PLATFORM_CHAR_LIMITS[key] ?? Infinity;
      const over = charCount > limit;
      const usage = Math.min((charCount / limit) * 100, 100);
      const comfortable = !over && charCount / limit < 0.7;
      return { key: key as PlatformKey, label, limit, over, usage, comfortable };
    });
  }, [charCount]);

  async function handleCopy() {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Textarea */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <Textarea
            placeholder="Paste or type your post here..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            className="resize-y font-mono text-sm leading-relaxed"
          />

          {/* Quick stats + actions */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-4 text-sm text-muted-foreground">
              <span>
                <strong className="text-foreground">{charCount}</strong> chars
              </span>
              <span>
                <strong className="text-foreground">{wordCount}</strong> words
              </span>
              <span>
                <strong className="text-foreground">{lineCount}</strong> lines
              </span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleCopy} disabled={!text}>
                {copied ? (
                  <>
                    <Check className="mr-1.5 h-3.5 w-3.5 text-green-600" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="mr-1.5 h-3.5 w-3.5" />
                    Copy
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setText("")}
                disabled={!text}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Clear
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Platform limits grid */}
      <div className="grid gap-3 sm:grid-cols-2">
        {platformStatus.map(({ key, label, limit, over, usage, comfortable }) => (
          <Card
            key={key}
            className={cn(
              "transition-all",
              over && "border-destructive/60 bg-destructive/5"
            )}
          >
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{label}</span>
                  {comfortable && charCount > 0 && (
                    <Badge
                      variant="secondary"
                      className="text-xs bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400"
                    >
                      Perfect
                    </Badge>
                  )}
                  {over && (
                    <Badge variant="destructive" className="text-xs">
                      Over limit
                    </Badge>
                  )}
                </div>
                <span
                  className={cn(
                    "text-sm font-mono font-semibold tabular-nums",
                    over ? "text-destructive" : "text-muted-foreground"
                  )}
                >
                  {charCount}/{limit.toLocaleString()}
                </span>
              </div>

              {/* Progress bar */}
              <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-300",
                    over
                      ? "bg-destructive"
                      : usage > 85
                        ? "bg-orange-400"
                        : "bg-primary"
                  )}
                  style={{ width: `${usage}%` }}
                />
              </div>

              {over && (
                <p className="mt-1.5 text-xs text-destructive">
                  {charCount - limit} character{charCount - limit !== 1 ? "s" : ""} over
                  the limit
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tip */}
      {charCount === 0 && (
        <p className="text-center text-sm text-muted-foreground">
          Start typing above to see real-time character counts for all major platforms.
        </p>
      )}
    </div>
  );
}
