import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { eq, desc, asc, and, gte, lte } from "drizzle-orm";
import { matches } from "@draftcrick/db";

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
        where: conditions.length > 0 ? and(...conditions) : undefined,
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
   * Get live matches
   */
  live: publicProcedure.query(async ({ ctx }) => {
    const result = await ctx.db.query.matches.findMany({
      where: eq(matches.status, "live"),
      orderBy: [asc(matches.startTime)],
    });
    return result;
  }),
});
