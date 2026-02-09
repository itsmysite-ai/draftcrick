import type { Database } from "@draftcrick/db";
import { draftRooms, draftPicks } from "@draftcrick/db";
import { eq, and } from "drizzle-orm";

export interface DraftState {
  roomId: string;
  leagueId: string;
  type: "snake_draft";
  status: "waiting" | "in_progress" | "paused" | "completed";
  currentRound: number;
  currentTurn: number;
  pickOrder: string[];
  maxRounds: number;
  timePerPick: number;
  snakeDraftEnabled: boolean;
  picks: Array<{
    userId: string;
    playerId: string;
    pickNumber: number;
    round: number;
  }>;
  pickedPlayerIds: Set<string>;
  currentPickDeadline: Date | null;
}

/**
 * Get the current drafter based on snake draft logic.
 * Even rounds: normal order, odd rounds: reversed.
 */
export function getCurrentDrafter(state: DraftState): string {
  const { currentRound, pickOrder, snakeDraftEnabled } = state;
  const turnIndex = state.currentTurn % pickOrder.length;

  if (snakeDraftEnabled && currentRound % 2 === 0) {
    // Reverse order on even rounds (0-indexed: round 0 = forward, round 1 = reverse, etc.)
    return pickOrder[pickOrder.length - 1 - turnIndex]!;
  }

  return pickOrder[turnIndex]!;
}

/**
 * Get the overall pick number (1-indexed).
 */
export function getPickNumber(state: DraftState): number {
  return state.picks.length + 1;
}

/**
 * Validate a draft pick.
 */
export function validatePick(
  state: DraftState,
  userId: string,
  playerId: string
): { valid: boolean; error?: string } {
  if (state.status !== "in_progress") {
    return { valid: false, error: "Draft is not in progress" };
  }

  const currentDrafter = getCurrentDrafter(state);
  if (currentDrafter !== userId) {
    return { valid: false, error: "It's not your turn" };
  }

  if (state.pickedPlayerIds.has(playerId)) {
    return { valid: false, error: "Player already drafted" };
  }

  // Check if the user has reached the max players per team
  const userPicks = state.picks.filter((p) => p.userId === userId);
  const maxPlayersPerTeam = state.maxRounds;
  if (userPicks.length >= maxPlayersPerTeam) {
    return { valid: false, error: "You have already drafted the maximum number of players" };
  }

  return { valid: true };
}

/**
 * Apply a pick to the draft state and advance the turn.
 */
export function applyPick(
  state: DraftState,
  userId: string,
  playerId: string
): DraftState {
  const pickNumber = getPickNumber(state);
  const newPick = {
    userId,
    playerId,
    pickNumber,
    round: state.currentRound,
  };

  const newPicks = [...state.picks, newPick];
  const newPickedPlayerIds = new Set(state.pickedPlayerIds);
  newPickedPlayerIds.add(playerId);

  let newTurn = state.currentTurn + 1;
  let newRound = state.currentRound;

  // Check if round is complete
  if (newTurn % state.pickOrder.length === 0) {
    newRound += 1;
    // In snake draft, the turn counter resets each round
    newTurn = 0;
  } else {
    newTurn = newTurn % state.pickOrder.length;
  }

  // Check if draft is complete
  const totalPicks = state.maxRounds * state.pickOrder.length;
  const isComplete = newPicks.length >= totalPicks;

  return {
    ...state,
    picks: newPicks,
    pickedPlayerIds: newPickedPlayerIds,
    currentTurn: newTurn,
    currentRound: isComplete ? state.currentRound : newRound,
    status: isComplete ? "completed" : "in_progress",
    currentPickDeadline: isComplete
      ? null
      : new Date(Date.now() + state.timePerPick * 1000),
  };
}

/**
 * Initialize draft state from a database draft room.
 */
export async function loadDraftState(
  db: Database,
  roomId: string
): Promise<DraftState | null> {
  const room = await db.query.draftRooms.findFirst({
    where: eq(draftRooms.id, roomId),
    with: { picks: true },
  });

  if (!room) return null;

  const settings = room.settings as Record<string, unknown>;

  const picks = (room.picks ?? []).map((p: Record<string, unknown>) => ({
    userId: p.userId as string,
    playerId: p.playerId as string,
    pickNumber: p.pickNumber as number,
    round: p.round as number,
  }));

  return {
    roomId: room.id,
    leagueId: room.leagueId,
    type: "snake_draft",
    status: room.status as DraftState["status"],
    currentRound: room.currentRound,
    currentTurn: room.currentTurn,
    pickOrder: room.pickOrder as string[],
    maxRounds: (settings.maxRounds as number) ?? 15,
    timePerPick: room.timePerPick,
    snakeDraftEnabled: (settings.snakeDraftEnabled as boolean) ?? true,
    picks,
    pickedPlayerIds: new Set(picks.map((p: { playerId: string }) => p.playerId)),
    currentPickDeadline: room.currentPickDeadline,
  };
}

/**
 * Persist a pick to the database.
 */
export async function persistPick(
  db: Database,
  state: DraftState,
  userId: string,
  playerId: string
): Promise<void> {
  const pickNumber = getPickNumber(state);

  await db.insert(draftPicks).values({
    roomId: state.roomId,
    userId,
    playerId,
    pickNumber,
    round: state.currentRound,
  });
}

/**
 * Update draft room status in the database.
 */
export async function updateDraftRoom(
  db: Database,
  state: DraftState
): Promise<void> {
  await db
    .update(draftRooms)
    .set({
      status: state.status,
      currentTurn: state.currentTurn,
      currentRound: state.currentRound,
      currentPickDeadline: state.currentPickDeadline,
    })
    .where(eq(draftRooms.id, state.roomId));
}

/**
 * Start the draft (transition from waiting to in_progress).
 */
export async function startDraft(
  db: Database,
  roomId: string
): Promise<DraftState | null> {
  const state = await loadDraftState(db, roomId);
  if (!state || state.status !== "waiting") return null;

  const newState: DraftState = {
    ...state,
    status: "in_progress",
    currentRound: 1,
    currentTurn: 0,
    currentPickDeadline: new Date(Date.now() + state.timePerPick * 1000),
  };

  await updateDraftRoom(db, newState);
  return newState;
}
