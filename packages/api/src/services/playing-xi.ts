/**
 * Playing XI Predictor — AI-predicted playing XI before toss.
 *
 * Uses recent team news, injury reports, and squad history to predict
 * the likely playing XI for both teams in an upcoming match.
 *
 * Cache: Redis (1hr TTL) → Gemini (on miss).
 */

import { getLogger } from "../lib/logger";
import { createGeminiClientGlobal } from "./gemini-client";
import { getFromHotCache, setHotCache } from "./sports-cache";

const log = getLogger("playing-xi");

const MODEL = "gemini-3.1-flash-lite-preview";
const PLAYING_XI_CACHE_TTL = 3600; // 1 hour — changes as toss approaches

// ── Types ────────────────────────────────────────────────────

export interface PredictedPlayer {
  name: string;
  role: string;
  team: string;
  confidence: number; // 0-100
  notes: string; // e.g. "returning from injury" or "likely dropped"
}

export interface PlayingXIResult {
  matchId: string;
  teamA: {
    teamName: string;
    predictedXI: PredictedPlayer[]; // 11 players
    benchPlayers: PredictedPlayer[]; // 2-3 who might miss out
  };
  teamB: {
    teamName: string;
    predictedXI: PredictedPlayer[];
    benchPlayers: PredictedPlayer[];
  };
  keyChanges: string[]; // notable changes from last match
  generatedAt: string;
}

// ── Gemini Client ─────────────────────────────────────────────

let _ai: any = null;
async function getAI() {
  if (!_ai) _ai = await createGeminiClientGlobal();
  return _ai;
}

// ── Prompt ────────────────────────────────────────────────────

function buildPlayingXIPrompt(
  teamA: string,
  teamB: string,
  format: string,
  venue: string | null,
  tournament: string
): string {
  return `
You are a cricket analyst predicting the likely playing XI for both teams before the toss.

Match: ${teamA} vs ${teamB}
Format: ${format}
Venue: ${venue ?? "TBD"}
Tournament: ${tournament}

Use Google Search to find:
1. The most recent squad announcements for both teams
2. Any injury news or player availability updates
3. The playing XI from each team's last match
4. Venue conditions that might influence team selection (e.g. extra spinner/pacer)

For each team, predict:
- 11 players in the predicted playing XI
- 2-3 bench players who might miss out
- Confidence level (0-100) for each player's inclusion

Return in this EXACT format:

[XI_START]
TeamAName: ${teamA}
TeamA_P1Name: <player name>
TeamA_P1Role: <BAT|BOWL|AR|WK>
TeamA_P1Confidence: <0-100>
TeamA_P1Notes: <brief note>
TeamA_P2Name: <player name>
TeamA_P2Role: <BAT|BOWL|AR|WK>
TeamA_P2Confidence: <0-100>
TeamA_P2Notes: <brief note>
TeamA_P3Name: <player name>
TeamA_P3Role: <BAT|BOWL|AR|WK>
TeamA_P3Confidence: <0-100>
TeamA_P3Notes: <brief note>
TeamA_P4Name: <player name>
TeamA_P4Role: <BAT|BOWL|AR|WK>
TeamA_P4Confidence: <0-100>
TeamA_P4Notes: <brief note>
TeamA_P5Name: <player name>
TeamA_P5Role: <BAT|BOWL|AR|WK>
TeamA_P5Confidence: <0-100>
TeamA_P5Notes: <brief note>
TeamA_P6Name: <player name>
TeamA_P6Role: <BAT|BOWL|AR|WK>
TeamA_P6Confidence: <0-100>
TeamA_P6Notes: <brief note>
TeamA_P7Name: <player name>
TeamA_P7Role: <BAT|BOWL|AR|WK>
TeamA_P7Confidence: <0-100>
TeamA_P7Notes: <brief note>
TeamA_P8Name: <player name>
TeamA_P8Role: <BAT|BOWL|AR|WK>
TeamA_P8Confidence: <0-100>
TeamA_P8Notes: <brief note>
TeamA_P9Name: <player name>
TeamA_P9Role: <BAT|BOWL|AR|WK>
TeamA_P9Confidence: <0-100>
TeamA_P9Notes: <brief note>
TeamA_P10Name: <player name>
TeamA_P10Role: <BAT|BOWL|AR|WK>
TeamA_P10Confidence: <0-100>
TeamA_P10Notes: <brief note>
TeamA_P11Name: <player name>
TeamA_P11Role: <BAT|BOWL|AR|WK>
TeamA_P11Confidence: <0-100>
TeamA_P11Notes: <brief note>
TeamA_Bench1Name: <player name>
TeamA_Bench1Role: <BAT|BOWL|AR|WK>
TeamA_Bench1Confidence: <0-100>
TeamA_Bench1Notes: <brief note>
TeamA_Bench2Name: <player name>
TeamA_Bench2Role: <BAT|BOWL|AR|WK>
TeamA_Bench2Confidence: <0-100>
TeamA_Bench2Notes: <brief note>
TeamA_Bench3Name: <player name>
TeamA_Bench3Role: <BAT|BOWL|AR|WK>
TeamA_Bench3Confidence: <0-100>
TeamA_Bench3Notes: <brief note>
TeamBName: ${teamB}
TeamB_P1Name: <player name>
TeamB_P1Role: <BAT|BOWL|AR|WK>
TeamB_P1Confidence: <0-100>
TeamB_P1Notes: <brief note>
TeamB_P2Name: <player name>
TeamB_P2Role: <BAT|BOWL|AR|WK>
TeamB_P2Confidence: <0-100>
TeamB_P2Notes: <brief note>
TeamB_P3Name: <player name>
TeamB_P3Role: <BAT|BOWL|AR|WK>
TeamB_P3Confidence: <0-100>
TeamB_P3Notes: <brief note>
TeamB_P4Name: <player name>
TeamB_P4Role: <BAT|BOWL|AR|WK>
TeamB_P4Confidence: <0-100>
TeamB_P4Notes: <brief note>
TeamB_P5Name: <player name>
TeamB_P5Role: <BAT|BOWL|AR|WK>
TeamB_P5Confidence: <0-100>
TeamB_P5Notes: <brief note>
TeamB_P6Name: <player name>
TeamB_P6Role: <BAT|BOWL|AR|WK>
TeamB_P6Confidence: <0-100>
TeamB_P6Notes: <brief note>
TeamB_P7Name: <player name>
TeamB_P7Role: <BAT|BOWL|AR|WK>
TeamB_P7Confidence: <0-100>
TeamB_P7Notes: <brief note>
TeamB_P8Name: <player name>
TeamB_P8Role: <BAT|BOWL|AR|WK>
TeamB_P8Confidence: <0-100>
TeamB_P8Notes: <brief note>
TeamB_P9Name: <player name>
TeamB_P9Role: <BAT|BOWL|AR|WK>
TeamB_P9Confidence: <0-100>
TeamB_P9Notes: <brief note>
TeamB_P10Name: <player name>
TeamB_P10Role: <BAT|BOWL|AR|WK>
TeamB_P10Confidence: <0-100>
TeamB_P10Notes: <brief note>
TeamB_P11Name: <player name>
TeamB_P11Role: <BAT|BOWL|AR|WK>
TeamB_P11Confidence: <0-100>
TeamB_P11Notes: <brief note>
TeamB_Bench1Name: <player name>
TeamB_Bench1Role: <BAT|BOWL|AR|WK>
TeamB_Bench1Confidence: <0-100>
TeamB_Bench1Notes: <brief note>
TeamB_Bench2Name: <player name>
TeamB_Bench2Role: <BAT|BOWL|AR|WK>
TeamB_Bench2Confidence: <0-100>
TeamB_Bench2Notes: <brief note>
TeamB_Bench3Name: <player name>
TeamB_Bench3Role: <BAT|BOWL|AR|WK>
TeamB_Bench3Confidence: <0-100>
TeamB_Bench3Notes: <brief note>
KeyChange1: <notable change from last match>
KeyChange2: <notable change from last match>
KeyChange3: <notable change from last match>
[XI_END]
`.trim();
}

// ── Parse ─────────────────────────────────────────────────────

function parsePlayer(content: string, prefix: string, team: string): PredictedPlayer | null {
  const get = (key: string): string => {
    const m = content.match(new RegExp(`${key}:\\s*(.+)`));
    return m?.[1]?.trim() ?? "";
  };

  const name = get(`${prefix}Name`);
  if (!name) return null;

  return {
    name,
    role: get(`${prefix}Role`) || "BAT",
    team,
    confidence: parseInt(get(`${prefix}Confidence`)) || 50,
    notes: get(`${prefix}Notes`) || "",
  };
}

function parsePlayingXIResponse(text: string, matchId: string, teamA: string, teamB: string): PlayingXIResult | null {
  try {
    const block = text.match(/\[XI_START\]([\s\S]*?)\[XI_END\]/);
    if (!block) {
      log.warn({ matchId }, "No playing XI block found in Gemini response");
      return null;
    }

    const content = block[1]!;
    const get = (key: string): string => {
      const m = content.match(new RegExp(`${key}:\\s*(.+)`));
      return m?.[1]?.trim() ?? "";
    };

    // Parse Team A players
    const teamAXI: PredictedPlayer[] = [];
    for (let i = 1; i <= 11; i++) {
      const player = parsePlayer(content, `TeamA_P${i}`, teamA);
      if (player) teamAXI.push(player);
    }

    const teamABench: PredictedPlayer[] = [];
    for (let i = 1; i <= 3; i++) {
      const player = parsePlayer(content, `TeamA_Bench${i}`, teamA);
      if (player) teamABench.push(player);
    }

    // Parse Team B players
    const teamBXI: PredictedPlayer[] = [];
    for (let i = 1; i <= 11; i++) {
      const player = parsePlayer(content, `TeamB_P${i}`, teamB);
      if (player) teamBXI.push(player);
    }

    const teamBBench: PredictedPlayer[] = [];
    for (let i = 1; i <= 3; i++) {
      const player = parsePlayer(content, `TeamB_Bench${i}`, teamB);
      if (player) teamBBench.push(player);
    }

    // Parse key changes
    const keyChanges = [
      get("KeyChange1"),
      get("KeyChange2"),
      get("KeyChange3"),
    ].filter(Boolean);

    return {
      matchId,
      teamA: {
        teamName: get("TeamAName") || teamA,
        predictedXI: teamAXI,
        benchPlayers: teamABench,
      },
      teamB: {
        teamName: get("TeamBName") || teamB,
        predictedXI: teamBXI,
        benchPlayers: teamBBench,
      },
      keyChanges,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    log.error({ matchId, error: String(error) }, "Failed to parse playing XI response");
    return null;
  }
}

// ── Core: Get Predicted Playing XI ───────────────────────────

export async function getPredictedPlayingXI(
  matchId: string,
  teamA: string,
  teamB: string,
  format: string,
  venue: string | null,
  tournament: string
): Promise<PlayingXIResult | null> {
  const cacheKey = `playing-xi:${matchId}`;

  // Check cache first
  try {
    const cached = await getFromHotCache<PlayingXIResult>(cacheKey);
    if (cached) {
      log.info({ matchId, match: `${teamA} vs ${teamB}` }, "Returning cached playing XI prediction");
      return cached;
    }
  } catch (error) {
    log.warn({ error: String(error) }, "Cache read failed, proceeding to Gemini");
  }

  const ai = await getAI();
  const prompt = buildPlayingXIPrompt(teamA, teamB, format, venue, tournament);

  try {
    log.info(
      { matchId, match: `${teamA} vs ${teamB}` },
      "Predicting playing XI via Gemini"
    );

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: { temperature: 0.3, tools: [{ googleSearch: {} }] },
    });

    const text = typeof response.text === "function" ? response.text() : response.text;
    if (!text) {
      log.warn({ matchId }, "Empty Gemini response for playing XI");
      return null;
    }

    const result = parsePlayingXIResponse(text, matchId, teamA, teamB);

    // Cache the result
    if (result) {
      try {
        await setHotCache(cacheKey, result, PLAYING_XI_CACHE_TTL);
        log.info({ cacheKey }, "Cached playing XI prediction for 1 hour");
      } catch (error) {
        log.warn({ error: String(error) }, "Cache write failed");
      }
    }

    return result;
  } catch (error) {
    log.error({ matchId, error: String(error) }, "Gemini playing XI prediction failed");
    return null;
  }
}
