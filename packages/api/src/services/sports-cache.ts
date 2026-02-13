/**
 * Sports Cache — Thin Redis hot-cache layer (v3.0).
 *
 * Redis serves 3 roles:
 * 1. Hot cache (5min TTL) — avoid repeated PG queries
 * 2. Distributed refresh lock (30s TTL) — prevent duplicate Gemini calls
 * 3. Rate limiting — per-user request throttling
 *
 * PostgreSQL is the source of truth. See /docs/SMART_REFRESH_ARCHITECTURE.md.
 */

import { getLogger } from "../lib/logger";
import Redis from "ioredis";

const log = getLogger("sports-cache");

/** Hot cache TTL: 5 minutes */
const HOT_CACHE_TTL_SECONDS = 300;

/** Refresh lock TTL: 30 seconds */
const REFRESH_LOCK_TTL_SECONDS = 30;

/** Rate limit: requests per window */
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_SECONDS = 60;

// ---------------------------------------------------------------------------
// Redis client
// ---------------------------------------------------------------------------

let redis: Redis | null = null;

function getRedis(): Redis {
  if (!redis) {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error("REDIS_URL environment variable is required for caching");
    }
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
    });
  }
  return redis;
}

// ---------------------------------------------------------------------------
// 1. Hot Cache (5-minute TTL)
// ---------------------------------------------------------------------------

/**
 * Get data from Redis hot cache. Returns null on miss or Redis failure.
 */
export async function getFromHotCache<T>(key: string): Promise<T | null> {
  try {
    const redisClient = getRedis();
    const cached = await redisClient.get(`sports:hot:${key}`);
    if (cached) {
      log.debug({ key }, "Hot cache hit");
      return JSON.parse(cached) as T;
    }
    return null;
  } catch (error) {
    log.warn({ key, error: String(error) }, "Redis hot cache read failed");
    return null;
  }
}

/**
 * Store data in Redis hot cache with TTL.
 */
export async function setHotCache<T>(
  key: string,
  data: T,
  ttlSeconds: number = HOT_CACHE_TTL_SECONDS
): Promise<void> {
  try {
    const redisClient = getRedis();
    await redisClient.setex(
      `sports:hot:${key}`,
      ttlSeconds,
      JSON.stringify(data)
    );
    log.debug({ key, ttlSeconds }, "Hot cache set");
  } catch (error) {
    log.warn({ key, error: String(error) }, "Redis hot cache write failed");
  }
}

/**
 * Invalidate hot cache entries matching a key prefix.
 */
export async function invalidateHotCache(keyPrefix: string): Promise<void> {
  try {
    const redisClient = getRedis();
    const pattern = `sports:hot:${keyPrefix}*`;
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(...keys);
      log.debug({ pattern, count: keys.length }, "Hot cache invalidated");
    }
  } catch (error) {
    log.warn({ keyPrefix, error: String(error) }, "Redis hot cache invalidate failed");
  }
}

// ---------------------------------------------------------------------------
// 2. Distributed Refresh Lock (30-second TTL)
// ---------------------------------------------------------------------------

/**
 * Acquire a distributed lock for a refresh operation.
 * Returns true if lock acquired, false if another process holds it.
 */
export async function acquireRefreshLock(entityKey: string): Promise<boolean> {
  try {
    const redisClient = getRedis();
    const result = await redisClient.set(
      `sports:refresh-lock:${entityKey}`,
      "1",
      "EX",
      REFRESH_LOCK_TTL_SECONDS,
      "NX"
    );
    const acquired = result === "OK";
    log.debug({ entityKey, acquired }, "Refresh lock attempt");
    return acquired;
  } catch (error) {
    log.warn({ entityKey, error: String(error) }, "Redis lock acquire failed — proceeding without lock");
    // If Redis is down, allow the refresh (accept possible duplicate)
    return true;
  }
}

/**
 * Release a distributed refresh lock.
 */
export async function releaseRefreshLock(entityKey: string): Promise<void> {
  try {
    const redisClient = getRedis();
    await redisClient.del(`sports:refresh-lock:${entityKey}`);
    log.debug({ entityKey }, "Refresh lock released");
  } catch (error) {
    log.warn({ entityKey, error: String(error) }, "Redis lock release failed");
  }
}

// ---------------------------------------------------------------------------
// 3. Rate Limiting
// ---------------------------------------------------------------------------

/**
 * Check if a user has exceeded the rate limit for an endpoint.
 * Returns true if under limit, false if rate-limited.
 */
export async function checkRateLimit(
  userId: string,
  endpoint: string
): Promise<boolean> {
  try {
    const redisClient = getRedis();
    const key = `sports:rate:${userId}:${endpoint}`;
    const count = await redisClient.incr(key);

    if (count === 1) {
      // First request in window — set expiry
      await redisClient.expire(key, RATE_LIMIT_WINDOW_SECONDS);
    }

    if (count > RATE_LIMIT_MAX) {
      log.warn({ userId, endpoint, count }, "Rate limit exceeded");
      return false;
    }

    return true;
  } catch (error) {
    log.warn({ userId, endpoint, error: String(error) }, "Redis rate limit check failed — allowing");
    return true;
  }
}

// ---------------------------------------------------------------------------
// Connection management
// ---------------------------------------------------------------------------

/**
 * Close Redis connection (for graceful shutdown).
 */
export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}
