"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  Upload,
  Download,
  CheckCircle,
  AlertCircle,
  XCircle,
  ChevronRight,
  Loader2,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { parseCSV, generateBulkTemplate } from "@/lib/csv";
import { useToast } from "@/components/ui/use-toast";
import { format, parseISO, isValid } from "date-fns";

const PLATFORM_CHAR_LIMITS: Record<string, number> = {
  TWITTER: 280,
  FACEBOOK: 63206,
  INSTAGRAM: 2200,
  TIKTOK: 2200,
  YOUTUBE: 5000,
  PINTEREST: 500,
  THREADS: 500,
  TELEGRAM: 4096,
  LINKEDIN: 3000,
  BLUESKY: 300,
  MASTODON: 500,
};

const VALID_PLATFORMS = new Set([
  "TWITTER",
  "FACEBOOK",
  "INSTAGRAM",
  "TIKTOK",
  "YOUTUBE",
  "PINTEREST",
  "THREADS",
  "TELEGRAM",
  "LINKEDIN",
  "BLUESKY",
  "MASTODON",
]);

type RowStatus = "valid" | "warning" | "error";

interface RowValidation {
  status: RowStatus;
  warnings: string[];
  errors: string[];
}

interface ParsedRow {
  index: number;
  platforms: string;
  scheduled_at: string;
  content: string;
  media_url: string;
  first_comment: string;
  labels: string;
  validation: RowValidation;
}

function validateRow(row: Record<string, string>, connectedPlatforms: string[]): RowValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  const rawPlatforms = row.platforms ?? "";
  if (!rawPlatforms.trim()) {
    errors.push("Platforms field is required");
  } else {
    const platformList = rawPlatforms
      .split(";")
      .map((p) => p.trim().toUpperCase())
      .filter(Boolean);

    for (const p of platformList) {
      if (!VALID_PLATFORMS.has(p)) {
        errors.push(`Platform '${p}' not recognized`);
      } else if (!connectedPlatforms.includes(p)) {
        warnings.push(`Platform '${p}' is not connected`);
      }
    }

    const content = row.content ?? "";
    for (const p of platformList) {
      const limit = PLATFORM_CHAR_LIMITS[p];
      if (limit && content.length > limit) {
        warnings.push(`Content exceeds ${p} limit (${content.length}/${limit} chars)`);
      }
    }
  }

  const rawDate = row.scheduled_at ?? "";
  if (!rawDate.trim()) {
    errors.push("scheduled_at is required");
  } else {
    const parsed = parseISO(rawDate);
    if (!isValid(parsed)) {
      errors.push(`Invalid date format: '${rawDate}'`);
    } else if (parsed < new Date()) {
      warnings.push("Scheduled time is in the past");
    }
  }

  if (!(row.content ?? "").trim()) {
    errors.push("content is required");
  }

  const status: RowStatus =
    errors.length > 0 ? "error" : warnings.length > 0 ? "warning" : "valid";

  return { status, warnings, errors };
}

type Step = "upload" | "preview" | "processing" | "done";

interface BulkSchedulerProps {
  workspaceId: string;
  connectedPlatforms: string[];
}

export function BulkScheduler({
  workspaceId,
  connectedPlatforms,
}: BulkSchedulerProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("upload");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [skipErrors, setSkipErrors] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [doneStats, setDoneStats] = useState<{
    created: number;
    skipped: number;
  } | null>(null);

  // Summary counts
  const validCount = rows.filter((r) => r.validation.status === "valid").length;
  const warningCount = rows.filter((r) => r.validation.status === "warning").length;
  const errorCount = rows.filter((r) => r.validation.status === "error").length;

  const schedulablePosts = rows.filter(
    (r) =>
      r.validation.status === "valid" ||
      (skipErrors && r.validation.status === "warning")
  );

  function handleDownloadTemplate() {
    const csv = generateBulkTemplate();
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "postsyncer-bulk-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function processFile(file: File) {
    const text = await file.text();
    const parsed = parseCSV(text);

    if (parsed.length === 0) {
      toast({ title: "No data found in file", variant: "destructive" });
      return;
    }

    if (parsed.length > 200) {
      toast({
        title: "Too many rows",
        description: "Maximum 200 rows per upload. Please split your file.",
        variant: "destructive",
      });
      return;
    }

    const parsedRows: ParsedRow[] = parsed.map((row, index) => ({
      index,
      platforms: row.platforms ?? "",
      scheduled_at: row.scheduled_at ?? "",
      content: row.content ?? "",
      media_url: row.media_url ?? "",
      first_comment: row.first_comment ?? "",
      labels: row.labels ?? "",
      validation: validateRow(row, connectedPlatforms),
    }));

    setRows(parsedRows);
    setStep("preview");
  }

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;
      await processFile(file);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [connectedPlatforms]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/csv": [".csv"], "application/vnd.ms-excel": [".xls", ".xlsx"] },
    maxFiles: 1,
    multiple: false,
  });

  const scheduleMutation = useMutation({
    mutationFn: async () => {
      const validRows = schedulablePosts.map((r) => ({
        platforms: r.platforms,
        scheduled_at: r.scheduled_at,
        content: r.content,
        media_url: r.media_url || undefined,
        first_comment: r.first_comment || undefined,
        labels: r.labels || undefined,
      }));

      setProgressTotal(validRows.length);
      setProgress(0);
      setStep("processing");

      // Simulate progress (real progress would need server-sent events)
      const interval = setInterval(() => {
        setProgress((p) => Math.min(p + Math.floor(Math.random() * 5) + 1, validRows.length - 1));
      }, 150);

      try {
        const res = await fetch("/api/posts/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId,
            rows: validRows,
            skipErrors,
          }),
        });

        clearInterval(interval);

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error ?? "Failed to schedule posts");
        }

        const result = await res.json();
        setProgress(validRows.length);
        return result;
      } catch (err) {
        clearInterval(interval);
        throw err;
      }
    },
    onSuccess: (data) => {
      setDoneStats({ created: data.created, skipped: data.skipped });
      setStep("done");
    },
    onError: (error) => {
      setStep("preview");
      toast({
        title: "Scheduling failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  // ─── STEP: UPLOAD ───────────────────────────────────────────────────────────

  if (step === "upload") {
    return (
      <div className="max-w-2xl mx-auto py-10 px-4 space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Bulk Schedule Posts</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Upload a CSV file with up to 200 posts to schedule them all at once.
          </p>
        </div>

        <div
          {...getRootProps()}
          className={cn(
            "border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors",
            isDragActive
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/30 hover:border-primary hover:bg-muted/30"
          )}
        >
          <input {...getInputProps()} />
          <Upload
            className={cn(
              "h-10 w-10 transition-colors",
              isDragActive ? "text-primary" : "text-muted-foreground/50"
            )}
          />
          <div className="text-center">
            <p className="text-sm font-medium">
              {isDragActive ? "Drop your file here" : "Drop your CSV here, or click to browse"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Supports .csv, .xls, .xlsx — max 200 rows
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3">
          <div className="flex items-center gap-2 text-sm">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span>Download CSV template to get started</span>
          </div>
          <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
            <Download className="h-4 w-4 mr-1.5" />
            Template
          </Button>
        </div>

        <div className="rounded-lg border bg-muted/10 px-4 py-3 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground text-sm">CSV columns</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li><code>platforms</code> — semicolon-separated (e.g. TWITTER;LINKEDIN)</li>
            <li><code>scheduled_at</code> — ISO 8601 datetime (e.g. 2025-06-15T09:00:00Z)</li>
            <li><code>content</code> — post text</li>
            <li><code>media_url</code> — optional image/video URL</li>
            <li><code>first_comment</code> — optional first comment text</li>
            <li><code>labels</code> — optional semicolon-separated labels</li>
          </ul>
        </div>
      </div>
    );
  }

  // ─── STEP: PREVIEW ──────────────────────────────────────────────────────────

  if (step === "preview") {
    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">Preview &amp; Validate</h2>
            <p className="text-sm text-muted-foreground">
              Review your posts before scheduling
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setStep("upload"); setRows([]); }}
            >
              Upload different file
            </Button>
            <Button
              size="sm"
              disabled={schedulablePosts.length === 0}
              onClick={() => scheduleMutation.mutate()}
              className="gap-2"
            >
              Schedule {schedulablePosts.length} Post{schedulablePosts.length !== 1 ? "s" : ""}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Summary bar */}
        <div className="px-6 py-2 bg-muted/30 border-b flex items-center gap-4 text-sm flex-wrap">
          <span className="flex items-center gap-1.5 text-green-600">
            <CheckCircle className="h-4 w-4" />
            {validCount} valid
          </span>
          {warningCount > 0 && (
            <span className="flex items-center gap-1.5 text-amber-600">
              <AlertCircle className="h-4 w-4" />
              {warningCount} warning{warningCount !== 1 ? "s" : ""}
            </span>
          )}
          {errorCount > 0 && (
            <span className="flex items-center gap-1.5 text-destructive">
              <XCircle className="h-4 w-4" />
              {errorCount} error{errorCount !== 1 ? "s" : ""}
            </span>
          )}

          {errorCount > 0 && (
            <div className="flex items-center gap-2 ml-auto">
              <Switch
                id="skip-errors"
                checked={skipErrors}
                onCheckedChange={setSkipErrors}
              />
              <Label htmlFor="skip-errors" className="text-sm cursor-pointer">
                Skip rows with errors
              </Label>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background border-b">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground w-10">#</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Platforms</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground w-44">Date / Time</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Content</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground w-16">Media</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground w-24">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const parsedDate = row.scheduled_at ? parseISO(row.scheduled_at) : null;
                const dateDisplay =
                  parsedDate && isValid(parsedDate)
                    ? format(parsedDate, "MMM d, yyyy h:mm a")
                    : row.scheduled_at || "—";

                const { status, warnings, errors } = row.validation;

                return (
                  <tr
                    key={row.index}
                    className={cn(
                      "border-b hover:bg-muted/20 transition-colors",
                      status === "error" && "bg-destructive/5",
                      status === "warning" && "bg-amber-50/50 dark:bg-amber-950/20"
                    )}
                  >
                    <td className="px-4 py-2 text-muted-foreground">{row.index + 1}</td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-1">
                        {row.platforms
                          ? row.platforms
                              .split(";")
                              .map((p) => p.trim())
                              .filter(Boolean)
                              .map((p) => (
                                <Badge key={p} variant="secondary" className="text-xs">
                                  {p}
                                </Badge>
                              ))
                          : <span className="text-muted-foreground">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">
                      {dateDisplay}
                    </td>
                    <td className="px-4 py-2 max-w-xs">
                      <p className="truncate text-foreground">{row.content || "—"}</p>
                    </td>
                    <td className="px-4 py-2">
                      {row.media_url ? (
                        <span className="text-xs text-blue-600 underline truncate max-w-[60px] inline-block">
                          Link
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {status === "valid" && (
                        <span className="inline-flex items-center gap-1 text-green-600 text-xs font-medium">
                          <CheckCircle className="h-3.5 w-3.5" />
                          Valid
                        </span>
                      )}
                      {status === "warning" && (
                        <div className="space-y-0.5">
                          <span className="inline-flex items-center gap-1 text-amber-600 text-xs font-medium">
                            <AlertCircle className="h-3.5 w-3.5" />
                            Warning
                          </span>
                          {warnings.map((w, i) => (
                            <p key={i} className="text-xs text-amber-600 leading-tight">
                              {w}
                            </p>
                          ))}
                        </div>
                      )}
                      {status === "error" && (
                        <div className="space-y-0.5">
                          <span className="inline-flex items-center gap-1 text-destructive text-xs font-medium">
                            <XCircle className="h-3.5 w-3.5" />
                            Error
                          </span>
                          {errors.map((e, i) => (
                            <p key={i} className="text-xs text-destructive leading-tight">
                              {e}
                            </p>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ─── STEP: PROCESSING ───────────────────────────────────────────────────────

  if (step === "processing") {
    const pct = progressTotal > 0 ? Math.round((progress / progressTotal) * 100) : 0;
    return (
      <div className="max-w-md mx-auto py-20 px-4 space-y-6 text-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
        <div>
          <h2 className="text-lg font-semibold">Scheduling your posts…</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {progress} of {progressTotal} posts scheduled
          </p>
        </div>
        <div className="w-full bg-muted rounded-full h-2">
          <div
            className="bg-primary h-2 rounded-full transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">{pct}% complete</p>
      </div>
    );
  }

  // ─── STEP: DONE ─────────────────────────────────────────────────────────────

  return (
    <div className="max-w-md mx-auto py-20 px-4 space-y-6 text-center">
      <CheckCircle className="h-14 w-14 text-green-500 mx-auto" />
      <div>
        <h2 className="text-xl font-semibold">Posts Scheduled!</h2>
        <p className="text-sm text-muted-foreground mt-2">
          {doneStats?.created ?? 0} post{(doneStats?.created ?? 0) !== 1 ? "s" : ""} scheduled successfully
          {(doneStats?.skipped ?? 0) > 0 && `, ${doneStats?.skipped} skipped`}.
        </p>
      </div>
      <div className="flex flex-col gap-2 items-center">
        <Button onClick={() => router.push("/calendar")} className="gap-2">
          View in Calendar
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          onClick={() => { setStep("upload"); setRows([]); setDoneStats(null); }}
        >
          Schedule more posts
        </Button>
      </div>
    </div>
  );
}
