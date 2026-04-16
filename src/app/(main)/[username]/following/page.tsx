import { type Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { FollowingClient } from "./following-client";

interface FollowingPageProps {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: FollowingPageProps): Promise<Metadata> {
  const { username } = await params;
  return { title: `People @${username} follows · GoBuzz` };
}

export default async function FollowingPage({ params }: FollowingPageProps) {
  const { username } = await params;

  return (
    <div className="max-w-[600px] mx-auto px-4 py-6">
      {/* Header with back button */}
      <div className="flex items-center gap-4 mb-2">
        <Link 
          href={`/${username}`}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/50 hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-black leading-tight">Following</h1>
          <p className="text-xs text-muted-foreground font-medium">@{username}</p>
        </div>
      </div>

      {/* Render the list */}
      <FollowingClient username={username} />
    </div>
  );
}