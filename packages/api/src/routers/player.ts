import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { eq, ilike, and, desc } from "drizzle-orm";
import { players, playerMatchScores } from "@draftcrick/db";

export const playerRouter = router({
  /**
   * List all players (for draft/auction rooms)
   */
  list: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.query.players.findMany({ limit: 200 });
  }),

  /**
   * Search players by name, team, or role
   */
  search: publicProcedure
    .input(
      z.object({
        query: z.string().optional(),
        team: z.string().optional(),
        role: z
          .enum(["batsman", "bowler", "all_rounder", "wicket_keeper"])
          .optional(),
        limit: z.number().int().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [];

      if (input.query) {
        conditions.push(ilike(players.name, `%${input.query}%`));
      }
      if (input.team) {
        conditions.push(eq(players.team, input.team));
      }
      if (input.role) {
        conditions.push(eq(players.role, input.role));
      }

      const result = await ctx.db.query.players.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        limit: input.limit,
      });

      return result;
    }),

  /**
   * Get a player's detailed profile with recent match scores
   */
  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const player = await ctx.db.query.players.findFirst({
        where: eq(players.id, input.id),
        with: {
          matchScores: {
            orderBy: [desc(playerMatchScores.updatedAt)],
            limit: 10,
          },
        },
      });
      return player ?? null;
    }),

  /**
   * Get players for a specific match (from both teams)
   */
  getByMatch: publicProcedure
    .input(z.object({ matchId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const scores = await ctx.db.query.playerMatchScores.findMany({
        where: eq(playerMatchScores.matchId, input.matchId),
        with: {
          player: true,
        },
      });
      return scores;
    }),
});
