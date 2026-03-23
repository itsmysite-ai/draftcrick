/**
 * In-memory rate limiting middleware for Hono.
 * Uses sliding window counter — no external dependencies.
 *
 * Default: 100 requests per minute per authenticated user (or per IP).
 * Returns 429 Too Many Requests with Retry-After header when exceeded.
 */

import type { MiddlewareHandler } from "hono";
import { getLogger } from "../lib/logger";

const log = getLogger("rate-limit");

interface RateLimitOptions {
  maxPerMinute?: number;
  keyPrefix?: string;
}

/**
 * Create a rate limiting middleware.
 * Uses in-memory sliding window counter.
 */
export function rateLimitMiddleware(options: RateLimitOptions = {}): MiddlewareHandler {
  const { maxPerMinute = 100, keyPrefix = "rl" } = options;

  const store = new Map<string, { count: number; expiresAt: number }>();

  return async (c, next) => {
    // Extract identifier: user ID (from auth header hash) or client IP
    const authHeader = c.req.header("authorization") ?? "";
    const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim()
      ?? c.req.header("cf-connecting-ip")
      ?? c.req.header("fly-client-ip")
      ?? "unknown";

    // Use a hash of the auth token for user-based limiting, else IP
    const identifier = authHeader
      ? `user:${simpleHash(authHeader)}`
      : `ip:${ip}`;

    const key = `${keyPrefix}:${identifier}`;
    const now = Date.now();
    const windowMs = 60_000; // 1 minute

    const existing = store.get(key);
    let currentCount: number;

    if (existing && existing.expiresAt > now) {
      existing.count++;
      currentCount = existing.count;
    } else {
      store.set(key, { count: 1, expiresAt: now + windowMs });
      currentCount = 1;
    }

    // Periodic cleanup
    if (store.size > 10_000) {
      for (const [k, v] of store) {
        if (v.expiresAt <= now) store.delete(k);
      }
    }

    // Set rate limit headers
    c.header("X-RateLimit-Limit", String(maxPerMinute));
    c.header("X-RateLimit-Remaining", String(Math.max(0, maxPerMinute - currentCount)));

    if (currentCount > maxPerMinute) {
      c.header("Retry-After", "60");
      log.warn({ identifier, currentCount, maxPerMinute }, "Rate limit exceeded");
      return c.json({ error: "Too many requests. Please try again later." }, 429);
    }

    await next();
  };
}

/** Simple string hash for auth token identification (not cryptographic) */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}
