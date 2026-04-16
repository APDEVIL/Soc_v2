import { notFound } from "next/navigation";
import { api } from "@/trpc/server";
import { GroupHeader } from "@/components/groups/group-header";
import { GroupFeedClient } from "./group-client";
import type { Metadata } from "next";

interface Props {
  // Await params for Next.js 15+
  params: Promise<{ groupId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { groupId } = await params;
  return { title: `Group · ${groupId}` };
}

export default async function GroupDetailPage({ params }: Props) {
  const { groupId } = await params;

  // Fetch the real group data from the server!
  // Note: if your backend expects `{ id: groupId }` instead, change this payload
  const group = await api.group.getGroup({ groupId }).catch(() => null);

  if (!group) notFound();

  return (
    <div className="max-w-[800px] mx-auto">
      {/* Pass the real, dynamic data instead of hardcoded strings */}
      <GroupHeader 
        id={group.id} 
        name={group.name} 
        memberCount={group.memberCount ?? 0} 
        postCount={group.postCount ?? 0} 
        isPrivate={group.isPrivate ?? false} 
        isMember={group.isMember ?? false} 
        myRole={group.myRole ?? null} 
        createdBy={group.createdBy ?? { id: "", username: "", avatarUrl: null }} 
        members={group.members?.map(m => ({
          id: m.user.id,
          username: m.user.username,
          name: m.user.name,
          avatarUrl: m.user.avatarUrl,
          isVerified: m.user.isVerified
        })) ?? []} 
      />
      <div className="px-4 py-4">
        <GroupFeedClient groupId={groupId} />
      </div>
    </div>
  );
}