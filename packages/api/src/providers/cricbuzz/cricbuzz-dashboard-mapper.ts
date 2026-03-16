/**
 * Maps Cricbuzz scraped data → DraftPlay AI types.
 * Handles tournaments, matches, and standings.
 */

import type {
  AITournament,
  AIMatch,
  AIMatchStatus,
  AITeamStanding,
  TournamentCategory,
} from "@draftplay/shared";
import type {
  CricbuzzScheduleEntry,
  CricbuzzLiveMatch,
  RscMatchEntry,
  RscPointsTableEntry,
  RscPointsTableData,
  CricbuzzSeriesListing,
} from "./cricbuzz-client";

// ---------------------------------------------------------------------------
// Category inference (same logic as ESPN mapper)
// ---------------------------------------------------------------------------

function inferCategory(name: string): TournamentCategory {
  const n = name.toLowerCase();

  if (
    n.includes("ipl") || n.includes("bbl") || n.includes("psl") || n.includes("cpl") ||
    n.includes("hundred") || n.includes("bpl") || n.includes("sa20") || n.includes("ilt20") ||
    n.includes("premier league") || n.includes("super league") || n.includes("big bash") ||
    n.includes("legends league") || n.includes("llc") || n.includes("mpl") ||
    n.includes("major league cricket") || n.includes("mlc")
  ) {
    return "league";
  }
  if (
    n.includes("world cup") || n.includes("champions trophy") || n.includes("icc") ||
    n.includes("asia cup") || n.includes("wtc")
  ) {
    return "international";
  }
  if (n.includes("tour of") || n.includes("in ") || /\bv\b|\bvs\b/.test(n)) {
    return "bilateral";
  }
  if (n.includes("qualifier") || n.includes("qualif")) {
    return "qualifier";
  }
  if (
    n.includes("shield") || n.includes("ranji") || n.includes("domestic") ||
    n.includes("national") || n.includes("provincial") || n.includes("county") ||
    n.includes("first-class") || n.includes("one-day cup") ||
    n.includes("t20 blast") || n.includes("vitality blast")
  ) {
    return "domestic";
  }
  return "international";
}

/**
 * Check if a tournament should be included.
 * Filters out: women's tournaments, minor bilateral (non-top-8 nations),
 * sub-regional qualifiers, domestic, and obscure events.
 */
export function shouldIncludeTournament(name: string): boolean {
  const n = name.toLowerCase();

  // Always exclude women's tournaments (for now)
  if (n.includes("women") || n.includes("woman")) return false;

  // Exclude "A" team / Lions tours
  if (/\b[a-z]+ a\b/.test(n) || n.includes("lions")) return false;

  // Exclude sub-regional qualifiers (keep main qualifiers)
  if (n.includes("sub regional") || n.includes("sub-regional")) return false;

  // Exclude invitational / minor tournaments
  if (n.includes("invitational")) return false;

  // Exclude postponed tournaments
  if (n.includes("postponed")) return false;

  const category = inferCategory(name);

  // For bilateral series, only include top cricket nations
  if (category === "bilateral") {
    const topNations = [
      "india", "australia", "england", "south africa", "new zealand",
      "pakistan", "sri lanka", "west indies", "bangladesh", "afghanistan",
    ];
    const hasTopNation = topNations.some((nation) => n.includes(nation));
    if (!hasTopNation) return false;
  }

  return category === "international" || category === "league" || category === "bilateral" || category === "qualifier";
}

// ---------------------------------------------------------------------------
// Format inference
// ---------------------------------------------------------------------------

function inferFormat(desc: string): string {
  const lower = desc.toLowerCase();
  if (lower.includes("t20") || lower.includes("twenty20")) return "T20";
  if (lower.includes("odi") || lower.includes("one day") || lower.includes("50-over")) return "ODI";
  if (lower.includes("test") || lower.includes("first-class") || lower.includes("first class")) return "Test";
  // Default to T20 for league matches
  return "T20";
}

// ---------------------------------------------------------------------------
// Status mapping
// ---------------------------------------------------------------------------

function mapMatchState(state: string, statusText: string): AIMatchStatus {
  const s = state.toLowerCase();
  const t = statusText.toLowerCase();

  // Check abandoned FIRST — state "abandon" or status containing "abandon"
  if (s === "abandon" || t.includes("abandon")) {
    return "abandoned";
  }
  if (s === "in progress" || s === "live" || t.includes("need") || t.includes("trail") || t.includes("lead") || t.includes("break") || t.includes("stumps")) {
    return "live";
  }
  if (s === "complete" || t.includes("won") || t.includes("draw") || t.includes("tied") || t.includes("match drawn")) {
    return "completed";
  }
  if (t.includes("delayed") || t.includes("rain") || t.includes("no play")) {
    return "delayed";
  }
  return "upcoming";
}

// ---------------------------------------------------------------------------
// Date/time formatting
// ---------------------------------------------------------------------------

function formatDateFromTimestamp(tsMs: string | number): string {
  try {
    const ts = typeof tsMs === "string" ? parseInt(tsMs, 10) : tsMs;
    const d = new Date(ts);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "";
  }
}

function formatTimeFromTimestamp(tsMs: string | number): string {
  try {
    const ts = typeof tsMs === "string" ? parseInt(tsMs, 10) : tsMs;
    const d = new Date(ts);
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata",
    }) + " IST";
  } catch {
    return "";
  }
}

function formatIsoDate(tsMs: string | number): string | null {
  try {
    const ts = typeof tsMs === "string" ? parseInt(tsMs, 10) : tsMs;
    return new Date(ts).toISOString().split("T")[0]!;
  } catch {
    return null;
  }
}

/**
 * Clean a series/tournament name — strip "(Postponed)", trailing year, trailing comma.
 * Year is stripped so names stay clean for users (e.g. "Indian Premier League").
 * Tournament linking uses externalId (cb-{seriesId}), not name.
 */
function cleanSeriesName(name: string): string {
  return name
    .replace(/\s*\(Postponed\)\s*/gi, " ")
    .replace(/\s*\d{4}(-\d{2,4})?\s*$/, "")
    .replace(/,\s*$/, "")
    .trim();
}

/**
 * Normalize Cricbuzz team name (they use UPPERCASE).
 */
function normalizeTeamName(name: string): string {
  // "KOLKATA KNIGHT RIDERS" → "Kolkata Knight Riders"
  return name
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Format score from RSC innings data.
 */
function formatInningsScore(innings?: { runs: number; wickets: number; overs: number }): string | null {
  if (!innings) return null;
  if (innings.wickets === 10) return `${innings.runs} (${innings.overs})`;
  return `${innings.runs}-${innings.wickets} (${innings.overs})`;
}

// ---------------------------------------------------------------------------
// Date parsing with year inference
// ---------------------------------------------------------------------------

/**
 * Extract year from a series/tournament name.
 * Handles: "IPL 2026", "England tour of India, 2026-27", "ICC T20 World Cup 2026"
 */
function extractYearFromName(name: string): number | null {
  // Match "2025", "2026", "2027" etc.
  const yearMatch = name.match(/\b(20\d{2})\b/);
  return yearMatch ? parseInt(yearMatch[1]!, 10) : null;
}

/**
 * Parse a date string like "Mar 14" or "4 Oct 2025" into an ISO date.
 * If the date has no year, infers it from the series name or defaults to current year.
 */
function parseDateWithYear(dateStr: string, inferredYear: number | null): string | null {
  try {
    const trimmed = dateStr.trim();
    // Check if the date already has a year (e.g., "4 Oct 2025")
    const hasYear = /\b20\d{2}\b/.test(trimmed);
    if (hasYear) {
      const d = new Date(trimmed);
      if (!isNaN(d.getTime())) return d.toISOString().split("T")[0]!;
    }

    // No year — append the inferred year
    const year = inferredYear ?? new Date().getFullYear();
    const d = new Date(`${trimmed} ${year}`);
    if (!isNaN(d.getTime())) return d.toISOString().split("T")[0]!;

    return null;
  } catch {
    return null;
  }
}

/**
 * Parse a date range like "Mar 14 - May 30" using year inference from series name.
 */
function parseDateRange(
  dateRange: string | null,
  seriesName: string
): { startDate: string | null; endDate: string | null } {
  if (!dateRange) return { startDate: null, endDate: null };

  const inferredYear = extractYearFromName(seriesName);
  const parts = dateRange.split(" - ");

  const startDate = parts[0] ? parseDateWithYear(parts[0], inferredYear) : null;

  // For end date, if the series spans year boundary (e.g., "2026-27"),
  // try using the second year
  let endYear = inferredYear;
  const yearRangeMatch = seriesName.match(/\b(20\d{2})[-–](2\d|20\d{2})\b/);
  if (yearRangeMatch) {
    const secondPart = yearRangeMatch[2]!;
    endYear = secondPart.length === 2
      ? parseInt(`20${secondPart}`, 10)
      : parseInt(secondPart, 10);
  }

  const endDate = parts[1] ? parseDateWithYear(parts[1], endYear) : null;

  return { startDate, endDate };
}

// ---------------------------------------------------------------------------
// Public mappers
// ---------------------------------------------------------------------------

/**
 * Map a schedule entry to an AITournament.
 */
export function mapScheduleEntryToTournament(entry: CricbuzzScheduleEntry): AITournament {
  const { startDate, endDate } = parseDateRange(entry.dateRange, entry.seriesName);

  const name = cleanSeriesName(entry.seriesName);
  return {
    id: `cb-${entry.seriesId}`,
    name,
    sport: "cricket",
    category: inferCategory(name),
    startDate,
    endDate,
    imageUrl: null,
    sourceUrl: `https://www.cricbuzz.com/cricket-series/${entry.seriesId}/${entry.seriesSlug}/matches`,
    description: name,
  };
}

/**
 * Map a series listing to an AITournament.
 */
export function mapSeriesListingToTournament(listing: CricbuzzSeriesListing): AITournament {
  const { startDate, endDate } = parseDateRange(listing.dateRange, listing.seriesName);
  const name = cleanSeriesName(listing.seriesName);

  return {
    id: `cb-${listing.seriesId}`,
    name,
    sport: "cricket",
    category: inferCategory(name),
    startDate,
    endDate,
    imageUrl: null,
    sourceUrl: `https://www.cricbuzz.com/cricket-series/${listing.seriesId}/${listing.seriesSlug}/matches`,
    description: name,
  };
}

/**
 * Map an RSC match entry to an AIMatch.
 */
export function mapRscMatchToAIMatch(entry: RscMatchEntry): AIMatch {
  const { matchInfo, matchScore } = entry;
  const status = mapMatchState(matchInfo.state, matchInfo.status);

  // Build score summary
  let scoreSummary: string | null = null;
  const team1Name = normalizeTeamName(matchInfo.team1.teamName);
  const team2Name = normalizeTeamName(matchInfo.team2.teamName);

  if (matchScore) {
    const parts: string[] = [];
    const t1i1 = formatInningsScore(matchScore.team1Score?.inngs1);
    const t1i2 = formatInningsScore(matchScore.team1Score?.inngs2);
    const t2i1 = formatInningsScore(matchScore.team2Score?.inngs1);
    const t2i2 = formatInningsScore(matchScore.team2Score?.inngs2);

    if (t1i1) {
      let t1Score = t1i1;
      if (t1i2) t1Score += ` & ${t1i2}`;
      parts.push(`${matchInfo.team1.teamSName}: ${t1Score}`);
    }
    if (t2i1) {
      let t2Score = t2i1;
      if (t2i2) t2Score += ` & ${t2i2}`;
      parts.push(`${matchInfo.team2.teamSName}: ${t2Score}`);
    }
    if (parts.length > 0) scoreSummary = parts.join(" | ");
  }

  // Result for completed matches
  let result: string | null = null;
  if (status === "completed" && matchInfo.status) {
    result = matchInfo.status;
  }

  const venue = matchInfo.venueInfo
    ? `${matchInfo.venueInfo.ground}, ${matchInfo.venueInfo.city}`
    : null;

  return {
    id: `cb-match-${matchInfo.matchId}`,
    teamA: team1Name,
    teamB: team2Name,
    sport: "cricket",
    format: matchInfo.matchFormat || inferFormat(matchInfo.matchDesc),
    tournamentName: cleanSeriesName(matchInfo.seriesName),
    tournamentExternalId: matchInfo.seriesId ? `cb-${matchInfo.seriesId}` : undefined,
    time: formatTimeFromTimestamp(matchInfo.startDate),
    date: formatDateFromTimestamp(matchInfo.startDate),
    venue,
    status,
    scoreSummary,
    tossWinner: null,
    tossDecision: null,
    result,
    sourceUrl: `https://www.cricbuzz.com/live-cricket-scores/${matchInfo.matchId}`,
  };
}

/**
 * Map a live match card to an AIMatch.
 */
export function mapLiveMatchToAIMatch(match: CricbuzzLiveMatch): AIMatch {
  const status: AIMatchStatus = match.statusType === "live" ? "live"
    : match.statusType === "completed" ? "completed"
    : "upcoming";

  let scoreSummary: string | null = null;
  if (match.teamAScore || match.teamBScore) {
    const parts: string[] = [];
    if (match.teamAScore) parts.push(`${match.teamAShort || match.teamA}: ${match.teamAScore}`);
    if (match.teamBScore) parts.push(`${match.teamBShort || match.teamB}: ${match.teamBScore}`);
    scoreSummary = parts.join(" | ");
  }

  return {
    id: `cb-match-${match.matchId}`,
    teamA: match.teamA,
    teamB: match.teamB,
    sport: "cricket",
    format: inferFormat(match.matchDesc),
    tournamentName: cleanSeriesName(match.seriesName),
    tournamentExternalId: match.seriesId ? `cb-${match.seriesId}` : undefined,
    time: "",
    date: "",
    venue: match.venue,
    status,
    scoreSummary,
    tossWinner: null,
    tossDecision: null,
    result: status === "completed" ? match.statusText : null,
    sourceUrl: `https://www.cricbuzz.com/live-cricket-scores/${match.matchId}`,
  };
}

/**
 * Map RSC points table data to AITeamStanding[].
 */
export function mapRscPointsTableToStandings(data: RscPointsTableData): AITeamStanding[] {
  const standings: AITeamStanding[] = [];

  for (const group of data.pointsTable) {
    const groupName = group.groupName === "Teams" ? null : group.groupName;

    group.pointsTableInfo.forEach((entry, index) => {
      standings.push({
        position: index + 1,
        team: entry.teamFullName,
        played: entry.matchesPlayed,
        won: entry.matchesWon,
        lost: entry.matchesLost,
        tied: entry.matchesTied,
        noResult: entry.noRes,
        points: entry.points,
        netRunRate: entry.nrr,
        group: groupName,
      });
    });
  }

  return standings;
}
