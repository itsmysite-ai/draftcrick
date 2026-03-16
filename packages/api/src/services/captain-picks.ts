/**
 * Captain Picks — AI captain/vice-captain recommendation service.
 *
 * Recommends the best captain and vice-captain picks for a fantasy cricket match
 * using Gemini AI with real-time search grounding. Returns top 3 captain picks,
 * top 3 vice-captain picks, and 2 players to avoid as C/VC.
 */

import { getLogger } from "../lib/logger";
import { createGeminiClientGlobal } from "./gemini-client";
import { getFromHotCache, setHotCache } from "./sports-cache";

const log = getLogger("captain-picks");

const MODEL = "gemini-3.1-flash-lite-preview";
const CAPTAIN_PICKS_CACHE_TTL = 7200; // 2 hours

// ── Types ────────────────────────────────────────────────────

export interface CaptainPick {
  playerName: string;
  role: string; // batsman, bowler, all_rounder, wicket_keeper
  team: string;
  reason: string;
  projectedImpact: number; // expected fantasy points
  confidence: "high" | "medium" | "low";
}

export interface CaptainPicksResult {
  matchId: string;
  captainPicks: CaptainPick[]; // top 3
  viceCaptainPicks: CaptainPick[]; // top 3
  avoidPicks: CaptainPick[]; // 2 players to avoid as C/VC
  summary: string;
  generatedAt: string;
}

// ── Gemini Client ─────────────────────────────────────────────

let _ai: any = null;
async function getAI() {
  if (!_ai) _ai = await createGeminiClientGlobal();
  return _ai;
}

// ── Prompt ────────────────────────────────────────────────────

function buildCaptainPicksPrompt(
  teamA: string,
  teamB: string,
  format: string,
  venue: string | null,
  tournament: string,
  players: Array<{ name: string; role: string; team: string }>
): string {
  const playerList = players
    .map((p) => `${p.name} | ${p.role} | ${p.team}`)
    .join("\n");

  return `
You are a fantasy cricket expert specializing in captain and vice-captain selection strategy.

Match Context:
- Teams: ${teamA} vs ${teamB}
- Format: ${format}
- Venue: ${venue ?? "TBD"}
- Tournament: ${tournament}

Available Players:
${playerList}

Analyze each player's recent form, venue history, matchup advantages, and fantasy scoring potential.

Captain (C) gets a 2x points multiplier — pick players with the HIGHEST ceiling.
Vice-Captain (VC) gets a 1.5x points multiplier — pick consistent high scorers.
Avoid picks are players who look tempting but have hidden risks (poor form, bad matchup, injury concerns).

Provide:
1. Top 3 Captain picks (ranked best to third-best)
2. Top 3 Vice-Captain picks (ranked best to third-best)
3. 2 Players to AVOID as C/VC (with clear reasons)

Return in this EXACT format:

[PICKS_START]
C1_PlayerName: <name>
C1_Role: <batsman|bowler|all_rounder|wicket_keeper>
C1_Team: <team>
C1_Reason: <one sentence>
C1_ProjectedImpact: <number>
C1_Confidence: <high|medium|low>
C2_PlayerName: <name>
C2_Role: <batsman|bowler|all_rounder|wicket_keeper>
C2_Team: <team>
C2_Reason: <one sentence>
C2_ProjectedImpact: <number>
C2_Confidence: <high|medium|low>
C3_PlayerName: <name>
C3_Role: <batsman|bowler|all_rounder|wicket_keeper>
C3_Team: <team>
C3_Reason: <one sentence>
C3_ProjectedImpact: <number>
C3_Confidence: <high|medium|low>
VC1_PlayerName: <name>
VC1_Role: <batsman|bowler|all_rounder|wicket_keeper>
VC1_Team: <team>
VC1_Reason: <one sentence>
VC1_ProjectedImpact: <number>
VC1_Confidence: <high|medium|low>
VC2_PlayerName: <name>
VC2_Role: <batsman|bowler|all_rounder|wicket_keeper>
VC2_Team: <team>
VC2_Reason: <one sentence>
VC2_ProjectedImpact: <number>
VC2_Confidence: <high|medium|low>
VC3_PlayerName: <name>
VC3_Role: <batsman|bowler|all_rounder|wicket_keeper>
VC3_Team: <team>
VC3_Reason: <one sentence>
VC3_ProjectedImpact: <number>
VC3_Confidence: <high|medium|low>
AVOID1_PlayerName: <name>
AVOID1_Role: <batsman|bowler|all_rounder|wicket_keeper>
AVOID1_Team: <team>
AVOID1_Reason: <one sentence>
AVOID1_ProjectedImpact: <number>
AVOID1_Confidence: <high|medium|low>
AVOID2_PlayerName: <name>
AVOID2_Role: <batsman|bowler|all_rounder|wicket_keeper>
AVOID2_Team: <team>
AVOID2_Reason: <one sentence>
AVOID2_ProjectedImpact: <number>
AVOID2_Confidence: <high|medium|low>
Summary: <2-3 sentence overall captain/VC strategy for this match>
[PICKS_END]
`.trim();
}

// ── Parse ─────────────────────────────────────────────────────

function parsePick(content: string, prefix: string): CaptainPick | null {
  const get = (key: string): string => {
    const m = content.match(new RegExp(`${prefix}_${key}:\\s*(.+)`));
    return m?.[1]?.trim() ?? "";
  };

  const playerName = get("PlayerName");
  if (!playerName) return null;

  const confidence = get("Confidence").toLowerCase();

  return {
    playerName,
    role: get("Role") || "batsman",
    team: get("Team") || "",
    reason: get("Reason") || "",
    projectedImpact: parseFloat(get("ProjectedImpact")) || 0,
    confidence: (["high", "medium", "low"].includes(confidence) ? confidence : "medium") as
      | "high"
      | "medium"
      | "low",
  };
}

function parseCaptainPicksResponse(text: string, matchId: string): CaptainPicksResult | null {
  try {
    const block = text.match(/\[PICKS_START\]([\s\S]*?)\[PICKS_END\]/);
    if (!block) {
      log.warn("No picks block found in Gemini response");
      return null;
    }

    const content = block[1]!;
    const get = (key: string): string => {
      const m = content.match(new RegExp(`${key}:\\s*(.+)`));
      return m?.[1]?.trim() ?? "";
    };

    const captainPicks: CaptainPick[] = [];
    for (let i = 1; i <= 3; i++) {
      const pick = parsePick(content, `C${i}`);
      if (pick) captainPicks.push(pick);
    }

    const viceCaptainPicks: CaptainPick[] = [];
    for (let i = 1; i <= 3; i++) {
      const pick = parsePick(content, `VC${i}`);
      if (pick) viceCaptainPicks.push(pick);
    }

    const avoidPicks: CaptainPick[] = [];
    for (let i = 1; i <= 2; i++) {
      const pick = parsePick(content, `AVOID${i}`);
      if (pick) avoidPicks.push(pick);
    }

    return {
      matchId,
      captainPicks,
      viceCaptainPicks,
      avoidPicks,
      summary: get("Summary") || "Captain picks analysis unavailable.",
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    log.error({ error: String(error) }, "Failed to parse captain picks response");
    return null;
  }
}

// ── Core: Get Captain Picks ───────────────────────────────────

export async function getCaptainPicks(
  matchId: string,
  teamA: string,
  teamB: string,
  format: string,
  venue: string | null,
  tournament: string,
  players: Array<{ name: string; role: string; team: string }>
): Promise<CaptainPicksResult | null> {
  const cacheKey = `captain-picks:${matchId}`;

  // Check cache first
  try {
    const cached = await getFromHotCache<CaptainPicksResult>(cacheKey);
    if (cached) {
      log.info({ match: `${teamA} vs ${teamB}` }, "Returning cached captain picks");
      return cached;
    }
  } catch (error) {
    log.warn({ error: String(error) }, "Cache read failed, proceeding to Gemini");
  }

  const ai = await getAI();
  const prompt = buildCaptainPicksPrompt(teamA, teamB, format, venue, tournament, players);

  try {
    log.info(
      { playerCount: players.length, match: `${teamA} vs ${teamB}`, format },
      "Fetching captain picks via Gemini"
    );

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: { temperature: 0.2, tools: [{ googleSearch: {} }] },
    });

    const text = typeof response.text === "function" ? response.text() : response.text;
    if (!text) {
      log.warn("Empty Gemini response for captain picks");
      return null;
    }

    const result = parseCaptainPicksResponse(text, matchId);

    // Cache the result
    if (result) {
      try {
        await setHotCache(cacheKey, result, CAPTAIN_PICKS_CACHE_TTL);
        log.info({ cacheKey }, "Cached captain picks for 2 hours");
      } catch (error) {
        log.warn({ error: String(error) }, "Cache write failed");
      }
    }

    return result;
  } catch (error) {
    log.error({ error: String(error) }, "Gemini captain picks failed");
    return null;
  }
}
