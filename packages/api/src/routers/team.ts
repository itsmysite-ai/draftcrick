import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { createTeamSchema } from "@draftcrick/shared";
import { eq, and } from "drizzle-orm";
import { fantasyTeams, contests } from "@draftcrick/db";
import { TRPCError } from "@trpc/server";

export const teamRouter = router({
  /**
   * Create a fantasy team for a contest
   */
  create: protectedProcedure
    .input(createTeamSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify contest exists and is open
      const contest = await ctx.db.query.contests.findFirst({
        where: eq(contests.id, input.contestId),
      });

      if (!contest) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Contest not found",
        });
      }

      if (contest.status !== "open") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Contest is no longer accepting entries",
        });
      }

      // Captain and vice-captain must be different
      if (input.captainId === input.viceCaptainId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Captain and vice-captain must be different players",
        });
      }

      // Captain and VC must be in the selected players
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
        })
        .returning();

      return team;
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
      return team ?? null;
    }),
});
