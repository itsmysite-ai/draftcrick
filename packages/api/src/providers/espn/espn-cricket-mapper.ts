/**
 * Maps ESPN cricket scoreboard JSON to DraftPlay AI types.
 * ESPN endpoint: /apis/personalized/v2/scoreboard/header?sport=cricket
 */

import type { AITournament, AIMatch, AIMatchStatus, TournamentCategory } from "@draftplay/shared";
import type { ESPNCricketScoreboard } from "./espn-schemas";
import { getLogger } from "../../lib/logger";

const log = getLogger("espn-cricket-mapper");

// ---------------------------------------------------------------------------
// Status mapping
// ---------------------------------------------------------------------------

function mapStatus(espnStatus?: string, stateStr?: string): AIMatchStatus {
  const status = (espnStatus ?? "").toLowerCase();
  const state = (stateStr ?? "").toLowerCase();

  if (state === "in" || status.includes("progress") || status === "live" || status.includes("stumps") || status.includes("innings break") || status.includes("day")) {
    return "live";
  }
  if (state === "post" || status.includes("result") || status.includes("final") || status.includes("won") || status.includes("draw") || status.includes("tied")) {
    return "completed";
  }
  if (status.includes("delayed") || status.includes("rain") || status.includes("no play")) {
    return "delayed";
  }
  if (status.includes("abandon")) {
    return "abandoned";
  }
  return "upcoming";
}

// ---------------------------------------------------------------------------
// Category inference from league name/slug
// ---------------------------------------------------------------------------

function inferCategory(name: string, slug?: string): TournamentCategory {
  const n = (name + " " + (slug ?? "")).toLowerCase();

  if (n.includes("ipl") || n.includes("bbl") || n.includes("psl") || n.includes("cpl") ||
      n.includes("hundred") || n.includes("bpl") || n.includes("sa20") || n.includes("ilt20") ||
      n.includes("premier league") || n.includes("super league") || n.includes("big bash")) {
    return "league";
  }
  if (n.includes("world cup") || n.includes("champions trophy") || n.includes("icc") ||
      n.includes("asia cup") || n.includes("wtc")) {
    return "international";
  }
  if (n.includes("tour of") || n.includes("in ")) {
    return "bilateral";
  }
  if (n.includes("qualifier") || n.includes("qualif")) {
    return "qualifier";
  }
  if (n.includes("shield") || n.includes("trophy") || n.includes("cup") ||
      n.includes("domestic") || n.includes("national") || n.includes("provincial")) {
    return "domestic";
  }
  return "international";
}

// ---------------------------------------------------------------------------
// Format inference from match description/notes
// ---------------------------------------------------------------------------

function inferFormat(notes?: Array<{ text?: string; type?: string }>, description?: string): string {
  const allText = [
    ...(notes?.map((n) => n.text).filter(Boolean) ?? []),
    description ?? "",
  ].join(" ").toLowerCase();

  if (allText.includes("t20") || allText.includes("twenty20")) return "T20";
  if (allText.includes("odi") || allText.includes("50-over") || allText.includes("one day")) return "ODI";
  if (allText.includes("test") || allText.includes("first-class") || allText.includes("first class")) return "Test";
  return "T20"; // default
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
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" }) + " IST";
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Public mappers
// ---------------------------------------------------------------------------

export function mapESPNCricketTournaments(response: ESPNCricketScoreboard): AITournament[] {
  const tournaments: AITournament[] = [];
  const seen = new Set<string>();

  for (const sport of response.sports) {
    for (const league of sport.leagues ?? []) {
      if (seen.has(league.id)) continue;
      seen.add(league.id);

      // Derive start/end from events or smartdates
      let startDate: string | null = null;
      let endDate: string | null = null;

      const events = league.events ?? [];
      if (events.length > 0) {
        const dates = events.map((e) => e.date).filter(Boolean).sort();
        startDate = dates[0] ? dates[0].split("T")[0]! : null;
        const endDates = events.map((e) => e.endDate ?? e.date).filter(Boolean).sort();
        endDate = endDates[endDates.length - 1]?.split("T")[0] ?? null;
      } else if (league.smartdates && league.smartdates.length > 0) {
        const sorted = [...league.smartdates].sort();
        startDate = sorted[0]?.split("T")[0] ?? null;
        endDate = sorted[sorted.length - 1]?.split("T")[0] ?? null;
      }

      // Get ESPN link for sourceUrl
      const link = events[0]?.links?.find((l) => l.rel?.includes("serieshome"))?.href ?? null;

      tournaments.push({
        id: `espn-cricket-${league.id}`,
        name: league.name,
        sport: "cricket",
        category: inferCategory(league.name, league.slug),
        startDate,
        endDate,
        imageUrl: null,
        sourceUrl: link,
        description: league.abbreviation ?? league.name,
      });
    }
  }

  log.info({ count: tournaments.length }, "Mapped ESPN cricket tournaments");
  return tournaments;
}

export function mapESPNCricketMatches(response: ESPNCricketScoreboard): AIMatch[] {
  const matches: AIMatch[] = [];

  for (const sport of response.sports) {
    for (const league of sport.leagues ?? []) {
      for (const event of league.events ?? []) {
        const competitors = event.competitors ?? [];
        if (competitors.length < 2) continue;

        const home = competitors.find((c) => c.homeAway === "home") ?? competitors[0]!;
        const away = competitors.find((c) => c.homeAway === "away") ?? competitors[1]!;

        const statusType = event.fullStatus?.type;
        const status = mapStatus(statusType?.description, statusType?.state);

        // Build score summary from competitor scores
        let scoreSummary: string | null = null;
        const homeScore = home.score?.trim();
        const awayScore = away.score?.trim();
        if (homeScore || awayScore) {
          const parts: string[] = [];
          if (homeScore) parts.push(`${home.displayName}: ${homeScore}`);
          if (awayScore) parts.push(`${away.displayName}: ${awayScore}`);
          scoreSummary = parts.join(" | ");
        }

        // Extract result from status detail
        let result: string | null = null;
        const detail = statusType?.detail ?? "";
        if (status === "completed" && detail && detail !== "Final" && detail !== "Result") {
          result = detail;
        }

        // Get match link for sourceUrl
        const matchLink = event.links?.find((l) => l.rel?.includes("summary") || l.rel?.includes("boxscore"))?.href ?? null;

        matches.push({
          id: `espn-cricket-${event.id}`,
          teamA: home.displayName,
          teamB: away.displayName,
          sport: "cricket",
          format: inferFormat(event.notes, event.description),
          tournamentName: league.name,
          time: formatTime(event.date),
          date: formatDate(event.date),
          venue: event.location ?? null,
          status,
          scoreSummary,
          tossWinner: null, // ESPN scoreboard header doesn't include toss
          tossDecision: null,
          result,
          sourceUrl: matchLink,
        });
      }
    }
  }

  log.info({ count: matches.length }, "Mapped ESPN cricket matches");
  return matches;
}
