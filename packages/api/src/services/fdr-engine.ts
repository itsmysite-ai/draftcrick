/**
 * Fixture Difficulty Rating (FDR) Engine.
 *
 * Generates 1-5 difficulty ratings for each team in each match using Gemini AI.
 * Factors: opposition strength, venue history, recent form, head-to-head,
 * pitch type, day/night, weather, tournament stage.
 *
 * Cache: Redis hot cache (1hr) → PostgreSQL (source of truth) → Gemini (on miss).
 */

import { getLogger } from "../lib/logger";
import { createGeminiClientGlobal } from "./gemini-client";
import { getFromHotCache, setHotCache } from "./sports-cache";
import { eq, and } from "drizzle-orm";
import type { Database } from "@draftplay/db";

const log = getLogger("fdr-engine");

const FDR_CACHE_TTL = 3600; // 1 hour
const MODEL = "gemini-3.1-flash-lite-preview";

// ── Types ────────────────────────────────────────────────────

export interface FDRFactors {
  oppositionRank: number;
  recentForm: string;
  venueHistory: { battingAvg: number; bowlingAvg: number } | null;
  pitchType: string;
  dayNight: boolean;
  weather: string;
  h2hRecord: { wins: number; losses: number } | null;
  tournamentStage: string;
}

export interface FDRResult {
  matchId: string;
  teamId: string;
  teamName: string;
  overallFdr: number; // 1-5
  battingFdr: number; // 1-5
  bowlingFdr: number; // 1-5
  factors: FDRFactors;
  generatedAt: string;
}

export interface MatchFDR {
  matchId: string;
  teamA: FDRResult;
  teamB: FDRResult;
}

// ── Gemini AI Client ──────────────────────────────────────────

let _ai: any = null;
async function getAI() {
  if (!_ai) {
    _ai = await createGeminiClientGlobal();
  }
  return _ai;
}

// ── FDR Prompt ────────────────────────────────────────────────

function buildFDRPrompt(
  teamA: string,
  teamB: string,
  format: string,
  venue: string | null,
  tournament: string
): string {
  return `
You are a cricket analytics expert. Analyze the fixture difficulty for both teams in this match.

Match: ${teamA} vs ${teamB}
Format: ${format}
Venue: ${venue ?? "TBD"}
Tournament: ${tournament}

For EACH team, rate the difficulty of this fixture on a scale of 1-5:
- 1 = Very Easy (weak opposition, favorable conditions)
- 2 = Easy
- 3 = Medium (evenly matched)
- 4 = Hard
- 5 = Very Hard (strong opposition, unfavorable conditions)

Consider these factors:
1. Team rankings and recent form (last 5 matches)
2. Head-to-head record between these teams
3. Venue/pitch history (batting vs bowling friendly)
4. Day/night match factor
5. Weather conditions
6. Tournament stage importance (group vs knockout)

Return the data in EXACTLY this format:

[FDR_START]
Team: ${teamA}
OverallFDR: <1-5>
BattingFDR: <1-5>
BowlingFDR: <1-5>
OppositionRank: <1-20>
RecentForm: <W/L pattern like WWLWL>
PitchType: <batting_friendly|bowling_friendly|balanced|unknown>
DayNight: <true|false>
Weather: <clear|overcast|rain_likely|hot|humid>
H2HWins: <number>
H2HLosses: <number>
TournamentStage: <group|qualifier|semifinal|final|league>
VenueBatAvg: <number or 0>
VenueBowlAvg: <number or 0>
[FDR_SEPARATOR]
Team: ${teamB}
OverallFDR: <1-5>
BattingFDR: <1-5>
BowlingFDR: <1-5>
OppositionRank: <1-20>
RecentForm: <W/L pattern>
PitchType: <batting_friendly|bowling_friendly|balanced|unknown>
DayNight: <true|false>
Weather: <clear|overcast|rain_likely|hot|humid>
H2HWins: <number>
H2HLosses: <number>
TournamentStage: <group|qualifier|semifinal|final|league>
VenueBatAvg: <number or 0>
VenueBowlAvg: <number or 0>
[FDR_END]
`.trim();
}

// ── Parse FDR Response ────────────────────────────────────────

function parseFDRResponse(
  text: string,
  matchId: string,
  teamA: string,
  teamB: string
): MatchFDR | null {
  try {
    const fdrBlock = text.match(/\[FDR_START\]([\s\S]*?)\[FDR_END\]/);
    if (!fdrBlock) {
      log.warn({ matchId }, "No FDR block found in Gemini response");
      return null;
    }

    const parts = fdrBlock[1]!.split("[FDR_SEPARATOR]");
    if (parts.length < 2) {
      log.warn({ matchId }, "FDR response missing separator");
      return null;
    }

    function parseTeam(block: string, teamName: string): FDRResult {
      const get = (key: string): string => {
        const match = block.match(new RegExp(`${key}:\\s*(.+)`));
        return match?.[1]?.trim() ?? "";
      };

      const clampFdr = (val: number): number => Math.max(1, Math.min(5, val || 3));

      return {
        matchId,
        teamId: teamName.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
        teamName,
        overallFdr: clampFdr(parseInt(get("OverallFDR"))),
        battingFdr: clampFdr(parseInt(get("BattingFDR"))),
        bowlingFdr: clampFdr(parseInt(get("BowlingFDR"))),
        factors: {
          oppositionRank: parseInt(get("OppositionRank")) || 10,
          recentForm: get("RecentForm") || "UNKNOWN",
          venueHistory: (() => {
            const bat = parseFloat(get("VenueBatAvg"));
            const bowl = parseFloat(get("VenueBowlAvg"));
            return bat || bowl ? { battingAvg: bat || 0, bowlingAvg: bowl || 0 } : null;
          })(),
          pitchType: get("PitchType") || "unknown",
          dayNight: get("DayNight") === "true",
          weather: get("Weather") || "clear",
          h2hRecord: (() => {
            const w = parseInt(get("H2HWins"));
            const l = parseInt(get("H2HLosses"));
            return !isNaN(w) && !isNaN(l) ? { wins: w, losses: l } : null;
          })(),
          tournamentStage: get("TournamentStage") || "group",
        },
        generatedAt: new Date().toISOString(),
      };
    }

    return {
      matchId,
      teamA: parseTeam(parts[0]!, teamA),
      teamB: parseTeam(parts[1]!, teamB),
    };
  } catch (error) {
    log.error({ matchId, error: String(error) }, "Failed to parse FDR response");
    return null;
  }
}

// ── Core: Generate FDR ───────────────────────────────────────

export async function generateFDR(
  matchId: string,
  teamA: string,
  teamB: string,
  format: string,
  venue: string | null,
  tournament: string
): Promise<MatchFDR | null> {
  const ai = await getAI();
  const prompt = buildFDRPrompt(teamA, teamB, format, venue, tournament);

  try {
    log.info({ matchId, teamA, teamB }, "Generating FDR via Gemini");

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        temperature: 0.3,
        tools: [{ googleSearch: {} }],
      },
    });

    const text = typeof response.text === "function" ? response.text() : response.text;
    if (!text) {
      log.warn({ matchId }, "Empty Gemini response for FDR");
      return null;
    }

    return parseFDRResponse(text, matchId, teamA, teamB);
  } catch (error) {
    log.error({ matchId, error: String(error) }, "Gemini FDR generation failed");
    return null;
  }
}

// ── Persist to PostgreSQL ─────────────────────────────────────

export async function persistFDR(db: Database, fdr: MatchFDR): Promise<void> {
  // Dynamic import to avoid circular deps
  const { fixtureDifficulty } = await import("@draftplay/db");

  for (const team of [fdr.teamA, fdr.teamB]) {
    await db
      .insert(fixtureDifficulty)
      .values({
        matchId: team.matchId,
        teamId: team.teamId,
        overallFdr: team.overallFdr,
        battingFdr: team.battingFdr,
        bowlingFdr: team.bowlingFdr,
        factors: team.factors,
        generatedBy: "ai",
      })
      .onConflictDoUpdate({
        target: [fixtureDifficulty.matchId, fixtureDifficulty.teamId],
        set: {
          overallFdr: team.overallFdr,
          battingFdr: team.battingFdr,
          bowlingFdr: team.bowlingFdr,
          factors: team.factors,
          generatedAt: new Date(),
        },
      });
  }

  log.info({ matchId: fdr.matchId }, "FDR persisted to database");
}

// ── Cache-aware Fetch ─────────────────────────────────────────

export async function getFDRForMatch(
  db: Database,
  matchId: string,
  teamA: string,
  teamB: string,
  format: string,
  venue: string | null,
  tournament: string
): Promise<MatchFDR | null> {
  const cacheKey = `fdr:${matchId}`;

  // 1. Check Redis hot cache
  const cached = await getFromHotCache<MatchFDR>(cacheKey);
  if (cached) {
    log.debug({ matchId }, "FDR from hot cache");
    return cached;
  }

  // 2. Check PostgreSQL
  const { fixtureDifficulty } = await import("@draftplay/db");
  const rows = await db
    .select()
    .from(fixtureDifficulty)
    .where(eq(fixtureDifficulty.matchId, matchId));

  if (rows.length >= 2) {
    const result: MatchFDR = {
      matchId,
      teamA: dbRowToFDR(rows[0], teamA),
      teamB: dbRowToFDR(rows[1], teamB),
    };
    await setHotCache(cacheKey, result, FDR_CACHE_TTL);
    log.debug({ matchId }, "FDR from PostgreSQL");
    return result;
  }

  // 3. Generate via Gemini
  const fdr = await generateFDR(matchId, teamA, teamB, format, venue, tournament);
  if (fdr) {
    await persistFDR(db, fdr);
    await setHotCache(cacheKey, fdr, FDR_CACHE_TTL);
  }

  return fdr;
}

function dbRowToFDR(row: any, teamName: string): FDRResult {
  return {
    matchId: row.matchId,
    teamId: row.teamId,
    teamName,
    overallFdr: row.overallFdr,
    battingFdr: row.battingFdr,
    bowlingFdr: row.bowlingFdr,
    factors: (row.factors as FDRFactors) ?? {
      oppositionRank: 10,
      recentForm: "UNKNOWN",
      venueHistory: null,
      pitchType: "unknown",
      dayNight: false,
      weather: "clear",
      h2hRecord: null,
      tournamentStage: "group",
    },
    generatedAt: row.generatedAt?.toISOString() ?? new Date().toISOString(),
  };
}

// ── Batch Generate for Tournament ─────────────────────────────

export async function batchGenerateFDR(
  db: Database,
  matches: Array<{
    id: string;
    teamHome: string;
    teamAway: string;
    format: string;
    venue: string | null;
    tournament: string;
  }>
): Promise<{ generated: number; failed: number }> {
  let generated = 0;
  let failed = 0;

  for (const match of matches) {
    try {
      const fdr = await getFDRForMatch(
        db,
        match.id,
        match.teamHome,
        match.teamAway,
        match.format,
        match.venue,
        match.tournament
      );
      if (fdr) generated++;
      else failed++;
    } catch (error) {
      log.error({ matchId: match.id, error: String(error) }, "Batch FDR failed for match");
      failed++;
    }

    // Rate limit: 500ms between Gemini calls
    await new Promise((r) => setTimeout(r, 500));
  }

  log.info({ generated, failed, total: matches.length }, "Batch FDR generation complete");
  return { generated, failed };
}
