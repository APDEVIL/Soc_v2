import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
    /**
     * Specify your server-side environment variables schema here.
     */
    server: {
        BETTER_AUTH_SECRET:
            process.env.NODE_ENV === "production"
                ? z.string()
                : z.string().optional(),
        BETTER_AUTH_URL: z.string().url(),
        BETTER_AUTH_GITHUB_CLIENT_ID: z.string(),
        BETTER_AUTH_GITHUB_CLIENT_SECRET: z.string(),
        DATABASE_URL: z.string().url(),
        NODE_ENV: z
            .enum(["development", "test", "production"])
            .default("development"),
        
        // Pusher (Server Only)
        PUSHER_APP_ID: z.string(),
        PUSHER_SECRET: z.string(),

        // UploadThing
        UPLOADTHING_SECRET: z.string(),
        UPLOADTHING_APP_ID: z.string(),
        UPLOADTHING_TOKEN: z.string(),
    },

    /**
     * Specify your client-side environment variables schema here.
     */
    client: {
        // Pusher (Exposed to the browser)
        NEXT_PUBLIC_PUSHER_KEY: z.string(),
        NEXT_PUBLIC_PUSHER_CLUSTER: z.string(),
    },

    /**
     * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
     * middlewares) or client-side so we need to destruct manually.
     */
    runtimeEnv: {
        BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
        BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
        BETTER_AUTH_GITHUB_CLIENT_ID: process.env.BETTER_AUTH_GITHUB_CLIENT_ID,
        BETTER_AUTH_GITHUB_CLIENT_SECRET: process.env.BETTER_AUTH_GITHUB_CLIENT_SECRET,
        DATABASE_URL: process.env.DATABASE_URL,
        NODE_ENV: process.env.NODE_ENV,
        
        // Pusher
        PUSHER_APP_ID: process.env.PUSHER_APP_ID,
        NEXT_PUBLIC_PUSHER_KEY: process.env.NEXT_PUBLIC_PUSHER_KEY,
        PUSHER_SECRET: process.env.PUSHER_SECRET,
        NEXT_PUBLIC_PUSHER_CLUSTER: process.env.NEXT_PUBLIC_PUSHER_CLUSTER,

        // UploadThing
        UPLOADTHING_SECRET: process.env.UPLOADTHING_SECRET,
        UPLOADTHING_APP_ID: process.env.UPLOADTHING_APP_ID,
        UPLOADTHING_TOKEN: process.env.UPLOADTHING_TOKEN,
    },
    
    skipValidation: !!process.env.SKIP_ENV_VALIDATION,
    emptyStringAsUndefined: true,
});