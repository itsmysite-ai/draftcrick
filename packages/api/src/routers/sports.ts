/**
 * Sports data router — serves tournaments and matches via smart refresh architecture.
 *
 * Flow: Redis hot cache (5min) → PostgreSQL (source of truth) → Gemini API (on stale).
 * See /docs/SMART_REFRESH_ARCHITECTURE.md for full spec.
 */

import { z } from "zod";
import { router, publicProcedure, adminProcedure } from "../trpc";
import {
  getDashboardFromPg,
  shouldRefreshDashboard,
  executeRefresh,
} from "../services/sports-data";
import {
  getFromHotCache,
  setHotCache,
  invalidateHotCache,
} from "../services/sports-cache";
import { getLogger } from "../lib/logger";
import type { Sport, SportsDashboardData, AITeamStanding } from "@draftcrick/shared";
import { fetchSportsData } from "../services/gemini-sports";
import { getDb } from "@draftcrick/db";
import { tournaments } from "@draftcrick/db";
import { eq, and } from "drizzle-orm";

const log = getLogger("sports-router");

/** Feature flag: set SMART_REFRESH_ENABLED=false to bypass PG and use direct Gemini (v2 fallback) */
const SMART_REFRESH_ENABLED = process.env.SMART_REFRESH_ENABLED !== "false";

const sportInput = z.object({
  sport: z
    .enum(["cricket", "football", "kabaddi", "basketball"])
    .default("cricket"),
});

/**
 * Core function: get dashboard with smart refresh.
 * 1. Check Redis hot cache
 * 2. Check PostgreSQL
 * 3. Trigger Gemini refresh if stale (stale-while-revalidate)
 * 4. Cold start: wait for Gemini if no PG data
 */
async function getSmartDashboard(sport: Sport): Promise<SportsDashboardData> {
  // Fallback: bypass PG persistence, call Gemini directly (v2 behavior)
  if (!SMART_REFRESH_ENABLED) {
    log.info({ sport }, "Smart refresh disabled — direct Gemini fetch");
    return fetchSportsData(sport);
  }

  const cacheKey = `dashboard:${sport}`;

  // 1. Redis hot cache
  const cached = await getFromHotCache<SportsDashboardData>(cacheKey);
  if (cached) {
    return cached;
  }

  // 2. PostgreSQL
  const pgData = await getDashboardFromPg(sport);

  if (pgData) {
    // Check staleness
    const stale = await shouldRefreshDashboard(sport);
    if (stale) {
      // Stale-while-revalidate: return existing data, refresh in background
      log.info({ sport }, "PG data stale — returning existing + triggering background refresh");
      executeRefresh(sport, "user_request").then(async (result) => {
        if (result.refreshed) {
          // Invalidate hot cache so next request gets fresh data
          await invalidateHotCache(`dashboard:${sport}`);
        }
      }).catch((err) => {
        log.error({ sport, error: String(err) }, "Background refresh failed");
      });
    }

    // Populate hot cache with current PG data
    await setHotCache(cacheKey, pgData);
    return pgData;
  }

  // 3. Cold start — no PG data at all. Must wait for Gemini fetch.
  log.info({ sport }, "Cold start — waiting for Gemini fetch");
  const result = await executeRefresh(sport, "cold_start");

  if (result.refreshed) {
    const freshData = await getDashboardFromPg(sport);
    if (freshData) {
      await setHotCache(cacheKey, freshData);
      return freshData;
    }
  }

  // Fallback: return empty data
  log.warn({ sport }, "Cold start failed — returning empty dashboard");
  return {
    tournaments: [],
    matches: [],
    lastFetched: new Date().toISOString(),
    sources: [],
    sport,
  };
}

export const sportsRouter = router({
  /**
   * Get the full dashboard for a sport — tournaments + matches.
   * Smart refresh: Redis hot cache → PG → Gemini (if stale).
   */
  dashboard: publicProcedure
    .input(sportInput)
    .query(async ({ input }) => {
      return getSmartDashboard(input.sport as Sport);
    }),

  /**
   * Get only today's matches for a sport.
   */
  todayMatches: publicProcedure
    .input(sportInput)
    .query(async ({ input }) => {
      const data = await getSmartDashboard(input.sport as Sport);
      return {
        matches: data.matches,
        lastFetched: data.lastFetched,
        sources: data.sources,
      };
    }),

  /**
   * Get only active tournaments for a sport.
   */
  tournaments: publicProcedure
    .input(sportInput)
    .query(async ({ input }) => {
      const data = await getSmartDashboard(input.sport as Sport);
      return {
        tournaments: data.tournaments,
        lastFetched: data.lastFetched,
      };
    }),

  /**
   * Get tournament standings (points table) from PostgreSQL.
   * Standings are populated by the Gemini refresh flow.
   */
  standings: publicProcedure
    .input(
      z.object({
        tournamentName: z.string(),
        sport: z
          .enum(["cricket", "football", "kabaddi", "basketball"])
          .default("cricket"),
      })
    )
    .query(async ({ input }): Promise<AITeamStanding[]> => {
      const db = getDb();
      const rows = await db
        .select({ standings: tournaments.standings })
        .from(tournaments)
        .where(
          and(
            eq(tournaments.name, input.tournamentName),
            eq(tournaments.sport, input.sport)
          )
        )
        .limit(1);

      const raw = rows[0]?.standings;
      if (!raw || !Array.isArray(raw) || raw.length === 0) {
        return [];
      }
      return raw as AITeamStanding[];
    }),

  /**
   * Get only live matches.
   */
  liveMatches: publicProcedure
    .input(sportInput)
    .query(async ({ input }) => {
      const data = await getSmartDashboard(input.sport as Sport);
      return {
        matches: data.matches.filter((m) => m.status === "live"),
        lastFetched: data.lastFetched,
      };
    }),

  /**
   * Force refresh — clears hot cache and triggers immediate Gemini fetch.
   * Admin only.
   */
  refresh: adminProcedure
    .input(sportInput)
    .mutation(async ({ input }) => {
      const sport = input.sport as Sport;
      await invalidateHotCache(`dashboard:${sport}`);
      const result = await executeRefresh(sport, "manual");
      if (result.refreshed) {
        const data = await getDashboardFromPg(sport);
        if (data) {
          await setHotCache(`dashboard:${sport}`, data);
          return data;
        }
      }
      return getDashboardFromPg(sport);
    }),

  /**
   * Get cache/refresh status for monitoring.
   * Shows data source, freshness, and refresh history.
   */
  cacheStatus: publicProcedure.query(async () => {
    const sports: Sport[] = ["cricket", "football", "kabaddi", "basketball"];
    const status: Record<string, any> = {};

    for (const sport of sports) {
      const hotCacheData = await getFromHotCache<SportsDashboardData>(
        `dashboard:${sport}`
      );
      const pgData = await getDashboardFromPg(sport);

      if (pgData) {
        const stale = await shouldRefreshDashboard(sport);
        status[sport] = {
          fresh: !stale,
          fetchedAt: pgData.lastFetched,
          matchCount: pgData.matches.length,
          tournamentCount: pgData.tournaments.length,
          source: "postgresql",
          hotCacheHit: hotCacheData !== null,
        };
      } else {
        status[sport] = null;
      }
    }

    return status;
  }),
});
