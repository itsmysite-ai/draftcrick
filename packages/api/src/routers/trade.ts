import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { eq, and, desc, or } from "drizzle-orm";
import { trades, leagueMembers, leagues } from "@draftcrick/db";
import { TRPCError } from "@trpc/server";

export const tradeRouter = router({
  /**
   * Propose a trade
   */
  propose: protectedProcedure
    .input(z.object({
      leagueId: z.string().uuid(),
      toUserId: z.string().uuid(),
      playersOffered: z.array(z.string().uuid()).min(1),
      playersRequested: z.array(z.string().uuid()).min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify both users are league members
      const fromMember = await ctx.db.query.leagueMembers.findFirst({
        where: and(
          eq(leagueMembers.leagueId, input.leagueId),
          eq(leagueMembers.userId, ctx.user.id)
        ),
      });
      if (!fromMember) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You are not a member of this league" });
      }

      const toMember = await ctx.db.query.leagueMembers.findFirst({
        where: and(
          eq(leagueMembers.leagueId, input.leagueId),
          eq(leagueMembers.userId, input.toUserId)
        ),
      });
      if (!toMember) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Target user is not a league member" });
      }

      // Check if trading is enabled
      const league = await ctx.db.query.leagues.findFirst({
        where: eq(leagues.id, input.leagueId),
      });
      const rules = (league?.rules ?? {}) as Record<string, unknown>;
      const transferRules = (rules.transfers ?? rules) as Record<string, unknown>;
      if (transferRules.tradeWindowOpen === false) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Trade window is closed" });
      }

      // Create trade with 48-hour expiry
      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

      const [trade] = await ctx.db
        .insert(trades)
        .values({
          leagueId: input.leagueId,
          fromUserId: ctx.user.id,
          toUserId: input.toUserId,
          playersOffered: input.playersOffered,
          playersRequested: input.playersRequested,
          status: "pending",
          expiresAt,
        })
        .returning();

      return trade;
    }),

  /**
   * Accept a trade
   */
  accept: protectedProcedure
    .input(z.object({ tradeId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const trade = await ctx.db.query.trades.findFirst({
        where: eq(trades.id, input.tradeId),
      });

      if (!trade) throw new TRPCError({ code: "NOT_FOUND", message: "Trade not found" });
      if (trade.toUserId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only the trade recipient can accept" });
      }
      if (trade.status !== "pending") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Trade is no longer pending" });
      }
      if (trade.expiresAt && new Date(trade.expiresAt) < new Date()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Trade has expired" });
      }

      const [updated] = await ctx.db
        .update(trades)
        .set({ status: "accepted" })
        .where(eq(trades.id, input.tradeId))
        .returning();

      // TODO: In a full implementation, swap the actual players between teams here

      return updated;
    }),

  /**
   * Reject a trade
   */
  reject: protectedProcedure
    .input(z.object({ tradeId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const trade = await ctx.db.query.trades.findFirst({
        where: eq(trades.id, input.tradeId),
      });

      if (!trade) throw new TRPCError({ code: "NOT_FOUND", message: "Trade not found" });
      if (trade.toUserId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only the trade recipient can reject" });
      }
      if (trade.status !== "pending") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Trade is no longer pending" });
      }

      const [updated] = await ctx.db
        .update(trades)
        .set({ status: "rejected" })
        .where(eq(trades.id, input.tradeId))
        .returning();

      return updated;
    }),

  /**
   * Cancel a trade (sender)
   */
  cancel: protectedProcedure
    .input(z.object({ tradeId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const trade = await ctx.db.query.trades.findFirst({
        where: eq(trades.id, input.tradeId),
      });

      if (!trade) throw new TRPCError({ code: "NOT_FOUND", message: "Trade not found" });
      if (trade.fromUserId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only the sender can cancel" });
      }
      if (trade.status !== "pending") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Trade is no longer pending" });
      }

      const [updated] = await ctx.db
        .update(trades)
        .set({ status: "rejected" })
        .where(eq(trades.id, input.tradeId))
        .returning();

      return updated;
    }),

  /**
   * Get trades for a league (involving the current user)
   */
  myTrades: protectedProcedure
    .input(z.object({ leagueId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.trades.findMany({
        where: and(
          eq(trades.leagueId, input.leagueId),
          or(
            eq(trades.fromUserId, ctx.user.id),
            eq(trades.toUserId, ctx.user.id)
          )
        ),
        orderBy: [desc(trades.createdAt)],
      });
    }),

  /**
   * Get all pending trades for a league (for veto system)
   */
  leagueTrades: protectedProcedure
    .input(z.object({
      leagueId: z.string().uuid(),
      status: z.enum(["pending", "accepted", "rejected", "expired"]).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const conditions = [eq(trades.leagueId, input.leagueId)];
      if (input.status) {
        conditions.push(eq(trades.status, input.status));
      }

      return ctx.db.query.trades.findMany({
        where: and(...conditions),
        orderBy: [desc(trades.createdAt)],
      });
    }),
});
