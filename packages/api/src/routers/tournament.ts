import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, adminProcedure } from "../trpc";
import {
  createTournamentLeague,
  getTournamentLeague,
  listTournamentLeagues,
  submitTeam,
  getCurrentSquad,
  getStandings,
  getTradesUsed,
  autoCarryTeams,
} from "../services/tournament";
import {
  activateChip,
  deactivateChip,
  getAvailableChips,
} from "../services/chips";
import { getAwards } from "../services/awards";
import { scoreMatchForTournament } from "../services/tournament-scoring";

export const tournamentRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        tournamentId: z.string().optional(),
        status: z
          .enum(["setup", "active", "playoffs", "completed"])
          .optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      return listTournamentLeagues(ctx.db, input);
    }),

  create: protectedProcedure
    .input(
      z.object({
        leagueId: z.string().uuid(),
        tournamentId: z.string(),
        mode: z.enum(["salary_cap", "draft", "auction"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await createTournamentLeague(
          ctx.db,
          ctx.user.id,
          input.leagueId,
          input.tournamentId,
          input.mode
        );
      } catch (err: any) {
        throw new TRPCError({
          code: err.message?.includes("owner") ? "FORBIDDEN" : "BAD_REQUEST",
          message: err.message,
        });
      }
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const tl = await getTournamentLeague(ctx.db, input.id);
      if (!tl) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Tournament league not found" });
      }
      return tl;
    }),

  submitTeam: protectedProcedure
    .input(
      z.object({
        tournamentLeagueId: z.string().uuid(),
        matchId: z.string(),
        squad: z.array(z.any()),
        playingXi: z.array(z.any()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await submitTeam(
          ctx.db,
          ctx.user.id,
          input.tournamentLeagueId,
          input.matchId,
          input.squad,
          input.playingXi
        );
      } catch (err: any) {
        throw new TRPCError({ code: "BAD_REQUEST", message: err.message });
      }
    }),

  getCurrentSquad: protectedProcedure
    .input(
      z.object({
        tournamentLeagueId: z.string().uuid(),
        matchId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      return getCurrentSquad(
        ctx.db,
        ctx.user.id,
        input.tournamentLeagueId,
        input.matchId
      );
    }),

  useChip: protectedProcedure
    .input(
      z.object({
        tournamentLeagueId: z.string().uuid(),
        chipType: z.enum([
          "wildcard",
          "triple_captain",
          "bench_boost",
          "free_hit",
          "power_play",
          "death_over_specialist",
        ]),
        matchId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await activateChip(
          ctx.db,
          ctx.user.id,
          input.tournamentLeagueId,
          input.matchId,
          input.chipType
        );
      } catch (err: any) {
        throw new TRPCError({ code: "BAD_REQUEST", message: err.message });
      }
    }),

  deactivateChip: protectedProcedure
    .input(
      z.object({
        tournamentLeagueId: z.string().uuid(),
        matchId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await deactivateChip(
          ctx.db,
          ctx.user.id,
          input.tournamentLeagueId,
          input.matchId
        );
      } catch (err: any) {
        throw new TRPCError({ code: "BAD_REQUEST", message: err.message });
      }
    }),

  getAvailableChips: protectedProcedure
    .input(z.object({ tournamentLeagueId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return getAvailableChips(ctx.db, ctx.user.id, input.tournamentLeagueId);
    }),

  getTradesRemaining: protectedProcedure
    .input(z.object({ tournamentLeagueId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const tl = await getTournamentLeague(ctx.db, input.tournamentLeagueId);
      const totalAllowed = tl?.totalTradesAllowed ?? 30;
      const used = await getTradesUsed(ctx.db, ctx.user.id, input.tournamentLeagueId);
      return { used, total: totalAllowed, remaining: totalAllowed - used };
    }),

  getAwards: protectedProcedure
    .input(
      z.object({
        tournamentLeagueId: z.string().uuid(),
        matchId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      return getAwards(ctx.db, input.tournamentLeagueId, input.matchId);
    }),

  proposeTrade: protectedProcedure
    .input(
      z.object({
        tournamentLeagueId: z.string().uuid(),
        tradeType: z.enum(["drop_add", "inter_team", "waiver_claim"]),
        playerOutId: z.string().optional(),
        playerInId: z.string().optional(),
        proposedToUserId: z.string().uuid().optional(),
        playersOffered: z.array(z.string()).optional(),
        playersRequested: z.array(z.string()).optional(),
      })
    )
    .mutation(async () => {
      throw new TRPCError({
        code: "METHOD_NOT_SUPPORTED",
        message: "Trading is coming soon — available post-launch",
      });
    }),

  standings: protectedProcedure
    .input(z.object({ tournamentLeagueId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return getStandings(ctx.db, input.tournamentLeagueId);
    }),

  /**
   * Score a completed match for a tournament league (admin/system).
   */
  scoreMatch: adminProcedure
    .input(
      z.object({
        tournamentLeagueId: z.string().uuid(),
        matchId: z.string(),
        format: z.string().default("T20"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return scoreMatchForTournament(ctx.db, input.tournamentLeagueId, input.matchId, input.format);
    }),

  /**
   * Auto-carry teams for users who didn't submit for an upcoming match (admin/system).
   */
  autoCarry: adminProcedure
    .input(
      z.object({
        tournamentLeagueId: z.string().uuid(),
        matchId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const carried = await autoCarryTeams(ctx.db, input.tournamentLeagueId, input.matchId);
      return { carried };
    }),
});
