/**
 * Gemini DataProvider adapter.
 * Thin wrapper around the existing gemini-sports.ts functions.
 * No logic duplication — just adapts to the DataProvider interface.
 */

import type { Sport, AITournament, AIPlayer, AITeamStanding, SportsDashboardData } from "@draftplay/shared";
import type { DataProvider, DataSourceType, ProviderResult } from "../types";
import {
  fetchSportsData,
  discoverTournaments as geminiDiscoverTournaments,
  fetchTournamentStandings,
  fetchSingleMatchStatus,
  fetchPlayersByTeams,
  fetchSinglePlayer as geminiFetchSinglePlayer,
} from "../../services/gemini-sports";
import { getLogger } from "../../lib/logger";

const log = getLogger("gemini-provider");

export class GeminiProvider implements DataProvider {
  readonly source: DataSourceType = "gemini";
  readonly supportedSports: Sport[] = ["cricket", "f1", "football", "kabaddi", "basketball"];

  async fetchDashboard(
    sport: Sport,
    activeTournaments?: string[],
    _seriesHints?: Array<{ name: string; externalId: string }>
  ): Promise<ProviderResult<SportsDashboardData>> {
    const start = Date.now();
    const data = await fetchSportsData(sport, activeTournaments);
    const durationMs = Date.now() - start;

    log.info({ sport, tournaments: data.tournaments.length, matches: data.matches.length, durationMs }, "Gemini dashboard fetched");

    return {
      data,
      source: "gemini",
      fetchedAt: new Date().toISOString(),
      durationMs,
    };
  }

  async discoverTournaments(sport: Sport): Promise<ProviderResult<AITournament[]>> {
    const start = Date.now();
    const tournaments = await geminiDiscoverTournaments(sport);
    const durationMs = Date.now() - start;

    return {
      data: tournaments,
      source: "gemini",
      fetchedAt: new Date().toISOString(),
      durationMs,
    };
  }

  async fetchStandings(
    sport: Sport,
    tournamentNames: string[]
  ): Promise<ProviderResult<Map<string, AITeamStanding[]>>> {
    const start = Date.now();
    const standingsMap = await fetchTournamentStandings(sport, tournamentNames);
    const durationMs = Date.now() - start;

    return {
      data: standingsMap,
      source: "gemini",
      fetchedAt: new Date().toISOString(),
      durationMs,
    };
  }

  async fetchMatchStatus(
    sport: Sport,
    teamHome: string,
    teamAway: string,
    tournament: string,
    format: string,
    startTime: Date | string,
    currentScore?: string
  ): Promise<ProviderResult<{ status: string; scoreSummary: string | null; result: string | null; tossWinner: string | null; tossDecision: string | null } | null>> {
    const start = Date.now();
    const result = await fetchSingleMatchStatus(teamHome, teamAway, tournament, format, startTime, currentScore);
    const durationMs = Date.now() - start;

    return {
      data: result,
      source: "gemini",
      fetchedAt: new Date().toISOString(),
      durationMs,
    };
  }

  async fetchPlayers(
    sport: Sport,
    teamNames: string[],
    tournamentName: string,
    existingPlayerNames?: string[]
  ): Promise<ProviderResult<AIPlayer[]>> {
    const start = Date.now();
    const players = await fetchPlayersByTeams(sport, teamNames, tournamentName, existingPlayerNames);
    const durationMs = Date.now() - start;

    return {
      data: players,
      source: "gemini",
      fetchedAt: new Date().toISOString(),
      durationMs,
    };
  }

  async fetchSinglePlayer(
    sport: Sport,
    playerName: string,
    teamName: string,
    tournamentName: string
  ): Promise<ProviderResult<AIPlayer | null>> {
    const start = Date.now();
    const player = await geminiFetchSinglePlayer(sport, playerName, teamName, tournamentName);
    const durationMs = Date.now() - start;

    return {
      data: player,
      source: "gemini",
      fetchedAt: new Date().toISOString(),
      durationMs,
    };
  }
}
