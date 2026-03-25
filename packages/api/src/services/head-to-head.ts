/**
 * Head-to-Head — AI historical stats service.
 *
 * Provides historical head-to-head records between two cricket teams using Gemini.
 * Includes overall record, format-specific record, recent matches, venue record, and key insight.
 *
 * Cache: PG (6hr TTL) — historical data changes slowly.
 */

import { getLogger } from "../lib/logger";
import { createGeminiClientGlobal } from "./gemini-client";
import { getFromHotCache, setHotCache } from "./sports-cache";

const log = getLogger("head-to-head");

const MODEL = "gemini-2.5-flash";
const H2H_CACHE_TTL = 21600; // 6 hours — historical data changes slowly

// ── Types ────────────────────────────────────────────────────

export interface H2HRecord {
  teamAWins: number;
  teamBWins: number;
  draws: number;
  noResults: number;
  totalMatches: number;
}

export interface RecentMatch {
  date: string;
  venue: string;
  result: string;
  format: string;
}

export interface HeadToHeadResult {
  teamA: string;
  teamB: string;
  overall: H2HRecord;
  inFormat: H2HRecord;
  recentMatches: RecentMatch[];
  venueRecord: string;
  keyInsight: string;
  generatedAt: string;
}

// ── Gemini Client ─────────────────────────────────────────────

let _ai: any = null;
async function getAI() {
  if (!_ai) _ai = await createGeminiClientGlobal();
  return _ai;
}

// ── Cache Key ─────────────────────────────────────────────────

function buildCacheKey(teamA: string, teamB: string, format: string): string {
  // Sort team names alphabetically for consistent cache keys
  const [first, second] = [teamA, teamB].sort();
  return `h2h:${first}:${second}:${format}`;
}

// ── Prompt ────────────────────────────────────────────────────

function buildH2HPrompt(
  teamA: string,
  teamB: string,
  format: string,
  venue: string | null
): string {
  const venueSection = venue
    ? `Venue: ${venue}\nAlso provide the head-to-head record at this specific venue.`
    : `Venue: Not specified\nFor venue record, state "No venue specified".`;

  return `
You are a cricket statistics expert. Provide the complete historical head-to-head record between ${teamA} and ${teamB}.

Teams: ${teamA} vs ${teamB}
Format filter: ${format}
${venueSection}

Use Google Search to find the most accurate and up-to-date statistics.

Return the data in this EXACT format:

[H2H_START]
OverallTeamAWins: <number>
OverallTeamBWins: <number>
OverallDraws: <number>
OverallNoResults: <number>
OverallTotal: <number>
FormatTeamAWins: <number>
FormatTeamBWins: <number>
FormatDraws: <number>
FormatNoResults: <number>
FormatTotal: <number>
Recent1Date: <YYYY-MM-DD>
Recent1Venue: <venue name>
Recent1Result: <e.g. "India won by 5 wickets">
Recent1Format: <T20I/ODI/Test>
Recent2Date: <YYYY-MM-DD>
Recent2Venue: <venue name>
Recent2Result: <result>
Recent2Format: <format>
Recent3Date: <YYYY-MM-DD>
Recent3Venue: <venue name>
Recent3Result: <result>
Recent3Format: <format>
Recent4Date: <YYYY-MM-DD>
Recent4Venue: <venue name>
Recent4Result: <result>
Recent4Format: <format>
Recent5Date: <YYYY-MM-DD>
Recent5Venue: <venue name>
Recent5Result: <result>
Recent5Format: <format>
VenueRecord: <e.g. "India leads 3-1 at this venue" or "No venue specified">
KeyInsight: <one-liner insight about this rivalry>
[H2H_END]

Be factual and accurate. Use real historical data from Google Search.
`.trim();
}

// ── Parse ─────────────────────────────────────────────────────

function parseH2HResponse(
  text: string,
  teamA: string,
  teamB: string
): HeadToHeadResult | null {
  try {
    const block = text.match(/\[H2H_START\]([\s\S]*?)\[H2H_END\]/);
    if (!block) {
      log.warn("No H2H block found in Gemini response");
      return null;
    }

    const content = block[1]!;
    const get = (key: string): string => {
      const m = content.match(new RegExp(`${key}:\\s*(.+)`));
      return m?.[1]?.trim() ?? "";
    };

    const overall: H2HRecord = {
      teamAWins: parseInt(get("OverallTeamAWins")) || 0,
      teamBWins: parseInt(get("OverallTeamBWins")) || 0,
      draws: parseInt(get("OverallDraws")) || 0,
      noResults: parseInt(get("OverallNoResults")) || 0,
      totalMatches: parseInt(get("OverallTotal")) || 0,
    };

    const inFormat: H2HRecord = {
      teamAWins: parseInt(get("FormatTeamAWins")) || 0,
      teamBWins: parseInt(get("FormatTeamBWins")) || 0,
      draws: parseInt(get("FormatDraws")) || 0,
      noResults: parseInt(get("FormatNoResults")) || 0,
      totalMatches: parseInt(get("FormatTotal")) || 0,
    };

    const recentMatches: RecentMatch[] = [];
    for (let i = 1; i <= 5; i++) {
      const date = get(`Recent${i}Date`);
      const venue = get(`Recent${i}Venue`);
      const result = get(`Recent${i}Result`);
      const format = get(`Recent${i}Format`);
      if (date && result) {
        recentMatches.push({ date, venue, result, format });
      }
    }

    return {
      teamA,
      teamB,
      overall,
      inFormat,
      recentMatches,
      venueRecord: get("VenueRecord") || "No venue data available",
      keyInsight: get("KeyInsight") || "No insight available",
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    log.error({ error: String(error) }, "Failed to parse H2H response");
    return null;
  }
}

// ── Core: Get Head-to-Head ────────────────────────────────────

export async function getHeadToHead(
  teamA: string,
  teamB: string,
  format: string,
  venue: string | null
): Promise<HeadToHeadResult | null> {
  const cacheKey = buildCacheKey(teamA, teamB, format);

  // Check cache first — historical data changes slowly
  try {
    const cached = await getFromHotCache<HeadToHeadResult>(cacheKey);
    if (cached) {
      log.info({ teams: `${teamA} vs ${teamB}`, format }, "Returning cached H2H record");
      return cached;
    }
  } catch (error) {
    log.warn({ error: String(error) }, "Cache read failed, proceeding to Gemini");
  }

  const ai = await getAI();
  const prompt = buildH2HPrompt(teamA, teamB, format, venue);

  try {
    log.info(
      { teams: `${teamA} vs ${teamB}`, format, venue },
      "Fetching H2H record via Gemini"
    );

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: { temperature: 0, tools: [{ googleSearch: {} }] },
    });

    const text = typeof response.text === "function" ? response.text() : response.text;
    if (!text) {
      log.warn("Empty Gemini response for H2H query");
      return null;
    }

    const result = parseH2HResponse(text, teamA, teamB);

    // Cache the result — historical data is stable
    if (result) {
      try {
        await setHotCache(cacheKey, result, H2H_CACHE_TTL);
        log.info({ cacheKey }, "Cached H2H record for 6 hours");
      } catch (error) {
        log.warn({ error: String(error) }, "Cache write failed");
      }
    }

    return result;
  } catch (error) {
    log.error({ error: String(error) }, "Gemini H2H query failed");
    return null;
  }
}
