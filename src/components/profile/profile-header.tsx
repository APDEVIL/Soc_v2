"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Settings,
  MoreHorizontal,
  UserPlus,
  UserMinus,
  MessageCircle,
  Flag,
  Ban,
  CheckCircle2,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/shared-primitives/user-avatar";
import { cn, formatCount } from "@/lib/utils";
import { api } from "@/trpc/react";
import { toast } from "sonner";

interface ProfileHeaderProps {
  userId: string;
  username: string;
  name: string;
  bio?: string | null;
  avatarUrl?: string | null;
  isVerified: boolean;
  isPrivate: boolean;
  followerCount: number;
  followingCount: number;
  postCount: number;
  isOwnProfile: boolean;
  isFollowing: boolean;
  isBlocked: boolean;
  hasActiveStory?: boolean;
}

export function ProfileHeader({
  userId,
  username,
  name,
  bio,
  avatarUrl,
  isVerified,
  isPrivate,
  followerCount,
  followingCount,
  postCount,
  isOwnProfile,
  isFollowing,
  isBlocked,
  hasActiveStory = false,
}: ProfileHeaderProps) {
  const router = useRouter();
  const utils = api.useUtils();
  const [optimisticFollowing, setOptimisticFollowing] = useState(isFollowing);
  const [optimisticFollowers, setOptimisticFollowers] = useState(followerCount);
  const [showFullBio, setShowFullBio] = useState(false);

  const follow = api.user.follow.useMutation({
    onMutate: () => {
      setOptimisticFollowing(true);
      setOptimisticFollowers((n) => n + 1);
    },
    onError: () => {
      setOptimisticFollowing(false);
      setOptimisticFollowers((n) => n - 1);
      toast.error("Failed to follow");
    },
    onSuccess: () => void utils.user.getProfile.invalidate({ username }),
  });

  const unfollow = api.user.unfollow.useMutation({
    onMutate: () => {
      setOptimisticFollowing(false);
      setOptimisticFollowers((n) => Math.max(0, n - 1));
    },
    onError: () => {
      setOptimisticFollowing(true);
      setOptimisticFollowers((n) => n + 1);
      toast.error("Failed to unfollow");
    },
    onSuccess: () => void utils.user.getProfile.invalidate({ username }),
  });

  const block = api.user.block.useMutation({
    onSuccess: () => {
      toast.success(`Blocked @${username}`);
      void utils.user.getProfile.invalidate({ username });
    },
    onError: () => toast.error("Failed to block user"),
  });

  const unblock = api.user.unblock.useMutation({
    onSuccess: () => {
      toast.success(`Unblocked @${username}`);
      void utils.user.getProfile.invalidate({ username });
    },
    onError: () => toast.error("Failed to unblock"),
  });

  function handleFollowToggle() {
    if (optimisticFollowing) {
      unfollow.mutate({ targetId: userId });
    } else {
      follow.mutate({ targetId: userId });
    }
  }

  const bioShort = bio && bio.length > 150;
  const displayBio =
    bio && bioShort && !showFullBio ? bio.slice(0, 150) + "…" : bio;

  return (
    <div className="w-full px-4 py-6">
      {/* Top row: avatar + stats */}
      <div className="flex items-start gap-6 mb-5">
        {/* Avatar */}
        <div className="shrink-0">
          <UserAvatar
            src={avatarUrl}
            username={username}
            size="xl"
            isVerified={isVerified}
            hasStory={hasActiveStory}
            showStoryRing
          />
        </div>

        {/* Stats */}
        <div className="flex flex-1 items-center justify-around pt-3">
          <StatItem label="Posts" value={postCount} />
          <button
            className="text-center hover:opacity-70 transition-opacity"
            onClick={() => router.push(`/${username}/followers`)}
          >
            <StatItem label="Followers" value={optimisticFollowers} />
          </button>
          <button
            className="text-center hover:opacity-70 transition-opacity"
            onClick={() => router.push(`/${username}/following`)}
          >
            <StatItem label="Following" value={followingCount} />
          </button>
        </div>
      </div>

      {/* Name + verified + private */}
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <h1 className="text-xl font-black tracking-tight leading-none">{name}</h1>
        {isVerified && (
          <CheckCircle2 className="h-5 w-5 text-brand fill-brand" />
        )}
        {isPrivate && (
          <Lock className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </div>
      <p className="text-sm text-muted-foreground mb-2">@{username}</p>

      {/* Bio */}
      {bio && (
        <div className="mb-4">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{displayBio}</p>
          {bioShort && (
            <button
              onClick={() => setShowFullBio((v) => !v)}
              className="text-xs text-brand font-medium mt-0.5"
            >
              {showFullBio ? "Show less" : "More"}
            </button>
          )}
        </div>
      )}

      {/* Action buttons */}
      {isBlocked ? (
        <div className="flex items-center gap-2">
          <Badge variant="destructive" className="text-xs">Blocked</Badge>
          <Button
            variant="outline"
            size="sm"
            className="h-9 text-xs"
            onClick={() => unblock.mutate({ targetId: userId })}
            disabled={unblock.isPending}
          >
            Unblock
          </Button>
        </div>
      ) : isOwnProfile ? (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="flex-1 h-9 font-semibold text-sm"
            onClick={() => router.push("/settings")}
          >
            Edit profile
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={() => router.push("/settings")}
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          {/* Follow / Unfollow */}
          <Button
            className={cn(
              "flex-1 h-9 font-semibold text-sm gap-1.5",
              optimisticFollowing
                ? "bg-muted text-foreground hover:bg-muted/80 border border-border"
                : "bg-brand text-brand-foreground hover:bg-brand/90",
            )}
            onClick={handleFollowToggle}
            disabled={follow.isPending || unfollow.isPending}
          >
            {optimisticFollowing ? (
              <>
                <UserMinus className="h-4 w-4" />
                Following
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" />
                Follow
              </>
            )}
          </Button>

          {/* Message */}
          <Button
            variant="outline"
            className="h-9 px-4 font-semibold text-sm gap-1.5"
            onClick={async () => {
              router.push(`/messages?dm=${userId}`);
            }}
          >
            <MessageCircle className="h-4 w-4" />
            Message
          </Button>

          {/* More */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-9 w-9 shrink-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem className="gap-2">
                <Flag className="h-4 w-4" />
                Report
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="gap-2 text-destructive focus:text-destructive"
                onClick={() => block.mutate({ targetId: userId })}
                disabled={block.isPending}
              >
                <Ban className="h-4 w-4" />
                Block @{username}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}

// ─── Stat item ────────────────────────────────────────────────────────────────
function StatItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <p className="text-xl font-black leading-none">{formatCount(value)}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
export function ProfileHeaderSkeleton() {
  return (
    <div className="w-full px-4 py-6">
      <div className="flex items-start gap-6 mb-5">
        <div className="h-20 w-20 rounded-full bg-muted animate-pulse shrink-0" />
        <div className="flex flex-1 items-center justify-around pt-3">
          {["Posts", "Followers", "Following"].map((l) => (
            <div key={l} className="text-center space-y-1">
              <div className="h-6 w-10 mx-auto rounded bg-muted animate-pulse" />
              <div className="h-3 w-12 mx-auto rounded bg-muted animate-pulse" />
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-5 w-40 rounded bg-muted animate-pulse" />
        <div className="h-4 w-24 rounded bg-muted animate-pulse" />
        <div className="h-3 w-full rounded bg-muted animate-pulse" />
        <div className="h-3 w-2/3 rounded bg-muted animate-pulse" />
        <div className="flex gap-2 mt-4">
          <div className="h-9 flex-1 rounded-lg bg-muted animate-pulse" />
          <div className="h-9 w-24 rounded-lg bg-muted animate-pulse" />
        </div>
      </div>
    </div>
  );
}