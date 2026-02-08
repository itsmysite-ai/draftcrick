import type { Database } from "@draftcrick/db";
import { draftRooms, draftPicks } from "@draftcrick/db";
import { eq } from "drizzle-orm";

export type AuctionPhase =
  | "waiting"
  | "nominating"
  | "bidding"
  | "going_once"
  | "going_twice"
  | "sold"
  | "completed";

export interface AuctionBid {
  userId: string;
  amount: number;
  timestamp: number;
}

export interface AuctionState {
  roomId: string;
  leagueId: string;
  status: "waiting" | "in_progress" | "completed";
  phase: AuctionPhase;
  pickOrder: string[];
  currentNominatorIndex: number;

  // Current player being auctioned
  currentPlayerId: string | null;
  currentBids: AuctionBid[];
  highestBid: AuctionBid | null;

  // Timers
  maxBidTime: number;
  goingOnceTime: number;
  goingTwiceTime: number;
  phaseDeadline: Date | null;

  // Budget tracking: userId -> remaining budget
  budgets: Record<string, number>;
  auctionBudget: number;
  minBid: number;
  bidIncrement: number;
  maxPlayersPerTeam: number;
  unsoldPlayerReAuction: boolean;

  // Results
  soldPlayers: Array<{
    playerId: string;
    userId: string;
    amount: number;
    pickNumber: number;
  }>;
  unsoldPlayerIds: string[];

  // Track how many players each user has
  teamSizes: Record<string, number>;
}

/**
 * Get the current nominator (round-robin through pick order).
 */
export function getCurrentNominator(state: AuctionState): string {
  return state.pickOrder[state.currentNominatorIndex % state.pickOrder.length]!;
}

/**
 * Validate a bid.
 */
export function validateBid(
  state: AuctionState,
  userId: string,
  amount: number
): { valid: boolean; error?: string } {
  if (state.phase !== "bidding" && state.phase !== "going_once" && state.phase !== "going_twice") {
    return { valid: false, error: "Bidding is not open" };
  }

  if (!state.currentPlayerId) {
    return { valid: false, error: "No player is currently being auctioned" };
  }

  const budget = state.budgets[userId] ?? 0;
  if (amount > budget) {
    return { valid: false, error: "Insufficient budget" };
  }

  const minBidAmount = state.highestBid
    ? state.highestBid.amount + state.bidIncrement
    : state.minBid;

  if (amount < minBidAmount) {
    return { valid: false, error: `Minimum bid is ${minBidAmount}` };
  }

  const teamSize = state.teamSizes[userId] ?? 0;
  if (teamSize >= state.maxPlayersPerTeam) {
    return { valid: false, error: "Team is full" };
  }

  return { valid: true };
}

/**
 * Place a bid and reset the phase to "bidding".
 */
export function placeBid(
  state: AuctionState,
  userId: string,
  amount: number
): AuctionState {
  const bid: AuctionBid = { userId, amount, timestamp: Date.now() };

  return {
    ...state,
    phase: "bidding",
    currentBids: [...state.currentBids, bid],
    highestBid: bid,
    phaseDeadline: new Date(Date.now() + state.maxBidTime * 1000),
  };
}

/**
 * Advance auction phase when timer expires.
 * bidding -> going_once -> going_twice -> sold
 */
export function advancePhase(state: AuctionState): AuctionState {
  if (state.phase === "bidding") {
    return {
      ...state,
      phase: "going_once",
      phaseDeadline: new Date(Date.now() + state.goingOnceTime * 1000),
    };
  }

  if (state.phase === "going_once") {
    return {
      ...state,
      phase: "going_twice",
      phaseDeadline: new Date(Date.now() + state.goingTwiceTime * 1000),
    };
  }

  if (state.phase === "going_twice") {
    // SOLD!
    if (state.highestBid && state.currentPlayerId) {
      const buyer = state.highestBid.userId;
      const amount = state.highestBid.amount;

      return {
        ...state,
        phase: "sold",
        soldPlayers: [
          ...state.soldPlayers,
          {
            playerId: state.currentPlayerId,
            userId: buyer,
            amount,
            pickNumber: state.soldPlayers.length + 1,
          },
        ],
        budgets: {
          ...state.budgets,
          [buyer]: (state.budgets[buyer] ?? 0) - amount,
        },
        teamSizes: {
          ...state.teamSizes,
          [buyer]: (state.teamSizes[buyer] ?? 0) + 1,
        },
        phaseDeadline: null,
      };
    }

    // No bids — unsold
    return {
      ...state,
      phase: "sold",
      unsoldPlayerIds: state.currentPlayerId
        ? [...state.unsoldPlayerIds, state.currentPlayerId]
        : state.unsoldPlayerIds,
      phaseDeadline: null,
    };
  }

  return state;
}

/**
 * Start nomination for the next player.
 */
export function startNomination(
  state: AuctionState,
  playerId: string
): AuctionState {
  return {
    ...state,
    phase: "bidding",
    currentPlayerId: playerId,
    currentBids: [],
    highestBid: null,
    phaseDeadline: new Date(Date.now() + state.maxBidTime * 1000),
    currentNominatorIndex: state.currentNominatorIndex + 1,
  };
}

/**
 * Initialize auction state from a database draft room.
 */
export async function loadAuctionState(
  db: Database,
  roomId: string
): Promise<AuctionState | null> {
  const room = await db.query.draftRooms.findFirst({
    where: eq(draftRooms.id, roomId),
    with: { picks: true },
  });

  if (!room || room.type !== "auction") return null;

  const settings = room.settings as Record<string, unknown>;
  const pickOrder = room.pickOrder as string[];

  // Initialize budgets from settings
  const auctionBudget = (settings.auctionBudget as number) ?? 100;
  const budgets: Record<string, number> = {};
  const teamSizes: Record<string, number> = {};
  for (const userId of pickOrder) {
    budgets[userId] = auctionBudget;
    teamSizes[userId] = 0;
  }

  // Reconstruct from existing picks
  const soldPlayers: AuctionState["soldPlayers"] = [];
  for (const pick of room.picks ?? []) {
    const p = pick as Record<string, unknown>;
    const userId = p.userId as string;
    const amount = parseFloat(p.bidAmount as string) || 0;
    soldPlayers.push({
      playerId: p.playerId as string,
      userId,
      amount,
      pickNumber: p.pickNumber as number,
    });
    budgets[userId] = (budgets[userId] ?? auctionBudget) - amount;
    teamSizes[userId] = (teamSizes[userId] ?? 0) + 1;
  }

  return {
    roomId: room.id,
    leagueId: room.leagueId,
    status: room.status as AuctionState["status"],
    phase: room.status === "in_progress" ? "nominating" : "waiting",
    pickOrder,
    currentNominatorIndex: room.currentTurn,
    currentPlayerId: null,
    currentBids: [],
    highestBid: null,
    maxBidTime: (settings.maxBidTime as number) ?? 15,
    goingOnceTime: (settings.goingOnceTime as number) ?? 5,
    goingTwiceTime: (settings.goingTwiceTime as number) ?? 3,
    phaseDeadline: null,
    budgets,
    auctionBudget,
    minBid: (settings.minBid as number) ?? 1,
    bidIncrement: (settings.bidIncrement as number) ?? 1,
    maxPlayersPerTeam: (settings.maxPlayersPerTeam as number) ?? 11,
    unsoldPlayerReAuction: (settings.unsoldPlayerReAuction as boolean) ?? true,
    soldPlayers,
    unsoldPlayerIds: [],
    teamSizes,
  };
}

/**
 * Persist an auction sale to the database.
 */
export async function persistAuctionSale(
  db: Database,
  state: AuctionState,
  playerId: string,
  userId: string,
  amount: number
): Promise<void> {
  await db.insert(draftPicks).values({
    roomId: state.roomId,
    userId,
    playerId,
    pickNumber: state.soldPlayers.length,
    round: 1,
    bidAmount: String(amount),
  });
}

/**
 * Update auction room state in the database.
 */
export async function updateAuctionRoom(
  db: Database,
  state: AuctionState
): Promise<void> {
  await db
    .update(draftRooms)
    .set({
      status: state.status,
      currentTurn: state.currentNominatorIndex,
      currentPickDeadline: state.phaseDeadline,
    })
    .where(eq(draftRooms.id, state.roomId));
}
