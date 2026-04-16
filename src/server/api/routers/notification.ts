import { z } from "zod";
import { and, desc, eq, count } from "drizzle-orm"; // <-- Added count here
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { notifications } from "@/server/db/schema";

export const notificationRouter = createTRPCRouter({

  // Get all notifications for current user
  getAll: protectedProcedure
    .input(z.object({ limit: z.number().max(50).default(20), cursor: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const items = await ctx.db.query.notifications.findMany({
        where: eq(notifications.recipientId, ctx.session.user.id),
        orderBy: [desc(notifications.createdAt)],
        limit: input.limit + 1,
        with: {
          actor: { columns: { id: true, username: true, name: true, avatarUrl: true, isVerified: true } },
          post: { columns: { id: true }, with: { media: { limit: 1, columns: { url: true, type: true } } } },
          reel: { columns: { id: true, thumbnailUrl: true } },
          story: { columns: { id: true, mediaUrl: true } },
          comment: { columns: { id: true, content: true } },
          group: { columns: { id: true, name: true, avatarUrl: true } },
        },
      });

      const hasMore = items.length > input.limit;
      return {
        items: items.slice(0, input.limit),
        hasMore,
        nextCursor: hasMore ? items[input.limit - 1]?.id : undefined,
      };
    }),

  // Get unread count (for badge)
  getUnreadCount: protectedProcedure
    .input(z.any().optional()) // <-- FIXED: Absorbs the {} payload from the frontend safely
    .query(async ({ ctx }) => {
      const [row] = await ctx.db
        .select({ value: count() }) // <-- FIXED: Using Drizzle's native, failsafe count()
        .from(notifications)
        .where(and(
          eq(notifications.recipientId, ctx.session.user.id),
          eq(notifications.isRead, false),
        ));
      return { count: row?.value ?? 0 };
    }),

  // Mark one notification as read
  markRead: protectedProcedure
    .input(z.object({ notificationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(notifications)
        .set({ isRead: true })
        .where(and(
          eq(notifications.id, input.notificationId),
          eq(notifications.recipientId, ctx.session.user.id),
        ));
      return { success: true };
    }),

  // Mark all as read
  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.db
      .update(notifications)
      .set({ isRead: true })
      .where(and(
        eq(notifications.recipientId, ctx.session.user.id),
        eq(notifications.isRead, false),
      ));
    return { success: true };
  }),

  // Delete a notification
  delete: protectedProcedure
    .input(z.object({ notificationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(notifications)
        .where(and(
          eq(notifications.id, input.notificationId),
          eq(notifications.recipientId, ctx.session.user.id),
        ));
      return { success: true };
    }),
});