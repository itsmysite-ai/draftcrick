import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { eq, ilike, and, or, desc, inArray } from "drizzle-orm";
import { players, playerMatchScores, matches, tournaments } from "@draftplay/db";

export const playerRouter = router({
  /**
   * List all players (for draft/auction rooms)
   */
  /** Get players by IDs (for auction squad team builder) */
  getByIds: publicProcedure
    .input(z.object({ ids: z.array(z.string().uuid()) }))
    .query(async ({ ctx, input }) => {
      if (input.ids.length === 0) return [];
      return ctx.db.query.players.findMany({
        where: inArray(players.id, input.ids),
      });
    }),

  list: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.query.players.findMany({
      where: eq(players.isDisabled, false),
      limit: 200,
    });
  }),

  /**
   * List players for a specific tournament (via match associations).
   */
  listByTournament: publicProcedure
    .input(z.object({ tournamentName: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      // Find tournament
      const tournament = await ctx.db.query.tournaments.findFirst({
        where: eq(tournaments.name, input.tournamentName),
        columns: { id: true },
      });
      if (!tournament) return [];

      // Get match IDs for this tournament
      const tournamentMatches = await ctx.db
        .select({ id: matches.id })
        .from(matches)
        .where(eq(matches.tournamentId, tournament.id));

      if (tournamentMatches.length === 0) return [];

      const matchIds = tournamentMatches.map((m) => m.id);

      // Get distinct player IDs from match scores
      const scores = await ctx.db
        .selectDistinct({ playerId: playerMatchScores.playerId })
        .from(playerMatchScores)
        .where(inArray(playerMatchScores.matchId, matchIds));

      if (scores.length === 0) return [];

      const playerIds = scores.map((s) => s.playerId);

      // Fetch full player data
      return ctx.db.query.players.findMany({
        where: and(
          eq(players.isDisabled, false),
          inArray(players.id, playerIds),
        ),
      });
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
      const conditions = [eq(players.isDisabled, false)];

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
   * Get players for a specific match (from both teams).
   * Accepts UUID (DB ID) or string (external/AI ID).
   * Auto-links players from the players table if no associations exist yet.
   */
  getByMatch: publicProcedure
    .input(z.object({ matchId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      // Resolve match — could be a UUID (DB ID) or an external/AI ID
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.matchId);
      const match = await ctx.db.query.matches.findFirst({
        where: isUuid
          ? eq(matches.id, input.matchId)
          : eq(matches.externalId, input.matchId),
      });

      if (!match) return [];

      let scores = await ctx.db.query.playerMatchScores.findMany({
        where: eq(playerMatchScores.matchId, match.id),
        with: { player: true },
      });

      // Fallback auto-link: if smart refresh hasn't linked players yet,
      // find them by team name on-demand. Primary linking happens in
      // executeRefresh → linkPlayersToMatches (step 7.5).
      if (scores.length === 0) {
        const stripSuffix = (t: string) => t.replace(/ Men$| Women$/, "");
        const teamPlayers = await ctx.db.query.players.findMany({
          where: and(
            eq(players.isDisabled, false),
            or(
              ilike(players.team, `%${stripSuffix(match.teamHome)}%`),
              ilike(players.team, `%${stripSuffix(match.teamAway)}%`),
              eq(players.team, match.teamHome),
              eq(players.team, match.teamAway),
            ),
          ),
        });

        if (teamPlayers.length > 0) {
          await ctx.db
            .insert(playerMatchScores)
            .values(
              teamPlayers.map((p) => ({
                playerId: p.id,
                matchId: match.id,
                isPlaying: true,
              }))
            )
            .onConflictDoNothing();

          scores = await ctx.db.query.playerMatchScores.findMany({
            where: eq(playerMatchScores.matchId, match.id),
            with: { player: true },
          });
        }
      }

      // Filter out disabled players from results
      const filteredScores = scores.filter((s: any) => !s.player?.isDisabled);

      // Load tournament overseas config if match has a tournament
      let overseasRule: { enabled: boolean; hostCountry: string; maxOverseas: number } | null = null;
      if (match.tournamentId) {
        const tournament = await ctx.db.query.tournaments.findFirst({
          where: eq(tournaments.id, match.tournamentId),
          columns: { tournamentRules: true },
        });
        const rules = (tournament?.tournamentRules as any) ?? {};
        if (rules.overseasRule) {
          overseasRule = {
            ...rules.overseasRule,
            maxOverseas: rules.maxOverseas ?? 4,
          };
        }
      }

      return {
        players: filteredScores,
        overseasRule,
        confirmedXiHome: match.playingXiHome as Array<{ name: string; cricbuzzId: number }> | null,
        confirmedXiAway: match.playingXiAway as Array<{ name: string; cricbuzzId: number }> | null,
      };
    }),
});
