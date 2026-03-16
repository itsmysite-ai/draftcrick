/**
 * Data Provider abstraction layer.
 * All providers (ESPN, Jolpica, Gemini) implement this interface,
 * returning the same AITournament/AIMatch/AIPlayer types so the
 * downstream pipeline (upsert, cache, admin UI) works unchanged.
 */

import type {
  Sport,
  AITournament,
  AIMatch,
  AIPlayer,
  AITeamStanding,
  SportsDashboardData,
} from "@draftplay/shared";

export type DataSourceType = "espn" | "jolpica" | "gemini" | "cricbuzz";

export interface ProviderResult<T> {
  data: T;
  source: DataSourceType;
  fetchedAt: string;
  durationMs: number;
}

export interface DataProvider {
  readonly source: DataSourceType;
  readonly supportedSports: Sport[];

  /** Fetch tournaments + matches for a sport (primary dashboard data) */
  fetchDashboard(
    sport: Sport,
    activeTournaments?: string[],
    seriesHints?: Array<{ name: string; externalId: string }>
  ): Promise<ProviderResult<SportsDashboardData>>;

  /** Discover available tournaments (lightweight, no matches) */
  discoverTournaments(
    sport: Sport
  ): Promise<ProviderResult<AITournament[]>>;

  /** Fetch standings/points table for specific tournaments */
  fetchStandings(
    sport: Sport,
    tournamentNames: string[]
  ): Promise<ProviderResult<Map<string, AITeamStanding[]>>>;

  /** Fetch single match status update (optional — not all providers support) */
  fetchMatchStatus?(
    sport: Sport,
    teamHome: string,
    teamAway: string,
    tournament: string,
    format: string,
    startTime: Date | string,
    currentScore?: string
  ): Promise<ProviderResult<{ status: string; scoreSummary: string | null; result: string | null; tossWinner: string | null; tossDecision: string | null } | null>>;

  /** Fetch players for specific teams in a tournament (optional) */
  fetchPlayers?(
    sport: Sport,
    teamNames: string[],
    tournamentName: string,
    existingPlayerNames?: string[],
    matchContext?: { startTime: Date; format?: string },
    tournamentExternalId?: string
  ): Promise<ProviderResult<AIPlayer[]>>;

  /** Fetch a single player's latest stats (optional — typically Gemini only) */
  fetchSinglePlayer?(
    sport: Sport,
    playerName: string,
    teamName: string,
    tournamentName: string
  ): Promise<ProviderResult<AIPlayer | null>>;
}
