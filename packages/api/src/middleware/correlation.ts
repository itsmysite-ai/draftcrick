import { createMiddleware } from "hono/factory";
import { randomUUID } from "node:crypto";
import { requestContext, rootLogger } from "../lib/logger";

const QUIET_PATHS = ["/health", "/trpc/log.ingest"];

export const correlationMiddleware = createMiddleware(async (c, next) => {
  // Skip logging for OPTIONS preflight
  if (c.req.method === "OPTIONS") {
    return next();
  }

  const correlationId =
    c.req.header("x-correlation-id") ?? randomUUID().slice(0, 16);
  const userId = c.req.header("x-user-id") ?? "";
  const sessionId = c.req.header("x-session-id") ?? "";

  const ctx = { correlationId, userId, sessionId };

  return requestContext.run(ctx, async () => {
    const isQuiet = QUIET_PATHS.some((p) => c.req.path.startsWith(p));
    const start = Date.now();

    if (!isQuiet) {
      rootLogger.info(
        { method: c.req.method, path: c.req.path, correlationId, userId },
        "Request started"
      );
    }

    await next();

    if (!isQuiet) {
      rootLogger.info(
        {
          method: c.req.method,
          path: c.req.path,
          status: c.res.status,
          durationMs: Date.now() - start,
          correlationId,
        },
        "Request completed"
      );
    }
  });
});
