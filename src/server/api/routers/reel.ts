import { z } from "zod";
import { and, desc, eq, inArray, not, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "@/server/api/trpc";
import {
  posts,
  postMedia,
  postLikes,
  follows,
  blocks,
  notifications,
} from "@/server/db/schema";

export const reelRouter = createTRPCRouter({

  // Reel feed: Fetches all POSTS that contain a VIDEO
  getFeed: protectedProcedure
    .input(z.object({ limit: z.number().max(20).default(10), cursor: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const myFollowing = await ctx.db
        .select({ id: follows.followingId })
        .from(follows)
        .where(eq(follows.followerId, ctx.session.user.id));

      const myBlocked = await ctx.db
        .select({ id: blocks.blockedId })
        .from(blocks)
        .where(eq(blocks.blockerId, ctx.session.user.id));

      const blockedIds = myBlocked.map((b) => b.id);

      // 1. Find all post IDs that contain a video
      const videoMedia = await ctx.db
        .select({ postId: postMedia.postId })
        .from(postMedia)
        .where(eq(postMedia.type, "video"));
      
      const videoPostIds = videoMedia.map((m) => m.postId);

      // If there are no videos at all, return empty early to prevent Drizzle crash
      if (videoPostIds.length === 0) {
        return { items: [], hasMore: false, nextCursor: undefined };
      }

      // 2. Fetch those specific posts
      const feed = await ctx.db.query.posts.findMany({
        where: and(
          eq(posts.isArchived, false),
          inArray(posts.id, videoPostIds),
          blockedIds.length ? not(inArray(posts.authorId, blockedIds)) : undefined,
        ),
        orderBy: [desc(posts.createdAt)],
        limit: input.limit + 1,
        with: {
          author: { columns: { id: true, username: true, name: true, avatarUrl: true, isVerified: true } },
          media: {
            where: eq(postMedia.type, "video"),
            limit: 1, // Get the video specifically
          },
        },
      });

      const postIds = feed.map((p) => p.id);
      const likedRows = postIds.length
        ? await ctx.db.select({ postId: postLikes.postId }).from(postLikes)
            .where(and(eq(postLikes.userId, ctx.session.user.id), inArray(postLikes.postId, postIds)))
        : [];

      const likedSet = new Set(likedRows.map((r) => r.postId));

      const hasMore = feed.length > input.limit;
      
      // 3. Map the Post to look EXACTLY like a Reel for the frontend
      const items = feed.slice(0, input.limit).map((p) => ({
        id: p.id,
        authorId: p.authorId,
        caption: p.caption,
        videoUrl: p.media[0]?.url ?? "",
        thumbnailUrl: p.media[0]?.thumbnailUrl ?? null,
        viewCount: 0, // Fallback since posts don't inherently track video views
        likeCount: p.likeCount,
        commentCount: p.commentCount,
        createdAt: p.createdAt,
        author: p.author,
        isLiked: likedSet.has(p.id),
        isFollowingAuthor: myFollowing.some((f) => f.id === p.authorId),
      }));

      return { items, hasMore, nextCursor: hasMore ? items[items.length - 1]?.id : undefined };
    }),

  // Single reel (Fetching a single video post)
  getReel: publicProcedure
    .input(z.object({ reelId: z.string() }))
    .query(async ({ ctx, input }) => {
      const post = await ctx.db.query.posts.findFirst({
        where: eq(posts.id, input.reelId),
        with: {
          author: { columns: { id: true, username: true, name: true, avatarUrl: true, isVerified: true } },
          media: { where: eq(postMedia.type, "video"), limit: 1 },
        },
      });
      
      if (!post || !post.media.length) throw new TRPCError({ code: "NOT_FOUND" });

      return {
        id: post.id,
        authorId: post.authorId,
        caption: post.caption,
        videoUrl: post.media[0]?.url ?? "",
        thumbnailUrl: post.media[0]?.thumbnailUrl ?? null,
        viewCount: 0,
        likeCount: post.likeCount,
        commentCount: post.commentCount,
        createdAt: post.createdAt,
        author: post.author,
      };
    }),

  // Get user's reels (Filtering their posts for videos)
  getUserReels: publicProcedure
    .input(z.object({ userId: z.string(), limit: z.number().max(30).default(12) }))
    .query(async ({ ctx, input }) => {
      const videoMedia = await ctx.db
        .select({ postId: postMedia.postId })
        .from(postMedia)
        .where(eq(postMedia.type, "video"));
      
      const videoPostIds = videoMedia.map((m) => m.postId);

      if (videoPostIds.length === 0) return [];

      const feed = await ctx.db.query.posts.findMany({
        where: and(
          eq(posts.authorId, input.userId),
          eq(posts.isArchived, false),
          inArray(posts.id, videoPostIds),
        ),
        orderBy: [desc(posts.createdAt)],
        limit: input.limit,
        with: {
          media: { where: eq(postMedia.type, "video"), limit: 1 },
        },
      });

      return feed.map((p) => ({
        id: p.id,
        authorId: p.authorId,
        caption: p.caption,
        videoUrl: p.media[0]?.url ?? "",
        thumbnailUrl: p.media[0]?.thumbnailUrl ?? null,
        viewCount: 0,
        likeCount: p.likeCount,
        commentCount: p.commentCount,
        createdAt: p.createdAt,
      }));
    }),

  // Create reel (Redirected to create a Video Post so it exists in one central place)
  create: protectedProcedure
    .input(
      z.object({
        videoUrl: z.string().url(),
        thumbnailUrl: z.string().url().optional(),
        caption: z.string().max(2200).optional(),
        duration: z.number().min(1).max(90).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [post] = await ctx.db
        .insert(posts)
        .values({ authorId: ctx.session.user.id, caption: input.caption })
        .returning();

      if (!post) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await ctx.db.insert(postMedia).values({
        postId: post.id,
        url: input.videoUrl,
        type: "video",
        order: 0,
        thumbnailUrl: input.thumbnailUrl,
        duration: input.duration,
      });

      return post;
    }),

  // Delete reel (Deletes the underlying post)
  delete: protectedProcedure
    .input(z.object({ reelId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const post = await ctx.db.query.posts.findFirst({ where: eq(posts.id, input.reelId) });
      if (!post) throw new TRPCError({ code: "NOT_FOUND" });
      if (post.authorId !== ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN" });

      await ctx.db.delete(posts).where(eq(posts.id, input.reelId));
      return { success: true };
    }),

  // Like reel (Likes the underlying post)
  like: protectedProcedure
    .input(z.object({ reelId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.insert(postLikes)
        .values({ postId: input.reelId, userId: ctx.session.user.id })
        .onConflictDoNothing();

      await ctx.db.update(posts)
        .set({ likeCount: sql`${posts.likeCount} + 1` })
        .where(eq(posts.id, input.reelId));

      const post = await ctx.db.query.posts.findFirst({ where: eq(posts.id, input.reelId) });
      if (post?.id && post.authorId !== ctx.session.user.id) {
        await ctx.db.insert(notifications).values({
          recipientId: post.authorId,
          actorId: ctx.session.user.id,
          type: "like", // Reverting back to standard post like
          postId: input.reelId,
        }).onConflictDoNothing();
      }

      return { success: true };
    }),

  // Unlike reel
  unlike: protectedProcedure
    .input(z.object({ reelId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(postLikes)
        .where(and(eq(postLikes.postId, input.reelId), eq(postLikes.userId, ctx.session.user.id)));

      await ctx.db.update(posts)
        .set({ likeCount: sql`GREATEST(${posts.likeCount} - 1, 0)` })
        .where(eq(posts.id, input.reelId));

      return { success: true };
    }),

  // Increment view count (Gracefully handled to prevent crashes since posts don't have viewCount)
  incrementView: protectedProcedure
    .input(z.object({ reelId: z.string() }))
    .mutation(async () => {
      // Returns success so the frontend player doesn't crash when it attempts to update views
      return { success: true };
    }),
});