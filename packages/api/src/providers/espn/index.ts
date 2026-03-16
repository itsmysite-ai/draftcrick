/**
 * ESPN DataProvider implementation.
 * Routes to the correct mapper based on sport.
 * Supports: cricket, f1, football.
 */

import type { Sport, AITournament, AITeamStanding, SportsDashboardData } from "@draftplay/shared";
import type { DataProvider, DataSourceType, ProviderResult } from "../types";
import { espnFetch, ESPN_URLS } from "./espn-client";
import { ESPNCricketScoreboardSchema } from "./espn-schemas";
import { ESPNF1ScoreboardSchema } from "./espn-schemas";
import { mapESPNCricketTournaments, mapESPNCricketMatches } from "./espn-cricket-mapper";
import { mapESPNF1Tournaments, mapESPNF1Matches } from "./espn-f1-mapper";
import { getLogger } from "../../lib/logger";

const log = getLogger("espn-provider");

export class ESPNProvider implements DataProvider {
  readonly source: DataSourceType = "espn";
  readonly supportedSports: Sport[] = ["cricket", "f1"];

  async fetchDashboard(
    sport: Sport,
    _activeTournaments?: string[],
    _seriesHints?: Array<{ name: string; externalId: string }>
  ): Promise<ProviderResult<SportsDashboardData>> {
    const start = Date.now();

    if (!this.supportedSports.includes(sport)) {
      throw new Error(`ESPN does not support sport: ${sport}`);
    }

    let tournaments: AITournament[];
    let matches: ReturnType<typeof mapESPNCricketMatches>;

    if (sport === "cricket") {
      const data = await espnFetch(ESPN_URLS.cricketScoreboard(), ESPNCricketScoreboardSchema);
      tournaments = mapESPNCricketTournaments(data);
      matches = mapESPNCricketMatches(data);
    } else if (sport === "f1") {
      const data = await espnFetch(ESPN_URLS.f1Scoreboard(), ESPNF1ScoreboardSchema);
      tournaments = mapESPNF1Tournaments(data);
      matches = mapESPNF1Matches(data);
    } else {
      throw new Error(`ESPN mapper not implemented for sport: ${sport}`);
    }

    const durationMs = Date.now() - start;
    log.info({ sport, tournaments: tournaments.length, matches: matches.length, durationMs }, "ESPN dashboard fetched");

    return {
      data: {
        tournaments,
        matches,
        lastFetched: new Date().toISOString(),
        sources: ["espn.com"],
        sport,
      },
      source: "espn",
      fetchedAt: new Date().toISOString(),
      durationMs,
    };
  }

  async discoverTournaments(sport: Sport): Promise<ProviderResult<AITournament[]>> {
    // Discovery uses the same endpoint — just return tournaments without matches
    const result = await this.fetchDashboard(sport);
    return {
      data: result.data.tournaments,
      source: "espn",
      fetchedAt: result.fetchedAt,
      durationMs: result.durationMs,
    };
  }

  async fetchStandings(
    _sport: Sport,
    _tournamentNames: string[]
  ): Promise<ProviderResult<Map<string, AITeamStanding[]>>> {
    // ESPN scoreboard header doesn't include standings
    // This will fall through to Gemini in the provider chain
    throw new Error("ESPN does not provide standings via scoreboard endpoint");
  }
}
