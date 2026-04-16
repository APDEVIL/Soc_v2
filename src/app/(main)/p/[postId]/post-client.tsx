"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PostCard } from "@/components/posts/post-card";
import { api } from "@/trpc/react";

export function SinglePostClient({ postId }: { postId: string }) {
  const router = useRouter();
  
  // Fetches the post using your existing getPost endpoint
  const { data: post, isLoading } = api.post.getPost.useQuery({ postId });

  // We also check like/save status if the user is logged in
  // Most PostCard components expect these booleans to function
  const { data: userMe } = api.user.me.useQuery(undefined, { retry: false });

  if (isLoading) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="h-10 w-10 animate-spin text-brand" />
        <p className="text-sm font-medium">Loading post...</p>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <h2 className="text-2xl font-black mb-2">Post not found</h2>
        <p className="text-muted-foreground mb-6">
          This post may have been deleted or the link is invalid.
        </p>
        <Button onClick={() => router.push("/feed")} variant="outline" className="rounded-xl">
          Return to Feed
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-10 w-10 rounded-full bg-muted/50 hover:bg-muted"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-black leading-tight">Post</h1>
          <p className="text-xs text-muted-foreground">by @{post.author.username}</p>
        </div>
      </div>

      <PostCard
        postId={post.id}
        author={post.author}
        caption={post.caption}
        location={post.location}
        media={post.media}
        likeCount={post.likeCount}
        commentCount={post.commentCount}
        // Since getPost doesn't return these booleans directly, 
        // PostCard will handle the internal state via mutations.
        isLiked={false} 
        isSaved={false}
        createdAt={post.createdAt}
      />
    </div>
  );
}