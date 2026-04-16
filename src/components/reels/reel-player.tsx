"use client";

import { useEffect, useRef, useState } from "react";
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  Volume2,
  VolumeX,
  MoreHorizontal,
  Play,
  Pause,
  Music2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";
import { UserAvatar } from "@/components/shared-primitives/user-avatar";
import { formatCount } from "@/lib/utils";
import { toast } from "sonner";

interface Reel {
  id: string;
  videoUrl: string;
  caption?: string | null;
  likeCount: number;
  commentCount: number;
  viewCount: number;
  isLiked: boolean;
  songName?: string | null;
  createdAt: Date;
  user: {
    id: string;
    name: string;
    username: string;
    image?: string | null;
    isFollowing?: boolean;
  };
}

interface ReelPlayerProps {
  reel: Reel;
  isActive: boolean;
  globalMuted: boolean;
  onMuteToggle: () => void;
  onOpenComments: (reelId: string) => void;
}

export function ReelPlayer({
  reel,
  isActive,
  globalMuted,
  onMuteToggle,
  onOpenComments,
}: ReelPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [liked, setLiked] = useState(reel.isLiked);
  const [likeCount, setLikeCount] = useState(reel.likeCount);
  const [showHeart, setShowHeart] = useState(false);
  const [progress, setProgress] = useState(0);

  const utils = api.useUtils();

  const likeMutation = api.reel.like.useMutation({
    onError: () => {
      setLiked((l) => !l);
      setLikeCount((c) => (liked ? c + 1 : c - 1));
    },
  });
  const unlikeMutation = api.reel.unlike.useMutation({
    onError: () => {
      setLiked((l) => !l);
      setLikeCount((c) => (liked ? c - 1 : c + 1));
    },
  });
  const followMutation = api.user.follow.useMutation({
    onSuccess: () => void utils.reel.getFeed.invalidate(),
  });
  const incrementView = api.reel.incrementView.useMutation();

  // Play / pause based on isActive
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isActive) {
      v.currentTime = 0;
      void v.play().then(() => setPlaying(true)).catch(() => {});
      incrementView.mutate({ reelId: reel.id });
    } else {
      v.pause();
      setPlaying(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      void v.play();
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  };

  const handleLike = () => {
    const newLiked = !liked;
    setLiked(newLiked);
    setLikeCount((c) => (newLiked ? c + 1 : c - 1));
    if (newLiked) {
      likeMutation.mutate({ reelId: reel.id });
    } else {
      unlikeMutation.mutate({ reelId: reel.id });
    }
  };

  const handleDoubleTap = () => {
    if (!liked) {
      setLiked(true);
      setLikeCount((c) => c + 1);
      likeMutation.mutate({ reelId: reel.id });
    }
    setShowHeart(true);
    setTimeout(() => setShowHeart(false), 900);
  };

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    setProgress((v.currentTime / v.duration) * 100);
  };

  const handleShare = async () => {
    try {
      await navigator.share?.({ url: window.location.href });
    } catch {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied");
    }
  };

  return (
    // FIXED: Added max-w-[420px], mx-auto, and sm:rounded-2xl to constrain the width to a 9:16 vertical ratio on desktop
    <div className="relative mx-auto h-full w-full max-w-[420px] overflow-hidden bg-black sm:rounded-2xl sm:border sm:border-border">
      {/* Video */}
      <video
        ref={videoRef}
        src={reel.videoUrl}
        className="h-full w-full object-cover"
        loop
        muted={globalMuted}
        playsInline
        onTimeUpdate={handleTimeUpdate}
        onDoubleClick={handleDoubleTap}
        onClick={togglePlay}
      />

      {/* Double-tap heart burst */}
      {showHeart && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Heart
            className="h-24 w-24 animate-ping fill-white text-white drop-shadow-2xl"
            style={{ animationDuration: "0.6s", animationIterationCount: 1 }}
          />
        </div>
      )}

      {/* Play/pause overlay */}
      {!playing && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-black/40">
            <Play className="h-8 w-8 fill-white text-white" />
          </div>
        </div>
      )}

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/20">
        <div
          className="h-full bg-white transition-none"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Bottom-left: user + caption */}
      <div className="absolute bottom-6 left-3 right-16 space-y-2">
        <div className="flex items-center gap-2">
          <UserAvatar
            src={reel.user.image}
            username={reel.user.username}
            size="sm"
            className="cursor-pointer"
          />
          <span className="text-sm font-semibold text-white drop-shadow">
            @{reel.user.username}
          </span>
          {!reel.user.isFollowing && (
            <button
              onClick={() => followMutation.mutate({ targetId: reel.user.id })}
              className="rounded-full border border-white px-2.5 py-0.5 text-xs font-semibold text-white hover:bg-white/20"
            >
              Follow
            </button>
          )}
        </div>

        {reel.caption && (
          <p className="line-clamp-2 text-sm text-white drop-shadow">
            {reel.caption}
          </p>
        )}

        {reel.songName && (
          <div className="flex items-center gap-1.5">
            <Music2 className="h-3 w-3 text-white/80" />
            <span className="animate-marquee text-xs text-white/80">
              {reel.songName}
            </span>
          </div>
        )}
      </div>

      {/* Right-side actions */}
      <div className="absolute bottom-6 right-3 flex flex-col items-center gap-5">
        {/* Like */}
        <button
          onClick={handleLike}
          className="flex flex-col items-center gap-1"
        >
          <Heart
            className={cn(
              "h-7 w-7 transition-transform active:scale-125",
              liked ? "fill-red-500 text-red-500" : "text-white"
            )}
          />
          <span className="text-xs font-medium text-white">
            {formatCount(likeCount)}
          </span>
        </button>

        {/* Comment */}
        <button
          onClick={() => onOpenComments(reel.id)}
          className="flex flex-col items-center gap-1"
        >
          <MessageCircle className="h-7 w-7 text-white" />
          <span className="text-xs font-medium text-white">
            {formatCount(reel.commentCount)}
          </span>
        </button>

        {/* Share */}
        <button
          onClick={handleShare}
          className="flex flex-col items-center gap-1"
        >
          <Share2 className="h-7 w-7 text-white" />
          <span className="text-xs font-medium text-white">Share</span>
        </button>

        {/* More */}
        <button className="flex flex-col items-center gap-1">
          <MoreHorizontal className="h-7 w-7 text-white" />
        </button>

        {/* Mute toggle */}
        <button onClick={onMuteToggle} className="flex flex-col items-center gap-1">
          {globalMuted ? (
            <VolumeX className="h-6 w-6 text-white" />
          ) : (
            <Volume2 className="h-6 w-6 text-white" />
          )}
        </button>
      </div>
    </div>
  );
}

export function ReelPlayerSkeleton() {
  return (
    // FIXED: Added same max-w constraint to the skeleton
    <div className="relative mx-auto h-full w-full max-w-[420px] overflow-hidden bg-black sm:rounded-2xl sm:border sm:border-border">
      {/* Video placeholder */}
      <div className="h-full w-full animate-pulse bg-neutral-900" />

      {/* Bottom-left: user + caption skeleton */}
      <div className="absolute bottom-6 left-3 right-16 space-y-2">
        <div className="flex items-center gap-2">
          {/* Avatar */}
          <div className="h-8 w-8 animate-pulse rounded-full bg-neutral-700" />
          {/* Username */}
          <div className="h-3 w-24 animate-pulse rounded bg-neutral-700" />
        </div>
        {/* Caption lines */}
        <div className="h-3 w-48 animate-pulse rounded bg-neutral-700" />
        <div className="h-3 w-32 animate-pulse rounded bg-neutral-700" />
        {/* Song name */}
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 animate-pulse rounded bg-neutral-700" />
          <div className="h-3 w-28 animate-pulse rounded bg-neutral-700" />
        </div>
      </div>

      {/* Right-side actions skeleton */}
      <div className="absolute bottom-6 right-3 flex flex-col items-center gap-5">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <div className="h-7 w-7 animate-pulse rounded-full bg-neutral-700" />
            <div className="h-2.5 w-6 animate-pulse rounded bg-neutral-700" />
          </div>
        ))}
      </div>

      {/* Progress bar skeleton */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-neutral-800" />
    </div>
  );
}