import { z } from "zod";
import { and, desc, eq, inArray, sql, not } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "@/server/api/trpc";
import {
  posts,
  postMedia,
  postLikes,
  postSaves,
  postHashtags,
  hashtags,
  comments,
  commentLikes,
  follows,
  blocks,
  notifications,
  users,
} from "@/server/db/schema";

// Helper: extract hashtags from caption
function extractHashtags(caption: string): string[] {
  const matches = caption.match(/#([a-zA-Z0-9_]+)/g) ?? [];
  return [...new Set(matches.map((h) => h.slice(1).toLowerCase()))];
}

export const postRouter = createTRPCRouter({

  // Home feed: posts from people you follow
  getFeed: protectedProcedure
    .input(z.object({ cursor: z.string().optional(), limit: z.number().max(50).default(10) }))
    .query(async ({ ctx, input }) => {
      const myFollowing = await ctx.db
        .select({ id: follows.followingId })
        .from(follows)
        .where(eq(follows.followerId, ctx.session.user.id));

      const authorIds = [ctx.session.user.id, ...myFollowing.map((f) => f.id)];

      const feed = await ctx.db.query.posts.findMany({
        where: and(
          inArray(posts.authorId, authorIds),
          eq(posts.isArchived, false),
        ),
        orderBy: [desc(posts.createdAt)],
        limit: input.limit + 1,
        with: {
          author: { columns: { id: true, username: true, name: true, avatarUrl: true, isVerified: true } },
          media: { orderBy: (m, { asc }) => [asc(m.order)] },
        },
      });

      // Attach isLiked and isSaved for the current user
      const postIds = feed.map((p) => p.id);
      const likedRows = postIds.length
        ? await ctx.db.select({ postId: postLikes.postId }).from(postLikes)
            .where(and(eq(postLikes.userId, ctx.session.user.id), inArray(postLikes.postId, postIds)))
        : [];
      const savedRows = postIds.length
        ? await ctx.db.select({ postId: postSaves.postId }).from(postSaves)
            .where(and(eq(postSaves.userId, ctx.session.user.id), inArray(postSaves.postId, postIds)))
        : [];

      const likedSet = new Set(likedRows.map((r) => r.postId));
      const savedSet = new Set(savedRows.map((r) => r.postId));

      const hasMore = feed.length > input.limit;
      const items = feed.slice(0, input.limit).map((p) => ({
        ...p,
        isLiked: likedSet.has(p.id),
        isSaved: savedSet.has(p.id),
      }));

      return { items, hasMore, nextCursor: hasMore ? items[items.length - 1]?.id : undefined };
    }),

  // Explore feed: recent public posts not from blocked users
  getExploreFeed: protectedProcedure
    .input(z.object({ limit: z.number().max(30).default(18) }))
    .query(async ({ ctx, input }) => {
      const blocked = await ctx.db
        .select({ id: blocks.blockedId })
        .from(blocks)
        .where(eq(blocks.blockerId, ctx.session.user.id));
      const blockedIds = blocked.map((b) => b.id);

      const feed = await ctx.db.query.posts.findMany({
        where: and(
          eq(posts.isArchived, false),
          blockedIds.length ? not(inArray(posts.authorId, blockedIds)) : undefined,
        ),
        orderBy: [desc(posts.likeCount), desc(posts.createdAt)],
        limit: input.limit,
        with: {
          author: { columns: { id: true, username: true, avatarUrl: true, isVerified: true } },
          media: { limit: 1, orderBy: (m, { asc }) => [asc(m.order)] },
        },
      });
      return feed;
    }),

  // Get single post
  getPost: publicProcedure
    .input(z.object({ postId: z.string() }))
    .query(async ({ ctx, input }) => {
      const post = await ctx.db.query.posts.findFirst({
        where: eq(posts.id, input.postId),
        with: {
          author: { columns: { id: true, username: true, name: true, avatarUrl: true, isVerified: true } },
          media: { orderBy: (m, { asc }) => [asc(m.order)] },
          comments: {
            where: (c, { isNull }) => isNull(c.parentId),
            limit: 20,
            orderBy: (c, { desc }) => [desc(c.createdAt)],
            with: {
              author: { columns: { id: true, username: true, avatarUrl: true, isVerified: true } },
            },
          },
        },
      });
      if (!post) throw new TRPCError({ code: "NOT_FOUND" });
      return post;
    }),

  // Get a user's posts
  getUserPosts: publicProcedure
    .input(z.object({ userId: z.string(), limit: z.number().max(30).default(12) }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.posts.findMany({
        where: and(eq(posts.authorId, input.userId), eq(posts.isArchived, false)),
        orderBy: [desc(posts.createdAt)],
        limit: input.limit,
        with: { media: { limit: 1, orderBy: (m, { asc }) => [asc(m.order)] } },
      });
    }),

  // Create post with media
  create: protectedProcedure
    .input(
      z.object({
        caption: z.string().max(2200).optional(),
        location: z.string().max(100).optional(),
        groupId: z.string().optional(),
        media: z.array(
          z.object({
            url: z.string().url(),
            type: z.enum(["image", "video"]),
            order: z.number(),
            width: z.number().optional(),
            height: z.number().optional(),
            duration: z.number().optional(),
            thumbnailUrl: z.string().optional(),
          }),
        ).min(1).max(10),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [post] = await ctx.db
        .insert(posts)
        .values({
          authorId: ctx.session.user.id,
          caption: input.caption,
          location: input.location,
          groupId: input.groupId,
        })
        .returning();

      if (!post) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Insert media
      await ctx.db.insert(postMedia).values(
        input.media.map((m) => ({ ...m, postId: post.id })),
      );

      // Handle hashtags
      if (input.caption) {
        const tags = extractHashtags(input.caption);
        for (const tag of tags) {
          const [existing] = await ctx.db
            .insert(hashtags)
            .values({ name: tag })
            .onConflictDoUpdate({ target: hashtags.name, set: { postCount: sql`${hashtags.postCount} + 1` } })
            .returning();
          if (existing) {
            await ctx.db.insert(postHashtags).values({ postId: post.id, hashtagId: existing.id }).onConflictDoNothing();
          }
        }
      }

      return post;
    }),

  // Delete post
  delete: protectedProcedure
    .input(z.object({ postId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const post = await ctx.db.query.posts.findFirst({ where: eq(posts.id, input.postId) });
      if (!post) throw new TRPCError({ code: "NOT_FOUND" });
      if (post.authorId !== ctx.session.user.id)
        throw new TRPCError({ code: "FORBIDDEN" });

      await ctx.db.delete(posts).where(eq(posts.id, input.postId));
      return { success: true };
    }),

  // Like
  like: protectedProcedure
    .input(z.object({ postId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.insert(postLikes)
        .values({ postId: input.postId, userId: ctx.session.user.id })
        .onConflictDoNothing();

      await ctx.db.update(posts)
        .set({ likeCount: sql`${posts.likeCount} + 1` })
        .where(eq(posts.id, input.postId));

      const post = await ctx.db.query.posts.findFirst({ where: eq(posts.id, input.postId) });
      if (post && post.authorId !== ctx.session.user.id) {
        await ctx.db.insert(notifications).values({
          recipientId: post.authorId,
          actorId: ctx.session.user.id,
          type: "like",
          postId: input.postId,
        }).onConflictDoNothing();
      }

      return { success: true };
    }),

  // Unlike
  unlike: protectedProcedure
    .input(z.object({ postId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(postLikes)
        .where(and(eq(postLikes.postId, input.postId), eq(postLikes.userId, ctx.session.user.id)));

      await ctx.db.update(posts)
        .set({ likeCount: sql`GREATEST(${posts.likeCount} - 1, 0)` })
        .where(eq(posts.id, input.postId));

      return { success: true };
    }),

  // Save
  save: protectedProcedure
    .input(z.object({ postId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.insert(postSaves)
        .values({ postId: input.postId, userId: ctx.session.user.id })
        .onConflictDoNothing();
      return { success: true };
    }),

  // Unsave
  unsave: protectedProcedure
    .input(z.object({ postId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(postSaves)
        .where(and(eq(postSaves.postId, input.postId), eq(postSaves.userId, ctx.session.user.id)));
      return { success: true };
    }),

  // Get saved posts
  // Get saved posts
  getSaved: protectedProcedure
    .input(z.object({ limit: z.number().max(30).default(12) }))
    .query(async ({ ctx, input }) => {
      const saved = await ctx.db.query.postSaves.findMany({
        where: eq(postSaves.userId, ctx.session.user.id),
        limit: input.limit,
        orderBy: (s, { desc }) => [desc(s.createdAt)],
        with: {
          post: {
            with: {
              // Removed the explicit 'any' types so Drizzle can infer the schema naturally
              media: { limit: 1, orderBy: (m: { order: any; }, { asc }: any) => [asc(m.order)] },
              author: { columns: { id: true, username: true, avatarUrl: true } },
            },
          },
        },
      });
      
      return saved.map((s) => s.post);
    }),
  // Add comment
  addComment: protectedProcedure
    .input(z.object({
      postId: z.string(),
      content: z.string().min(1).max(1000),
      parentId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [comment] = await ctx.db.insert(comments)
        .values({
          postId: input.postId,
          authorId: ctx.session.user.id,
          content: input.content,
          parentId: input.parentId,
        })
        .returning();

      await ctx.db.update(posts)
        .set({ commentCount: sql`${posts.commentCount} + 1` })
        .where(eq(posts.id, input.postId));

      const post = await ctx.db.query.posts.findFirst({ where: eq(posts.id, input.postId) });
      if (post && post.authorId !== ctx.session.user.id) {
        await ctx.db.insert(notifications).values({
          recipientId: post.authorId,
          actorId: ctx.session.user.id,
          type: "comment",
          postId: input.postId,
          commentId: comment!.id,
        }).onConflictDoNothing();
      }

      return comment;
    }),

  // Delete comment
  deleteComment: protectedProcedure
    .input(z.object({ commentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const comment = await ctx.db.query.comments.findFirst({ where: eq(comments.id, input.commentId) });
      if (!comment) throw new TRPCError({ code: "NOT_FOUND" });
      if (comment.authorId !== ctx.session.user.id)
        throw new TRPCError({ code: "FORBIDDEN" });

      await ctx.db.delete(comments).where(eq(comments.id, input.commentId));

      await ctx.db.update(posts)
        .set({ commentCount: sql`GREATEST(${posts.commentCount} - 1, 0)` })
        .where(eq(posts.id, comment.postId));

      return { success: true };
    }),

  // Get comments (with replies)
  getComments: publicProcedure
    .input(z.object({ postId: z.string(), limit: z.number().max(50).default(20) }))
    .query(async ({ ctx, input }) => {
      const topLevel = await ctx.db.query.comments.findMany({
        where: and(eq(comments.postId, input.postId), sql`${comments.parentId} IS NULL`),
        orderBy: [desc(comments.createdAt)],
        limit: input.limit,
        with: {
          author: { columns: { id: true, username: true, avatarUrl: true, isVerified: true } },
        },
      });

      const commentIds = topLevel.map((c) => c.id);
      const replies = commentIds.length
        ? await ctx.db.query.comments.findMany({
            where: inArray(comments.parentId as any, commentIds),
            orderBy: [desc(comments.createdAt)],
            with: {
              author: { columns: { id: true, username: true, avatarUrl: true, isVerified: true } },
            },
          })
        : [];

      return topLevel.map((c) => ({
        ...c,
        replies: replies.filter((r) => r.parentId === c.id),
      }));
    }),

  // Like a comment
  likeComment: protectedProcedure
    .input(z.object({ commentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.insert(commentLikes)
        .values({ commentId: input.commentId, userId: ctx.session.user.id })
        .onConflictDoNothing();

      await ctx.db.update(comments)
        .set({ likeCount: sql`${comments.likeCount} + 1` })
        .where(eq(comments.id, input.commentId));

      return { success: true };
    }),

  // Unlike a comment
  unlikeComment: protectedProcedure
    .input(z.object({ commentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(commentLikes)
        .where(and(eq(commentLikes.commentId, input.commentId), eq(commentLikes.userId, ctx.session.user.id)));

      await ctx.db.update(comments)
        .set({ likeCount: sql`GREATEST(${comments.likeCount} - 1, 0)` })
        .where(eq(comments.id, input.commentId));

      return { success: true };
    }),

  // Search by hashtag
  getByHashtag: publicProcedure
    .input(z.object({ tag: z.string(), limit: z.number().max(30).default(18) }))
    .query(async ({ ctx, input }) => {
      const hashtag = await ctx.db.query.hashtags.findFirst({
        where: eq(hashtags.name, input.tag.toLowerCase()),
      });
      if (!hashtag) return [];

      const rows = await ctx.db.query.postHashtags.findMany({
        where: eq(postHashtags.hashtagId, hashtag.id),
        limit: input.limit,
        with: {
          post: {
            with: {
              media: { limit: 1, orderBy: (m, { asc }) => [asc(m.order)] },
              author: { columns: { id: true, username: true, avatarUrl: true } },
            },
          },
        },
      });
      return rows.map((r) => r.post);
    }),
});