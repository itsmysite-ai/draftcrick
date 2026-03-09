/**
 * AI Projected Points Engine.
 *
 * Generates fantasy point projections for every player in a match using Gemini.
 * Includes confidence intervals, breakdown, captain rank, differential score.
 *
 * Cache: Redis (1hr) → PostgreSQL → Gemini (on miss).
 */

import { getLogger } from "../lib/logger";
import { createGeminiClientGlobal } from "./gemini-client";
import { getFromHotCache, setHotCache } from "./sports-cache";
import { eq } from "drizzle-orm";
import type { Database } from "@draftplay/db";

const log = getLogger("projection-engine");

const PROJECTION_CACHE_TTL = 3600;
const MODEL = "gemini-3.1-flash-lite-preview";

// ── Types ────────────────────────────────────────────────────

export interface ProjectionBreakdown {
  battingPts: number;
  bowlingPts: number;
  fieldingPts: number;
  bonusPts: number;
}

export interface ProjectionFactors {
  form: number;
  venue: number;
  opposition: number;
  pitch: number;
  position: number;
  importance: number;
}

export interface PlayerProjection {
  playerId: string;
  playerName: string;
  matchId: string;
  role: string;
  projectedPoints: number;
  confidenceLow: number;
  confidenceHigh: number;
  breakdown: ProjectionBreakdown;
  factors: ProjectionFactors;
  captainRank: number;
  differentialScore: number;
  generatedAt: string;
}

export interface MatchProjections {
  matchId: string;
  teamA: string;
  teamB: string;
  players: PlayerProjection[];
  generatedAt: string;
}

// ── Gemini Client ─────────────────────────────────────────────

let _ai: any = null;
async function getAI() {
  if (!_ai) _ai = await createGeminiClientGlobal();
  return _ai;
}

// ── Prompt ────────────────────────────────────────────────────

function buildProjectionPrompt(
  teamA: string,
  teamB: string,
  format: string,
  venue: string | null,
  tournament: string,
  players: Array<{ id: string; name: string; role: string; team: string }>
): string {
  const hasPlayers = players.length > 0;
  const playerList = hasPlayers
    ? players.map((p) => `${p.name} | ${p.id} | ${p.role} | ${p.team}`).join("\n")
    : "";

  const playerSection = hasPlayers
    ? `Players to project:\n${playerList}`
    : `Use Google Search to find the likely playing XI for both ${teamA} and ${teamB}. Project the top 15-20 key players from both squads. For each player, generate a player_id from their name (lowercase, underscores, e.g. virat_kohli).`;

  return `
You are a fantasy cricket analytics expert. Project the fantasy points for each player in this upcoming match.

Match: ${teamA} vs ${teamB}
Format: ${format}
Venue: ${venue ?? "TBD"}
Tournament: ${tournament}

Fantasy scoring rules (T20/ODI):
- Runs: 1pt per run. Fours: +1pt bonus. Sixes: +2pt bonus.
- 50 runs: +8pt. 100 runs: +16pt. Duck: -2pt.
- Wickets: 25pt each. Maiden: 12pt (ODI).
- Catch: 8pt. Stumping: 12pt. Run out: 12pt.
- Economy/strike rate bonuses and penalties apply.

${playerSection}

For EACH player, return projections in this EXACT format:

[PROJECTIONS_START]
Player: <name> | <player_id> | <role>
Projected: <number>
Low: <number>
High: <number>
BattingPts: <number>
BowlingPts: <number>
FieldingPts: <number>
BonusPts: <number>
FormScore: <0-100>
VenueScore: <0-100>
OppositionScore: <0-100>
PitchScore: <0-100>
PositionScore: <0-100>
ImportanceScore: <0-100>
[PLAYER_END]
...repeat for each player...
[PROJECTIONS_END]

Be realistic. Top batsmen: 30-80 pts in T20. Bowlers: 20-60. All-rounders: 40-100+.
Factor in recent form (last 5 innings), venue history, and opposition quality.
`.trim();
}

// ── Parse ─────────────────────────────────────────────────────

function parseProjectionsResponse(text: string, matchId: string): PlayerProjection[] {
  const projections: PlayerProjection[] = [];

  try {
    const block = text.match(/\[PROJECTIONS_START\]([\s\S]*?)\[PROJECTIONS_END\]/);
    if (!block) {
      log.warn({ matchId }, "No projections block found in Gemini response");
      return [];
    }

    const playerBlocks = block[1]!.split("[PLAYER_END]").filter((b) => b.trim());

    for (const pBlock of playerBlocks) {
      const get = (key: string): string => {
        const m = pBlock.match(new RegExp(`${key}:\\s*(.+)`));
        return m?.[1]?.trim() ?? "0";
      };

      const playerLine = get("Player");
      const parts = playerLine.split("|").map((s) => s.trim());
      const playerName = parts[0] ?? "Unknown";
      const playerId = parts[1] ?? playerName.toLowerCase().replace(/[^a-z0-9]+/g, "_");
      const role = parts[2] ?? "BAT";

      const projected = parseFloat(get("Projected")) || 0;
      const low = parseFloat(get("Low")) || Math.max(0, projected - 15);
      const high = parseFloat(get("High")) || projected + 15;

      projections.push({
        playerId,
        playerName,
        matchId,
        role,
        projectedPoints: projected,
        confidenceLow: low,
        confidenceHigh: high,
        breakdown: {
          battingPts: parseFloat(get("BattingPts")) || 0,
          bowlingPts: parseFloat(get("BowlingPts")) || 0,
          fieldingPts: parseFloat(get("FieldingPts")) || 0,
          bonusPts: parseFloat(get("BonusPts")) || 0,
        },
        factors: {
          form: parseInt(get("FormScore")) || 50,
          venue: parseInt(get("VenueScore")) || 50,
          opposition: parseInt(get("OppositionScore")) || 50,
          pitch: parseInt(get("PitchScore")) || 50,
          position: parseInt(get("PositionScore")) || 50,
          importance: parseInt(get("ImportanceScore")) || 50,
        },
        captainRank: 0,
        differentialScore: 0,
        generatedAt: new Date().toISOString(),
      });
    }

    // Captain rank: highest projected = rank 1
    projections.sort((a, b) => b.projectedPoints - a.projectedPoints);
    projections.forEach((p, i) => {
      p.captainRank = i + 1;
      p.differentialScore =
        Math.round(
          ((p.confidenceHigh - p.projectedPoints) / Math.max(p.projectedPoints, 1)) * 100
        ) / 100;
    });
  } catch (error) {
    log.error({ matchId, error: String(error) }, "Failed to parse projections");
  }

  return projections;
}

// ── Core: Generate Projections ────────────────────────────────

export async function generateProjections(
  matchId: string,
  teamA: string,
  teamB: string,
  format: string,
  venue: string | null,
  tournament: string,
  players: Array<{ id: string; name: string; role: string; team: string }>
): Promise<MatchProjections | null> {
  const ai = await getAI();
  const prompt = buildProjectionPrompt(teamA, teamB, format, venue, tournament, players);

  try {
    log.info({ matchId, playerCount: players.length }, "Generating projections via Gemini");

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: { temperature: 0.4, tools: [{ googleSearch: {} }] },
    });

    const text = typeof response.text === "function" ? response.text() : response.text;
    if (!text) {
      log.warn({ matchId }, "Empty Gemini response for projections");
      return null;
    }

    const projections = parseProjectionsResponse(text, matchId);

    return {
      matchId,
      teamA,
      teamB,
      players: projections,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    log.error({ matchId, error: String(error) }, "Gemini projection generation failed");
    return null;
  }
}

// ── Persist to PostgreSQL ─────────────────────────────────────

export async function persistProjections(
  db: Database,
  projections: MatchProjections
): Promise<void> {
  const { playerProjections } = await import("@draftplay/db");

  for (const p of projections.players) {
    await db
      .insert(playerProjections)
      .values({
        playerId: p.playerId,
        matchId: p.matchId,
        projectedPoints: String(p.projectedPoints),
        confidenceLow: String(p.confidenceLow),
        confidenceHigh: String(p.confidenceHigh),
        breakdown: p.breakdown,
        factors: p.factors,
        captainRank: p.captainRank,
        differentialScore: String(p.differentialScore),
      })
      .onConflictDoUpdate({
        target: [playerProjections.playerId, playerProjections.matchId],
        set: {
          projectedPoints: String(p.projectedPoints),
          confidenceLow: String(p.confidenceLow),
          confidenceHigh: String(p.confidenceHigh),
          breakdown: p.breakdown,
          factors: p.factors,
          captainRank: p.captainRank,
          differentialScore: String(p.differentialScore),
          generatedAt: new Date(),
        },
      });
  }

  log.info(
    { matchId: projections.matchId, count: projections.players.length },
    "Projections persisted"
  );
}

// ── Cache-aware Fetch ─────────────────────────────────────────

export async function getProjectionsForMatch(
  db: Database,
  matchId: string,
  teamA: string,
  teamB: string,
  format: string,
  venue: string | null,
  tournament: string,
  players: Array<{ id: string; name: string; role: string; team: string }>
): Promise<MatchProjections | null> {
  const cacheKey = `projections:${matchId}`;

  // 1. Redis hot cache
  const cached = await getFromHotCache<MatchProjections>(cacheKey);
  if (cached) {
    log.debug({ matchId }, "Projections from hot cache");
    return cached;
  }

  // 2. PostgreSQL
  const { playerProjections } = await import("@draftplay/db");
  const rows = await db
    .select()
    .from(playerProjections)
    .where(eq(playerProjections.matchId, matchId));

  if (rows.length > 0) {
    const result: MatchProjections = {
      matchId,
      teamA,
      teamB,
      players: rows.map((r) => ({
        playerId: r.playerId,
        playerName: r.playerId,
        matchId: r.matchId,
        role: "",
        projectedPoints: parseFloat(r.projectedPoints),
        confidenceLow: parseFloat(r.confidenceLow ?? "0"),
        confidenceHigh: parseFloat(r.confidenceHigh ?? "0"),
        breakdown: r.breakdown as ProjectionBreakdown,
        factors: r.factors as ProjectionFactors,
        captainRank: r.captainRank ?? 0,
        differentialScore: parseFloat(r.differentialScore ?? "0"),
        generatedAt: r.generatedAt?.toISOString() ?? new Date().toISOString(),
      })),
      generatedAt: new Date().toISOString(),
    };
    await setHotCache(cacheKey, result, PROJECTION_CACHE_TTL);
    log.debug({ matchId, count: rows.length }, "Projections from PostgreSQL");
    return result;
  }

  // 3. Generate via Gemini
  const result = await generateProjections(
    matchId, teamA, teamB, format, venue, tournament, players
  );
  if (result && result.players.length > 0) {
    await persistProjections(db, result);
    await setHotCache(cacheKey, result, PROJECTION_CACHE_TTL);
  }

  return result;
}
