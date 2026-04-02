/**
 * Admin router — CRUD for tournaments, matches, players, contests, config, users, and system health.
 * All endpoints require admin role via adminProcedure.
 */

import { z } from "zod";
import { router, adminProcedure, supportProcedure } from "../trpc";
import {
  tournaments,
  matches,
  players,
  playerMatchScores,
  contests,
  fantasyTeams,
  users,
  userProfiles,
  wallets,
  transactions,
  subscriptions,
  subscriptionEvents,
  dataRefreshLog,
  adminConfig,
  draftRooms,
  getDb,
} from "@draftplay/db";
import { eq, desc, asc, sql, and, ilike, count, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  setAdminConfig,
  getAdminConfig,
  getEffectiveTeamRules,
  getVisibleTournamentNames,
  invalidateAdminConfigCache,
  getFeatureFlags,
} from "../services/admin-config";
import { invalidateHotCache } from "../services/sports-cache";
import { executeRefresh, executeDiscovery, upsertPlayers, linkPlayersToMatch, upsertMatches, upsertTournaments, updateTournamentStandings, diffPlayers, applyApprovedPlayers, getDataSourcePreference, enrichAndUpdatePlayers } from "../services/sports-data";
import { getDashboardFromPg } from "../services/sports-data";
// All data fetching now goes through provider chain — no direct gemini-sports imports needed
import { ESPNProvider } from "../providers/espn";
import {
  fetchStandingsWithFallback,
  fetchDashboardWithFallback,
  fetchMatchStatusWithFallback,
  fetchPlayersWithFallback,
  fetchSinglePlayerWithFallback,
} from "../providers";
import { normalizePlayerExternalId } from "../services/sports-data";
import { resolveNationalitiesWithGemini } from "../services/gemini-sports";
import { calculatePlayerCredits } from "../services/credits-engine";
import type { PlayerDiffEntry } from "@draftplay/shared";
import { getLogger } from "../lib/logger";
import type { Sport } from "@draftplay/shared";
import { determineMatchPhase, calculateNextRefreshAfter, calculateFantasyPoints, DEFAULT_T20_SCORING } from "@draftplay/shared";
import { lockMatchContests, processScoreUpdate, completeMatch } from "../jobs/score-updater";
import { settleMatchContests } from "../jobs/settle-contest";
import { onPhaseTransition, finalizePredictionsAndSettle } from "../services/match-lifecycle";

const log = getLogger("admin-router");

// ---------------------------------------------------------------------------
// Sub-routers
// ---------------------------------------------------------------------------

const tournamentsRouter = router({
  list: adminProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select()
      .from(tournaments)
      .orderBy(asc(tournaments.startDate));
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
        const seriesHints = updated.externalId ? [{ name: updated.name, externalId: updated.externalId }] : undefined;
        executeRefresh(
          (updated.sport as Sport) ?? "cricket",
          "manual",
          undefined,
          [updated.name],
          seriesHints
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
      // Step 1: Get unique player IDs and their per-match team for this tournament
      // Use the per-match team from playerMatchScores (first non-null match)
      const linkedPlayers = await ctx.db
        .select({
          playerId: playerMatchScores.playerId,
          matchTeam: sql<string>`MAX(${playerMatchScores.team})`.as("match_team"),
        })
        .from(playerMatchScores)
        .innerJoin(matches, eq(matches.id, playerMatchScores.matchId))
        .where(eq(matches.tournamentId, input.tournamentId))
        .groupBy(playerMatchScores.playerId);

      const playerIds = linkedPlayers.map((r) => r.playerId);
      if (playerIds.length === 0) return [];

      // Build a map of playerId → per-match team
      const matchTeamMap = new Map<string, string>();
      for (const lp of linkedPlayers) {
        if (lp.matchTeam) matchTeamMap.set(lp.playerId, lp.matchTeam);
      }

      // Step 2: Get player details
      const conditions: any[] = [inArray(players.id, playerIds)];
      if (input.search) {
        conditions.push(ilike(players.name, `%${input.search}%`));
      }

      const rows = await ctx.db
        .select({
          id: players.id,
          externalId: players.externalId,
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

      // Override global team with per-match team where available
      return rows.map(r => ({
        ...r,
        team: matchTeamMap.get(r.id) ?? r.team,
      }));
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
      const seriesHints = tournament.externalId ? [{ name: tournament.name, externalId: tournament.externalId }] : undefined;
      const result = await executeRefresh(
        (tournament.sport as Sport) ?? "cricket",
        "manual",
        undefined,
        [tournament.name],
        seriesHints
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
      const preference = await getDataSourcePreference();
      const { data: standingsMap, source } = await fetchStandingsWithFallback(sport, [tournament.name], preference);
      log.info({ tournamentId: input.tournamentId, source, preference }, "Standings fetched via provider chain");
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
      const preference = await getDataSourcePreference();
      // Pass externalId as a series hint for precise resolution (avoids name collisions between tournament editions)
      const seriesHints = tournament.externalId ? [{ name: tournament.name, externalId: tournament.externalId }] : undefined;
      const { data, source } = await fetchDashboardWithFallback(sport, [tournament.name], preference, seriesHints);
      log.info({ tournamentId: input.tournamentId, source, preference, matches: data.matches.length, tournaments: data.tournaments.length }, "Matches fetched via provider chain");

      // Filter to only this tournament's data — purely by externalId (ID-based, never name-based)
      const tournamentExternalId = tournament.externalId?.toLowerCase();

      const filteredTournaments = tournamentExternalId
        ? data.tournaments.filter(t => t.id.toLowerCase() === tournamentExternalId)
        : data.tournaments; // no externalId = can't filter, keep all (shouldn't happen for Cricbuzz)

      const keptExternalIds = new Set(filteredTournaments.map(t => t.id.toLowerCase()));

      const filteredMatches = tournamentExternalId
        ? data.matches.filter(m =>
            m.tournamentExternalId?.toLowerCase() === tournamentExternalId ||
            (m.tournamentExternalId && keptExternalIds.has(m.tournamentExternalId.toLowerCase()))
          )
        : data.matches;

      log.info({
        tournamentId: input.tournamentId,
        totalMatches: data.matches.length,
        filteredMatches: filteredMatches.length,
        totalTournaments: data.tournaments.length,
        filteredTournaments: filteredTournaments.length,
      }, "Filtered dashboard data to target tournament");

      // Upsert only the target tournament's data
      if (filteredTournaments.length > 0) {
        await upsertTournaments(sport, filteredTournaments, ctx.db);
      }

      const result = await upsertMatches(sport, filteredMatches, ctx.db);

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

  fetchTeamLogos: adminProcedure
    .input(z.object({ tournamentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const tournament = await ctx.db.query.tournaments.findFirst({
        where: eq(tournaments.id, input.tournamentId),
      });
      if (!tournament) throw new TRPCError({ code: "NOT_FOUND", message: "Tournament not found" });

      // Extract seriesId from externalId (e.g., "cb-9241" → 9241)
      const cbMatch = tournament.externalId?.match(/^cb-(\d+)$/);
      if (!cbMatch) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Tournament has no Cricbuzz series ID" });
      }
      const seriesId = parseInt(cbMatch[1]!, 10);
      const seriesSlug = tournament.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

      const { fetchSeriesTeamLogos } = await import("../providers/cricbuzz/cricbuzz-client");
      const teamInfos = await fetchSeriesTeamLogos(seriesId, seriesSlug);

      if (teamInfos.length === 0) {
        return { updated: 0, teams: [] };
      }

      // Build teams JSONB: merge with existing teams data if any
      const existingTeams = (tournament.teams as any[]) ?? [];
      const existingMap = new Map(existingTeams.map(t => [t.name?.toLowerCase(), t]));

      const mergedTeams = teamInfos.map(t => ({
        name: t.name,
        shortName: t.shortName,
        logo: t.logoUrl,
        ...((existingMap.get(t.name.toLowerCase()) as any) ?? {}),
        // Overwrite logo if we got a new one
        ...(t.logoUrl ? { logo: t.logoUrl } : {}),
      }));

      await ctx.db
        .update(tournaments)
        .set({ teams: mergedTeams, updatedAt: new Date() })
        .where(eq(tournaments.id, input.tournamentId));

      log.info({ tournamentId: input.tournamentId, teams: mergedTeams.length }, "Updated tournament team logos");
      return { updated: mergedTeams.length, teams: mergedTeams };
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
        .orderBy(asc(matches.startTime))
        .limit(input.limit)
        .offset(input.offset);

      return rows;
    }),

  getById: adminProcedure
    .input(z.object({ matchId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const match = await ctx.db.query.matches.findFirst({
        where: eq(matches.id, input.matchId),
      });
      if (!match) throw new TRPCError({ code: "NOT_FOUND", message: "Match not found" });

      // Get tournament info
      let tournamentName: string | null = null;
      let tournamentExternalId: string | null = null;
      if (match.tournamentId) {
        const t = await ctx.db.query.tournaments.findFirst({
          where: eq(tournaments.id, match.tournamentId),
        });
        if (t) {
          tournamentName = t.name;
          tournamentExternalId = t.externalId ?? null;
        }
      }

      return { ...match, tournamentName, tournamentExternalId };
    }),

  fetchPlayers: adminProcedure
    .input(z.object({ matchId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const match = await ctx.db.query.matches.findFirst({
        where: eq(matches.id, input.matchId),
      });
      if (!match) throw new TRPCError({ code: "NOT_FOUND", message: "Match not found" });

      // Get tournament name and externalId for precise series resolution
      let tournamentName = match.tournament ?? "Unknown";
      let tournamentExternalId: string | undefined;
      if (match.tournamentId) {
        const t = await ctx.db.query.tournaments.findFirst({
          where: eq(tournaments.id, match.tournamentId),
        });
        if (t) {
          tournamentName = t.name;
          tournamentExternalId = t.externalId ?? undefined;
        }
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

      const preference = await getDataSourcePreference();
      const matchContext = match.startTime ? { startTime: new Date(match.startTime), format: match.format ?? undefined } : undefined;
      log.info({ matchId: input.matchId, teams: teamList, tournament: tournamentName, tournamentExternalId, existingCount: existingNames.length, preference }, "Fetching players for match via provider chain");
      const { data: aiPlayers, source: playerSource } = await fetchPlayersWithFallback(sport, teamList, tournamentName, hasExisting ? existingNames : undefined, preference, matchContext, tournamentExternalId);
      log.info({ matchId: input.matchId, playerSource, count: aiPlayers.length }, "Players fetched via provider chain");

      if (aiPlayers.length === 0) {
        return { mode: "auto" as const, fetched: 0, new: 0, updated: 0, skipped: 0, newNames: [] as string[], updatedNames: [] as string[], skippedNames: [] as string[], diffs: [] as PlayerDiffEntry[] };
      }

      // Collect provider external IDs for precise linking (e.g., "cb-576" from Cricbuzz)
      const playerExternalIds = aiPlayers
        .map(p => p.id)
        .filter(id => id && id.length > 0);

      // Build per-match team mapping: externalId → team name from this fetch context
      const playerTeamMap = new Map<string, string>();
      for (const p of aiPlayers) {
        const eid = p.id && p.id.length > 0
          ? p.id
          : normalizePlayerExternalId(p.name, p.nationality);
        if (p.team) playerTeamMap.set(eid, p.team);
      }

      // First fetch (no existing players): auto-apply immediately
      if (!hasExisting) {
        const result = await upsertPlayers(sport, aiPlayers);
        await linkPlayersToMatch(
          input.matchId, match.teamHome, match.teamAway,
          undefined, // use default db
          playerExternalIds.length > 0 ? playerExternalIds : undefined,
          playerTeamMap
        );
        return {
          mode: "auto" as const,
          source: playerSource,
          fetched: aiPlayers.length,
          new: result.newCount,
          updated: result.updatedCount,
          skipped: result.skippedCount,
          linked: playerExternalIds.length,
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

      // Build per-match team mapping from approved diffs
      const teamMap = new Map<string, string>();
      for (const d of input.approved) {
        if (d.team) teamMap.set(d.externalId, d.team);
      }
      await linkPlayersToMatch(input.matchId, match.teamHome, match.teamAway, undefined, undefined, teamMap);

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
      const preference = await getDataSourcePreference();
      const { data: aiPlayer, source: playerSource } = await fetchSinglePlayerWithFallback(sport, player.name, player.team ?? "Unknown", tournamentName, preference);
      log.info({ playerId: input.playerId, playerSource, preference }, "Single player fetched via provider chain");

      if (!aiPlayer) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not fetch player data from provider chain" });
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

  enrichPlayers: adminProcedure
    .input(z.object({ matchId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const match = await ctx.db.query.matches.findFirst({
        where: eq(matches.id, input.matchId),
      });
      if (!match) throw new TRPCError({ code: "NOT_FOUND", message: "Match not found" });

      log.info({ matchId: input.matchId }, "Starting AI enrichment for match players");
      const result = await enrichAndUpdatePlayers(input.matchId);
      log.info({ matchId: input.matchId, ...result, enrichedNames: undefined }, "AI enrichment complete");

      return result;
    }),

  getPlayers: adminProcedure
    .input(z.object({ matchId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          id: players.id,
          name: players.name,
          team: sql<string>`COALESCE(${playerMatchScores.team}, ${players.team})`.as("team"),
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
      // Get current phase before updating
      const current = await ctx.db.query.matches.findFirst({
        where: eq(matches.id, input.matchId),
        columns: { matchPhase: true },
      });
      if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Match not found" });

      const fromPhase = current.matchPhase ?? "idle";

      // Update the phase
      const [updated] = await ctx.db
        .update(matches)
        .set({ matchPhase: input.phase })
        .where(eq(matches.id, input.matchId))
        .returning();

      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Match not found" });

      // Fire lifecycle automation for phase transition
      let lifecycle: { actions: string[] } = { actions: [] };
      if (fromPhase !== input.phase) {
        try {
          lifecycle = await onPhaseTransition(ctx.db, input.matchId, fromPhase, input.phase);
          log.info({ matchId: input.matchId, fromPhase, toPhase: input.phase, actions: lifecycle.actions }, "Phase transition automation executed");
        } catch (err) {
          log.error({ matchId: input.matchId, fromPhase, toPhase: input.phase, error: err instanceof Error ? err.message : String(err) }, "Phase transition automation failed");
          // Don't throw — phase was already updated, automation failure is non-blocking
        }
      }

      return { ...updated, lifecycleActions: lifecycle.actions };
    }),

  refreshMatch: adminProcedure
    .input(z.object({ matchId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const match = await ctx.db.query.matches.findFirst({
        where: eq(matches.id, input.matchId),
      });
      if (!match) throw new TRPCError({ code: "NOT_FOUND", message: "Match not found" });

      // Fetch latest status via provider chain (pass current score to prevent stale data)
      const tournamentName = match.tournament ?? "Unknown";
      const sport = (match.sport as Sport) ?? "cricket";
      const preference = await getDataSourcePreference();
      const { data: providerUpdate, source: matchSource } = await fetchMatchStatusWithFallback(
        sport, match.teamHome, match.teamAway, tournamentName, match.format, match.startTime,
        match.scoreSummary ?? undefined, preference
      );
      log.info({ matchId: input.matchId, matchSource, preference }, "Match status fetched via provider chain");
      const geminiUpdate = providerUpdate;

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

      // Sync draftEnabled with phase transitions
      if (phase === "pre_match") {
        updateSet.draftEnabled = true;
      } else if (phase === "live" || phase === "completed" || phase === "post_match") {
        updateSet.draftEnabled = false;
      }

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
   * Refresh player scores from Cricbuzz live scorecard.
   * Scrapes individual player stats (batting, bowling, fielding)
   * and feeds them through the fantasy scoring pipeline.
   */
  refreshScores: adminProcedure
    .input(z.object({ matchId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const match = await ctx.db.query.matches.findFirst({ where: eq(matches.id, input.matchId) });
      if (!match) throw new TRPCError({ code: "NOT_FOUND", message: "Match not found" });

      const matchChanges: string[] = [];
      const now = new Date();

      // Helper: extract total overs from a score summary to detect stale data
      const extractTotalOvers = (summary: string | null | undefined): number => {
        if (!summary) return 0;
        let total = 0;
        const overMatches = summary.matchAll(/\((\d+(?:\.\d+)?)\)/g);
        for (const m of overMatches) total += parseFloat(m[1]!);
        return total;
      };

      // 1. Refresh match score — prefer direct scorecard fetch if we have externalId
      let newStatus = match.status;
      const cbIdMatch = match.externalId?.match(/cb-(?:match-)?(\d+)/);
      if (cbIdMatch) {
        const { fetchMatchScoreById } = await import("../providers/cricbuzz/cricbuzz-client");
        const cbScore = await fetchMatchScoreById(parseInt(cbIdMatch[1]!, 10));
        if (cbScore) {
          const currentOvers = extractTotalOvers(match.scoreSummary);
          const newOvers = extractTotalOvers(cbScore.scoreSummary);
          const isStale = cbScore.scoreSummary && newOvers < currentOvers;

          const updateSet: Record<string, any> = { lastRefreshedAt: now, lastFetchedAt: now, lastFetchAction: "updated" };
          if (cbScore.scoreSummary && !isStale) {
            updateSet.scoreSummary = cbScore.scoreSummary;
            matchChanges.push(`score: ${cbScore.scoreSummary}`);
          } else if (isStale) {
            matchChanges.push(`skipped stale score: ${cbScore.scoreSummary} (current: ${match.scoreSummary})`);
          }
          if (cbScore.status && cbScore.status !== match.status) { newStatus = cbScore.status; updateSet.status = newStatus; matchChanges.push(`status: ${newStatus}`); }
          if (cbScore.result) { updateSet.result = cbScore.result; matchChanges.push(`result: ${cbScore.result}`); }
          if (cbScore.tossWinner) { updateSet.tossWinner = cbScore.tossWinner; }
          if (cbScore.tossDecision) { updateSet.tossDecision = cbScore.tossDecision; }

          // Sync matchPhase and draftEnabled with status
          const phase = determineMatchPhase(match.startTime, null, newStatus);
          if (match.matchPhase !== phase) { updateSet.matchPhase = phase; matchChanges.push(`phase: ${match.matchPhase} → ${phase}`); }
          updateSet.nextRefreshAfter = calculateNextRefreshAfter(phase, now);
          if (phase === "pre_match") updateSet.draftEnabled = true;
          else if (phase === "live" || phase === "completed" || phase === "post_match") updateSet.draftEnabled = false;

          await ctx.db.update(matches).set(updateSet).where(eq(matches.id, input.matchId));
        }
      } else {
        // Fallback to provider chain (series listing)
        const sport = (match.sport as Sport) ?? "cricket";
        const preference = await getDataSourcePreference();
        const { data: providerUpdate } = await fetchMatchStatusWithFallback(
          sport, match.teamHome, match.teamAway, match.tournament ?? "", match.format, match.startTime,
          match.scoreSummary ?? undefined, preference
        );
        if (providerUpdate) {
          const currentOvers = extractTotalOvers(match.scoreSummary);
          const newOvers = extractTotalOvers(providerUpdate.scoreSummary);
          const isStale = providerUpdate.scoreSummary && newOvers < currentOvers;

          const updateSet: Record<string, any> = { lastRefreshedAt: now, lastFetchedAt: now, lastFetchAction: "updated" };
          if (providerUpdate.scoreSummary && !isStale) {
            updateSet.scoreSummary = providerUpdate.scoreSummary;
            matchChanges.push(`score: ${providerUpdate.scoreSummary}`);
          } else if (isStale) {
            matchChanges.push(`skipped stale score: ${providerUpdate.scoreSummary} (current: ${match.scoreSummary})`);
          }
          if (providerUpdate.status && providerUpdate.status !== match.status) { newStatus = providerUpdate.status; updateSet.status = newStatus; matchChanges.push(`status: ${newStatus}`); }
          if (providerUpdate.result) { updateSet.result = providerUpdate.result; matchChanges.push(`result: ${providerUpdate.result}`); }
          if (providerUpdate.tossWinner) { updateSet.tossWinner = providerUpdate.tossWinner; }
          if (providerUpdate.tossDecision) { updateSet.tossDecision = providerUpdate.tossDecision; }

          // Sync matchPhase and draftEnabled with status
          const phase = determineMatchPhase(match.startTime, null, newStatus);
          if (match.matchPhase !== phase) { updateSet.matchPhase = phase; matchChanges.push(`phase: ${match.matchPhase} → ${phase}`); }
          updateSet.nextRefreshAfter = calculateNextRefreshAfter(phase, now);
          if (phase === "pre_match") updateSet.draftEnabled = true;
          else if (phase === "live" || phase === "completed" || phase === "post_match") updateSet.draftEnabled = false;

          await ctx.db.update(matches).set(updateSet).where(eq(matches.id, input.matchId));
        }
      }

      // 2. Auto-transition contests when match status changes
      if (newStatus !== match.status) {
        if (newStatus === "live") {
          const locked = await ctx.db.update(contests).set({ status: "live" })
            .where(and(eq(contests.matchId, input.matchId), eq(contests.status, "open"))).returning({ id: contests.id });
          if (locked.length > 0) matchChanges.push(`${locked.length} contest(s) → live`);
        } else if (newStatus === "completed") {
          const settling = await ctx.db.update(contests).set({ status: "settling" })
            .where(and(eq(contests.matchId, input.matchId), eq(contests.status, "live"))).returning({ id: contests.id });
          const cancelled = await ctx.db.update(contests).set({ status: "cancelled" })
            .where(and(eq(contests.matchId, input.matchId), eq(contests.status, "open"))).returning({ id: contests.id });
          if (settling.length > 0) matchChanges.push(`${settling.length} contest(s) → settling`);
          if (cancelled.length > 0) matchChanges.push(`${cancelled.length} open contest(s) → cancelled`);
        }
      }

      // 3. Fetch confirmed playing XI if toss has happened
      const { fetchAndStorePlayingXI } = await import("../services/playing-xi-fetch");
      const xiResult = await fetchAndStorePlayingXI(ctx.db, input.matchId);
      if (xiResult.stored) {
        matchChanges.push(`playing XI stored (${xiResult.benchNotifications} bench notifications sent)`);
      }

      // 4. Invalidate dashboard cache so app picks up changes immediately
      await invalidateHotCache("dashboard:");

      // 5. Refresh player scores from Cricbuzz scorecard
      const { refreshMatchScoresFromCricbuzz } = await import("../services/live-scores");
      const result = await refreshMatchScoresFromCricbuzz(ctx.db, input.matchId);

      return { ...result, matchChanges };
    }),

  /**
   * Poll all live matches and refresh scores from Cricbuzz.
   */
  pollLiveScores: adminProcedure
    .mutation(async ({ ctx }) => {
      const { pollLiveMatchScores } = await import("../services/live-scores");
      const result = await pollLiveMatchScores(ctx.db);
      return result;
    }),

  /**
   * Drive a match through its lifecycle phases for testing.
   * Phases: lock → score → complete → settle
   */
  simulateLifecycle: adminProcedure
    .input(
      z.object({
        matchId: z.string().uuid(),
        phase: z.enum(["lock", "score", "complete", "settle", "finalize_predictions", "reset"]),
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

          // Count contests that were scored (live, settling, or settled)
          const scoredContests = await ctx.db.query.contests.findMany({
            where: and(eq(contests.matchId, input.matchId), inArray(contests.status, ["live", "settling", "settled"])),
            columns: { id: true },
          });
          contestsAffected = scoredContests.length;
          resultMsg = `Processed scores for ${scoreUpdates.length} players across ${contestsAffected} contest(s).`;
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
        case "finalize_predictions": {
          const finalResult = await finalizePredictionsAndSettle(ctx.db, input.matchId);
          contestsAffected = finalResult.settledCount;
          resultMsg = `Finalized: ${finalResult.abandoned} prediction(s) abandoned, ${finalResult.settledCount} contest(s) settled, ${finalResult.totalWinners} winner(s).`;
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
        sortBy: z.enum(["name", "team", "role", "nationality", "credits"]).optional(),
        sortDir: z.enum(["asc", "desc"]).optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [];
      if (input.search) conditions.push(ilike(players.name, `%${input.search}%`));
      if (input.team) conditions.push(eq(players.team, input.team));
      if (input.role) conditions.push(eq(players.role, input.role));

      const dirFn = input.sortDir === "desc" ? desc : asc;
      const columnMap: Record<string, any> = {
        name: players.name,
        team: players.team,
        role: players.role,
        nationality: players.nationality,
        credits: sql`COALESCE((stats->>'adminCredits')::numeric, (stats->>'calculatedCredits')::numeric, (stats->>'credits')::numeric, 0)`,
      };
      const orderCol = columnMap[input.sortBy ?? "name"] ?? players.name;

      const rows = await ctx.db
        .select()
        .from(players)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(dirFn(orderCol))
        .limit(input.limit)
        .offset(input.offset);

      // Overlay per-match team from most recent match score
      if (rows.length > 0) {
        const playerIds = rows.map((r) => r.id);
        const matchTeams = await ctx.db
          .select({
            playerId: playerMatchScores.playerId,
            matchTeam: sql<string>`(
              SELECT pms2.team FROM player_match_scores pms2
              INNER JOIN matches m ON m.id = pms2.match_id
              WHERE pms2.player_id = ${playerMatchScores.playerId}
                AND pms2.team IS NOT NULL
              ORDER BY m.start_time DESC NULLS LAST
              LIMIT 1
            )`.as("match_team"),
          })
          .from(playerMatchScores)
          .where(inArray(playerMatchScores.playerId, playerIds))
          .groupBy(playerMatchScores.playerId);

        const teamMap = new Map<string, string>();
        for (const mt of matchTeams) {
          if (mt.matchTeam) teamMap.set(mt.playerId, mt.matchTeam);
        }

        return rows.map((r) => ({
          ...r,
          team: teamMap.get(r.id) ?? r.team,
        }));
      }

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

  recalculateAllCredits: adminProcedure
    .mutation(async ({ ctx }) => {
      log.info("Recalculating credits for all players with new formula");

      // Fetch all players
      const allPlayers = await ctx.db.select().from(players);
      let updated = 0;
      let skipped = 0;

      for (const player of allPlayers) {
        const stats = (player.stats as Record<string, unknown>) ?? {};

        // Skip players with admin override — those are manually set
        if (stats.adminCredits != null) {
          skipped++;
          continue;
        }

        const role = player.role as import("@draftplay/shared").CricketRole;
        const newCredits = calculatePlayerCredits({
          role,
          battingAvg: (stats.average as number) ?? null,
          strikeRate: (stats.strikeRate as number) ?? null,
          bowlingAvg: (stats.bowlingAverage as number) ?? null,
          economyRate: (stats.economyRate as number) ?? null,
          bowlingStrikeRate: (stats.bowlingStrikeRate as number) ?? null,
          matchesPlayed: (stats.matchesPlayed as number) ?? null,
          recentForm: (stats.recentForm as number) ?? null,
          sentimentScore: (stats.sentimentScore as number) ?? null,
          injuryStatus: (stats.injuryStatus as string) ?? null,
          recentAvgFP: (stats.recentAvgFP as number) ?? null,
        });

        stats.calculatedCredits = newCredits;
        stats.credits = newCredits;

        await ctx.db
          .update(players)
          .set({ stats, updatedAt: new Date() })
          .where(eq(players.id, player.id));

        updated++;
      }

      log.info({ updated, skipped, total: allPlayers.length }, "Credit recalculation complete");
      return { updated, skipped, total: allPlayers.length };
    }),

  fixAllNationalities: adminProcedure
    .mutation(async ({ ctx }) => {
      log.info("Fixing nationalities for all players via Gemini AI");

      const KNOWN_COUNTRIES = new Set([
        "india", "australia", "england", "south africa", "new zealand", "west indies",
        "pakistan", "sri lanka", "bangladesh", "afghanistan", "zimbabwe", "ireland",
        "scotland", "netherlands", "nepal", "uae", "usa", "canada", "oman", "namibia",
        "kenya",
      ]);

      const allPlayers = await ctx.db.select().from(players);
      const needsFix = allPlayers.filter(p =>
        !p.nationality || !KNOWN_COUNTRIES.has(p.nationality.toLowerCase())
      );

      if (needsFix.length === 0) {
        return { updated: 0, total: allPlayers.length, message: "All nationalities already resolved" };
      }

      const toResolve = needsFix.map(p => ({
        name: p.name,
        birthPlace: p.nationality || null,
        team: p.team || "",
      }));

      const resolved = await resolveNationalitiesWithGemini(toResolve);
      const resolvedMap = new Map<string, string>();
      for (const r of resolved) {
        resolvedMap.set(r.playerName.toLowerCase().trim(), r.nationality);
      }

      let updated = 0;
      for (const player of needsFix) {
        const newNationality = resolvedMap.get(player.name.toLowerCase().trim());
        if (newNationality && newNationality !== "Unknown" && newNationality !== player.nationality) {
          await ctx.db
            .update(players)
            .set({ nationality: newNationality, updatedAt: new Date() })
            .where(eq(players.id, player.id));
          updated++;
          log.info({ player: player.name, from: player.nationality, to: newNationality }, "Fixed nationality");
        }
      }

      log.info({ updated, needsFix: needsFix.length, total: allPlayers.length }, "Nationality fix complete");
      return { updated, needsFix: needsFix.length, total: allPlayers.length };
    }),

  fixNationality: adminProcedure
    .input(z.object({ playerId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const player = await ctx.db.query.players.findFirst({
        where: eq(players.id, input.playerId),
      });
      if (!player) throw new TRPCError({ code: "NOT_FOUND", message: "Player not found" });

      const resolved = await resolveNationalitiesWithGemini([
        { name: player.name, birthPlace: player.nationality || null, team: player.team || "" },
      ]);

      if (resolved.length === 0 || resolved[0]!.nationality === "Unknown") {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Gemini could not determine nationality" });
      }

      const newNationality = resolved[0]!.nationality;
      await ctx.db
        .update(players)
        .set({ nationality: newNationality, updatedAt: new Date() })
        .where(eq(players.id, input.playerId));

      log.info({ player: player.name, from: player.nationality, to: newNationality }, "Fixed single player nationality via Gemini");
      return { name: player.name, nationality: newNationality };
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

  getById: adminProcedure
    .input(z.object({ playerId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const player = await ctx.db.query.players.findFirst({
        where: eq(players.id, input.playerId),
      });
      if (!player) throw new TRPCError({ code: "NOT_FOUND", message: "Player not found" });

      // Get match history with scores
      const matchHistory = await ctx.db
        .select({
          matchId: playerMatchScores.matchId,
          team: playerMatchScores.team,
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
          matchName: sql<string>`(SELECT CONCAT(m.team_home, ' vs ', m.team_away) FROM matches m WHERE m.id = ${playerMatchScores.matchId})`.as("match_name"),
          matchDate: sql<string>`(SELECT m.start_time FROM matches m WHERE m.id = ${playerMatchScores.matchId})`.as("match_date"),
          matchFormat: sql<string>`(SELECT m.format FROM matches m WHERE m.id = ${playerMatchScores.matchId})`.as("match_format"),
          tournamentName: sql<string>`(SELECT t.name FROM matches m INNER JOIN tournaments t ON t.id = m.tournament_id WHERE m.id = ${playerMatchScores.matchId})`.as("tournament_name"),
        })
        .from(playerMatchScores)
        .where(eq(playerMatchScores.playerId, input.playerId))
        .orderBy(desc(sql`(SELECT m.start_time FROM matches m WHERE m.id = ${playerMatchScores.matchId})`))
        .limit(50);

      return { ...player, matchHistory };
    }),

  refetchFromCricbuzz: adminProcedure
    .input(z.object({
      playerId: z.string().uuid(),
      teamName: z.string().optional(),
      tournamentName: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const player = await ctx.db.query.players.findFirst({
        where: eq(players.id, input.playerId),
      });
      if (!player) throw new TRPCError({ code: "NOT_FOUND", message: "Player not found" });

      const teamName = input.teamName || player.team;
      const tournamentName = input.tournamentName || "Indian Premier League";

      log.info({ playerId: input.playerId, name: player.name, team: teamName }, "Admin refetch player from Cricbuzz");

      try {
        const result = await fetchSinglePlayerWithFallback(
          "cricket" as Sport,
          player.name,
          teamName,
          tournamentName
        );

        if (!result.data) {
          throw new TRPCError({ code: "NOT_FOUND", message: `Player "${player.name}" not found on Cricbuzz for team "${teamName}"` });
        }

        const ai = result.data;

        // Resolve nationality via Gemini if it looks like a raw birth place
        const KNOWN_COUNTRIES = new Set([
          "india", "australia", "england", "south africa", "new zealand", "west indies",
          "pakistan", "sri lanka", "bangladesh", "afghanistan", "zimbabwe", "ireland",
          "scotland", "netherlands", "nepal", "uae", "usa", "canada", "oman", "namibia",
          "kenya",
        ]);
        if (!ai.nationality || !KNOWN_COUNTRIES.has(ai.nationality.toLowerCase())) {
          try {
            const resolved = await resolveNationalitiesWithGemini([
              { name: ai.name, birthPlace: ai.nationality || null, team: teamName },
            ]);
            if (resolved.length > 0 && resolved[0]!.nationality !== "Unknown") {
              ai.nationality = resolved[0]!.nationality;
            }
          } catch (err) {
            log.warn({ player: ai.name, error: String(err) }, "Gemini nationality resolution failed for single player");
          }
        }

        // Build updated stats — merge with existing to preserve admin overrides
        const existingStats = (player.stats as Record<string, any>) ?? {};
        const newStats: Record<string, any> = { ...existingStats };

        if (ai.battingAvg != null) newStats.average = ai.battingAvg;
        if (ai.bowlingAvg != null) newStats.bowlingAverage = ai.bowlingAvg;
        if (ai.strikeRate != null) newStats.strikeRate = ai.strikeRate;
        if (ai.economyRate != null) newStats.economyRate = ai.economyRate;
        if (ai.bowlingStrikeRate != null) newStats.bowlingStrikeRate = ai.bowlingStrikeRate;
        if (ai.matchesPlayed != null) newStats.matchesPlayed = ai.matchesPlayed;
        if (ai.recentForm != null) newStats.recentForm = ai.recentForm;
        if (ai.sentimentScore != null) newStats.sentimentScore = ai.sentimentScore;
        if (ai.injuryStatus != null) newStats.injuryStatus = ai.injuryStatus;
        if (ai.formNote != null) newStats.formNote = ai.formNote;

        // Recalculate credits (preserve admin override)
        if (newStats.adminCredits == null) {
          const calculatedCredits = calculatePlayerCredits({
            role: ai.role as import("@draftplay/shared").CricketRole,
            battingAvg: ai.battingAvg,
            strikeRate: ai.strikeRate ?? null,
            bowlingAvg: ai.bowlingAvg,
            economyRate: ai.economyRate ?? null,
            bowlingStrikeRate: ai.bowlingStrikeRate ?? null,
            matchesPlayed: ai.matchesPlayed ?? null,
            recentForm: ai.recentForm ?? null,
            sentimentScore: ai.sentimentScore ?? null,
            injuryStatus: ai.injuryStatus ?? null,
            recentAvgFP: null,
          });
          newStats.calculatedCredits = calculatedCredits;
          newStats.credits = calculatedCredits;
        }

        const [updated] = await ctx.db
          .update(players)
          .set({
            name: ai.name || player.name,
            role: ai.role || player.role,
            nationality: ai.nationality || player.nationality,
            battingStyle: ai.battingStyle || player.battingStyle,
            bowlingStyle: ai.bowlingStyle || player.bowlingStyle,
            // Only update photo if we got a new one (preserve existing)
            ...(ai.imageUrl ? { photoUrl: ai.imageUrl } : {}),
            stats: newStats,
            lastFetchAction: "updated",
            lastFetchedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(players.id, input.playerId))
          .returning();

        log.info({ playerId: input.playerId, source: result.source }, "Player refetched from Cricbuzz");
        return { player: updated, source: result.source };
      } catch (error: any) {
        if (error instanceof TRPCError) throw error;
        log.error({ playerId: input.playerId, error: String(error) }, "Failed to refetch player");
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message || "Failed to refetch player" });
      }
    }),

  updatePlayer: adminProcedure
    .input(z.object({
      playerId: z.string().uuid(),
      name: z.string().min(1).optional(),
      team: z.string().min(1).optional(),
      role: z.enum(["batsman", "bowler", "all_rounder", "wicket_keeper"]).optional(),
      nationality: z.string().min(1).optional(),
      battingStyle: z.string().nullable().optional(),
      bowlingStyle: z.string().nullable().optional(),
      stats: z.record(z.any()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const player = await ctx.db.query.players.findFirst({
        where: eq(players.id, input.playerId),
      });
      if (!player) throw new TRPCError({ code: "NOT_FOUND", message: "Player not found" });

      const updates: Record<string, any> = { updatedAt: new Date() };
      if (input.name !== undefined) updates.name = input.name;
      if (input.team !== undefined) updates.team = input.team;
      if (input.role !== undefined) updates.role = input.role;
      if (input.nationality !== undefined) updates.nationality = input.nationality;
      if (input.battingStyle !== undefined) updates.battingStyle = input.battingStyle;
      if (input.bowlingStyle !== undefined) updates.bowlingStyle = input.bowlingStyle;

      if (input.stats !== undefined) {
        // Merge with existing stats (preserve fields not being updated)
        const existingStats = (player.stats as Record<string, any>) ?? {};
        updates.stats = { ...existingStats, ...input.stats };
      }

      const [updated] = await ctx.db
        .update(players)
        .set(updates)
        .where(eq(players.id, input.playerId))
        .returning();

      log.info({ playerId: input.playerId, fields: Object.keys(updates) }, "Player updated by admin");
      return updated;
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

  // Early access feature flags (elite-only → pro_and_above → all rollout)
  getEarlyAccessFlags: adminProcedure.query(async () => {
    const { getFeatureFlags: getEAFlags } = await import("../services/feature-flags");
    return getEAFlags();
  }),

  updateEarlyAccessFlag: adminProcedure
    .input(
      z.object({
        key: z.string().min(1),
        access: z.enum(["elite_only", "pro_and_above", "all", "disabled"]),
        badge: z.enum(["early_access"]).nullable().default(null),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { updateFeatureFlags } = await import("../services/feature-flags");
      await updateFeatureFlags(
        { [input.key]: { access: input.access, badge: input.badge } },
        ctx.user.id
      );
      return { success: true };
    }),
});

const auctionConfigRouter = router({
  /** Get all auction platform config (squad rules, pause cap, bid increments, defaults) */
  getConfig: adminProcedure.query(async () => {
    const squadRules = await getAdminConfig<any[]>("auction_squad_rules") ?? [];
    const bidIncrementOptions = await getAdminConfig<number[]>("auction_bid_increment_options") ?? [0.1, 0.2, 0.5, 1.0];
    const maxPausesCap = await getAdminConfig<number>("auction_max_pauses_cap") ?? 5;
    const defaults = await getAdminConfig<Record<string, unknown>>("auction_default_settings") ?? {};
    return { squadRules, bidIncrementOptions, maxPausesCap, defaults };
  }),

  /** Upsert a squad rule template */
  upsertSquadRule: adminProcedure
    .input(z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      minWK: z.number().min(0), minBAT: z.number().min(0),
      minBOWL: z.number().min(0), minAR: z.number().min(0),
      maxWK: z.number().min(0), maxBAT: z.number().min(0),
      maxBOWL: z.number().min(0), maxAR: z.number().min(0),
    }))
    .mutation(async ({ ctx, input }) => {
      const existing = await getAdminConfig<any[]>("auction_squad_rules") ?? [];
      const idx = existing.findIndex((r: any) => r.id === input.id);
      if (idx >= 0) {
        existing[idx] = input;
      } else {
        existing.push(input);
      }
      await setAdminConfig("auction_squad_rules", existing, "Auction squad rule templates", ctx.user.id);
      return { success: true };
    }),

  /** Delete a squad rule template */
  deleteSquadRule: adminProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const existing = await getAdminConfig<any[]>("auction_squad_rules") ?? [];
      const filtered = existing.filter((r: any) => r.id !== input.id);
      await setAdminConfig("auction_squad_rules", filtered, "Auction squad rule templates", ctx.user.id);
      return { success: true };
    }),

  /** Update platform-level auction settings (max pauses cap, bid increment options, defaults) */
  updatePlatformSettings: adminProcedure
    .input(z.object({
      maxPausesCap: z.number().min(0).max(20).optional(),
      bidIncrementOptions: z.array(z.number()).optional(),
      defaults: z.record(z.unknown()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.maxPausesCap !== undefined) {
        await setAdminConfig("auction_max_pauses_cap", input.maxPausesCap, "Max pauses per member (platform cap)", ctx.user.id);
      }
      if (input.bidIncrementOptions) {
        await setAdminConfig("auction_bid_increment_options", input.bidIncrementOptions, "Available bid increment options", ctx.user.id);
      }
      if (input.defaults) {
        await setAdminConfig("auction_default_settings", input.defaults, "Default auction settings for new leagues", ctx.user.id);
      }
      return { success: true };
    }),

  /** Force-resume a paused auction (admin override) */
  forceResume: adminProcedure
    .input(z.object({ roomId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { loadAuctionState, resumeAuction, updateAuctionRoom } = await import("../services/auction-room");
      const state = await loadAuctionState(ctx.db, input.roomId);
      if (!state) throw new TRPCError({ code: "NOT_FOUND" });
      if (!state.isPaused) throw new TRPCError({ code: "BAD_REQUEST", message: "Auction is not paused" });
      const updated = resumeAuction(state);
      await updateAuctionRoom(ctx.db, updated);
      return { success: true };
    }),

  /** List currently paused auctions across the platform */
  listPaused: adminProcedure.query(async ({ ctx }) => {
    const rooms = await ctx.db.query.draftRooms.findMany({
      where: and(
        eq(draftRooms.type, "auction"),
        eq(draftRooms.status, "in_progress"),
      ),
    });
    // Filter to only paused ones
    return rooms
      .filter((r) => {
        const s = r.settings as Record<string, unknown>;
        return s?._isPaused === true;
      })
      .map((r) => {
        const s = r.settings as Record<string, unknown>;
        return {
          roomId: r.id,
          leagueId: r.leagueId,
          pausedBy: s._pausedBy as string,
          pausedAt: s._pausedAt as string,
        };
      });
  }),
});

const usersRouter = router({
  list: supportProcedure
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

  /** Get full user detail — all DB fields, profile, wallet, subscription, events */
  getDetail: supportProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.query.users.findFirst({
        where: eq(users.id, input.userId),
      });
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });

      const profile = await ctx.db.query.userProfiles.findFirst({
        where: eq(userProfiles.userId, input.userId),
      });

      const wallet = await ctx.db.query.wallets.findFirst({
        where: eq(wallets.userId, input.userId),
      });

      const subscription = await ctx.db.query.subscriptions.findFirst({
        where: eq(subscriptions.userId, input.userId),
      });

      const events = await ctx.db
        .select()
        .from(subscriptionEvents)
        .where(eq(subscriptionEvents.userId, input.userId))
        .orderBy(desc(subscriptionEvents.createdAt))
        .limit(50);

      const recentTransactions = await ctx.db
        .select()
        .from(transactions)
        .where(eq(transactions.userId, input.userId))
        .orderBy(desc(transactions.createdAt))
        .limit(20);

      return { user, profile, wallet, subscription, events, recentTransactions };
    }),

  updateRole: adminProcedure
    .input(
      z.object({
        userId: z.string().uuid(),
        role: z.enum(["user", "admin", "moderator", "support"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Look up user to get firebaseUid for claims sync
      const existingUser = await ctx.db.query.users.findFirst({
        where: eq(users.id, input.userId),
      });
      if (!existingUser) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });

      const [updated] = await ctx.db
        .update(users)
        .set({ role: input.role, updatedAt: new Date() })
        .where(eq(users.id, input.userId))
        .returning({
          id: users.id,
          username: users.username,
          role: users.role,
        });

      // Sync role to Firebase custom claims so frontend can read it
      try {
        const { setUserClaims } = await import("../services/auth");
        const isStaff = input.role === "admin" || input.role === "support";
        await setUserClaims(existingUser.firebaseUid, {
          role: input.role,
          admin: input.role === "admin",
          support: input.role === "support",
          ...(isStaff ? {} : { admin: false, support: false }),
        });
      } catch (err) {
        log.warn({ userId: input.userId, error: err }, "Failed to sync Firebase claims — user may need to re-login");
      }

      log.info({ userId: input.userId, newRole: input.role }, "User role updated by admin");
      return updated!;
    }),

  /** Override a user's tier — accessible to support role */
  overrideTier: supportProcedure
    .input(
      z.object({
        userId: z.string().uuid(),
        tier: z.enum(["basic", "pro", "elite"]),
        reason: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { invalidateUserTierCache } = await import("../services/subscription");

      const existing = await ctx.db.query.subscriptions.findFirst({
        where: eq(subscriptions.userId, input.userId),
      });

      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setFullYear(periodEnd.getFullYear() + 10);

      if (existing) {
        await ctx.db
          .update(subscriptions)
          .set({
            tier: input.tier,
            status: "active",
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            cancelAtPeriodEnd: false,
            updatedAt: now,
          })
          .where(eq(subscriptions.id, existing.id));

        await ctx.db.insert(subscriptionEvents).values({
          userId: input.userId,
          subscriptionId: existing.id,
          event: "admin_override",
          fromTier: existing.tier,
          toTier: input.tier,
          metadata: { reason: input.reason, adminId: ctx.user.id },
        });
      } else {
        const result = await ctx.db
          .insert(subscriptions)
          .values({
            userId: input.userId,
            tier: input.tier,
            status: "active",
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            billingCycle: "yearly",
            priceInPaise: "0",
          })
          .returning({ id: subscriptions.id });

        await ctx.db.insert(subscriptionEvents).values({
          userId: input.userId,
          subscriptionId: result[0]!.id,
          event: "admin_override",
          fromTier: "basic",
          toTier: input.tier,
          metadata: { reason: input.reason, adminId: ctx.user.id },
        });
      }

      await invalidateUserTierCache(input.userId);
      log.info({ userId: input.userId, tier: input.tier, reason: input.reason, by: ctx.user.id }, "Tier overridden via support");
      return { success: true };
    }),

  /** Grant a Day Pass — accessible to support role */
  grantDayPass: supportProcedure
    .input(
      z.object({
        userId: z.string().uuid(),
        reason: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { invalidateUserTierCache } = await import("../services/subscription");
      const { DAY_PASS_CONFIG } = await import("@draftplay/shared");

      const now = new Date();
      const expiresAt = new Date(now);
      expiresAt.setHours(expiresAt.getHours() + DAY_PASS_CONFIG.durationHours);

      const sub = await ctx.db.query.subscriptions.findFirst({
        where: eq(subscriptions.userId, input.userId),
      });

      if (!sub) throw new TRPCError({ code: "NOT_FOUND", message: "User has no subscription record" });

      await ctx.db
        .update(subscriptions)
        .set({
          dayPassActive: true,
          dayPassExpiresAt: expiresAt,
          updatedAt: now,
        })
        .where(eq(subscriptions.id, sub.id));

      await ctx.db.insert(subscriptionEvents).values({
        userId: input.userId,
        subscriptionId: sub.id,
        event: "day_pass_purchased",
        fromTier: sub.tier,
        toTier: sub.tier,
        metadata: { reason: input.reason, adminId: ctx.user.id, source: "support_grant" },
      });

      await invalidateUserTierCache(input.userId);
      log.info({ userId: input.userId, expiresAt, by: ctx.user.id }, "Day pass granted via support");
      return { success: true, dayPassExpiresAt: expiresAt };
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
      let seriesHints: Array<{ name: string; externalId: string }> | undefined;
      if (!input.unfiltered) {
        const activeFilter = await getVisibleTournamentNames();
        filter = activeFilter.length > 0 ? activeFilter : undefined;

        // Build seriesHints from visible tournaments with externalIds
        if (filter) {
          const db = getDb();
          const visibleTournaments = await db.query.tournaments.findMany({
            where: and(eq(tournaments.isVisible, true), eq(tournaments.sport, sport)),
            columns: { name: true, externalId: true },
          });
          seriesHints = visibleTournaments
            .filter(t => t.externalId)
            .map(t => ({ name: t.name, externalId: t.externalId! }));
        }
      }

      await invalidateHotCache(`dashboard:${sport}`);
      const result = await executeRefresh(sport, "manual", undefined, filter, seriesHints);

      return { refreshed: result.refreshed };
    }),

  // Data source preference (auto | espn | gemini)
  getDataSource: adminProcedure.query(async () => {
    const val = await getAdminConfig("dataSource");
    return { dataSource: val ?? "auto" };
  }),

  setDataSource: adminProcedure
    .input(z.object({ dataSource: z.enum(["auto", "espn", "jolpica", "gemini", "cricbuzz"]) }))
    .mutation(async ({ input }) => {
      await setAdminConfig("dataSource", input.dataSource);
      log.info({ dataSource: input.dataSource }, "Data source preference updated");
      return { dataSource: input.dataSource };
    }),

  // ESPN preview — lets admins see what ESPN returns without persisting
  espnPreview: adminProcedure
    .input(z.object({
      sport: z.enum(["cricket", "f1"]),
    }))
    .query(async ({ input }) => {
      const espn = new ESPNProvider();
      try {
        const result = await espn.fetchDashboard(input.sport as Sport);
        return {
          success: true,
          source: result.source,
          durationMs: result.durationMs,
          tournaments: result.data.tournaments.length,
          matches: result.data.matches.length,
          data: {
            tournaments: result.data.tournaments.slice(0, 20),
            matches: result.data.matches.slice(0, 30),
          },
        };
      } catch (err) {
        return {
          success: false,
          source: "espn" as const,
          durationMs: 0,
          tournaments: 0,
          matches: 0,
          data: { tournaments: [], matches: [] },
          error: err instanceof Error ? err.message : String(err),
        };
      }
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
  auctionConfig: auctionConfigRouter,
  users: usersRouter,
  system: systemRouter,
  revenue: revenueRouter,
});
