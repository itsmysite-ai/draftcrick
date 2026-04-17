/**
 * Cricket Manager — tRPC router
 *
 * CM is layered on the leagues table. League CRUD/join flows live in the
 * league router; this router handles CM-specific round composition, entries,
 * leaderboards, and lifecycle.
 */

import { z } from "zod";
import {
  router,
  protectedProcedure,
  adminProcedure,
  proProcedure,
} from "../trpc";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  leagues,
  leagueMembers,
  cmRounds,
  cmContests,
  cmContestMembers,
  cmEntries,
  cmLeagueStandings,
  matches,
  users,
} from "@draftplay/db";
import {
  composeRound,
  updateRound,
  deleteRound,
  submitEntry,
  settleRound,
  populateRoundPlayerPool,
  tickRoundLifecycles,
  joinCmLeague,
  type EligiblePlayer,
} from "../services/cm-service";
import {
  rateMyXi,
  suggestBattingOrder,
  suggestBowlingOrder,
  whatIf,
  type PlayerProjection,
} from "../services/cm-guru";

// ─── Input schemas ──────────────────────────────────────────────────────

const playerSlotSchema = z.object({ playerId: z.string().uuid() });
const battingSlotSchema = z.object({
  position: z.number().int().min(1).max(11),
  playerId: z.string().uuid(),
});
const bowlingSlotSchema = z.object({
  priority: z.number().int().min(1),
  playerId: z.string().uuid(),
});

// ─── Router ─────────────────────────────────────────────────────────────

export const cricketManagerRouter = router({
  // ── League-scoped queries ─────────────────────────────────────────────

  /** Join a CM league — charges the league entry fee from rules.cricketManager.entryFee */
  joinLeague: protectedProcedure
    .input(z.object({ leagueId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return joinCmLeague(ctx.db, ctx.user.id, input.leagueId);
    }),

  /** Get all CM rounds for a league. */
  getLeagueRounds: protectedProcedure
    .input(z.object({ leagueId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const league = await ctx.db.query.leagues.findFirst({
        where: eq(leagues.id, input.leagueId),
      });
      if (!league) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "League not found",
        });
      }
      if (league.format !== "cricket_manager") {
        return [];
      }

      return ctx.db
        .select()
        .from(cmRounds)
        .where(eq(cmRounds.leagueId, input.leagueId))
        .orderBy(cmRounds.roundNumber);
    }),

  /** Round detail with attached match list and current user's entry. */
  getRound: protectedProcedure
    .input(z.object({ roundId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const round = await ctx.db.query.cmRounds.findFirst({
        where: eq(cmRounds.id, input.roundId),
      });
      if (!round) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Round not found" });
      }

      const matchRows =
        round.matchIds.length > 0
          ? await ctx.db
              .select()
              .from(matches)
              .where(inArray(matches.id, round.matchIds))
          : [];

      const entry = await ctx.db.query.cmEntries.findFirst({
        where: and(
          eq(cmEntries.roundId, input.roundId),
          eq(cmEntries.userId, ctx.user.id)
        ),
      });

      return {
        ...round,
        matches: matchRows,
        myEntry: entry ?? null,
      };
    }),

  // ── Entries ──────────────────────────────────────────────────────────

  submitEntry: protectedProcedure
    .input(
      z.object({
        roundId: z.string().uuid(),
        players: z.array(playerSlotSchema).length(11),
        battingOrder: z.array(battingSlotSchema).length(11),
        bowlingPriority: z.array(bowlingSlotSchema).min(5),
        toss: z.enum(["bat_first", "bowl_first"]),
        chipUsed: z.string().optional(),
        chipTarget: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return submitEntry(ctx.db, ctx.user.id, input);
    }),

  getMyEntry: protectedProcedure
    .input(z.object({ roundId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.cmEntries.findFirst({
        where: and(
          eq(cmEntries.roundId, input.roundId),
          eq(cmEntries.userId, ctx.user.id)
        ),
      });
    }),

  /**
   * Get an entry with its per-player breakdown hydrated.
   * Used by:
   *  - round hub live scorecard (user looks at their own entry)
   *  - post-settlement reveal (user looks at a winner's entry)
   * Visibility rule: other users' entries are only visible after settlement.
   */
  getEntryDetail: protectedProcedure
    .input(
      z.object({
        roundId: z.string().uuid(),
        userId: z.string().uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const targetUserId = input.userId ?? ctx.user.id;
      const entry = await ctx.db.query.cmEntries.findFirst({
        where: and(
          eq(cmEntries.roundId, input.roundId),
          eq(cmEntries.userId, targetUserId)
        ),
      });
      if (!entry) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Entry not found" });
      }

      // Visibility: can always see own entry; others only after settlement
      if (targetUserId !== ctx.user.id) {
        const round = await ctx.db.query.cmRounds.findFirst({
          where: eq(cmRounds.id, input.roundId),
        });
        if (round?.status !== "settled") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Other entries are hidden until the round settles",
          });
        }
      }

      return entry;
    }),

  // ── Leaderboards ─────────────────────────────────────────────────────

  getRoundLeaderboard: protectedProcedure
    .input(
      z.object({
        roundId: z.string().uuid(),
        limit: z.number().int().min(1).max(200).default(50),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const contest = await ctx.db.query.cmContests.findFirst({
        where: and(
          eq(cmContests.roundId, input.roundId),
          eq(cmContests.contestType, "mega")
        ),
      });
      if (!contest) return { rows: [] };

      const rows = await ctx.db
        .select({
          userId: cmContestMembers.userId,
          rank: cmContestMembers.rank,
          prizeWon: cmContestMembers.prizeWon,
          nrr: cmEntries.nrr,
          battingTotal: cmEntries.battingTotal,
          bowlingTotal: cmEntries.bowlingTotal,
          battingWickets: cmEntries.battingWickets,
          bowlingWickets: cmEntries.bowlingWickets,
          email: users.email,
        })
        .from(cmContestMembers)
        .innerJoin(cmEntries, eq(cmContestMembers.entryId, cmEntries.id))
        .innerJoin(users, eq(cmContestMembers.userId, users.id))
        .where(eq(cmContestMembers.contestId, contest.id))
        .orderBy(
          sql`${cmContestMembers.rank} NULLS LAST`,
          desc(cmEntries.nrr)
        )
        .limit(input.limit)
        .offset(input.offset);

      return { rows, contestId: contest.id };
    }),

  /**
   * Merged projections for every eligible player in a CM round.
   *
   * Scans the AI projection cache (player_projections table) for each
   * of the round's matches and overlays a stats-based baseline for any
   * player that's missing an AI entry. Returns one map keyed by
   * playerId so the build-entry UI never shows a mix of
   * cached-for-some / blank-for-rest — every player gets a number.
   *
   * `source: "ai"` is the AI-enhanced layer, `"baseline"` is the
   * fallback. UI can use this to show a subtle ✨ badge on AI rows.
   */
  getRoundProjections: protectedProcedure
    .input(z.object({ roundId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const round = await ctx.db.query.cmRounds.findFirst({
        where: eq(cmRounds.id, input.roundId),
      });
      if (!round) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Round not found" });
      }

      const pool = (round.eligiblePlayers as EligiblePlayer[]) ?? [];
      if (pool.length === 0) return { projections: [] as Array<{
        playerId: string; projectedPoints: number; source: "ai" | "baseline"; captainRank?: number;
      }> };

      const playerIds = pool.map((p) => p.playerId);
      const rolesById = new Map(pool.map((p) => [p.playerId, p.role]));

      // 1. Pull every AI projection for this round's matches, once.
      const { playerProjections } = await import("@draftplay/db");
      const aiRows = await ctx.db
        .select({
          playerId: playerProjections.playerId,
          matchId: playerProjections.matchId,
          projectedPoints: playerProjections.projectedPoints,
          captainRank: playerProjections.captainRank,
        })
        .from(playerProjections)
        .where(inArray(playerProjections.matchId, round.matchIds));

      // If a player plays multiple matches in the round (multi-match
      // team), average their AI projections across those matches.
      const aiAgg = new Map<string, { sum: number; count: number; captainRank: number | null }>();
      for (const r of aiRows) {
        const prev = aiAgg.get(r.playerId) ?? { sum: 0, count: 0, captainRank: null };
        prev.sum += Number(r.projectedPoints);
        prev.count += 1;
        if (r.captainRank !== null) {
          prev.captainRank =
            prev.captainRank === null
              ? r.captainRank
              : Math.min(prev.captainRank, r.captainRank);
        }
        aiAgg.set(r.playerId, prev);
      }

      // 2. Figure out who's missing an AI projection and run the
      //    baseline layer just for those (avoids redundant SQL).
      const missingIds = playerIds.filter((id) => !aiAgg.has(id));
      const { computeBaselineProjections } = await import("../services/projection-engine");
      const baselineMap =
        missingIds.length > 0
          ? await computeBaselineProjections(ctx.db, missingIds, rolesById)
          : new Map();

      // 3. Merge: AI wins when present, baseline otherwise.
      const projections = playerIds.map((id) => {
        const ai = aiAgg.get(id);
        if (ai) {
          return {
            playerId: id,
            projectedPoints: Math.round((ai.sum / ai.count) * 10) / 10,
            source: "ai" as const,
            captainRank: ai.captainRank ?? undefined,
          };
        }
        const base = baselineMap.get(id);
        return {
          playerId: id,
          projectedPoints: base?.projectedPoints ?? 8,
          source: "baseline" as const,
        };
      });

      return { projections };
    }),

  /**
   * Home-feed: CM rounds the caller is a member of but hasn't built an
   * entry for yet. Filtered to rounds still accepting submissions
   * (status: open) and closing within the next N days (default 7).
   * Used on the mobile home screen under "waiting for your team".
   */
  pendingRoundsForMe: protectedProcedure
    .input(
      z
        .object({
          daysAhead: z.number().int().min(1).max(30).default(7),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const daysAhead = input?.daysAhead ?? 7;
      const now = new Date();
      const cutoff = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

      // Find all leagues the user is a member of
      const memberships = await ctx.db
        .select({ leagueId: leagueMembers.leagueId })
        .from(leagueMembers)
        .where(eq(leagueMembers.userId, ctx.user.id));
      if (memberships.length === 0) return [];
      const leagueIds = memberships.map((m) => m.leagueId);

      // Rounds in those leagues that are currently open
      const openRounds = await ctx.db
        .select({
          id: cmRounds.id,
          leagueId: cmRounds.leagueId,
          roundNumber: cmRounds.roundNumber,
          name: cmRounds.name,
          windowStart: cmRounds.windowStart,
          lockTime: cmRounds.lockTime,
          matchesTotal: cmRounds.matchesTotal,
          status: cmRounds.status,
        })
        .from(cmRounds)
        .where(
          and(
            inArray(cmRounds.leagueId, leagueIds),
            eq(cmRounds.status, "open"),
            sql`${cmRounds.windowStart} <= ${cutoff}`
          )
        );
      if (openRounds.length === 0) return [];

      // Entries the user has already submitted for any of these rounds
      const existingEntries = await ctx.db
        .select({ roundId: cmEntries.roundId })
        .from(cmEntries)
        .where(
          and(
            eq(cmEntries.userId, ctx.user.id),
            inArray(
              cmEntries.roundId,
              openRounds.map((r) => r.id)
            )
          )
        );
      const submitted = new Set(existingEntries.map((e) => e.roundId));
      const pending = openRounds.filter((r) => !submitted.has(r.id));
      if (pending.length === 0) return [];

      // Hydrate with league name for display
      const leagueRows = await ctx.db
        .select({
          id: leagues.id,
          name: leagues.name,
        })
        .from(leagues)
        .where(
          inArray(
            leagues.id,
            pending.map((r) => r.leagueId)
          )
        );
      const leagueMap = new Map(leagueRows.map((l) => [l.id, l.name]));

      return pending
        .map((r) => ({
          id: r.id,
          leagueId: r.leagueId,
          leagueName: leagueMap.get(r.leagueId) ?? "League",
          roundNumber: r.roundNumber,
          name: r.name,
          windowStart: r.windowStart,
          lockTime: r.lockTime,
          matchesTotal: r.matchesTotal,
        }))
        .sort(
          (a, b) =>
            new Date(a.windowStart).getTime() -
            new Date(b.windowStart).getTime()
        );
    }),

  /**
   * Home-feed: CM entries the caller has submitted, for rounds still in
   * progress (open or live — NOT settled). Used on the mobile home
   * screen as the CM equivalent of "my contests".
   */
  myActiveEntries: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        entryId: cmEntries.id,
        roundId: cmEntries.roundId,
        battingTotal: cmEntries.battingTotal,
        bowlingTotal: cmEntries.bowlingTotal,
        nrr: cmEntries.nrr,
        submittedAt: cmEntries.submittedAt,
        leagueId: cmRounds.leagueId,
        roundNumber: cmRounds.roundNumber,
        roundName: cmRounds.name,
        roundStatus: cmRounds.status,
        matchesTotal: cmRounds.matchesTotal,
        matchesCompleted: cmRounds.matchesCompleted,
        windowStart: cmRounds.windowStart,
      })
      .from(cmEntries)
      .innerJoin(cmRounds, eq(cmEntries.roundId, cmRounds.id))
      .where(
        and(
          eq(cmEntries.userId, ctx.user.id),
          inArray(cmRounds.status, ["open", "live"])
        )
      );
    if (rows.length === 0) return [];

    const leagueRows = await ctx.db
      .select({ id: leagues.id, name: leagues.name })
      .from(leagues)
      .where(
        inArray(
          leagues.id,
          rows.map((r) => r.leagueId)
        )
      );
    const leagueMap = new Map(leagueRows.map((l) => [l.id, l.name]));

    return rows
      .map((r) => ({
        entryId: r.entryId,
        roundId: r.roundId,
        leagueId: r.leagueId,
        leagueName: leagueMap.get(r.leagueId) ?? "League",
        roundNumber: r.roundNumber,
        roundName: r.roundName,
        roundStatus: r.roundStatus,
        battingTotal: r.battingTotal,
        bowlingTotal: r.bowlingTotal,
        nrr: Number(r.nrr ?? 0),
        matchesTotal: r.matchesTotal,
        matchesCompleted: r.matchesCompleted,
        windowStart: r.windowStart,
      }))
      .sort(
        (a, b) =>
          new Date(b.windowStart).getTime() -
          new Date(a.windowStart).getTime()
      );
  }),

  getLeagueStandings: protectedProcedure
    .input(
      z.object({
        leagueId: z.string().uuid(),
        limit: z.number().int().min(1).max(200).default(50),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          userId: cmLeagueStandings.userId,
          rank: cmLeagueStandings.currentRank,
          totalNrr: cmLeagueStandings.totalNrr,
          roundsPlayed: cmLeagueStandings.roundsPlayed,
          wins: cmLeagueStandings.wins,
          losses: cmLeagueStandings.losses,
          bestNrr: cmLeagueStandings.bestNrr,
          worstNrr: cmLeagueStandings.worstNrr,
          avgNrr: cmLeagueStandings.avgNrr,
          currentWinStreak: cmLeagueStandings.currentWinStreak,
          bestWinStreak: cmLeagueStandings.bestWinStreak,
          prizeWon: cmLeagueStandings.prizeWon,
          email: users.email,
        })
        .from(cmLeagueStandings)
        .innerJoin(users, eq(cmLeagueStandings.userId, users.id))
        .where(eq(cmLeagueStandings.leagueId, input.leagueId))
        .orderBy(
          sql`${cmLeagueStandings.currentRank} NULLS LAST`,
          desc(cmLeagueStandings.totalNrr)
        )
        .limit(input.limit)
        .offset(input.offset);
    }),

  // ── Guru AI (pro-gated) ──────────────────────────────────────────────

  /** Rate the user's current entry on the given round. */
  rateMyXi: proProcedure
    .input(z.object({ roundId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const round = await ctx.db.query.cmRounds.findFirst({
        where: eq(cmRounds.id, input.roundId),
      });
      if (!round) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Round not found" });
      }
      const entry = await ctx.db.query.cmEntries.findFirst({
        where: and(
          eq(cmEntries.roundId, input.roundId),
          eq(cmEntries.userId, ctx.user.id)
        ),
      });
      if (!entry) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Build your entry first",
        });
      }

      const pool = (round.eligiblePlayers ?? []) as EligiblePlayer[];
      const byId = new Map(pool.map((p) => [p.playerId, p]));
      const squadIds = (entry.players as Array<{ playerId: string }>).map(
        (p) => p.playerId
      );
      const squad = squadIds
        .map((id) => byId.get(id))
        .filter((p): p is EligiblePlayer => !!p);

      // Projections — best effort. Use the round's first match as context.
      const proj: PlayerProjection[] = [];
      // For the Guru analysis we read whatever's been stored in eligiblePlayers' `projectedPoints`
      // plus any cached projection via the existing analytics endpoint fallback is skipped
      // to keep the call synchronous. Rate is rule-based; projections are optional.
      return rateMyXi({
        squad,
        projections: proj,
        battingOrder: (entry.battingOrder as Array<{
          position: number;
          playerId: string;
        }>)
          .sort((a, b) => a.position - b.position)
          .map((b) => b.playerId),
        bowlingPriority: (entry.bowlingPriority as Array<{
          priority: number;
          playerId: string;
        }>)
          .sort((a, b) => a.priority - b.priority)
          .map((b) => b.playerId),
      });
    }),

  /** AI suggestion for optimal batting order given current squad + recent stats. */
  suggestBattingOrder: proProcedure
    .input(z.object({ roundId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const round = await ctx.db.query.cmRounds.findFirst({
        where: eq(cmRounds.id, input.roundId),
      });
      if (!round) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Round not found" });
      }
      const entry = await ctx.db.query.cmEntries.findFirst({
        where: and(
          eq(cmEntries.roundId, input.roundId),
          eq(cmEntries.userId, ctx.user.id)
        ),
      });
      if (!entry) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Build your entry first",
        });
      }

      const pool = (round.eligiblePlayers ?? []) as EligiblePlayer[];
      const byId = new Map(pool.map((p) => [p.playerId, p]));
      const squadIds = (entry.players as Array<{ playerId: string }>).map(
        (p) => p.playerId
      );
      const squad = squadIds
        .map((id) => byId.get(id))
        .filter((p): p is EligiblePlayer => !!p);

      return suggestBattingOrder(squad, []);
    }),

  /** AI suggestion for optimal bowling priority. */
  suggestBowlingOrder: proProcedure
    .input(z.object({ roundId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const round = await ctx.db.query.cmRounds.findFirst({
        where: eq(cmRounds.id, input.roundId),
      });
      if (!round) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Round not found" });
      }
      const entry = await ctx.db.query.cmEntries.findFirst({
        where: and(
          eq(cmEntries.roundId, input.roundId),
          eq(cmEntries.userId, ctx.user.id)
        ),
      });
      if (!entry) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Build your entry first",
        });
      }

      const pool = (round.eligiblePlayers ?? []) as EligiblePlayer[];
      const byId = new Map(pool.map((p) => [p.playerId, p]));
      const squadIds = (entry.players as Array<{ playerId: string }>).map(
        (p) => p.playerId
      );
      const squad = squadIds
        .map((id) => byId.get(id))
        .filter((p): p is EligiblePlayer => !!p);

      return suggestBowlingOrder(squad, []);
    }),

  /**
   * Post-settlement "What If" — compare the user's chosen order with the
   * AI-suggested order and show the delta. Pro-gated.
   */
  whatIf: proProcedure
    .input(z.object({ roundId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const round = await ctx.db.query.cmRounds.findFirst({
        where: eq(cmRounds.id, input.roundId),
      });
      if (!round) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Round not found" });
      }
      const entry = await ctx.db.query.cmEntries.findFirst({
        where: and(
          eq(cmEntries.roundId, input.roundId),
          eq(cmEntries.userId, ctx.user.id)
        ),
      });
      if (!entry) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No entry found" });
      }

      const pool = (round.eligiblePlayers ?? []) as EligiblePlayer[];
      const byId = new Map(pool.map((p) => [p.playerId, p]));
      const squadIds = (entry.players as Array<{ playerId: string }>).map(
        (p) => p.playerId
      );
      const squad = squadIds
        .map((id) => byId.get(id))
        .filter((p): p is EligiblePlayer => !!p);

      const actualBattingOrder = (
        entry.battingOrder as Array<{ position: number; playerId: string }>
      )
        .sort((a, b) => a.position - b.position)
        .map((b) => b.playerId);
      const actualBowlingPriority = (
        entry.bowlingPriority as Array<{ priority: number; playerId: string }>
      )
        .sort((a, b) => a.priority - b.priority)
        .map((b) => b.playerId);

      const suggestedBat = suggestBattingOrder(squad, []).map(
        (s) => s.playerId
      );
      const suggestedBowl = suggestBowlingOrder(squad, []).map(
        (s) => s.playerId
      );

      return whatIf({
        actualBattingOrder,
        actualBowlingPriority,
        suggestedBattingOrder: suggestedBat,
        suggestedBowlingPriority: suggestedBowl,
        projectionsByPlayerId: new Map(),
      });
    }),

  // ── Admin: round composition ─────────────────────────────────────────

  composeRound: adminProcedure
    .input(
      z.object({
        leagueId: z.string().uuid(),
        roundNumber: z.number().int().positive(),
        name: z.string().min(1).max(200),
        matchIds: z.array(z.string().uuid()).min(1).max(50),
        lockTime: z.coerce.date().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return composeRound(ctx.db, input);
    }),

  updateRound: adminProcedure
    .input(
      z.object({
        roundId: z.string().uuid(),
        name: z.string().min(1).max(200).optional(),
        matchIds: z.array(z.string().uuid()).min(1).max(50).optional(),
        lockTime: z.coerce.date().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await updateRound(ctx.db, input);
      return { updated: true };
    }),

  deleteRound: adminProcedure
    .input(z.object({ roundId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await deleteRound(ctx.db, input.roundId);
      return { deleted: true };
    }),

  populateRoundPlayers: adminProcedure
    .input(z.object({ roundId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const pool: EligiblePlayer[] = await populateRoundPlayerPool(
        ctx.db,
        input.roundId
      );
      return { count: pool.length };
    }),

  settleRound: adminProcedure
    .input(z.object({ roundId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await settleRound(ctx.db, input.roundId);
      return { settled: true };
    }),

  tickLifecycles: adminProcedure.mutation(async ({ ctx }) => {
    await tickRoundLifecycles(ctx.db);
    return { ok: true };
  }),
});
