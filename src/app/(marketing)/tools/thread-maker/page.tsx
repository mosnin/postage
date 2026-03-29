"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { Scissors, ArrowLeft, Copy, Check, ClipboardList } from "lucide-react";

// ---------------------------------------------------------------------------
// Types & Constants
// ---------------------------------------------------------------------------

type Platform = "twitter" | "bluesky";
type SplitStyle = "sentence" | "word";

const LIMITS: Record<Platform, number> = {
  twitter: 280,
  bluesky: 300,
};

// ---------------------------------------------------------------------------
// Thread splitter logic
// ---------------------------------------------------------------------------

function splitIntoThreads(
  text: string,
  limit: number,
  style: SplitStyle,
  numbered: boolean
): string[] {
  if (!text.trim()) return [];

  // Account for numbering overhead: " (1/N)" — worst case "N" is 2 digits
  // We estimate with a placeholder and adjust after
  const numberingOverhead = numbered ? 8 : 0; // " (XX/XX)" = 8 chars worst case
  const effectiveLimit = limit - numberingOverhead;

  const parts: string[] = [];

  if (style === "sentence") {
    // Split by sentence endings (. ! ?) followed by whitespace or end of string
    const sentences = text
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);

    let current = "";
    for (const sentence of sentences) {
      const candidate = current ? current + " " + sentence : sentence;
      if (candidate.length <= effectiveLimit) {
        current = candidate;
      } else {
        if (current) parts.push(current.trim());
        // If a single sentence exceeds the limit, break by words
        if (sentence.length > effectiveLimit) {
          const wordParts = breakByWords(sentence, effectiveLimit);
          parts.push(...wordParts.slice(0, -1));
          current = wordParts[wordParts.length - 1] ?? "";
        } else {
          current = sentence;
        }
      }
    }
    if (current.trim()) parts.push(current.trim());
  } else {
    // Word boundary split
    const wordParts = breakByWords(text, effectiveLimit);
    parts.push(...wordParts);
  }

  if (!numbered) return parts;

  // Add numbering
  const total = parts.length;
  return parts.map((part, i) => `${part} (${i + 1}/${total})`);
}

function breakByWords(text: string, limit: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const parts: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? current + " " + word : word;
    if (candidate.length <= limit) {
      current = candidate;
    } else {
      if (current) parts.push(current.trim());
      // Single word longer than limit — force it in alone
      if (word.length > limit) {
        parts.push(word.slice(0, limit));
        current = word.slice(limit);
      } else {
        current = word;
      }
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

// ---------------------------------------------------------------------------
// Page Component (client — needs useState)
// ---------------------------------------------------------------------------

export default function ThreadMakerPage() {
  const [text, setText] = useState("");
  const [platform, setPlatform] = useState<Platform>("twitter");
  const [splitStyle, setSplitStyle] = useState<SplitStyle>("sentence");
  const [numbered, setNumbered] = useState(true);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const limit = LIMITS[platform];
  const threads = useMemo(
    () => splitIntoThreads(text, limit, splitStyle, numbered),
    [text, limit, splitStyle, numbered]
  );

  async function handleCopyPart(content: string, index: number) {
    await navigator.clipboard.writeText(content);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  }

  async function handleCopyAll() {
    const allText = threads.join("\n\n---\n\n");
    await navigator.clipboard.writeText(allText);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  }

  return (
    <>
      {/* Header */}
      <section className="bg-muted/30 border-b px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="mb-4">
            <Button
              variant="ghost"
              size="sm"
              className="-ml-2 text-muted-foreground"
              asChild
            >
              <Link href="/tools">
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                All free tools
              </Link>
            </Button>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Scissors className="h-6 w-6 text-primary" />
            </div>
            <div>
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  Twitter Thread Maker
                </h1>
                <Badge variant="secondary">Free</Badge>
              </div>
              <p className="text-muted-foreground">
                Paste long text and automatically split it into a numbered Twitter or
                Bluesky thread. Each part stays within the platform character limit.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Tool */}
      <section className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl space-y-8">
          {/* Input */}
          <Card>
            <CardContent className="pt-6 space-y-6">
              {/* Platform selector */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Platform</Label>
                <div className="flex gap-2">
                  {(["twitter", "bluesky"] as Platform[]).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPlatform(p)}
                      className={cn(
                        "rounded-full border px-4 py-1.5 text-sm font-medium capitalize transition-colors",
                        platform === p
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
                      )}
                    >
                      {p === "twitter" ? "Twitter / X (280)" : "Bluesky (300)"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Split style */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Split style</Label>
                <div className="flex gap-2">
                  {(["sentence", "word"] as SplitStyle[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => setSplitStyle(s)}
                      className={cn(
                        "rounded-full border px-4 py-1.5 text-sm font-medium capitalize transition-colors",
                        splitStyle === s
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
                      )}
                    >
                      {s === "sentence" ? "Sentence boundary" : "Word boundary"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Number threads toggle */}
              <div className="flex items-center gap-2">
                <Switch
                  id="numbered"
                  checked={numbered}
                  onCheckedChange={setNumbered}
                />
                <Label htmlFor="numbered" className="cursor-pointer text-sm">
                  Number threads (e.g. 1/5, 2/5…)
                </Label>
              </div>

              {/* Textarea */}
              <div className="space-y-2">
                <Label htmlFor="thread-text" className="text-sm font-medium">
                  Your long-form content
                </Label>
                <Textarea
                  id="thread-text"
                  placeholder="Paste your long text here (up to 10,000 characters)…"
                  value={text}
                  onChange={(e) => setText(e.target.value.slice(0, 10000))}
                  rows={10}
                  className="resize-y font-mono text-sm leading-relaxed"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    {threads.length > 0 && (
                      <>
                        <strong className="text-foreground">{threads.length}</strong>{" "}
                        thread{threads.length !== 1 ? "s" : ""} &bull;{" "}
                        {platform === "twitter" ? "280" : "300"} char limit
                      </>
                    )}
                  </span>
                  <span>{text.length}/10,000</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Output */}
          {threads.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">
                  Thread Preview{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    ({threads.length} parts)
                  </span>
                </h2>
                <Button size="sm" onClick={handleCopyAll}>
                  {copiedAll ? (
                    <>
                      <Check className="mr-1.5 h-3.5 w-3.5 text-green-400" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <ClipboardList className="mr-1.5 h-3.5 w-3.5" />
                      Copy All
                    </>
                  )}
                </Button>
              </div>

              {threads.map((part, index) => {
                const isOver = part.length > limit;
                return (
                  <Card
                    key={index}
                    className={cn(isOver && "border-destructive/60 bg-destructive/5")}
                  >
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                            {part}
                          </p>
                          <p
                            className={cn(
                              "mt-1.5 text-xs",
                              isOver ? "text-destructive font-medium" : "text-muted-foreground"
                            )}
                          >
                            {part.length}/{limit} chars
                            {isOver && (
                              <span> — {part.length - limit} over limit</span>
                            )}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopyPart(part, index)}
                          className="shrink-0"
                        >
                          {copiedIndex === index ? (
                            <Check className="h-3.5 w-3.5 text-green-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </Button>
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
                      <p className="font-semibold">Schedule threads directly?</p>
                      <p className="text-sm text-muted-foreground">
                        PostSyncer lets you schedule Twitter threads with one click.
                      </p>
                    </div>
                    <Button asChild className="shrink-0">
                      <Link href="/register">
                        Try for free
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {!text && (
            <p className="text-center text-sm text-muted-foreground">
              Paste your long-form content above and the tool will automatically split
              it into thread-ready parts.
            </p>
          )}
        </div>
      </section>
    </>
  );
}
