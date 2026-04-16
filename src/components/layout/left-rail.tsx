"use client";

import { useState, useRef } from "react";
import { ChevronUp, ChevronDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/shared-primitives/user-avatar";
import { api } from "@/trpc/react";
import { StoryViewer } from "@/components/stories/story-viewer";
import { StoryCreate } from "@/components/stories/story-create";

export function LeftRail() {
  const [scrollPos, setScrollPos] = useState(0);
  const [activeStoryGroup, setActiveStoryGroup] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: session } = api.user.me.useQuery();
  const { data: storyFeed = [], isLoading } = api.story.getFeed.useQuery(
    undefined,
    { staleTime: 60_000 },
  );

  const ITEM_H = 80; // px per story avatar slot
  const visibleCount = 7;
  const maxScroll = Math.max(0, storyFeed.length - visibleCount);

  function scrollUp() {
    setScrollPos((p) => Math.max(0, p - 1));
  }
  function scrollDown() {
    setScrollPos((p) => Math.min(maxScroll, p + 1));
  }

  const visibleGroups = storyFeed.slice(scrollPos, scrollPos + visibleCount);

  return (
    <>
      <aside className="hidden md:flex flex-col items-center w-16 py-4 gap-1 border-r border-border bg-background fixed left-0 top-0 bottom-0 z-20">
        {/* Scroll up */}
        <button
          onClick={scrollUp}
          disabled={scrollPos === 0}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full transition-all",
            scrollPos === 0
              ? "text-muted-foreground/30 cursor-not-allowed"
              : "hover:bg-muted text-muted-foreground hover:text-foreground",
          )}
        >
          <ChevronUp className="h-4 w-4" />
        </button>

        {/* Create story button (own avatar with + badge) */}
        <div className="relative mb-1">
          <button
            onClick={() => setShowCreate(true)}
            className="group relative block"
            title="Add story"
          >
            <UserAvatar
              src={session?.avatarUrl}
              username={session?.name ?? "me"}
              size="md"
              className="ring-2 ring-border group-hover:ring-brand transition-all"
            />
            <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand border-2 border-background">
              <Plus className="h-2.5 w-2.5 text-brand-foreground" />
            </span>
          </button>
        </div>

        {/* Divider */}
        <div className="w-8 h-px bg-border my-1" />

        {/* Story avatars */}
        <div
          ref={containerRef}
          className="flex flex-col items-center gap-3 overflow-hidden flex-1"
          style={{ maxHeight: visibleCount * ITEM_H }}
        >
          {isLoading
            ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 w-10 rounded-full bg-muted animate-pulse" />
              ))
            : visibleGroups.map((group, i) => {
                const realIdx = scrollPos + i;
                const hasUnviewed = group.hasUnviewed;
                return (
                  <button
                    key={group.author.id}
                    onClick={() => setActiveStoryGroup(realIdx)}
                    className="relative flex flex-col items-center gap-1 group"
                    title={group.author.username}
                  >
                    <UserAvatar
                      src={group.author.avatarUrl}
                      username={group.author.username}
                      size="md"
                      hasStory
                      showStoryRing
                      className={cn(
                        "transition-transform group-hover:scale-110",
                        !hasUnviewed && "opacity-60",
                      )}
                    />
                    <span className="text-[9px] text-muted-foreground max-w-[52px] truncate leading-none">
                      {group.author.username}
                    </span>
                  </button>
                );
              })}
        </div>

        {/* Scroll down */}
        <button
          onClick={scrollDown}
          disabled={scrollPos >= maxScroll}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full transition-all",
            scrollPos >= maxScroll
              ? "text-muted-foreground/30 cursor-not-allowed"
              : "hover:bg-muted text-muted-foreground hover:text-foreground",
          )}
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </aside>

      {/* Story viewer modal */}
      {activeStoryGroup !== null && storyFeed[activeStoryGroup] && (
        <StoryViewer
          groups={storyFeed.map((group) => ({
            userId: group.author.id,
            user: {
              id: group.author.id,
              name: group.author.name,
              username: group.author.username,
              image: group.author.avatarUrl,
            },
            stories: group.stories.map((s) => ({
              id: s.id,
              mediaUrl: s.mediaUrl,
              mediaType: s.type,
              createdAt: s.createdAt,
              viewCount: s.viewCount,
              user: {
                id: group.author.id,
                name: group.author.name,
                username: group.author.username,
                image: group.author.avatarUrl,
              },
            })),
          }))}
          initialGroupIndex={activeStoryGroup}
          onClose={() => setActiveStoryGroup(null)}
        />
      )}

      {/* Story create modal */}
      {showCreate && <StoryCreate open={showCreate} onOpenChange={setShowCreate} showTrigger={false} />}
    </>
  );
}