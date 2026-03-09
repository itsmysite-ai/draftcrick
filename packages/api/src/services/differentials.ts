/**
 * Differentials — AI low-ownership, high-upside player picks.
 *
 * Identifies players with low expected ownership but high projected points,
 * giving users an edge in head-to-head and tournament fantasy contests.
 *
 * Cache: Redis (2hr TTL) → Gemini (on miss).
 */

import { getLogger } from "../lib/logger";
import { createGeminiClientGlobal } from "./gemini-client";
import { getFromHotCache, setHotCache } from "./sports-cache";

const log = getLogger("differentials");

const MODEL = "gemini-2.0-flash";
const DIFFERENTIALS_CACHE_TTL = 7200; // 2 hours

// ── Types ────────────────────────────────────────────────────

export interface DifferentialPick {
  playerName: string;
  role: string;
  team: string;
  expectedOwnership: number; // percentage, e.g. 15
  projectedPoints: number;
  upsideReason: string;
  riskLevel: "low" | "medium" | "high";
}

export interface DifferentialsResult {
  matchId: string;
  picks: DifferentialPick[]; // 5 picks
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

function buildDifferentialsPrompt(
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
You are a fantasy cricket expert specializing in differential picks. Identify 5 low-ownership, high-upside players for this match.

Match: ${teamA} vs ${teamB}
Format: ${format}
Venue: ${venue ?? "TBD"}
Tournament: ${tournament}

Available Players:
${playerList}

A differential pick is a player that:
- Is expected to be selected by fewer than 20% of fantasy teams
- Has a realistic upside scenario where they score significantly more than expected
- Provides value relative to their expected ownership

Use Google Search to check recent form, venue history, head-to-head stats, and team news.

Return EXACTLY 5 differential picks in this format:

[DIFF_START]
Pick1Name: <player name>
Pick1Role: <BAT|BOWL|AR|WK>
Pick1Team: <team name>
Pick1Ownership: <expected ownership percentage, e.g. 12>
Pick1Points: <projected fantasy points>
Pick1Reason: <one sentence explaining the upside>
Pick1Risk: <low|medium|high>
Pick2Name: <player name>
Pick2Role: <BAT|BOWL|AR|WK>
Pick2Team: <team name>
Pick2Ownership: <expected ownership percentage>
Pick2Points: <projected fantasy points>
Pick2Reason: <one sentence explaining the upside>
Pick2Risk: <low|medium|high>
Pick3Name: <player name>
Pick3Role: <BAT|BOWL|AR|WK>
Pick3Team: <team name>
Pick3Ownership: <expected ownership percentage>
Pick3Points: <projected fantasy points>
Pick3Reason: <one sentence explaining the upside>
Pick3Risk: <low|medium|high>
Pick4Name: <player name>
Pick4Role: <BAT|BOWL|AR|WK>
Pick4Team: <team name>
Pick4Ownership: <expected ownership percentage>
Pick4Points: <projected fantasy points>
Pick4Reason: <one sentence explaining the upside>
Pick4Risk: <low|medium|high>
Pick5Name: <player name>
Pick5Role: <BAT|BOWL|AR|WK>
Pick5Team: <team name>
Pick5Ownership: <expected ownership percentage>
Pick5Points: <projected fantasy points>
Pick5Reason: <one sentence explaining the upside>
Pick5Risk: <low|medium|high>
Summary: <2-3 sentence overall summary of the differential strategy>
[DIFF_END]
`.trim();
}

// ── Parse ─────────────────────────────────────────────────────

function parseDifferentialsResponse(text: string, matchId: string): DifferentialsResult | null {
  try {
    const block = text.match(/\[DIFF_START\]([\s\S]*?)\[DIFF_END\]/);
    if (!block) {
      log.warn({ matchId }, "No differentials block found in Gemini response");
      return null;
    }

    const content = block[1]!;
    const get = (key: string): string => {
      const m = content.match(new RegExp(`${key}:\\s*(.+)`));
      return m?.[1]?.trim() ?? "";
    };

    const picks: DifferentialPick[] = [];
    for (let i = 1; i <= 5; i++) {
      const name = get(`Pick${i}Name`);
      if (!name) continue;

      const riskRaw = get(`Pick${i}Risk`).toLowerCase();
      const riskLevel: "low" | "medium" | "high" =
        riskRaw === "low" || riskRaw === "medium" || riskRaw === "high"
          ? riskRaw
          : "medium";

      picks.push({
        playerName: name,
        role: get(`Pick${i}Role`) || "BAT",
        team: get(`Pick${i}Team`) || "",
        expectedOwnership: parseFloat(get(`Pick${i}Ownership`)) || 10,
        projectedPoints: parseFloat(get(`Pick${i}Points`)) || 0,
        upsideReason: get(`Pick${i}Reason`) || "",
        riskLevel,
      });
    }

    return {
      matchId,
      picks,
      summary: get("Summary") || "Differential analysis unavailable.",
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    log.error({ matchId, error: String(error) }, "Failed to parse differentials response");
    return null;
  }
}

// ── Core: Get Differentials ──────────────────────────────────

export async function getDifferentials(
  matchId: string,
  teamA: string,
  teamB: string,
  format: string,
  venue: string | null,
  tournament: string,
  players: Array<{ name: string; role: string; team: string }>
): Promise<DifferentialsResult | null> {
  const cacheKey = `differentials:${matchId}`;

  // Check cache first
  try {
    const cached = await getFromHotCache<DifferentialsResult>(cacheKey);
    if (cached) {
      log.info({ matchId, match: `${teamA} vs ${teamB}` }, "Returning cached differentials");
      return cached;
    }
  } catch (error) {
    log.warn({ error: String(error) }, "Cache read failed, proceeding to Gemini");
  }

  const ai = await getAI();
  const prompt = buildDifferentialsPrompt(teamA, teamB, format, venue, tournament, players);

  try {
    log.info(
      { matchId, playerCount: players.length, match: `${teamA} vs ${teamB}` },
      "Generating differentials via Gemini"
    );

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: { temperature: 0.3, tools: [{ googleSearch: {} }] },
    });

    const text = typeof response.text === "function" ? response.text() : response.text;
    if (!text) {
      log.warn({ matchId }, "Empty Gemini response for differentials");
      return null;
    }

    const result = parseDifferentialsResponse(text, matchId);

    // Cache the result
    if (result) {
      try {
        await setHotCache(cacheKey, result, DIFFERENTIALS_CACHE_TTL);
        log.info({ cacheKey }, "Cached differentials for 2 hours");
      } catch (error) {
        log.warn({ error: String(error) }, "Cache write failed");
      }
    }

    return result;
  } catch (error) {
    log.error({ matchId, error: String(error) }, "Gemini differentials generation failed");
    return null;
  }
}
