export type Sport = "cricket" | "football" | "kabaddi" | "basketball";
export type CricketFormat = "t20" | "odi" | "test";
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

export type PlayerRole =
  | "batsman"
  | "bowler"
  | "all_rounder"
  | "wicket_keeper";

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

export interface PlayerStats {
  matches?: number;
  runs?: number;
  wickets?: number;
  average?: number;
  strikeRate?: number;
  economyRate?: number;
  highScore?: number;
  bestBowling?: string;
  catches?: number;
  stumpings?: number;
  /** Fantasy credits 7.0-10.0, set by Gemini player roster fetch */
  credits?: number;
}

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
