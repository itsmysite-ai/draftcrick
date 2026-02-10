/**
 * Sports data router — serves AI-fetched tournaments and matches.
 * All data is cached (24hr TTL), so Gemini is called at most once/day/sport.
 */

import { z } from "zod";
import { router, publicProcedure, adminProcedure } from "../trpc";
import {
  getSportsDashboard,
  refreshSportsDashboard,
  getCacheStatus,
} from "../services/sports-cache";
import type { Sport } from "@draftcrick/shared";

const sportInput = z.object({
  sport: z
    .enum(["cricket", "football", "kabaddi", "basketball"])
    .default("cricket"),
});

export const sportsRouter = router({
  /**
   * Get the full dashboard for a sport — tournaments + matches.
   * Returns cached data (24hr TTL). First call of the day triggers Gemini fetch.
   */
  dashboard: publicProcedure
    .input(sportInput)
    .query(async ({ input }) => {
      return getSportsDashboard(input.sport as Sport);
    }),

  /**
   * Get only today's matches for a sport.
   */
  todayMatches: publicProcedure
    .input(sportInput)
    .query(async ({ input }) => {
      const data = await getSportsDashboard(input.sport as Sport);
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
      const data = await getSportsDashboard(input.sport as Sport);
      return {
        tournaments: data.tournaments,
        lastFetched: data.lastFetched,
      };
    }),

  /**
   * Get only live matches.
   */
  liveMatches: publicProcedure
    .input(sportInput)
    .query(async ({ input }) => {
      const data = await getSportsDashboard(input.sport as Sport);
      return {
        matches: data.matches.filter((m) => m.status === "live"),
        lastFetched: data.lastFetched,
      };
    }),

  /**
   * Force refresh the cache (admin only).
   */
  refresh: adminProcedure
    .input(sportInput)
    .mutation(async ({ input }) => {
      return refreshSportsDashboard(input.sport as Sport);
    }),

  /**
   * Get cache status for monitoring.
   */
  cacheStatus: publicProcedure.query(async () => {
    return getCacheStatus();
  }),
});
