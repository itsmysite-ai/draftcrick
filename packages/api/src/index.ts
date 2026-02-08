import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serve } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./routers";
import type { TRPCContext } from "./trpc";

// Re-export types for client consumption
export type { AppRouter } from "./routers";

const app = new Hono();

// Global middleware
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: [
      "http://localhost:3000", // Next.js web
      "http://localhost:8081", // Expo
      "exp://localhost:8081",
    ],
    credentials: true,
  })
);

// Health check
app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

// tRPC handler using fetch adapter (works with Hono)
app.use("/trpc/*", async (c) => {
  const response = await fetchRequestHandler({
    endpoint: "/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext: (): TRPCContext => {
      // DB and auth context will be properly wired with environment setup
      return {
        db: null as unknown as TRPCContext["db"],
        user: null,
        req: null as unknown as TRPCContext["req"],
      };
    },
  });
  return response;
});

// Start server
const port = parseInt(process.env.PORT ?? "3001", 10);

if (process.env.NODE_ENV !== "test") {
  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`DraftCrick API running on http://localhost:${info.port}`);
    console.log(`  tRPC endpoint: http://localhost:${info.port}/trpc`);
    console.log(`  Health check:  http://localhost:${info.port}/health`);
  });
}

export default app;
