/**
 * Cricbuzz HTTP client.
 * Fetches HTML pages from cricbuzz.com and parses with cheerio.
 * Also extracts RSC (React Server Component) JSON payloads for structured data.
 */

import * as cheerio from "cheerio";
import { getLogger } from "../../lib/logger";

const log = getLogger("cricbuzz-client");

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
  Connection: "keep-alive",
};

const BASE_URL = "https://www.cricbuzz.com";
const REQUEST_DELAY_MS = 300; // Courtesy delay between requests
const REQUEST_TIMEOUT_MS = 15_000;

let lastRequestTime = 0;

async function courtesyDelay(): Promise<void> {
  const elapsed = Date.now() - lastRequestTime;
  if (elapsed < REQUEST_DELAY_MS) {
    await new Promise((r) => setTimeout(r, REQUEST_DELAY_MS - elapsed));
  }
}

/**
 * Fetch raw HTML from a Cricbuzz page.
 */
export async function fetchRawHtml(path: string): Promise<string> {
  await courtesyDelay();
  const url = path.startsWith("http") ? path : `${BASE_URL}${path}`;

  log.debug({ url }, "Fetching Cricbuzz page (raw)");
  const start = Date.now();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: HEADERS,
      signal: controller.signal,
    });
    lastRequestTime = Date.now();

    if (!response.ok) {
      throw new Error(`Cricbuzz returned ${response.status} for ${url}`);
    }

    const html = await response.text();
    const durationMs = Date.now() - start;
    log.debug({ url, durationMs, size: html.length }, "Cricbuzz page fetched (raw)");

    return html;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fetch a Cricbuzz page and return a cheerio instance.
 */
export async function fetchPage(path: string): Promise<cheerio.CheerioAPI> {
  const html = await fetchRawHtml(path);
  return cheerio.load(html);
}

// ---------------------------------------------------------------------------
// RSC JSON extraction — Cricbuzz embeds data in Next.js RSC payloads
// ---------------------------------------------------------------------------

/**
 * Extract a JSON object from Cricbuzz RSC payload by searching for a key name.
 * Cricbuzz uses `self.__next_f.push()` with JSON data embedded as strings.
 */
export function extractRscJson<T = unknown>(html: string, jsonKey: string): T | null {
  // Strategy: find the key name in the HTML and extract the JSON object around it.
  // Cricbuzz RSC payloads may embed the data in two ways:
  // 1. Unescaped: "matchesData":{"matchDetails":[...]}
  // 2. Escaped (inside a JSON string): \"matchesData\":{\"matchDetails\":[...]}
  // We try unescaped first, then escaped.

  const unescapedKey = `"${jsonKey}"`;
  const escapedKey = `\\"${jsonKey}\\"`;

  let keyIndex = html.indexOf(unescapedKey);
  let isEscaped = false;
  let keyLen = unescapedKey.length;

  if (keyIndex === -1) {
    keyIndex = html.indexOf(escapedKey);
    if (keyIndex === -1) {
      log.debug({ jsonKey }, "RSC key not found in page");
      return null;
    }
    isEscaped = true;
    keyLen = escapedKey.length;
  }

  if (isEscaped) {
    // Data is inside a JSON string with escaped quotes: \"matchesData\":{\"key\":\"val\",...}
    // Braces/brackets are NOT escaped, only quotes are (\" instead of ").
    const colonIdx = html.indexOf(":", keyIndex + keyLen);
    if (colonIdx === -1) return null;

    const startIdx = colonIdx + 1;
    const firstChar = html.charAt(startIdx);
    if (firstChar !== "{" && firstChar !== "[") return null;

    const openChar = firstChar;
    const closeChar = openChar === "{" ? "}" : "]";
    let depth = 0;
    let inStr = false;

    for (let i = startIdx; i < html.length; i++) {
      const ch = html.charAt(i);

      // Handle escaped quote toggle: \"
      if (ch === "\\" && html.charAt(i + 1) === '"') {
        inStr = !inStr;
        i++; // skip the quote
        continue;
      }
      if (inStr) continue;

      if (ch === openChar) depth++;
      else if (ch === closeChar) {
        depth--;
        if (depth === 0) {
          const raw = html.slice(startIdx, i + 1);
          // Unescape: \" → ", \\\\ → \\, \\/ → /
          const unescaped = raw.replace(/\\"/g, '"').replace(/\\\\/g, "\\").replace(/\\\//g, "/");
          try {
            return JSON.parse(unescaped) as T;
          } catch (err) {
            log.warn({ jsonKey, error: err instanceof Error ? err.message : String(err), snippet: unescaped.slice(0, 100) }, "Failed to parse escaped RSC JSON");
            return null;
          }
        }
      }
    }

    return null;
  }

  // Unescaped path — original logic
  const valueStart = html.indexOf(":", keyIndex + keyLen);
  if (valueStart === -1) return null;

  const firstChar = html.charAt(valueStart + 1);
  if (firstChar !== "{" && firstChar !== "[") return null;

  const openChar = firstChar;
  const closeChar = openChar === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = valueStart + 1; i < html.length; i++) {
    const ch = html.charAt(i);

    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (ch === openChar) depth++;
    else if (ch === closeChar) {
      depth--;
      if (depth === 0) {
        const jsonStr = html.slice(valueStart + 1, i + 1);
        try {
          return JSON.parse(jsonStr) as T;
        } catch (err) {
          log.warn({ jsonKey, error: err instanceof Error ? err.message : String(err) }, "Failed to parse RSC JSON");
          return null;
        }
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Team name → Cricbuzz ID mapping
// ---------------------------------------------------------------------------

interface CricbuzzTeam {
  slug: string;
  id: number;
}

/**
 * Known team mappings. Covers international teams and major T20 leagues.
 * Key is the lowercase team name (as it appears in our DB from ESPN).
 */
const TEAM_MAP: Record<string, CricbuzzTeam> = {
  // International teams
  india: { slug: "india", id: 2 },
  pakistan: { slug: "pakistan", id: 3 },
  australia: { slug: "australia", id: 4 },
  "sri lanka": { slug: "sri-lanka", id: 5 },
  bangladesh: { slug: "bangladesh", id: 6 },
  "united arab emirates": { slug: "united-arab-emirates", id: 7 },
  "hong kong": { slug: "hong-kong-china", id: 8 },
  england: { slug: "england", id: 9 },
  "west indies": { slug: "west-indies", id: 10 },
  "south africa": { slug: "south-africa", id: 11 },
  zimbabwe: { slug: "zimbabwe", id: 12 },
  "new zealand": { slug: "new-zealand", id: 13 },
  kenya: { slug: "kenya", id: 14 },
  usa: { slug: "united-states-of-america", id: 15 },
  "united states": { slug: "united-states-of-america", id: 15 },
  "united states of america": { slug: "united-states-of-america", id: 15 },
  scotland: { slug: "scotland", id: 23 },
  netherlands: { slug: "netherlands", id: 24 },
  bermuda: { slug: "bermuda", id: 25 },
  canada: { slug: "canada", id: 26 },
  ireland: { slug: "ireland", id: 27 },
  uganda: { slug: "uganda", id: 44 },
  nepal: { slug: "nepal", id: 72 },
  afghanistan: { slug: "afghanistan", id: 96 },
  namibia: { slug: "namibia", id: 161 },
  oman: { slug: "oman", id: 304 },

  // IPL teams
  "chennai super kings": { slug: "chennai-super-kings", id: 58 },
  csk: { slug: "chennai-super-kings", id: 58 },
  "royal challengers bengaluru": { slug: "royal-challengers-bengaluru", id: 59 },
  "royal challengers bangalore": { slug: "royal-challengers-bengaluru", id: 59 },
  rcb: { slug: "royal-challengers-bengaluru", id: 59 },
  "delhi capitals": { slug: "delhi-capitals", id: 61 },
  dc: { slug: "delhi-capitals", id: 61 },
  "mumbai indians": { slug: "mumbai-indians", id: 62 },
  mi: { slug: "mumbai-indians", id: 62 },
  "kolkata knight riders": { slug: "kolkata-knight-riders", id: 63 },
  kkr: { slug: "kolkata-knight-riders", id: 63 },
  "rajasthan royals": { slug: "rajasthan-royals", id: 64 },
  rr: { slug: "rajasthan-royals", id: 64 },
  "punjab kings": { slug: "punjab-kings", id: 65 },
  pbks: { slug: "punjab-kings", id: 65 },
  "sunrisers hyderabad": { slug: "sunrisers-hyderabad", id: 255 },
  srh: { slug: "sunrisers-hyderabad", id: 255 },
  "lucknow super giants": { slug: "lucknow-super-giants", id: 966 },
  lsg: { slug: "lucknow-super-giants", id: 966 },
  "gujarat titans": { slug: "gujarat-titans", id: 971 },
  gt: { slug: "gujarat-titans", id: 971 },
};

/**
 * Resolve a team name to its Cricbuzz slug and ID.
 * Returns null if the team is not in our mapping.
 */
export function resolveTeam(teamName: string): CricbuzzTeam | null {
  const lower = teamName.toLowerCase().trim();
  return TEAM_MAP[lower] ?? null;
}

// ---------------------------------------------------------------------------
// Page parsers
// ---------------------------------------------------------------------------

export interface CricbuzzPlayerLink {
  profileId: string;
  slug: string;
  name: string;
}

/**
 * Parse the /cricket-team/{slug}/{id}/players page to extract player profile links.
 */
export function parseTeamPlayersPage($: cheerio.CheerioAPI): CricbuzzPlayerLink[] {
  const players: CricbuzzPlayerLink[] = [];
  const seen = new Set<string>();

  $('a[href*="/profiles/"]').each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const match = href.match(/\/profiles\/(\d+)\/(.+)/);
    if (!match) return;

    const profileId = match[1]!;
    const slug = match[2]!;
    if (seen.has(profileId)) return;
    seen.add(profileId);

    // Derive name from slug (best effort — will be overwritten from profile page)
    const name = slug
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c: string) => c.toUpperCase());

    players.push({ profileId, slug, name });
  });

  return players;
}

// ---------------------------------------------------------------------------
// Series resolution — map tournament name → Cricbuzz series ID
// ---------------------------------------------------------------------------

export interface CricbuzzSeries {
  slug: string;
  id: number;
}

/**
 * In-memory cache of discovered series from schedule pages.
 * Populated by parseSchedulePage, used by fetchStandings.
 */
const discoveredSeries = new Map<string, CricbuzzSeries>();

export function cacheSeriesMapping(name: string, series: CricbuzzSeries): void {
  discoveredSeries.set(name.toLowerCase().trim(), series);
}

export function resolveSeries(tournamentName: string): CricbuzzSeries | null {
  const key = tournamentName.toLowerCase().trim();

  // Exact match
  const exact = discoveredSeries.get(key);
  if (exact) return exact;

  // Try matching with/without trailing year (e.g., "ICC Men's T20 World Cup" vs "ICC Men's T20 World Cup 2026")
  const stripped = key.replace(/\s*\d{4}(-\d{2,4})?\s*$/, "").trim();
  for (const [name, series] of discoveredSeries) {
    const nameStripped = name.replace(/\s*\d{4}(-\d{2,4})?\s*$/, "").trim();
    if (nameStripped === stripped || nameStripped === key || name === stripped) {
      return series;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Schedule page parser — /cricket-schedule/upcoming-series/{type}
// ---------------------------------------------------------------------------

export interface CricbuzzScheduleEntry {
  seriesId: number;
  seriesSlug: string;
  seriesName: string;
  dateRange: string | null; // e.g., "Oct 04 - Mar 29"
  category: "international" | "league";
  matches: CricbuzzScheduleMatch[];
}

export interface CricbuzzScheduleMatch {
  matchId: number;
  matchSlug: string;
  title: string; // e.g., "Team A vs Team B, 1st T20I"
  venue: string | null;
  dateStr: string | null; // e.g., "WED, MAR 11 2026"
}

/**
 * Parse a schedule page to extract series and match listings.
 * Works for both /international and /league.
 */
export function parseSchedulePage($: cheerio.CheerioAPI, category: "international" | "league"): CricbuzzScheduleEntry[] {
  const entries: CricbuzzScheduleEntry[] = [];
  // Track entries by seriesId — prefer entries with dateRange over those without
  // (schedule pages have a live header section with abbreviated names and no dates,
  //  followed by the actual schedule with proper names and date ranges)
  const entryBySeriesId = new Map<number, number>(); // seriesId → index in entries
  let currentDate = "";

  // Process the main content area
  const html = $.html() ?? "";

  // Find series links in the format /cricket-series/{id}/{slug}/matches
  $('a[href*="/cricket-series/"]').each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const seriesMatch = href.match(/\/cricket-series\/(\d+)\/([^/]+)/);
    if (!seriesMatch) return;

    const seriesId = parseInt(seriesMatch[1]!, 10);
    const seriesSlug = seriesMatch[2]!;

    // Get series name from the element text or title
    const title = $(el).attr("title") ?? "";
    let seriesName = $(el).text().trim();

    // Clean up — remove "Matches" suffix from title attribute
    if (title) {
      const titleMatch = title.match(/^(.+?)\s+Matches/i);
      if (titleMatch?.[1]) seriesName = titleMatch[1].trim();
    }

    if (!seriesName) return;

    // Skip postponed series — check raw name/slug before cleaning
    if (/postponed/i.test(seriesName) || /postponed/i.test(seriesSlug)) return;

    // Extract date range — pattern: "Mon DD - Mon DD" or "DD Mon YYYY - DD Mon YYYY"
    let dateRange: string | null = null;
    // Try full date format first: "4 Oct 2025 - 29 Mar 2026"
    const fullDateMatch = (title || seriesName).match(/(\d{1,2}\s\w+\s\d{4})\s*[-–]\s*(\d{1,2}\s\w+\s\d{4})/);
    if (fullDateMatch) {
      dateRange = `${fullDateMatch[1]} - ${fullDateMatch[2]}`;
    } else {
      // Try short date: "Mar 14 - May 30" or "Mar 14 – May 30"
      const shortDateMatch = (title || seriesName).match(/([A-Z][a-z]{2}\s\d{1,2})\s*[-–]\s*([A-Z][a-z]{2}\s\d{1,2})/);
      if (shortDateMatch) {
        dateRange = `${shortDateMatch[1]} - ${shortDateMatch[2]}`;
      }
    }

    // Strip trailing date patterns from series name
    // Handles: "Indian Premier League 2027Mar 14 - May 30" → "Indian Premier League 2027"
    // Also: "England tour of South Africa, 2026-27Dec 17 - Jan 15" → "England tour of South Africa, 2026-27"
    seriesName = seriesName
      .replace(/[A-Z][a-z]{2}\s?\d{1,2}\s*[-–]\s*[A-Z][a-z]{2}\s?\d{1,2}.*$/, "")  // "Mar 14 - May 30"
      .replace(/\d{1,2}\s[A-Z][a-z]{2}\s\d{4}\s*[-–].*$/, "")                        // "4 Oct 2025 - ..."
      .replace(/\s*\(Postponed\)\s*/i, " ")                                            // "(Postponed)"
      .replace(/,\s*$/, "")                                                            // trailing comma
      .trim();

    // Cache the series mapping for later use
    cacheSeriesMapping(seriesName, { slug: seriesSlug, id: seriesId });

    const newEntry: CricbuzzScheduleEntry = {
      seriesId,
      seriesSlug,
      seriesName,
      dateRange,
      category,
      matches: [],
    };

    // If we already have an entry for this seriesId, prefer the one with dateRange
    const existingIdx = entryBySeriesId.get(seriesId);
    if (existingIdx !== undefined) {
      const existing = entries[existingIdx]!;
      // Replace only if new entry has dateRange and existing doesn't
      if (dateRange && !existing.dateRange) {
        entries[existingIdx] = newEntry;
      }
      return;
    }

    entryBySeriesId.set(seriesId, entries.length);
    entries.push(newEntry);
  });

  // Now find match links within the page
  $('a[href*="/live-cricket-scores/"]').each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const matchMatch = href.match(/\/live-cricket-scores\/(\d+)\/(.+)/);
    if (!matchMatch) return;

    const matchId = parseInt(matchMatch[1]!, 10);
    const matchSlug = matchMatch[2]!;
    const matchTitle = $(el).attr("title") ?? $(el).text().trim();

    // Find venue text nearby
    const venue = $(el).find(".text-cbTextGrayDark, .text-xs.text-cbTxtSec").first().text().trim() || null;

    // Try to associate with a series
    // Look for parent/sibling series header
    const parentBlock = $(el).closest("div");
    const seriesLink = parentBlock.prevAll('a[href*="/cricket-series/"]').first();
    const seriesHref = seriesLink.attr("href") ?? "";
    const parentSeriesMatch = seriesHref.match(/\/cricket-series\/(\d+)\//);

    if (parentSeriesMatch) {
      const seriesId = parseInt(parentSeriesMatch[1]!, 10);
      const entry = entries.find((e) => e.seriesId === seriesId);
      if (entry) {
        entry.matches.push({ matchId, matchSlug, title: matchTitle, venue, dateStr: currentDate });
      }
    }
  });

  log.info({ category, seriesCount: entries.length }, "Parsed Cricbuzz schedule page");
  return entries;
}

// ---------------------------------------------------------------------------
// Live scores page parser — /cricket-match/live-scores
// ---------------------------------------------------------------------------

export interface CricbuzzLiveMatch {
  matchId: number;
  matchSlug: string;
  seriesId: number | null;
  seriesName: string;
  teamA: string;
  teamAShort: string;
  teamAScore: string | null;
  teamB: string;
  teamBShort: string;
  teamBScore: string | null;
  statusText: string;
  statusType: "live" | "completed" | "upcoming";
  matchDesc: string; // "1st T20I", "13th Match", etc.
  venue: string | null;
  category: string; // "INTERNATIONAL", "LEAGUE", "DOMESTIC", "WOMEN"
}

/**
 * Parse the live scores page to extract match cards.
 */
export function parseLiveScoresPage($: cheerio.CheerioAPI): CricbuzzLiveMatch[] {
  const matches: CricbuzzLiveMatch[] = [];
  const seenMatches = new Set<number>();
  let currentSeries = "";
  let currentSeriesId: number | null = null;
  let currentCategory = "";

  // Process match cards in the main content
  // Series headers contain links to /cricket-series/{id}/{slug}/matches
  $("a").each((_, el) => {
    const href = $(el).attr("href") ?? "";

    // Track series headers
    const seriesMatch = href.match(/\/cricket-series\/(\d+)\/([^/]+)/);
    if (seriesMatch) {
      currentSeriesId = parseInt(seriesMatch[1]!, 10);
      currentSeries = ($(el).find("span").first().text().trim() || $(el).text().trim())
        .replace(/[A-Z][a-z]{2}\s?\d{1,2}\s*[-–]\s*[A-Z][a-z]{2}\s?\d{1,2}.*$/, "")
        .replace(/\d{1,2}\s[A-Z][a-z]{2}\s\d{4}\s*[-–].*$/, "")
        .replace(/\s*\(Postponed\)\s*/i, " ")
        .replace(/,\s*$/, "")
        .trim();

      // Cache series mapping
      if (currentSeries && currentSeriesId) {
        cacheSeriesMapping(currentSeries, { slug: seriesMatch[2]!, id: currentSeriesId });
      }
      return;
    }

    // Track match cards
    const matchMatch = href.match(/\/live-cricket-scores\/(\d+)\/(.+)/);
    if (!matchMatch) return;

    const matchId = parseInt(matchMatch[1]!, 10);
    if (seenMatches.has(matchId)) return;
    seenMatches.add(matchId);

    const matchSlug = matchMatch[2]!;
    const title = $(el).attr("title") ?? "";

    // Extract team names and scores from the card structure
    // Teams are in spans with text-cbTxtPrim or text-cbTxtSec classes
    const teamSpans = $(el).find("span[class*='text-cbTxt']");
    const teamNames: string[] = [];
    const teamScores: string[] = [];

    // Desktop full names (hidden wb:block)
    $(el).find("span.hidden.wb\\:block, span[class*='wb:block']").each((_, span) => {
      const text = $(span).text().trim();
      if (text && !text.includes("Live Score") && !text.includes("Scorecard")) {
        teamNames.push(text);
      }
    });

    // Scores — look for spans with score-like content (runs-wickets format)
    $(el).find("span[class*='font-medium'], span[class*='font-semibold']").each((_, span) => {
      const text = $(span).text().trim();
      if (text && /\d/.test(text)) {
        teamScores.push(text);
      }
    });

    // Fallback: parse team names from title "Team A vs Team B, Match Desc - Status"
    let teamA = teamNames[0] ?? "";
    let teamB = teamNames[1] ?? "";
    let matchDesc = "";

    if (title) {
      const titleParts = title.match(/^(.+?)\s+vs\s+(.+?),\s*(.+?)(?:\s*-\s*(.+))?$/i);
      if (titleParts) {
        if (!teamA) teamA = titleParts[1]!.trim();
        if (!teamB) teamB = titleParts[2]!.trim();
        matchDesc = titleParts[3]?.trim() ?? "";
      }
    }

    // Status text — look for status spans
    let statusText = "";
    let statusType: "live" | "completed" | "upcoming" = "upcoming";

    $(el).find("span[class*='text-cbLive']").each((_, span) => {
      statusText = $(span).text().trim();
      statusType = "live";
    });

    if (!statusText) {
      $(el).find("span[class*='text-cbComplete']").each((_, span) => {
        statusText = $(span).text().trim();
        statusType = "completed";
      });
    }

    // Extract match description from the info line
    const infoLine = $(el).find("span.text-xs.text-cbTxtSec").first().text().trim();
    const venue = infoLine ? infoLine.replace(/^\d+\w+\s+Match\s*\.\s*/, "").trim() : null;

    if (!matchDesc && infoLine) {
      const descMatch = infoLine.match(/^([\w\d]+\s+(?:Match|T20I|ODI|Test))/i);
      if (descMatch) matchDesc = descMatch[1]!;
    }

    matches.push({
      matchId,
      matchSlug,
      seriesId: currentSeriesId,
      seriesName: currentSeries,
      teamA,
      teamAShort: "",
      teamAScore: teamScores[0] ?? null,
      teamB,
      teamBShort: "",
      teamBScore: teamScores[1] ?? null,
      statusText,
      statusType,
      matchDesc,
      venue,
      category: currentCategory,
    });
  });

  log.info({ matchCount: matches.length }, "Parsed Cricbuzz live scores page");
  return matches;
}

// ---------------------------------------------------------------------------
// RSC JSON interfaces — structured data from series/points pages
// ---------------------------------------------------------------------------

export interface RscMatchInfo {
  matchId: number;
  seriesId: number;
  seriesName: string;
  matchDesc: string;
  matchFormat: string;
  startDate: string; // Unix timestamp ms as string
  endDate: string;
  state: string; // "complete", "Complete", "Preview", "Upcoming", "In Progress"
  status: string; // Human-readable result/status
  team1: {
    teamId: number;
    teamName: string; // UPPERCASE
    teamSName: string;
    imageId: number;
  };
  team2: {
    teamId: number;
    teamName: string;
    teamSName: string;
    imageId: number;
  };
  venueInfo?: {
    ground: string;
    city: string;
    timezone: string;
  };
  currBatTeamId?: number;
  isTimeAnnounced?: boolean;
}

export interface RscInningsScore {
  inningsId: number;
  runs: number;
  wickets: number;
  overs: number;
}

export interface RscMatchScore {
  team1Score?: {
    inngs1?: RscInningsScore;
    inngs2?: RscInningsScore;
  };
  team2Score?: {
    inngs1?: RscInningsScore;
    inngs2?: RscInningsScore;
  };
}

export interface RscMatchEntry {
  matchInfo: RscMatchInfo;
  matchScore?: RscMatchScore;
}

export interface RscMatchesData {
  matchDetails: Array<{
    matchDetailsMap?: {
      key: string;
      match: RscMatchEntry[];
      seriesId: number;
    };
    adDetail?: unknown;
  }>;
}

export interface RscPointsTableEntry {
  teamFullName: string;
  teamName: string; // short name
  teamId: number;
  matchesPlayed: number;
  matchesWon: number;
  matchesLost: number;
  matchesTied: number;
  noRes: number;
  matchesDrawn: number;
  nrr: string; // "+0.372"
  points: number;
}

export interface RscPointsTableData {
  seriesId: number;
  seriesName: string;
  match_type: string;
  pointsTable: Array<{
    groupName: string;
    no_of_qual: number;
    pointsTableInfo: RscPointsTableEntry[];
  }>;
}

/**
 * Fetch basic series info (name, slug, dates) from a Cricbuzz series page.
 * Only needs seriesId — Cricbuzz handles slug resolution.
 * Used to resolve abbreviated names from the live scores page.
 */
export async function fetchSeriesInfo(seriesId: number): Promise<{
  name: string;
  slug: string;
  dateRange: string | null;
} | null> {
  try {
    // Fetch the series page — Cricbuzz serves it even without slug
    const html = await fetchRawHtml(`/cricket-series/${seriesId}`);
    const $ = cheerio.load(html);

    // Extract series name from <title> tag: "Australia Women tour of West Indies, 2026 | Cricbuzz.com"
    const title = $("title").text().trim();
    const nameFromTitle = title
      .replace(/\s*\|\s*Cricbuzz\.com.*$/i, "")
      .replace(/\s*-\s*Cricbuzz.*$/i, "")
      .trim();

    // Extract slug from canonical URL or og:url
    const canonicalUrl = $('link[rel="canonical"]').attr("href")
      || $('meta[property="og:url"]').attr("content")
      || "";
    const slugMatch = canonicalUrl.match(/cricket-series\/\d+\/([^/]+)/);
    const slug = slugMatch?.[1] ?? seriesId.toString();

    // Try to find date range from the page (usually in a subtitle or breadcrumb)
    // Common patterns: "Mar 19 - Apr 02, 2026" in the series header area
    let dateRange: string | null = null;

    // Look for date pattern in page content — Cricbuzz shows dates in series header
    const headerText = $("h1").parent().text() || $(".cb-col-100").first().text() || "";
    const datePattern = headerText.match(
      /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s*(?:,?\s*\d{4})?\s*-\s*\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s*(?:,?\s*\d{4})?)/i
    );
    if (datePattern) {
      dateRange = datePattern[1]!;
    }

    if (!nameFromTitle || nameFromTitle.length < 3) return null;

    log.info({ seriesId, name: nameFromTitle, slug, dateRange }, "Fetched series info from Cricbuzz");
    return { name: nameFromTitle, slug, dateRange };
  } catch (err) {
    log.warn({ seriesId, error: err instanceof Error ? err.message : String(err) }, "Failed to fetch series info");
    return null;
  }
}

/**
 * Fetch series matches using RSC JSON extraction.
 */
export async function fetchSeriesMatches(seriesId: number, seriesSlug: string): Promise<RscMatchesData | null> {
  const html = await fetchRawHtml(`/cricket-series/${seriesId}/${seriesSlug}/matches`);
  return extractRscJson<RscMatchesData>(html, "matchesData");
}

/**
 * Fetch points table using RSC JSON extraction.
 */
export async function fetchPointsTable(seriesId: number, seriesSlug: string): Promise<RscPointsTableData | null> {
  const html = await fetchRawHtml(`/cricket-series/${seriesId}/${seriesSlug}/points-table`);
  return extractRscJson<RscPointsTableData>(html, "pointsTableData");
}

/**
 * Fetch toss info from a Cricbuzz match page.
 * The match commentary/info page RSC JSON has tossResults data.
 */
export async function fetchMatchToss(
  matchId: number,
  matchSlug: string,
  expectedTeams?: [string, string]
): Promise<{ tossWinner: string; tossDecision: string } | null> {
  try {
    const html = await fetchRawHtml(`/live-cricket-scores/${matchId}/${matchSlug}`);

    // Helper: validate that toss winner is one of the expected teams
    const isValidTossWinner = (winner: string): boolean => {
      if (!expectedTeams) return true;
      const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
      const w = norm(winner);
      return expectedTeams.some(t => {
        const n = norm(t);
        return w.includes(n) || n.includes(w);
      });
    };

    // Try extracting tossResults from RSC JSON
    const tossResults = extractRscJson<{
      tossWinnerName?: string; decision?: string;
    }>(html, "tossResults");

    if (tossResults?.tossWinnerName && tossResults?.decision) {
      if (isValidTossWinner(tossResults.tossWinnerName)) {
        log.info({ matchId, tossWinner: tossResults.tossWinnerName, decision: tossResults.decision, method: "rsc-tossResults" }, "Toss extracted");
        return {
          tossWinner: tossResults.tossWinnerName,
          tossDecision: tossResults.decision.toLowerCase().includes("bat") ? "bat" : "bowl",
        };
      }
      log.warn({ matchId, tossWinner: tossResults.tossWinnerName, expectedTeams }, "Toss winner doesn't match expected teams, skipping");
    }

    // Try matchInfo.tossResults
    const matchInfo = extractRscJson<{
      tossResults?: { tossWinnerName?: string; decision?: string };
    }>(html, "matchInfo");

    const toss = matchInfo?.tossResults;
    if (toss?.tossWinnerName && toss?.decision) {
      if (isValidTossWinner(toss.tossWinnerName)) {
        log.info({ matchId, tossWinner: toss.tossWinnerName, decision: toss.decision, method: "rsc-matchInfo" }, "Toss extracted");
        return {
          tossWinner: toss.tossWinnerName,
          tossDecision: toss.decision.toLowerCase().includes("bat") ? "bat" : "bowl",
        };
      }
      log.warn({ matchId, tossWinner: toss.tossWinnerName, expectedTeams }, "Toss winner from matchInfo doesn't match expected teams, skipping");
    }

    // Fallback: parse toss from HTML text — only match expected team names
    const tossRegex = /(?:Toss|toss)\s*[-:]\s*(.+?)\s+(?:won.*?(?:opt|elected|chose)\s+to\s+(bat|bowl|field))/i;
    const htmlMatch = html.match(tossRegex);
    if (htmlMatch && isValidTossWinner(htmlMatch[1]!.trim())) {
      log.info({ matchId, tossWinner: htmlMatch[1]!.trim(), method: "html-regex" }, "Toss extracted");
      return {
        tossWinner: htmlMatch[1]!.trim(),
        tossDecision: htmlMatch[2]!.toLowerCase() === "bat" ? "bat" : "bowl",
      };
    }

    // Fallback 2: simpler pattern
    const simpleRegex = /(\w[\w\s]+?)\s+(?:won the toss|opt(?:ed)?)\s+(?:and\s+)?(?:elected\s+)?to\s+(bat|bowl|field)/i;
    const simpleMatch = html.match(simpleRegex);
    if (simpleMatch && isValidTossWinner(simpleMatch[1]!.trim())) {
      log.info({ matchId, tossWinner: simpleMatch[1]!.trim(), method: "html-simple" }, "Toss extracted");
      return {
        tossWinner: simpleMatch[1]!.trim(),
        tossDecision: simpleMatch[2]!.toLowerCase() === "bat" ? "bat" : "bowl",
      };
    }

    log.warn({ matchId, matchSlug, expectedTeams }, "No valid toss data found on match page");
    return null;
  } catch (err) {
    log.warn({ matchId, error: err instanceof Error ? err.message : String(err) }, "Failed to fetch toss info");
    return null;
  }
}

// ---------------------------------------------------------------------------
// Scorecard parser — extract playing XI from match scorecard RSC data
// ---------------------------------------------------------------------------

export interface ScorecardPlayer {
  id: number;
  name: string;
  teamName: string;
  teamShortName: string;
  isCaptain: boolean;
  isKeeper: boolean;
}

export interface PlayingXIPlayer {
  cricbuzzId: number;
  name: string;
  role: string;
  isCaptain: boolean;
  isKeeper: boolean;
  isSubstitute: boolean;
  teamName: string;
  faceImageId?: number;
}

export interface PlayingXIResult {
  team1: { name: string; shortName: string; players: PlayingXIPlayer[] };
  team2: { name: string; shortName: string; players: PlayingXIPlayer[] };
  hasToss: boolean;
  tossWinner: string | null;
  tossDecision: string | null;
}

/**
 * Fetch playing XI data from a Cricbuzz match page.
 * Parses playerDetails arrays for both teams, filtering out coaching staff.
 * Returns confirmed XI when toss has happened, predicted XI before toss.
 * Use `hasToss` to determine if the XI is confirmed.
 */
export async function fetchPlayingXI(cricbuzzMatchId: number): Promise<PlayingXIResult | null> {
  try {
    const html = await fetchRawHtml(`/live-cricket-scores/${cricbuzzMatchId}`);
    // Unescape RSC-encoded JSON
    const unescaped = html.replace(/\\"/g, '"');

    // Find playerDetails arrays for both teams
    const teams: Array<{ name: string; shortName: string; players: PlayingXIPlayer[] }> = [];
    let searchIdx = 0;

    while (teams.length < 2) {
      const pdIdx = unescaped.indexOf('"playerDetails":[{"id"', searchIdx);
      if (pdIdx === -1) break;

      // Find team name before playerDetails
      const nameIdx = unescaped.lastIndexOf('"name":"', pdIdx);
      const shortIdx = unescaped.lastIndexOf('"shortName":"', pdIdx);
      const teamName = nameIdx > -1 ? unescaped.slice(nameIdx + 8, unescaped.indexOf('"', nameIdx + 8)) : "Unknown";
      const shortName = shortIdx > -1 ? unescaped.slice(shortIdx + 13, unescaped.indexOf('"', shortIdx + 13)) : teamName;

      // Parse the JSON array
      const arrStart = unescaped.indexOf('[', pdIdx);
      let depth = 0;
      let arrEnd = arrStart;
      for (let i = arrStart; i < Math.min(arrStart + 20000, unescaped.length); i++) {
        if (unescaped[i] === '[') depth++;
        else if (unescaped[i] === ']') depth--;
        if (depth === 0) { arrEnd = i + 1; break; }
      }

      try {
        const rawPlayers = JSON.parse(unescaped.slice(arrStart, arrEnd));
        // Filter out coaching staff: actual players have captain as boolean (not null/undefined)
        const players: PlayingXIPlayer[] = rawPlayers
          .filter((p: any) => p.captain !== null && p.captain !== undefined)
          .map((p: any) => ({
            cricbuzzId: p.id,
            name: p.name,
            role: p.role ?? "Unknown",
            isCaptain: !!p.captain,
            isKeeper: !!p.keeper,
            isSubstitute: !!p.substitute,
            teamName: p.teamName ?? shortName,
            faceImageId: p.faceImageId,
          }));

        teams.push({ name: teamName, shortName, players });
      } catch {
        log.warn({ cricbuzzMatchId }, "Failed to parse playerDetails array");
      }

      searchIdx = pdIdx + 1;
    }

    if (teams.length < 2) {
      log.warn({ cricbuzzMatchId, teamsFound: teams.length }, "Could not find 2 teams with playerDetails");
      return null;
    }

    // Check for toss results
    const tossMatch = unescaped.match(/"tossResults":\s*\{[^}]*"decision"\s*:\s*"([^"]+)"/);
    const tossStatusMatch = unescaped.match(/(\w[\w\s]+?)\s+(?:opt|elected|chose)\s+to\s+(bat|bowl|field)/i);
    const hasToss = !!tossMatch || !!tossStatusMatch;
    const tossWinner = tossStatusMatch ? tossStatusMatch[1]!.trim() : null;
    const tossDecision = tossStatusMatch ? tossStatusMatch[2]!.toLowerCase() : (tossMatch ? tossMatch[1]!.toLowerCase() : null);

    const xi1 = teams[0]!.players.filter((p) => !p.isSubstitute).length;
    const xi2 = teams[1]!.players.filter((p) => !p.isSubstitute).length;
    log.info({ cricbuzzMatchId, team1: teams[0]!.shortName, xi1, team2: teams[1]!.shortName, xi2, hasToss }, "Fetched playing XI");

    return { team1: teams[0]!, team2: teams[1]!, hasToss, tossWinner, tossDecision };
  } catch (err: any) {
    log.error({ cricbuzzMatchId, err: err.message }, "Failed to fetch playing XI");
    return null;
  }
}

/**
 * Fetch the playing XI from a Cricbuzz match scorecard page.
 * Returns the players who actually appeared in the match (batsmen + bowlers from all innings).
 * Only works for completed/in-progress matches that have scorecard data.
 */
export async function fetchScorecardPlayers(cricbuzzMatchId: number): Promise<ScorecardPlayer[]> {
  const html = await fetchRawHtml(`/live-cricket-scorecard/${cricbuzzMatchId}`);

  // Extract scoreCard array from RSC data
  const scoreCard = extractRscJson<Array<{
    inningsId: number;
    batTeamDetails?: {
      batTeamName: string;
      batTeamShortName: string;
      batsmenData?: Record<string, {
        batId: number;
        batName: string;
        isCaptain: boolean;
        isKeeper: boolean;
      }>;
    };
    bowlTeamDetails?: {
      bowlTeamName: string;
      bowlTeamShortName: string;
      bowlersData?: Record<string, {
        bowlerId: number;
        bowlName: string;
      }>;
    };
  }>>(html, "scoreCard");

  if (!scoreCard || scoreCard.length === 0) {
    log.warn({ cricbuzzMatchId }, "No scoreCard data found on scorecard page");
    return [];
  }

  const playersById = new Map<number, ScorecardPlayer>();

  for (const innings of scoreCard) {
    // Collect batsmen
    if (innings.batTeamDetails?.batsmenData) {
      for (const bat of Object.values(innings.batTeamDetails.batsmenData)) {
        if (!playersById.has(bat.batId)) {
          playersById.set(bat.batId, {
            id: bat.batId,
            name: bat.batName,
            teamName: innings.batTeamDetails.batTeamName,
            teamShortName: innings.batTeamDetails.batTeamShortName,
            isCaptain: bat.isCaptain,
            isKeeper: bat.isKeeper,
          });
        }
      }
    }

    // Collect bowlers
    if (innings.bowlTeamDetails?.bowlersData) {
      for (const bowl of Object.values(innings.bowlTeamDetails.bowlersData)) {
        if (!playersById.has(bowl.bowlerId)) {
          playersById.set(bowl.bowlerId, {
            id: bowl.bowlerId,
            name: bowl.bowlName,
            teamName: innings.bowlTeamDetails.bowlTeamName,
            teamShortName: innings.bowlTeamDetails.bowlTeamShortName,
            isCaptain: false,
            isKeeper: false,
          });
        }
      }
    }
  }

  log.info({ cricbuzzMatchId, playerCount: playersById.size }, "Extracted playing XI from scorecard");
  return [...playersById.values()];
}

// ---------------------------------------------------------------------------
// Scorecard stats parser — extract full player performance stats
// ---------------------------------------------------------------------------

export interface ScorecardPlayerStats {
  cricbuzzId: number;
  name: string;
  teamName: string;
  // Batting
  runs: number;
  ballsFaced: number;
  fours: number;
  sixes: number;
  isDismissed: boolean; // true if batter was out (not "batting"/"not out")
  // Bowling
  oversBowled: number;
  runsConceded: number;
  wickets: number;
  maidens: number;
  // Fielding (parsed from dismissal descriptions)
  catches: number;
  stumpings: number;
  runOuts: number;
}

/**
 * Fetch live match score directly from a Cricbuzz scorecard page using the match ID.
 * This bypasses the series listing (which can be cached/stale) and gets real-time data.
 */
export async function fetchMatchScoreById(cricbuzzMatchId: number): Promise<{
  scoreSummary: string | null;
  status: string | null;
  result: string | null;
  tossWinner: string | null;
  tossDecision: string | null;
} | null> {
  try {
    const html = await fetchRawHtml(`/live-cricket-scorecard/${cricbuzzMatchId}`);

    // Try extracting matchHeader which has match status and score
    const matchHeader = extractRscJson<{
      matchId: number;
      state: string;
      status: string;
      team1: { name: string; shortName: string };
      team2: { name: string; shortName: string };
      tossResults?: { tossWinnerId: number; decision: string };
      result?: { resultType: string; winningTeam: string; winningMargin: number; winByInnings: boolean; winByRuns: boolean };
    }>(html, "matchHeader");

    // Extract scoreCard for building score summary
    const scoreCard = extractRscJson<Array<{
      inningsId: number;
      scoreDetails?: { runs: number; wickets: number; overs: number };
      batTeamDetails?: { batTeamShortName: string };
    }>>(html, "scoreCard");

    if (!matchHeader && !scoreCard) {
      log.warn({ cricbuzzMatchId }, "No matchHeader or scoreCard found on scorecard page");
      return null;
    }

    // Build score summary from scoreCard innings
    let scoreSummary: string | null = null;
    if (scoreCard && scoreCard.length > 0) {
      const parts: string[] = [];
      // Group innings by team
      const teamInnings = new Map<string, string[]>();
      for (const innings of scoreCard) {
        const teamName = innings.batTeamDetails?.batTeamShortName ?? `Team${innings.inningsId}`;
        const sd = innings.scoreDetails;
        if (sd) {
          const inStr = `${sd.runs}/${sd.wickets} (${sd.overs})`;
          const existing = teamInnings.get(teamName) || [];
          existing.push(inStr);
          teamInnings.set(teamName, existing);
        }
      }
      for (const [team, innings] of teamInnings) {
        parts.push(`${team} ${innings.join(" & ")}`);
      }
      if (parts.length > 0) scoreSummary = parts.join(" vs ");
    }

    // Determine status
    let status: string | null = null;
    if (matchHeader) {
      const state = matchHeader.state?.toLowerCase();
      if (state === "complete" || state === "completed") status = "completed";
      else if (state === "in progress") status = "live";
    }
    // If no matchHeader or state not recognized, infer from scoreCard presence
    if (!status && scoreCard && scoreCard.length > 0) {
      // Has active scorecard data → must be live or completed
      status = "live";
    }

    // Result
    let result: string | null = null;
    if (status === "completed" && matchHeader?.status) {
      result = matchHeader.status;
    }

    // Toss
    let tossWinner: string | null = null;
    let tossDecision: string | null = null;
    if (matchHeader?.tossResults) {
      const tossTeamId = matchHeader.tossResults.tossWinnerId;
      // Match toss winner to team names
      // The tossWinnerId should match team1.id or team2.id, but we only have names
      // Check status string for toss info as fallback
      const tossMatch = matchHeader.status?.match(/(\w[\w\s]+?)\s+(?:opt|elected|chose)\s+to\s+(bat|bowl|field)/i);
      if (tossMatch) {
        tossWinner = tossMatch[1]!.trim();
        tossDecision = tossMatch[2]!.toLowerCase() === "bat" ? "bat" : "bowl";
      } else {
        tossDecision = matchHeader.tossResults.decision?.toLowerCase() || null;
      }
    }

    log.info({ cricbuzzMatchId, status, scoreSummary, result }, "fetchMatchScoreById complete");
    return { scoreSummary, status, result, tossWinner, tossDecision };
  } catch (err: any) {
    log.error({ cricbuzzMatchId, err: err.message }, "Failed to fetch match score by ID");
    return null;
  }
}

/**
 * Fetch full player performance stats from a Cricbuzz match scorecard page.
 * Parses batting stats, bowling stats, and fielding (from dismissal text).
 * Stats are accumulated across innings (for Tests / multi-innings matches).
 */
export async function fetchScorecardStats(cricbuzzMatchId: number): Promise<ScorecardPlayerStats[]> {
  const html = await fetchRawHtml(`/live-cricket-scorecard/${cricbuzzMatchId}`);

  const scoreCard = extractRscJson<Array<{
    inningsId: number;
    batTeamDetails?: {
      batTeamName: string;
      batTeamShortName: string;
      batsmenData?: Record<string, {
        batId: number;
        batName: string;
        runs: number;
        balls: number;
        fours: number;
        sixes: number;
        strikeRate: number;
        outDesc: string;
        isCaptain: boolean;
        isKeeper: boolean;
      }>;
    };
    bowlTeamDetails?: {
      bowlTeamName: string;
      bowlTeamShortName: string;
      bowlersData?: Record<string, {
        bowlerId: number;
        bowlName: string;
        overs: number;
        maidens: number;
        runs: number;
        wickets: number;
        economy: number;
        noBalls: number;
        wides: number;
      }>;
    };
  }>>(html, "scoreCard");

  if (!scoreCard || scoreCard.length === 0) {
    log.warn({ cricbuzzMatchId }, "No scoreCard data found for stats extraction");
    return [];
  }

  // Accumulate stats per player (keyed by cricbuzzId)
  const statsMap = new Map<number, ScorecardPlayerStats>();

  const getOrCreate = (id: number, name: string, teamName: string): ScorecardPlayerStats => {
    let s = statsMap.get(id);
    if (!s) {
      s = { cricbuzzId: id, name, teamName, runs: 0, ballsFaced: 0, fours: 0, sixes: 0, isDismissed: false, oversBowled: 0, runsConceded: 0, wickets: 0, maidens: 0, catches: 0, stumpings: 0, runOuts: 0 };
      statsMap.set(id, s);
    }
    return s;
  };

  // Collect all player names → cricbuzzId for fielding attribution
  const playerNameToId = new Map<string, number>();

  // First pass: collect all player identities
  for (const innings of scoreCard) {
    if (innings.batTeamDetails?.batsmenData) {
      for (const bat of Object.values(innings.batTeamDetails.batsmenData)) {
        playerNameToId.set(bat.batName.toLowerCase(), bat.batId);
      }
    }
    if (innings.bowlTeamDetails?.bowlersData) {
      for (const bowl of Object.values(innings.bowlTeamDetails.bowlersData)) {
        playerNameToId.set(bowl.bowlName.toLowerCase(), bowl.bowlerId);
      }
    }
  }

  // Second pass: extract batting + bowling stats
  for (const innings of scoreCard) {
    // Batting stats
    if (innings.batTeamDetails?.batsmenData) {
      const teamName = innings.batTeamDetails.batTeamName;
      for (const bat of Object.values(innings.batTeamDetails.batsmenData)) {
        const s = getOrCreate(bat.batId, bat.batName, teamName);
        s.runs += bat.runs || 0;
        s.ballsFaced += bat.balls || 0;
        s.fours += bat.fours || 0;
        s.sixes += bat.sixes || 0;

        // Track dismissal — "batting", "not out", or empty means still at crease
        const outDesc = (bat.outDesc || "").toLowerCase().trim();
        if (outDesc && outDesc !== "batting" && outDesc !== "not out" && outDesc !== "dnb") {
          s.isDismissed = true;
        }

        // Parse fielding from dismissal description
        parseFieldingCredit(bat.outDesc, playerNameToId, statsMap, innings.bowlTeamDetails?.bowlTeamName || "");
      }
    }

    // Bowling stats
    if (innings.bowlTeamDetails?.bowlersData) {
      const teamName = innings.bowlTeamDetails.bowlTeamName;
      for (const bowl of Object.values(innings.bowlTeamDetails.bowlersData)) {
        const s = getOrCreate(bowl.bowlerId, bowl.bowlName, teamName);
        s.oversBowled += bowl.overs || 0;
        s.runsConceded += bowl.runs || 0;
        s.wickets += bowl.wickets || 0;
        s.maidens += bowl.maidens || 0;
      }
    }
  }

  log.info({ cricbuzzMatchId, playerCount: statsMap.size }, "Extracted scorecard stats");
  return [...statsMap.values()];
}

/**
 * Parse fielding credit from a batsman's dismissal description.
 * Examples:
 *   "c Fielder b Bowler" => catch to Fielder
 *   "c & b Bowler" => catch to Bowler (caught and bowled)
 *   "st Keeper b Bowler" => stumping to Keeper
 *   "run out (Fielder)" => run out to Fielder
 *   "run out (Fielder1/Fielder2)" => run out to Fielder1
 */
function parseFieldingCredit(
  outDesc: string | null | undefined,
  playerNameToId: Map<string, number>,
  statsMap: Map<number, ScorecardPlayerStats>,
  fieldingTeamName: string
) {
  if (!outDesc || outDesc === "not out" || outDesc === "batting" || outDesc === "yet to bat") return;

  const desc = outDesc.trim();

  // "c & b BowlerName" — caught and bowled
  const cAndB = desc.match(/^c\s*&\s*b\s+(.+)/i);
  if (cAndB) {
    const fielderId = findPlayerId(cAndB[1]!.trim(), playerNameToId);
    if (fielderId !== null) {
      const s = statsMap.get(fielderId);
      if (s) s.catches++;
    }
    return;
  }

  // "c FielderName b BowlerName" — caught by fielder
  const caught = desc.match(/^c\s+(.+?)\s+b\s+/i);
  if (caught) {
    const fielderId = findPlayerId(caught[1]!.trim(), playerNameToId);
    if (fielderId !== null) {
      const s = statsMap.get(fielderId);
      if (s) s.catches++;
    }
    return;
  }

  // "st KeeperName b BowlerName" — stumped by keeper
  const stumped = desc.match(/^st\s+(.+?)\s+b\s+/i);
  if (stumped) {
    const fielderId = findPlayerId(stumped[1]!.trim(), playerNameToId);
    if (fielderId !== null) {
      const s = statsMap.get(fielderId);
      if (s) s.stumpings++;
    }
    return;
  }

  // "run out (FielderName)" or "run out (Fielder1/Fielder2)"
  const runOut = desc.match(/run\s+out\s*\(([^)]+)\)/i);
  if (runOut) {
    const fielders = runOut[1]!.split("/");
    // Credit to the first fielder (direct hit)
    const fielderId = findPlayerId(fielders[0]!.trim(), playerNameToId);
    if (fielderId !== null) {
      const s = statsMap.get(fielderId);
      if (s) s.runOuts++;
    }
    return;
  }
}

/** Find player ID by name (fuzzy match against known player names) */
function findPlayerId(name: string, playerNameToId: Map<string, number>): number | null {
  // Strip Cricbuzz special markers: † (keeper), (sub) (substitute fielder)
  const cleaned = name.replace(/[†‡]/g, "").replace(/\(sub\)/gi, "").trim();
  const norm = cleaned.toLowerCase();
  if (!norm) return null;
  // Exact match
  if (playerNameToId.has(norm)) return playerNameToId.get(norm)!;
  // Partial match: Cricbuzz sometimes uses short names like "Rahul" for "KL Rahul"
  for (const [fullName, id] of playerNameToId) {
    if (fullName.endsWith(norm) || fullName.includes(norm) || norm.includes(fullName.split(" ").pop() || "")) {
      return id;
    }
  }
  return null;
}

/**
 * Find the Cricbuzz match ID for a match by searching the series match list.
 * Matches by comparing team names (fuzzy) and start date.
 */
export async function resolveCricbuzzMatchId(
  seriesId: number,
  seriesSlug: string,
  teamHome: string,
  teamAway: string,
  startTime: Date
): Promise<number | null> {
  const matchesData = await fetchSeriesMatches(seriesId, seriesSlug);
  if (!matchesData?.matchDetails) return null;

  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
  const homeNorm = normalize(teamHome);
  const awayNorm = normalize(teamAway);
  const targetDate = startTime.toISOString().slice(0, 10); // YYYY-MM-DD

  for (const detail of matchesData.matchDetails) {
    const entries = detail.matchDetailsMap?.match;
    if (!entries) continue;

    for (const entry of entries) {
      const mi = entry.matchInfo;
      const t1 = normalize(mi.team1.teamName);
      const t2 = normalize(mi.team2.teamName);

      // Check teams match (in either order)
      const teamsMatch =
        (t1.includes(homeNorm) || homeNorm.includes(t1)) &&
        (t2.includes(awayNorm) || awayNorm.includes(t2)) ||
        (t1.includes(awayNorm) || awayNorm.includes(t1)) &&
        (t2.includes(homeNorm) || homeNorm.includes(t2));

      if (!teamsMatch) continue;

      // Check date (within 1 day tolerance)
      const matchDate = new Date(parseInt(mi.startDate, 10));
      const matchDateStr = matchDate.toISOString().slice(0, 10);
      const dayDiff = Math.abs(matchDate.getTime() - startTime.getTime()) / (1000 * 60 * 60 * 24);

      if (matchDateStr === targetDate || dayDiff <= 1) {
        log.info(
          { cricbuzzMatchId: mi.matchId, team1: mi.team1.teamName, team2: mi.team2.teamName, matchDesc: mi.matchDesc },
          "Resolved Cricbuzz match ID"
        );
        return mi.matchId;
      }
    }
  }

  log.warn({ seriesId, teamHome, teamAway, startTime: targetDate }, "Could not resolve Cricbuzz match ID");
  return null;
}

// ---------------------------------------------------------------------------
// Series squad scraper — uses Playwright to get announced tournament squads
// ---------------------------------------------------------------------------

export interface SquadPlayer {
  id: string;
  name: string;
  role: string;
  isCaptain: boolean;
  isKeeper: boolean;
}

/**
 * Fetch the announced tournament squad for a team from Cricbuzz using Playwright.
 * This scrapes the /squads page which requires JavaScript execution.
 * Uses system Chrome (channel: "chrome") to avoid bot detection.
 *
 * @param seriesId - Cricbuzz series ID
 * @param seriesSlug - Cricbuzz series slug for the URL
 * @param teamName - Team name to click on the squads page
 * @returns Array of squad players, or empty if squads not announced / scraping fails
 */
export async function fetchSeriesSquadPlayers(
  seriesId: number,
  seriesSlug: string,
  teamName?: string
): Promise<SquadPlayer[]> {
  let browser;
  try {
    const puppeteer = await import("puppeteer-core");

    // In Docker/Cloud Run, use @sparticuz/chromium; locally, use system Chrome
    let executablePath: string;
    try {
      const chromium = await import("@sparticuz/chromium");
      executablePath = await chromium.default.executablePath();
      log.info("Using @sparticuz/chromium for headless browser");
    } catch {
      // Fallback to system Chrome on macOS for local dev
      const possiblePaths = [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/usr/bin/google-chrome",
        "/usr/bin/chromium-browser",
        "/usr/bin/chromium",
      ];
      executablePath = possiblePaths.find((p) => {
        try { require("fs").accessSync(p); return true; } catch { return false; }
      }) ?? possiblePaths[0];
      log.info({ executablePath }, "Using system Chrome for headless browser");
    }

    browser = await puppeteer.default.launch({
      headless: true,
      executablePath,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-blink-features=AutomationControlled",
        "--single-process",
      ],
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );
    await page.setViewport({ width: 1280, height: 800 });

    // Hide webdriver
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false });
    });

    const url = `https://www.cricbuzz.com/cricket-series/${seriesId}/${seriesSlug}/squads`;
    log.info({ url, teamName }, "Fetching series squad via Puppeteer");

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });

    // Check if blocked
    const title = await page.title();
    if (title.includes("Access Denied")) {
      log.warn({ seriesId }, "Cricbuzz blocked request for squads page");
      return [];
    }

    // Wait for squad data to load (first team is auto-selected)
    await new Promise((r) => setTimeout(r, 4000));

    // If a specific team is requested, click on it
    if (teamName) {
      const teamClicked = await page.evaluate((target: string) => {
        const buttons = document.querySelectorAll('div[class*="cursor-pointer"] span');
        for (const btn of buttons) {
          const text = btn.textContent?.trim() || "";
          if (text.toLowerCase().includes(target.toLowerCase())) {
            (btn as HTMLElement).click();
            return true;
          }
        }
        return false;
      }, teamName);

      if (teamClicked) {
        await new Promise((r) => setTimeout(r, 3000)); // Wait for squad data to reload
      } else {
        log.warn({ teamName, seriesId }, "Team not found on Cricbuzz squads page");
      }
    }

    // Extract players from the rendered DOM
    const players = await page.evaluate(() => {
      const results: Array<{ id: string; name: string; role: string; isCaptain: boolean; isKeeper: boolean }> = [];
      const links = document.querySelectorAll('a[href*="/profiles/"]');
      for (const link of links) {
        const href = link.getAttribute("href") || "";
        const match = href.match(/\/profiles\/(\d+)\/(.+)/);
        if (!match) continue;

        const nameSpan = link.querySelector("span");
        const roleP = link.querySelector("p");
        let rawName = nameSpan?.textContent?.trim() || match[2].replace(/-/g, " ");

        const isCaptain = rawName.includes("(Captain)") || link.innerHTML.includes("(Captain)");
        const isKeeper = rawName.includes("(Keeper)") || link.innerHTML.includes("(Keeper)");
        const name = rawName.replace(/\s*\(Captain\)\s*/g, "").replace(/\s*\(Keeper\)\s*/g, "").trim();

        results.push({
          id: match[1],
          name,
          role: roleP?.textContent?.trim() || "",
          isCaptain,
          isKeeper,
        });
      }
      return results;
    });

    log.info({ seriesId, teamName, playerCount: players.length }, "Squad players extracted via Puppeteer");
    return players;
  } catch (err) {
    log.warn(
      { seriesId, error: err instanceof Error ? err.message : String(err) },
      "Puppeteer squad fetch failed"
    );
    return [];
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// All-series listing parser — /cricket-schedule/series/all
// ---------------------------------------------------------------------------

export interface CricbuzzSeriesListing {
  seriesId: number;
  seriesSlug: string;
  seriesName: string;
  dateRange: string | null;
}

/**
 * Parse the all-series listing page.
 */
export function parseAllSeriesPage($: cheerio.CheerioAPI): CricbuzzSeriesListing[] {
  const listings: CricbuzzSeriesListing[] = [];
  const seen = new Set<number>();

  $('a[href*="/cricket-series/"]').each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const match = href.match(/\/cricket-series\/(\d+)\/([^/]+)/);
    if (!match) return;

    const seriesId = parseInt(match[1]!, 10);
    const seriesSlug = match[2]!;
    if (seen.has(seriesId)) return;
    seen.add(seriesId);

    const title = $(el).attr("title") ?? "";
    let seriesName = $(el).find("div").first().text().trim();

    // Get date range from sibling/child text
    const dateRangeEl = $(el).find(".text-cbTxtSec").first().text().trim();
    let dateRange: string | null = dateRangeEl || null;

    // Also try the title attribute
    if (!seriesName && title) {
      const titleMatch = title.match(/^(.+?)\s+Matches/i);
      if (titleMatch?.[1]) seriesName = titleMatch[1].trim();
    }

    // Fallback: use element text if no div found
    if (!seriesName) {
      seriesName = $(el).text().trim();
    }

    if (!seriesName) return;

    // Skip postponed series
    if (/postponed/i.test(seriesName) || /postponed/i.test(seriesSlug)) return;

    // Strip trailing date patterns from name
    seriesName = seriesName
      .replace(/[A-Z][a-z]{2}\s?\d{1,2}\s*[-–]\s*[A-Z][a-z]{2}\s?\d{1,2}.*$/, "")
      .replace(/\d{1,2}\s[A-Z][a-z]{2}\s\d{4}\s*[-–].*$/, "")
      .replace(/\s*\(Postponed\)\s*/i, " ")
      .replace(/,\s*$/, "")
      .trim();

    // Cache for later resolution
    cacheSeriesMapping(seriesName, { slug: seriesSlug, id: seriesId });

    listings.push({ seriesId, seriesSlug, seriesName, dateRange });
  });

  log.info({ count: listings.length }, "Parsed Cricbuzz all-series page");
  return listings;
}

// ---------------------------------------------------------------------------
// Player page parsers (existing)
// ---------------------------------------------------------------------------

export interface CricbuzzPlayerProfile {
  name: string;
  country: string;
  role: string;
  battingStyle: string | null;
  bowlingStyle: string | null;
  imageUrl: string | null;
  battingStats: Record<string, Record<string, string>>;
  bowlingStats: Record<string, Record<string, string>>;
}

/**
 * Parse a /profiles/{id}/{slug} page to extract player info and stats.
 */
export function parsePlayerProfilePage($: cheerio.CheerioAPI): CricbuzzPlayerProfile {
  // Name from <title> or og:title (format: "Virat Kohli Profile - ICC Ranking... | Cricbuzz.com")
  let name = "Unknown";
  const ogTitle = $('meta[property="og:title"]').attr("content") ?? "";
  const titleText = $("title").text().trim();
  const rawTitle = ogTitle || titleText;
  if (rawTitle) {
    const nameMatch = rawTitle.match(/^(.+?)\s+Profile/i) ?? rawTitle.match(/^(.+?)\s*-/);
    if (nameMatch?.[1]) {
      name = nameMatch[1].trim();
    }
  }

  // Personal info: Role, Batting Style, Bowling Style, Birth Place (as country fallback)
  let role = "";
  let battingStyle: string | null = null;
  let bowlingStyle: string | null = null;
  let country = "";
  let imageUrl: string | null = null;

  // The profile page has label/value pairs in divs
  // Pattern: <div>Label</div><div>Value</div>
  const body = $.html() ?? "";

  const extractField = (label: string): string | null => {
    const regex = new RegExp(
      `${label}\\s*</div>\\s*<div[^>]*>([^<]+)`,
      "i"
    );
    const m = body.match(regex);
    return m && m[1] ? m[1].trim() : null;
  };

  role = extractField("Role") ?? "";
  battingStyle = extractField("Batting Style");
  bowlingStyle = extractField("Bowling Style");
  // Try multiple field names for nationality (Cricbuzz uses "Birth Place" for most players,
  // but some profiles may use "Country" or have no Birth Place at all)
  country = extractField("Birth Place") ?? extractField("Country") ?? extractField("Nationality") ?? "";

  // If Birth Place gave a city (e.g., "Ghazni"), also check the og:description or page text
  // for country indicators. Cricbuzz profile descriptions often include "of [Country]" patterns.
  if (!country) {
    const descMeta = $('meta[property="og:description"]').attr("content") ?? "";
    const countryFromDesc = descMeta.match(/\bfrom\s+(\w[\w\s]+?)(?:\.|,|\s+who|\s+is|\s+plays)/i);
    if (countryFromDesc?.[1]) {
      country = countryFromDesc[1].trim();
    }
  }

  // Image — extract player-specific photo from body images (NOT og:image which is generic)
  // Player photos are in <img> tags with URLs like /i1/c{id}/{slug}.jpg
  $("img").each((_, el) => {
    if (imageUrl) return; // already found
    const src = $(el).attr("src") || "";
    if (src.includes("cricbuzz.com") && src.includes("/i1/c") && !src.includes("30x20")) {
      // Upgrade to high-res: d=low→d=high, p=gthumb→p=de
      imageUrl = src.replace("d=low", "d=high").replace("p=gthumb", "p=de");
    }
  });

  // Parse stats tables
  // Tables are preceded by text like "Batting Career Summary" or "Bowling Career Summary"
  const battingStats: Record<string, Record<string, string>> = {};
  const bowlingStats: Record<string, Record<string, string>> = {};

  $("table").each((_, table) => {
    const rows = $(table).find("tr");
    if (rows.length < 2) return;

    // Get header row to determine format columns (Test, ODI, T20, IPL)
    const headerCells: string[] = [];
    rows.first().find("th, td").each((_, cell) => {
      headerCells.push($(cell).text().trim());
    });

    // Skip ranking tables (Format, Current Rank, Best Rank)
    if (headerCells.includes("Current Rank")) return;

    // Determine if this is batting or bowling by checking context before table
    const tableHtml = $.html(table) ?? "";
    const tableIndex = body.indexOf(tableHtml);
    const contextBefore = tableIndex > 0 ? body.slice(Math.max(0, tableIndex - 200), tableIndex) : "";
    const isBowling = /bowling/i.test(contextBefore);
    const targetStats = isBowling ? bowlingStats : battingStats;

    // Parse data rows
    rows.each((rowIdx, row) => {
      if (rowIdx === 0) return; // Skip header
      const cells: string[] = [];
      $(row).find("th, td").each((_, cell) => {
        cells.push($(cell).text().trim());
      });

      if (cells.length < 2) return;
      const statName = cells[0]!; // e.g., "Matches", "Runs", "Average"

      // Map each format column
      for (let i = 1; i < cells.length && i < headerCells.length; i++) {
        const format = headerCells[i]; // e.g., "Test", "ODI", "T20", "IPL"
        if (!format) continue;
        if (!targetStats[format]) targetStats[format] = {};
        targetStats[format]![statName] = cells[i]!;
      }
    });
  });

  return {
    name,
    country,
    role,
    battingStyle,
    bowlingStyle,
    imageUrl,
    battingStats,
    bowlingStats,
  };
}

// ---------------------------------------------------------------------------
// Team logo extraction from matches page (RSC embedded data)
// ---------------------------------------------------------------------------

export interface CricbuzzTeamInfo {
  name: string;
  shortName: string;
  logoUrl: string | null;
}

/**
 * Extract team names and logo URLs from a Cricbuzz series matches page.
 * Cricbuzz uses React Server Components — team data (including imageId)
 * is embedded in `self.__next_f.push()` script blocks as serialized JSON.
 *
 * The imageId maps to: https://static.cricbuzz.com/a/img/v1/152x152/i1/c{imageId}/{slug}.jpg
 *
 * Strategy:
 * 1. Find the RSC chunk that starts with `[\"$\",\"div\"` and contains
 *    `matchDetailsMap` — this is the actual series match data.
 * 2. Extract teams from `"team1":{...}` and `"team2":{...}` objects
 *    which only appear inside matchInfo structures.
 */
export function parseMatchesPageTeams(html: string): CricbuzzTeamInfo[] {
  const teams = new Map<string, CricbuzzTeamInfo>();

  // Find the RSC chunk containing matchDetailsMap (series match data).
  // It starts like: self.__next_f.push([1,"28:[\"$\",\"div\",...matchDetailsMap..."])
  // We look for the chunk starting with `["$","div"` that has matchDetailsMap in it.
  let source = "";
  const chunkStart = html.indexOf('matchDetailsMap');
  if (chunkStart !== -1) {
    // Go back to find the self.__next_f.push boundary
    const searchBack = html.lastIndexOf('self.__next_f.push', chunkStart);
    if (searchBack !== -1) {
      // Go forward to find the closing of this push — next self.__next_f.push or end
      const nextChunk = html.indexOf('self.__next_f.push', chunkStart);
      source = html.substring(searchBack, nextChunk !== -1 ? nextChunk : undefined);
    }
  }

  // Fallback to full HTML if scoping failed
  if (!source) source = html;

  // Extract team1/team2 objects from match data.
  // Pattern: "team1":{"teamId":59,"teamName":"RCB","teamSName":"RCB","imageId":860056}
  const teamPattern = /team(?:1|2)[\\]*":[\\]*\{[^}]*?teamName[\\]*":[\\]*"([^"\\]+)[\\]*",[\\]*"teamSName[\\]*":[\\]*"([^"\\]+)[\\]*",[\\]*"imageId[\\]*":(\d+)/g;

  let m;
  while ((m = teamPattern.exec(source)) !== null) {
    const name = m[1]!;
    const shortName = m[2]!;
    const imageId = m[3]!;
    if (!teams.has(name)) {
      const slug = name.toLowerCase().replace(/\s+/g, "-");
      teams.set(name, {
        name,
        shortName,
        logoUrl: `https://static.cricbuzz.com/a/img/v1/152x152/i1/c${imageId}/${slug}.jpg`,
      });
    }
  }

  log.info({ count: teams.size }, "Parsed team logos from matches page RSC data");
  return [...teams.values()];
}

/**
 * Fetch team logos from a Cricbuzz series matches page.
 * Works for any series — extracts team imageIds from embedded RSC data.
 */
export async function fetchSeriesTeamLogos(
  seriesId: number,
  seriesSlug: string
): Promise<CricbuzzTeamInfo[]> {
  try {
    const html = await fetchRawHtml(`/cricket-series/${seriesId}/${seriesSlug}/matches`);
    return parseMatchesPageTeams(html);
  } catch (error) {
    log.warn({ seriesId, error: String(error) }, "Failed to fetch team logos from matches page");
    return [];
  }
}
