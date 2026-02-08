import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import { createContestSchema, joinContestSchema } from "@draftcrick/shared";
import { eq, and, desc } from "drizzle-orm";
import { contests, fantasyTeams } from "@draftcrick/db";

export const contestRouter = router({
  /**
   * List contests for a match
   */
  listByMatch: publicProcedure
    .input(
      z.object({
        matchId: z.string().uuid(),
        contestType: z.enum(["public", "private", "h2h"]).optional(),
        limit: z.number().int().min(1).max(50).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(contests.matchId, input.matchId)];

      if (input.contestType) {
        conditions.push(eq(contests.contestType, input.contestType));
      }

      const result = await ctx.db.query.contests.findMany({
        where: and(...conditions),
        orderBy: [desc(contests.prizePool)],
        limit: input.limit,
      });

      return result;
    }),

  /**
   * Get contest details
   */
  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const contest = await ctx.db.query.contests.findFirst({
        where: eq(contests.id, input.id),
        with: {
          teams: true,
          match: true,
        },
      });
      return contest ?? null;
    }),

  /**
   * Create a new contest
   */
  create: protectedProcedure
    .input(createContestSchema)
    .mutation(async ({ ctx, input }) => {
      const [contest] = await ctx.db
        .insert(contests)
        .values({
          matchId: input.matchId,
          leagueId: input.leagueId,
          name: input.name,
          entryFee: String(input.entryFee),
          maxEntries: input.maxEntries,
          contestType: input.contestType,
          isGuaranteed: input.isGuaranteed,
          prizeDistribution: input.prizeDistribution,
          prizePool: String(
            input.prizeDistribution.reduce((sum, p) => sum + p.amount, 0)
          ),
        })
        .returning();
      return contest;
    }),

  /**
   * Get user's contests
   */
  myContests: protectedProcedure
    .input(
      z.object({
        status: z
          .enum(["open", "locked", "live", "settling", "settled", "cancelled"])
          .optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const teams = await ctx.db.query.fantasyTeams.findMany({
        where: eq(fantasyTeams.userId, ctx.user.id),
        with: {
          contest: {
            with: {
              match: true,
            },
          },
        },
      });
      return teams;
    }),
});
