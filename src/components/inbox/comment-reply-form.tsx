"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Send, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PLATFORM_CHAR_LIMITS } from "@/lib/utils";

interface CommentReplyFormProps {
  commentId: string;
  platform: string;
  isPro: boolean;
  onCancel: () => void;
  onSent: () => void;
}

async function postReply(commentId: string, content: string) {
  const res = await fetch(`/api/inbox/${commentId}/reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Failed to send reply");
  }
  return res.json();
}

async function fetchAiSuggestion(commentId: string): Promise<string> {
  const res = await fetch(`/api/ai/suggest-reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ commentId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "AI suggestion failed");
  }
  const data = await res.json();
  return data.suggestion ?? "";
}

export function CommentReplyForm({
  commentId,
  platform,
  isPro,
  onCancel,
  onSent,
}: CommentReplyFormProps) {
  const [content, setContent] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const queryClient = useQueryClient();

  const charLimit = PLATFORM_CHAR_LIMITS[platform] ?? 2200;
  const remaining = charLimit - content.length;
  const isOverLimit = remaining < 0;

  const { mutate: sendReply, isPending } = useMutation({
    mutationFn: () => postReply(commentId, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inbox"] });
      onSent();
    },
  });

  async function handleAiSuggest() {
    if (!isPro) return;
    setAiLoading(true);
    try {
      const suggestion = await fetchAiSuggestion(commentId);
      setContent(suggestion);
    } catch {
      // silently fail — user can type manually
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="mt-3 pt-3 border-t space-y-2">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Write a reply…"
        rows={3}
        className={cn(
          "w-full resize-none rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring",
          isOverLimit && "border-destructive focus:ring-destructive"
        )}
      />
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {isPro ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAiSuggest}
              disabled={aiLoading || isPending}
              className="gap-1.5 text-xs h-8"
            >
              {aiLoading ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Sparkles className="size-3 text-purple-500" />
              )}
              AI Suggest Reply
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled
              className="gap-1.5 text-xs h-8 opacity-50 cursor-not-allowed"
              title="Upgrade to Pro or Pro Plus to use AI reply suggestions"
            >
              <Sparkles className="size-3 text-purple-500" />
              AI Suggest Reply
              <span className="ml-1 text-[10px] bg-purple-100 text-purple-700 rounded px-1">
                Pro+
              </span>
            </Button>
          )}
          <span
            className={cn(
              "text-xs",
              remaining < 20 ? "text-destructive" : "text-muted-foreground"
            )}
          >
            {remaining}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={isPending}
            className="h-8 text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => sendReply()}
            disabled={isPending || !content.trim() || isOverLimit}
            className="h-8 gap-1.5 text-xs"
          >
            {isPending ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Send className="size-3" />
            )}
            Send Reply
          </Button>
        </div>
      </div>
    </div>
  );
}
