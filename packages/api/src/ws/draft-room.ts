import type { Server, Socket } from "socket.io";
import type { Database } from "@draftcrick/db";
import {
  loadDraftState,
  validatePick,
  applyPick,
  persistPick,
  updateDraftRoom,
  getCurrentDrafter,
  startDraft,
} from "../services/draft-room";
import {
  loadAuctionState,
  validateBid,
  placeBid as placeBidFn,
  advancePhase,
  startNomination,
  persistAuctionSale,
  updateAuctionRoom,
  getCurrentNominator,
} from "../services/auction-room";

/**
 * Register draft/auction room WebSocket handlers.
 */
export function registerDraftRoomHandlers(io: Server, db: Database) {
  const draftNamespace = io.of("/draft");

  draftNamespace.on("connection", (socket: Socket) => {
    console.log(`Draft client connected: ${socket.id}`);

    // Join a draft room
    socket.on("join:draft", async (roomId: string, userId: string) => {
      socket.join(`draft:${roomId}`);
      socket.data.userId = userId;
      socket.data.roomId = roomId;

      // Send current state to the joining client
      const state = await loadDraftState(db, roomId);
      if (state) {
        socket.emit("draft:state", {
          roomId: state.roomId,
          status: state.status,
          currentRound: state.currentRound,
          currentDrafter: state.status === "in_progress" ? getCurrentDrafter(state) : null,
          currentPickDeadline: state.currentPickDeadline,
          pickOrder: state.pickOrder,
          pickedPlayerIds: Array.from(state.pickedPlayerIds),
          totalPicks: state.picks.length,
          maxRounds: state.maxRounds,
        });
      }
    });

    // Start draft
    socket.on("draft:start", async (roomId: string) => {
      const state = await startDraft(db, roomId);
      if (state) {
        draftNamespace.to(`draft:${roomId}`).emit("draft:started", {
          currentDrafter: getCurrentDrafter(state),
          currentRound: state.currentRound,
          currentPickDeadline: state.currentPickDeadline,
        });
      }
    });

    // Make a pick
    socket.on("draft:pick", async (data: { roomId: string; playerId: string }) => {
      const userId = socket.data.userId;
      if (!userId) return;

      const state = await loadDraftState(db, data.roomId);
      if (!state) {
        socket.emit("draft:error", { message: "Draft room not found" });
        return;
      }

      const validation = validatePick(state, userId, data.playerId);
      if (!validation.valid) {
        socket.emit("draft:error", { message: validation.error });
        return;
      }

      await persistPick(db, state, userId, data.playerId);
      const newState = applyPick(state, userId, data.playerId);
      await updateDraftRoom(db, newState);

      // Broadcast pick to all clients in the room
      draftNamespace.to(`draft:${data.roomId}`).emit("draft:picked", {
        userId,
        playerId: data.playerId,
        pickNumber: newState.picks.length,
        round: newState.currentRound,
        currentDrafter: newState.status === "completed" ? null : getCurrentDrafter(newState),
        currentPickDeadline: newState.currentPickDeadline,
        status: newState.status,
      });

      if (newState.status === "completed") {
        draftNamespace.to(`draft:${data.roomId}`).emit("draft:completed", {
          picks: newState.picks,
        });
      }
    });

    // ── Auction events ──

    socket.on("join:auction", async (roomId: string, userId: string) => {
      socket.join(`auction:${roomId}`);
      socket.data.userId = userId;
      socket.data.roomId = roomId;

      const state = await loadAuctionState(db, roomId);
      if (state) {
        socket.emit("auction:state", {
          roomId: state.roomId,
          status: state.status,
          phase: state.phase,
          currentPlayerId: state.currentPlayerId,
          highestBid: state.highestBid,
          phaseDeadline: state.phaseDeadline,
          budgets: state.budgets,
          teamSizes: state.teamSizes,
          soldPlayers: state.soldPlayers,
          currentNominator: getCurrentNominator(state),
        });
      }
    });

    // Nominate a player
    socket.on("auction:nominate", async (data: { roomId: string; playerId: string }) => {
      const userId = socket.data.userId;
      if (!userId) return;

      const state = await loadAuctionState(db, data.roomId);
      if (!state) {
        socket.emit("auction:error", { message: "Auction room not found" });
        return;
      }

      const nominator = getCurrentNominator(state);
      if (nominator !== userId) {
        socket.emit("auction:error", { message: "Not your turn to nominate" });
        return;
      }

      if (state.soldPlayers.some((p) => p.playerId === data.playerId)) {
        socket.emit("auction:error", { message: "Player already sold" });
        return;
      }

      const newState = startNomination(state, data.playerId);
      await updateAuctionRoom(db, newState);

      draftNamespace.to(`auction:${data.roomId}`).emit("auction:nominated", {
        playerId: data.playerId,
        nominatedBy: userId,
        phase: newState.phase,
        phaseDeadline: newState.phaseDeadline,
      });
    });

    // Place a bid
    socket.on("auction:bid", async (data: { roomId: string; amount: number }) => {
      const userId = socket.data.userId;
      if (!userId) return;

      const state = await loadAuctionState(db, data.roomId);
      if (!state) {
        socket.emit("auction:error", { message: "Auction room not found" });
        return;
      }

      const validation = validateBid(state, userId, data.amount);
      if (!validation.valid) {
        socket.emit("auction:error", { message: validation.error });
        return;
      }

      const newState = placeBidFn(state, userId, data.amount);
      await updateAuctionRoom(db, newState);

      draftNamespace.to(`auction:${data.roomId}`).emit("auction:bidPlaced", {
        userId,
        amount: data.amount,
        highestBid: newState.highestBid,
        phase: newState.phase,
        phaseDeadline: newState.phaseDeadline,
        budgets: newState.budgets,
      });
    });

    // Advance phase (called by timer on server or client)
    socket.on("auction:advancePhase", async (roomId: string) => {
      const state = await loadAuctionState(db, roomId);
      if (!state) return;

      const newState = advancePhase(state);
      await updateAuctionRoom(db, newState);

      if (newState.phase === "sold" && newState.highestBid && state.currentPlayerId) {
        // Persist the sale
        await persistAuctionSale(
          db,
          newState,
          state.currentPlayerId,
          newState.highestBid.userId,
          newState.highestBid.amount
        );

        draftNamespace.to(`auction:${roomId}`).emit("auction:sold", {
          playerId: state.currentPlayerId,
          buyerId: newState.highestBid.userId,
          amount: newState.highestBid.amount,
          budgets: newState.budgets,
          teamSizes: newState.teamSizes,
        });
      } else if (newState.phase === "sold") {
        // Unsold
        draftNamespace.to(`auction:${roomId}`).emit("auction:unsold", {
          playerId: state.currentPlayerId,
        });
      } else {
        draftNamespace.to(`auction:${roomId}`).emit("auction:phaseAdvanced", {
          phase: newState.phase,
          phaseDeadline: newState.phaseDeadline,
        });
      }
    });

    socket.on("leave:draft", (roomId: string) => {
      socket.leave(`draft:${roomId}`);
      socket.leave(`auction:${roomId}`);
    });

    socket.on("disconnect", () => {
      console.log(`Draft client disconnected: ${socket.id}`);
    });
  });
}
