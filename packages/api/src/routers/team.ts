import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { createTeamSchema } from "@draftplay/shared";
import { eq, and, inArray } from "drizzle-orm";
import { fantasyTeams, contests, players, matches, playerMatchScores } from "@draftplay/db";
import { TRPCError } from "@trpc/server";
import { getPlayerCredits } from "../services/cricket-data";
import { getEffectiveTeamRules } from "../services/admin-config";
import { getTierConfigs } from "../services/subscription";

export const teamRouter = router({
  /**
   * Create a fantasy team with salary cap validation
   */
  create: protectedProcedure
    .input(createTeamSchema)
    .mutation(async ({ ctx, input }) => {
      // Resolve tournament ID from contest or match for per-tournament rules
      let tournamentId: string | undefined;

      // If contestId provided, verify contest exists and is open
      if (input.contestId) {
        const contest = await ctx.db.query.contests.findFirst({
          where: eq(contests.id, input.contestId),
          with: { match: true },
        });

        if (!contest) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Contest not found" });
        }

        if (contest.status !== "open") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Contest is no longer accepting entries",
          });
        }

        // Resolve tournament from the match
        const matchRecord = contest.match;
        if (matchRecord && "tournamentId" in matchRecord) {
          tournamentId = (matchRecord as any).tournamentId ?? undefined;
        }

        // Check if user already has a team for this contest
        const existingTeam = await ctx.db.query.fantasyTeams.findFirst({
          where: and(
            eq(fantasyTeams.userId, ctx.user.id),
            eq(fantasyTeams.contestId, input.contestId)
          ),
        });

        if (existingTeam) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "You already have a team in this contest",
          });
        }
      } else if (input.matchId) {
        // Resolve tournament from matchId (when creating team without contest)
        // matchId could be a UUID or an external/AI ID
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.matchId);
        const matchRecord = await ctx.db.query.matches.findFirst({
          where: isUuid
            ? eq(matches.id, input.matchId)
            : eq(matches.externalId, input.matchId),
          columns: { id: true, tournamentId: true },
        });
        if (matchRecord) {
          tournamentId = matchRecord.tournamentId ?? undefined;
          // Normalize matchId to the DB UUID for the insert below
          input = { ...input, matchId: matchRecord.id };
        }
      }

      // --- Subscription tier: teams-per-match gate ---
      const configs = await getTierConfigs();
      const tier = ctx.tier ?? "free";
      const teamsPerMatch = configs[tier].features.teamsPerMatch;

      if (teamsPerMatch !== null) {
        const matchIdForLimit = input.matchId ?? (input.contestId ? (await ctx.db.query.contests.findFirst({
          where: eq(contests.id, input.contestId),
          columns: { matchId: true },
        }))?.matchId : null);

        if (matchIdForLimit) {
          const existingTeamsForMatch = await ctx.db.query.fantasyTeams.findMany({
            where: and(
              eq(fantasyTeams.userId, ctx.user.id),
              eq(fantasyTeams.matchId, matchIdForLimit)
            ),
            columns: { id: true },
          });

          if (existingTeamsForMatch.length >= teamsPerMatch) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: JSON.stringify({
                type: "PAYWALL",
                feature: "teamsPerMatch",
                currentTier: tier,
                requiredTier: "pro",
                title: "Team limit reached",
                description: `Free plan allows ${teamsPerMatch} team per match. Upgrade to Pro for unlimited teams.`,
              }),
            });
          }
        }
      }

      // Get effective team rules (global + per-tournament overrides)
      const rules = await getEffectiveTeamRules(tournamentId);

      // Captain and vice-captain validation
      if (input.captainId === input.viceCaptainId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Captain and vice-captain must be different players",
        });
      }

      const playerIds = input.players.map((p) => p.playerId);
      if (!playerIds.includes(input.captainId)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Captain must be in selected players",
        });
      }
      if (!playerIds.includes(input.viceCaptainId)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Vice-captain must be in selected players",
        });
      }

      // Fetch actual player records for validation
      const playerRecords = await ctx.db.query.players.findMany({
        where: inArray(players.id, playerIds),
      });

      if (playerRecords.length !== 11) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Found ${playerRecords.length} valid players, need exactly 11`,
        });
      }

      // Role count validation
      const roleCounts: Record<string, number> = {};
      for (const p of input.players) {
        roleCounts[p.role] = (roleCounts[p.role] ?? 0) + 1;
      }

      for (const [role, limits] of Object.entries(rules.roleLimits)) {
        const count = roleCounts[role] ?? 0;
        if (count < limits.min) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Need at least ${limits.min} ${role.replace("_", " ")}(s), have ${count}`,
          });
        }
        if (count > limits.max) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Max ${limits.max} ${role.replace("_", " ")}(s) allowed, have ${count}`,
          });
        }
      }

      // Team count validation
      const teamCounts: Record<string, number> = {};
      for (const p of playerRecords) {
        teamCounts[p.team] = (teamCounts[p.team] ?? 0) + 1;
      }
      for (const [team, count] of Object.entries(teamCounts)) {
        if (count > rules.maxFromOneTeam) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Max ${rules.maxFromOneTeam} players from ${team}, have ${count}`,
          });
        }
      }

      // Overseas player limit (0 = disabled, e.g., for international tournaments)
      if (rules.maxOverseas > 0) {
        const overseasCount = playerRecords.filter(
          (p) => p.nationality !== "India"
        ).length;
        if (overseasCount > rules.maxOverseas) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Max ${rules.maxOverseas} overseas players, have ${overseasCount}`,
          });
        }
      }

      // Budget validation
      let totalCredits = 0;
      for (const p of playerRecords) {
        totalCredits += getPlayerCredits(p.stats as Record<string, unknown>);
      }

      if (totalCredits > rules.maxBudget) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Budget exceeded. Used ${totalCredits.toFixed(1)} / ${rules.maxBudget} credits`,
        });
      }

      const [team] = await ctx.db
        .insert(fantasyTeams)
        .values({
          userId: ctx.user.id,
          contestId: input.contestId ?? null,
          matchId: input.matchId ?? null,
          players: input.players.map((p) => ({
            playerId: p.playerId,
            role: p.role,
            isPlaying: false,
          })),
          captainId: input.captainId,
          viceCaptainId: input.viceCaptainId,
          creditsUsed: String(totalCredits),
        })
        .returning();

      return { ...team!, creditsUsed: totalCredits };
    }),

  /**
   * Get user's team for a specific contest
   */
  getByContest: protectedProcedure
    .input(z.object({ contestId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const team = await ctx.db.query.fantasyTeams.findFirst({
        where: and(
          eq(fantasyTeams.userId, ctx.user.id),
          eq(fantasyTeams.contestId, input.contestId)
        ),
        with: { contest: { columns: { matchId: true } } },
      });

      if (!team) return null;

      // Fetch player details
      const teamPlayers = team.players as Array<{
        playerId: string;
        role: string;
      }>;
      const playerIds = teamPlayers.map((p) => p.playerId);
      const playerRecords = await ctx.db.query.players.findMany({
        where: inArray(players.id, playerIds),
      });

      // Fetch per-player fantasy points from match scores
      const matchId = (team as any).contest?.matchId ?? team.matchId;
      const scores = matchId
        ? await ctx.db.query.playerMatchScores.findMany({
            where: and(
              eq(playerMatchScores.matchId, matchId),
              inArray(playerMatchScores.playerId, playerIds)
            ),
          })
        : [];
      const scoreMap = new Map(scores.map((s) => [s.playerId, s]));

      return {
        ...team,
        totalPoints: Number(team.totalPoints),
        creditsUsed: Number(team.creditsUsed),
        playerDetails: playerRecords.map((p) => {
          const score = scoreMap.get(p.id);
          const pts = Number(score?.fantasyPoints ?? 0);
          const isCaptain = p.id === team.captainId;
          const isViceCaptain = p.id === team.viceCaptainId;
          const multiplier = isCaptain ? 2 : isViceCaptain ? 1.5 : 1;
          return {
            ...p,
            credits: getPlayerCredits(p.stats as Record<string, unknown>),
            isCaptain,
            isViceCaptain,
            fantasyPoints: pts,
            contribution: pts * multiplier,
            runs: score?.runs ?? 0,
            wickets: score?.wickets ?? 0,
            catches: score?.catches ?? 0,
          };
        }),
      };
    }),

  /**
   * Get a team by ID (must belong to the current user)
   */
  getById: protectedProcedure
    .input(z.object({ teamId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const team = await ctx.db.query.fantasyTeams.findFirst({
        where: and(
          eq(fantasyTeams.id, input.teamId),
          eq(fantasyTeams.userId, ctx.user.id)
        ),
        with: {
          contest: { columns: { matchId: true, name: true, status: true, prizePool: true, entryFee: true } },
        },
      });

      if (!team) return null;

      // Fetch player details
      const teamPlayers = team.players as Array<{ playerId: string; role: string }>;
      const playerIds = teamPlayers.map((p) => p.playerId);
      const playerRecords = await ctx.db.query.players.findMany({
        where: inArray(players.id, playerIds),
      });

      // Fetch match info
      const matchId = (team as any).contest?.matchId ?? team.matchId;
      let matchRecord = null;
      if (matchId) {
        matchRecord = await ctx.db.query.matches.findFirst({
          where: eq(matches.id, matchId),
          columns: { id: true, teamHome: true, teamAway: true, status: true, result: true, scoreSummary: true, startTime: true, tournamentId: true },
        });
      }

      // Fetch per-player fantasy points from match scores
      const scores = matchId
        ? await ctx.db.query.playerMatchScores.findMany({
            where: and(
              eq(playerMatchScores.matchId, matchId),
              inArray(playerMatchScores.playerId, playerIds)
            ),
          })
        : [];
      const scoreMap = new Map(scores.map((s) => [s.playerId, s]));

      return {
        ...team,
        totalPoints: Number(team.totalPoints),
        creditsUsed: Number(team.creditsUsed),
        match: matchRecord,
        playerDetails: playerRecords.map((p) => {
          const score = scoreMap.get(p.id);
          const pts = Number(score?.fantasyPoints ?? 0);
          const isCaptain = p.id === team.captainId;
          const isViceCaptain = p.id === team.viceCaptainId;
          const multiplier = isCaptain ? 2 : isViceCaptain ? 1.5 : 1;
          return {
            ...p,
            credits: getPlayerCredits(p.stats as Record<string, unknown>),
            isCaptain,
            isViceCaptain,
            fantasyPoints: pts,
            contribution: pts * multiplier,
            runs: score?.runs ?? 0,
            wickets: score?.wickets ?? 0,
            catches: score?.catches ?? 0,
          };
        }),
      };
    }),

  /**
   * Get all of user's teams
   */
  myTeams: protectedProcedure.query(async ({ ctx }) => {
    const teams = await ctx.db.query.fantasyTeams.findMany({
      where: eq(fantasyTeams.userId, ctx.user.id),
      with: {
        contest: { with: { match: true } },
      },
    });

    return teams.map((t) => ({
      ...t,
      totalPoints: Number(t.totalPoints),
      creditsUsed: Number(t.creditsUsed),
    }));
  }),
});
