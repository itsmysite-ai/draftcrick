import { config } from "dotenv";
import { resolve } from "path";

// Load environment variables from root .env.local
config({ path: resolve(__dirname, "../../../.env.local") });

// Sentry — use real SDK in production, graceful no-op if not installed
let Sentry: {
  init: (...args: unknown[]) => void;
  captureException: (...args: unknown[]) => void;
  flush: (ms: number) => Promise<boolean>;
};
try {
  Sentry = require("@sentry/node");
} catch {
  Sentry = {
    init: () => {},
    captureException: () => {},
    flush: () => Promise.resolve(true),
  };
}
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
import { revenuecatWebhook } from "./webhooks/revenuecat";
import { rateLimitMiddleware } from "./middleware/rate-limit";
import { getLogger } from "./lib/logger";

export type { AppRouter } from "./routers";

const log = getLogger("api");

// ---------------------------------------------------------------------------
// Sentry — error monitoring (must init before anything else)
// ---------------------------------------------------------------------------

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? "development",
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,
    beforeSend(event) {
      // Strip PII from error reports
      if (event.request?.headers) {
        delete event.request.headers["authorization"];
        delete event.request.headers["cookie"];
      }
      return event;
    },
  });
  log.info("Sentry initialized");
}

// ---------------------------------------------------------------------------
// Environment validation
// ---------------------------------------------------------------------------

function validateEnv(): void {
  const required = ["DATABASE_URL"];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    log.fatal({ missing }, "Missing required environment variables — cannot start");
    process.exit(1);
  }

  const optional = [
    "RAZORPAY_KEY_ID",
    "RAZORPAY_KEY_SECRET",
    "REVENUECAT_WEBHOOK_AUTH_KEY",
    "SENTRY_DSN",
    "GEMINI_API_KEY",
  ];
  const missingOptional = optional.filter((key) => !process.env[key]);
  if (missingOptional.length > 0) {
    log.warn({ missing: missingOptional }, "Optional environment variables not set");
  }
}

validateEnv();

// ---------------------------------------------------------------------------
// App setup
// ---------------------------------------------------------------------------

const app = new Hono();

// CORS — configurable via env var (comma-separated origins)
const allowedOrigins = (
  process.env.CORS_ORIGINS ?? "http://localhost:3000,http://localhost:8081,exp://localhost:8081"
).split(",").map((o) => o.trim());

// Global middleware
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

// Rate limiting
app.use("/trpc/*", rateLimitMiddleware({ maxPerMinute: 100, keyPrefix: "rl:trpc" }));
app.use("/webhooks/*", rateLimitMiddleware({ maxPerMinute: 50, keyPrefix: "rl:webhook" }));

// Health check
app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Payment webhooks (raw Hono routes — outside tRPC/auth)
app.route("/webhooks/razorpay", razorpayWebhook);
app.route("/webhooks/revenuecat", revenuecatWebhook);

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
              log.error({ error: (insertErr as Error)?.message }, "User insert failed, retrying");
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
                log.error({ error: (retryErr as Error)?.message }, "User insert retry also failed");
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
    log.error({ error: (authErr as Error)?.message }, "Failed to resolve user");
    Sentry.captureException(authErr);
  }

  // Resolve subscription tier for authenticated users
  let tier: SubscriptionTier | undefined;
  if (user) {
    try {
      tier = await getUserTier(db, user.id);
    } catch {
      tier = "basic"; // graceful fallback
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
    log.info({ port: info.port }, "DraftPlay API running");
    log.info({ trpc: `http://localhost:${info.port}/trpc`, health: `http://localhost:${info.port}/health` }, "Endpoints");
  });
}

// Global unhandled error capture
process.on("uncaughtException", (err) => {
  log.fatal({ error: err.message }, "Uncaught exception");
  Sentry.captureException(err);
  Sentry.flush(2000).then(() => process.exit(1));
});

process.on("unhandledRejection", (reason) => {
  log.error({ reason: String(reason) }, "Unhandled rejection");
  Sentry.captureException(reason);
});

export default app;
