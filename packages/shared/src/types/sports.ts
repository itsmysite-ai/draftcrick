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
  /** Source URL from Google Search grounding */
  sourceUrl: string | null;
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
