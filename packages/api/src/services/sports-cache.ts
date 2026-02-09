/**
 * Sports data cache — stores Gemini-fetched data with 24hr TTL.
 * Uses in-memory store with optional Redis persistence.
 * Smart: only fetches once per day, serves cached data to all users.
 */

import type { Sport, SportsDashboardData } from "@draftcrick/shared";
import { DEFAULT_SPORT } from "@draftcrick/shared";
import { fetchSportsData } from "./gemini-sports";

/** 24 hours in milliseconds */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface CacheEntry {
  data: SportsDashboardData;
  fetchedAt: number; // Date.now() timestamp
}

/** In-memory cache keyed by sport */
const cache = new Map<string, CacheEntry>();

/** Track in-flight fetches to avoid duplicate Gemini calls */
const inflight = new Map<string, Promise<SportsDashboardData>>();

function isFresh(entry: CacheEntry | undefined): entry is CacheEntry {
  if (!entry) return false;
  return Date.now() - entry.fetchedAt < CACHE_TTL_MS;
}

/**
 * Get cached sports data, fetching from Gemini if stale or missing.
 * Deduplicates concurrent requests — only one Gemini call per sport.
 */
export async function getSportsDashboard(
  sport: Sport = DEFAULT_SPORT
): Promise<SportsDashboardData> {
  const key = sport;
  const existing = cache.get(key);

  // Return cached if fresh
  if (isFresh(existing)) {
    return existing.data;
  }

  // Check if a fetch is already in flight
  const pending = inflight.get(key);
  if (pending) {
    return pending;
  }

  // Fetch fresh data
  const fetchPromise = fetchSportsData(sport)
    .then((data) => {
      cache.set(key, { data, fetchedAt: Date.now() });
      inflight.delete(key);
      return data;
    })
    .catch((err) => {
      inflight.delete(key);
      // If we have stale data, return it on error
      if (existing) {
        console.warn(`Gemini fetch failed for ${sport}, returning stale data:`, err);
        return existing.data;
      }
      throw err;
    });

  inflight.set(key, fetchPromise);
  return fetchPromise;
}

/**
 * Force refresh cache for a sport (admin use).
 * Clears existing cache and fetches fresh data.
 */
export async function refreshSportsDashboard(
  sport: Sport = DEFAULT_SPORT
): Promise<SportsDashboardData> {
  cache.delete(sport);
  return getSportsDashboard(sport);
}

/**
 * Get cache status (for debugging / admin).
 */
export function getCacheStatus(): Record<string, { fresh: boolean; fetchedAt: string; matchCount: number; tournamentCount: number }> {
  const status: Record<string, any> = {};
  for (const [key, entry] of cache.entries()) {
    status[key] = {
      fresh: isFresh(entry),
      fetchedAt: new Date(entry.fetchedAt).toISOString(),
      matchCount: entry.data.matches.length,
      tournamentCount: entry.data.tournaments.length,
    };
  }
  return status;
}
