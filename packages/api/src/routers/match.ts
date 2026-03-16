import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { eq, desc, asc, and, or, gte, lte, inArray } from "drizzle-orm";
import { matches, tournaments } from "@draftplay/db";
import { getVisibleTournamentNames } from "../services/admin-config";

export const matchRouter = router({
  /**
   * List matches with optional filters
   */
  list: publicProcedure
    .input(
      z
        .object({
          status: z
            .enum(["upcoming", "live", "completed", "abandoned"])
            .optional(),
          sport: z.string().optional(),
          tournament: z.string().optional(),
          limit: z.number().int().min(1).max(50).default(20),
          cursor: z.string().uuid().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const filters = input ?? {};
      const conditions = [];

      // Only show matches from visible tournaments
      const visibleNames = await getVisibleTournamentNames();
      if (visibleNames.length === 0) return { matches: [], nextCursor: null };
      conditions.push(inArray(matches.tournament, visibleNames));

      if (filters.status) {
        conditions.push(eq(matches.status, filters.status));
      }
      if (filters.sport) {
        conditions.push(eq(matches.sport, filters.sport));
      }
      if (filters.tournament) {
        conditions.push(eq(matches.tournament, filters.tournament));
      }

      const result = await ctx.db.query.matches.findMany({
        where: and(...conditions),
        orderBy: [asc(matches.startTime)],
        limit: filters.limit,
      });

      return {
        matches: result,
        nextCursor:
          result.length === filters.limit
            ? result[result.length - 1]?.id
            : null,
      };
    }),

  /**
   * Get a single match by ID
   */
  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const match = await ctx.db.query.matches.findFirst({
        where: eq(matches.id, input.id),
        with: {
          playerScores: true,
        },
      });
      return match ?? null;
    }),

  /**
   * Get live + upcoming + recently completed matches (only from visible tournaments)
   */
  live: publicProcedure.query(async ({ ctx }) => {
    // Only show matches from admin-visible tournaments
    const visibleNames = await getVisibleTournamentNames();
    if (visibleNames.length === 0) return [];

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const result = await ctx.db.query.matches.findMany({
      where: and(
        inArray(matches.tournament, visibleNames),
        or(
          eq(matches.status, "live"),
          eq(matches.status, "upcoming"),
          and(
            eq(matches.status, "completed"),
            gte(matches.startTime, oneDayAgo),
          ),
        ),
      ),
      orderBy: [desc(matches.status), asc(matches.startTime)],
    });
    return result;
  }),
});
