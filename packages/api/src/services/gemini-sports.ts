/**
 * Gemini AI sports data service with Google Search grounding.
 * Sport-agnostic: pass any SportPromptConfig to fetch data for that sport.
 * Uses gemini-3.1-flash-lite-preview with googleSearch tool for real-time data.
 */

import type {
  AITournament,
  AIMatch,
  AIPlayer,
  AITeamStanding,
  SportsDashboardData,
  AIMatchStatus,
  TournamentCategory,
} from "@draftplay/shared";
import { SPORT_CONFIGS, DEFAULT_SPORT } from "@draftplay/shared";
import type { Sport } from "@draftplay/shared";
import { getLogger } from "../lib/logger";

const log = getLogger("gemini-sports");

// Lazy-load to avoid import issues if @google/genai isn't installed yet
let _ai: any = null;
async function getAI() {
  if (!_ai) {
    const { GoogleGenAI } = await import("@google/genai");
    _ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_CLOUD_API_KEY ?? process.env.GEMINI_API_KEY ?? process.env.API_KEY ?? "" });
  }
  return _ai;
}

function buildPrompt(sport: string, displayName: string, knownTournaments: string[], activeTournaments?: string[]): string {
  // If active tournaments are specified, ONLY ask about those to save API costs
  if (activeTournaments && activeTournaments.length > 0) {
    const tournamentList = activeTournaments.join(", ");
    return `
Search for current ${displayName.toLowerCase()} matches in these specific tournaments: ${tournamentList}.
Find matches scheduled for today and the next 3 days, plus any recently completed matches.

Return the data in this EXACT format for me to parse:
[TOURNAMENTS_START]
Tournament: Name | Category | StartDate | EndDate | Description
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
  Field 6: Tournament Name (e.g., "${activeTournaments[0]}") — NOT the venue
  Field 7: Venue (e.g., "Dubai International Stadium") — NOT the tournament name

Category must be one of: international, domestic, league, bilateral, qualifier, friendly
Format examples: ${SPORT_CONFIGS[sport]?.formatExamples.join(", ") ?? "League"}
StartDate/EndDate format: "YYYY-MM-DD" or "unknown"
Description: Brief 1-line summary (max 100 chars)

IMPORTANT — ONLY return data for these tournaments: ${tournamentList}. Do NOT include any other tournaments.

CRITICAL — Tournament names must use the FULL OFFICIAL name exactly as provided above. Never abbreviate (e.g. never "IPL" for "Indian Premier League"). NEVER append the year to tournament names — the year is in the dates. The tournament name in each Match line must match the Tournament line exactly.

IMPORTANT — Team naming rules:
- Use official full team names consistently across ALL matches in the same tournament.
- For women's tournaments, ALWAYS include "Women" in every team name.
- Never mix naming conventions within the same tournament.

CRITICAL — Do NOT include matches where one or both teams are undecided (TBC, TBD, T.B.C., "To Be Confirmed", etc.). Only return matches with confirmed, named teams.

Return ALL matches with confirmed teams for the requested tournaments (up to 20).
If there are live matches happening right now, mark them with status "live".
`.trim();
  }

  const tournamentsHint = knownTournaments.slice(0, 6).join(", ");
  return `
Search for current major ${displayName.toLowerCase()} tournaments happening globally right now and matches scheduled for today and the next 3 days.
Include known tournaments like: ${tournamentsHint}.

Return the data in this EXACT format for me to parse:
[TOURNAMENTS_START]
Tournament: Name | Category | StartDate | EndDate | Description
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
  Field 6: Tournament Name (e.g., "ICC Men's T20 World Cup") — NOT the venue
  Field 7: Venue (e.g., "Dubai International Stadium") — NOT the tournament name

Category must be one of: international, domestic, league, bilateral, qualifier, friendly
Format examples: ${SPORT_CONFIGS[sport]?.formatExamples.join(", ") ?? "League"}
StartDate/EndDate format: "YYYY-MM-DD" or "unknown"
Description: Brief 1-line summary (max 100 chars)

Example:
Tournament: ICC Men's T20 World Cup | international | 2026-02-01 | 2026-03-15 | ICC's flagship T20 tournament featuring 20 nations
Match: India vs Pakistan | T20 | 7:30 PM IST | Feb 12, 2026 | upcoming | ICC Men's T20 World Cup | Dubai International Stadium

CRITICAL — Tournament naming consistency:
- Always use the FULL OFFICIAL tournament name. Never use abbreviations.
- NEVER append the year to ANY tournament or series name. The year is already captured in StartDate/EndDate.
- Examples: "Indian Premier League" (NEVER "IPL" or "Indian Premier League 2026"), "Pakistan Super League" (NEVER "PSL"), "ICC Men's T20 World Cup" (NEVER with year suffix), "India vs England Test Series" (NEVER "India vs England Test Series 2025").
- The tournament name in each Match line must match the Tournament line exactly.

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
        description: parts[4]?.trim() || null,
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
        tossWinner: null,
        tossDecision: null,
        result: null,
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
export async function fetchSportsData(sport: Sport = DEFAULT_SPORT, activeTournaments?: string[]): Promise<SportsDashboardData> {
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
  const model = "gemini-3.1-flash-lite-preview";
  const prompt = buildPrompt(sport, config.displayName, config.knownTournaments, activeTournaments);

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
// Lightweight tournament discovery via Gemini (no matches/players/standings)
// ---------------------------------------------------------------------------

function buildDiscoveryPrompt(sport: string, displayName: string, knownTournaments: string[]): string {
  const allKnown = knownTournaments.join(", ");
  return `
Search for major ${displayName.toLowerCase()} tournaments that are currently active (ongoing right now) or upcoming (within next 60 days). Do NOT include tournaments that have already completed/finished.

ONLY include these types:
1. ICC international events (World Cups, Champions Trophy, World Test Championship, etc.)
2. Top franchise leagues (IPL, PSL, BBL, CPL, SA20, ILT20, BPL, The Hundred, WPL, etc.)
3. Major bilateral series between top-8 ICC nations (India, Australia, England, South Africa, New Zealand, Pakistan, Sri Lanka, West Indies)

DO NOT include: domestic/county tournaments, A-team tours, youth/U19 events, associate nation tours, celebrity/legends leagues, women's domestic competitions, or minor bilateral series.

Check these specifically: ${allKnown}.

CRITICAL — NAMING CONSISTENCY RULES:
- Always use the FULL OFFICIAL tournament name. Never use abbreviations or short forms.
- NEVER append the year to ANY tournament or series name. The year is already captured in StartDate/EndDate fields.
- Use these EXACT names every time (do NOT vary them across calls):
  • "Indian Premier League" (NEVER "IPL", NEVER "Indian Premier League 2026")
  • "Pakistan Super League" (NEVER "PSL", NEVER "Pakistan Super League 2026")
  • "Big Bash League" (NEVER "BBL")
  • "Caribbean Premier League" (NEVER "CPL")
  • "Bangladesh Premier League" (NEVER "BPL")
  • "Lanka Premier League" (NEVER "LPL")
  • "SA20" (this IS the official name)
  • "ILT20" (this IS the official name)
  • "The Hundred" (NEVER just "Hundred")
  • "Major League Cricket" (NEVER "MLC")
  • "Women's Premier League" (NEVER "WPL")
  • "ICC Men's T20 World Cup" (NEVER with year suffix)
  • "ICC Men's Cricket World Cup" (NEVER with year suffix)
  • "ICC Champions Trophy" (NEVER with year suffix)
- For bilateral series: "Team A vs Team B Format Series" (e.g. "India vs England Test Series", "South Africa vs New Zealand ODI Series")
  • Include the format(s) in the name (Test, ODI, T20I, or combined like "Test, ODI & T20I Series")
  • NEVER append the year — use StartDate/EndDate for that
- The name must be IDENTICAL every time you return it. This is used as a unique database key. If you are unsure, keep it simple and short.

Return ONLY tournament information in this EXACT format:
[TOURNAMENTS_START]
Tournament: Name | Category | StartDate | EndDate | Description
[TOURNAMENTS_END]

Category must be one of: international, league, bilateral
StartDate/EndDate format: "YYYY-MM-DD" or "unknown"
Description: A brief 1-line summary (max 100 chars). Example: "Annual T20 franchise league in India featuring 10 teams"

Do NOT include match data.
`.trim();
}

/**
 * Lightweight tournament discovery — fetches ONLY tournament names/metadata.
 * No matches, no players, no standings. Much cheaper than fetchSportsData().
 */
export async function discoverTournaments(sport: Sport = DEFAULT_SPORT): Promise<AITournament[]> {
  const config = SPORT_CONFIGS[sport];
  if (!config) {
    throw new Error(`No config found for sport: ${sport}`);
  }

  const apiKey = process.env.GEMINI_API_KEY ?? process.env.API_KEY;
  if (!apiKey) {
    log.warn("No GEMINI_API_KEY or API_KEY set — returning empty discovery");
    return [];
  }

  const ai = await getAI();
  const model = "gemini-3.1-flash-lite-preview";
  const prompt = buildDiscoveryPrompt(sport, config.displayName, config.knownTournaments);

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

    const discoveredTournaments = parseTournaments(text, sport);

    if (sources.length > 0) {
      discoveredTournaments.forEach((t) => (t.sourceUrl = sources[0]));
    }

    // Filter out tournaments that have already completed (endDate in the past)
    const now = new Date();
    const activeTournaments = discoveredTournaments.filter((t) => {
      if (!t.endDate) return true; // unknown end date — keep it
      const end = new Date(t.endDate + "T23:59:59");
      return end >= now;
    });

    log.info(
      { sport, total: discoveredTournaments.length, active: activeTournaments.length },
      "Discovered tournaments from Gemini (filtered out completed)"
    );
    return activeTournaments;
  } catch (error) {
    log.error({ sport, error: String(error) }, "Gemini tournament discovery failed");
    return [];
  }
}

// ---------------------------------------------------------------------------
// Player roster fetching via Gemini
// ---------------------------------------------------------------------------

const PLAYER_BATCH_SIZE = 3;
const TEAM_BATCH_SIZE = 4;

function buildPlayerPrompt(
  sport: string,
  displayName: string,
  tournamentNames: string[]
): string {
  const tournamentList = tournamentNames.join(", ");
  return `
Search for the current squad/roster of players in these ${displayName.toLowerCase()} tournaments: ${tournamentList}.

For each tournament, list all players from every team participating.

Return the data in this EXACT format for me to parse (18 pipe-separated fields):
[PLAYERS_START]
Player: Full Name | Team Name | Role | Nationality | Batting Style | Bowling Style | Credits | Batting Avg | Bowling Avg | Strike Rate | Economy Rate | Bowling SR | Matches Played | Recent Form (1-10) | Sentiment (1-10) | Injury Status | Form Note | Tournament Name
[PLAYERS_END]

Field definitions (in order):
1-9: Name, Team, Role (batsman/bowler/all_rounder/wicket_keeper), Nationality, Batting Style, Bowling Style, Credits (7.0-10.0), Batting Avg, Bowling Avg
10. Strike Rate — batting strike rate (N/A for pure bowlers)
11. Economy Rate — bowling economy (N/A for pure batsmen)
12. Bowling SR — bowling strike rate (N/A for pure batsmen)
13. Matches Played — matches in this tournament/series
14. Recent Form (1-10) — last 5 matches performance. 10=exceptional, 5=average, 1=terrible
15. Sentiment (1-10) — current media buzz. 10=massive hype, 5=neutral, 1=controversy
16. Injury Status — fit, doubtful, injured, or recovered
17. Form Note — one sentence about current form
18. Tournament Name

Use "N/A" for unknown fields.

Example:
Player: Virat Kohli | Royal Challengers Bengaluru | batsman | India | Right-hand bat | Right-arm medium | 10.0 | 48.5 | N/A | 142.3 | N/A | N/A | 14 | 9 | 9 | fit | In exceptional form with 3 fifties in last 5 IPL innings | Indian Premier League

CRITICAL — Player naming rules:
- Use the player's COMMONLY KNOWN cricket name — scoreboards, ESPNcricinfo, broadcasts.
- Do NOT use full legal names with middle names.
- "Jos Buttler" NOT "Joseph Charles Buttler". "Sam Curran" NOT "Samuel Matthew Curran".
- "Mohammed" not "Mohd." — no abbreviations. "Suryakumar Yadav" not "SKY" — no nicknames.
- When in doubt, use the name as it appears on ESPNcricinfo player profiles.

CRITICAL — Nationality: COUNTRY NAME only ("India" not "Indian", "England" not "English").

CRITICAL — Squad accuracy: ONLY confirmed squad members. Do NOT hallucinate.

CRITICAL — Sentiment: Base on CURRENT media coverage, fan reactions, expert commentary. Use the full 1-10 range honestly.

IMPORTANT — Team naming: Use official names. Women's teams get suffix. Franchise leagues use franchise names.

Return ALL players for the requested tournaments. Include at least 15-25 players per team.
`.trim();
}

/**
 * Build a prompt that asks for players from specific teams only.
 * Used as a second pass when the initial tournament-wide fetch misses some teams.
 */
function buildTeamPlayerPrompt(
  sport: string,
  displayName: string,
  teamNames: string[],
  tournamentName: string,
  existingPlayerNames?: string[]
): string {
  const teamList = teamNames.join(", ");

  // If we already have players, include them so Gemini uses the same names
  const existingPlayersBlock = existingPlayerNames && existingPlayerNames.length > 0
    ? `
IMPORTANT — We already have these players in our database for this match:
${existingPlayerNames.map((n) => `- ${n}`).join("\n")}

Rules for existing players:
- Use the EXACT SAME NAME as listed above. Do NOT change spelling, add middle names, or use alternate forms.
- If a player above is still in the squad, include them with the EXACT name shown.
- If a player above has been dropped/replaced, do NOT include them.
- You may ADD new players not in the list above if they are confirmed squad members.
`
    : "";

  return `
Search for the current ${displayName.toLowerCase()} squad/roster for these specific teams in the "${tournamentName}" tournament: ${teamList}.

Return 15-25 players per team.
${existingPlayersBlock}
Return the data in this EXACT format for me to parse (18 pipe-separated fields):
[PLAYERS_START]
Player: Full Name | Team Name | Role | Nationality | Batting Style | Bowling Style | Credits | Batting Avg | Bowling Avg | Strike Rate | Economy Rate | Bowling SR | Matches Played | Recent Form (1-10) | Sentiment (1-10) | Injury Status | Form Note | Tournament Name
[PLAYERS_END]

Field definitions (in order):
1. Full Name — player's commonly known name
2. Team Name — official team name in this tournament
3. Role — one of: batsman, bowler, all_rounder, wicket_keeper
4. Nationality — country name (not adjective)
5. Batting Style — e.g. Right-hand bat, Left-hand bat
6. Bowling Style — e.g. Right-arm fast, Left-arm spin, Right-arm off-break, N/A
7. Credits — fantasy value 7.0-10.0 (current form + reputation)
8. Batting Avg — career or tournament batting average
9. Bowling Avg — career or tournament bowling average (N/A for pure batsmen)
10. Strike Rate — batting strike rate (N/A for pure bowlers)
11. Economy Rate — bowling economy rate (N/A for pure batsmen)
12. Bowling SR — bowling strike rate (N/A for pure batsmen)
13. Matches Played — matches in this tournament/series
14. Recent Form (1-10) — performance in last 5 matches. 10=exceptional, 7=good, 5=average, 3=poor, 1=terrible
15. Sentiment (1-10) — current media buzz and public perception. 10=massive hype, 7=positive coverage, 5=neutral, 3=criticism, 1=controversy
16. Injury Status — one of: fit, doubtful, injured, recovered
17. Form Note — one sentence about current form from recent media (e.g. "3 fifties in last 5 innings, looking in great touch")
18. Tournament Name

Use "N/A" for any truly unknown fields. Do NOT guess — only include stats you can verify.

Example:
Player: Virat Kohli | Royal Challengers Bengaluru | batsman | India | Right-hand bat | Right-arm medium | 10.0 | 48.5 | N/A | 142.3 | N/A | N/A | 14 | 9 | 9 | fit | In exceptional form with 3 fifties in last 5 IPL innings | Indian Premier League
Player: Jasprit Bumrah | Mumbai Indians | bowler | India | Right-hand bat | Right-arm fast | 9.5 | N/A | 20.3 | N/A | 6.7 | 14.2 | 12 | 8 | 8 | fit | Tournament's leading wicket-taker with consistent economy | Indian Premier League

CRITICAL — Player naming rules:
- Use the player's COMMONLY KNOWN cricket name — the name on scoreboards, ESPNcricinfo, and broadcasts.
- Do NOT use full legal/birth certificate names with middle names.
- "Jos Buttler" NOT "Joseph Charles Buttler". "Sam Curran" NOT "Samuel Matthew Curran".
- "Mohammed" not "Mohd." or "Md." — no abbreviations.
- "Suryakumar Yadav" not "SKY" — no nicknames.
- When in doubt, use the name as it appears on ESPNcricinfo player profiles.

CRITICAL — Nationality format rules:
- ALWAYS use the COUNTRY NAME: "India" not "Indian", "England" not "English", "Australia" not "Australian".

CRITICAL — Squad accuracy rules:
- ONLY return CONFIRMED squad members for the "${tournamentName}" tournament.
- Do NOT hallucinate or guess. Cross-reference with official squad announcements.

CRITICAL — Sentiment scoring rules:
- Base the sentiment score on CURRENT media coverage, social media buzz, and public perception.
- Factor in: recent performances, fan reactions, expert commentary, injury/comeback news, transfer buzz.
- A player returning from injury with positive media coverage = higher sentiment.
- A player facing criticism after poor performance = lower sentiment.
- Be honest — don't inflate sentiment. Use the full 1-10 range.

The "Team Name" field MUST exactly match one of: ${teamList}.
Return ALL players for ALL requested teams.
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

    let name = parts[0] ?? "Unknown";
    let team = parts[1] ?? "Unknown";

    // --- Garbage data rejection ---
    // Strip "Team Name: " prefix (Gemini sometimes wraps team in a label)
    team = team.replace(/^Team\s*Name\s*:\s*/i, "").trim();
    // Reject if team is empty or looks like a label
    if (!team || /^(team|name|unknown)$/i.test(team)) return;
    // Reject if name looks like a label or is too short
    if (!name || name.length < 2 || /^(player|name|unknown)$/i.test(name)) return;

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

    // Helper for parsing optional numeric fields
    const parseNum = (idx: number, min?: number, max?: number): number | null => {
      const raw = parts[idx];
      if (!raw || raw === "N/A" || raw === "—" || raw === "-") return null;
      const v = parseFloat(raw);
      if (isNaN(v)) return null;
      if (min != null && max != null) return Math.max(min, Math.min(max, v));
      return v;
    };

    // Extended stats (18-field format): parts[9]-[17]
    // Backward compatible: if parts.length < 18, tournamentName is parts[9]
    const isExtended = parts.length >= 18;

    const strikeRate = isExtended ? parseNum(9, 0, 400) : null;
    const economyRate = isExtended ? parseNum(10, 0, 20) : null;
    const bowlingStrikeRate = isExtended ? parseNum(11, 0, 100) : null;
    const matchesPlayed = isExtended ? parseNum(12, 0, 200) : null;
    const recentForm = isExtended ? parseNum(13, 1, 10) : null;
    const sentimentScore = isExtended ? parseNum(14, 1, 10) : null;

    const injuryRaw = isExtended ? (parts[15] ?? "").trim() : "";
    const validInjury = ["fit", "doubtful", "injured", "recovered"];
    const injuryStatus = validInjury.includes(injuryRaw.toLowerCase()) ? injuryRaw.toLowerCase() : null;

    const formNote = isExtended && parts[16] && parts[16] !== "N/A" ? parts[16].trim() : null;
    const tournamentName = isExtended ? (parts[17] || "Unknown Tournament") : (parts[9] || "Unknown Tournament");

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
      strikeRate,
      economyRate,
      bowlingStrikeRate,
      matchesPlayed,
      recentForm,
      sentimentScore,
      injuryStatus,
      formNote,
      tournamentName,
      sourceUrl: null,
    });
  });

  // Batch-level garbage detection: if >80% of players have the same role
  // AND >80% have no credits, the response is likely garbage — discard it
  if (players.length > 5) {
    const roleCounts = new Map<string, number>();
    let noCreditsCount = 0;
    for (const p of players) {
      roleCounts.set(p.role, (roleCounts.get(p.role) ?? 0) + 1);
      if (!p.credits) noCreditsCount++;
    }
    const maxRoleCount = Math.max(...roleCounts.values());
    const sameRoleRatio = maxRoleCount / players.length;
    const noCreditsRatio = noCreditsCount / players.length;
    if (sameRoleRatio > 0.8 && noCreditsRatio > 0.8) {
      log.warn(
        { playerCount: players.length, sameRoleRatio, noCreditsRatio },
        "Discarding garbage player batch — uniform roles + no credits"
      );
      return [];
    }
  }

  return players;
}

/**
 * Fetch player rosters for specific teams in a tournament.
 * Used as a second pass when the initial tournament-wide fetch misses some teams.
 * Batches teams (4 per call) to stay within token limits.
 */
export async function fetchPlayersByTeams(
  sport: Sport,
  teamNames: string[],
  tournamentName: string,
  existingPlayerNames?: string[]
): Promise<AIPlayer[]> {
  const config = SPORT_CONFIGS[sport];
  if (!config) throw new Error(`No config found for sport: ${sport}`);

  const apiKey = process.env.GEMINI_API_KEY ?? process.env.API_KEY;
  if (!apiKey) return [];

  const ai = await getAI();
  const model = "gemini-3.1-flash-lite-preview";
  const allPlayers: AIPlayer[] = [];

  for (let i = 0; i < teamNames.length; i += TEAM_BATCH_SIZE) {
    const batch = teamNames.slice(i, i + TEAM_BATCH_SIZE);
    const prompt = buildTeamPlayerPrompt(sport, config.displayName, batch, tournamentName, existingPlayerNames);

    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: { tools: [{ googleSearch: {} }] },
      });

      const text: string = response.text || "";
      const players = parsePlayers(text, sport);
      allPlayers.push(...players);

      log.info({ sport, teams: batch, playersFound: players.length }, "Fetched team-specific player batch");
    } catch (error) {
      log.warn({ sport, teams: batch, error: String(error) }, "Failed to fetch team-specific player batch");
    }
  }

  return allPlayers;
}

/**
 * Fetch updated stats for a single player via Gemini AI.
 * Returns a single AIPlayer or null if the fetch fails.
 */
export async function fetchSinglePlayer(
  sport: Sport,
  playerName: string,
  teamName: string,
  tournamentName: string
): Promise<AIPlayer | null> {
  const config = SPORT_CONFIGS[sport];
  if (!config) throw new Error(`No config found for sport: ${sport}`);

  const apiKey = process.env.GEMINI_API_KEY ?? process.env.API_KEY;
  if (!apiKey) return null;

  const ai = await getAI();
  const model = "gemini-3.1-flash-lite-preview";

  const prompt = `
Search for the latest stats and information about the ${config.displayName.toLowerCase()} player "${playerName}" who plays for "${teamName}" in the "${tournamentName}" tournament.

Return the data in this EXACT format (18 pipe-separated fields):
[PLAYERS_START]
Player: Full Name | Team Name | Role | Nationality | Batting Style | Bowling Style | Credits | Batting Avg | Bowling Avg | Strike Rate | Economy Rate | Bowling SR | Matches Played | Recent Form (1-10) | Sentiment (1-10) | Injury Status | Form Note | Tournament Name
[PLAYERS_END]

Field definitions (in order):
1. Full Name — MUST be exactly "${playerName}" (do not change the name)
2. Team Name — "${teamName}"
3. Role — one of: batsman, bowler, all_rounder, wicket_keeper
4. Nationality — country name (not adjective)
5. Batting Style — e.g. Right-hand bat, Left-hand bat
6. Bowling Style — e.g. Right-arm fast, Left-arm spin, N/A
7. Credits — fantasy value 7.0-10.0
8. Batting Avg — career or tournament batting average
9. Bowling Avg — career or tournament bowling average (N/A for pure batsmen)
10. Strike Rate — batting strike rate (N/A for pure bowlers)
11. Economy Rate — bowling economy rate (N/A for pure batsmen)
12. Bowling SR — bowling strike rate (N/A for pure batsmen)
13. Matches Played — matches in this tournament/series
14. Recent Form (1-10) — last 5 matches performance. 10=exceptional, 5=average, 1=terrible
15. Sentiment (1-10) — current media buzz. 10=massive hype, 5=neutral, 1=controversy
16. Injury Status — one of: fit, doubtful, injured, recovered
17. Form Note — one sentence about current form from recent media
18. Tournament Name — "${tournamentName}"

Use "N/A" for any truly unknown fields. Do NOT guess — only include stats you can verify.

CRITICAL: Return EXACTLY ONE player line for "${playerName}". Use the exact name provided.
`.trim();

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: { tools: [{ googleSearch: {} }] },
    });

    const text: string = response.text || "";
    const players = parsePlayers(text, sport);

    if (players.length === 0) {
      log.warn({ sport, playerName, teamName }, "Single player fetch returned no results");
      return null;
    }

    const player = players[0]!;
    log.info({ sport, playerName, teamName, fieldsReturned: Object.keys(player).length }, "Fetched single player from Gemini");
    return player;
  } catch (error) {
    log.warn({ sport, playerName, teamName, error: String(error) }, "Failed to fetch single player from Gemini");
    return null;
  }
}

/**
 * Fetch latest status for a single match via Gemini AI.
 * Returns status, score, result, toss info, etc.
 */
export interface SingleMatchUpdate {
  status: "upcoming" | "live" | "completed" | "delayed" | "abandoned";
  scoreSummary: string | null;
  result: string | null;
  tossWinner: string | null;
  tossDecision: string | null;
}

export async function fetchSingleMatchStatus(
  teamHome: string,
  teamAway: string,
  tournament: string,
  format: string,
  startTime: Date | string,
  currentScore?: string | null
): Promise<SingleMatchUpdate | null> {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.API_KEY;
  if (!apiKey) return null;

  const ai = await getAI();
  const model = "gemini-3.1-flash-lite-preview";

  const dateStr = new Date(startTime).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const currentScoreContext = currentScore
    ? `\nCURRENT KNOWN SCORE: ${currentScore}\nIMPORTANT: Only return a score that is MORE RECENT than the above. If you cannot find a newer score, return the current score exactly as shown above. NEVER return an older or less detailed score.`
    : "";

  const prompt = `
Search for the LATEST live status of this cricket match:
- ${teamHome} vs ${teamAway}
- Tournament: ${tournament}
- Format: ${format}
- Scheduled: ${dateStr}
${currentScoreContext}

Return the data in this EXACT format:
[MATCH_STATUS_START]
status: <upcoming|live|completed|delayed|abandoned>
score: <MUST include overs, e.g. "India 185/4 (18.2 ov)" or "India 245/10 (50 ov) & 120/3 (30.1 ov) vs Australia 280/10 (49.5 ov)" — ALWAYS include "(X.Y ov)" after each innings score. Use "N/A" only if match not started>
result: <result text, e.g. "India won by 6 wickets" or "Match drawn" or "N/A" if not completed>
toss_winner: <team that won the toss, or "N/A" if toss hasn't happened>
toss_decision: <bat or bowl, or "N/A" if toss hasn't happened>
[MATCH_STATUS_END]

CRITICAL RULES:
1. Score MUST always include overs in parentheses — e.g. "India 30/1 (4.2 ov)" NOT "India 30/1"
2. Only return verified, current information from live sources
3. If the match hasn't started yet, status should be "upcoming" with N/A for score and result
4. Do NOT return a score that is older or less detailed than the current known score
`.trim();

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: { tools: [{ googleSearch: {} }] },
    });

    const text: string = response.text || "";
    const section = text.match(/\[MATCH_STATUS_START\]([\s\S]*?)\[MATCH_STATUS_END\]/);
    if (!section) {
      log.warn({ teamHome, teamAway }, "Single match status fetch returned no parseable data");
      return null;
    }

    const lines = section[1]!.split("\n").map((l) => l.trim()).filter(Boolean);
    const get = (key: string): string | null => {
      const line = lines.find((l) => l.toLowerCase().startsWith(`${key}:`));
      if (!line) return null;
      const val = line.substring(line.indexOf(":") + 1).trim();
      return val === "N/A" || val === "n/a" || val === "" ? null : val;
    };

    const rawStatus = get("status")?.toLowerCase() ?? "upcoming";
    const validStatuses = ["upcoming", "live", "completed", "delayed", "abandoned"] as const;
    const status = validStatuses.includes(rawStatus as any) ? (rawStatus as SingleMatchUpdate["status"]) : "upcoming";

    const result: SingleMatchUpdate = {
      status,
      scoreSummary: get("score"),
      result: get("result"),
      tossWinner: get("toss_winner"),
      tossDecision: get("toss_decision"),
    };

    log.info({ teamHome, teamAway, status: result.status, hasScore: !!result.scoreSummary }, "Fetched single match status from Gemini");
    return result;
  } catch (error) {
    log.warn({ teamHome, teamAway, error: String(error) }, "Failed to fetch single match status from Gemini");
    return null;
  }
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
  const model = "gemini-3.1-flash-lite-preview";
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
  const model = "gemini-3.1-flash-lite-preview";
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
