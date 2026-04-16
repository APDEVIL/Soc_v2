import { createUploadthing, type FileRouter } from "uploadthing/next";
import { getSession } from "@/server/better-auth/server";

const f = createUploadthing();

const auth = async () => {
  const session = await getSession();
  if (!session?.user) throw new Error("Unauthorized");
  return { userId: session.user.id };
};

export const ourFileRouter = {
  // Profile avatar — single image, max 4MB
  avatar: f({ image: { maxFileSize: "4MB", maxFileCount: 1 } })
    .middleware(async () => auth())
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("Avatar uploaded by:", metadata.userId, "→", file.url);
      return { uploadedBy: metadata.userId, url: file.url };
    }),

  // Post media — up to 10 images and/or videos
  postImage: f({ 
    image: { maxFileSize: "8MB", maxFileCount: 10 },
    video: { maxFileSize: "64MB", maxFileCount: 10 } 
  })
    .middleware(async () => auth())
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("Post image uploaded by:", metadata.userId, "→", file.url);
      return { uploadedBy: metadata.userId, url: file.url };
    }),

  // Reels — single video, max 256MB
  reel: f({ video: { maxFileSize: "256MB", maxFileCount: 1 } })
    .middleware(async () => auth())
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("Reel uploaded by:", metadata.userId, "→", file.url);
      return { uploadedBy: metadata.userId, url: file.url };
    }),

  // Stories — single image or video, max 32MB
  story: f({
    image: { maxFileSize: "32MB", maxFileCount: 1 },
    video: { maxFileSize: "32MB", maxFileCount: 1 },
  })
    .middleware(async () => auth())
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("Story uploaded by:", metadata.userId, "→", file.url);
      return { uploadedBy: metadata.userId, url: file.url };
    }),

  // Chat media — images/videos in messages, max 32MB
  chatMedia: f({
    image: { maxFileSize: "32MB", maxFileCount: 4 },
    video: { maxFileSize: "64MB", maxFileCount: 1 },
  })
    .middleware(async () => auth())
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("Chat media uploaded by:", metadata.userId, "→", file.url);
      return { uploadedBy: metadata.userId, url: file.url };
    }),

  // Group cover image — single image, max 8MB
  groupCover: f({ image: { maxFileSize: "8MB", maxFileCount: 1 } })
    .middleware(async () => auth())
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("Group cover uploaded by:", metadata.userId, "→", file.url);
      return { uploadedBy: metadata.userId, url: file.url };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;