/**
 * Rate My Team — AI team analysis service.
 *
 * Analyzes a user's fantasy team against projections, FDR, and optimal picks.
 * Returns a grade (A+ to F), category scores, weak spots, and transfer suggestions.
 */

import { getLogger } from "../lib/logger";
import { createGeminiClientGlobal } from "./gemini-client";
import { getFromHotCache, setHotCache } from "./sports-cache";
import type { Database } from "@draftplay/db";

const log = getLogger("rate-my-team");

const MODEL = "gemini-3.1-flash-lite-preview";
const RATING_CACHE_TTL = 14400; // 4 hours — rating only changes if team composition changes (different cache key)

// ── Types ────────────────────────────────────────────────────

export interface CategoryScore {
  score: number; // 0-100
  grade: string;
  comment: string;
}

export interface TransferSuggestion {
  playerOut: string;
  playerIn: string;
  projectedPointGain: number;
  reason: string;
}

export interface TeamRating {
  overallGrade: string;
  overallScore: number;
  categoryScores: {
    batting: CategoryScore;
    bowling: CategoryScore;
    allRounders: CategoryScore;
    captainChoice: CategoryScore;
    fixtureAlignment: CategoryScore;
    budgetEfficiency: CategoryScore;
  };
  weakSpots: string[];
  suggestedTransfers: TransferSuggestion[];
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

function buildRatingPrompt(
  team: Array<{ name: string; role: string; credits: number; isCaptain: boolean; isViceCaptain: boolean }>,
  matchInfo: { teamA: string; teamB: string; format: string; venue: string | null },
  projections?: Array<{ playerName: string; projected: number }>,
  fdr?: { teamAFdr: number; teamBFdr: number }
): string {
  const teamList = team
    .map(
      (p) =>
        `${p.name} | ${p.role} | ${p.credits} credits${p.isCaptain ? " | CAPTAIN" : ""}${p.isViceCaptain ? " | VICE-CAPTAIN" : ""}`
    )
    .join("\n");

  let contextBlock = "";
  if (projections?.length) {
    contextBlock += "\nProjected Points (all available players):\n";
    for (const p of projections.slice(0, 30)) {
      contextBlock += `- ${p.playerName}: ${p.projected} pts\n`;
    }
  }
  if (fdr) {
    contextBlock += `\nFDR: ${matchInfo.teamA} = ${fdr.teamAFdr}/5, ${matchInfo.teamB} = ${fdr.teamBFdr}/5\n`;
  }

  return `
You are a fantasy cricket expert. Rate this user's team for the upcoming match.

Match: ${matchInfo.teamA} vs ${matchInfo.teamB}
Format: ${matchInfo.format}
Venue: ${matchInfo.venue ?? "TBD"}

User's Team:
${teamList}
${contextBlock}

Rate the team on these categories (0-100 each):
1. Batting strength
2. Bowling strength
3. All-rounder quality
4. Captain choice (is the captain the best projected scorer?)
5. Fixture alignment (are players from the team with easier fixture?)
6. Budget efficiency (points per credit spent)

Return in this EXACT format:

[RATING_START]
OverallScore: <0-100>
OverallGrade: <A+|A|B+|B|C+|C|D|F>
BattingScore: <0-100>
BattingGrade: <grade>
BattingComment: <one sentence>
BowlingScore: <0-100>
BowlingGrade: <grade>
BowlingComment: <one sentence>
AllRoundersScore: <0-100>
AllRoundersGrade: <grade>
AllRoundersComment: <one sentence>
CaptainScore: <0-100>
CaptainGrade: <grade>
CaptainComment: <one sentence>
FixtureScore: <0-100>
FixtureGrade: <grade>
FixtureComment: <one sentence>
BudgetScore: <0-100>
BudgetGrade: <grade>
BudgetComment: <one sentence>
WeakSpot1: <description>
WeakSpot2: <description>
WeakSpot3: <description>
Transfer1Out: <player name>
Transfer1In: <player name>
Transfer1Gain: <projected point gain>
Transfer1Reason: <reason>
Transfer2Out: <player name>
Transfer2In: <player name>
Transfer2Gain: <projected point gain>
Transfer2Reason: <reason>
Summary: <2-3 sentence overall assessment>
[RATING_END]
`.trim();
}

// ── Parse ─────────────────────────────────────────────────────

function parseRatingResponse(text: string): TeamRating | null {
  try {
    const block = text.match(/\[RATING_START\]([\s\S]*?)\[RATING_END\]/);
    if (!block) {
      log.warn("No rating block found in Gemini response");
      return null;
    }

    const content = block[1]!;
    const get = (key: string): string => {
      const m = content.match(new RegExp(`${key}:\\s*(.+)`));
      return m?.[1]?.trim() ?? "";
    };

    const parseCategory = (prefix: string): CategoryScore => ({
      score: parseInt(get(`${prefix}Score`)) || 50,
      grade: get(`${prefix}Grade`) || "C",
      comment: get(`${prefix}Comment`) || "",
    });

    const weakSpots = [get("WeakSpot1"), get("WeakSpot2"), get("WeakSpot3")].filter(Boolean);

    const suggestedTransfers: TransferSuggestion[] = [];
    for (let i = 1; i <= 2; i++) {
      const out = get(`Transfer${i}Out`);
      const inP = get(`Transfer${i}In`);
      if (out && inP) {
        suggestedTransfers.push({
          playerOut: out,
          playerIn: inP,
          projectedPointGain: parseFloat(get(`Transfer${i}Gain`)) || 0,
          reason: get(`Transfer${i}Reason`) || "",
        });
      }
    }

    return {
      overallGrade: get("OverallGrade") || "C",
      overallScore: parseInt(get("OverallScore")) || 50,
      categoryScores: {
        batting: parseCategory("Batting"),
        bowling: parseCategory("Bowling"),
        allRounders: parseCategory("AllRounders"),
        captainChoice: parseCategory("Captain"),
        fixtureAlignment: parseCategory("Fixture"),
        budgetEfficiency: parseCategory("Budget"),
      },
      weakSpots,
      suggestedTransfers,
      summary: get("Summary") || "Analysis unavailable.",
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    log.error({ error: String(error) }, "Failed to parse rating response");
    return null;
  }
}

// ── Cache Key ─────────────────────────────────────────────────

function buildCacheKey(
  team: Array<{ name: string; role: string; credits: number; isCaptain: boolean; isViceCaptain: boolean }>,
  matchInfo: { teamA: string; teamB: string; format: string; venue: string | null }
): string {
  // Deterministic key: sorted player names + captain/VC flags + match info
  const playerKey = team
    .map((p) => `${p.name}:${p.role}:${p.credits}:${p.isCaptain ? "C" : ""}${p.isViceCaptain ? "V" : ""}`)
    .sort()
    .join("|");
  const matchKey = `${matchInfo.teamA}:${matchInfo.teamB}:${matchInfo.format}`;
  return `rate-team:${matchKey}:${playerKey}`;
}

// ── Core: Rate Team ───────────────────────────────────────────

export async function rateTeam(
  team: Array<{ name: string; role: string; credits: number; isCaptain: boolean; isViceCaptain: boolean }>,
  matchInfo: { teamA: string; teamB: string; format: string; venue: string | null },
  projections?: Array<{ playerName: string; projected: number }>,
  fdr?: { teamAFdr: number; teamBFdr: number }
): Promise<TeamRating | null> {
  const cacheKey = buildCacheKey(team, matchInfo);

  // Check cache first — same team+match combo returns consistent results
  try {
    const cached = await getFromHotCache<TeamRating>(cacheKey);
    if (cached) {
      log.info({ match: `${matchInfo.teamA} vs ${matchInfo.teamB}` }, "Returning cached team rating");
      return cached;
    }
  } catch (error) {
    log.warn({ error: String(error) }, "Cache read failed, proceeding to Gemini");
  }

  const ai = await getAI();
  const prompt = buildRatingPrompt(team, matchInfo, projections, fdr);

  try {
    log.info(
      { playerCount: team.length, match: `${matchInfo.teamA} vs ${matchInfo.teamB}` },
      "Rating team via Gemini"
    );

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: { temperature: 0, tools: [{ googleSearch: {} }] },
    });

    const text = typeof response.text === "function" ? response.text() : response.text;
    if (!text) {
      log.warn("Empty Gemini response for team rating");
      return null;
    }

    const rating = parseRatingResponse(text);

    // Cache the result so identical team+match returns the same rating
    if (rating) {
      try {
        await setHotCache(cacheKey, rating, RATING_CACHE_TTL);
        log.info({ cacheKey }, "Cached team rating for 4 hours");
      } catch (error) {
        log.warn({ error: String(error) }, "Cache write failed");
      }
    }

    return rating;
  } catch (error) {
    log.error({ error: String(error) }, "Gemini team rating failed");
    return null;
  }
}
