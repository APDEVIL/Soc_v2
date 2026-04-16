import { notFound } from "next/navigation";
import { api } from "@/trpc/server";
import { getSession } from "@/server/better-auth/server";
import { ProfileHeader } from "@/components/profile/profile-header";
import { ProfileTabs } from "@/components/profile/profile-tabs";

interface ProfilePageProps {
  // 1. Update the interface to reflect that params is a Promise
  params: Promise<{ username: string }>;
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  // 2. Await the params before extracting the username
  const { username } = await params;

  // 3. Use the awaited username in the API call
  const profile = await api.user.getProfile({ username }).catch(() => null);

  if (!profile) notFound();

  // Fetch the current session so we know if this is "our" profile
  const session = await getSession();
  const isOwnProfile = session?.user?.id === profile.id;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <ProfileHeader
        name={profile.name}
        username={profile.username}
        avatarUrl={profile.avatarUrl}
        bio={profile.bio}
        followerCount={profile.followerCount}
        followingCount={profile.followingCount}
        isFollowing={profile.isFollowing}
        userId={profile.id} // FIXED: Now passing the real ID
        isVerified={profile.isVerified} // FIXED: Now dynamic
        isPrivate={profile.isPrivate} // FIXED: Now dynamic
        postCount={profile.posts?.length ?? 0} // FIXED: Now dynamic
        isOwnProfile={isOwnProfile} // FIXED: Now dynamic
        isBlocked={profile.isBlocked} // FIXED: Now dynamic
      />
      <div className="mt-6">
        <ProfileTabs
          username={profile.username}
          isPrivate={profile.isPrivate}
          userId={profile.id} // FIXED: Passes real ID to the tRPC query!
          isOwnProfile={isOwnProfile} // FIXED: Allows "Saved" tab to appear
          isFollowing={profile.isFollowing}
        />
      </div>
    </div>
  );
}