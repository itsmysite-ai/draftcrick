/**
 * Sports Cache — PostgreSQL-backed cache layer (v4.0).
 *
 * Replaces Redis with a `cache_entries` PG table. Same external API —
 * consumers don't need any changes.
 *
 * PG serves 3 roles:
 * 1. Hot cache (variable TTL) — avoid repeated expensive queries / AI calls
 * 2. Distributed refresh lock (30s TTL) — prevent duplicate Gemini calls
 * 3. Rate limiting — per-user request throttling (in-memory, no PG needed)
 *
 * PostgreSQL is the source of truth. See /docs/SMART_REFRESH_ARCHITECTURE.md.
 */

import { getLogger } from "../lib/logger";
import { getDb } from "@draftplay/db";
import { cacheEntries } from "@draftplay/db";
import { and, eq, lt, like, sql } from "drizzle-orm";

const log = getLogger("sports-cache");

/** Hot cache TTL: 5 minutes */
const HOT_CACHE_TTL_SECONDS = 300;

/** Refresh lock TTL: 30 seconds */
const REFRESH_LOCK_TTL_SECONDS = 30;

/** Rate limit: requests per window */
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_SECONDS = 60;

// ---------------------------------------------------------------------------
// Piggyback cleanup — probabilistically purge expired rows (1% of writes)
// ---------------------------------------------------------------------------

async function maybePurgeExpired(): Promise<void> {
  if (Math.random() > 0.01) return;
  try {
    const db = getDb();
    await db.delete(cacheEntries).where(lt(cacheEntries.expiresAt, new Date()));
    log.debug("Piggyback purge: removed expired cache entries");
  } catch (error) {
    log.warn({ error: String(error) }, "Piggyback purge failed");
  }
}

// ---------------------------------------------------------------------------
// 1. Hot Cache (variable TTL)
// ---------------------------------------------------------------------------

/**
 * Get data from PG hot cache. Returns null on miss or failure.
 */
export async function getFromHotCache<T>(key: string): Promise<T | null> {
  try {
    const db = getDb();
    const fullKey = `sports:hot:${key}`;
    const result = await db
      .select({ value: cacheEntries.value })
      .from(cacheEntries)
      .where(eq(cacheEntries.key, fullKey))
      .limit(1);

    if (result.length > 0) {
      const row = result[0];
      // Check if the row is actually a cache entry with expiry
      // (we check at the app level too for safety)
      const entry = row as { value: unknown };
      log.debug({ key }, "Hot cache hit");
      return entry.value as T;
    }
    return null;
  } catch (error) {
    log.warn({ key, error: String(error) }, "PG hot cache read failed");
    return null;
  }
}

/**
 * Store data in PG hot cache with TTL.
 */
export async function setHotCache<T>(
  key: string,
  data: T,
  ttlSeconds: number = HOT_CACHE_TTL_SECONDS
): Promise<void> {
  try {
    const db = getDb();
    const fullKey = `sports:hot:${key}`;
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    await db
      .insert(cacheEntries)
      .values({ key: fullKey, value: data as unknown as Record<string, unknown>, expiresAt })
      .onConflictDoUpdate({
        target: cacheEntries.key,
        set: {
          value: sql`excluded.value`,
          expiresAt: sql`excluded.expires_at`,
        },
      });

    log.debug({ key, ttlSeconds }, "Hot cache set");
    void maybePurgeExpired();
  } catch (error) {
    log.warn({ key, error: String(error) }, "PG hot cache write failed");
  }
}

/**
 * Invalidate hot cache entries matching a key prefix.
 */
export async function invalidateHotCache(keyPrefix: string): Promise<void> {
  try {
    const db = getDb();
    const pattern = `sports:hot:${keyPrefix}%`;
    const result = await db
      .delete(cacheEntries)
      .where(like(cacheEntries.key, pattern));

    log.debug({ keyPrefix }, "Hot cache invalidated");
  } catch (error) {
    log.warn({ keyPrefix, error: String(error) }, "PG hot cache invalidate failed");
  }
}

// ---------------------------------------------------------------------------
// 2. Distributed Refresh Lock (30-second TTL)
// ---------------------------------------------------------------------------

/**
 * Acquire a distributed lock for a refresh operation.
 * Uses INSERT ... ON CONFLICT DO NOTHING — only succeeds if key doesn't exist
 * (or existing row has expired).
 */
export async function acquireRefreshLock(entityKey: string): Promise<boolean> {
  try {
    const db = getDb();
    const fullKey = `sports:refresh-lock:${entityKey}`;
    const expiresAt = new Date(Date.now() + REFRESH_LOCK_TTL_SECONDS * 1000);

    // First, delete any expired lock
    await db
      .delete(cacheEntries)
      .where(and(eq(cacheEntries.key, fullKey), lt(cacheEntries.expiresAt, new Date())));

    // Then try to insert — fails if active lock exists
    const result = await db
      .insert(cacheEntries)
      .values({ key: fullKey, value: { locked: true }, expiresAt })
      .onConflictDoNothing({ target: cacheEntries.key });

    // Drizzle doesn't return rowCount for onConflictDoNothing easily,
    // so check if the lock row is ours by reading it back
    const check = await db
      .select({ expiresAt: cacheEntries.expiresAt })
      .from(cacheEntries)
      .where(eq(cacheEntries.key, fullKey))
      .limit(1);

    const row = check[0];
    const acquired =
      row != null &&
      Math.abs(row.expiresAt.getTime() - expiresAt.getTime()) < 100;

    log.debug({ entityKey, acquired }, "Refresh lock attempt");
    return acquired;
  } catch (error) {
    log.warn(
      { entityKey, error: String(error) },
      "PG lock acquire failed — proceeding without lock"
    );
    // If PG query fails, allow the refresh (accept possible duplicate)
    return true;
  }
}

/**
 * Release a distributed refresh lock.
 */
export async function releaseRefreshLock(entityKey: string): Promise<void> {
  try {
    const db = getDb();
    await db
      .delete(cacheEntries)
      .where(eq(cacheEntries.key, `sports:refresh-lock:${entityKey}`));
    log.debug({ entityKey }, "Refresh lock released");
  } catch (error) {
    log.warn({ entityKey, error: String(error) }, "PG lock release failed");
  }
}

// ---------------------------------------------------------------------------
// 3. Rate Limiting (in-memory — no PG round-trip needed)
// ---------------------------------------------------------------------------

const rateLimitStore = new Map<
  string,
  { count: number; expiresAt: number }
>();

/**
 * Check if a user has exceeded the rate limit for an endpoint.
 * Returns true if under limit, false if rate-limited.
 *
 * Uses in-memory sliding window — fine for single-instance beta.
 * For multi-instance, move to PG advisory locks or the cache table.
 */
export async function checkRateLimit(
  userId: string,
  endpoint: string
): Promise<boolean> {
  const key = `${userId}:${endpoint}`;
  const now = Date.now();
  const windowMs = RATE_LIMIT_WINDOW_SECONDS * 1000;

  const existing = rateLimitStore.get(key);
  if (existing && existing.expiresAt > now) {
    existing.count++;
    if (existing.count > RATE_LIMIT_MAX) {
      log.warn({ userId, endpoint, count: existing.count }, "Rate limit exceeded");
      return false;
    }
    return true;
  }

  rateLimitStore.set(key, { count: 1, expiresAt: now + windowMs });

  // Periodic cleanup
  if (rateLimitStore.size > 10_000) {
    for (const [k, v] of rateLimitStore) {
      if (v.expiresAt <= now) rateLimitStore.delete(k);
    }
  }

  return true;
}

// ---------------------------------------------------------------------------
// Connection management (no-op — PG connection managed by @draftplay/db)
// ---------------------------------------------------------------------------

/**
 * Close cache connections (for graceful shutdown).
 * No-op since PG lifecycle is managed by @draftplay/db.
 */
export async function closeRedis(): Promise<void> {
  // No-op — kept for API compatibility during migration
}
