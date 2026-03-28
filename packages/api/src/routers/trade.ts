import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { eq, and, desc, or, inArray } from "drizzle-orm";
import { trades, leagueMembers, leagues, draftRooms, draftPicks } from "@draftplay/db";
import { TRPCError } from "@trpc/server";
import { sendPushNotification, NOTIFICATION_TYPES } from "../services/notifications";

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
      // Auction/draft leagues always allow trading (the whole point of having rosters)
      const isRosterLeague = league?.format === "auction" || league?.format === "draft";
      if (!isRosterLeague && transferRules.tradeWindowOpen === false) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Trade window is closed" });
      }

      // Check trade deadline — block trades X hours before next match
      const deadlineHours = (transferRules.tradeDeadlineHoursBeforeMatch as number) ?? 1;
      if (deadlineHours > 0 && league?.tournament) {
        const { matches: matchesTable } = await import("@draftplay/db");
        const { ilike } = await import("drizzle-orm");
        const nextMatch = await ctx.db.query.matches.findFirst({
          where: and(
            ilike(matchesTable.tournament, league.tournament),
            eq(matchesTable.status, "upcoming"),
          ),
          orderBy: [matchesTable.startTime],
          columns: { startTime: true },
        });
        if (nextMatch?.startTime) {
          const cutoff = new Date(new Date(nextMatch.startTime).getTime() - deadlineHours * 60 * 60 * 1000);
          if (new Date() > cutoff) {
            throw new TRPCError({ code: "BAD_REQUEST", message: `Trade window closes ${deadlineHours}h before match. Next match starts soon.` });
          }
        }
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

      // Notify the trade recipient
      sendPushNotification(
        ctx.db, input.toUserId, NOTIFICATION_TYPES.STATUS_ALERT,
        "Trade Proposal",
        `You have a new trade offer! Review it before it expires in 48 hours.`,
        { leagueId: input.leagueId, tradeId: trade!.id },
      ).catch(() => {});

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

      // Find the completed draft room for this league
      const draftRoom = await ctx.db.query.draftRooms.findFirst({
        where: and(
          eq(draftRooms.leagueId, trade.leagueId),
          eq(draftRooms.status, "completed"),
        ),
        columns: { id: true },
      });

      if (!draftRoom) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No completed draft found for this league" });
      }

      const offeredPlayerIds = trade.playersOffered as string[];
      const requestedPlayerIds = trade.playersRequested as string[];

      // Verify fromUser still owns the offered players
      const fromUserPicks = await ctx.db.query.draftPicks.findMany({
        where: and(
          eq(draftPicks.roomId, draftRoom.id),
          eq(draftPicks.userId, trade.fromUserId),
          inArray(draftPicks.playerId, offeredPlayerIds),
        ),
      });
      if (fromUserPicks.length !== offeredPlayerIds.length) {
        await ctx.db.update(trades).set({ status: "rejected" }).where(eq(trades.id, input.tradeId));
        throw new TRPCError({ code: "BAD_REQUEST", message: "Proposer no longer owns all offered players" });
      }

      // Verify toUser still owns the requested players
      const toUserPicks = await ctx.db.query.draftPicks.findMany({
        where: and(
          eq(draftPicks.roomId, draftRoom.id),
          eq(draftPicks.userId, trade.toUserId),
          inArray(draftPicks.playerId, requestedPlayerIds),
        ),
      });
      if (toUserPicks.length !== requestedPlayerIds.length) {
        await ctx.db.update(trades).set({ status: "rejected" }).where(eq(trades.id, input.tradeId));
        throw new TRPCError({ code: "BAD_REQUEST", message: "Recipient no longer owns all requested players" });
      }

      // --- Salary cap validation (auction leagues only) ---
      const league = await ctx.db.query.leagues.findFirst({
        where: eq(leagues.id, trade.leagueId),
        columns: { id: true, format: true, rules: true },
      });

      if (league && league.format === "auction") {
        const rules = (league.rules ?? {}) as Record<string, unknown>;
        const auctionRules = (rules.auction ?? {}) as Record<string, unknown>;
        const auctionBudget = (auctionRules.auctionBudget as number) ?? 100;

        // Get ALL picks for each user to compute current totals
        const allFromPicks = await ctx.db.query.draftPicks.findMany({
          where: and(eq(draftPicks.roomId, draftRoom.id), eq(draftPicks.userId, trade.fromUserId)),
          columns: { bidAmount: true },
        });
        const allToPicks = await ctx.db.query.draftPicks.findMany({
          where: and(eq(draftPicks.roomId, draftRoom.id), eq(draftPicks.userId, trade.toUserId)),
          columns: { bidAmount: true },
        });

        const sumBids = (picks: { bidAmount: string | null }[]) =>
          picks.reduce((s, p) => s + Number(p.bidAmount ?? 0), 0);

        const offeredSalary = sumBids(fromUserPicks);
        const requestedSalary = sumBids(toUserPicks);
        const fromTotal = sumBids(allFromPicks) - offeredSalary + requestedSalary;
        const fromBudgetRemaining = auctionBudget - fromTotal;
        const toTotal = sumBids(allToPicks) - requestedSalary + offeredSalary;
        const toBudgetRemaining = auctionBudget - toTotal;

        if (fromTotal > auctionBudget) {
          await ctx.db.update(trades).set({ status: "rejected" }).where(eq(trades.id, input.tradeId));
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Trade would put proposer over salary cap (${fromTotal.toFixed(1)}/${auctionBudget}). Need to free ${(-fromBudgetRemaining).toFixed(1)} more.`,
          });
        }
        if (toTotal > auctionBudget) {
          await ctx.db.update(trades).set({ status: "rejected" }).where(eq(trades.id, input.tradeId));
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Trade would put recipient over salary cap (${toTotal.toFixed(1)}/${auctionBudget}). Need to free ${(-toBudgetRemaining).toFixed(1)} more.`,
          });
        }
      }

      // --- Execute the swap: transfer ownership in draftPicks ---
      // Offered players: fromUser → toUser
      await ctx.db
        .update(draftPicks)
        .set({ userId: trade.toUserId })
        .where(
          and(
            eq(draftPicks.roomId, draftRoom.id),
            eq(draftPicks.userId, trade.fromUserId),
            inArray(draftPicks.playerId, offeredPlayerIds),
          )
        );

      // Requested players: toUser → fromUser
      await ctx.db
        .update(draftPicks)
        .set({ userId: trade.fromUserId })
        .where(
          and(
            eq(draftPicks.roomId, draftRoom.id),
            eq(draftPicks.userId, trade.toUserId),
            inArray(draftPicks.playerId, requestedPlayerIds),
          )
        );

      // Mark trade as accepted
      const [updated] = await ctx.db
        .update(trades)
        .set({ status: "accepted" })
        .where(eq(trades.id, input.tradeId))
        .returning();

      // Notify the proposer that their trade was accepted
      sendPushNotification(
        ctx.db, trade.fromUserId, NOTIFICATION_TYPES.STATUS_ALERT,
        "Trade Accepted!",
        "Your trade has been accepted. Players have been swapped.",
        { leagueId: trade.leagueId, tradeId: trade.id },
      ).catch(() => {});

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

      // Notify the proposer that their trade was rejected
      sendPushNotification(
        ctx.db, trade.fromUserId, NOTIFICATION_TYPES.STATUS_ALERT,
        "Trade Rejected",
        "Your trade offer was declined.",
        { leagueId: trade.leagueId, tradeId: trade.id },
      ).catch(() => {});

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
