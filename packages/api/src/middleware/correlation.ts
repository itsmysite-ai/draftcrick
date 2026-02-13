import { createMiddleware } from "hono/factory";
import { randomUUID } from "node:crypto";
import { requestContext } from "../lib/logger";

/**
 * Correlation ID middleware — assigns a unique ID to each request
 * and stores it in AsyncLocalStorage for structured logging.
 */
export const correlationMiddleware = createMiddleware(async (c, next) => {
  const correlationId =
    c.req.header("x-correlation-id") ?? randomUUID().slice(0, 8);
  c.header("x-correlation-id", correlationId);

  await requestContext.run({ correlationId }, async () => {
    await next();
  });
});
