"use client";

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Copy, Check, ExternalLink, Trash2 } from "lucide-react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildUtmUrl(
  url: string,
  source: string,
  medium: string,
  name: string,
  term: string,
  content: string
): string {
  if (!url) return "";

  let base = url.trim();
  if (!/^https?:\/\//i.test(base)) {
    base = "https://" + base;
  }

  try {
    const parsed = new URL(base);
    if (source) parsed.searchParams.set("utm_source", source.trim());
    if (medium) parsed.searchParams.set("utm_medium", medium.trim());
    if (name) parsed.searchParams.set("utm_campaign", name.trim());
    if (term) parsed.searchParams.set("utm_term", term.trim());
    if (content) parsed.searchParams.set("utm_content", content.trim());
    return parsed.toString();
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const PRESETS = [
  { label: "Twitter/X organic", source: "twitter", medium: "social" },
  { label: "Instagram bio", source: "instagram", medium: "social" },
  { label: "LinkedIn post", source: "linkedin", medium: "social" },
  { label: "Newsletter", source: "newsletter", medium: "email" },
  { label: "Facebook post", source: "facebook", medium: "social" },
];

export function UtmBuilderTool() {
  const [url, setUrl] = useState("");
  const [source, setSource] = useState("");
  const [medium, setMedium] = useState("");
  const [name, setName] = useState("");
  const [term, setTerm] = useState("");
  const [content, setContent] = useState("");
  const [copied, setCopied] = useState(false);

  const utmUrl = useMemo(
    () => buildUtmUrl(url, source, medium, name, term, content),
    [url, source, medium, name, term, content]
  );

  const isValid = Boolean(utmUrl);

  async function handleCopy() {
    if (!utmUrl) return;
    await navigator.clipboard.writeText(utmUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function applyPreset(preset: (typeof PRESETS)[number]) {
    setSource(preset.source);
    setMedium(preset.medium);
  }

  function handleClear() {
    setUrl("");
    setSource("");
    setMedium("");
    setName("");
    setTerm("");
    setContent("");
  }

  const params = [
    { param: "utm_source", value: source, required: true },
    { param: "utm_medium", value: medium, required: true },
    { param: "utm_campaign", value: name, required: true },
    { param: "utm_term", value: term, required: false },
    { param: "utm_content", value: content, required: false },
  ].filter((p) => p.value.trim());

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Presets */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Quick presets</p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => applyPreset(p)}
              className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          {/* URL */}
          <div className="space-y-1.5">
            <Label htmlFor="url" className="text-sm font-medium">
              Website URL <span className="text-destructive">*</span>
            </Label>
            <Input
              id="url"
              placeholder="https://yourwebsite.com/landing-page"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              type="url"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Source */}
            <div className="space-y-1.5">
              <Label htmlFor="source" className="text-sm font-medium">
                Campaign Source <span className="text-destructive">*</span>
              </Label>
              <Input
                id="source"
                placeholder="e.g. twitter, newsletter"
                value={source}
                onChange={(e) => setSource(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                The referrer (utm_source)
              </p>
            </div>

            {/* Medium */}
            <div className="space-y-1.5">
              <Label htmlFor="medium" className="text-sm font-medium">
                Campaign Medium <span className="text-destructive">*</span>
              </Label>
              <Input
                id="medium"
                placeholder="e.g. social, email, cpc"
                value={medium}
                onChange={(e) => setMedium(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Marketing channel (utm_medium)
              </p>
            </div>

            {/* Campaign Name */}
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-sm font-medium">
                Campaign Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder="e.g. spring_sale, product_launch"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Campaign identifier (utm_campaign)
              </p>
            </div>

            {/* Term */}
            <div className="space-y-1.5">
              <Label htmlFor="term" className="text-sm font-medium">
                Campaign Term{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id="term"
                placeholder="e.g. running+shoes"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Paid keywords (utm_term)
              </p>
            </div>
          </div>

          {/* Content */}
          <div className="space-y-1.5">
            <Label htmlFor="content" className="text-sm font-medium">
              Campaign Content{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="content"
              placeholder="e.g. banner_ad, text_link, logolink"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Differentiate ads (utm_content)
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleClear}
              className="text-muted-foreground"
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Output */}
      {isValid && (
        <Card className="border-primary/20">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-semibold">Your UTM URL</h2>
              <div className="flex gap-2 shrink-0">
                <Button variant="outline" size="sm" asChild>
                  <a href={utmUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </Button>
                <Button size="sm" onClick={handleCopy}>
                  {copied ? (
                    <>
                      <Check className="mr-1.5 h-3.5 w-3.5 text-green-400" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="mr-1.5 h-3.5 w-3.5" />
                      Copy URL
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* URL display */}
            <div className="rounded-lg bg-muted p-3 font-mono text-xs break-all text-foreground leading-relaxed">
              {utmUrl}
            </div>

            {/* Parameter preview */}
            {params.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Parameters added
                </p>
                <div className="flex flex-wrap gap-2">
                  {params.map((p) => (
                    <div key={p.param} className="flex items-center gap-1">
                      <Badge variant="outline" className="font-mono text-xs">
                        {p.param}
                      </Badge>
                      <span className="text-xs text-muted-foreground">=</span>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-xs",
                          p.required ? "text-primary" : "text-muted-foreground"
                        )}
                      >
                        {p.value}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!url && (
        <p className="text-center text-sm text-muted-foreground">
          Enter your website URL and campaign details to build a trackable link.
        </p>
      )}
    </div>
  );
}
