import { type Metadata } from "next";
import { SinglePostClient } from "./post-client";

interface PostPageProps {
  params: Promise<{ postId: string }>;
}

export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
  const { postId } = await params;
  return { 
    title: `Post · GoBuzz`,
    description: "View post on GoBuzz"
  };
}

export default async function SinglePostPage({ params }: PostPageProps) {
  const { postId } = await params;

  return (
    <div className="max-w-[600px] mx-auto px-4 py-6 md:py-10">
      <SinglePostClient postId={postId} />
    </div>
  );
}