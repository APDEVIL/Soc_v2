import { type Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/server/better-auth/server";
import { ConversationList } from "@/components/chat/conversation-list";

export const metadata: Metadata = {
  title: "Messages · GoBuzz",
  description: "Your direct messages",
};

export default async function MessagesPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  return (
    // FIXED: Added md:ml-16 so the messages layout clears the fixed left navigation rail
    <div className="flex h-[calc(100vh-0px)] md:h-screen md:ml-16">
      {/* Conversation list — full width on mobile, sidebar on desktop */}
      <div className="w-full md:w-80 lg:w-96 border-r border-border flex flex-col shrink-0 h-full">
        <ConversationList />
      </div>

      {/* Empty state for desktop — shown when no conversation is open */}
      <div className="hidden md:flex flex-1 flex-col items-center justify-center gap-4 bg-muted/20">
        <div className="flex flex-col items-center text-center px-8 max-w-sm">
          {/* Animated icon */}
          <div
            className="h-20 w-20 rounded-2xl flex items-center justify-center mb-5 shadow-lg"
            style={{ backgroundColor: "hsl(var(--brand))" }}
          >
            <svg
              viewBox="0 0 40 40"
              className="h-10 w-10"
              fill="none"
              aria-hidden
            >
              {/* Speech bubble */}
              <path
                d="M6 8C6 6.9 6.9 6 8 6H32C33.1 6 34 6.9 34 8V26C34 27.1 33.1 28 32 28H14L8 34V28H8C6.9 28 6 27.1 6 26V8Z"
                fill="rgba(0,0,0,0.15)"
                stroke="rgba(0,0,0,0.25)"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              {/* Dots */}
              <circle cx="15" cy="17" r="2" fill="rgba(0,0,0,0.4)" />
              <circle cx="20" cy="17" r="2" fill="rgba(0,0,0,0.4)" />
              <circle cx="25" cy="17" r="2" fill="rgba(0,0,0,0.4)" />
            </svg>
          </div>
          <h2 className="text-xl font-black">Your messages</h2>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            Select a conversation from the left, or start a new one by clicking the icon above.
          </p>
        </div>
      </div>
    </div>
  );
}