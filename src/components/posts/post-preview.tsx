"use client";

import { SocialAccount } from "@/types";
import { PLATFORM_LABELS, PLATFORM_COLORS, PLATFORM_CHAR_LIMITS, cn, truncate } from "@/lib/utils";
import { Heart, MessageCircle, Repeat2, Share2, ThumbsUp, Bookmark } from "lucide-react";

interface MediaItem {
  id: string;
  url: string;
  type: "image" | "video";
  name: string;
}

interface PostPreviewProps {
  accounts: SocialAccount[];
  selectedAccountIds: string[];
  content: string;
  media: MediaItem[];
  activeTab: string;
  onTabChange: (platform: string) => void;
}

function PlatformBadge({ platform, size = 14 }: { platform: string; size?: number }) {
  const color = PLATFORM_COLORS[platform] ?? "#888";
  return (
    <span
      className="inline-flex items-center justify-center rounded-full font-bold text-white flex-shrink-0"
      style={{
        width: size,
        height: size,
        background: color,
        fontSize: Math.max(6, size * 0.45),
        lineHeight: 1,
      }}
    >
      {platform.charAt(0)}
    </span>
  );
}

function TwitterPreview({ account, content, media }: {
  account: SocialAccount;
  content: string;
  media: MediaItem[];
}) {
  const limit = PLATFORM_CHAR_LIMITS["TWITTER"] ?? 280;
  const display = truncate(content, limit);

  return (
    <div className="rounded-xl border bg-background p-4 space-y-3 font-sans">
      <div className="flex gap-3">
        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
          {account.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={account.avatarUrl} alt={account.displayName} className="w-full h-full object-cover" />
          ) : (
            <span className="text-sm font-bold text-muted-foreground">
              {account.displayName.charAt(0)}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="font-bold text-sm truncate">{account.displayName}</span>
            <span className="text-muted-foreground text-sm">@{account.username}</span>
          </div>
          <p className="text-sm whitespace-pre-wrap mt-1 leading-relaxed">
            {display || <span className="text-muted-foreground italic">Your post will appear here…</span>}
          </p>
          {media.length > 0 && (
            <div className={cn("mt-2 grid gap-1 rounded-xl overflow-hidden", media.length === 1 ? "grid-cols-1" : "grid-cols-2")}>
              {media.slice(0, 4).map((m) => (
                <div key={m.id} className="aspect-video bg-muted flex items-center justify-center rounded overflow-hidden">
                  {m.type === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.url} alt={m.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs text-muted-foreground">Video</span>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-5 mt-3 text-muted-foreground">
            <span className="flex items-center gap-1 text-xs hover:text-blue-400 cursor-default"><MessageCircle className="w-3.5 h-3.5" /> 0</span>
            <span className="flex items-center gap-1 text-xs hover:text-green-400 cursor-default"><Repeat2 className="w-3.5 h-3.5" /> 0</span>
            <span className="flex items-center gap-1 text-xs hover:text-pink-400 cursor-default"><Heart className="w-3.5 h-3.5" /> 0</span>
            <span className="flex items-center gap-1 text-xs hover:text-blue-400 cursor-default"><Bookmark className="w-3.5 h-3.5" /> 0</span>
            <span className="flex items-center gap-1 text-xs hover:text-blue-400 cursor-default"><Share2 className="w-3.5 h-3.5" /></span>
          </div>
        </div>
      </div>
    </div>
  );
}

function LinkedInPreview({ account, content, media }: {
  account: SocialAccount;
  content: string;
  media: MediaItem[];
}) {
  const limit = PLATFORM_CHAR_LIMITS["LINKEDIN"] ?? 3000;
  const display = truncate(content, limit);

  return (
    <div className="rounded-lg border bg-background p-4 space-y-3 font-sans">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
          {account.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={account.avatarUrl} alt={account.displayName} className="w-full h-full object-cover" />
          ) : (
            <span className="text-base font-bold text-muted-foreground">
              {account.displayName.charAt(0)}
            </span>
          )}
        </div>
        <div>
          <p className="font-semibold text-sm">{account.displayName}</p>
          <p className="text-xs text-muted-foreground">@{account.username} · Just now</p>
        </div>
      </div>
      <p className="text-sm whitespace-pre-wrap leading-relaxed">
        {display || <span className="text-muted-foreground italic">Your post will appear here…</span>}
      </p>
      {media.length > 0 && (
        <div className="rounded-lg overflow-hidden bg-muted aspect-video flex items-center justify-center">
          {media[0].type === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={media[0].url} alt={media[0].name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-xs text-muted-foreground">Video preview</span>
          )}
        </div>
      )}
      <div className="flex items-center gap-4 pt-2 border-t text-muted-foreground">
        <span className="flex items-center gap-1 text-xs cursor-default hover:text-blue-600"><ThumbsUp className="w-3.5 h-3.5" /> Like</span>
        <span className="flex items-center gap-1 text-xs cursor-default hover:text-blue-600"><MessageCircle className="w-3.5 h-3.5" /> Comment</span>
        <span className="flex items-center gap-1 text-xs cursor-default hover:text-blue-600"><Repeat2 className="w-3.5 h-3.5" /> Repost</span>
        <span className="flex items-center gap-1 text-xs cursor-default hover:text-blue-600"><Share2 className="w-3.5 h-3.5" /> Send</span>
      </div>
    </div>
  );
}

function InstagramPreview({ account, content, media }: {
  account: SocialAccount;
  content: string;
  media: MediaItem[];
}) {
  const limit = PLATFORM_CHAR_LIMITS["INSTAGRAM"] ?? 2200;
  const display = truncate(content, limit);

  return (
    <div className="rounded-lg border bg-background overflow-hidden font-sans">
      <div className="flex items-center gap-2 p-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 p-0.5 flex-shrink-0">
          <div className="w-full h-full rounded-full bg-background flex items-center justify-center overflow-hidden">
            {account.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={account.avatarUrl} alt={account.displayName} className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs font-bold text-muted-foreground">
                {account.displayName.charAt(0)}
              </span>
            )}
          </div>
        </div>
        <span className="font-semibold text-sm">{account.username}</span>
      </div>
      <div className="aspect-square bg-muted flex items-center justify-center">
        {media.length > 0 && media[0].type === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={media[0].url} alt={media[0].name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-xs text-muted-foreground">
            {media.length > 0 ? "Video" : "No media"}
          </span>
        )}
      </div>
      <div className="p-3 space-y-2">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Heart className="w-5 h-5 cursor-default" />
          <MessageCircle className="w-5 h-5 cursor-default" />
          <Share2 className="w-5 h-5 cursor-default" />
          <Bookmark className="w-5 h-5 ml-auto cursor-default" />
        </div>
        <p className="text-xs font-semibold">0 likes</p>
        {display && (
          <p className="text-xs leading-relaxed">
            <span className="font-semibold">{account.username}</span>{" "}
            {display}
          </p>
        )}
        {!display && (
          <p className="text-xs text-muted-foreground italic">Your caption will appear here…</p>
        )}
      </div>
    </div>
  );
}

function GenericPreview({ account, content, media, platform }: {
  account: SocialAccount;
  content: string;
  media: MediaItem[];
  platform: string;
}) {
  const limit = PLATFORM_CHAR_LIMITS[platform] ?? 500;
  const display = truncate(content, limit);

  return (
    <div className="rounded-lg border bg-background p-4 space-y-3 font-sans">
      <div className="flex items-center gap-3">
        <div className="relative w-10 h-10 flex-shrink-0">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden">
            {account.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={account.avatarUrl} alt={account.displayName} className="w-full h-full object-cover" />
            ) : (
              <span className="text-sm font-bold text-muted-foreground">
                {account.displayName.charAt(0)}
              </span>
            )}
          </div>
          <span
            className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-white font-bold"
            style={{ background: PLATFORM_COLORS[platform] ?? "#888", fontSize: 7 }}
          >
            {platform.charAt(0)}
          </span>
        </div>
        <div>
          <p className="font-semibold text-sm">{account.displayName}</p>
          <p className="text-xs text-muted-foreground">{PLATFORM_LABELS[platform] ?? platform} · Just now</p>
        </div>
      </div>
      <p className="text-sm whitespace-pre-wrap leading-relaxed">
        {display || <span className="text-muted-foreground italic">Your post will appear here…</span>}
      </p>
      {media.length > 0 && (
        <div className="rounded-lg overflow-hidden bg-muted aspect-video flex items-center justify-center">
          {media[0].type === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={media[0].url} alt={media[0].name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-xs text-muted-foreground">Video preview</span>
          )}
        </div>
      )}
      <div className="flex items-center gap-4 pt-2 border-t text-muted-foreground">
        <span className="flex items-center gap-1 text-xs cursor-default"><Heart className="w-3.5 h-3.5" /> 0</span>
        <span className="flex items-center gap-1 text-xs cursor-default"><MessageCircle className="w-3.5 h-3.5" /> 0</span>
        <span className="flex items-center gap-1 text-xs cursor-default"><Share2 className="w-3.5 h-3.5" /> 0</span>
      </div>
    </div>
  );
}

export function PostPreview({
  accounts,
  selectedAccountIds,
  content,
  media,
  activeTab,
  onTabChange,
}: PostPreviewProps) {
  const selectedAccounts = accounts.filter((a) => selectedAccountIds.includes(a.id));

  // Deduplicate by platform for tabs
  const seenPlatforms = new Set<string>();
  const platformAccounts = selectedAccounts.filter((a) => {
    if (seenPlatforms.has(a.platform)) return false;
    seenPlatforms.add(a.platform);
    return true;
  });

  if (selectedAccounts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3 p-8">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
          <span className="text-2xl">📱</span>
        </div>
        <p className="text-sm text-center">
          Select accounts to see a live preview of your post
        </p>
      </div>
    );
  }

  const activeAccount =
    platformAccounts.find((a) => a.platform === activeTab) ?? platformAccounts[0];

  function renderPreview(account: SocialAccount) {
    switch (account.platform) {
      case "TWITTER":
        return <TwitterPreview account={account} content={content} media={media} />;
      case "LINKEDIN":
        return <LinkedInPreview account={account} content={content} media={media} />;
      case "INSTAGRAM":
        return <InstagramPreview account={account} content={content} media={media} />;
      default:
        return (
          <GenericPreview
            account={account}
            content={content}
            media={media}
            platform={account.platform}
          />
        );
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Platform tabs */}
      {platformAccounts.length > 1 && (
        <div className="flex flex-wrap gap-1 px-4 pt-3 pb-2 border-b">
          {platformAccounts.map((account) => (
            <button
              key={account.platform}
              type="button"
              onClick={() => onTabChange(account.platform)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors",
                activeTab === account.platform || (!activeTab && account === platformAccounts[0])
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              <PlatformBadge platform={account.platform} size={12} />
              {PLATFORM_LABELS[account.platform] ?? account.platform}
            </button>
          ))}
        </div>
      )}

      {/* Preview card */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeAccount && renderPreview(activeAccount)}
      </div>
    </div>
  );
}
