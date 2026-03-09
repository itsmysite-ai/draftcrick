import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import { createContestSchema } from "@draftplay/shared";
import { eq, and, or, desc, sql } from "drizzle-orm";
import { contests, fantasyTeams, matches } from "@draftplay/db";
import { TRPCError } from "@trpc/server";
import { calculatePrizeDistribution } from "../services/settlement";
import { deductCoins } from "../services/pop-coins";
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
        entryFee: c.entryFee,
        prizePool: c.prizePool,
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
        entryFee: contest.entryFee,
        prizePool: contest.prizePool,
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
          entryFee: input.entryFee,
          maxEntries: input.maxEntries,
          contestType: input.contestType,
          isGuaranteed: input.isGuaranteed,
          prizeDistribution,
          prizePool,
        })
        .returning();

      return { ...contest!, entryFee: contest!.entryFee, prizePool };
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

      // Also check match status — block joining if match is live/completed
      const match = await ctx.db.query.matches.findFirst({
        where: eq(matches.id, contest.matchId),
        columns: { id: true, status: true },
      });
      if (match && match.status !== "upcoming") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot join contest — match is ${match.status}`,
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

      const entryFee = contest.entryFee;

      // Deduct Pop Coins entry fee if applicable
      if (entryFee > 0) {
        try {
          await deductCoins(ctx.db, ctx.user.id, entryFee, "contest_entry", {
            contestId: contest.id,
          });
        } catch (e: any) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: e.message,
          });
        }
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

      // For teams without a contest, look up match data via matchId
      const matchIds = teams
        .filter((t) => !t.contest && t.matchId)
        .map((t) => t.matchId!);
      const matchLookup = new Map<string, any>();
      if (matchIds.length > 0) {
        const matchRows = await ctx.db.query.matches.findMany({
          where: or(...matchIds.map((id) => {
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
            return isUuid ? eq(matches.id, id) : eq(matches.externalId, id);
          })),
        });
        for (const m of matchRows) {
          matchLookup.set(m.id, m);
          matchLookup.set(m.externalId, m);
        }
      }

      // Fetch ranks for teams in contests
      const rankLookup = new Map<string, { rank: number; totalEntries: number }>();
      const contestIds = [...new Set(teams.filter((t) => t.contestId).map((t) => t.contestId!))];
      for (const cid of contestIds) {
        const leaderboard = await getContestLeaderboard(ctx.db, cid);
        for (const entry of leaderboard) {
          rankLookup.set(`${cid}:${entry.userId}`, { rank: entry.rank, totalEntries: leaderboard.length });
        }
      }

      return teams.map((t) => {
        const rankInfo = t.contestId ? rankLookup.get(`${t.contestId}:${ctx.user.id}`) : undefined;
        return {
          ...t,
          totalPoints: Number(t.totalPoints),
          rank: rankInfo?.rank ?? null,
          totalEntries: rankInfo?.totalEntries ?? null,
          contest: t.contest
            ? {
                ...t.contest,
                entryFee: t.contest.entryFee,
                prizePool: t.contest.prizePool,
              }
            : null,
          // Attach match directly for no-contest teams
          match: t.contest?.match ?? (t.matchId ? matchLookup.get(t.matchId) ?? null : null),
        };
      });
    }),
});
