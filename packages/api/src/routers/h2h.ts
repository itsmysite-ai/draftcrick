import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";

const NOT_IMPLEMENTED = () => {
  throw new TRPCError({
    code: "METHOD_NOT_SUPPORTED",
    message: "NOT_IMPLEMENTED — wired in Phase 5",
  });
};

export const h2hRouter = router({
  getMatchup: protectedProcedure
    .input(
      z.object({
        leagueId: z.string().uuid(),
        matchId: z.string(),
        roundNumber: z.number().int().optional(),
      })
    )
    .query(async () => NOT_IMPLEMENTED()),

  getStandings: protectedProcedure
    .input(
      z.object({
        leagueId: z.string().uuid(),
        tournamentId: z.string().optional(),
      })
    )
    .query(async () => NOT_IMPLEMENTED()),
});
