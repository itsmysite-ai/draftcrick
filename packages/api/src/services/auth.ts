import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

/**
 * Better Auth configuration.
 * Self-hosted on Cloud Run alongside the Hono API server.
 *
 * Supports: Email/password, Google, Apple, Phone OTP, Magic Link
 */
export function createAuth(db: unknown) {
  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "pg",
    }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false, // Enable in production
    },
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID ?? "",
        clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      },
      apple: {
        clientId: process.env.APPLE_CLIENT_ID ?? "",
        clientSecret: process.env.APPLE_CLIENT_SECRET ?? "",
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 days
      updateAge: 60 * 60 * 24, // Refresh every day
    },
    trustedOrigins: [
      "http://localhost:3000", // Next.js web dev
      "http://localhost:8081", // Expo dev
      "exp://localhost:8081",
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
