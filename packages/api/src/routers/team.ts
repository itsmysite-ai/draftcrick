import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { createTeamSchema } from "@draftcrick/shared";
import { eq, and, inArray } from "drizzle-orm";
import { fantasyTeams, contests, players, matches } from "@draftcrick/db";
import { TRPCError } from "@trpc/server";
import { getPlayerCredits } from "../services/cricket-data";

const MAX_BUDGET = 100;
const MAX_FROM_ONE_TEAM = 7;
const MAX_OVERSEAS = 4;
const ROLE_LIMITS: Record<string, { min: number; max: number }> = {
  wicket_keeper: { min: 1, max: 4 },
  batsman: { min: 1, max: 6 },
  all_rounder: { min: 1, max: 6 },
  bowler: { min: 1, max: 6 },
};

export const teamRouter = router({
  /**
   * Create a fantasy team with salary cap validation
   */
  create: protectedProcedure
    .input(createTeamSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify contest exists and is open
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

      for (const [role, limits] of Object.entries(ROLE_LIMITS)) {
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

      // Team count validation (max 7 from one team)
      const teamCounts: Record<string, number> = {};
      for (const p of playerRecords) {
        teamCounts[p.team] = (teamCounts[p.team] ?? 0) + 1;
      }
      for (const [team, count] of Object.entries(teamCounts)) {
        if (count > MAX_FROM_ONE_TEAM) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Max ${MAX_FROM_ONE_TEAM} players from ${team}, have ${count}`,
          });
        }
      }

      // Overseas player limit
      const overseasCount = playerRecords.filter(
        (p) => p.nationality !== "India"
      ).length;
      if (overseasCount > MAX_OVERSEAS) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Max ${MAX_OVERSEAS} overseas players, have ${overseasCount}`,
        });
      }

      // Budget validation
      let totalCredits = 0;
      for (const p of playerRecords) {
        totalCredits += getPlayerCredits(p.stats as Record<string, unknown>);
      }

      if (totalCredits > MAX_BUDGET) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Budget exceeded. Used ${totalCredits.toFixed(1)} / ${MAX_BUDGET} credits`,
        });
      }

      const [team] = await ctx.db
        .insert(fantasyTeams)
        .values({
          userId: ctx.user.id,
          contestId: input.contestId,
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

      return {
        ...team,
        totalPoints: Number(team.totalPoints),
        creditsUsed: Number(team.creditsUsed),
        playerDetails: playerRecords.map((p) => ({
          ...p,
          credits: getPlayerCredits(p.stats as Record<string, unknown>),
          isCaptain: p.id === team.captainId,
          isViceCaptain: p.id === team.viceCaptainId,
        })),
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
