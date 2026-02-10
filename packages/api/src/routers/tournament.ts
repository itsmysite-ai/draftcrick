import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";

const NOT_IMPLEMENTED = () => {
  throw new TRPCError({
    code: "METHOD_NOT_SUPPORTED",
    message: "NOT_IMPLEMENTED — wired in Phase 4",
  });
};

export const tournamentRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        leagueId: z.string().uuid(),
        tournamentId: z.string(),
        mode: z.enum(["salary_cap", "draft", "auction"]),
      })
    )
    .mutation(async () => NOT_IMPLEMENTED()),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async () => NOT_IMPLEMENTED()),

  submitTeam: protectedProcedure
    .input(
      z.object({
        tournamentLeagueId: z.string().uuid(),
        matchId: z.string(),
        squad: z.array(z.any()),
        playingXi: z.array(z.any()),
      })
    )
    .mutation(async () => NOT_IMPLEMENTED()),

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
    .mutation(async () => NOT_IMPLEMENTED()),

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
    .mutation(async () => NOT_IMPLEMENTED()),

  standings: protectedProcedure
    .input(z.object({ tournamentLeagueId: z.string().uuid() }))
    .query(async () => NOT_IMPLEMENTED()),
});
