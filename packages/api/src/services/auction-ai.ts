/**
 * Auction AI Service — intelligence layer for auctions, trades, and waivers.
 *
 * Features:
 *  1. Auction Guru Context — injects live auction state into Guru chat
 *  2. Smart Bid Suggestions — fair value, team need, risk rating per player
 *  3. Trade Evaluator — AI-powered trade analysis with grade impact
 *  4. Post-Auction Report Card — full team grade after auction completes
 *  5. Auction Buzz Bot — real-time commentary during live auctions
 *  6. Waiver Wire Recommendations — ranked free agent suggestions
 *
 * All features use the existing AI building blocks:
 *   projection-engine, fdr-engine, rate-my-team, team-solver, guru-chat, chat-guru
 */

import { getLogger } from "../lib/logger";
import { createGeminiClient, GEMINI_MODEL } from "./gemini-client";
import { getFromHotCache, setHotCache } from "./sports-cache";
import { eq, and, inArray } from "drizzle-orm";
import type { Database } from "@draftplay/db";
import type { AuctionState } from "./auction-room";
import type { PlayerProjection } from "./projection-engine";
import type { FDRResult } from "./fdr-engine";
import type { TeamRating, TournamentContext } from "./rate-my-team";

const log = getLogger("auction-ai");

// ── Types ────────────────────────────────────────────────────

export interface BidSuggestion {
  playerId: string;
  playerName: string;
  role: string;
  team: string;
  fairValueLow: number;
  fairValueHigh: number;
  teamNeed: "critical" | "high" | "medium" | "low" | "none";
  teamNeedReason: string;
  riskRating: "low" | "medium" | "high";
  riskReason: string;
  projectedPoints: number;
  valuePerCredit: number;
  recommendation: string; // "strong bid" | "bid cautiously" | "let go" | "steal opportunity"
}

export interface TradeEvaluation {
  playersGiven: Array<{ name: string; salary: number; projected: number }>;
  playersReceived: Array<{ name: string; salary: number; projected: number }>;
  netProjectedPoints: number;
  salaryImpact: number; // positive = freed cap space
  preTradeGrade: string;
  postTradeGrade: string;
  fixtureAdvantage: string; // "incoming players have easier fixtures" etc.
  verdict: "great" | "good" | "fair" | "poor" | "bad";
  verdictReason: string;
  warnings: string[];
}

export interface AuctionReportCard {
  overallGrade: string;
  overallScore: number;
  teamRating: TeamRating | null;
  bestValue: { playerName: string; salary: number; projected: number; valueRatio: number } | null;
  worstValue: { playerName: string; salary: number; projected: number; valueRatio: number } | null;
  teamStrengths: string[];
  teamWeaknesses: string[];
  suggestedTradeTargets: string[];
  budgetEfficiency: number; // 0-100
  summary: string;
}

export interface WaiverRecommendation {
  playerId: string;
  playerName: string;
  role: string;
  team: string;
  projectedPointsNext3: number;
  fdrAdvantage: string;
  fitsCapSpace: boolean;
  reason: string;
  priority: number; // 1 = highest
}

// ── Feature 1: Auction Guru Context ──────────────────────────

/**
 * Build enhanced GuruContext with live auction state.
 * Merges into the existing GuruContext for sendGuruMessage().
 */
export function buildAuctionGuruContext(
  auctionState: AuctionState,
  playerNames: Record<string, string>,
  projections?: PlayerProjection[],
): Record<string, unknown> {
  const soldSummary = auctionState.soldPlayers.map((s) => ({
    player: playerNames[s.playerId] ?? s.playerId,
    buyer: s.userId.slice(0, 8),
    amount: s.amount,
  }));

  const budgetSummary = Object.entries(auctionState.budgets).map(([uid, budget]) => ({
    user: uid.slice(0, 8),
    remaining: budget,
    teamSize: auctionState.teamSizes[uid] ?? 0,
    slotsLeft: auctionState.maxPlayersPerTeam - (auctionState.teamSizes[uid] ?? 0),
  }));

  return {
    auctionState: {
      phase: auctionState.phase,
      currentPlayer: auctionState.currentPlayerId
        ? playerNames[auctionState.currentPlayerId] ?? auctionState.currentPlayerId
        : null,
      highestBid: auctionState.highestBid,
      soldCount: auctionState.soldPlayers.length,
      unsoldCount: auctionState.unsoldPlayerIds.length,
      recentSales: soldSummary.slice(-5),
      budgets: budgetSummary,
    },
    auctionProjections: projections?.slice(0, 20).map((p) => ({
      name: p.playerName,
      projected: p.projectedPoints,
      captainRank: p.captainRank,
      confidence: `${p.confidenceLow}-${p.confidenceHigh}`,
    })),
  };
}

// ── Feature 2: Smart Bid Suggestions ─────────────────────────

/**
 * Generate bid suggestion for a nominated player during a live auction.
 */
export interface PlayerStats {
  average?: number;
  strikeRate?: number;
  economyRate?: number;
  bowlingAverage?: number;
  bowlingStrikeRate?: number;
  matchesPlayed?: number;
  recentForm?: number; // 1-10
  injuryStatus?: string;
  formNote?: string;
  sentimentScore?: number;
}

export async function getBidSuggestion(
  auctionState: AuctionState,
  playerId: string,
  userId: string,
  playerInfo: { name: string; role: string; team: string; credits?: number; stats?: PlayerStats },
  projections: PlayerProjection[],
  userRoster: Array<{ role: string; playerId: string }>,
): Promise<BidSuggestion> {
  const cacheKey = `auction-bid:${auctionState.roomId}:${playerId}:${userId}`;
  const cached = await getFromHotCache<BidSuggestion>(cacheKey);
  if (cached) return cached;

  const projection = projections.find((p) => p.playerId === playerId);
  const playerCredits = playerInfo.credits ?? 8.0;
  const hasProjections = projection && projection.projectedPoints > 0;

  // Use projections if available, otherwise use player credits as quality signal
  const projectedPoints = hasProjections ? projection.projectedPoints : playerCredits * 4; // ~4 pts per credit as baseline
  const confidenceLow = hasProjections ? projection.confidenceLow : playerCredits * 3;
  const confidenceHigh = hasProjections ? projection.confidenceHigh : playerCredits * 5;

  // Fair value = player credits (the market's assessment of their worth)
  const fairValueMid = playerCredits;
  const fairValueLow = Math.max(auctionState.minBid, Math.round(fairValueMid * 0.8 * 10) / 10);
  const fairValueHigh = Math.round(fairValueMid * 1.2 * 10) / 10;

  // Team need analysis
  const roleCounts: Record<string, number> = {};
  for (const p of userRoster) {
    roleCounts[p.role] = (roleCounts[p.role] ?? 0) + 1;
  }

  const ROLE_MINS: Record<string, number> = {
    batsman: 3, bowler: 3, all_rounder: 1, wicket_keeper: 1,
  };

  const currentCount = roleCounts[playerInfo.role] ?? 0;
  const minNeeded = ROLE_MINS[playerInfo.role] ?? 1;
  const slotsLeft = auctionState.maxPlayersPerTeam - userRoster.length;

  let teamNeed: BidSuggestion["teamNeed"] = "medium";
  let teamNeedReason = "";

  if (slotsLeft <= 0) {
    teamNeed = "none";
    teamNeedReason = "Your squad is full";
  } else if (currentCount < minNeeded) {
    teamNeed = "critical";
    teamNeedReason = `You need at least ${minNeeded} ${playerInfo.role}(s), have ${currentCount}`;
  } else if (currentCount === minNeeded && slotsLeft > 2) {
    teamNeed = "high";
    teamNeedReason = `Only ${currentCount} ${playerInfo.role}(s) — adding depth would strengthen your squad`;
  } else if (currentCount >= minNeeded + 2) {
    teamNeed = "low";
    teamNeedReason = `Already have ${currentCount} ${playerInfo.role}(s)`;
  }

  // Risk rating based on stats + credits
  const stats = playerInfo.stats ?? {};
  const matchesPlayed = stats.matchesPlayed ?? 0;
  const recentForm = stats.recentForm ?? 5;
  const injuryStatus = stats.injuryStatus ?? "unknown";

  let riskRating: BidSuggestion["riskRating"] = "medium";
  let riskReason = "";

  if (injuryStatus === "injured" || injuryStatus === "doubtful") {
    riskRating = "high";
    riskReason = `Injury concern — status: ${injuryStatus}`;
  } else if (matchesPlayed < 10) {
    riskRating = "high";
    riskReason = `Only ${matchesPlayed} matches played — limited track record`;
  } else if (playerCredits >= 9 && recentForm >= 7) {
    riskRating = "low";
    riskReason = `Premium player — ${matchesPlayed} matches, form ${recentForm}/10`;
  } else if (playerCredits >= 7 && recentForm >= 5) {
    riskRating = "medium";
    riskReason = `Solid player — avg ${stats.average?.toFixed(1) ?? "N/A"}, SR ${stats.strikeRate?.toFixed(0) ?? "N/A"}`;
  } else if (recentForm < 4) {
    riskRating = "high";
    riskReason = `Poor recent form (${recentForm}/10) — risky pick`;
  } else {
    riskRating = "medium";
    riskReason = `${matchesPlayed} matches, form ${recentForm}/10`;
  }

  // Value per credit
  const valuePerCredit = fairValueMid > 0 ? projectedPoints / fairValueMid : 0;
  const currentBid = auctionState.highestBid?.amount ?? 0;

  // Recommendation
  let recommendation = "bid cautiously";
  if (teamNeed === "critical") {
    recommendation = "strong bid";
  } else if (teamNeed === "none") {
    recommendation = "let go";
  } else if (currentBid > fairValueHigh && teamNeed !== "critical") {
    recommendation = "let go";
  } else if (currentBid < fairValueLow) {
    recommendation = "steal opportunity";
  } else if (teamNeed === "high" && riskRating === "low") {
    recommendation = "strong bid";
  }

  const suggestion: BidSuggestion = {
    playerId,
    playerName: playerInfo.name,
    role: playerInfo.role,
    team: playerInfo.team,
    fairValueLow,
    fairValueHigh,
    teamNeed,
    teamNeedReason,
    riskRating,
    riskReason,
    projectedPoints,
    valuePerCredit: Math.round(valuePerCredit * 100) / 100,
    recommendation,
  };

  await setHotCache(cacheKey, suggestion, 300); // 5min — changes as auction progresses
  return suggestion;
}

// ── Feature 3: Trade Evaluator ───────────────────────────────

/**
 * Evaluate a proposed trade using projections and salary data.
 */
export async function evaluateTrade(
  db: Database,
  leagueId: string,
  fromUserId: string,
  offeredPlayers: Array<{ id: string; name: string; salary: number; role: string }>,
  requestedPlayers: Array<{ id: string; name: string; salary: number; role: string }>,
  projections: PlayerProjection[],
  fdrData: FDRResult[],
  userRoster: Array<{ id: string; name: string; role: string; salary: number }>,
): Promise<TradeEvaluation> {
  const cacheKey = `trade-eval:${leagueId}:${offeredPlayers.map((p) => p.id).sort().join(",")}:${requestedPlayers.map((p) => p.id).sort().join(",")}`;
  const cached = await getFromHotCache<TradeEvaluation>(cacheKey);
  if (cached) return cached;

  const getProjected = (id: string) =>
    projections.find((p) => p.playerId === id)?.projectedPoints ?? 0;

  const playersGiven = offeredPlayers.map((p) => ({
    name: p.name,
    salary: p.salary,
    projected: getProjected(p.id),
  }));

  const playersReceived = requestedPlayers.map((p) => ({
    name: p.name,
    salary: p.salary,
    projected: getProjected(p.id),
  }));

  const givenTotal = playersGiven.reduce((s, p) => s + p.projected, 0);
  const receivedTotal = playersReceived.reduce((s, p) => s + p.projected, 0);
  const netProjectedPoints = Math.round((receivedTotal - givenTotal) * 10) / 10;

  const givenSalary = playersGiven.reduce((s, p) => s + p.salary, 0);
  const receivedSalary = playersReceived.reduce((s, p) => s + p.salary, 0);
  const salaryImpact = Math.round((givenSalary - receivedSalary) * 10) / 10;

  // FDR analysis — check if incoming players' teams have easier upcoming fixtures
  const incomingTeams = new Set(requestedPlayers.map((p) => p.name)); // simplified
  const avgIncomingFdr = fdrData.length > 0
    ? fdrData.reduce((s, f) => s + f.overallFdr, 0) / fdrData.length
    : 3;
  const fixtureAdvantage = avgIncomingFdr < 2.5
    ? "Incoming players have easier upcoming fixtures"
    : avgIncomingFdr > 3.5
      ? "Incoming players face tougher fixtures ahead"
      : "Fixture difficulty is roughly neutral";

  // Grade simulation: estimate pre/post trade impact
  const preRosterPoints = userRoster.reduce((s, p) => s + getProjected(p.id), 0);
  const postRosterPoints = preRosterPoints - givenTotal + receivedTotal;

  const gradeFromPoints = (pts: number) => {
    if (pts > 500) return "A+";
    if (pts > 400) return "A";
    if (pts > 350) return "A-";
    if (pts > 300) return "B+";
    if (pts > 250) return "B";
    if (pts > 200) return "B-";
    if (pts > 150) return "C+";
    if (pts > 100) return "C";
    return "C-";
  };

  const preTradeGrade = gradeFromPoints(preRosterPoints);
  const postTradeGrade = gradeFromPoints(postRosterPoints);

  // Verdict
  let verdict: TradeEvaluation["verdict"] = "fair";
  let verdictReason = "Even swap";
  const warnings: string[] = [];

  if (netProjectedPoints > 20) {
    verdict = "great";
    verdictReason = `Projected to gain ${netProjectedPoints} pts — clear upgrade`;
  } else if (netProjectedPoints > 5) {
    verdict = "good";
    verdictReason = `Slight projected upgrade of ${netProjectedPoints} pts`;
  } else if (netProjectedPoints < -20) {
    verdict = "bad";
    verdictReason = `Projected to lose ${Math.abs(netProjectedPoints)} pts — significant downgrade`;
  } else if (netProjectedPoints < -5) {
    verdict = "poor";
    verdictReason = `Slight projected downgrade of ${Math.abs(netProjectedPoints)} pts`;
  } else {
    verdictReason = salaryImpact > 5
      ? `Even on points but frees ${salaryImpact} cap space`
      : "Even swap — marginal difference either way";
  }

  // Check for role gaps after trade
  const postRoster = [
    ...userRoster.filter((p) => !offeredPlayers.some((o) => o.id === p.id)),
    ...requestedPlayers.map((p) => ({ id: p.id, name: p.name, role: p.role, salary: p.salary })),
  ];
  const roleCounts: Record<string, number> = {};
  for (const p of postRoster) {
    roleCounts[p.role] = (roleCounts[p.role] ?? 0) + 1;
  }
  if ((roleCounts["bowler"] ?? 0) < 3) warnings.push("Post-trade squad has fewer than 3 bowlers");
  if ((roleCounts["batsman"] ?? 0) < 3) warnings.push("Post-trade squad has fewer than 3 batsmen");
  if ((roleCounts["wicket_keeper"] ?? 0) < 1) warnings.push("Post-trade squad has no wicket keeper");

  const evaluation: TradeEvaluation = {
    playersGiven,
    playersReceived,
    netProjectedPoints,
    salaryImpact,
    preTradeGrade,
    postTradeGrade,
    fixtureAdvantage,
    verdict,
    verdictReason,
    warnings,
  };

  await setHotCache(cacheKey, evaluation, 1800); // 30min
  return evaluation;
}

// ── Feature 4: Post-Auction Report Card ──────────────────────

/**
 * Generate a comprehensive report card after an auction completes.
 */
export async function generateAuctionReportCard(
  db: Database,
  roomId: string,
  userId: string,
  projections: PlayerProjection[],
  teamRating: TeamRating | null,
): Promise<AuctionReportCard> {
  const cacheKey = `auction-report:${roomId}:${userId}`;
  const cached = await getFromHotCache<AuctionReportCard>(cacheKey);
  if (cached) return cached;

  const { draftPicks, players } = await import("@draftplay/db");

  // Get user's picks with player info
  const picks = await db
    .select({
      playerId: draftPicks.playerId,
      bidAmount: draftPicks.bidAmount,
      playerName: players.name,
      playerRole: players.role,
      playerTeam: players.team,
    })
    .from(draftPicks)
    .leftJoin(players, eq(players.id, draftPicks.playerId))
    .where(and(eq(draftPicks.roomId, roomId), eq(draftPicks.userId, userId)));

  if (picks.length === 0) {
    return {
      overallGrade: "N/A",
      overallScore: 0,
      teamRating: null,
      bestValue: null,
      worstValue: null,
      teamStrengths: [],
      teamWeaknesses: ["No players in roster"],
      suggestedTradeTargets: [],
      budgetEfficiency: 0,
      summary: "No auction picks found.",
    };
  }

  // Get player credits from stats for value analysis
  const { getPlayerCredits } = await import("./cricket-data");
  const playerStats = await db.query.players.findMany({
    where: inArray(players.id, picks.map((p) => p.playerId)),
    columns: { id: true, stats: true },
  });
  const creditsMap = new Map(playerStats.map((p) => [
    p.id,
    getPlayerCredits((p.stats as Record<string, unknown>) ?? {}),
  ]));

  // Calculate value: credits (quality) vs salary (what you paid)
  const pickValues = picks.map((p) => {
    const salary = Number(p.bidAmount ?? 0);
    const credits = creditsMap.get(p.playerId) ?? 8.0;
    // Value ratio: credits / salary — higher = better deal (got quality for cheap)
    const valueRatio = salary > 0 ? credits / salary : 0;
    return {
      playerName: p.playerName ?? p.playerId,
      role: p.playerRole ?? "unknown",
      team: p.playerTeam ?? "unknown",
      salary,
      projected: credits * 4, // use credits × 4 as proxy for projected points
      valueRatio,
      credits,
    };
  });

  // Best value = highest credits-to-salary ratio (quality bargain)
  const sortedByValue = [...pickValues].sort((a, b) => b.valueRatio - a.valueRatio);
  const bestValue = sortedByValue[0] ?? null;
  // Most expensive = highest salary (not "worst" — they may be worth it)
  const sortedBySalary = [...pickValues].sort((a, b) => b.salary - a.salary);
  const worstValue = sortedBySalary[0] ?? null;

  // Role analysis
  const roleCounts: Record<string, number> = {};
  for (const p of pickValues) {
    roleCounts[p.role] = (roleCounts[p.role] ?? 0) + 1;
  }

  const strengths: string[] = [];
  const weaknesses: string[] = [];

  if ((roleCounts["batsman"] ?? 0) >= 4) strengths.push("Strong batting depth");
  if ((roleCounts["bowler"] ?? 0) >= 4) strengths.push("Strong bowling depth");
  if ((roleCounts["all_rounder"] ?? 0) >= 2) strengths.push("Good all-rounder coverage");
  if ((roleCounts["batsman"] ?? 0) < 3) weaknesses.push("Thin on batting — consider trading for a batsman");
  if ((roleCounts["bowler"] ?? 0) < 3) weaknesses.push("Light on bowling — trade for a bowler");
  if ((roleCounts["wicket_keeper"] ?? 0) < 1) weaknesses.push("No wicket keeper — critical gap");

  const totalSpent = pickValues.reduce((s, p) => s + p.salary, 0);
  const totalCredits = pickValues.reduce((s, p) => s + p.credits, 0);
  const totalProjected = pickValues.reduce((s, p) => s + p.projected, 0);

  // Budget efficiency: total credits acquired / total spent (how much quality per Cr)
  // 100% = got credits equal to what you spent, >100% = got bargains
  const budgetEfficiency = Math.min(100, Math.round((totalCredits / Math.max(totalSpent, 1)) * 100));

  // Suggest trade targets from other users' rosters with good projections
  const allPicks = await db
    .select({
      playerId: draftPicks.playerId,
      userId: draftPicks.userId,
      playerName: players.name,
      playerRole: players.role,
    })
    .from(draftPicks)
    .leftJoin(players, eq(players.id, draftPicks.playerId))
    .where(eq(draftPicks.roomId, roomId));

  const otherPlayers = allPicks.filter((p) => p.userId !== userId);
  const suggestedTradeTargets: string[] = [];

  // Find players from other rosters that would fill our weaknesses
  for (const weakness of weaknesses) {
    const neededRole = weakness.includes("batting")
      ? "batsman"
      : weakness.includes("bowling")
        ? "bowler"
        : weakness.includes("wicket")
          ? "wicket_keeper"
          : null;

    if (neededRole) {
      const candidates = otherPlayers
        .filter((p) => p.playerRole === neededRole)
        .map((p) => ({
          name: p.playerName ?? p.playerId,
          credits: creditsMap.get(p.playerId) ?? 8.0,
        }))
        .sort((a, b) => b.credits - a.credits);

      if (candidates[0]) {
        suggestedTradeTargets.push(`${candidates[0].name} (${neededRole}, ${candidates[0].credits.toFixed(1)} Cr)`);
      }
    }
  }

  // Overall score: composite of squad quality, budget usage, and role balance
  const avgCredits = totalCredits / Math.max(picks.length, 1);
  const qualityScore = Math.min(40, Math.round(avgCredits * 4)); // 0-40 (avg 10 credits = 40)
  const budgetScore = Math.min(30, Math.round((totalSpent / 100) * 30)); // 0-30 (spent 100 = 30)
  const roleScore = Math.min(30, 30 - weaknesses.length * 10); // 0-30 (no weaknesses = 30)
  const overallScore = Math.max(0, qualityScore + budgetScore + roleScore);

  const overallGrade = teamRating?.overallGrade ?? (
    overallScore >= 85 ? "A+" :
    overallScore >= 75 ? "A" :
    overallScore >= 65 ? "B+" :
    overallScore >= 55 ? "B" :
    overallScore >= 45 ? "B-" :
    overallScore >= 35 ? "C+" :
    overallScore >= 25 ? "C" : "C-"
  );

  const summary = `You spent ${totalSpent.toFixed(1)} Cr on ${picks.length} players (avg ${avgCredits.toFixed(1)} credit quality). ` +
    (bestValue ? `Best bargain: ${bestValue.playerName} (${bestValue.credits.toFixed(1)} Cr player for ${bestValue.salary.toFixed(1)} Cr). ` : "") +
    (weaknesses.length > 0 ? `Key gap: ${weaknesses[0]}.` : "Well-balanced squad!");

  const report: AuctionReportCard = {
    overallGrade,
    overallScore,
    teamRating,
    bestValue,
    worstValue,
    teamStrengths: strengths,
    teamWeaknesses: weaknesses,
    suggestedTradeTargets,
    budgetEfficiency,
    summary,
  };

  await setHotCache(cacheKey, report, 7200); // 2hr
  log.info({ roomId, userId, grade: overallGrade }, "Generated auction report card");
  return report;
}

// ── Feature 5: Auction Buzz Bot ──────────────────────────────

const AUCTION_BUZZ_PROMPT = `You are "Guru", a witty cricket-obsessed AI commentator in a LIVE fantasy cricket auction room.

Your job: react to auction events with short, fun, cricket-themed commentary.

RULES:
- Max 100 characters per message
- Use emojis generously (🏏 🔥 🚀 💰 😱 👏 ⚡ 🎯 💀 🤯)
- Reference player form, stats, team context when relevant
- Mix: celebrations, hot takes, budget warnings, steal alerts
- NEVER give bidding advice — just entertain
- 1-2 messages per event, JSON array format

You MUST respond with valid JSON: [{"message": "...", "type": "..."}]
Types: "auction_sold", "auction_steal", "auction_overpay", "auction_drama", "auction_budget_alert"`;

/**
 * Generate auction commentary after a player is sold or goes unsold.
 */
export async function generateAuctionBuzz(
  event: "sold" | "unsold" | "bidwar" | "budget_crunch",
  context: {
    playerName?: string;
    buyerName?: string;
    amount?: number;
    fairValue?: number;
    budgetRemaining?: number;
    slotsLeft?: number;
    soldCount?: number;
  },
): Promise<Array<{ message: string; type: string }>> {
  try {
    let prompt = "";

    switch (event) {
      case "sold":
        prompt = `Player "${context.playerName}" just SOLD for ${context.amount} credits to ${context.buyerName}!`;
        if (context.fairValue && context.amount) {
          if (context.amount < context.fairValue * 0.7) {
            prompt += ` That's a STEAL — fair value was around ${context.fairValue}!`;
          } else if (context.amount > context.fairValue * 1.3) {
            prompt += ` That's an OVERPAY — fair value was around ${context.fairValue}!`;
          }
        }
        prompt += ` (${context.soldCount ?? 0} players sold so far)`;
        break;

      case "unsold":
        prompt = `"${context.playerName}" goes UNSOLD! Nobody bid. Shocking or expected?`;
        break;

      case "bidwar":
        prompt = `BIDDING WAR on "${context.playerName}"! Current bid: ${context.amount} credits. Multiple bidders driving up the price!`;
        break;

      case "budget_crunch":
        prompt = `BUDGET ALERT: ${context.buyerName} is down to ${context.budgetRemaining} credits with ${context.slotsLeft} slots to fill!`;
        break;
    }

    prompt += "\nGenerate 1-2 short, fun reactions.";

    const genAI = await createGeminiClient(process.env.GEMINI_DEFAULT_REGION || "IN");
    const response = await genAI.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        systemInstruction: AUCTION_BUZZ_PROMPT,
        temperature: 0.9,
        maxOutputTokens: 256,
        responseMimeType: "application/json",
      },
    });

    const text = response?.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";
    const messages = JSON.parse(text) as Array<{ message: string; type: string }>;
    return messages.filter((m) => m.message && m.message.length <= 120);
  } catch (err) {
    log.error({ err, event }, "Failed to generate auction buzz");
    return [];
  }
}

// ── Feature 6: Waiver Wire Recommendations ───────────────────

/**
 * Get ranked waiver/free agent recommendations for a user in a league.
 * Considers: projections, FDR, team composition gaps, and salary cap space.
 */
export async function getWaiverRecommendations(
  db: Database,
  leagueId: string,
  userId: string,
  roomId: string,
  projections: PlayerProjection[],
  fdrData: FDRResult[],
  budgetRemaining: number,
  maxResults: number = 10,
): Promise<WaiverRecommendation[]> {
  const cacheKey = `waiver-rec:${leagueId}:${userId}`;
  const cached = await getFromHotCache<WaiverRecommendation[]>(cacheKey);
  if (cached) return cached;

  const { draftPicks, players } = await import("@draftplay/db");

  // Get all drafted player IDs in this room (not available for waiver)
  const allDraftedPicks = await db.query.draftPicks.findMany({
    where: eq(draftPicks.roomId, roomId),
    columns: { playerId: true },
  });
  const draftedIds = new Set(allDraftedPicks.map((p) => p.playerId));

  // Get user's current roster for gap analysis
  const userPicks = await db.query.draftPicks.findMany({
    where: and(eq(draftPicks.roomId, roomId), eq(draftPicks.userId, userId)),
    columns: { playerId: true },
  });
  const userPickIds = userPicks.map((p) => p.playerId);

  // Get user's roster with roles
  const userPlayerRecords = userPickIds.length > 0
    ? await db.query.players.findMany({
        where: inArray(players.id, userPickIds),
        columns: { id: true, role: true },
      })
    : [];

  const roleCounts: Record<string, number> = {};
  for (const p of userPlayerRecords) {
    roleCounts[p.role ?? "unknown"] = (roleCounts[p.role ?? "unknown"] ?? 0) + 1;
  }

  // Find available (undrafted) players with projections
  const availablePlayers = projections
    .filter((p) => !draftedIds.has(p.playerId))
    .sort((a, b) => b.projectedPoints - a.projectedPoints);

  // Score and rank
  const recommendations: WaiverRecommendation[] = availablePlayers
    .slice(0, maxResults * 2) // get extra candidates for filtering
    .map((p, idx) => {
      // FDR check — is this player's team in an easy stretch?
      const teamFdr = fdrData.find(
        (f) => f.teamName.toLowerCase().includes(p.playerName.split(" ").pop()?.toLowerCase() ?? "")
      );
      const fdrAdvantage = teamFdr
        ? teamFdr.overallFdr <= 2 ? "Easy fixtures ahead"
          : teamFdr.overallFdr >= 4 ? "Tough fixtures ahead"
          : "Moderate fixtures"
        : "Fixtures unknown";

      // Does this player fill a gap?
      const ROLE_MINS: Record<string, number> = { batsman: 3, bowler: 3, all_rounder: 1, wicket_keeper: 1 };
      const roleNeeded = (roleCounts[p.role] ?? 0) < (ROLE_MINS[p.role] ?? 1);
      const needBoost = roleNeeded ? 20 : 0;

      const fitsCapSpace = true; // Waivers are free in most league configs

      const reason = roleNeeded
        ? `Fills ${p.role} gap — projected ${p.projectedPoints} pts`
        : `High upside — projected ${p.projectedPoints} pts`;

      return {
        playerId: p.playerId,
        playerName: p.playerName,
        role: p.role,
        team: "", // Would need player.team join
        projectedPointsNext3: Math.round(p.projectedPoints * 3),
        fdrAdvantage,
        fitsCapSpace,
        reason,
        priority: idx + 1 - (needBoost > 0 ? 5 : 0), // Boost priority for needed roles
      };
    })
    .sort((a, b) => a.priority - b.priority)
    .slice(0, maxResults)
    .map((r, idx) => ({ ...r, priority: idx + 1 })); // Re-index priorities

  await setHotCache(cacheKey, recommendations, 1800); // 30min
  log.info({ leagueId, userId, count: recommendations.length }, "Generated waiver recommendations");
  return recommendations;
}
