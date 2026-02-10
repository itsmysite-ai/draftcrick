export type LeagueFormat =
  | "salary_cap"
  | "draft"
  | "auction"
  | "prediction";

export type LeagueTemplate = "casual" | "competitive" | "pro" | "custom";
export type LeagueStatus = "active" | "completed" | "archived";
export type LeagueMemberRole = "owner" | "admin" | "member";

export interface League {
  id: string;
  name: string;
  ownerId: string;
  format: LeagueFormat;
  sport: string;
  tournament: string;
  season: string | null;
  isPrivate: boolean;
  inviteCode: string | null;
  maxMembers: number;
  rules: LeagueRules;
  template: LeagueTemplate;
  status: LeagueStatus;
  createdAt: Date;
}

export interface LeagueMember {
  leagueId: string;
  userId: string;
  role: LeagueMemberRole;
  joinedAt: Date;
}

export interface LeagueRules {
  // Team composition
  teamSize?: number;
  minBatsmen?: number;
  maxBatsmen?: number;
  minBowlers?: number;
  maxBowlers?: number;
  minAllRounders?: number;
  maxAllRounders?: number;
  minWicketKeepers?: number;
  maxWicketKeepers?: number;
  maxOverseasPlayers?: number;

  // Salary cap
  totalBudget?: number;
  playerPriceMin?: number;
  playerPriceMax?: number;

  // Scoring
  scoringRules?: ScoringRules;

  // Boosters
  captainMultiplier?: number;
  viceCaptainMultiplier?: number;
  powerPlayerMultiplier?: number;

  // Transfers
  maxTransfersPerWeek?: number;
  tradeWindowOpen?: boolean;
  waiverWirePriority?: "inverse_standings" | "first_come";

  // Playoffs
  playoffSize?: number;
  playoffFormat?: "knockout" | "round_robin";

  // Custom rules stored as JSON
  customRules?: Record<string, unknown>;
}

export interface ScoringRules {
  // Batting
  runPoints?: number;
  boundaryBonus?: number;
  sixBonus?: number;
  halfCenturyBonus?: number;
  centuryBonus?: number;
  strikeRateBonus?: { threshold: number; points: number }[];
  duckPenalty?: number;

  // Bowling
  wicketPoints?: number;
  maidenOverPoints?: number;
  threeWicketBonus?: number;
  fiveWicketBonus?: number;
  economyRateBonus?: { threshold: number; points: number }[];

  // Fielding
  catchPoints?: number;
  stumpingPoints?: number;
  runOutDirectPoints?: number;
  runOutIndirectPoints?: number;

  // Other
  playerOfMatchBonus?: number;
}

export type ContestStatus =
  | "open"
  | "locked"
  | "live"
  | "settling"
  | "settled"
  | "cancelled";

export type ContestType = "public" | "private" | "h2h";

export interface Contest {
  id: string;
  leagueId: string | null;
  matchId: string;
  name: string;
  entryFee: number;
  prizePool: number;
  maxEntries: number;
  currentEntries: number;
  status: ContestStatus;
  prizeDistribution: PrizeSlot[];
  contestType: ContestType;
  isGuaranteed: boolean;
  createdAt: Date;
}

export interface PrizeSlot {
  rank: number;
  amount: number;
}

export interface FantasyTeam {
  id: string;
  userId: string;
  contestId: string;
  players: FantasyTeamPlayer[];
  captainId: string;
  viceCaptainId: string;
  totalPoints: number;
  rank: number | null;
  creditsUsed: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FantasyTeamPlayer {
  playerId: string;
  role: PlayerRole;
  isPlaying: boolean;
}

// Re-export from match for convenience
export type { PlayerRole } from "./match";
