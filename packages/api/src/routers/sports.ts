/**
 * Sports data router — serves tournaments and matches as a read-only layer.
 *
 * Flow: PG hot cache (5min) → PostgreSQL (source of truth).
 * All Gemini refreshes are admin-initiated only (discover, toggle visible, force refresh).
 * See /docs/SMART_REFRESH_ARCHITECTURE.md for full spec.
 */

import { z } from "zod";
import { router, publicProcedure, adminProcedure } from "../trpc";
import {
  getDashboardFromPg,
  executeRefresh,
  shouldRefreshDashboard,
} from "../services/sports-data";
import {
  getFromHotCache,
  setHotCache,
  invalidateHotCache,
} from "../services/sports-cache";
import { getLogger } from "../lib/logger";
import type { Sport, SportsDashboardData, AITeamStanding } from "@draftplay/shared";
import { getDb } from "@draftplay/db";
import { tournaments } from "@draftplay/db";
import { eq, and } from "drizzle-orm";
import { getVisibleTournamentNames, getEffectiveTeamRules } from "../services/admin-config";

const log = getLogger("sports-router");

/** Filter dashboard data to only include admin-visible tournaments and their matches. */
async function filterActiveTournaments(data: SportsDashboardData): Promise<SportsDashboardData> {
  const activeTournaments = await getVisibleTournamentNames();
  if (activeTournaments.length === 0) {
    // No visible tournaments → show nothing (admin hasn't enabled any)
    return { ...data, tournaments: [], matches: [] };
  }

  const activeLower = activeTournaments.map((t) => t.toLowerCase());

  const filteredTournaments = data.tournaments.filter((t) =>
    activeLower.some((active) => t.name.toLowerCase().includes(active) || active.includes(t.name.toLowerCase()))
  );

  const filteredMatches = data.matches.filter((m) =>
    activeLower.some((active) =>
      (m.tournamentName ?? "").toLowerCase().includes(active) ||
      active.includes((m.tournamentName ?? "").toLowerCase())
    )
  );

  return {
    ...data,
    tournaments: filteredTournaments,
    matches: filteredMatches,
  };
}

const sportInput = z.object({
  sport: z
    .enum(["cricket", "f1", "football", "kabaddi", "basketball"])
    .default("cricket"),
});

/**
 * Core function: get dashboard with smart refresh.
 * 1. Check PG hot cache
 * 2. Check PostgreSQL
 * 3. Trigger Gemini refresh if stale (stale-while-revalidate)
 * 4. Cold start: wait for Gemini if no PG data
 */
async function getSmartDashboard(sport: Sport): Promise<SportsDashboardData> {
  const cacheKey = `dashboard:${sport}`;

  // 1. PG hot cache
  const cached = await getFromHotCache<SportsDashboardData>(cacheKey);
  if (cached) {
    return cached;
  }

  // 2. PostgreSQL — read-only, no Gemini refresh triggered from user app.
  //    All refreshes are admin-initiated (discover, toggle visible, force refresh).
  const pgData = await getDashboardFromPg(sport);

  if (pgData) {
    await setHotCache(cacheKey, pgData);
    return pgData;
  }

  // 3. No data — admin must discover + enable tournaments first
  log.info({ sport }, "No PG data — admin must discover and enable tournaments");
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
   * Smart refresh: PG hot cache → PG → Gemini (if stale).
   */
  dashboard: publicProcedure
    .input(sportInput)
    .query(async ({ input }) => {
      const data = await getSmartDashboard(input.sport as Sport);
      return filterActiveTournaments(data);
    }),

  /**
   * Get only today's matches for a sport.
   */
  todayMatches: publicProcedure
    .input(sportInput)
    .query(async ({ input }) => {
      const data = await filterActiveTournaments(await getSmartDashboard(input.sport as Sport));
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
      const data = await filterActiveTournaments(await getSmartDashboard(input.sport as Sport));
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
          .enum(["cricket", "f1", "football", "kabaddi", "basketball"])
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
      const data = await filterActiveTournaments(await getSmartDashboard(input.sport as Sport));
      return {
        matches: data.matches.filter((m) => m.status === "live"),
        lastFetched: data.lastFetched,
      };
    }),

  /**
   * Force refresh — clears hot cache and triggers immediate Gemini fetch.
   * Admin only.
   */
  /**
   * Get effective team rules for a tournament (public endpoint for mobile team builder).
   */
  teamRules: publicProcedure
    .input(z.object({ tournamentId: z.string().uuid().optional() }))
    .query(async ({ input }) => {
      return getEffectiveTeamRules(input.tournamentId);
    }),

  refresh: adminProcedure
    .input(sportInput)
    .mutation(async ({ input }) => {
      const sport = input.sport as Sport;
      const activeFilter = await getVisibleTournamentNames();
      const filter = activeFilter.length > 0 ? activeFilter : undefined;
      await invalidateHotCache(`dashboard:${sport}`);
      const result = await executeRefresh(sport, "manual", undefined, filter);
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
