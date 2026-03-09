/**
 * Sport-agnostic types for AI-fetched sports data.
 * Designed for easy expansion beyond cricket to football, kabaddi, basketball, etc.
 */

import type { Sport } from "./match";

// Re-export Sport from match.ts — single source of truth
export type { Sport } from "./match";

/** Category of a tournament (maps to how it's badged in the UI) */
export type TournamentCategory =
  | "international"
  | "domestic"
  | "league"
  | "bilateral"
  | "qualifier"
  | "friendly";

/** Status of an AI-fetched match */
export type AIMatchStatus = "upcoming" | "live" | "completed" | "delayed" | "abandoned";

/**
 * A tournament fetched via Gemini AI + Google Search grounding.
 * Sport-agnostic — works for cricket, football, etc.
 */
export interface AITournament {
  id: string;
  name: string;
  sport: Sport;
  category: TournamentCategory;
  /** ISO date strings for start/end, null if unknown */
  startDate: string | null;
  endDate: string | null;
  /** Optional image URL from grounding sources */
  imageUrl: string | null;
  /** Source URL from Google Search grounding */
  sourceUrl: string | null;
  /** Brief 1-line description from Gemini discovery */
  description: string | null;
}

/**
 * A match fetched via Gemini AI + Google Search grounding.
 * Sport-agnostic — the "teams" field works for any 2-team sport.
 */
export interface AIMatch {
  id: string;
  teamA: string;
  teamB: string;
  sport: Sport;
  /** e.g., "T20", "ODI", "Test", "Premier League", "Pro Kabaddi" */
  format: string;
  /** The tournament this match belongs to */
  tournamentName: string;
  /** Display-ready time string (e.g., "11:00 AM IST") */
  time: string;
  /** Display-ready date string (e.g., "Feb 10, 2026") */
  date: string;
  /** Venue name */
  venue: string | null;
  status: AIMatchStatus;
  /** Score summary for live/completed matches */
  scoreSummary: string | null;
  /** Who won the toss */
  tossWinner: string | null;
  /** Toss decision: "bat" or "bowl" */
  tossDecision: string | null;
  /** Match result summary (e.g., "India won by 6 wickets") */
  result: string | null;
  /** Source URL from Google Search grounding */
  sourceUrl: string | null;
}

/**
 * A player fetched via Gemini AI + Google Search grounding.
 * Sport-agnostic — role values are sport-specific (e.g., cricket roles below).
 */
export interface AIPlayer {
  id: string;
  name: string;
  team: string;
  role: "batsman" | "bowler" | "all_rounder" | "wicket_keeper";
  nationality: string;
  battingStyle: string | null;
  bowlingStyle: string | null;
  /** Raw Gemini fantasy credits 7.0-10.0 (superseded by calculated credits) */
  credits: number | null;
  battingAvg: number | null;
  bowlingAvg: number | null;
  // --- Extended stats (from enriched Gemini prompt) ---
  strikeRate: number | null;
  economyRate: number | null;
  bowlingStrikeRate: number | null;
  matchesPlayed: number | null;
  /** Recent form 1-10 based on last 5 matches */
  recentForm: number | null;
  /** Media sentiment/buzz score 1-10 */
  sentimentScore: number | null;
  /** "fit" | "doubtful" | "injured" | "recovered" */
  injuryStatus: string | null;
  /** 1-sentence form narrative from media */
  formNote: string | null;
  /** Tournament this player was fetched from */
  tournamentName: string;
  /** Source URL from Google Search grounding */
  sourceUrl: string | null;
}

// ---------------------------------------------------------------------------
// Player diff types — used by admin approve/reject flow on re-fetch
// ---------------------------------------------------------------------------

export type PlayerChangeType = "new" | "updated" | "no_change";

export interface PlayerFieldChange {
  field: string;
  oldValue: string | number | null;
  newValue: string | number | null;
}

export interface PlayerDiffEntry {
  externalId: string;
  name: string;
  team: string;
  changeType: PlayerChangeType;
  changes: PlayerFieldChange[];
  /** Human-readable reason, e.g. "Team: MI → RCB, Credits: 8.5 → 9.0" */
  reason: string;
  /** Full proposed data from Gemini (needed to apply if approved) */
  proposed: {
    name: string;
    team: string;
    role: string;
    nationality: string;
    battingStyle: string | null;
    bowlingStyle: string | null;
    credits: number | null;
    battingAvg: number | null;
    bowlingAvg: number | null;
    strikeRate: number | null;
    economyRate: number | null;
    bowlingStrikeRate: number | null;
    matchesPlayed: number | null;
    recentForm: number | null;
    sentimentScore: number | null;
    injuryStatus: string | null;
    formNote: string | null;
  };
}

/**
 * A team's standing in a tournament points table, fetched via Gemini AI.
 * Stored as JSONB on the tournaments table for display caching.
 */
export interface AITeamStanding {
  position: number;
  team: string;
  played: number;
  won: number;
  lost: number;
  tied: number;
  noResult: number;
  points: number;
  netRunRate: string; // "+0.825" or "-1.234"
  group: string | null; // "Group A" or null
}

/**
 * Complete dashboard data returned by the sports endpoint.
 * Cached server-side with 24hr TTL.
 */
export interface SportsDashboardData {
  tournaments: AITournament[];
  matches: AIMatch[];
  /** ISO timestamp when data was last fetched from Gemini */
  lastFetched: string;
  /** Grounding source URLs from Gemini */
  sources: string[];
  /** Which sport this data is for */
  sport: Sport;
}

/**
 * Prompt configuration per sport — makes it trivial to add new sports.
 * Just add an entry here and the Gemini service handles the rest.
 */
export interface SportPromptConfig {
  sport: Sport;
  /** Human-readable sport name for prompts */
  displayName: string;
  /** Sport-specific terms to include in the AI prompt */
  formatExamples: string[];
  /** Known tournament names to hint the AI */
  knownTournaments: string[];
}
