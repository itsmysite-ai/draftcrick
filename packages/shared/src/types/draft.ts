export type DraftType = "snake_draft" | "auction";
export type DraftStatus = "waiting" | "in_progress" | "completed";

export interface DraftRoom {
  id: string;
  leagueId: string;
  type: DraftType;
  status: DraftStatus;
  currentTurn: number;
  currentRound: number;
  pickOrder: string[];
  timePerPick: number;
  currentPickDeadline: Date | null;
  settings: DraftSettings;
  createdAt: Date;
}

export interface DraftSettings {
  maxRounds?: number;
  autoPick?: boolean;
  pauseBetweenRounds?: boolean;
  auctionBudget?: number;
  minBid?: number;
  bidIncrement?: number;
}

export interface DraftPick {
  id: string;
  roomId: string;
  userId: string;
  playerId: string;
  pickNumber: number;
  round: number;
  bidAmount: number | null;
  pickedAt: Date;
}

export type TradeStatus = "pending" | "accepted" | "rejected" | "expired";

export interface Trade {
  id: string;
  leagueId: string;
  fromUserId: string;
  toUserId: string;
  playersOffered: string[];
  playersRequested: string[];
  status: TradeStatus;
  expiresAt: Date | null;
  createdAt: Date;
}
