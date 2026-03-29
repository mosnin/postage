"use client";

import { useState } from "react";
import { Sparkles, Wand2, Hash } from "lucide-react";
import { AiCreditsDisplay } from "@/components/ai/ai-credits-display";
import { AiCaptionGenerator } from "@/components/ai/ai-caption-generator";
import { AiHashtagGenerator } from "@/components/ai/ai-hashtag-generator";
import { AiContentAgent } from "@/components/ai/ai-content-agent";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

type TabId = "captions" | "hashtags" | "content-agent";

const TABS: { id: TabId; label: string; icon: React.ElementType; description: string }[] = [
  {
    id: "captions",
    label: "Caption",
    icon: Wand2,
    description: "Generate engaging captions optimized for each platform.",
  },
  {
    id: "hashtags",
    label: "Hashtags",
    icon: Hash,
    description: "Discover high-performing hashtags for your niche.",
  },
  {
    id: "content-agent",
    label: "Content Agent",
    icon: Sparkles,
    description:
      "Turn any URL or text into a full batch of platform-ready posts.",
  },
];

interface AiStudioClientProps {
  workspaceId: string;
  aiCreditsUsed: number;
  aiCreditsLimit: number;
  aiCreditsResetAt: string;
}

export function AiStudioClient({
  workspaceId,
  aiCreditsUsed,
  aiCreditsLimit,
  aiCreditsResetAt,
}: AiStudioClientProps) {
  const [activeTab, setActiveTab] = useState<TabId>("captions");
  const { toast } = useToast();

  function handleUseInPost(caption: string) {
    // Copy to clipboard and show toast — in a full implementation this would
    // open the composer with the content pre-filled via a router push or modal.
    navigator.clipboard.writeText(caption).catch(() => {});
    toast({
      title: "Caption copied",
      description: "Open the Compose tab and paste it in.",
    });
  }

  function handleSendToComposer(platform: string, content: string) {
    navigator.clipboard.writeText(content).catch(() => {});
    toast({
      title: `${platform} post copied`,
      description: "Open the Compose tab and paste it in.",
    });
  }

  const activeTabMeta = TABS.find((t) => t.id === activeTab)!;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Page header */}
      <div className="flex items-start justify-between px-6 py-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">AI Studio</h1>
            <p className="text-sm text-muted-foreground">
              Generate captions, hashtags, and social content with AI
            </p>
          </div>
        </div>
        <AiCreditsDisplay
          used={aiCreditsUsed}
          limit={aiCreditsLimit}
          resetAt={aiCreditsResetAt}
        />
      </div>

      {/* Tab bar */}
      <div className="border-b px-6">
        <nav className="flex gap-0 -mb-px">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-6 py-6 space-y-6">
          {/* Active tab description */}
          <p className="text-sm text-muted-foreground">
            {activeTabMeta.description}
          </p>

          {activeTab === "captions" && (
            <AiCaptionGenerator
              workspaceId={workspaceId}
              onUseInPost={handleUseInPost}
            />
          )}

          {activeTab === "hashtags" && (
            <AiHashtagGenerator workspaceId={workspaceId} />
          )}

          {activeTab === "content-agent" && (
            <AiContentAgent
              workspaceId={workspaceId}
              onSendToComposer={handleSendToComposer}
            />
          )}
        </div>
      </div>
    </div>
  );
}
