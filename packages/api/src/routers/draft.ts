import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { eq, and, desc } from "drizzle-orm";
import { draftRooms, draftPicks, leagueMembers } from "@draftcrick/db";
import { TRPCError } from "@trpc/server";
import {
  loadDraftState,
  validatePick,
  applyPick,
  persistPick,
  updateDraftRoom,
  startDraft,
  getCurrentDrafter,
} from "../services/draft-room";
import {
  loadAuctionState,
  validateBid,
  placeBid,
  advancePhase,
  startNomination,
  persistAuctionSale,
  updateAuctionRoom,
} from "../services/auction-room";

export const draftRouter = router({
  /**
   * Get draft room details
   */
  getRoom: protectedProcedure
    .input(z.object({ roomId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const room = await ctx.db.query.draftRooms.findFirst({
        where: eq(draftRooms.id, input.roomId),
        with: {
          picks: {
            with: { player: true, user: true },
          },
        },
      });
      if (!room) throw new TRPCError({ code: "NOT_FOUND", message: "Draft room not found" });
      return room;
    }),

  /**
   * Get draft rooms for a league
   */
  getRoomsByLeague: protectedProcedure
    .input(z.object({ leagueId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.draftRooms.findMany({
        where: eq(draftRooms.leagueId, input.leagueId),
        orderBy: [desc(draftRooms.createdAt)],
      });
    }),

  /**
   * Start a draft (transition from waiting to in_progress)
   */
  start: protectedProcedure
    .input(z.object({ roomId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const room = await ctx.db.query.draftRooms.findFirst({
        where: eq(draftRooms.id, input.roomId),
      });

      if (!room) throw new TRPCError({ code: "NOT_FOUND", message: "Draft room not found" });

      // Verify caller is owner/admin of the league
      const membership = await ctx.db.query.leagueMembers.findFirst({
        where: and(
          eq(leagueMembers.leagueId, room.leagueId),
          eq(leagueMembers.userId, ctx.user.id)
        ),
      });

      if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only owner/admin can start the draft" });
      }

      const state = await startDraft(ctx.db, input.roomId);
      if (!state) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Draft cannot be started" });
      }

      return {
        roomId: state.roomId,
        status: state.status,
        currentDrafter: getCurrentDrafter(state),
        currentRound: state.currentRound,
        currentPickDeadline: state.currentPickDeadline,
      };
    }),

  /**
   * Make a snake draft pick
   */
  makePick: protectedProcedure
    .input(z.object({
      roomId: z.string().uuid(),
      playerId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const state = await loadDraftState(ctx.db, input.roomId);
      if (!state) throw new TRPCError({ code: "NOT_FOUND", message: "Draft room not found" });

      const validation = validatePick(state, ctx.user.id, input.playerId);
      if (!validation.valid) {
        throw new TRPCError({ code: "BAD_REQUEST", message: validation.error });
      }

      // Persist pick to DB
      await persistPick(ctx.db, state, ctx.user.id, input.playerId);

      // Apply pick to state and advance
      const newState = applyPick(state, ctx.user.id, input.playerId);
      await updateDraftRoom(ctx.db, newState);

      return {
        pickNumber: newState.picks.length,
        currentRound: newState.currentRound,
        currentDrafter: newState.status === "completed" ? null : getCurrentDrafter(newState),
        status: newState.status,
        currentPickDeadline: newState.currentPickDeadline,
      };
    }),

  /**
   * Get current draft state (who's picking, deadline, etc.)
   */
  getState: protectedProcedure
    .input(z.object({ roomId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const state = await loadDraftState(ctx.db, input.roomId);
      if (!state) throw new TRPCError({ code: "NOT_FOUND", message: "Draft room not found" });

      return {
        roomId: state.roomId,
        status: state.status,
        currentRound: state.currentRound,
        currentDrafter: state.status === "in_progress" ? getCurrentDrafter(state) : null,
        currentPickDeadline: state.currentPickDeadline,
        maxRounds: state.maxRounds,
        totalPicks: state.picks.length,
        pickOrder: state.pickOrder,
        pickedPlayerIds: Array.from(state.pickedPlayerIds),
      };
    }),

  /**
   * Get all picks for a draft room
   */
  getPicks: protectedProcedure
    .input(z.object({ roomId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.draftPicks.findMany({
        where: eq(draftPicks.roomId, input.roomId),
        with: { player: true, user: true },
        orderBy: [draftPicks.pickNumber],
      });
    }),

  // ── Auction endpoints ──

  /**
   * Nominate a player for auction
   */
  nominate: protectedProcedure
    .input(z.object({
      roomId: z.string().uuid(),
      playerId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const state = await loadAuctionState(ctx.db, input.roomId);
      if (!state) throw new TRPCError({ code: "NOT_FOUND", message: "Auction room not found" });

      if (state.status !== "in_progress") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Auction is not in progress" });
      }

      // Check if it's the nominator's turn
      const nominator = state.pickOrder[state.currentNominatorIndex % state.pickOrder.length];
      if (nominator !== ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "It's not your turn to nominate" });
      }

      // Check if player is already sold
      if (state.soldPlayers.some((p) => p.playerId === input.playerId)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Player already sold" });
      }

      const newState = startNomination(state, input.playerId);
      await updateAuctionRoom(ctx.db, newState);

      return {
        playerId: input.playerId,
        phase: newState.phase,
        phaseDeadline: newState.phaseDeadline,
      };
    }),

  /**
   * Place a bid in an auction
   */
  placeBid: protectedProcedure
    .input(z.object({
      roomId: z.string().uuid(),
      amount: z.number().positive(),
    }))
    .mutation(async ({ ctx, input }) => {
      const state = await loadAuctionState(ctx.db, input.roomId);
      if (!state) throw new TRPCError({ code: "NOT_FOUND", message: "Auction room not found" });

      const validation = validateBid(state, ctx.user.id, input.amount);
      if (!validation.valid) {
        throw new TRPCError({ code: "BAD_REQUEST", message: validation.error });
      }

      const newState = placeBid(state, ctx.user.id, input.amount);
      await updateAuctionRoom(ctx.db, newState);

      return {
        highestBid: newState.highestBid,
        phase: newState.phase,
        phaseDeadline: newState.phaseDeadline,
        budgetRemaining: newState.budgets[ctx.user.id],
      };
    }),

  /**
   * Get auction state
   */
  getAuctionState: protectedProcedure
    .input(z.object({ roomId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const state = await loadAuctionState(ctx.db, input.roomId);
      if (!state) throw new TRPCError({ code: "NOT_FOUND", message: "Auction room not found" });

      return {
        roomId: state.roomId,
        status: state.status,
        phase: state.phase,
        currentPlayerId: state.currentPlayerId,
        highestBid: state.highestBid,
        phaseDeadline: state.phaseDeadline,
        budgets: state.budgets,
        teamSizes: state.teamSizes,
        soldPlayers: state.soldPlayers,
        unsoldPlayerIds: state.unsoldPlayerIds,
        currentNominator: state.pickOrder[state.currentNominatorIndex % state.pickOrder.length],
      };
    }),
});
