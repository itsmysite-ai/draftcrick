/**
 * Jolpica DataProvider implementation.
 * Only supports F1 — provides deeper data than ESPN (standings, drivers, results).
 */

import type { Sport, AITournament, AIPlayer, AITeamStanding, SportsDashboardData } from "@draftplay/shared";
import type { DataProvider, DataSourceType, ProviderResult } from "../types";
import { jolpicaFetch } from "./jolpica-client";
import {
  JolpicaRacesSchema,
  JolpicaDriverStandingsSchema,
  JolpicaConstructorStandingsSchema,
} from "./jolpica-schemas";
import {
  mapJolpicaRaces,
  mapJolpicaDriverStandings,
  mapJolpicaDriversFromStandings,
  mapJolpicaConstructorsFromStandings,
} from "./jolpica-f1-mapper";
import { getLogger } from "../../lib/logger";

const log = getLogger("jolpica-provider");

export class JolpicaProvider implements DataProvider {
  readonly source: DataSourceType = "jolpica";
  readonly supportedSports: Sport[] = ["f1"];

  async fetchDashboard(
    sport: Sport,
    _activeTournaments?: string[],
    _seriesHints?: Array<{ name: string; externalId: string }>
  ): Promise<ProviderResult<SportsDashboardData>> {
    if (sport !== "f1") {
      throw new Error(`Jolpica only supports F1, not ${sport}`);
    }

    const start = Date.now();
    const year = new Date().getFullYear();

    const racesData = await jolpicaFetch(`/${year}/races.json`, JolpicaRacesSchema);
    const { tournament, matches } = mapJolpicaRaces(racesData);

    const durationMs = Date.now() - start;
    log.info({ matches: matches.length, durationMs }, "Jolpica F1 dashboard fetched");

    return {
      data: {
        tournaments: [tournament],
        matches,
        lastFetched: new Date().toISOString(),
        sources: ["jolpi.ca"],
        sport: "f1",
      },
      source: "jolpica",
      fetchedAt: new Date().toISOString(),
      durationMs,
    };
  }

  async discoverTournaments(sport: Sport): Promise<ProviderResult<AITournament[]>> {
    const result = await this.fetchDashboard(sport);
    return {
      data: result.data.tournaments,
      source: "jolpica",
      fetchedAt: result.fetchedAt,
      durationMs: result.durationMs,
    };
  }

  async fetchStandings(
    sport: Sport,
    _tournamentNames: string[]
  ): Promise<ProviderResult<Map<string, AITeamStanding[]>>> {
    if (sport !== "f1") {
      throw new Error(`Jolpica only supports F1 standings`);
    }

    const start = Date.now();

    const data = await jolpicaFetch(`/current/driverStandings.json`, JolpicaDriverStandingsSchema);
    const standingsMap = mapJolpicaDriverStandings(data);

    const durationMs = Date.now() - start;
    return {
      data: standingsMap,
      source: "jolpica",
      fetchedAt: new Date().toISOString(),
      durationMs,
    };
  }

  async fetchPlayers(
    sport: Sport,
    _teamNames: string[],
    _tournamentName: string,
  ): Promise<ProviderResult<AIPlayer[]>> {
    if (sport !== "f1") {
      throw new Error(`Jolpica only supports F1 players`);
    }

    const start = Date.now();
    const year = new Date().getFullYear();
    const tournamentName = `Formula 1 ${year}`;

    // Fetch both drivers and constructors
    const [driverData, constructorData] = await Promise.all([
      jolpicaFetch(`/current/driverStandings.json`, JolpicaDriverStandingsSchema),
      jolpicaFetch(`/current/constructorStandings.json`, JolpicaConstructorStandingsSchema),
    ]);

    const drivers = mapJolpicaDriversFromStandings(driverData, tournamentName);
    const constructors = mapJolpicaConstructorsFromStandings(constructorData, tournamentName);
    const players = [...drivers, ...constructors];

    const durationMs = Date.now() - start;
    return {
      data: players,
      source: "jolpica",
      fetchedAt: new Date().toISOString(),
      durationMs,
    };
  }
}
