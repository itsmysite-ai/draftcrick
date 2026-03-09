import { config } from "dotenv";
import { resolve } from "path";

// Load environment variables: .env.local overrides .env
config({ path: resolve(__dirname, "../../../.env.local"), override: true });
config({ path: resolve(__dirname, "../../../.env") });

import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serve } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./routers";
import type { TRPCContext } from "./trpc";
import { getDb } from "@draftplay/db";
import { users } from "@draftplay/db";
import { eq } from "drizzle-orm";
import { verifyIdToken, extractBearerToken } from "./services/auth";
import { getUserTier } from "./services/subscription";
import type { SubscriptionTier } from "@draftplay/shared";
import { razorpayWebhook } from "./webhooks/razorpay";

export type { AppRouter } from "./routers";

const app = new Hono();

// Global middleware
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:8081",
      "exp://localhost:8081",
    ],
    credentials: true,
  })
);

// Health check
app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Razorpay webhook (raw Hono route — outside tRPC/auth)
app.route("/webhooks/razorpay", razorpayWebhook);

// tRPC handler
app.use("/trpc/*", async (c) => {
  // Extract user from Firebase Auth ID token (if present)
  let user: TRPCContext["user"] = null;
  let db: TRPCContext["db"];
  try {
    db = getDb();
  } catch {
    return c.json({ error: "Database unavailable" }, 503);
  }
  try {
    const token = extractBearerToken(c.req.raw.headers);
    if (token) {
      const decoded = await verifyIdToken(token);
      if (decoded) {
        // Look up internal UUID from Firebase UID
        let dbUser = await db.query.users.findFirst({
          where: eq(users.firebaseUid, decoded.uid),
        });

        // Auto-create user record if authenticated but not yet synced
        if (!dbUser) {
          const email = decoded.email ?? null;
          const suffix = Math.random().toString(36).slice(2, 6);
          const base = email
            ? email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 14)
            : `user_${decoded.uid.slice(0, 8)}`;
          const username = `${base}_${suffix}`;

          // If email exists (e.g., re-created Firebase account), update firebaseUid
          if (email) {
            const byEmail = await db.query.users.findFirst({
              where: eq(users.email, email),
            });
            if (byEmail) {
              await db.update(users)
                .set({ firebaseUid: decoded.uid, updatedAt: new Date() })
                .where(eq(users.id, byEmail.id));
              dbUser = { ...byEmail, firebaseUid: decoded.uid };
            }
          }

          if (!dbUser) {
            try {
              const [created] = await db
                .insert(users)
                .values({
                  firebaseUid: decoded.uid,
                  email,
                  username,
                  displayName: decoded.name ?? username,
                })
                .onConflictDoNothing({ target: users.firebaseUid })
                .returning();
              dbUser = created ?? await db.query.users.findFirst({
                where: eq(users.firebaseUid, decoded.uid),
              });
            } catch (insertErr) {
              console.error("[AUTH] User insert failed, retrying:", (insertErr as Error)?.message);
              // Could be username or email collision — retry with different suffix
              try {
                const retry = `${base}_${Math.random().toString(36).slice(2, 7)}`;
                const [created] = await db
                  .insert(users)
                  .values({
                    firebaseUid: decoded.uid,
                    email,
                    username: retry,
                    displayName: decoded.name ?? retry,
                  })
                  .onConflictDoNothing({ target: users.firebaseUid })
                  .returning();
                dbUser = created ?? await db.query.users.findFirst({
                  where: eq(users.firebaseUid, decoded.uid),
                });
              } catch (retryErr) {
                console.error("[AUTH] User insert retry also failed:", (retryErr as Error)?.message);
              }
            }
          }
        }

        if (dbUser) {
          user = {
            id: dbUser.id,
            firebaseUid: decoded.uid,
            role: dbUser.role,
            email: decoded.email ?? null,
          };
        }
      }
    }
  } catch (authErr) {
    // Log auth errors for debugging — don't silently swallow
    console.error("[AUTH] Failed to resolve user:", (authErr as Error)?.message);
  }

  // Resolve subscription tier for authenticated users
  let tier: SubscriptionTier | undefined;
  if (user) {
    try {
      tier = await getUserTier(db, user.id);
    } catch {
      tier = "free"; // graceful fallback
    }
  }

  const response = await fetchRequestHandler({
    endpoint: "/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext: (): TRPCContext => ({
      db,
      user,
      tier,
      req: c as unknown as TRPCContext["req"],
    }),
  });
  return response;
});

// Start server
const port = parseInt(process.env.PORT ?? "3001", 10);

if (process.env.NODE_ENV !== "test") {
  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`DraftPlay API running on http://localhost:${info.port}`);
    console.log(`  tRPC:   http://localhost:${info.port}/trpc`);
    console.log(`  Health: http://localhost:${info.port}/health`);
  });
}

export default app;
