/**
 * Maps ESPN F1 scoreboard JSON to DraftPlay AI types.
 * ESPN endpoint: /apis/site/v2/sports/racing/f1/scoreboard
 */

import type { AITournament, AIMatch, AIMatchStatus } from "@draftplay/shared";
import type { ESPNF1Scoreboard } from "./espn-schemas";
import { getLogger } from "../../lib/logger";

const log = getLogger("espn-f1-mapper");

// ---------------------------------------------------------------------------
// Status mapping
// ---------------------------------------------------------------------------

function mapStatus(stateStr?: string, description?: string): AIMatchStatus {
  const state = (stateStr ?? "").toLowerCase();
  const desc = (description ?? "").toLowerCase();

  if (state === "in" || desc.includes("in progress") || desc.includes("lap")) {
    return "live";
  }
  if (state === "post" || desc.includes("final") || desc.includes("complete") || desc.includes("finished")) {
    return "completed";
  }
  if (desc.includes("delayed") || desc.includes("suspended") || desc.includes("red flag")) {
    return "delayed";
  }
  if (desc.includes("cancel") || desc.includes("abandon")) {
    return "abandoned";
  }
  return "upcoming";
}

// ---------------------------------------------------------------------------
// Date formatting
// ---------------------------------------------------------------------------

function formatDate(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return isoDate;
  }
}

function formatTime(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "UTC" }) + " UTC";
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Public mappers
// ---------------------------------------------------------------------------

export function mapESPNF1Tournaments(response: ESPNF1Scoreboard): AITournament[] {
  const tournaments: AITournament[] = [];

  for (const league of response.leagues) {
    const season = league.season;
    tournaments.push({
      id: `espn-f1-${league.id}-${season?.year ?? new Date().getFullYear()}`,
      name: `${league.name} ${season?.year ?? new Date().getFullYear()}`,
      sport: "f1",
      category: "league",
      startDate: season?.startDate?.split("T")[0] ?? null,
      endDate: season?.endDate?.split("T")[0] ?? null,
      imageUrl: null,
      sourceUrl: null,
      description: `${league.name} ${season?.year ?? ""} Season`,
    });
  }

  log.info({ count: tournaments.length }, "Mapped ESPN F1 tournaments");
  return tournaments;
}

export function mapESPNF1Matches(response: ESPNF1Scoreboard): AIMatch[] {
  const matches: AIMatch[] = [];
  const leagueName = response.leagues[0]?.name ?? "Formula 1";
  const year = response.leagues[0]?.season?.year ?? new Date().getFullYear();
  const tournamentName = `${leagueName} ${year}`;

  // Use events array if available (has richer data)
  const events = response.events ?? [];
  if (events.length > 0) {
    for (const event of events) {
      const statusType = event.status?.type;
      const status = mapStatus(statusType?.state, statusType?.description);

      // For F1, teamA/teamB don't apply the same way — use event name
      // We map the GP as: teamA = GP name, teamB = circuit location
      const circuit = event.circuit;
      const venue = [circuit?.address?.city, circuit?.address?.country].filter(Boolean).join(", ");

      // Find the race competition (the main event, not practices/quali)
      const raceComp = event.competitions?.find((c) => {
        const abbr = c.type?.abbreviation?.toUpperCase() ?? "";
        return abbr === "RACE" || abbr === "R";
      });
      const mainComp = raceComp ?? event.competitions?.[event.competitions.length - 1];

      // Build result from top competitors
      let result: string | null = null;
      let scoreSummary: string | null = null;
      if (mainComp?.competitors && status === "completed") {
        const sorted = [...mainComp.competitors].sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
        const top3 = sorted.slice(0, 3).map((c, i) =>
          `P${i + 1}: ${c.athlete?.displayName ?? "Unknown"}`
        );
        result = top3.join(", ");
        scoreSummary = result;
      }

      matches.push({
        id: `espn-f1-${event.id}`,
        teamA: event.name.replace(/Grand Prix/i, "GP"),
        teamB: circuit?.fullName ?? (venue || "TBA"),
        sport: "f1",
        format: "Race",
        tournamentName,
        time: formatTime(event.date),
        date: formatDate(event.date),
        venue: circuit?.fullName ?? (venue || null),
        status,
        scoreSummary,
        tossWinner: null,
        tossDecision: null,
        result,
        sourceUrl: null,
      });
    }
  }

  // Also use calendar entries for future races not in events array
  const eventIds = new Set(events.map((e) => e.id));
  for (const league of response.leagues) {
    for (const cal of league.calendar ?? []) {
      // Extract event ID from $ref URL if available
      const refUrl = cal.event?.["$ref"] ?? "";
      const refMatch = refUrl.match(/events\/(\d+)/);
      const eventId = refMatch?.[1];

      // Skip if we already have this event from the events array
      if (eventId && eventIds.has(eventId)) continue;

      matches.push({
        id: `espn-f1-cal-${eventId ?? cal.label.replace(/\s+/g, "-").toLowerCase()}`,
        teamA: cal.label.replace(/Grand Prix/i, "GP"),
        teamB: "TBA",
        sport: "f1",
        format: "Race",
        tournamentName,
        time: formatTime(cal.startDate),
        date: formatDate(cal.startDate),
        venue: null,
        status: "upcoming",
        scoreSummary: null,
        tossWinner: null,
        tossDecision: null,
        result: null,
        sourceUrl: null,
      });
    }
  }

  log.info({ count: matches.length }, "Mapped ESPN F1 matches");
  return matches;
}
