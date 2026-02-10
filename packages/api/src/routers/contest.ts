import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import { createContestSchema } from "@draftcrick/shared";
import { eq, and, desc, sql } from "drizzle-orm";
import { contests, fantasyTeams, wallets, transactions, matches } from "@draftcrick/db";
import { TRPCError } from "@trpc/server";
import { calculatePrizeDistribution } from "../services/settlement";
import {
  getContestLeaderboard,
  getUserContestPosition,
} from "../services/leaderboard";

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

      return result.map((c) => ({
        ...c,
        entryFee: Number(c.entryFee),
        prizePool: Number(c.prizePool),
      }));
    }),

  /**
   * Get contest details with leaderboard
   */
  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const contest = await ctx.db.query.contests.findFirst({
        where: eq(contests.id, input.id),
        with: { match: true },
      });

      if (!contest) return null;

      const leaderboard = await getContestLeaderboard(ctx.db, input.id);

      return {
        ...contest,
        entryFee: Number(contest.entryFee),
        prizePool: Number(contest.prizePool),
        leaderboard,
      };
    }),

  /**
   * Create a new contest
   */
  create: protectedProcedure
    .input(createContestSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify match exists and is upcoming
      const match = await ctx.db.query.matches.findFirst({
        where: eq(matches.id, input.matchId),
      });

      if (!match) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Match not found" });
      }

      if (match.status !== "upcoming") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Can only create contests for upcoming matches",
        });
      }

      const prizeDistribution =
        input.prizeDistribution.length > 0
          ? input.prizeDistribution
          : calculatePrizeDistribution(input.entryFee, input.maxEntries);

      const prizePool = prizeDistribution.reduce((sum, p) => sum + p.amount, 0);

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
          prizeDistribution,
          prizePool: String(prizePool),
        })
        .returning();

      return { ...contest!, entryFee: Number(contest!.entryFee), prizePool };
    }),

  /**
   * Join a contest — validates entry fee, deducts from wallet, links team
   */
  join: protectedProcedure
    .input(
      z.object({
        contestId: z.string().uuid(),
        teamId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const contest = await ctx.db.query.contests.findFirst({
        where: eq(contests.id, input.contestId),
      });

      if (!contest) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Contest not found" });
      }

      if (contest.status !== "open") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Contest is no longer open for entries",
        });
      }

      if (contest.currentEntries >= contest.maxEntries) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Contest is full",
        });
      }

      // Verify team belongs to user
      const team = await ctx.db.query.fantasyTeams.findFirst({
        where: and(
          eq(fantasyTeams.id, input.teamId),
          eq(fantasyTeams.userId, ctx.user.id)
        ),
      });

      if (!team) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Team not found" });
      }

      const entryFee = Number(contest.entryFee);

      // Deduct entry fee if applicable
      if (entryFee > 0) {
        const wallet = await ctx.db.query.wallets.findFirst({
          where: eq(wallets.userId, ctx.user.id),
        });

        const totalBalance = wallet
          ? Number(wallet.cashBalance) + Number(wallet.bonusBalance)
          : 0;

        if (totalBalance < entryFee) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Insufficient balance. Need ${entryFee}, have ${totalBalance.toFixed(2)}`,
          });
        }

        // Deduct from bonus first, then cash
        let remaining = entryFee;
        const bonusDeduct = Math.min(remaining, Number(wallet!.bonusBalance));
        remaining -= bonusDeduct;
        const cashDeduct = remaining;

        await ctx.db
          .update(wallets)
          .set({
            cashBalance: sql`${wallets.cashBalance} - ${String(cashDeduct)}`,
            bonusBalance: sql`${wallets.bonusBalance} - ${String(bonusDeduct)}`,
            updatedAt: new Date(),
          })
          .where(eq(wallets.userId, ctx.user.id));

        await ctx.db.insert(transactions).values({
          userId: ctx.user.id,
          type: "entry_fee",
          amount: String(entryFee),
          status: "completed",
          contestId: contest.id,
        });
      }

      // Increment entry count
      await ctx.db
        .update(contests)
        .set({ currentEntries: sql`${contests.currentEntries} + 1` })
        .where(eq(contests.id, contest.id));

      return { success: true, contestId: contest.id };
    }),

  /**
   * Get standings/leaderboard for a contest
   */
  getStandings: publicProcedure
    .input(z.object({ contestId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return getContestLeaderboard(ctx.db, input.contestId);
    }),

  /**
   * Get user's position in a contest
   */
  myPosition: protectedProcedure
    .input(z.object({ contestId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return getUserContestPosition(ctx.db, input.contestId, ctx.user.id);
    }),

  /**
   * Get user's contests
   */
  myContests: protectedProcedure
    .input(
      z
        .object({
          status: z
            .enum(["open", "locked", "live", "settling", "settled", "cancelled"])
            .optional(),
        })
        .optional()
    )
    .query(async ({ ctx }) => {
      const teams = await ctx.db.query.fantasyTeams.findMany({
        where: eq(fantasyTeams.userId, ctx.user.id),
        with: {
          contest: { with: { match: true } },
        },
        orderBy: [desc(fantasyTeams.createdAt)],
      });

      return teams.map((t) => ({
        ...t,
        totalPoints: Number(t.totalPoints),
        contest: t.contest
          ? {
              ...t.contest,
              entryFee: Number(t.contest.entryFee),
              prizePool: Number(t.contest.prizePool),
            }
          : null,
      }));
    }),
});
