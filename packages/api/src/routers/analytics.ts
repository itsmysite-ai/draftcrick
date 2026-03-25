import { z } from "zod";
import { eq, and, inArray } from "drizzle-orm";
import { matches, tournaments, players } from "@draftplay/db";
import { router, publicProcedure, protectedProcedure, proProcedure, eliteProcedure } from "../trpc";
import { tierAtLeast, type SubscriptionTier } from "@draftplay/shared";
import { getLogger } from "../lib/logger";

const log = getLogger("analytics-router");
import { getFDRForMatch, batchGenerateFDR } from "../services/fdr-engine";
import { getProjectionsForMatch } from "../services/projection-engine";
import { rateTeam } from "../services/rate-my-team";
import { getCaptainPicks } from "../services/captain-picks";
import { getHeadToHead } from "../services/head-to-head";
import { getDifferentials } from "../services/differentials";
import { getPredictedPlayingXI } from "../services/playing-xi";
import { getPitchWeather } from "../services/pitch-weather";
import { getPlayerStatsForMatch } from "../services/player-stats";
import { comparePlayers } from "../services/player-compare";
import { solveOptimalTeam } from "../services/team-solver";
import { getPointsBreakdownForMatch } from "../services/points-breakdown";
import { getValueTracker } from "../services/value-tracker";
import { getStatTopFives } from "../services/stat-topfives";
import { getFromHotCache, setHotCache } from "../services/sports-cache";
import { eq } from "drizzle-orm";

export const analyticsRouter = router({
  /**
   * Get Fixture Difficulty Rating for a match.
   * Returns FDR for both teams (1-5 scale).
   */
  getFixtureDifficulty: protectedProcedure
    .input(
      z.object({
        matchId: z.string(),
        teamA: z.string(),
        teamB: z.string(),
        format: z.string(),
        venue: z.string().nullable().default(null),
        tournament: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const fdr = await getFDRForMatch(
        ctx.db,
        input.matchId,
        input.teamA,
        input.teamB,
        input.format,
        input.venue,
        input.tournament
      );

      if (!fdr) return fdr;

      const userTier = (ctx.tier ?? "basic") as SubscriptionTier;

      // Free: overall FDR only. Pro: + batting/bowling. Elite: + factors.
      return {
        ...fdr,
        teamA: {
          ...(fdr as any).teamA,
          battingFdr: tierAtLeast(userTier, "pro") ? (fdr as any).teamA?.battingFdr : undefined,
          bowlingFdr: tierAtLeast(userTier, "pro") ? (fdr as any).teamA?.bowlingFdr : undefined,
          factors: tierAtLeast(userTier, "elite") ? (fdr as any).teamA?.factors : undefined,
        },
        teamB: {
          ...(fdr as any).teamB,
          battingFdr: tierAtLeast(userTier, "pro") ? (fdr as any).teamB?.battingFdr : undefined,
          bowlingFdr: tierAtLeast(userTier, "pro") ? (fdr as any).teamB?.bowlingFdr : undefined,
          factors: tierAtLeast(userTier, "elite") ? (fdr as any).teamB?.factors : undefined,
        },
      };
    }),

  /**
   * Get FDR for a specific team across upcoming matches.
   * Used for fixture ticker / schedule difficulty strip.
   */
  getTeamFixtures: protectedProcedure
    .input(
      z.object({
        teamId: z.string(),
        limit: z.number().int().min(1).max(20).default(5),
      })
    )
    .query(async ({ ctx, input }) => {
      const { fixtureDifficulty } = await import("@draftplay/db");

      const rows = await ctx.db
        .select()
        .from(fixtureDifficulty)
        .where(eq(fixtureDifficulty.teamId, input.teamId))
        .limit(input.limit);

      const userTier = (ctx.tier ?? "basic") as SubscriptionTier;

      return rows.map((r) => ({
        matchId: r.matchId,
        teamId: r.teamId,
        overallFdr: r.overallFdr,
        // Pro+ gets batting/bowling breakdown
        battingFdr: tierAtLeast(userTier, "pro") ? r.battingFdr : null,
        bowlingFdr: tierAtLeast(userTier, "pro") ? r.bowlingFdr : null,
        // Elite gets detailed factors
        factors: tierAtLeast(userTier, "elite") ? r.factors : null,
        generatedAt: r.generatedAt?.toISOString() ?? "",
      }));
    }),

  /**
   * Get fixture ticker — FDR for all upcoming matches in a tournament.
   * Returns a compact array of match FDR pairs for the fixture strip.
   */
  getFixtureTicker: protectedProcedure
    .input(
      z.object({
        tournament: z.string(),
        limit: z.number().int().min(1).max(30).default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      const userTier = (ctx.tier ?? "basic") as SubscriptionTier;
      const cacheKey = `fdr-ticker:${input.tournament}:${userTier}`;
      const cached = await getFromHotCache<any[]>(cacheKey);
      if (cached) return cached;

      const { fixtureDifficulty } = await import("@draftplay/db");

      const rows = await ctx.db
        .select()
        .from(fixtureDifficulty)
        .limit(input.limit * 2); // 2 teams per match

      // Group by matchId
      const byMatch = new Map<string, any[]>();
      for (const r of rows) {
        const existing = byMatch.get(r.matchId) ?? [];
        existing.push({
          teamId: r.teamId,
          overallFdr: r.overallFdr,
          // Pro+ gets batting/bowling breakdown
          battingFdr: tierAtLeast(userTier, "pro") ? r.battingFdr : null,
          bowlingFdr: tierAtLeast(userTier, "pro") ? r.bowlingFdr : null,
        });
        byMatch.set(r.matchId, existing);
      }

      const ticker = Array.from(byMatch.entries())
        .filter(([, teams]) => teams.length === 2)
        .slice(0, input.limit)
        .map(([matchId, teams]) => ({
          matchId,
          teamA: teams[0],
          teamB: teams[1],
        }));

      await setHotCache(cacheKey, ticker, 1800);
      return ticker;
    }),

  /**
   * Get AI projected points for all players in a match.
   */
  getPlayerProjections: proProcedure
    .input(
      z.object({
        matchId: z.string(),
        teamA: z.string(),
        teamB: z.string(),
        format: z.string(),
        venue: z.string().nullable().default(null),
        tournament: z.string(),
        players: z.array(
          z.object({
            id: z.string(),
            name: z.string(),
            role: z.string(),
            team: z.string(),
          })
        ).default([]),
      })
    )
    .query(async ({ ctx, input }) => {
      const projections = await getProjectionsForMatch(
        ctx.db,
        input.matchId,
        input.teamA,
        input.teamB,
        input.format,
        input.venue,
        input.tournament,
        input.players
      );

      if (!projections) return projections;

      // Strip confidence intervals for non-Elite users
      const userTier = (ctx.tier ?? "basic") as SubscriptionTier;
      if (!tierAtLeast(userTier, "elite")) {
        return {
          ...projections,
          players: projections.players.map((p) => ({
            ...p,
            confidenceLow: undefined,
            confidenceHigh: undefined,
          })),
        };
      }

      return projections;
    }),

  /**
   * Rate a user's fantasy team against a match.
   * Returns grade (A+ to F), category scores, weak spots, transfer suggestions.
   */
  rateMyTeam: proProcedure
    .input(
      z.object({
        team: z.array(
          z.object({
            name: z.string(),
            role: z.string(),
            credits: z.number(),
            isCaptain: z.boolean(),
            isViceCaptain: z.boolean(),
          })
        ),
        matchInfo: z.object({
          teamA: z.string(),
          teamB: z.string(),
          format: z.string(),
          venue: z.string().nullable().default(null),
        }),
        matchId: z.string().uuid().optional(),
        projections: z
          .array(z.object({ playerName: z.string(), projected: z.number() }))
          .optional(),
        fdr: z
          .object({ teamAFdr: z.number(), teamBFdr: z.number() })
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Build tournament context from match data
      let tournamentCtx: import("../services/rate-my-team").TournamentContext | undefined;

      if (input.matchId) {
        try {
          const match = await ctx.db.query.matches.findFirst({
            where: eq(matches.id, input.matchId),
          });

          if (match?.tournamentId) {
            const tournament = await ctx.db.query.tournaments.findFirst({
              where: eq(tournaments.id, match.tournamentId),
            });

            // Fetch full squad for both teams in this match
            const squadPlayers = await ctx.db.query.players.findMany({
              where: and(
                inArray(players.team, [input.matchInfo.teamA, input.matchInfo.teamB]),
                eq(players.isDisabled, false),
              ),
            });

            tournamentCtx = {
              tournamentName: tournament?.name,
              tournamentYear: tournament?.startDate ? new Date(tournament.startDate).getFullYear() : undefined,
              tournamentRules: tournament?.tournamentRules as any,
              availableSquad: squadPlayers.map((p) => ({
                name: p.name,
                team: p.team,
                role: p.role ?? "all_rounder",
                nationality: p.nationality,
                credits: p.stats && typeof p.stats === "object" && "credits" in (p.stats as any) ? Number((p.stats as any).credits) : 8,
              })),
            };
          }
        } catch (err) {
          log.warn({ matchId: input.matchId, error: String(err) }, "Failed to build tournament context for rate-my-team");
        }
      }

      const rating = await rateTeam(
        input.team,
        input.matchInfo,
        input.projections,
        input.fdr,
        tournamentCtx
      );
      return rating;
    }),

  /**
   * AI-recommended captain & vice-captain picks.
   */
  getCaptainPicks: proProcedure
    .input(
      z.object({
        matchId: z.string(),
        teamA: z.string(),
        teamB: z.string(),
        format: z.string(),
        venue: z.string().nullable().default(null),
        tournament: z.string(),
        players: z.array(
          z.object({ name: z.string(), role: z.string(), team: z.string() })
        ).default([]),
      })
    )
    .query(async ({ input }) => {
      return getCaptainPicks(
        input.matchId, input.teamA, input.teamB,
        input.format, input.venue, input.tournament, input.players
      );
    }),

  /**
   * Historical head-to-head record between two teams.
   */
  getHeadToHead: protectedProcedure
    .input(
      z.object({
        teamA: z.string(),
        teamB: z.string(),
        format: z.string(),
        venue: z.string().nullable().default(null),
      })
    )
    .query(async ({ input }) => {
      return getHeadToHead(input.teamA, input.teamB, input.format, input.venue);
    }),

  /**
   * Low-ownership high-upside differential picks.
   */
  getDifferentials: proProcedure
    .input(
      z.object({
        matchId: z.string(),
        teamA: z.string(),
        teamB: z.string(),
        format: z.string(),
        venue: z.string().nullable().default(null),
        tournament: z.string(),
        players: z.array(
          z.object({ name: z.string(), role: z.string(), team: z.string() })
        ).default([]),
      })
    )
    .query(async ({ input }) => {
      return getDifferentials(
        input.matchId, input.teamA, input.teamB,
        input.format, input.venue, input.tournament, input.players
      );
    }),

  /**
   * AI-predicted playing XI before toss.
   */
  getPlayingXI: proProcedure
    .input(
      z.object({
        matchId: z.string(),
        teamA: z.string(),
        teamB: z.string(),
        format: z.string(),
        venue: z.string().nullable().default(null),
        tournament: z.string(),
      })
    )
    .query(async ({ input }) => {
      return getPredictedPlayingXI(
        input.matchId, input.teamA, input.teamB,
        input.format, input.venue, input.tournament
      );
    }),

  /**
   * Weather & pitch conditions report with fantasy tips.
   */
  getPitchWeather: protectedProcedure
    .input(
      z.object({
        matchId: z.string(),
        teamA: z.string(),
        teamB: z.string(),
        format: z.string(),
        venue: z.string().nullable().default(null),
      })
    )
    .query(async ({ input }) => {
      return getPitchWeather(
        input.matchId, input.teamA, input.teamB,
        input.format, input.venue
      );
    }),

  /**
   * Ownership stats — placeholder for Phase 4 when contest data exists.
   */
  getOwnershipStats: publicProcedure
    .input(
      z.object({
        matchId: z.string(),
        playerId: z.string().optional(),
      })
    )
    .query(async () => {
      return { matchId: "", stats: [], message: "Coming soon — available after contests launch" };
    }),

  // ─── New Analytics Features ──────────────────────────────────────────

  /**
   * Player Stats Tables — sortable leaderboard of all players.
   * Free: basic stats (avg, runs, wickets, fantasy pts).
   * Pro: advanced stats (SR, economy, form trend, consistency).
   */
  getPlayerStats: protectedProcedure
    .input(
      z.object({
        teamA: z.string(),
        teamB: z.string(),
        tournament: z.string(),
        sortBy: z.string().default("avgFantasyPoints"),
        sortDir: z.enum(["asc", "desc"]).default("desc"),
      })
    )
    .query(async ({ ctx, input }) => {
      const stats = await getPlayerStatsForMatch(
        ctx.db, input.teamA, input.teamB,
        input.tournament, input.sortBy, input.sortDir
      );

      const userTier = (ctx.tier ?? "basic") as SubscriptionTier;

      // Free: basic stats only. Pro+: full stats including form, SR, economy
      if (!tierAtLeast(userTier, "pro")) {
        return stats.map((s) => ({
          ...s,
          strikeRate: undefined,
          economyRate: undefined,
          formAvg: undefined,
          totalFours: undefined,
          totalSixes: undefined,
        }));
      }
      return stats;
    }),

  /**
   * Player Comparison — side-by-side compare 2-3 players.
   * Pro tier required.
   */
  comparePlayer: proProcedure
    .input(
      z.object({
        playerIds: z.array(z.string().uuid()).min(2).max(3),
      })
    )
    .query(async ({ ctx, input }) => {
      return comparePlayers(ctx.db, input.playerIds);
    }),

  /**
   * Team Solver / Auto-Pick — optimal 11 within budget.
   * Elite tier required (highest value feature).
   */
  solveTeam: eliteProcedure
    .input(
      z.object({
        matchId: z.string(),
        teamA: z.string(),
        teamB: z.string(),
        players: z.array(
          z.object({
            id: z.string(),
            name: z.string(),
            team: z.string(),
            role: z.string(),
            credits: z.number(),
            projectedPoints: z.number(),
            nationality: z.string().optional(),
          })
        ),
        preferences: z.object({
          playStyle: z.enum(["balanced", "batting_heavy", "bowling_heavy"]),
          riskLevel: z.enum(["safe", "moderate", "risky"]),
          budgetStrategy: z.enum(["stars", "value", "mixed"]),
          captainStyle: z.enum(["safe_captain", "differential"]),
          teamBias: z.string().optional(),
          preferredCaptainId: z.string().optional(),
        }).optional(),
        overseasRule: z.object({
          enabled: z.boolean(),
          hostCountry: z.string(),
          maxOverseas: z.number(),
        }).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      return solveOptimalTeam(
        ctx.db, input.matchId, input.teamA, input.teamB, input.players, input.preferences, input.overseasRule
      );
    }),

  /**
   * Fantasy Points Breakdown — detailed scoring per player per match.
   * Free for all (transparency feature).
   */
  getPointsBreakdown: protectedProcedure
    .input(
      z.object({
        matchId: z.string().uuid(),
        format: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      return getPointsBreakdownForMatch(ctx.db, input.matchId, input.format);
    }),

  /**
   * Value Tracker — player credit changes & ownership trends.
   * Pro tier required.
   */
  getValueTracker: proProcedure
    .input(
      z.object({
        matchId: z.string(),
        teamA: z.string(),
        teamB: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      return getValueTracker(ctx.db, input.matchId, input.teamA, input.teamB);
    }),

  /**
   * Stat Top Fives — tournament leaderboard across categories.
   * Free for all (engagement feature).
   */
  getStatTopFives: protectedProcedure
    .input(
      z.object({
        tournament: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      return getStatTopFives(ctx.db, input.tournament);
    }),
});
