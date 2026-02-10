/**
 * Sports data cache — stores Gemini-fetched data with 24hr TTL in Redis.
 * SERVERLESS-COMPATIBLE: Uses Redis for persistent, shared cache across all containers.
 * Smart: only fetches once per day, serves cached data to all users.
 */

import type { Sport, SportsDashboardData } from "@draftcrick/shared";
import { DEFAULT_SPORT } from "@draftcrick/shared";
import { fetchSportsData } from "./gemini-sports";
import Redis from "ioredis";

/** 24 hours in seconds (Redis uses seconds for TTL) */
const CACHE_TTL_SECONDS = 24 * 60 * 60;

/** Redis client singleton */
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

interface CacheEntry {
  data: SportsDashboardData;
  fetchedAt: number; // Date.now() timestamp
}

/** Track in-flight fetches to avoid duplicate Gemini calls within same container */
const inflight = new Map<string, Promise<SportsDashboardData>>();

/**
 * Get cached sports data from Redis, fetching from Gemini if stale or missing.
 * Deduplicates concurrent requests — only one Gemini call per sport across all containers.
 */
export async function getSportsDashboard(
  sport: Sport = DEFAULT_SPORT
): Promise<SportsDashboardData> {
  const key = `sports:dashboard:${sport}`;
  const lockKey = `sports:lock:${sport}`;
  
  try {
    const redisClient = getRedis();

    // Check if a fetch is already in flight in THIS container
    const pending = inflight.get(sport);
    if (pending) {
      return pending;
    }

    // Try to get from Redis cache
    const cached = await redisClient.get(key);
    if (cached) {
      const entry: CacheEntry = JSON.parse(cached);
      return entry.data;
    }

    // Cache miss - need to fetch from Gemini
    // Use Redis lock to prevent multiple containers from fetching simultaneously
    const lockAcquired = await redisClient.set(lockKey, "1", "EX", 30, "NX");
    
    if (!lockAcquired) {
      // Another container is fetching, wait a bit and try cache again
      await new Promise(resolve => setTimeout(resolve, 1000));
      const retryCache = await redisClient.get(key);
      if (retryCache) {
        const entry: CacheEntry = JSON.parse(retryCache);
        return entry.data;
      }
      // If still no cache, fall through to fetch
    }

    // Fetch fresh data
    const fetchPromise = fetchSportsData(sport)
      .then(async (data) => {
        const entry: CacheEntry = {
          data,
          fetchedAt: Date.now(),
        };
        
        // Store in Redis with 24hr TTL
        await redisClient.setex(key, CACHE_TTL_SECONDS, JSON.stringify(entry));
        
        // Release lock
        await redisClient.del(lockKey);
        inflight.delete(sport);
        
        return data;
      })
      .catch(async (err) => {
        // Release lock on error
        await redisClient.del(lockKey);
        inflight.delete(sport);
        
        console.error(`Gemini fetch failed for ${sport}:`, err);
        throw err;
      });

    inflight.set(sport, fetchPromise);
    return fetchPromise;

  } catch (error) {
    console.error(`Redis cache error for ${sport}:`, error);
    // Fallback to direct fetch if Redis fails
    return fetchSportsData(sport);
  }
}

/**
 * Force refresh cache for a sport (admin use).
 * Clears existing cache and fetches fresh data.
 */
export async function refreshSportsDashboard(
  sport: Sport = DEFAULT_SPORT
): Promise<SportsDashboardData> {
  const key = `sports:dashboard:${sport}`;
  
  try {
    const redisClient = getRedis();
    await redisClient.del(key);
  } catch (error) {
    console.error(`Redis delete error for ${sport}:`, error);
  }
  
  return getSportsDashboard(sport);
}

/**
 * Get cache status (for debugging / admin).
 */
export async function getCacheStatus(): Promise<Record<string, { fresh: boolean; fetchedAt: string; matchCount: number; tournamentCount: number } | null>> {
  const status: Record<string, any> = {};
  const sports: Sport[] = ["cricket", "football", "kabaddi", "basketball"];
  
  try {
    const redisClient = getRedis();
    
    for (const sport of sports) {
      const key = `sports:dashboard:${sport}`;
      const cached = await redisClient.get(key);
      
      if (cached) {
        const entry: CacheEntry = JSON.parse(cached);
        const age = Date.now() - entry.fetchedAt;
        status[sport] = {
          fresh: age < CACHE_TTL_SECONDS * 1000,
          fetchedAt: new Date(entry.fetchedAt).toISOString(),
          matchCount: entry.data.matches.length,
          tournamentCount: entry.data.tournaments.length,
        };
      } else {
        status[sport] = null;
      }
    }
  } catch (error) {
    console.error("Redis cache status error:", error);
  }
  
  return status;
}

/**
 * Close Redis connection (for graceful shutdown).
 */
export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}
