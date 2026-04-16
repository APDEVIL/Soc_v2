import { z } from "zod";
import { and, desc, eq, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import Pusher from "pusher";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import {
  conversations,
  conversationMembers,
  messages,
  notifications,
} from "@/server/db/schema";
import { env } from "@/env";

// Pusher server instance (singleton)
const pusher = new Pusher({
  appId: env.PUSHER_APP_ID,
  key: env.NEXT_PUBLIC_PUSHER_KEY,
  secret: env.PUSHER_SECRET,
  cluster: env.NEXT_PUBLIC_PUSHER_CLUSTER,
  useTLS: true,
});

export const chatRouter = createTRPCRouter({

  // Get all conversations for current user
  getConversations: protectedProcedure.query(async ({ ctx }) => {
    const memberships = await ctx.db.query.conversationMembers.findMany({
      where: eq(conversationMembers.userId, ctx.session.user.id),
      orderBy: (m, { desc }) => [desc(m.joinedAt)],
      with: {
        conversation: {
          with: {
            members: {
              with: {
                user: { columns: { id: true, username: true, name: true, avatarUrl: true } },
              },
            },
            messages: {
              limit: 1,
              orderBy: (msg, { desc }) => [desc(msg.createdAt)],
            },
          },
        },
      },
    });

    return memberships.map((m) => {
      const conv = m.conversation;
      const otherMembers = conv.members
        .filter((mem) => mem.userId !== ctx.session.user.id)
        .map((mem) => mem.user);

      return {
        id: conv.id,
        isGroup: conv.isGroup,
        name: conv.isGroup ? conv.name : otherMembers[0]?.name ?? "Unknown",
        avatarUrl: conv.isGroup ? conv.avatarUrl : otherMembers[0]?.avatarUrl ?? null,
        lastMessage: conv.messages[0] ?? null,
        lastMessageAt: conv.lastMessageAt,
        unreadCount: 0, // computed separately if needed
        members: otherMembers,
        lastReadAt: m.lastReadAt,
      };
    }).sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime());
  }),

  // Get messages for a conversation (paginated)
  getMessages: protectedProcedure
    .input(z.object({
      conversationId: z.string(),
      cursor: z.string().optional(),
      limit: z.number().max(50).default(30),
    }))
    .query(async ({ ctx, input }) => {
      // Verify membership
      const membership = await ctx.db.query.conversationMembers.findFirst({
        where: and(
          eq(conversationMembers.conversationId, input.conversationId),
          eq(conversationMembers.userId, ctx.session.user.id),
        ),
      });
      if (!membership) throw new TRPCError({ code: "FORBIDDEN" });

      const msgs = await ctx.db.query.messages.findMany({
        where: and(
          eq(messages.conversationId, input.conversationId),
          eq(messages.isDeleted, false),
        ),
        orderBy: [desc(messages.createdAt)],
        limit: input.limit + 1,
        with: {
          sender: { columns: { id: true, username: true, name: true, avatarUrl: true } },
        },
      });

      const hasMore = msgs.length > input.limit;
      const items = msgs.slice(0, input.limit).reverse(); // chronological order for display

      return { items, hasMore, nextCursor: hasMore ? msgs[input.limit]?.id : undefined };
    }),

  // Create or get 1:1 conversation with a user
  getOrCreateDM: protectedProcedure
    .input(z.object({ targetUserId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (input.targetUserId === ctx.session.user.id)
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot DM yourself" });

      // Check if DM already exists between these two users
      const myMemberships = await ctx.db
        .select({ conversationId: conversationMembers.conversationId })
        .from(conversationMembers)
        .where(eq(conversationMembers.userId, ctx.session.user.id));

      const myConvIds = myMemberships.map((m) => m.conversationId);

      if (myConvIds.length) {
        const theirMemberships = await ctx.db
          .select({ conversationId: conversationMembers.conversationId })
          .from(conversationMembers)
          .where(
            and(
              eq(conversationMembers.userId, input.targetUserId),
              inArray(conversationMembers.conversationId, myConvIds),
            ),
          );

        if (theirMemberships.length) {
          // Find non-group conversation in the overlap
          for (const m of theirMemberships) {
            const conv = await ctx.db.query.conversations.findFirst({
              where: and(
                eq(conversations.id, m.conversationId),
                eq(conversations.isGroup, false),
              ),
            });
            if (conv) return { conversationId: conv.id, isNew: false };
          }
        }
      }

      // Create new DM conversation
      const [conv] = await ctx.db
        .insert(conversations)
        .values({ isGroup: false })
        .returning();

      if (!conv) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await ctx.db.insert(conversationMembers).values([
        { conversationId: conv.id, userId: ctx.session.user.id },
        { conversationId: conv.id, userId: input.targetUserId },
      ]);

      return { conversationId: conv.id, isNew: true };
    }),

  // Create group conversation
  createGroupConversation: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      memberIds: z.array(z.string()).min(1).max(50),
    }))
    .mutation(async ({ ctx, input }) => {
      const [conv] = await ctx.db
        .insert(conversations)
        .values({ isGroup: true, name: input.name })
        .returning();

      if (!conv) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const allMemberIds = [...new Set([ctx.session.user.id, ...input.memberIds])];
      await ctx.db.insert(conversationMembers).values(
        allMemberIds.map((userId) => ({ conversationId: conv.id, userId })),
      );

      return conv;
    }),

  // Send message — triggers Pusher event for real-time delivery
  sendMessage: protectedProcedure
    .input(z.object({
      conversationId: z.string(),
      content: z.string().max(4000).optional(),
      mediaUrl: z.string().url().optional(),
      mediaType: z.enum(["image", "video"]).optional(),
      replyToId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!input.content && !input.mediaUrl)
        throw new TRPCError({ code: "BAD_REQUEST", message: "Message must have content or media" });

      // Verify membership
      const membership = await ctx.db.query.conversationMembers.findFirst({
        where: and(
          eq(conversationMembers.conversationId, input.conversationId),
          eq(conversationMembers.userId, ctx.session.user.id),
        ),
      });
      if (!membership) throw new TRPCError({ code: "FORBIDDEN" });

      const [message] = await ctx.db
        .insert(messages)
        .values({
          conversationId: input.conversationId,
          senderId: ctx.session.user.id,
          content: input.content,
          mediaUrl: input.mediaUrl,
          mediaType: input.mediaType,
          replyToId: input.replyToId,
          status: "sent",
        })
        .returning();

      if (!message) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Update conversation lastMessageAt
      await ctx.db
        .update(conversations)
        .set({ lastMessageAt: new Date() })
        .where(eq(conversations.id, input.conversationId));

      // Fetch sender info for Pusher payload
      const sender = await ctx.db.query.users.findFirst({
        where: (u) => eq(u.id, ctx.session.user.id),
        columns: { id: true, username: true, name: true, avatarUrl: true },
      });

      const payload = { ...message, sender };

      // Pusher: broadcast to conversation channel
      await pusher.trigger(
        `conversation-${input.conversationId}`,
        "new-message",
        payload,
      );

      // Notify other members
      const members = await ctx.db.query.conversationMembers.findMany({
        where: eq(conversationMembers.conversationId, input.conversationId),
      });

      const otherMembers = members.filter((m) => m.userId !== ctx.session.user.id);
      if (otherMembers.length) {
        await ctx.db.insert(notifications).values(
          otherMembers.map((m) => ({
            recipientId: m.userId,
            actorId: ctx.session.user.id,
            type: "message" as const,
          })),
        ).onConflictDoNothing();

        // Pusher: notify each user's personal channel (for badge updates)
        for (const m of otherMembers) {
          await pusher.trigger(`user-${m.userId}`, "new-message-notification", {
            conversationId: input.conversationId,
            senderId: ctx.session.user.id,
          });
        }
      }

      return payload;
    }),

  // Mark conversation as read
  markRead: protectedProcedure
    .input(z.object({ conversationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(conversationMembers)
        .set({ lastReadAt: new Date() })
        .where(
          and(
            eq(conversationMembers.conversationId, input.conversationId),
            eq(conversationMembers.userId, ctx.session.user.id),
          ),
        );

      // Update message statuses to read
      await ctx.db
        .update(messages)
        .set({ status: "read" })
        .where(eq(messages.conversationId, input.conversationId));

      // Pusher: notify sender(s) their messages were read
      await pusher.trigger(
        `conversation-${input.conversationId}`,
        "messages-read",
        { userId: ctx.session.user.id },
      );

      return { success: true };
    }),

  // Delete own message
  deleteMessage: protectedProcedure
    .input(z.object({ messageId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const message = await ctx.db.query.messages.findFirst({
        where: eq(messages.id, input.messageId),
      });
      if (!message) throw new TRPCError({ code: "NOT_FOUND" });
      if (message.senderId !== ctx.session.user.id)
        throw new TRPCError({ code: "FORBIDDEN" });

      await ctx.db
        .update(messages)
        .set({ isDeleted: true, content: null, mediaUrl: null })
        .where(eq(messages.id, input.messageId));

      await pusher.trigger(
        `conversation-${message.conversationId}`,
        "message-deleted",
        { messageId: input.messageId },
      );

      return { success: true };
    }),

  // Pusher auth endpoint for private channels (call from client)
  pusherAuth: protectedProcedure
    .input(z.object({ socketId: z.string(), channelName: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Only allow users to auth for their own user channel or conversations they're in
      if (input.channelName.startsWith(`user-${ctx.session.user.id}`)) {
        const authResponse = pusher.authorizeChannel(input.socketId, input.channelName);
        return authResponse;
      }

      if (input.channelName.startsWith("conversation-")) {
        const conversationId = input.channelName.replace("conversation-", "");
        const membership = await ctx.db.query.conversationMembers.findFirst({
          where: and(
            eq(conversationMembers.conversationId, conversationId),
            eq(conversationMembers.userId, ctx.session.user.id),
          ),
        });
        if (!membership) throw new TRPCError({ code: "FORBIDDEN" });
        const authResponse = pusher.authorizeChannel(input.socketId, input.channelName);
        return authResponse;
      }

      throw new TRPCError({ code: "FORBIDDEN" });
    }),
});