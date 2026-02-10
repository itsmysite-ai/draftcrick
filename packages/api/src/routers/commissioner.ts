import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";

const NOT_IMPLEMENTED = () => {
  throw new TRPCError({
    code: "METHOD_NOT_SUPPORTED",
    message: "NOT_IMPLEMENTED — wired in Phase 4",
  });
};

export const commissionerRouter = router({
  logAction: protectedProcedure
    .input(
      z.object({
        leagueId: z.string().uuid(),
        actionType: z.enum([
          "assign_points",
          "grant_trades",
          "edit_team",
          "veto_trade",
          "change_rule",
          "kick_member",
          "ban_member",
          "send_announcement",
          "set_entry_fee",
          "set_prizes",
        ]),
        targetUserId: z.string().uuid().optional(),
        details: z.record(z.any()),
      })
    )
    .mutation(async () => NOT_IMPLEMENTED()),

  getActions: protectedProcedure
    .input(
      z.object({
        leagueId: z.string().uuid(),
        limit: z.number().int().min(1).max(100).default(50),
      })
    )
    .query(async () => NOT_IMPLEMENTED()),

  vetoTrade: protectedProcedure
    .input(
      z.object({
        tradeId: z.string().uuid(),
        reason: z.string().min(1),
      })
    )
    .mutation(async () => NOT_IMPLEMENTED()),
});
