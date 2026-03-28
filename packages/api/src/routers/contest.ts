import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import { createContestSchema } from "@draftplay/shared";
import { eq, and, or, desc, sql, inArray } from "drizzle-orm";
import { contests, fantasyTeams, matches, users, leagueMembers } from "@draftplay/db";
import { TRPCError } from "@trpc/server";
import { calculatePrizeDistribution } from "../services/settlement";
import { deductCoins } from "../services/pop-coins";
import {
  getContestLeaderboard,
  getUserContestPosition,
} from "../services/leaderboard";

export const contestRouter = router({
  /** Get a single contest by ID */
  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.contests.findFirst({
        where: eq(contests.id, input.id),
      }) ?? null;
    }),

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
      // Get all contests for this match
      const conditions = [eq(contests.matchId, input.matchId)];
      if (input.contestType) {
        conditions.push(eq(contests.contestType, input.contestType));
      }

      const allContests = await ctx.db.query.contests.findMany({
        where: and(...conditions),
        orderBy: [desc(contests.prizePool)],
        limit: input.limit,
        with: {
          league: {
            columns: { id: true, name: true, ownerId: true, format: true },
          },
        },
      });

      // Filter: public contests visible to all, private/h2h only if user is a member
      const userId = ctx.user?.id;
      let userLeagueIds = new Set<string>();
      let userContestIds = new Set<string>();

      if (userId) {
        // Get leagues user is a member of
        const memberships = await ctx.db.query.leagueMembers.findMany({
          where: eq(leagueMembers.userId, userId),
          columns: { leagueId: true },
        });
        userLeagueIds = new Set(memberships.map((m) => m.leagueId));

        // Get contests user has joined (via fantasy teams)
        const userTeams = await ctx.db.query.fantasyTeams.findMany({
          where: eq(fantasyTeams.userId, userId),
          columns: { contestId: true },
        });
        userContestIds = new Set(userTeams.map((t) => t.contestId).filter(Boolean) as string[]);
      }

      const visibleContests = allContests.filter((c) => {
        // Public contests — visible to everyone
        if (c.contestType === "public") return true;
        // Not logged in — only public
        if (!userId) return false;
        // Private — only if user is in the league
        if (c.contestType === "private" && c.leagueId) {
          return userLeagueIds.has(c.leagueId);
        }
        // H2H — only if user has joined
        if (c.contestType === "h2h") {
          return userContestIds.has(c.id);
        }
        // Fallback — user has joined this contest
        return userContestIds.has(c.id);
      });

      return visibleContests.map((c) => ({
        ...c,
        entryFee: c.entryFee,
        prizePool: c.prizePool,
        leagueName: c.league?.name ?? null,
        leagueOwnerId: c.league?.ownerId ?? null,
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

      // Fetch ranks and live points for teams in contests
      const rankLookup = new Map<string, { rank: number; totalEntries: number; totalPoints: number }>();
      const contestIds = [...new Set(teams.filter((t) => t.contestId).map((t) => t.contestId!))];
      for (const cid of contestIds) {
        const leaderboard = await getContestLeaderboard(ctx.db, cid);
        for (const entry of leaderboard) {
          rankLookup.set(`${cid}:${entry.userId}`, { rank: entry.rank, totalEntries: leaderboard.length, totalPoints: entry.totalPoints });
        }
      }

      return teams.map((t) => {
        const rankInfo = t.contestId ? rankLookup.get(`${t.contestId}:${ctx.user.id}`) : undefined;
        // Compute prize won from rank + prize distribution
        let prizeWon = 0;
        if (rankInfo?.rank && t.contest?.status === "settled" && t.contest.prizeDistribution) {
          const dist = t.contest.prizeDistribution as Array<{ rank: number; amount: number }>;
          const slot = dist.find((d) => d.rank === rankInfo.rank);
          if (slot) prizeWon = Math.floor(slot.amount);
        }
        return {
          ...t,
          totalPoints: rankInfo?.totalPoints ?? Number(t.totalPoints),
          rank: rankInfo?.rank ?? null,
          totalEntries: rankInfo?.totalEntries ?? null,
          prizeWon,
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

  /**
   * Accept an H2H challenge — joins the contest and deducts stake.
   */
  acceptChallenge: protectedProcedure
    .input(
      z.object({
        contestId: z.string().uuid(),
        notificationId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const contest = await ctx.db.query.contests.findFirst({
        where: eq(contests.id, input.contestId),
        with: { match: true },
      });

      if (!contest) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Contest not found" });
      }
      if (contest.contestType !== "h2h") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Not an H2H contest" });
      }
      if (contest.status !== "open") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Challenge is no longer open" });
      }
      if (contest.currentEntries >= contest.maxEntries) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Challenge is already full" });
      }

      // Update duel name to "Creator vs Joiner — H2H Duel".
      // Try to find creator from fantasy teams first, fall back to parsing the contest name
      // (which is set to "PlayerName's H2H Duel" on creation).
      let creatorName = "Player 1";
      const challengerTeam = await ctx.db.query.fantasyTeams.findFirst({
        where: eq(fantasyTeams.contestId, input.contestId),
        columns: { userId: true },
        orderBy: (ft, { asc }) => [asc(ft.createdAt)],
      });
      if (challengerTeam?.userId) {
        const creatorUser = await ctx.db.query.users.findFirst({
          where: eq(users.id, challengerTeam.userId),
          columns: { displayName: true, username: true },
        });
        creatorName = (creatorUser?.displayName || creatorUser?.username || "").split("@")[0] || "Player 1";
      } else {
        // Creator hasn't built a team yet — extract name from contest name ("Name's H2H Duel")
        const nameMatch = contest.name.match(/^(.+?)'s\s+H2H/i);
        if (nameMatch) creatorName = nameMatch[1]!;
      }

      const joinerUser = await ctx.db.query.users.findFirst({
        where: eq(users.id, ctx.user.id),
        columns: { displayName: true, username: true },
      });
      const joinerName = (joinerUser?.displayName || joinerUser?.username || "").split("@")[0] || "Player 2";
      const duelName = `${creatorName} vs ${joinerName} — H2H Duel`;

      await ctx.db
        .update(contests)
        .set({ name: duelName })
        .where(eq(contests.id, input.contestId));

      // Mark notification as read
      if (input.notificationId) {
        const { notifications } = await import("@draftplay/db");
        await ctx.db
          .update(notifications)
          .set({ isRead: true })
          .where(eq(notifications.id, input.notificationId));
      }

      // Create accepted notification for the challenger
      try {
        const { notifications } = await import("@draftplay/db");
        // Find the challenger (first user in this contest's teams)
        const challengerTeams = await ctx.db.query.fantasyTeams.findMany({
          where: eq(fantasyTeams.contestId, input.contestId),
          columns: { userId: true },
          limit: 1,
        });
        const challengerUserId = challengerTeams[0]?.userId;
        if (challengerUserId && challengerUserId !== ctx.user.id) {
          await ctx.db.insert(notifications).values({
            userId: challengerUserId,
            type: "challenge_accepted",
            title: "Challenge Accepted!",
            body: `Your H2H challenge has been accepted. Build your team now!`,
            data: {
              contestId: input.contestId,
              matchId: (contest as any).match?.id || contest.matchId,
              teamA: (contest as any).match?.teamHome,
              teamB: (contest as any).match?.teamAway,
            },
          });
        }
      } catch { /* notification creation is best-effort */ }

      return {
        contestId: input.contestId,
        matchId: (contest as any).match?.id || contest.matchId,
        teamA: (contest as any).match?.teamHome,
        teamB: (contest as any).match?.teamAway,
      };
    }),

  /**
   * Decline an H2H challenge.
   */
  declineChallenge: protectedProcedure
    .input(
      z.object({
        contestId: z.string().uuid(),
        notificationId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Mark notification as read
      if (input.notificationId) {
        const { notifications } = await import("@draftplay/db");
        await ctx.db
          .update(notifications)
          .set({ isRead: true })
          .where(eq(notifications.id, input.notificationId));
      }

      // Notify challenger
      try {
        const { notifications } = await import("@draftplay/db");
        const challengerTeams = await ctx.db.query.fantasyTeams.findMany({
          where: eq(fantasyTeams.contestId, input.contestId),
          columns: { userId: true },
          limit: 1,
        });
        const challengerUserId = challengerTeams[0]?.userId;
        if (challengerUserId && challengerUserId !== ctx.user.id) {
          await ctx.db.insert(notifications).values({
            userId: challengerUserId,
            type: "challenge_declined",
            title: "Challenge Declined",
            body: `Your H2H challenge was declined. You can share the link to find another opponent.`,
            data: { contestId: input.contestId },
          });
        }
      } catch { /* best-effort */ }

      return { success: true };
    }),
});
