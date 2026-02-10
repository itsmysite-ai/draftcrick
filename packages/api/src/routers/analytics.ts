import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "../trpc";

const NOT_IMPLEMENTED = () => {
  throw new TRPCError({
    code: "METHOD_NOT_SUPPORTED",
    message: "NOT_IMPLEMENTED — wired in Phase 3",
  });
};

export const analyticsRouter = router({
  getFixtureDifficulty: publicProcedure
    .input(
      z.object({
        matchId: z.string(),
        teamId: z.string().optional(),
      })
    )
    .query(async () => NOT_IMPLEMENTED()),

  getPlayerProjections: publicProcedure
    .input(
      z.object({
        matchId: z.string(),
        playerId: z.string().optional(),
      })
    )
    .query(async () => NOT_IMPLEMENTED()),

  getOwnershipStats: publicProcedure
    .input(
      z.object({
        matchId: z.string(),
        playerId: z.string().optional(),
      })
    )
    .query(async () => NOT_IMPLEMENTED()),
});
