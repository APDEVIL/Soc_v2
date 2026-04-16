"use client";

import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/shared-primitives/user-avatar";

interface StoryRingProps {
  user: {
    id: string;
    name: string;
    username: string;
    image?: string | null;
  };
  hasStory: boolean;
  viewed: boolean;
  size?: "sm" | "md" | "lg";
  showName?: boolean;
  onClick?: () => void;
  className?: string;
}

const sizeMap = {
  sm: { avatar: "sm" as const, nameClass: "text-[10px]", maxW: "max-w-[48px]" },
  md: { avatar: "lg" as const, nameClass: "text-xs",     maxW: "max-w-[56px]" },
  lg: { avatar: "xl" as const, nameClass: "text-xs",     maxW: "max-w-[72px]" },
};

export function StoryRing({
  user,
  hasStory,
  viewed,
  size = "md",
  showName = true,
  onClick,
  className,
}: StoryRingProps) {
  const s = sizeMap[size];

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1.5 transition-opacity hover:opacity-80 active:scale-95",
        className
      )}
      aria-label={`${user.name}'s story`}
    >
      <UserAvatar
        src={user.image}
        username={user.username}
        size={s.avatar}
        hasStory={hasStory}
        showStoryRing={hasStory && !viewed}
      />
      {showName && (
        <span
          className={cn(
            "truncate font-medium leading-tight text-foreground",
            s.nameClass,
            s.maxW
          )}
        >
          {user.username}
        </span>
      )}
    </button>
  );
}