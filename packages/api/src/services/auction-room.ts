import type { Database } from "@draftplay/db";
import { draftRooms, draftPicks } from "@draftplay/db";
import { eq, and } from "drizzle-orm";

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

  // Pre-computed deadlines (set when player is nominated, extended on new bid)
  biddingEndsAt: Date | null;    // when bidding phase ends → going_once
  goingOnceEndsAt: Date | null;  // when going_once ends → going_twice
  goingTwiceEndsAt: Date | null; // when going_twice ends → sold

  // Budget tracking: userId -> remaining budget
  budgets: Record<string, number>;
  auctionBudget: number;
  minBid: number;
  bidIncrement: number;
  maxPlayersPerTeam: number;
  unsoldPlayerReAuction: boolean;
  basePriceMode: "flat" | "credits" | "percentage";
  basePricePercent: number;

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

  // Pause state (tactical timeouts)
  isPaused: boolean;
  pausedBy: string | null;
  pausedAt: Date | null;
  pauseRemainingMs: number | null; // ms remaining on phase timer when paused
  pausesUsed: Record<string, number>; // userId -> count

  // Config (from league auction rules)
  squadVisibility: "hidden" | "after_sold" | "full";
  buyerVisibility: "during_auction" | "after_auction";
  squadRule: "none" | string; // "none" = no constraints, otherwise a SquadRule ID
  maxPausesPerMember: number;
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
  if (state.isPaused) {
    return { valid: false, error: "Auction is paused" };
  }

  if (state.phase !== "bidding" && state.phase !== "going_once" && state.phase !== "going_twice") {
    return { valid: false, error: "Bidding is not open" };
  }

  if (!state.currentPlayerId) {
    return { valid: false, error: "No player is currently being auctioned" };
  }

  // Reject bids after deadline
  if (state.phaseDeadline && new Date(state.phaseDeadline).getTime() < Date.now()) {
    return { valid: false, error: "Time is up — bidding closed" };
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

  // New bid resets all deadlines
  const now = Date.now();
  const biddingEnds = new Date(now + state.maxBidTime * 1000);
  const goingOnceEnds = new Date(biddingEnds.getTime() + state.goingOnceTime * 1000);
  const goingTwiceEnds = new Date(goingOnceEnds.getTime() + state.goingTwiceTime * 1000);

  return {
    ...state,
    phase: "bidding",
    currentBids: [...state.currentBids, bid],
    highestBid: bid,
    phaseDeadline: biddingEnds,
    biddingEndsAt: biddingEnds,
    goingOnceEndsAt: goingOnceEnds,
    goingTwiceEndsAt: goingTwiceEnds,
  };
}

/**
 * Advance auction phase when timer expires.
 * bidding -> going_once -> going_twice -> sold
 */
export function advancePhase(state: AuctionState): AuctionState {
  // Don't advance while paused
  if (state.isPaused) return state;

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
    if (state.highestBid && state.currentPlayerId) {
      // SOLD — show sold phase (UI displays confetti), then next advance goes to nominating
      const buyer = state.highestBid.userId;
      const amount = state.highestBid.amount;

      return {
        ...state,
        phase: "sold",
        phaseDeadline: null, // no timer — UI auto-advances after 3s
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
      };
    }

    // No bids — unsold
    return {
      ...state,
      phase: "sold",
      phaseDeadline: null,
      unsoldPlayerIds: state.currentPlayerId
        ? [...state.unsoldPlayerIds, state.currentPlayerId]
        : state.unsoldPlayerIds,
    };
  }

  // "sold" → reset to nominating for next player
  if (state.phase === "sold") {
    return {
      ...state,
      phase: "nominating",
      currentPlayerId: null,
      currentBids: [],
      highestBid: null,
      phaseDeadline: null,
    };
  }

  return state;
}

/**
 * Calculate base price for a player based on auction settings.
 */
export function getBasePrice(state: AuctionState, playerCredits: number): number {
  switch (state.basePriceMode) {
    case "credits":
      return Math.max(state.minBid, playerCredits);
    case "percentage":
      return Math.max(state.minBid, Math.round(playerCredits * (state.basePricePercent / 100) * 10) / 10);
    case "flat":
    default:
      return state.minBid;
  }
}

/**
 * Start nomination for the next player.
 * basePrice: the minimum opening bid for this specific player.
 */
export function startNomination(
  state: AuctionState,
  playerId: string,
  basePrice?: number,
  nominatorUserId?: string,
): AuctionState {
  const now = Date.now();
  const effectiveBase = basePrice ?? state.minBid;
  const biddingEnds = new Date(now + state.maxBidTime * 1000);
  const goingOnceEnds = new Date(biddingEnds.getTime() + state.goingOnceTime * 1000);
  const goingTwiceEnds = new Date(goingOnceEnds.getTime() + state.goingTwiceTime * 1000);

  // Nominator auto-bids at base price (unless their squad is full)
  const nominatorSquadFull = nominatorUserId
    ? (state.teamSizes[nominatorUserId] ?? 0) >= state.maxPlayersPerTeam
    : false;
  const openingBid: AuctionBid | null = nominatorUserId && !nominatorSquadFull
    ? { userId: nominatorUserId, amount: effectiveBase, timestamp: now }
    : null;

  return {
    ...state,
    phase: "bidding",
    currentPlayerId: playerId,
    currentBids: openingBid ? [openingBid] : [],
    highestBid: openingBid,
    phaseDeadline: biddingEnds,
    biddingEndsAt: biddingEnds,
    goingOnceEndsAt: goingOnceEnds,
    goingTwiceEndsAt: goingTwiceEnds,
    currentNominatorIndex: state.currentNominatorIndex + 1,
    minBid: effectiveBase,
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
    phase: (settings._phase as AuctionPhase) ?? (room.status === "in_progress" ? "nominating" : "waiting"),
    pickOrder,
    currentNominatorIndex: room.currentTurn,
    currentPlayerId: (settings._currentPlayerId as string) ?? null,
    currentBids: [],
    highestBid: (settings._highestBid as AuctionBid) ?? null,
    maxBidTime: (settings.maxBidTime as number) ?? 30,
    goingOnceTime: (settings.goingOnceTime as number) ?? 5,
    goingTwiceTime: (settings.goingTwiceTime as number) ?? 3,
    phaseDeadline: room.currentPickDeadline ? new Date(room.currentPickDeadline) : null,
    biddingEndsAt: settings._biddingEndsAt ? new Date(settings._biddingEndsAt as string) : null,
    goingOnceEndsAt: settings._goingOnceEndsAt ? new Date(settings._goingOnceEndsAt as string) : null,
    goingTwiceEndsAt: settings._goingTwiceEndsAt ? new Date(settings._goingTwiceEndsAt as string) : null,
    budgets,
    auctionBudget,
    minBid: (settings._currentBasePrice as number) ?? (settings.minBid as number) ?? 1,
    bidIncrement: (settings.bidIncrement as number) ?? 0.1,
    maxPlayersPerTeam: (settings.maxPlayersPerTeam as number) ?? 14,
    unsoldPlayerReAuction: (settings.unsoldPlayerReAuction as boolean) ?? true,
    basePriceMode: (settings.basePriceMode as "flat" | "credits" | "percentage") ?? "flat",
    basePricePercent: (settings.basePricePercent as number) ?? 50,
    soldPlayers,
    unsoldPlayerIds: [],
    teamSizes,

    // Pause state
    isPaused: (settings._isPaused as boolean) ?? false,
    pausedBy: (settings._pausedBy as string) ?? null,
    pausedAt: settings._pausedAt ? new Date(settings._pausedAt as string) : null,
    pauseRemainingMs: (settings._pauseRemainingMs as number) ?? null,
    pausesUsed: (settings._pausesUsed as Record<string, number>) ?? {},

    // Config
    squadVisibility: (settings.squadVisibility as "hidden" | "after_sold" | "full") ?? "after_sold",
    buyerVisibility: (settings.buyerVisibility as "during_auction" | "after_auction") ?? "during_auction",
    squadRule: (settings.squadRule as string) ?? "none",
    maxPausesPerMember: (settings.maxPausesPerMember as number) ?? 3,
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
  // Idempotent: unique index on (room_id, player_id) prevents duplicates
  try {
    await db.insert(draftPicks).values({
      roomId: state.roomId,
      userId,
      playerId,
      pickNumber: state.soldPlayers.length,
      round: 1,
      bidAmount: String(amount),
    });
  } catch {
    // Duplicate — already persisted by another client, safe to ignore
  }
}

/**
 * Update auction room state in the database.
 */
export async function updateAuctionRoom(
  db: Database,
  state: AuctionState
): Promise<void> {
  // Persist live auction state in the settings JSONB so tRPC polling can access it
  // (phase, currentPlayerId, highestBid are ephemeral but needed for UI rendering)
  const existingRoom = await db.query.draftRooms.findFirst({
    where: eq(draftRooms.id, state.roomId),
    columns: { settings: true },
  });
  const existingSettings = (existingRoom?.settings ?? {}) as Record<string, unknown>;

  await db
    .update(draftRooms)
    .set({
      status: state.status,
      currentTurn: state.currentNominatorIndex,
      currentPickDeadline: state.phaseDeadline,
      settings: {
        ...existingSettings,
        _phase: state.phase,
        _currentPlayerId: state.currentPlayerId,
        _highestBid: state.highestBid,
        _currentBasePrice: state.currentPlayerId ? state.minBid : null,
        _biddingEndsAt: state.biddingEndsAt?.toISOString() ?? null,
        _goingOnceEndsAt: state.goingOnceEndsAt?.toISOString() ?? null,
        _goingTwiceEndsAt: state.goingTwiceEndsAt?.toISOString() ?? null,
        // Pause state
        _isPaused: state.isPaused,
        _pausedBy: state.pausedBy,
        _pausedAt: state.pausedAt?.toISOString() ?? null,
        _pauseRemainingMs: state.pauseRemainingMs,
        _pausesUsed: state.pausesUsed,
      },
    })
    .where(eq(draftRooms.id, state.roomId));
}

// ── Pause / Resume ──────────────────────────────────────────

/**
 * Pause the auction (tactical timeout). Freezes all timers.
 */
export function pauseAuction(state: AuctionState, userId: string): AuctionState {
  const remaining = state.phaseDeadline
    ? Math.max(0, new Date(state.phaseDeadline).getTime() - Date.now())
    : null;

  return {
    ...state,
    isPaused: true,
    pausedBy: userId,
    pausedAt: new Date(),
    pauseRemainingMs: remaining,
    pausesUsed: {
      ...state.pausesUsed,
      [userId]: (state.pausesUsed[userId] ?? 0) + 1,
    },
  };
}

/**
 * Resume the auction after a pause. Restores timer from where it was frozen.
 */
export function resumeAuction(state: AuctionState): AuctionState {
  const now = Date.now();
  const remaining = state.pauseRemainingMs ?? 0;

  // Recalculate deadlines from the remaining time
  const newDeadline = remaining > 0 ? new Date(now + remaining) : null;

  // Rebuild the cascading deadlines based on current phase
  let biddingEndsAt = state.biddingEndsAt;
  let goingOnceEndsAt = state.goingOnceEndsAt;
  let goingTwiceEndsAt = state.goingTwiceEndsAt;

  if (state.phase === "bidding" && newDeadline) {
    biddingEndsAt = newDeadline;
    goingOnceEndsAt = new Date(newDeadline.getTime() + state.goingOnceTime * 1000);
    goingTwiceEndsAt = new Date(goingOnceEndsAt.getTime() + state.goingTwiceTime * 1000);
  } else if (state.phase === "going_once" && newDeadline) {
    goingOnceEndsAt = newDeadline;
    goingTwiceEndsAt = new Date(newDeadline.getTime() + state.goingTwiceTime * 1000);
  } else if (state.phase === "going_twice" && newDeadline) {
    goingTwiceEndsAt = newDeadline;
  }

  return {
    ...state,
    isPaused: false,
    pausedBy: null,
    pausedAt: null,
    pauseRemainingMs: null,
    phaseDeadline: newDeadline,
    biddingEndsAt,
    goingOnceEndsAt,
    goingTwiceEndsAt,
  };
}

// ── Squad Rule Validation ───────────────────────────────────

import type { SquadRule } from "@draftplay/shared";

/**
 * Validate whether adding a player of the given role would violate the squad rule.
 * Checks if a valid squad is still achievable with remaining slots.
 */
const ROLE_LABELS: Record<string, string> = {
  WK: "Wicket-keepers",
  BAT: "Batsmen",
  BOWL: "Bowlers",
  AR: "All-rounders",
};

export function validateSquadRule(
  squadRule: SquadRule,
  currentRoleCounts: Record<string, number>,
  newPlayerRole: string,
  currentTeamSize: number,
): { valid: boolean; error?: string } {
  const squadSize = squadRule.squadSize ?? 14;

  // Squad full per the rule's squad size
  if (currentTeamSize >= squadSize) {
    return { valid: false, error: `Squad is full — ${squadRule.name} rule allows ${squadSize} players` };
  }

  // Map player roles to squad rule categories
  const roleCategory = mapRoleToCategory(newPlayerRole);
  const roleLabel = ROLE_LABELS[roleCategory] ?? roleCategory;
  const updated = { ...currentRoleCounts };
  updated[roleCategory] = (updated[roleCategory] ?? 0) + 1;

  // Check max constraints for this role
  const maxField = `max${roleCategory}` as keyof SquadRule;
  const maxVal = squadRule[maxField] as number;
  if (typeof maxVal === "number" && updated[roleCategory]! > maxVal) {
    return { valid: false, error: `Can't add — already at max ${roleLabel} (${maxVal} allowed by ${squadRule.name} rule)` };
  }

  // Check if remaining slots can still fill minimum requirements
  const remainingSlots = squadSize - currentTeamSize - 1; // -1 for the player being added
  const categories = ["WK", "BAT", "BOWL", "AR"] as const;
  let slotsNeeded = 0;
  const missing: string[] = [];
  for (const cat of categories) {
    const minField = `min${cat}` as keyof SquadRule;
    const minVal = squadRule[minField] as number;
    if (typeof minVal === "number") {
      const have = updated[cat] ?? 0;
      if (have < minVal) {
        const gap = minVal - have;
        slotsNeeded += gap;
        missing.push(`${gap} ${ROLE_LABELS[cat] ?? cat}`);
      }
    }
  }

  if (slotsNeeded > remainingSlots) {
    return {
      valid: false,
      error: `Can't add ${roleLabel} — you still need ${missing.join(", ")} with only ${remainingSlots} slot${remainingSlots === 1 ? "" : "s"} left`,
    };
  }

  return { valid: true };
}

export function mapRoleToCategory(role: string): string {
  const r = role.toLowerCase();
  if (r === "wicket_keeper" || r === "wk") return "WK";
  if (r === "batsman" || r === "bat" || r === "batter") return "BAT";
  if (r === "bowler" || r === "bowl") return "BOWL";
  if (r === "all_rounder" || r === "ar" || r === "allrounder") return "AR";
  return "BAT"; // fallback
}
