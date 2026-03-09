export type Sport = "cricket" | "f1" | "football" | "kabaddi" | "basketball";
export type CricketFormat = "t20" | "odi" | "test";
export type F1Format = "race" | "sprint" | "qualifying";
export type MatchStatus = "upcoming" | "live" | "completed" | "abandoned";
export type TossDecision = "bat" | "bowl";

export interface Match {
  id: string;
  externalId: string;
  sport: Sport;
  format: CricketFormat;
  tournament: string;
  teamHome: string;
  teamAway: string;
  venue: string;
  city: string | null;
  startTime: Date;
  status: MatchStatus;
  tossWinner: string | null;
  tossDecision: TossDecision | null;
  playingXiHome: string[] | null;
  playingXiAway: string[] | null;
  result: string | null;
  createdAt: Date;
}

// Cricket roles
export type CricketRole = "batsman" | "bowler" | "all_rounder" | "wicket_keeper";
// F1 roles
export type F1Role = "driver" | "constructor" | "team_principal";
// Union of all sport roles (DB stores as text, fully compatible)
export type PlayerRole = CricketRole | F1Role;

export interface Player {
  id: string;
  externalId: string;
  name: string;
  team: string;
  role: PlayerRole;
  photoUrl: string | null;
  nationality: string | null;
  battingStyle: string | null;
  bowlingStyle: string | null;
  stats: PlayerStats;
  createdAt: Date;
  updatedAt: Date;
}

// Base stats shared across all sports
export interface BasePlayerStats {
  matches?: number;
  credits?: number;
}

// Cricket-specific player stats
export interface CricketPlayerStats extends BasePlayerStats {
  runs?: number;
  wickets?: number;
  average?: number;
  strikeRate?: number;
  economyRate?: number;
  highScore?: number;
  bestBowling?: string;
  catches?: number;
  stumpings?: number;
}

// F1-specific player stats
export interface F1PlayerStats extends BasePlayerStats {
  wins?: number;
  podiums?: number;
  polePositions?: number;
  fastestLaps?: number;
  championshipPoints?: number;
  dnfs?: number;
  avgFinishPosition?: number;
}

// Union type — backwards compatible (CricketPlayerStats is the existing shape)
export type PlayerStats = CricketPlayerStats | F1PlayerStats;

export interface PlayerMatchScore {
  id: string;
  playerId: string;
  matchId: string;
  runs: number;
  ballsFaced: number;
  fours: number;
  sixes: number;
  wickets: number;
  oversBowled: number;
  runsConceded: number;
  maidens: number;
  catches: number;
  stumpings: number;
  runOuts: number;
  fantasyPoints: number;
  isPlaying: boolean;
  updatedAt: Date;
}
