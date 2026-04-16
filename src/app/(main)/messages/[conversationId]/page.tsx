import { type Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { getSession } from "@/server/better-auth/server";
import { db } from "@/server/db";
import { conversationMembers } from "@/server/db/schema";
import { and, eq } from "drizzle-orm";
import { ChatWindow } from "@/components/chat/chat-window";
import { ConversationList } from "@/components/chat/conversation-list";

interface Props {
  params: Promise<{ conversationId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { conversationId } = await params;
  return {
    title: `Chat · GoBuzz`,
    description: `Conversation ${conversationId}`,
  };
}

export default async function ConversationPage({ params }: Props) {
  const { conversationId } = await params;
  const session = await getSession();
  if (!session?.user) redirect("/login");

  // Server-side membership check — 404 if user is not in this conversation
  const membership = await db.query.conversationMembers.findFirst({
    where: and(
      eq(conversationMembers.conversationId, conversationId),
      eq(conversationMembers.userId, session.user.id),
    ),
  });

  if (!membership) notFound();

  return (
    // ✅ FIXED: Added md:mr-16 alongside md:ml-16 to perfectly frame the layout between BOTH rails
    <div className="flex h-[calc(100vh-0px)] md:h-screen md:ml-16 md:mr-16">
      {/* Sidebar — hidden on mobile when a conversation is open */}
      <div className="hidden md:flex w-80 lg:w-96 border-r border-border flex-col shrink-0 h-full">
        <ConversationList />
      </div>

      {/* Chat window */}
      <div className="flex flex-col flex-1 min-w-0 h-full">
        {/* Mobile back button */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border md:hidden">
          <Link
            href="/messages"
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </div>

        {/* The actual chat — client component handles all Pusher logic */}
        <div className="flex-1 min-h-0">
          <ChatWindow conversationId={conversationId} />
        </div>
      </div>
    </div>
  );
}