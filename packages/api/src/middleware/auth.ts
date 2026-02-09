import type { MiddlewareHandler } from "hono";
import { verifyIdToken, extractBearerToken } from "../services/auth";

/**
 * Firebase Auth middleware.
 * Extracts and verifies the Firebase ID token from the Authorization header.
 * Sets userId and userEmail on Hono context for downstream handlers.
 */
export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const token = extractBearerToken(c.req.raw.headers);
  if (token) {
    const decoded = await verifyIdToken(token);
    if (decoded) {
      c.set("userId", decoded.uid);
      c.set("userEmail", decoded.email ?? null);
    }
  }

  await next();
};
