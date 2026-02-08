import type { MiddlewareHandler } from "hono";

/**
 * Auth middleware placeholder.
 * In production, this extracts the user from the Better Auth session.
 */
export const authMiddleware: MiddlewareHandler = async (c, next) => {
  // Better Auth will set the user on the context.
  // For now, we extract from a session cookie or Bearer token.
  // This will be properly wired in the auth setup step.
  const authHeader = c.req.header("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    // Token-based auth will be validated by Better Auth
    c.set("userId", null);
  }

  await next();
};
