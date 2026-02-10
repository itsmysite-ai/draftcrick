
export enum MatchStatus {
  UPCOMING = 'upcoming',
  LIVE = 'live',
  COMPLETED = 'completed'
}

export enum PlayerRole {
  BATSMAN = 'BAT',
  BOWLER = 'BOWL',
  ALL_ROUNDER = 'AR',
  WICKET_KEEPER = 'WK'
}

export interface Player {
  id: string;
  name: string;
  team: string;
  role: PlayerRole;
  price: number;
  points: number;
  ownership?: number;
  form?: string;
  lastPerformance?: string;
}

export interface Match {
  id: string;
  homeTeam: string;
  awayTeam: string;
  venue: string;
  startTime: string;
  status: MatchStatus;
  homeScore?: string;
  awayScore?: string;
  format: string;
  tournament: string;
}

export interface ChatMessage {
  role: 'user' | 'guru';
  text: string;
  timestamp: Date;
  sources?: { web?: { uri?: string; title?: string } }[];
  image?: string;
  id?: number;
}

export type Theme = 'light' | 'dark' | 'system';
export type FantasyFormat = 'salary' | 'draft' | 'auction' | 'prediction';
