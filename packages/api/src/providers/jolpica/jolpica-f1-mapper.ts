/**
 * Maps Jolpica (Ergast) F1 API responses to DraftPlay AI types.
 * Jolpica provides deeper F1 data than ESPN: standings, driver info, results.
 */

import type { AITournament, AIMatch, AIPlayer, AITeamStanding } from "@draftplay/shared";
import type {
  JolpicaRacesResponse,
  JolpicaDriverStandingsResponse,
  JolpicaConstructorStandingsResponse,
} from "./jolpica-schemas";
import { getLogger } from "../../lib/logger";

const log = getLogger("jolpica-f1-mapper");

// ---------------------------------------------------------------------------
// Date formatting
// ---------------------------------------------------------------------------

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + "T00:00:00Z");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return dateStr;
  }
}

function formatTime(timeStr?: string): string {
  if (!timeStr) return "";
  try {
    // timeStr is like "04:00:00Z"
    const [h, m] = timeStr.replace("Z", "").split(":");
    const hour = parseInt(h!, 10);
    const min = m ?? "00";
    const ampm = hour >= 12 ? "PM" : "AM";
    const h12 = hour % 12 || 12;
    return `${h12}:${min} ${ampm} UTC`;
  } catch {
    return timeStr;
  }
}

// ---------------------------------------------------------------------------
// Races → AIMatch[]
// ---------------------------------------------------------------------------

export function mapJolpicaRaces(response: JolpicaRacesResponse): { tournament: AITournament; matches: AIMatch[] } {
  const races = response.MRData.RaceTable.Races;
  const season = response.MRData.RaceTable.season ?? races[0]?.season ?? String(new Date().getFullYear());
  const tournamentName = `Formula 1 ${season}`;

  const tournament: AITournament = {
    id: `jolpica-f1-${season}`,
    name: tournamentName,
    sport: "f1",
    category: "league",
    startDate: races[0]?.date ?? null,
    endDate: races[races.length - 1]?.date ?? null,
    imageUrl: null,
    sourceUrl: null,
    description: `Formula 1 World Championship ${season}`,
  };

  const matches: AIMatch[] = races.map((race: typeof races[number]) => {
    const circuit = race.Circuit;
    const venue = [circuit.Location.locality, circuit.Location.country].filter(Boolean).join(", ");

    // Determine if race is upcoming, live, or completed based on date
    const raceDate = new Date(race.date + "T" + (race.time ?? "00:00:00Z"));
    const now = new Date();
    const hoursSinceRace = (now.getTime() - raceDate.getTime()) / (1000 * 60 * 60);
    let status: AIMatch["status"] = "upcoming";
    if (hoursSinceRace > 3) status = "completed";
    else if (hoursSinceRace > -0.5 && hoursSinceRace <= 3) status = "live";

    return {
      id: `jolpica-f1-${season}-r${race.round}`,
      teamA: race.raceName.replace(/Grand Prix/i, "GP"),
      teamB: circuit.circuitName,
      sport: "f1" as const,
      format: race.Sprint ? "Sprint Weekend" : "Race",
      tournamentName,
      time: formatTime(race.time),
      date: formatDate(race.date),
      venue: `${circuit.circuitName}, ${venue}`,
      status,
      scoreSummary: null,
      tossWinner: null,
      tossDecision: null,
      result: null,
      sourceUrl: race.url ?? null,
    };
  });

  log.info({ season, races: matches.length }, "Mapped Jolpica F1 races");
  return { tournament, matches };
}

// ---------------------------------------------------------------------------
// Driver standings → AITeamStanding[] (adapted for F1)
// ---------------------------------------------------------------------------

export function mapJolpicaDriverStandings(
  response: JolpicaDriverStandingsResponse
): Map<string, AITeamStanding[]> {
  const standingsMap = new Map<string, AITeamStanding[]>();
  const lists = response.MRData.StandingsTable.StandingsLists;

  for (const list of lists) {
    const season = list.season ?? "current";
    const tournamentName = `Formula 1 ${season}`;

    const driverStandings = list.DriverStandings ?? [];
    const standings: AITeamStanding[] = driverStandings.map((ds: typeof driverStandings[number], idx: number) => ({
      position: parseInt(ds.position ?? String(idx + 1), 10),
      team: `${ds.Driver.givenName} ${ds.Driver.familyName}`,
      played: 0, // Not directly available — would need results count
      won: parseInt(ds.wins ?? "0", 10),
      lost: 0,
      tied: 0,
      noResult: 0,
      points: parseFloat(ds.points ?? "0"),
      netRunRate: "", // Not applicable for F1
      group: ds.Constructors[0]?.name ?? null,
    }));

    standingsMap.set(tournamentName, standings);
  }

  log.info({ tournaments: standingsMap.size }, "Mapped Jolpica F1 driver standings");
  return standingsMap;
}

// ---------------------------------------------------------------------------
// Drivers → AIPlayer[] (F1 drivers as "players")
// ---------------------------------------------------------------------------

export function mapJolpicaDriversFromStandings(
  response: JolpicaDriverStandingsResponse,
  tournamentName: string
): AIPlayer[] {
  const lists = response.MRData.StandingsTable.StandingsLists;
  const players: AIPlayer[] = [];

  for (const list of lists) {
    for (const ds of list.DriverStandings ?? []) {
      const d = ds.Driver;
      const constructor = ds.Constructors[0];

      players.push({
        id: `jolpica-driver-${d.driverId}`,
        name: `${d.givenName} ${d.familyName}`,
        team: constructor?.name ?? "Unknown",
        role: "driver",
        nationality: d.nationality ?? "",
        battingStyle: null,
        bowlingStyle: null,
        credits: null,
        battingAvg: null,
        bowlingAvg: null,
        strikeRate: null,
        economyRate: null,
        bowlingStrikeRate: null,
        matchesPlayed: null,
        recentForm: null,
        sentimentScore: null,
        injuryStatus: "fit",
        formNote: `${ds.wins ?? "0"} wins, ${ds.points ?? "0"} points`,
        tournamentName,
        sourceUrl: d.url ?? null,
      });
    }
  }

  log.info({ count: players.length }, "Mapped Jolpica F1 drivers as players");
  return players;
}

// ---------------------------------------------------------------------------
// Constructor standings → AIPlayer[] (constructors as "players")
// ---------------------------------------------------------------------------

export function mapJolpicaConstructorsFromStandings(
  response: JolpicaConstructorStandingsResponse,
  tournamentName: string
): AIPlayer[] {
  const lists = response.MRData.StandingsTable.StandingsLists;
  const players: AIPlayer[] = [];

  for (const list of lists) {
    for (const cs of list.ConstructorStandings ?? []) {
      const c = cs.Constructor;

      players.push({
        id: `jolpica-constructor-${c.constructorId}`,
        name: c.name,
        team: c.name,
        role: "constructor",
        nationality: c.nationality ?? "",
        battingStyle: null,
        bowlingStyle: null,
        credits: null,
        battingAvg: null,
        bowlingAvg: null,
        strikeRate: null,
        economyRate: null,
        bowlingStrikeRate: null,
        matchesPlayed: null,
        recentForm: null,
        sentimentScore: null,
        injuryStatus: null,
        formNote: `${cs.wins ?? "0"} wins, ${cs.points ?? "0"} points`,
        tournamentName,
        sourceUrl: c.url ?? null,
      });
    }
  }

  log.info({ count: players.length }, "Mapped Jolpica F1 constructors as players");
  return players;
}
