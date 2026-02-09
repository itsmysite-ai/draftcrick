import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serve } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./routers";
import type { TRPCContext } from "./trpc";
import { getDb } from "@draftcrick/db";
import { verifyIdToken, extractBearerToken } from "./services/auth";

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

// tRPC handler
app.use("/trpc/*", async (c) => {
  // Extract user from Firebase Auth ID token (if present)
  let user: TRPCContext["user"] = null;
  try {
    const token = extractBearerToken(c.req.raw.headers);
    if (token) {
      const decoded = await verifyIdToken(token);
      if (decoded) {
        user = {
          id: decoded.uid,
          role: (decoded.role as string) ?? "user",
          email: decoded.email ?? null,
        };
      }
    }
  } catch {
    // No auth available — proceed as guest
  }

  let db: TRPCContext["db"];
  try {
    db = getDb();
  } catch {
    return c.json({ error: "Database unavailable" }, 503);
  }

  const response = await fetchRequestHandler({
    endpoint: "/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext: (): TRPCContext => ({
      db,
      user,
      req: c as unknown as TRPCContext["req"],
    }),
  });
  return response;
});

// Start server
const port = parseInt(process.env.PORT ?? "3001", 10);

if (process.env.NODE_ENV !== "test") {
  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`DraftCrick API running on http://localhost:${info.port}`);
    console.log(`  tRPC:   http://localhost:${info.port}/trpc`);
    console.log(`  Health: http://localhost:${info.port}/health`);
  });
}

export default app;
