/**
 * Admin router — CRUD for tournaments, matches, players, contests, config, users, and system health.
 * All endpoints require admin role via adminProcedure.
 */

import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import {
  tournaments,
  matches,
  players,
  playerMatchScores,
  contests,
  fantasyTeams,
  users,
  wallets,
  transactions,
  dataRefreshLog,
  adminConfig,
} from "@draftplay/db";
import { eq, desc, sql, and, ilike, count, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  setAdminConfig,
  getEffectiveTeamRules,
  getVisibleTournamentNames,
  invalidateAdminConfigCache,
  getFeatureFlags,
} from "../services/admin-config";
import { invalidateHotCache } from "../services/sports-cache";
import { executeRefresh, executeDiscovery, upsertPlayers, linkPlayersToMatch, upsertMatches, updateTournamentStandings, diffPlayers, applyApprovedPlayers } from "../services/sports-data";
import { getDashboardFromPg } from "../services/sports-data";
import { fetchPlayersByTeams, fetchSinglePlayer, fetchSingleMatchStatus, fetchTournamentStandings, fetchSportsData } from "../services/gemini-sports";
import { normalizePlayerExternalId } from "../services/sports-data";
import type { PlayerDiffEntry } from "@draftplay/shared";
import { getLogger } from "../lib/logger";
import type { Sport } from "@draftplay/shared";
import { determineMatchPhase, calculateNextRefreshAfter, calculateFantasyPoints, DEFAULT_T20_SCORING } from "@draftplay/shared";
import { lockMatchContests, processScoreUpdate, completeMatch } from "../jobs/score-updater";
import { settleMatchContests } from "../jobs/settle-contest";

const log = getLogger("admin-router");

// ---------------------------------------------------------------------------
// Sub-routers
// ---------------------------------------------------------------------------

const tournamentsRouter = router({
  list: adminProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select()
      .from(tournaments)
      .orderBy(desc(tournaments.updatedAt));
    return rows;
  }),

  toggleVisible: adminProcedure
    .input(z.object({ tournamentId: z.string().uuid(), visible: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(tournaments)
        .set({ isVisible: input.visible, updatedAt: new Date() })
        .where(eq(tournaments.id, input.tournamentId))
        .returning();

      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Tournament not found" });

      // Invalidate caches so sports.ts picks up the change
      await invalidateAdminConfigCache();
      await invalidateHotCache("dashboard:");

      // Auto-hydrate: when toggling ON, fetch matches/players/standings in background
      if (input.visible) {
        executeRefresh(
          (updated.sport as Sport) ?? "cricket",
          "manual",
          undefined,
          [updated.name]
        ).catch((err) => {
          log.error({ tournamentId: input.tournamentId, error: String(err) },
            "Background hydration failed after visibility toggle");
        });
      }

      log.info({ tournamentId: input.tournamentId, visible: input.visible }, "Tournament visibility toggled");
      return { ...updated, hydrating: input.visible };
    }),

  discover: adminProcedure
    .input(z.object({
      sport: z.enum(["cricket", "f1", "football", "kabaddi", "basketball"]).default("cricket"),
    }))
    .mutation(async ({ input }) => {
      const result = await executeDiscovery(input.sport as Sport);
      return result;
    }),

  getById: adminProcedure
    .input(z.object({ tournamentId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const tournament = await ctx.db.query.tournaments.findFirst({
        where: eq(tournaments.id, input.tournamentId),
      });
      if (!tournament) throw new TRPCError({ code: "NOT_FOUND", message: "Tournament not found" });
      return tournament;
    }),

  getPlayers: adminProcedure
    .input(z.object({
      tournamentId: z.string().uuid(),
      search: z.string().optional(),
      limit: z.number().min(1).max(200).default(51),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      // Step 1: Get unique player IDs linked to matches in this tournament
      const linkedPlayerIds = await ctx.db
        .select({ playerId: playerMatchScores.playerId })
        .from(playerMatchScores)
        .innerJoin(matches, eq(matches.id, playerMatchScores.matchId))
        .where(eq(matches.tournamentId, input.tournamentId))
        .groupBy(playerMatchScores.playerId);

      const playerIds = linkedPlayerIds.map((r) => r.playerId);
      if (playerIds.length === 0) return [];

      // Step 2: Get player details
      const conditions: any[] = [inArray(players.id, playerIds)];
      if (input.search) {
        conditions.push(ilike(players.name, `%${input.search}%`));
      }

      const rows = await ctx.db
        .select({
          id: players.id,
          name: players.name,
          team: players.team,
          role: players.role,
          nationality: players.nationality,
          stats: players.stats,
        })
        .from(players)
        .where(and(...conditions))
        .orderBy(players.name)
        .limit(input.limit)
        .offset(input.offset);

      return rows;
    }),

  updateRules: adminProcedure
    .input(
      z.object({
        tournamentId: z.string().uuid(),
        rules: z.object({
          maxBudget: z.number().min(1).optional(),
          maxOverseas: z.number().min(0).optional(),
          maxFromOneTeam: z.number().min(1).optional(),
          roleLimits: z
            .record(z.object({ min: z.number().min(0), max: z.number().min(1) }))
            .optional(),
          overseasRule: z.object({
            enabled: z.boolean(),
            hostCountry: z.string(),
          }).optional(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(tournaments)
        .set({ tournamentRules: input.rules, updatedAt: new Date() })
        .where(eq(tournaments.id, input.tournamentId))
        .returning();

      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Tournament not found" });

      await invalidateAdminConfigCache();
      log.info({ tournamentId: input.tournamentId }, "Tournament rules updated");
      return updated;
    }),

  forceRefresh: adminProcedure
    .input(z.object({ tournamentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const tournament = await ctx.db.query.tournaments.findFirst({
        where: eq(tournaments.id, input.tournamentId),
      });
      if (!tournament) throw new TRPCError({ code: "NOT_FOUND", message: "Tournament not found" });

      await invalidateHotCache("dashboard:");
      const result = await executeRefresh(
        (tournament.sport as Sport) ?? "cricket",
        "manual",
        undefined,
        [tournament.name]
      );

      return { refreshed: result.refreshed, tournament: tournament.name };
    }),

  refreshStandings: adminProcedure
    .input(z.object({ tournamentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const tournament = await ctx.db.query.tournaments.findFirst({
        where: eq(tournaments.id, input.tournamentId),
      });
      if (!tournament) throw new TRPCError({ code: "NOT_FOUND", message: "Tournament not found" });

      const sport = (tournament.sport as Sport) ?? "cricket";
      const standingsMap = await fetchTournamentStandings(sport, [tournament.name]);
      const result = await updateTournamentStandings(sport, standingsMap, ctx.db);

      await invalidateHotCache("dashboard:");
      log.info({ tournamentId: input.tournamentId, ...result }, "Standings refreshed");

      return {
        tournament: tournament.name,
        teamsCount: result.teamsCount,
        fetchAction: result.fetchAction,
        updatedAt: new Date().toISOString(),
      };
    }),

  refreshMatches: adminProcedure
    .input(z.object({ tournamentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const tournament = await ctx.db.query.tournaments.findFirst({
        where: eq(tournaments.id, input.tournamentId),
      });
      if (!tournament) throw new TRPCError({ code: "NOT_FOUND", message: "Tournament not found" });

      const sport = (tournament.sport as Sport) ?? "cricket";
      const data = await fetchSportsData(sport, [tournament.name]);
      const result = await upsertMatches(sport, data.matches, ctx.db);

      await invalidateHotCache("dashboard:");
      log.info({ tournamentId: input.tournamentId, ...result, newMatches: undefined, updatedMatches: undefined }, "Matches refreshed");

      return {
        tournament: tournament.name,
        total: result.total,
        new: result.newCount,
        updated: result.updatedCount,
        skipped: result.skippedCount,
        newMatches: result.newMatches,
        updatedMatches: result.updatedMatches,
        updatedAt: new Date().toISOString(),
      };
    }),

  delete: adminProcedure
    .input(z.object({ tournamentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const tournament = await ctx.db.query.tournaments.findFirst({
        where: eq(tournaments.id, input.tournamentId),
      });
      if (!tournament) throw new TRPCError({ code: "NOT_FOUND", message: "Tournament not found" });

      // Get all match IDs for this tournament to cascade delete player_match_scores
      const tournamentMatches = await ctx.db
        .select({ id: matches.id })
        .from(matches)
        .where(eq(matches.tournamentId, input.tournamentId));

      const matchIds = tournamentMatches.map((m) => m.id);

      if (matchIds.length > 0) {
        await ctx.db.delete(playerMatchScores).where(inArray(playerMatchScores.matchId, matchIds));
        await ctx.db.delete(matches).where(eq(matches.tournamentId, input.tournamentId));
      }

      await ctx.db.delete(tournaments).where(eq(tournaments.id, input.tournamentId));

      await invalidateHotCache("dashboard:");
      log.info({ tournamentId: input.tournamentId, name: tournament.name }, "Tournament deleted");

      return { deleted: true, name: tournament.name };
    }),
});

const matchesRouter = router({
  list: adminProcedure
    .input(
      z.object({
        tournamentId: z.string().uuid().optional(),
        status: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [];
      if (input.tournamentId) conditions.push(eq(matches.tournamentId, input.tournamentId));
      if (input.status) conditions.push(eq(matches.status, input.status));

      const rows = await ctx.db
        .select()
        .from(matches)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(matches.startTime))
        .limit(input.limit)
        .offset(input.offset);

      return rows;
    }),

  fetchPlayers: adminProcedure
    .input(z.object({ matchId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const match = await ctx.db.query.matches.findFirst({
        where: eq(matches.id, input.matchId),
      });
      if (!match) throw new TRPCError({ code: "NOT_FOUND", message: "Match not found" });

      // Get tournament name for context in Gemini prompt
      let tournamentName = match.tournament ?? "Unknown";
      if (match.tournamentId) {
        const t = await ctx.db.query.tournaments.findFirst({
          where: eq(tournaments.id, match.tournamentId),
        });
        if (t) tournamentName = t.name;
      }

      const sport = (match.sport as Sport) ?? "cricket";
      const teamList = [match.teamHome, match.teamAway].filter((t) => t && t !== "TBA");

      if (teamList.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Match has no valid teams" });
      }

      // Load existing player names for this match to send to Gemini for consistency
      const existingPlayers = await ctx.db
        .select({ name: players.name })
        .from(playerMatchScores)
        .innerJoin(players, eq(players.id, playerMatchScores.playerId))
        .where(eq(playerMatchScores.matchId, input.matchId));
      const existingNames = existingPlayers.map((p) => p.name);
      const hasExisting = existingNames.length > 0;

      log.info({ matchId: input.matchId, teams: teamList, tournament: tournamentName, existingCount: existingNames.length }, "Fetching players for match");
      const aiPlayers = await fetchPlayersByTeams(sport, teamList, tournamentName, hasExisting ? existingNames : undefined);

      if (aiPlayers.length === 0) {
        return { mode: "auto" as const, fetched: 0, new: 0, updated: 0, skipped: 0, newNames: [] as string[], updatedNames: [] as string[], skippedNames: [] as string[], diffs: [] as PlayerDiffEntry[] };
      }

      // First fetch (no existing players): auto-apply immediately
      if (!hasExisting) {
        const result = await upsertPlayers(sport, aiPlayers);
        await linkPlayersToMatch(input.matchId, match.teamHome, match.teamAway);
        return {
          mode: "auto" as const,
          fetched: aiPlayers.length,
          new: result.newCount,
          updated: result.updatedCount,
          skipped: result.skippedCount,
          newNames: result.newNames,
          updatedNames: result.updatedNames,
          skippedNames: result.skippedNames,
          diffs: [] as PlayerDiffEntry[],
        };
      }

      // Re-fetch (existing players): return diff for admin review
      const diffs = await diffPlayers(sport, aiPlayers);
      return {
        mode: "review" as const,
        fetched: aiPlayers.length,
        new: 0,
        updated: 0,
        skipped: 0,
        newNames: [] as string[],
        updatedNames: [] as string[],
        skippedNames: [] as string[],
        diffs,
      };
    }),

  applyPlayerChanges: adminProcedure
    .input(z.object({
      matchId: z.string().uuid(),
      approved: z.array(z.object({
        externalId: z.string(),
        name: z.string(),
        team: z.string(),
        changeType: z.enum(["new", "updated"]),
        changes: z.array(z.object({
          field: z.string(),
          oldValue: z.union([z.string(), z.number(), z.null()]),
          newValue: z.union([z.string(), z.number(), z.null()]),
        })),
        reason: z.string(),
        proposed: z.object({
          name: z.string(),
          team: z.string(),
          role: z.string(),
          nationality: z.string(),
          battingStyle: z.string().nullable(),
          bowlingStyle: z.string().nullable(),
          credits: z.number().nullable(),
          battingAvg: z.number().nullable(),
          bowlingAvg: z.number().nullable(),
          strikeRate: z.number().nullable().optional(),
          economyRate: z.number().nullable().optional(),
          bowlingStrikeRate: z.number().nullable().optional(),
          matchesPlayed: z.number().nullable().optional(),
          recentForm: z.number().nullable().optional(),
          sentimentScore: z.number().nullable().optional(),
          injuryStatus: z.string().nullable().optional(),
          formNote: z.string().nullable().optional(),
        }),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      const match = await ctx.db.query.matches.findFirst({
        where: eq(matches.id, input.matchId),
      });
      if (!match) throw new TRPCError({ code: "NOT_FOUND", message: "Match not found" });

      const sport = (match.sport as Sport) ?? "cricket";
      const result = await applyApprovedPlayers(sport, input.approved as PlayerDiffEntry[]);
      await linkPlayersToMatch(input.matchId, match.teamHome, match.teamAway);

      log.info({ matchId: input.matchId, approved: input.approved.length, ...result }, "Applied approved player changes");
      return result;
    }),

  refreshPlayer: adminProcedure
    .input(z.object({
      matchId: z.string().uuid(),
      playerId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Load player info
      const player = await ctx.db.query.players.findFirst({
        where: eq(players.id, input.playerId),
      });
      if (!player) throw new TRPCError({ code: "NOT_FOUND", message: "Player not found" });

      // Load match for tournament context
      const match = await ctx.db.query.matches.findFirst({
        where: eq(matches.id, input.matchId),
      });
      if (!match) throw new TRPCError({ code: "NOT_FOUND", message: "Match not found" });

      let tournamentName = match.tournament ?? "Unknown";
      if (match.tournamentId) {
        const t = await ctx.db.query.tournaments.findFirst({
          where: eq(tournaments.id, match.tournamentId),
        });
        if (t) tournamentName = t.name;
      }

      const sport = (match.sport as Sport) ?? "cricket";
      const aiPlayer = await fetchSinglePlayer(sport, player.name, player.team ?? "Unknown", tournamentName);

      if (!aiPlayer) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not fetch player data from Gemini" });
      }

      // Diff the single player against existing DB
      const diffs = await diffPlayers(sport, [aiPlayer]);
      const actionable = diffs.filter((d) => d.changeType !== "no_change");

      if (actionable.length === 0) {
        return { mode: "no_change" as const, playerName: player.name };
      }

      // Return diff for review (same format as bulk fetch)
      return {
        mode: "review" as const,
        playerName: player.name,
        diffs: actionable,
      };
    }),

  getPlayers: adminProcedure
    .input(z.object({ matchId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          id: players.id,
          name: players.name,
          team: players.team,
          role: players.role,
          nationality: players.nationality,
          battingStyle: players.battingStyle,
          bowlingStyle: players.bowlingStyle,
          isDisabled: players.isDisabled,
          stats: players.stats,
          lastFetchAction: players.lastFetchAction,
          lastFetchedAt: players.lastFetchedAt,
          pmsId: playerMatchScores.id,
          score: {
            runs: playerMatchScores.runs,
            ballsFaced: playerMatchScores.ballsFaced,
            fours: playerMatchScores.fours,
            sixes: playerMatchScores.sixes,
            wickets: playerMatchScores.wickets,
            oversBowled: playerMatchScores.oversBowled,
            runsConceded: playerMatchScores.runsConceded,
            maidens: playerMatchScores.maidens,
            catches: playerMatchScores.catches,
            stumpings: playerMatchScores.stumpings,
            runOuts: playerMatchScores.runOuts,
            fantasyPoints: playerMatchScores.fantasyPoints,
            isPlaying: playerMatchScores.isPlaying,
          },
        })
        .from(playerMatchScores)
        .innerJoin(players, eq(players.id, playerMatchScores.playerId))
        .where(eq(playerMatchScores.matchId, input.matchId))
        .orderBy(players.team, players.name);

      return rows;
    }),

  updatePhase: adminProcedure
    .input(z.object({ matchId: z.string().uuid(), phase: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(matches)
        .set({ matchPhase: input.phase })
        .where(eq(matches.id, input.matchId))
        .returning();

      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Match not found" });
      return updated;
    }),

  refreshMatch: adminProcedure
    .input(z.object({ matchId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const match = await ctx.db.query.matches.findFirst({
        where: eq(matches.id, input.matchId),
      });
      if (!match) throw new TRPCError({ code: "NOT_FOUND", message: "Match not found" });

      // Fetch latest status from Gemini (pass current score to prevent stale data)
      const tournamentName = match.tournament ?? "Unknown";
      const geminiUpdate = await fetchSingleMatchStatus(
        match.teamHome, match.teamAway, tournamentName, match.format, match.startTime,
        match.scoreSummary
      );

      const now = new Date();
      const changes: string[] = [];

      // Use Gemini-reported status if available, otherwise fall back to local calculation
      let newStatus = match.status;
      if (geminiUpdate) {
        if (geminiUpdate.status !== match.status) {
          changes.push(`status: ${match.status} → ${geminiUpdate.status}`);
          newStatus = geminiUpdate.status;
        }
        if (geminiUpdate.result && geminiUpdate.result !== match.result) {
          changes.push(`result: ${match.result ?? "—"} → ${geminiUpdate.result}`);
        }
        if (geminiUpdate.tossWinner && geminiUpdate.tossWinner !== match.tossWinner) {
          changes.push(`toss: ${geminiUpdate.tossWinner} elected to ${geminiUpdate.tossDecision ?? "?"}`);
        }
        if (geminiUpdate.scoreSummary) {
          changes.push(`score: ${geminiUpdate.scoreSummary}`);
        }
      } else {
        // Fallback to local phase calculation
        const phase = determineMatchPhase(match.startTime, null, match.status);
        const correctedStatus = phase === "completed" || phase === "post_match" ? "completed"
          : phase === "live" ? "live"
          : match.status;
        if (correctedStatus !== match.status) {
          changes.push(`status: ${match.status} → ${correctedStatus}`);
          newStatus = correctedStatus;
        }
      }

      const phase = determineMatchPhase(match.startTime, null, newStatus);
      if (match.matchPhase !== phase) changes.push(`phase: ${match.matchPhase} → ${phase}`);
      const nextRefresh = calculateNextRefreshAfter(phase, now);

      const updateSet: Record<string, any> = {
        status: newStatus,
        matchPhase: phase,
        lastRefreshedAt: now,
        nextRefreshAfter: nextRefresh,
        lastFetchAction: "updated",
        lastFetchedAt: now,
      };

      if (geminiUpdate?.result) updateSet.result = geminiUpdate.result;
      if (geminiUpdate?.scoreSummary) {
        // Only accept the new score if it's not a downgrade (e.g. losing overs info)
        const hasOvers = (s: string) => /\(\d+\.?\d*\s*ov\)/i.test(s);
        const existingScore = match.scoreSummary;
        const newScore = geminiUpdate.scoreSummary;
        if (!existingScore || hasOvers(newScore) || !hasOvers(existingScore)) {
          updateSet.scoreSummary = newScore;
        } else {
          log.info({ existingScore, newScore }, "Rejected score update: new score missing overs");
        }
      }
      if (geminiUpdate?.tossWinner) updateSet.tossWinner = geminiUpdate.tossWinner;
      if (geminiUpdate?.tossDecision) updateSet.tossDecision = geminiUpdate.tossDecision;

      const [updated] = await ctx.db
        .update(matches)
        .set(updateSet)
        .where(eq(matches.id, input.matchId))
        .returning();

      await invalidateHotCache("dashboard:");

      // --- Auto-transition contests when match status changes ---
      let contestsTransitioned = 0;

      if (newStatus === "completed") {
        // Match is completed → close any still-open or live contests
        // "live" contests → "settling" (ready for settlement)
        const settlingResult = await ctx.db
          .update(contests)
          .set({ status: "settling" })
          .where(and(eq(contests.matchId, input.matchId), eq(contests.status, "live")))
          .returning({ id: contests.id });

        // "open" contests → "cancelled" (match ended before they went live)
        const cancelledResult = await ctx.db
          .update(contests)
          .set({ status: "cancelled" })
          .where(and(eq(contests.matchId, input.matchId), eq(contests.status, "open")))
          .returning({ id: contests.id });

        contestsTransitioned = settlingResult.length + cancelledResult.length;
        if (settlingResult.length > 0) {
          changes.push(`${settlingResult.length} contest(s) → settling`);
        }
        if (cancelledResult.length > 0) {
          changes.push(`${cancelledResult.length} open contest(s) → cancelled`);
        }
        if (contestsTransitioned > 0) {
          log.info({ matchId: input.matchId, settling: settlingResult.length, cancelled: cancelledResult.length }, "Contests transitioned on match completion");
        }
      } else if (newStatus === "live") {
        // Match is live → lock any still-open contests
        const lockedResult = await ctx.db
          .update(contests)
          .set({ status: "live" })
          .where(and(eq(contests.matchId, input.matchId), eq(contests.status, "open")))
          .returning({ id: contests.id });

        contestsTransitioned = lockedResult.length;
        if (lockedResult.length > 0) {
          changes.push(`${lockedResult.length} contest(s) → live`);
          log.info({ matchId: input.matchId, locked: lockedResult.length }, "Contests locked on match going live");
        }
      }

      log.info({ matchId: input.matchId, changes, geminiAvailable: !!geminiUpdate }, "Match status refreshed via Gemini");

      return {
        id: updated!.id,
        status: newStatus,
        phase,
        changes,
        contestsTransitioned,
        unchanged: changes.length === 0,
      };
    }),

  /**
   * Seed player match scores for testing/simulation.
   * If no scores provided, generates random realistic T20 stats.
   */
  seedPlayerScores: adminProcedure
    .input(
      z.object({
        matchId: z.string().uuid(),
        scores: z
          .array(
            z.object({
              playerId: z.string().uuid(),
              runs: z.number().int().default(0),
              ballsFaced: z.number().int().default(0),
              fours: z.number().int().default(0),
              sixes: z.number().int().default(0),
              wickets: z.number().int().default(0),
              oversBowled: z.number().default(0),
              runsConceded: z.number().int().default(0),
              maidens: z.number().int().default(0),
              catches: z.number().int().default(0),
              stumpings: z.number().int().default(0),
              runOuts: z.number().int().default(0),
            })
          )
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get existing player-match-score rows for this match
      const existingScores = await ctx.db.query.playerMatchScores.findMany({
        where: eq(playerMatchScores.matchId, input.matchId),
      });

      if (existingScores.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No players linked to this match. Fetch players first.",
        });
      }

      const scoresToUse = input.scores ?? existingScores.map((ps) => {
        // Generate random realistic T20 stats
        const isBatter = Math.random() > 0.4;
        const isBowler = Math.random() > 0.5;
        const runs = isBatter ? Math.floor(Math.random() * 80) : Math.floor(Math.random() * 15);
        const ballsFaced = isBatter ? Math.max(runs, Math.floor(Math.random() * 40) + 5) : Math.floor(Math.random() * 10) + 1;
        const fours = Math.floor(runs / 12);
        const sixes = Math.floor(runs / 25);
        const overs = isBowler ? Math.floor(Math.random() * 4) + 1 : 0;
        const wickets = isBowler ? Math.floor(Math.random() * 3) : 0;
        const runsConceded = isBowler ? Math.floor(Math.random() * 35) + 10 : 0;
        const maidens = isBowler && Math.random() > 0.8 ? 1 : 0;
        const catches = Math.random() > 0.7 ? 1 : 0;

        return {
          playerId: ps.playerId,
          runs,
          ballsFaced,
          fours,
          sixes,
          wickets,
          oversBowled: overs,
          runsConceded,
          maidens,
          catches,
          stumpings: 0,
          runOuts: 0,
        };
      });

      let updated = 0;
      for (const score of scoresToUse) {
        const fantasyPoints = calculateFantasyPoints(score, DEFAULT_T20_SCORING);

        await ctx.db
          .update(playerMatchScores)
          .set({
            runs: score.runs,
            ballsFaced: score.ballsFaced,
            fours: score.fours,
            sixes: score.sixes,
            wickets: score.wickets,
            oversBowled: String(score.oversBowled),
            runsConceded: score.runsConceded,
            maidens: score.maidens,
            catches: score.catches,
            stumpings: score.stumpings,
            runOuts: score.runOuts,
            fantasyPoints: String(fantasyPoints),
            isPlaying: true,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(playerMatchScores.playerId, score.playerId),
              eq(playerMatchScores.matchId, input.matchId)
            )
          );
        updated++;
      }

      log.info({ matchId: input.matchId, playersScored: updated }, "Player scores seeded");
      return { playersScored: updated };
    }),

  /**
   * Drive a match through its lifecycle phases for testing.
   * Phases: lock → score → complete → settle
   */
  simulateLifecycle: adminProcedure
    .input(
      z.object({
        matchId: z.string().uuid(),
        phase: z.enum(["lock", "score", "complete", "settle", "reset"]),
        result: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const match = await ctx.db.query.matches.findFirst({
        where: eq(matches.id, input.matchId),
      });

      if (!match) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Match not found" });
      }

      let contestsAffected = 0;
      let resultMsg = "";

      switch (input.phase) {
        case "lock": {
          contestsAffected = await lockMatchContests(ctx.db, input.matchId);
          resultMsg = `Locked ${contestsAffected} contest(s). Match status → live.`;
          break;
        }
        case "score": {
          // Fetch current player scores and process them through the scoring engine
          const allScores = await ctx.db.query.playerMatchScores.findMany({
            where: eq(playerMatchScores.matchId, input.matchId),
          });

          const scoreUpdates = allScores.map((s) => ({
            playerId: s.playerId,
            runs: s.runs ?? 0,
            ballsFaced: s.ballsFaced ?? 0,
            fours: s.fours ?? 0,
            sixes: s.sixes ?? 0,
            wickets: s.wickets ?? 0,
            oversBowled: Number(s.oversBowled) || 0,
            runsConceded: s.runsConceded ?? 0,
            maidens: s.maidens ?? 0,
            catches: s.catches ?? 0,
            stumpings: s.stumpings ?? 0,
            runOuts: s.runOuts ?? 0,
          }));

          await processScoreUpdate(ctx.db, input.matchId, scoreUpdates);

          // Count live contests
          const liveContests = await ctx.db.query.contests.findMany({
            where: and(eq(contests.matchId, input.matchId), eq(contests.status, "live")),
            columns: { id: true },
          });
          contestsAffected = liveContests.length;
          resultMsg = `Processed scores for ${scoreUpdates.length} players across ${contestsAffected} live contest(s).`;
          break;
        }
        case "complete": {
          const resultText = input.result ?? "Match completed";
          await completeMatch(ctx.db, input.matchId, resultText);

          const settlingContests = await ctx.db.query.contests.findMany({
            where: and(eq(contests.matchId, input.matchId), eq(contests.status, "settling")),
            columns: { id: true },
          });
          contestsAffected = settlingContests.length;
          resultMsg = `Match completed: "${resultText}". ${contestsAffected} contest(s) → settling.`;
          break;
        }
        case "settle": {
          const { settledCount, totalWinners } = await settleMatchContests(ctx.db, input.matchId);
          contestsAffected = settledCount;
          resultMsg = `Settled ${settledCount} contest(s). ${totalWinners} winner(s) awarded prizes.`;
          break;
        }
        case "reset": {
          // Reset match back to upcoming + delete all related contest/team/score data
          await ctx.db.delete(playerMatchScores).where(eq(playerMatchScores.matchId, input.matchId));

          const matchContests = await ctx.db.query.contests.findMany({
            where: eq(contests.matchId, input.matchId),
            columns: { id: true },
          });
          const contestIds = matchContests.map((c) => c.id);

          if (contestIds.length > 0) {
            await ctx.db.delete(fantasyTeams).where(inArray(fantasyTeams.contestId, contestIds));
            await ctx.db.delete(contests).where(eq(contests.matchId, input.matchId));
          }

          // Also delete teams linked directly to match (without contest)
          await ctx.db.delete(fantasyTeams).where(eq(fantasyTeams.matchId, input.matchId));

          await ctx.db
            .update(matches)
            .set({ status: "upcoming", result: null, tossWinner: null, tossDecision: null })
            .where(eq(matches.id, input.matchId));

          contestsAffected = contestIds.length;
          resultMsg = `Reset match to upcoming. Deleted ${contestsAffected} contest(s) and all related data.`;
          break;
        }
      }

      log.info({ matchId: input.matchId, phase: input.phase, contestsAffected, resultMsg }, "Lifecycle phase executed");

      return {
        phase: input.phase,
        result: resultMsg,
        contestsAffected,
      };
    }),
});

const playersRouter = router({
  list: adminProcedure
    .input(
      z.object({
        search: z.string().optional(),
        team: z.string().optional(),
        role: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [];
      if (input.search) conditions.push(ilike(players.name, `%${input.search}%`));
      if (input.team) conditions.push(eq(players.team, input.team));
      if (input.role) conditions.push(eq(players.role, input.role));

      const rows = await ctx.db
        .select()
        .from(players)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(players.name)
        .limit(input.limit)
        .offset(input.offset);

      return rows;
    }),

  updateCredits: adminProcedure
    .input(z.object({
      playerId: z.string().uuid(),
      credits: z.number().min(0).nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const player = await ctx.db.query.players.findFirst({
        where: eq(players.id, input.playerId),
      });
      if (!player) throw new TRPCError({ code: "NOT_FOUND", message: "Player not found" });

      const stats = (player.stats as Record<string, unknown>) ?? {};
      if (input.credits === null) {
        // Remove admin override — revert to Gemini credits
        delete stats.adminCredits;
      } else {
        // Set admin override — survives Gemini refresh
        stats.adminCredits = input.credits;
      }

      const [updated] = await ctx.db
        .update(players)
        .set({ stats })
        .where(eq(players.id, input.playerId))
        .returning();

      return updated;
    }),

  toggleDisabled: adminProcedure
    .input(z.object({ playerId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const player = await ctx.db.query.players.findFirst({
        where: eq(players.id, input.playerId),
      });
      if (!player) throw new TRPCError({ code: "NOT_FOUND", message: "Player not found" });

      const [updated] = await ctx.db
        .update(players)
        .set({ isDisabled: !player.isDisabled, updatedAt: new Date() })
        .where(eq(players.id, input.playerId))
        .returning();

      log.info({ playerId: input.playerId, isDisabled: updated!.isDisabled }, "Player disabled status toggled");
      return updated;
    }),

  addToMatch: adminProcedure
    .input(z.object({ playerId: z.string().uuid(), matchId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .insert(playerMatchScores)
        .values({ playerId: input.playerId, matchId: input.matchId, isPlaying: true })
        .onConflictDoNothing();

      return { added: true };
    }),

  removeFromMatch: adminProcedure
    .input(z.object({ playerId: z.string().uuid(), matchId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(playerMatchScores)
        .where(
          and(
            eq(playerMatchScores.playerId, input.playerId),
            eq(playerMatchScores.matchId, input.matchId)
          )
        );

      return { removed: true };
    }),

  create: adminProcedure
    .input(z.object({
      name: z.string().min(1),
      team: z.string().min(1),
      role: z.enum(["batsman", "bowler", "all_rounder", "wicket_keeper"]),
      nationality: z.string().min(1),
      battingStyle: z.string().optional(),
      bowlingStyle: z.string().optional(),
      credits: z.number().min(0).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const externalId = normalizePlayerExternalId(input.name, input.nationality);

      // Check if player already exists
      const existing = await ctx.db.query.players.findFirst({
        where: eq(players.externalId, externalId),
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Player "${input.name}" (${input.nationality}) already exists`,
        });
      }

      const stats: Record<string, number> = {};
      if (input.credits != null) stats.adminCredits = input.credits;

      const [created] = await ctx.db
        .insert(players)
        .values({
          externalId,
          name: input.name,
          team: input.team,
          role: input.role,
          nationality: input.nationality,
          battingStyle: input.battingStyle,
          bowlingStyle: input.bowlingStyle,
          stats,
        })
        .returning();

      log.info({ playerId: created!.id, name: input.name }, "Player created by admin");
      return created;
    }),
});

const contestsRouter = router({
  list: adminProcedure
    .input(
      z.object({
        matchId: z.string().uuid().optional(),
        status: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [];
      if (input.matchId) conditions.push(eq(contests.matchId, input.matchId));
      if (input.status) conditions.push(eq(contests.status, input.status));

      const rows = await ctx.db
        .select()
        .from(contests)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(contests.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return rows;
    }),

  create: adminProcedure
    .input(
      z.object({
        matchId: z.string().uuid(),
        name: z.string().min(1),
        entryFee: z.string().default("0"),
        prizePool: z.string().default("0"),
        maxEntries: z.number().min(2),
        contestType: z.enum(["public", "private", "h2h"]).default("public"),
        isGuaranteed: z.boolean().default(false),
        prizeDistribution: z.any(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [contest] = await ctx.db
        .insert(contests)
        .values({
          matchId: input.matchId,
          name: input.name,
          entryFee: input.entryFee,
          prizePool: input.prizePool,
          maxEntries: input.maxEntries,
          contestType: input.contestType,
          isGuaranteed: input.isGuaranteed,
          prizeDistribution: input.prizeDistribution ?? {},
        })
        .returning();

      log.info({ contestId: contest!.id, matchId: input.matchId }, "Contest created by admin");
      return contest;
    }),

  cancel: adminProcedure
    .input(z.object({ contestId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(contests)
        .set({ status: "cancelled" })
        .where(eq(contests.id, input.contestId))
        .returning();

      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Contest not found" });
      log.info({ contestId: input.contestId }, "Contest cancelled by admin");
      return updated;
    }),
});

const configRouter = router({
  list: adminProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db.select().from(adminConfig).orderBy(adminConfig.key);
    return rows;
  }),

  upsert: adminProcedure
    .input(
      z.object({
        key: z.string().min(1),
        value: z.any(),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await setAdminConfig(input.key, input.value, input.description, ctx.user.id);
      return { success: true };
    }),

  getTeamRules: adminProcedure
    .input(z.object({ tournamentId: z.string().uuid().optional() }))
    .query(async ({ input }) => {
      return getEffectiveTeamRules(input.tournamentId);
    }),

  getFeatureFlags: adminProcedure.query(async () => {
    return getFeatureFlags();
  }),
});

const usersRouter = router({
  list: adminProcedure
    .input(
      z.object({
        search: z.string().optional(),
        role: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [];
      if (input.search) {
        conditions.push(ilike(users.username, `%${input.search}%`));
      }
      if (input.role) conditions.push(eq(users.role, input.role));

      const rows = await ctx.db
        .select({
          id: users.id,
          email: users.email,
          username: users.username,
          displayName: users.displayName,
          role: users.role,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(users.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return rows;
    }),

  updateRole: adminProcedure
    .input(
      z.object({
        userId: z.string().uuid(),
        role: z.enum(["user", "admin", "moderator"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(users)
        .set({ role: input.role, updatedAt: new Date() })
        .where(eq(users.id, input.userId))
        .returning({
          id: users.id,
          username: users.username,
          role: users.role,
        });

      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      log.info({ userId: input.userId, newRole: input.role }, "User role updated by admin");
      return updated;
    }),
});

const systemRouter = router({
  refreshLogs: adminProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(dataRefreshLog)
        .orderBy(desc(dataRefreshLog.createdAt))
        .limit(input.limit)
        .offset(input.offset);
      return rows;
    }),

  triggerRefresh: adminProcedure
    .input(z.object({
      sport: z.enum(["cricket", "f1", "football", "kabaddi", "basketball"]).default("cricket"),
      unfiltered: z.boolean().default(false),
    }))
    .mutation(async ({ input }) => {
      const sport = input.sport as Sport;

      // Admin can do unfiltered refresh to discover ALL tournaments from Gemini
      let filter: string[] | undefined;
      if (!input.unfiltered) {
        const activeFilter = await getVisibleTournamentNames();
        filter = activeFilter.length > 0 ? activeFilter : undefined;
      }

      await invalidateHotCache(`dashboard:${sport}`);
      const result = await executeRefresh(sport, "manual", undefined, filter);

      return { refreshed: result.refreshed };
    }),

  stats: adminProcedure.query(async ({ ctx }) => {
    const [userCount] = await ctx.db.select({ count: count() }).from(users);
    const [teamCount] = await ctx.db.select({ count: count() }).from(fantasyTeams);
    const [contestCount] = await ctx.db
      .select({ count: count() })
      .from(contests)
      .where(eq(contests.status, "open"));
    const [tournamentCount] = await ctx.db
      .select({ count: count() })
      .from(tournaments)
      .where(eq(tournaments.isVisible, true));

    return {
      totalUsers: userCount?.count ?? 0,
      totalTeams: teamCount?.count ?? 0,
      activeContests: contestCount?.count ?? 0,
      visibleTournaments: tournamentCount?.count ?? 0,
    };
  }),
});

const revenueRouter = router({
  summary: adminProcedure.query(async ({ ctx }) => {
    const [deposits] = await ctx.db
      .select({ total: sql<string>`COALESCE(SUM(amount::numeric), 0)` })
      .from(transactions)
      .where(and(eq(transactions.type, "deposit"), eq(transactions.status, "completed")));

    const [withdrawals] = await ctx.db
      .select({ total: sql<string>`COALESCE(SUM(amount::numeric), 0)` })
      .from(transactions)
      .where(and(eq(transactions.type, "withdrawal"), eq(transactions.status, "completed")));

    return {
      totalDeposits: Number(deposits?.total ?? 0),
      totalWithdrawals: Number(withdrawals?.total ?? 0),
      note: "Full revenue dashboard coming with L1.5 Subscription Monetization",
    };
  }),
});

// ---------------------------------------------------------------------------
// Merged admin router
// ---------------------------------------------------------------------------

export const adminRouter = router({
  tournaments: tournamentsRouter,
  matches: matchesRouter,
  players: playersRouter,
  contests: contestsRouter,
  config: configRouter,
  users: usersRouter,
  system: systemRouter,
  revenue: revenueRouter,
});
