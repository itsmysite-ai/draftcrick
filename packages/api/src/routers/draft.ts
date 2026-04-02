import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../trpc";
import { eq, and, desc } from "drizzle-orm";
import { draftRooms, draftPicks, leagueMembers, players } from "@draftplay/db";
import { getPlayerCredits } from "../services/cricket-data";
import { TRPCError } from "@trpc/server";
import { sendBatchNotifications, sendPushNotification, NOTIFICATION_TYPES } from "../services/notifications";
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
  getBasePrice,
  pauseAuction as pauseAuctionFn,
  resumeAuction as resumeAuctionFn,
  validateSquadRule,
  mapRoleToCategory,
} from "../services/auction-room";
import { users } from "@draftplay/db";
import { inArray } from "drizzle-orm";
import { getAdminConfig } from "../services/admin-config";
import { DEFAULT_SQUAD_RULES } from "@draftplay/shared";

/** Find the next nominator whose squad is not full, skipping full squads */
function getNextEligibleNominator(state: any): string | null {
  const len = state.pickOrder.length;
  for (let i = 0; i < len; i++) {
    const idx = (state.currentNominatorIndex + i) % len;
    const uid = state.pickOrder[idx];
    if ((state.teamSizes[uid] ?? 0) < state.maxPlayersPerTeam) {
      return uid;
    }
  }
  return null; // all squads full
}

export const draftRouter = router({
  /** Server timestamp for clock sync */
  serverTime: publicProcedure.query(() => ({ now: Date.now() })),

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

      // Notify next drafter it's their turn
      if (newState.status !== "completed") {
        const nextDrafter = getCurrentDrafter(newState);
        if (nextDrafter && nextDrafter !== ctx.user.id) {
          const pickedPlayer = await ctx.db.query.players.findFirst({
            where: eq(players.id, input.playerId),
            columns: { name: true },
          });
          sendPushNotification(
            ctx.db, nextDrafter, NOTIFICATION_TYPES.URGENT_DEADLINE,
            "Your Turn!",
            `${pickedPlayer?.name ?? "A player"} was just drafted. It's your pick now!`,
            { roomId: input.roomId, type: "snake_draft" },
          ).catch(() => {});
        }
      }

      // Notify all if draft is complete
      if (newState.status === "completed") {
        sendBatchNotifications(
          ctx.db, state.pickOrder, NOTIFICATION_TYPES.STATUS_ALERT,
          "Draft Complete!",
          "All squads are locked. Check your report card!",
          { roomId: input.roomId, type: "snake_draft" },
        ).catch(() => {});
      }

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

      // Check if it's the nominator's turn (skipping users with full squads)
      const nominator = getNextEligibleNominator(state);
      if (!nominator) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "All squads are full — auction should be complete" });
      }
      if (nominator !== ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "It's not your turn to nominate" });
      }

      // Check if player is already sold
      if (state.soldPlayers.some((p) => p.playerId === input.playerId)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Player already sold" });
      }

      // Look up player for base price calculation
      const player = await ctx.db.query.players.findFirst({
        where: eq(players.id, input.playerId),
        columns: { name: true, stats: true },
      });
      const playerCredits = getPlayerCredits((player?.stats as Record<string, unknown>) ?? {});
      const basePrice = getBasePrice(state, playerCredits);

      const newState = startNomination(state, input.playerId, basePrice, ctx.user.id);
      await updateAuctionRoom(ctx.db, newState);
      // Only notify members who can still bid (squad not full)
      const activeMembers = state.pickOrder.filter((uid) =>
        uid !== ctx.user.id && (state.teamSizes[uid] ?? 0) < state.maxPlayersPerTeam
      );
      sendBatchNotifications(
        ctx.db, activeMembers, NOTIFICATION_TYPES.STATUS_ALERT,
        "Player Nominated!",
        `${player?.name ?? "A player"} is up for auction — base price ${basePrice} credits!`,
        { roomId: input.roomId, playerId: input.playerId, type: "auction" },
      ).catch(() => {});

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

      // Squad rule validation — check if adding this player would violate composition rules
      if (state.squadRule !== "none" && state.currentPlayerId) {
        const adminSquadRules = await getAdminConfig<any[]>("auction_squad_rules") ?? [];
        const allRules = [...DEFAULT_SQUAD_RULES, ...adminSquadRules];
        const rule = allRules.find((r: any) => r.id === state.squadRule);
        if (rule) {
          // Get current player's role
          const currentPlayer = await ctx.db.query.players.findFirst({
            where: eq(players.id, state.currentPlayerId),
            columns: { role: true },
          });
          if (currentPlayer) {
            // Count roles in user's current squad
            const userPlayers = state.soldPlayers.filter(sp => sp.userId === ctx.user.id);
            const roleCounts: Record<string, number> = {};
            for (const sp of userPlayers) {
              const p = await ctx.db.query.players.findFirst({
                where: eq(players.id, sp.playerId),
                columns: { role: true },
              });
              if (p) {
                const cat = mapRoleToCategory(p.role);
                roleCounts[cat] = (roleCounts[cat] ?? 0) + 1;
              }
            }
            const squadCheck = validateSquadRule(
              rule, roleCounts, currentPlayer.role,
              state.teamSizes[ctx.user.id] ?? 0, state.maxPlayersPerTeam,
            );
            if (!squadCheck.valid) {
              throw new TRPCError({ code: "BAD_REQUEST", message: squadCheck.error ?? "Squad rule violated" });
            }
          }
        }
      }

      // Track previous highest bidder before placing new bid
      const previousBidder = state.highestBid?.userId;

      const newState = placeBid(state, ctx.user.id, input.amount);
      await updateAuctionRoom(ctx.db, newState);

      // Notify previous highest bidder they've been outbid
      if (previousBidder && previousBidder !== ctx.user.id) {
        const player = await ctx.db.query.players.findFirst({
          where: eq(players.id, state.currentPlayerId!),
          columns: { name: true },
        });
        sendPushNotification(
          ctx.db, previousBidder, NOTIFICATION_TYPES.STATUS_ALERT,
          "You've Been Outbid!",
          `Someone bid ${input.amount} Cr on ${player?.name ?? "a player"} — bid again before time runs out!`,
          { roomId: input.roomId, type: "auction" },
        ).catch(() => {});
      }

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
    .input(z.object({ roomId: z.string().uuid(), poolExhausted: z.boolean().optional() }))
    .query(async ({ ctx, input }) => {
      const state = await loadAuctionState(ctx.db, input.roomId);
      if (!state) throw new TRPCError({ code: "NOT_FOUND", message: "Auction room not found" });

      // Auto-complete if pool is exhausted and all users have minimum squad
      if (state.status === "in_progress" && state.phase === "nominating" && !state.currentPlayerId) {
        const allHaveMinimum = state.pickOrder.every(
          (uid) => (state.teamSizes[uid] ?? 0) >= 11
        );
        const allFull = state.pickOrder.every(
          (uid) => (state.teamSizes[uid] ?? 0) >= state.maxPlayersPerTeam
        );

        if (allFull || (input.poolExhausted && allHaveMinimum)) {
          state.status = "completed";
          state.phase = "completed" as any;
          await updateAuctionRoom(ctx.db, state);

          sendBatchNotifications(
            ctx.db, state.pickOrder, NOTIFICATION_TYPES.STATUS_ALERT,
            "Auction Complete!",
            "All players have been picked. Check your report card!",
            { roomId: input.roomId, type: "auction" },
          ).catch(() => {});
        }
      }

      // Resolve member display names for buyer identity + squad tabs
      const memberRows = await ctx.db
        .select({ id: users.id, displayName: users.displayName, username: users.username })
        .from(users)
        .where(inArray(users.id, state.pickOrder));
      const memberNames: Record<string, string> = {};
      for (const m of memberRows) {
        memberNames[m.id] = m.displayName || m.username || "Player";
      }

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
        currentNominator: getNextEligibleNominator(state),
        maxPlayersPerTeam: state.maxPlayersPerTeam,
        minBid: state.minBid,
        bidIncrement: state.bidIncrement,
        auctionBudget: state.auctionBudget,
        leagueId: state.leagueId,
        biddingEndsAt: state.biddingEndsAt,
        goingOnceEndsAt: state.goingOnceEndsAt,
        goingTwiceEndsAt: state.goingTwiceEndsAt,
        // New fields
        memberNames,
        isPaused: state.isPaused,
        pausedBy: state.pausedBy,
        pausesUsed: state.pausesUsed,
        maxPausesPerMember: state.maxPausesPerMember,
        squadVisibility: state.squadVisibility,
        buyerVisibility: state.buyerVisibility,
        squadRule: state.squadRule,
      };
    }),

  /**
   * Advance auction phase (bidding → going_once → going_twice → sold).
   * Called by the UI when the countdown timer expires.
   */
  advancePhase: protectedProcedure
    .input(z.object({
      roomId: z.string().uuid(),
      expectedPhase: z.string().optional(), // client sends current phase to prevent stale advances
    }))
    .mutation(async ({ ctx, input }) => {
      const state = await loadAuctionState(ctx.db, input.roomId);
      if (!state) throw new TRPCError({ code: "NOT_FOUND", message: "Auction room not found" });

      // Don't advance if phase can't be advanced
      if (state.phase === "nominating" || state.phase === "waiting" || state.status === "completed") {
        return {
          phase: state.phase,
          previousPhase: state.phase,
          soldPlayerId: null,
          buyerId: null,
          amount: null,
        };
      }

      // Advance through all expired phases in one call
      // (bidding → going_once → going_twice → sold if all deadlines have passed)
      let current = state;
      const originalPhase = state.phase;
      let wasSold = false;

      for (let i = 0; i < 4; i++) { // max 4 transitions to prevent infinite loop
        const next = advancePhase(current);
        if (next.phase === current.phase) break; // no change, stop

        // Check if a sale happened
        if (current.phase === "going_twice" && next.phase === "sold" && current.highestBid && current.currentPlayerId) {
          wasSold = true;
          await persistAuctionSale(ctx.db, next, current.currentPlayerId, current.highestBid.userId, current.highestBid.amount);
        }

        current = next;

        // Stop if we reached a phase that has a future deadline (not expired yet)
        if (current.phaseDeadline && new Date(current.phaseDeadline).getTime() > Date.now()) break;
        // Stop at sold (let the next call advance to nominating)
        if (current.phase === "sold" || current.phase === "nominating") break;
      }

      // Get available player pool to check if auction should end
      const draftedIds = new Set(current.soldPlayers.map((sp: any) => sp.playerId));
      const availableCount = await ctx.db.query.players.findMany({
        where: eq(players.isDisabled, false),
        columns: { id: true },
        limit: 300,
      }).then((all) => all.filter((p) => !draftedIds.has(p.id)).length);

      // Check if auction is complete:
      // 1. All users have full squads, OR
      // 2. No more players available in the pool, OR
      // 3. All users have at least 11 and pool is exhausted
      const allFull = current.pickOrder.every(
        (uid: string) => (current.teamSizes[uid] ?? 0) >= current.maxPlayersPerTeam
      );
      const allHaveMinimum = current.pickOrder.every(
        (uid: string) => (current.teamSizes[uid] ?? 0) >= 11
      );

      if (allFull || (availableCount === 0 && allHaveMinimum)) {
        current = { ...current, status: "completed", phase: "completed" as any };
      }

      // Auto-buy: if only one user has slots remaining, auto-fill at base price
      if (current.phase === "nominating" && current.status !== "completed") {
        const usersWithSlots = current.pickOrder.filter(
          (uid: string) => (current.teamSizes[uid] ?? 0) < current.maxPlayersPerTeam
        );

        if (usersWithSlots.length === 1 && availableCount > 0) {
          const lastUser = usersWithSlots[0]!;
          const slotsNeeded = Math.min(
            current.maxPlayersPerTeam - (current.teamSizes[lastUser] ?? 0),
            availableCount
          );

          // Get available players from DB
          const allDbPlayers = await ctx.db.query.players.findMany({
            where: eq(players.isDisabled, false),
            columns: { id: true, stats: true },
            limit: 300,
          });
          const available = allDbPlayers.filter((p) => !draftedIds.has(p.id));
          const toAutoBuy = available.slice(0, slotsNeeded);

          for (const p of toAutoBuy) {
            const credits = getPlayerCredits((p.stats as Record<string, unknown>) ?? {});
            const price = getBasePrice(current, credits);

            await persistAuctionSale(ctx.db, current, p.id, lastUser, price);
            current.soldPlayers.push({
              playerId: p.id,
              userId: lastUser,
              amount: price,
              pickNumber: current.soldPlayers.length + 1,
            });
            current.budgets[lastUser] = (current.budgets[lastUser] ?? 0) - price;
            current.teamSizes[lastUser] = (current.teamSizes[lastUser] ?? 0) + 1;
          }

          if (toAutoBuy.length > 0) {
            sendPushNotification(
              ctx.db, lastUser, NOTIFICATION_TYPES.STATUS_ALERT,
              "Auto-Pick Complete!",
              `${toAutoBuy.length} player(s) were auto-picked at base price to complete your squad.`,
              { roomId: input.roomId, type: "auction" },
            ).catch(() => {});
          }

          // Check completion again after auto-buy
          const nowAllFull = current.pickOrder.every(
            (uid: string) => (current.teamSizes[uid] ?? 0) >= current.maxPlayersPerTeam
          );
          const nowAllMinimum = current.pickOrder.every(
            (uid: string) => (current.teamSizes[uid] ?? 0) >= 11
          );
          const nowAvailable = available.length - toAutoBuy.length;

          if (nowAllFull || nowAvailable === 0 && nowAllMinimum) {
            current = { ...current, status: "completed", phase: "completed" as any };
          }
        }
      }

      await updateAuctionRoom(ctx.db, current);

      // --- Notifications (non-blocking) ---
      if (wasSold && state.currentPlayerId && state.highestBid) {
        const soldPlayer = await ctx.db.query.players.findFirst({
          where: eq(players.id, state.currentPlayerId),
          columns: { name: true },
        });
        const pName = soldPlayer?.name ?? "A player";
        const buyerId = state.highestBid.userId;
        const amount = state.highestBid.amount;

        // Notify active members (skip squad-complete users who are just watching)
        const activeMembers = state.pickOrder.filter((uid) =>
          uid !== buyerId && (current.teamSizes[uid] ?? 0) < current.maxPlayersPerTeam
        );
        sendBatchNotifications(
          ctx.db, activeMembers, NOTIFICATION_TYPES.STATUS_ALERT,
          "Player Sold!",
          `${pName} sold for ${amount} Cr`,
          { roomId: input.roomId, type: "auction" },
        ).catch(() => {});

        // Notify winner specifically
        sendPushNotification(
          ctx.db, buyerId, NOTIFICATION_TYPES.STATUS_ALERT,
          "You Won!",
          `${pName} is yours for ${amount} Cr!`,
          { roomId: input.roomId, type: "auction" },
        ).catch(() => {});

        // Check if buyer's squad just became full — send one-time notification
        const buyerTeamSize = current.teamSizes[buyerId] ?? 0;
        if (buyerTeamSize >= current.maxPlayersPerTeam) {
          sendPushNotification(
            ctx.db, buyerId, NOTIFICATION_TYPES.STATUS_ALERT,
            "Squad Complete!",
            `You have ${buyerTeamSize} players — your squad is locked in. Sit back and enjoy the rest of the auction!`,
            { roomId: input.roomId, type: "auction" },
          ).catch(() => {});
        }
      }

      // Notify next nominator it's their turn
      if (current.phase === "nominating" && current.status !== "completed") {
        const nextNominator = current.pickOrder[current.currentNominatorIndex % current.pickOrder.length];
        if (nextNominator) {
          sendPushNotification(
            ctx.db, nextNominator, NOTIFICATION_TYPES.URGENT_DEADLINE,
            "Your Turn!",
            "It's your turn to nominate a player for auction",
            { roomId: input.roomId, type: "auction" },
          ).catch(() => {});
        }
      }

      // Notify all: auction complete
      if (current.status === "completed") {
        sendBatchNotifications(
          ctx.db, state.pickOrder, NOTIFICATION_TYPES.STATUS_ALERT,
          "Auction Complete!",
          "All squads are locked. Check your report card to see how you did!",
          { roomId: input.roomId, type: "auction" },
        ).catch(() => {});
      }

      // Generate buzz commentary (non-blocking, best-effort)
      let buzzMessages: Array<{ message: string; type: string }> = [];
      if (wasSold && state.currentPlayerId) {
        const { generateAuctionBuzz } = await import("../services/auction-ai");
        const pName = (await ctx.db.query.players.findFirst({ where: eq(players.id, state.currentPlayerId), columns: { name: true } }))?.name;
        buzzMessages = await generateAuctionBuzz("sold", {
          playerName: pName ?? "Player",
          amount: state.highestBid?.amount,
          soldCount: current.soldPlayers.length,
        }).catch(() => []);
      }

      return {
        phase: current.phase,
        previousPhase: originalPhase,
        auctionCompleted: current.status === "completed",
        soldPlayerId: wasSold ? state.currentPlayerId : null,
        buyerId: wasSold ? state.highestBid?.userId : null,
        amount: wasSold ? state.highestBid?.amount : null,
        buzzMessages,
      };
    }),

  // ── Pause / Resume ──────────────────────────────────────

  pauseAuction: protectedProcedure
    .input(z.object({ roomId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const state = await loadAuctionState(ctx.db, input.roomId);
      if (!state) throw new TRPCError({ code: "NOT_FOUND" });
      if (state.status !== "in_progress") throw new TRPCError({ code: "BAD_REQUEST", message: "Auction not in progress" });
      if (state.isPaused) throw new TRPCError({ code: "BAD_REQUEST", message: "Already paused" });

      const userId = ctx.user.id;
      const used = state.pausesUsed[userId] ?? 0;
      if (used >= state.maxPausesPerMember) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `No pauses remaining (used ${used}/${state.maxPausesPerMember})` });
      }

      // Check platform cap from admin config
      const platformCap = await getAdminConfig<number>("auction_max_pauses_cap");
      if (platformCap && used >= platformCap) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Platform pause limit reached" });
      }

      const updated = pauseAuctionFn(state, userId);
      await updateAuctionRoom(ctx.db, updated);

      return { success: true, pausesRemaining: state.maxPausesPerMember - used - 1 };
    }),

  resumeAuction: protectedProcedure
    .input(z.object({ roomId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const state = await loadAuctionState(ctx.db, input.roomId);
      if (!state) throw new TRPCError({ code: "NOT_FOUND" });
      if (!state.isPaused) throw new TRPCError({ code: "BAD_REQUEST", message: "Auction is not paused" });

      // Only the pauser or league owner can resume
      const userId = ctx.user.id;
      const isLeagueOwner = await ctx.db.query.leagueMembers.findFirst({
        where: and(
          eq(leagueMembers.leagueId, state.leagueId),
          eq(leagueMembers.userId, userId),
          eq(leagueMembers.role, "owner"),
        ),
      });

      if (state.pausedBy !== userId && !isLeagueOwner) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only the pauser or league owner can resume" });
      }

      const updated = resumeAuctionFn(state);
      await updateAuctionRoom(ctx.db, updated);

      return { success: true };
    }),

  // ── Auction Config Options (for league creation) ────────

  getAuctionConfigOptions: publicProcedure
    .query(async () => {
      const adminSquadRules = await getAdminConfig<any[]>("auction_squad_rules") ?? [];
      // Merge defaults with admin-created rules (admin rules override defaults with same id)
      const adminIds = new Set(adminSquadRules.map((r: any) => r.id));
      const squadRules = [
        ...DEFAULT_SQUAD_RULES.filter(r => !adminIds.has(r.id)),
        ...adminSquadRules,
      ];
      const bidIncrementOptions = await getAdminConfig<number[]>("auction_bid_increment_options") ?? [0.1, 0.2, 0.5, 1.0];
      const maxPausesCap = await getAdminConfig<number>("auction_max_pauses_cap") ?? 5;
      const defaults = await getAdminConfig<Record<string, unknown>>("auction_default_settings") ?? {};

      return { squadRules, bidIncrementOptions, maxPausesCap, defaults };
    }),
});
