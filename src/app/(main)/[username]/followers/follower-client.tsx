"use client";

import Link from "next/link";
import { api } from "@/trpc/react";
import { UserAvatar } from "@/components/shared-primitives/user-avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface FollowersClientProps {
  username: string;
}

export function FollowersClient({ username }: FollowersClientProps) {
  const utils = api.useUtils();

  // 1. Fetch the profile to get the userId
  const { data: profile, isLoading: isLoadingProfile } = api.user.getProfile.useQuery({
    username,
  });

  // 2. Fetch the followers using the profile ID (only runs once profile is loaded)
  const { data: followers, isLoading: isLoadingFollowers } = api.user.getFollowers.useQuery(
    { userId: profile?.id ?? "" },
    { enabled: !!profile?.id }
  );

  const followMutation = api.user.follow.useMutation({
    onSuccess: () => {
      void utils.user.getFollowers.invalidate();
      void utils.user.getSuggestions.invalidate();
    },
  });

  if (isLoadingProfile || isLoadingFollowers) {
    return (
      <div className="flex flex-col gap-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-2">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!followers || followers.length === 0) {
    return (
      <div className="text-center py-12 bg-muted/20 rounded-2xl border border-border mt-4">
        <p className="text-muted-foreground text-sm">
          @{username} doesn't have any followers yet.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 mt-2">
      {followers.map((follower) => (
        <div 
          key={follower.id} 
          className="flex items-center justify-between p-3 rounded-2xl hover:bg-muted/50 transition-colors"
        >
          <Link href={`/${follower.username}`} className="flex items-center gap-3 overflow-hidden">
            <UserAvatar 
              src={follower.avatarUrl} 
              username={follower.username} 
              size="md" 
            />
            <div className="flex flex-col overflow-hidden">
              <span className="font-bold text-sm truncate flex items-center gap-1">
                {follower.name}
              </span>
              <span className="text-xs text-muted-foreground truncate">
                @{follower.username}
              </span>
            </div>
          </Link>

          {/* Quick follow back button (Optional) */}
          <Button 
            variant="secondary" 
            size="sm" 
            className="rounded-full h-8 text-xs font-semibold px-4 shrink-0 ml-3"
            onClick={() => followMutation.mutate({ targetId: follower.id })}
            disabled={followMutation.isPending}
          >
            Follow
          </Button>
        </div>
      ))}
    </div>
  );
}