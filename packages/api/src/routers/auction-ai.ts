import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { eq, and, inArray } from "drizzle-orm";
import { draftRooms, draftPicks, leagues, players } from "@draftplay/db";
import { TRPCError } from "@trpc/server";
import {
  getBidSuggestion,
  evaluateTrade,
  generateAuctionReportCard,
  generateAuctionBuzz,
  getWaiverRecommendations,
  buildAuctionGuruContext,
} from "../services/auction-ai";
import { loadAuctionState } from "../services/auction-room";
import { getProjectionsForMatch } from "../services/projection-engine";
import { getFDRForMatch } from "../services/fdr-engine";
import { rateTeam } from "../services/rate-my-team";
import { tierAtLeast } from "@draftplay/shared";

export const auctionAiRouter = router({
  /**
   * Get AI bid suggestion for a nominated player during live auction.
   * Free: top pick only. Pro/Elite: full insights.
   */
  bidSuggestion: protectedProcedure
    .input(z.object({
      roomId: z.string().uuid(),
      playerId: z.string().uuid(),
    }))
    .query(async ({ ctx, input }) => {
      const state = await loadAuctionState(ctx.db, input.roomId);
      if (!state) throw new TRPCError({ code: "NOT_FOUND", message: "Auction room not found" });

      // Get player info
      const player = await ctx.db.query.players.findFirst({
        where: eq(players.id, input.playerId),
        columns: { id: true, name: true, role: true, team: true, stats: true },
      });
      if (!player) throw new TRPCError({ code: "NOT_FOUND", message: "Player not found" });

      // Get user's current roster from draft picks
      const userPicks = await ctx.db.query.draftPicks.findMany({
        where: and(eq(draftPicks.roomId, input.roomId), eq(draftPicks.userId, ctx.user.id)),
        columns: { playerId: true },
      });

      // Get player roles for roster
      const rosterPlayerIds = userPicks.map((p) => p.playerId);
      const rosterPlayers = rosterPlayerIds.length > 0
        ? await ctx.db.query.players.findMany({
            where: inArray(players.id, rosterPlayerIds),
            columns: { id: true, role: true },
          })
        : [];

      const userRoster = rosterPlayers.map((p) => ({
        role: p.role ?? "unknown",
        playerId: p.id,
      }));

      // Get projections (may be empty if not generated yet)
      let projections: any[] = [];
      try {
        const league = await ctx.db.query.leagues.findFirst({
          where: eq(leagues.id, state.leagueId),
          columns: { tournament: true },
        });
        // Use cached projections if available
        const { getFromHotCache } = await import("../services/sports-cache");
        const cached = await getFromHotCache<any>(`projections:${state.leagueId}`);
        if (cached?.players) projections = cached.players;
      } catch {
        // Projections not available — suggestion still works with reduced accuracy
      }

      const suggestion = await getBidSuggestion(
        state,
        input.playerId,
        ctx.user.id,
        {
          name: player.name,
          role: player.role ?? "unknown",
          team: player.team ?? "unknown",
          credits: (() => { const s = (player.stats ?? {}) as Record<string, unknown>; return (s.adminCredits ?? s.calculatedCredits ?? s.geminiCredits ?? s.credits ?? 8.0) as number; })(),
          stats: (player.stats ?? {}) as any,
        },
        projections,
        userRoster,
      );

      // Tier gating: Free users get recommendation only
      const tier = ctx.tier ?? "basic";
      if (!tierAtLeast(tier, "pro")) {
        return {
          playerName: suggestion.playerName,
          recommendation: suggestion.recommendation,
          teamNeed: suggestion.teamNeed,
          // Hide detailed values for free users
          fairValueLow: null,
          fairValueHigh: null,
          projectedPoints: null,
          valuePerCredit: null,
          riskRating: null,
          riskReason: null,
          teamNeedReason: null,
          gated: true,
          requiredTier: "pro" as const,
        };
      }

      return { ...suggestion, gated: false, requiredTier: null };
    }),

  /**
   * Evaluate a proposed trade — AI analysis with grade impact.
   * Free: verdict only. Pro: full analysis. Elite: full + fixture analysis.
   */
  evaluateTrade: protectedProcedure
    .input(z.object({
      leagueId: z.string().uuid(),
      offeredPlayerIds: z.array(z.string().uuid()).min(1),
      requestedPlayerIds: z.array(z.string().uuid()).min(1),
    }))
    .query(async ({ ctx, input }) => {
      // Get league and draft room
      const league = await ctx.db.query.leagues.findFirst({
        where: eq(leagues.id, input.leagueId),
      });
      if (!league) throw new TRPCError({ code: "NOT_FOUND", message: "League not found" });

      const draftRoom = await ctx.db.query.draftRooms.findFirst({
        where: and(eq(draftRooms.leagueId, input.leagueId), eq(draftRooms.status, "completed")),
        columns: { id: true },
      });
      if (!draftRoom) throw new TRPCError({ code: "BAD_REQUEST", message: "No completed draft found" });

      // Get player details with salaries
      const allPlayerIds = [...input.offeredPlayerIds, ...input.requestedPlayerIds];
      const playerRecords = await ctx.db.query.players.findMany({
        where: inArray(players.id, allPlayerIds),
        columns: { id: true, name: true, role: true, team: true },
      });
      const playerMap = new Map(playerRecords.map((p) => [p.id, p]));

      // Get bid amounts from draft picks
      const pickRecords = await ctx.db.query.draftPicks.findMany({
        where: and(eq(draftPicks.roomId, draftRoom.id), inArray(draftPicks.playerId, allPlayerIds)),
        columns: { playerId: true, bidAmount: true },
      });
      const salaryMap = new Map(pickRecords.map((p) => [p.playerId, Number(p.bidAmount ?? 0)]));

      const offeredPlayers = input.offeredPlayerIds.map((id) => ({
        id,
        name: playerMap.get(id)?.name ?? id,
        salary: salaryMap.get(id) ?? 0,
        role: playerMap.get(id)?.role ?? "unknown",
      }));

      const requestedPlayers = input.requestedPlayerIds.map((id) => ({
        id,
        name: playerMap.get(id)?.name ?? id,
        salary: salaryMap.get(id) ?? 0,
        role: playerMap.get(id)?.role ?? "unknown",
      }));

      // Get user's full roster
      const userPicks = await ctx.db.query.draftPicks.findMany({
        where: and(eq(draftPicks.roomId, draftRoom.id), eq(draftPicks.userId, ctx.user.id)),
      });
      const rosterIds = userPicks.map((p) => p.playerId);
      const rosterRecords = rosterIds.length > 0
        ? await ctx.db.query.players.findMany({
            where: inArray(players.id, rosterIds),
            columns: { id: true, name: true, role: true },
          })
        : [];
      const userRoster = rosterRecords.map((p) => ({
        id: p.id,
        name: p.name,
        role: p.role ?? "unknown",
        salary: salaryMap.get(p.id) ?? 0,
      }));

      const evaluation = await evaluateTrade(
        ctx.db,
        input.leagueId,
        ctx.user.id,
        offeredPlayers,
        requestedPlayers,
        [], // projections — empty for now, will populate from cache
        [], // fdr — empty for now
        userRoster,
      );

      // Tier gating
      const tier = ctx.tier ?? "basic";
      if (!tierAtLeast(tier, "pro")) {
        return {
          verdict: evaluation.verdict,
          verdictReason: evaluation.verdictReason,
          netProjectedPoints: null,
          salaryImpact: null,
          preTradeGrade: null,
          postTradeGrade: null,
          fixtureAdvantage: null,
          warnings: [],
          playersGiven: evaluation.playersGiven.map((p) => ({ name: p.name })),
          playersReceived: evaluation.playersReceived.map((p) => ({ name: p.name })),
          gated: true,
          requiredTier: "pro" as const,
        };
      }

      return { ...evaluation, gated: false, requiredTier: null };
    }),

  /**
   * Get post-auction report card for the current user.
   */
  reportCard: protectedProcedure
    .input(z.object({ roomId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const room = await ctx.db.query.draftRooms.findFirst({
        where: eq(draftRooms.id, input.roomId),
        columns: { id: true, status: true, leagueId: true },
      });
      if (!room) throw new TRPCError({ code: "NOT_FOUND", message: "Auction room not found" });
      if (room.status !== "completed") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Auction is not yet completed" });
      }

      const report = await generateAuctionReportCard(
        ctx.db,
        input.roomId,
        ctx.user.id,
        [], // projections loaded inside the function
        null, // team rating calculated inside
      );

      // Tier gating: Free gets grade + summary + squad (AI insights gated)
      const tier = ctx.tier ?? "basic";
      if (!tierAtLeast(tier, "pro")) {
        return {
          overallGrade: report.overallGrade,
          overallScore: report.overallScore,
          summary: report.summary,
          squad: report.squad, // Squad visible to all users
          bestValue: null,
          worstValue: null,
          teamStrengths: [],
          teamWeaknesses: [],
          suggestedTradeTargets: [],
          budgetEfficiency: null,
          teamRating: null,
          gated: true,
          requiredTier: "pro" as const,
        };
      }

      return { ...report, gated: false, requiredTier: null };
    }),

  /**
   * Generate auction buzz commentary (called by server after auction events).
   */
  buzz: protectedProcedure
    .input(z.object({
      event: z.enum(["sold", "unsold", "bidwar", "budget_crunch"]),
      playerName: z.string().optional(),
      buyerName: z.string().optional(),
      amount: z.number().optional(),
      fairValue: z.number().optional(),
      budgetRemaining: z.number().optional(),
      slotsLeft: z.number().optional(),
      soldCount: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const messages = await generateAuctionBuzz(input.event, {
        playerName: input.playerName,
        buyerName: input.buyerName,
        amount: input.amount,
        fairValue: input.fairValue,
        budgetRemaining: input.budgetRemaining,
        slotsLeft: input.slotsLeft,
        soldCount: input.soldCount,
      });
      return { messages };
    }),

  /**
   * Get waiver wire recommendations for the current user.
   * Free: top 1. Pro: top 5. Elite: all + filters.
   */
  waiverRecommendations: protectedProcedure
    .input(z.object({ leagueId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const draftRoom = await ctx.db.query.draftRooms.findFirst({
        where: and(eq(draftRooms.leagueId, input.leagueId), eq(draftRooms.status, "completed")),
        columns: { id: true },
      });
      if (!draftRoom) throw new TRPCError({ code: "BAD_REQUEST", message: "No completed draft found" });

      // Get user's remaining budget
      const userPicks = await ctx.db.query.draftPicks.findMany({
        where: and(eq(draftPicks.roomId, draftRoom.id), eq(draftPicks.userId, ctx.user.id)),
        columns: { bidAmount: true },
      });
      const totalSpent = userPicks.reduce((s, p) => s + Number(p.bidAmount ?? 0), 0);

      const league = await ctx.db.query.leagues.findFirst({
        where: eq(leagues.id, input.leagueId),
        columns: { rules: true },
      });
      const rules = (league?.rules ?? {}) as Record<string, unknown>;
      const auctionRules = (rules.auction ?? {}) as Record<string, unknown>;
      const auctionBudget = (auctionRules.auctionBudget as number) ?? 100;
      const budgetRemaining = auctionBudget - totalSpent;

      const recommendations = await getWaiverRecommendations(
        ctx.db,
        input.leagueId,
        ctx.user.id,
        draftRoom.id,
        [], // projections loaded inside
        [], // fdr loaded inside
        budgetRemaining,
        10,
      );

      // Tier gating
      const tier = ctx.tier ?? "basic";
      if (!tierAtLeast(tier, "pro")) {
        return {
          recommendations: recommendations.slice(0, 1),
          totalAvailable: recommendations.length,
          gated: true,
          requiredTier: "pro" as const,
        };
      }

      if (!tierAtLeast(tier, "elite")) {
        return {
          recommendations: recommendations.slice(0, 5),
          totalAvailable: recommendations.length,
          gated: false,
          requiredTier: null,
        };
      }

      return {
        recommendations,
        totalAvailable: recommendations.length,
        gated: false,
        requiredTier: null,
      };
    }),

  /**
   * Get auction context for Guru chat (used by guru router to enrich context).
   */
  guruContext: protectedProcedure
    .input(z.object({ roomId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const state = await loadAuctionState(ctx.db, input.roomId);
      if (!state) throw new TRPCError({ code: "NOT_FOUND", message: "Auction room not found" });

      // Build player name map from draft picks + sold players
      const allPlayerIds = [
        ...state.soldPlayers.map((s) => s.playerId),
        ...(state.currentPlayerId ? [state.currentPlayerId] : []),
      ];

      const playerNames: Record<string, string> = {};
      if (allPlayerIds.length > 0) {
        const playerRecords = await ctx.db.query.players.findMany({
          where: inArray(players.id, allPlayerIds),
          columns: { id: true, name: true },
        });
        for (const p of playerRecords) {
          playerNames[p.id] = p.name;
        }
      }

      return buildAuctionGuruContext(state, playerNames);
    }),

  /**
   * Get player stats for auction popup.
   */
  playerStats: protectedProcedure
    .input(z.object({ playerId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const player = await ctx.db.query.players.findFirst({
        where: eq(players.id, input.playerId),
        columns: { id: true, name: true, role: true, team: true, stats: true, nationality: true, battingStyle: true, bowlingStyle: true },
      });
      if (!player) throw new TRPCError({ code: "NOT_FOUND", message: "Player not found" });

      const stats = (player.stats ?? {}) as Record<string, unknown>;
      const credits = (stats.adminCredits ?? stats.calculatedCredits ?? stats.geminiCredits ?? stats.credits ?? 8.0) as number;

      return {
        name: player.name,
        role: player.role,
        team: player.team,
        nationality: player.nationality,
        battingStyle: player.battingStyle,
        bowlingStyle: player.bowlingStyle,
        credits,
        average: (stats.average as number) ?? null,
        strikeRate: (stats.strikeRate as number) ?? null,
        economyRate: (stats.economyRate as number) ?? null,
        bowlingAverage: (stats.bowlingAverage as number) ?? null,
        bowlingStrikeRate: (stats.bowlingStrikeRate as number) ?? null,
        matchesPlayed: (stats.matchesPlayed as number) ?? null,
        recentForm: (stats.recentForm as number) ?? null,
        injuryStatus: (stats.injuryStatus as string) ?? null,
        formNote: (stats.formNote as string) ?? null,
      };
    }),
});
