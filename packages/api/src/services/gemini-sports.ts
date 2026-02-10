/**
 * Gemini AI sports data service with Google Search grounding.
 * Sport-agnostic: pass any SportPromptConfig to fetch data for that sport.
 * Uses gemini-2.5-flash with googleSearch tool for real-time data.
 */

import type {
  AITournament,
  AIMatch,
  SportsDashboardData,
  AIMatchStatus,
  TournamentCategory,
} from "@draftcrick/shared";
import { SPORT_CONFIGS, DEFAULT_SPORT } from "@draftcrick/shared";
import type { Sport } from "@draftcrick/shared";

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

Category must be one of: international, domestic, league, bilateral, qualifier, friendly
Status must be one of: upcoming, live, completed, delayed, abandoned
Format examples: ${SPORT_CONFIGS[sport]?.formatExamples.join(", ") ?? "League"}
Use local time with timezone (e.g., "11:00 AM IST", "3:00 PM GMT")
Date format: "Mon DD, YYYY" (e.g., "Feb 10, 2026")
StartDate/EndDate format: "YYYY-MM-DD" or "unknown"

Example:
Tournament: ICC Men's T20 World Cup 2026 | international | 2026-02-01 | 2026-03-15
Match: India vs Pakistan | T20 | 7:30 PM IST | Feb 12, 2026 | upcoming | ICC Men's T20 World Cup 2026 | Dubai International Stadium

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

      matches.push({
        id: `ai-match-${sport}-${index}`,
        teamA: teams[0] || "TBA",
        teamB: teams[1] || "TBA",
        sport,
        format: parts[1] || "Unknown",
        time: parts[2] || "TBD",
        date: parts[3] || "TBD",
        status: validStatuses.includes(status) ? status : "upcoming",
        tournamentName: parts[5] || "Unknown Tournament",
        venue: parts[6] || null,
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
    console.warn("No GEMINI_API_KEY or API_KEY set — returning empty sports data");
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
    console.error(`Gemini sports fetch failed for ${sport}:`, error);
    return {
      tournaments: [],
      matches: [],
      lastFetched: new Date().toISOString(),
      sources: [],
      sport,
    };
  }
}
