/**
 * Gemini AI sports data service with Google Search grounding.
 * Sport-agnostic: pass any SportPromptConfig to fetch data for that sport.
 * Uses gemini-2.5-flash with googleSearch tool for real-time data.
 */

import type {
  AITournament,
  AIMatch,
  AIPlayer,
  AITeamStanding,
  SportsDashboardData,
  AIMatchStatus,
  TournamentCategory,
} from "@draftcrick/shared";
import { SPORT_CONFIGS, DEFAULT_SPORT } from "@draftcrick/shared";
import type { Sport } from "@draftcrick/shared";
import { getLogger } from "../lib/logger";

const log = getLogger("gemini-sports");

// Lazy-load to avoid import issues if @google/genai isn't installed yet
let _ai: any = null;
async function getAI() {
  if (!_ai) {
    const { GoogleGenAI } = await import("@google/genai");
    _ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? process.env.API_KEY ?? "" });
  }
  return _ai;
}

function buildPrompt(sport: string, displayName: string, knownTournaments: string[]): string {
  const tournamentsHint = knownTournaments.slice(0, 6).join(", ");
  return `
Search for current major ${displayName.toLowerCase()} tournaments happening globally right now and matches scheduled for today and the next 3 days.
Include known tournaments like: ${tournamentsHint}.

Return the data in this EXACT format for me to parse:
[TOURNAMENTS_START]
Tournament: Name | Category | StartDate | EndDate
[TOURNAMENTS_END]

[MATCHES_START]
Match: Team A vs Team B | Format | Time | Date | Status | Tournament Name | Venue
[MATCHES_END]

CRITICAL: Each Match line MUST have exactly 7 pipe-separated fields in this order:
  Field 1: "Team A vs Team B" (the two teams)
  Field 2: Format (e.g., T20, ODI, Test)
  Field 3: Time with timezone (e.g., "7:30 PM IST")
  Field 4: Date as "Mon DD, YYYY" (e.g., "Feb 12, 2026")
  Field 5: Status (upcoming, live, completed, delayed, abandoned)
  Field 6: Tournament Name (e.g., "ICC Men's T20 World Cup 2026") — NOT the venue
  Field 7: Venue (e.g., "Dubai International Stadium") — NOT the tournament name

Category must be one of: international, domestic, league, bilateral, qualifier, friendly
Format examples: ${SPORT_CONFIGS[sport]?.formatExamples.join(", ") ?? "League"}
StartDate/EndDate format: "YYYY-MM-DD" or "unknown"

Example:
Tournament: ICC Men's T20 World Cup 2026 | international | 2026-02-01 | 2026-03-15
Match: India vs Pakistan | T20 | 7:30 PM IST | Feb 12, 2026 | upcoming | ICC Men's T20 World Cup 2026 | Dubai International Stadium
Match: Australia Women vs India Women | T20 | 2:00 PM AEDT | Feb 14, 2026 | upcoming | India Women tour of Australia 2026 | SCG, Sydney

IMPORTANT — Team naming rules:
- Use official full team names consistently across ALL matches in the same tournament.
- For women's tournaments, ALWAYS include "Women" in every team name (e.g., "India Women" not "India", "Nepal Women" not "Nepal").
- For A-team / development tournaments, ALWAYS include the suffix (e.g., "Bangladesh A Women" not "Bangladesh A" or "Bangladesh").
- Never mix "Nepal" and "Nepal Women" or "UAE" and "UAE Women" within the same tournament.
- The team name in a match MUST match exactly how other matches in that tournament refer to the same team.

Return ALL currently active tournaments and as many scheduled matches as possible (up to 20).
If there are live matches happening right now, mark them with status "live".
`.trim();
}

function parseTournaments(text: string, sport: Sport): AITournament[] {
  const tournaments: AITournament[] = [];
  const section = text.match(/\[TOURNAMENTS_START\]([\s\S]*?)\[TOURNAMENTS_END\]/);
  if (!section) return tournaments;

  const lines: string[] = section[1].match(/Tournament: .+/g) || [];
  lines.forEach((line, index) => {
    const parts = line.replace("Tournament: ", "").split(" | ").map((s) => s.trim());
    if (parts.length >= 2) {
      const category = (parts[1]?.toLowerCase() || "league") as TournamentCategory;
      const validCategories: TournamentCategory[] = ["international", "domestic", "league", "bilateral", "qualifier", "friendly"];
      tournaments.push({
        id: `ai-tournament-${sport}-${index}`,
        name: parts[0],
        sport,
        category: validCategories.includes(category) ? category : "league",
        startDate: parts[2] && parts[2] !== "unknown" ? parts[2] : null,
        endDate: parts[3] && parts[3] !== "unknown" ? parts[3] : null,
        imageUrl: null,
        sourceUrl: null,
      });
    }
  });

  return tournaments;
}

/** Heuristic: does this string look like a venue name? */
function looksLikeVenue(s: string): boolean {
  if (!s) return false;
  const venuePatterns = /stadium|ground|oval|park|arena|centre|center|cricket club|sports club|scg|mcg|waca|lords|edgbaston/i;
  // Venues typically contain a city/country after a comma
  const hasLocation = /,\s*[A-Z]/.test(s);
  return venuePatterns.test(s) || hasLocation;
}

function parseMatches(text: string, sport: Sport): AIMatch[] {
  const matches: AIMatch[] = [];
  const section = text.match(/\[MATCHES_START\]([\s\S]*?)\[MATCHES_END\]/);
  if (!section) return matches;

  const lines: string[] = section[1].match(/Match: .+/g) || [];
  lines.forEach((line, index) => {
    const parts = line.replace("Match: ", "").split(" | ").map((s) => s.trim());
    if (parts.length >= 6) {
      const teams = parts[0].split(" vs ").map((t) => t.trim());
      const status = (parts[4]?.toLowerCase() || "upcoming") as AIMatchStatus;
      const validStatuses: AIMatchStatus[] = ["upcoming", "live", "completed", "delayed", "abandoned"];

      // Gemini sometimes swaps tournament name and venue, or omits tournament name.
      // Detect and fix: if parts[5] looks like a venue, swap with parts[6].
      let tournamentName = parts[5] || "Unknown Tournament";
      let venue = parts[6] || null;

      if (looksLikeVenue(tournamentName)) {
        // parts[5] is actually the venue — swap
        venue = tournamentName;
        tournamentName = parts[6] || "Unknown Tournament";
      }

      matches.push({
        id: `ai-match-${sport}-${index}`,
        teamA: teams[0] || "TBA",
        teamB: teams[1] || "TBA",
        sport,
        format: parts[1] || "Unknown",
        time: parts[2] || "TBD",
        date: parts[3] || "TBD",
        status: validStatuses.includes(status) ? status : "upcoming",
        tournamentName,
        venue,
        scoreSummary: null,
        sourceUrl: null,
      });
    }
  });

  return matches;
}

/**
 * Fetch live sports data from Gemini AI with Google Search grounding.
 * This should be called at most once per day per sport (caching handled by caller).
 */
export async function fetchSportsData(sport: Sport = DEFAULT_SPORT): Promise<SportsDashboardData> {
  const config = SPORT_CONFIGS[sport];
  if (!config) {
    throw new Error(`No config found for sport: ${sport}`);
  }

  const apiKey = process.env.GEMINI_API_KEY ?? process.env.API_KEY;
  if (!apiKey) {
    log.warn("No GEMINI_API_KEY or API_KEY set — returning empty sports data");
    return {
      tournaments: [],
      matches: [],
      lastFetched: new Date().toISOString(),
      sources: [],
      sport,
    };
  }

  const ai = await getAI();
  const model = "gemini-2.5-flash";
  const prompt = buildPrompt(sport, config.displayName, config.knownTournaments);

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const text: string = response.text || "";
    const groundingChunks =
      response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources = groundingChunks
      .filter((c: any) => c.web?.uri)
      .map((c: any) => c.web.uri);

    const tournaments = parseTournaments(text, sport);
    const matches = parseMatches(text, sport);

    // Attach source URLs to tournaments and matches
    if (sources.length > 0) {
      tournaments.forEach((t) => (t.sourceUrl = sources[0]));
      matches.forEach((m) => (m.sourceUrl = sources[0]));
    }

    return {
      tournaments,
      matches,
      lastFetched: new Date().toISOString(),
      sources,
      sport,
    };
  } catch (error) {
    log.error({ sport, error: String(error) }, "Gemini sports fetch failed");
    return {
      tournaments: [],
      matches: [],
      lastFetched: new Date().toISOString(),
      sources: [],
      sport,
    };
  }
}

// ---------------------------------------------------------------------------
// Player roster fetching via Gemini
// ---------------------------------------------------------------------------

const PLAYER_BATCH_SIZE = 3;

function buildPlayerPrompt(
  sport: string,
  displayName: string,
  tournamentNames: string[]
): string {
  const tournamentList = tournamentNames.join(", ");
  return `
Search for the current squad/roster of players in these ${displayName.toLowerCase()} tournaments: ${tournamentList}.

For each tournament, list all players from every team participating.

Return the data in this EXACT format for me to parse:
[PLAYERS_START]
Player: Full Name | Team Name | Role | Nationality | Batting Style | Bowling Style | Credits | Batting Avg | Bowling Avg | Tournament Name
[PLAYERS_END]

Role must be one of: batsman, bowler, all_rounder, wicket_keeper
Credits: fantasy value from 7.0 to 10.0 (based on current form and reputation)
Use "N/A" for any unknown fields.
Batting Style examples: Right-hand bat, Left-hand bat
Bowling Style examples: Right-arm fast, Left-arm spin, Right-arm off-break, Left-arm fast-medium, N/A

Example:
Player: Virat Kohli | Royal Challengers Bengaluru | batsman | India | Right-hand bat | Right-arm medium | 10.0 | 48.5 | N/A | IPL
Player: Jasprit Bumrah | Mumbai Indians | bowler | India | Right-hand bat | Right-arm fast | 9.5 | N/A | 20.3 | IPL

IMPORTANT — Team naming rules:
- The "Team Name" field MUST use the official team name as it appears in the tournament schedule.
- For women's tournaments, ALWAYS use the women's team name (e.g., "India Women" not "India", "Nepal Women" not "Nepal").
- For A-team / development tournaments, include the suffix (e.g., "Bangladesh A Women" not "Bangladesh A").
- For franchise leagues (IPL, BBL, CPL), use the franchise name (e.g., "Mumbai Indians", "Chennai Super Kings").
- For international tournaments, use the country name as it appears in match fixtures.

Return ALL players for the requested tournaments. Include at least the main squad (15-25 players per team).
`.trim();
}

function parsePlayers(text: string, sport: Sport): AIPlayer[] {
  const players: AIPlayer[] = [];
  const section = text.match(/\[PLAYERS_START\]([\s\S]*?)\[PLAYERS_END\]/);
  if (!section) return players;

  const lines: string[] = section[1]?.match(/Player: .+/g) || [];
  const validRoles = ["batsman", "bowler", "all_rounder", "wicket_keeper"] as const;

  lines.forEach((line, index) => {
    const parts = line.replace("Player: ", "").split(" | ").map((s) => s.trim());
    if (parts.length < 6) return;

    const name = parts[0] ?? "Unknown";
    const team = parts[1] ?? "Unknown";
    const rawRole = parts[2]?.toLowerCase().replace(/[\s-]+/g, "_") || "";
    const role = validRoles.includes(rawRole as any)
      ? (rawRole as AIPlayer["role"])
      : "batsman"; // default fallback
    const nationality = parts[3] || "Unknown";
    const battingStyle = parts[4] && parts[4] !== "N/A" ? parts[4] : null;
    const bowlingStyle = parts[5] && parts[5] !== "N/A" ? parts[5] : null;

    // Parse credits, clamp to 7.0-10.0
    let credits: number | null = null;
    if (parts[6] && parts[6] !== "N/A") {
      const parsed = parseFloat(parts[6]);
      if (!isNaN(parsed)) {
        credits = Math.max(7.0, Math.min(10.0, parsed));
      }
    }

    // Parse batting average
    let battingAvg: number | null = null;
    if (parts[7] && parts[7] !== "N/A") {
      const parsed = parseFloat(parts[7]);
      if (!isNaN(parsed)) battingAvg = parsed;
    }

    // Parse bowling average
    let bowlingAvg: number | null = null;
    if (parts[8] && parts[8] !== "N/A") {
      const parsed = parseFloat(parts[8]);
      if (!isNaN(parsed)) bowlingAvg = parsed;
    }

    const tournamentName = parts[9] || "Unknown Tournament";

    players.push({
      id: `ai-player-${sport}-${index}`,
      name,
      team,
      role,
      nationality,
      battingStyle,
      bowlingStyle,
      credits,
      battingAvg,
      bowlingAvg,
      tournamentName,
      sourceUrl: null,
    });
  });

  return players;
}

/**
 * Fetch player rosters for given tournaments via Gemini AI.
 * Batches tournaments (3 per call) to stay within token limits.
 * Returns all players across all batches.
 */
export async function fetchPlayerRosters(
  sport: Sport,
  tournamentNames: string[]
): Promise<AIPlayer[]> {
  const config = SPORT_CONFIGS[sport];
  if (!config) {
    throw new Error(`No config found for sport: ${sport}`);
  }

  const apiKey = process.env.GEMINI_API_KEY ?? process.env.API_KEY;
  if (!apiKey) {
    log.warn("No GEMINI_API_KEY or API_KEY set — skipping player roster fetch");
    return [];
  }

  const ai = await getAI();
  const model = "gemini-2.5-flash";
  const allPlayers: AIPlayer[] = [];

  // Batch tournaments to avoid token limits
  for (let i = 0; i < tournamentNames.length; i += PLAYER_BATCH_SIZE) {
    const batch = tournamentNames.slice(i, i + PLAYER_BATCH_SIZE);
    const prompt = buildPlayerPrompt(sport, config.displayName, batch);

    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const text: string = response.text || "";
      const groundingChunks =
        response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const sources = groundingChunks
        .filter((c: any) => c.web?.uri)
        .map((c: any) => c.web.uri);

      const players = parsePlayers(text, sport);

      // Attach source URLs
      if (sources.length > 0) {
        players.forEach((p) => (p.sourceUrl = sources[0]));
      }

      allPlayers.push(...players);
      log.info(
        { sport, batch, playersFound: players.length },
        "Fetched player batch from Gemini"
      );
    } catch (error) {
      log.warn(
        { sport, batch, error: String(error) },
        "Failed to fetch player batch from Gemini"
      );
      // Continue with next batch — don't fail the whole operation
    }
  }

  return allPlayers;
}

// ---------------------------------------------------------------------------
// Tournament standings fetching via Gemini
// ---------------------------------------------------------------------------

const STANDINGS_BATCH_SIZE = 3;

function buildStandingsPrompt(
  sport: string,
  displayName: string,
  tournamentNames: string[]
): string {
  const tournamentList = tournamentNames.join(", ");
  return `
Search for the current points table / standings for these ${displayName.toLowerCase()} tournaments: ${tournamentList}.

Return the data in this EXACT format for me to parse:
[STANDINGS_START]
Standing: Position | Team | Played | Won | Lost | Tied | NR | Points | NRR | Group | Tournament Name
[STANDINGS_END]

Position: integer starting at 1
Played/Won/Lost/Tied/NR: integers (NR = no result)
Points: integer
NRR: net run rate as string with sign (e.g., "+0.825", "-1.234", "+0.000")
Group: group name (e.g., "Group A") or "N/A" if no groups
Tournament Name: must match exactly one of the requested tournament names

Example:
Standing: 1 | India | 5 | 4 | 1 | 0 | 0 | 8 | +1.250 | Group A | ICC Champions Trophy 2025
Standing: 2 | Australia | 5 | 3 | 2 | 0 | 0 | 6 | +0.430 | Group A | ICC Champions Trophy 2025

IMPORTANT — Team naming rules:
- Use the official team name as it appears in the tournament schedule.
- For women's tournaments, ALWAYS use women's team names (e.g., "India Women" not "India").
- For A-team / development tournaments, include the suffix (e.g., "Bangladesh A Women").
- Team names in standings MUST match exactly how teams appear in the match fixtures.

Return ALL teams for each tournament's standings. Order by position within each group/tournament.
`.trim();
}

function parseStandings(
  text: string
): Array<AITeamStanding & { tournamentName: string }> {
  const standings: Array<AITeamStanding & { tournamentName: string }> = [];
  const section = text.match(
    /\[STANDINGS_START\]([\s\S]*?)\[STANDINGS_END\]/
  );
  if (!section) return standings;

  const lines: string[] = section[1]?.match(/Standing: .+/g) || [];

  lines.forEach((line) => {
    const parts = line
      .replace("Standing: ", "")
      .split(" | ")
      .map((s) => s.trim());
    if (parts.length < 11) return;

    const position = parseInt(parts[0] ?? "", 10);
    const played = parseInt(parts[2] ?? "", 10);
    const won = parseInt(parts[3] ?? "", 10);
    const lost = parseInt(parts[4] ?? "", 10);
    const tied = parseInt(parts[5] ?? "", 10);
    const noResult = parseInt(parts[6] ?? "", 10);
    const points = parseInt(parts[7] ?? "", 10);

    // Validate all numeric fields
    if (
      [position, played, won, lost, tied, noResult, points].some(isNaN)
    ) {
      return;
    }

    const nrr = parts[8] ?? "+0.000";
    const group = parts[9] && parts[9] !== "N/A" ? parts[9] : null;
    const tournamentName = parts[10] || "Unknown Tournament";

    standings.push({
      position,
      team: parts[1] || "Unknown",
      played,
      won,
      lost,
      tied,
      noResult,
      points,
      netRunRate: nrr,
      group,
      tournamentName,
    });
  });

  return standings;
}

/**
 * Fetch tournament standings (points tables) via Gemini AI.
 * Batches tournaments (3 per call) to stay within token limits.
 * Returns a Map of tournamentName → AITeamStanding[].
 */
export async function fetchTournamentStandings(
  sport: Sport,
  tournamentNames: string[]
): Promise<Map<string, AITeamStanding[]>> {
  const config = SPORT_CONFIGS[sport];
  if (!config) {
    throw new Error(`No config found for sport: ${sport}`);
  }

  const apiKey = process.env.GEMINI_API_KEY ?? process.env.API_KEY;
  if (!apiKey) {
    log.warn("No GEMINI_API_KEY or API_KEY set — skipping standings fetch");
    return new Map();
  }

  const ai = await getAI();
  const model = "gemini-2.5-flash";
  const result = new Map<string, AITeamStanding[]>();

  for (let i = 0; i < tournamentNames.length; i += STANDINGS_BATCH_SIZE) {
    const batch = tournamentNames.slice(i, i + STANDINGS_BATCH_SIZE);
    const prompt = buildStandingsPrompt(sport, config.displayName, batch);

    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const text: string = response.text || "";
      const parsed = parseStandings(text);

      // Group by tournament name
      for (const entry of parsed) {
        const { tournamentName, ...standing } = entry;
        if (!result.has(tournamentName)) {
          result.set(tournamentName, []);
        }
        result.get(tournamentName)!.push(standing);
      }

      log.info(
        { sport, batch, standingsFound: parsed.length },
        "Fetched standings batch from Gemini"
      );
    } catch (error) {
      log.warn(
        { sport, batch, error: String(error) },
        "Failed to fetch standings batch from Gemini"
      );
    }
  }

  return result;
}
