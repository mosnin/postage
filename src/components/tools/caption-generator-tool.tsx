"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { Copy, RefreshCw, Sparkles, Check, ArrowRight } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Tone = "Professional" | "Casual" | "Funny" | "Educational" | "Inspiring";
type Length = "Short" | "Medium" | "Long";

interface CaptionGeneratorToolProps {
  platform: string;
  platformLabel: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CaptionGeneratorTool({
  platform,
  platformLabel,
}: CaptionGeneratorToolProps) {
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState<Tone>("Casual");
  const [length, setLength] = useState<Length>("Medium");
  const [includeHashtags, setIncludeHashtags] = useState(false);
  const [includeEmoji, setIncludeEmoji] = useState(true);

  const [captions, setCaptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateLimited, setRateLimited] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const tones: Tone[] = ["Professional", "Casual", "Funny", "Educational", "Inspiring"];
  const lengths: Length[] = ["Short", "Medium", "Long"];

  async function handleGenerate() {
    if (!topic.trim()) return;
    setLoading(true);
    setError(null);
    setRateLimited(false);
    setCaptions([]);

    try {
      const res = await fetch("/api/tools/generate-caption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic.trim(),
          platform: platform.toUpperCase(),
          tone,
          length,
          includeHashtags,
          includeEmoji,
        }),
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

      setCaptions(data.captions ?? []);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy(text: string, index: number) {
    await navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* Input Form */}
      <Card>
        <CardContent className="pt-6 space-y-6">
          {/* Topic */}
          <div className="space-y-2">
            <Label htmlFor="topic" className="text-sm font-medium">
              What&apos;s your post about?
            </Label>
            <Textarea
              id="topic"
              placeholder={`e.g. "Launching our new summer collection of eco-friendly yoga wear"`}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              rows={3}
              className="resize-none"
              maxLength={1000}
            />
            <p className="text-xs text-muted-foreground text-right">
              {topic.length}/1000
            </p>
          </div>

          {/* Tone */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Tone</Label>
            <div className="flex flex-wrap gap-2">
              {tones.map((t) => (
                <button
                  key={t}
                  onClick={() => setTone(t)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
                    tone === t
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Length */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Length</Label>
            <div className="flex gap-2">
              {lengths.map((l) => (
                <button
                  key={l}
                  onClick={() => setLength(l)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
                    length === l
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  )}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Toggles */}
          <div className="flex flex-col gap-3 sm:flex-row sm:gap-6">
            <div className="flex items-center gap-2">
              <Switch
                id="hashtags"
                checked={includeHashtags}
                onCheckedChange={setIncludeHashtags}
              />
              <Label htmlFor="hashtags" className="cursor-pointer text-sm">
                Include hashtags
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="emoji"
                checked={includeEmoji}
                onCheckedChange={setIncludeEmoji}
              />
              <Label htmlFor="emoji" className="cursor-pointer text-sm">
                Include emoji
              </Label>
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
                Generating captions...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate {platformLabel} Captions
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Rate Limit Message */}
      {rateLimited && (
        <Card className="border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/30">
          <CardContent className="pt-6 text-center space-y-3">
            <p className="font-semibold text-orange-800 dark:text-orange-200">
              Rate limit reached
            </p>
            <p className="text-sm text-orange-700 dark:text-orange-300">
              You&apos;ve used your 5 free generations this hour. Sign up for unlimited
              captions.
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

      {/* Error Message */}
      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Output Captions */}
      {captions.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Generated Captions</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerate}
              disabled={loading}
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Regenerate
            </Button>
          </div>

          {captions.map((caption, index) => (
            <Card key={index} className="group relative">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <Badge variant="secondary" className="mb-2 text-xs">
                      Caption {index + 1}
                    </Badge>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">
                      {caption}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {caption.length} characters
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy(caption, index)}
                    className="shrink-0"
                  >
                    {copiedIndex === index ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-green-600" />
                        <span className="ml-1.5 text-green-600">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span className="ml-1.5">Copy</span>
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* CTA */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-6 pb-6">
              <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:text-left sm:justify-between">
                <div>
                  <p className="font-semibold">Want unlimited captions?</p>
                  <p className="text-sm text-muted-foreground">
                    Sign up free — no credit card required. Get 1,000 AI credits/month.
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
