/**
 * Cricket Manager — Guru AI analysis
 *
 * Provides:
 *  - rateMyXI: overall grade + strengths + weaknesses based on squad composition,
 *    role distribution, projected points, and opponent matchups
 *  - suggestBattingOrder: optimal order sorted by projected SR / projected points
 *  - suggestBowlingOrder: optimal priority sorted by projected economy
 *
 * Currently rule-based for determinism and low latency. The structure is
 * designed so a Gemini-backed commentary layer can be swapped in later.
 */

import type { EligiblePlayer } from "./cm-service";

export interface PlayerProjection {
  playerId: string;
  projectedPoints: number;
  captainRank?: number;
}

export interface RateMyXiInput {
  squad: EligiblePlayer[];
  projections: PlayerProjection[];
  battingOrder: string[]; // playerIds in order
  bowlingPriority: string[]; // playerIds in order
}

export interface RateMyXiResult {
  grade: "A+" | "A" | "B" | "C" | "D";
  score: number; // 0-100
  headline: string;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  roleMix: {
    batsmen: number;
    bowlers: number;
    allRounders: number;
    wicketKeepers: number;
  };
  projectedTotal: number;
}

export interface OrderSuggestion {
  playerId: string;
  suggestedPosition: number; // 1-11 for batting, 1-N for bowling
  reason: string;
}

// ─── Rate My XI ─────────────────────────────────────────────────────────

export function rateMyXi(input: RateMyXiInput): RateMyXiResult {
  const { squad, projections } = input;
  const projMap = new Map(projections.map((p) => [p.playerId, p]));

  // Role mix
  const roleMix = {
    batsmen: squad.filter((p) => p.role === "batsman").length,
    bowlers: squad.filter((p) => p.role === "bowler").length,
    allRounders: squad.filter((p) => p.role === "all_rounder").length,
    wicketKeepers: squad.filter((p) => p.role === "wicket_keeper").length,
  };

  // Core metrics
  const totalProj = squad.reduce(
    (s, p) => s + (projMap.get(p.playerId)?.projectedPoints ?? 0),
    0
  );
  const projCount = squad.filter((p) => projMap.has(p.playerId)).length;

  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const suggestions: string[] = [];

  // Team diversity — spread across teams
  const teamCounts: Record<string, number> = {};
  for (const p of squad) {
    teamCounts[p.team] = (teamCounts[p.team] ?? 0) + 1;
  }
  const maxTeamCount = Math.max(...Object.values(teamCounts));
  const teamCount = Object.keys(teamCounts).length;

  if (teamCount >= 6) {
    strengths.push(
      `Well diversified across ${teamCount} teams — resilient to any single team underperforming.`
    );
  } else if (teamCount <= 3) {
    weaknesses.push(
      `Only ${teamCount} teams represented. Heavy dependency — if one underperforms, your NRR suffers.`
    );
    suggestions.push("Add players from at least 2 more teams for better balance.");
  }

  if (maxTeamCount >= 8) {
    weaknesses.push(
      `${maxTeamCount} players from a single team — risky if they collapse.`
    );
  }

  // Role balance
  const bowlerPool = roleMix.bowlers + roleMix.allRounders;
  if (bowlerPool >= 7) {
    strengths.push(
      `Deep bowling pool (${bowlerPool} bowlers + all-rounders) — can absorb wicket-less days.`
    );
  } else if (bowlerPool === 5) {
    weaknesses.push(
      "Bare minimum bowling — no backup if a bowler gets injured or drops a bad spell."
    );
  }

  if (roleMix.allRounders >= 3) {
    strengths.push(
      `${roleMix.allRounders} all-rounders — flexible contribution on both sides.`
    );
  } else if (roleMix.allRounders === 0) {
    weaknesses.push("No all-rounders — missing the dual-role multiplier.");
    suggestions.push("Consider swapping a pure bat/bowl for a proven all-rounder.");
  }

  // Projections coverage — if we have data for 5+ players, use it
  let projectedStrength = 50;
  if (projCount >= 5) {
    const avgProj = totalProj / projCount;
    // Rough heuristic: T20 fantasy projections average ~30-40 pts.
    projectedStrength = Math.min(100, Math.max(0, (avgProj - 15) * 2));

    if (avgProj >= 40) {
      strengths.push(
        `Strong projected output (avg ${avgProj.toFixed(0)} pts/player).`
      );
    } else if (avgProj < 25) {
      weaknesses.push(
        `Low projected output (avg ${avgProj.toFixed(0)} pts/player) — consider higher-ceiling picks.`
      );
    }

    // Top-heavy check
    const topFour = squad
      .map((p) => projMap.get(p.playerId)?.projectedPoints ?? 0)
      .sort((a, b) => b - a)
      .slice(0, 4);
    const topSum = topFour.reduce((s, x) => s + x, 0);
    if (topSum > totalProj * 0.65) {
      weaknesses.push("Top-heavy squad — too dependent on your top 4 picks.");
    }
  }

  // Score composition
  let score = 60;
  score += strengths.length * 6;
  score -= weaknesses.length * 6;
  score = Math.round(
    score * 0.6 + projectedStrength * 0.4
  );
  score = Math.max(20, Math.min(100, score));

  const grade: RateMyXiResult["grade"] =
    score >= 90
      ? "A+"
      : score >= 78
        ? "A"
        : score >= 62
          ? "B"
          : score >= 45
            ? "C"
            : "D";

  const headline =
    grade === "A+"
      ? "Elite squad — you've nailed the balance."
      : grade === "A"
        ? "Strong build with minor trade-offs."
        : grade === "B"
          ? "Solid core, room to optimize."
          : grade === "C"
            ? "Workable but has structural issues."
            : "Needs rework — several risks.";

  return {
    grade,
    score,
    headline,
    strengths: strengths.slice(0, 4),
    weaknesses: weaknesses.slice(0, 4),
    suggestions: suggestions.slice(0, 3),
    roleMix,
    projectedTotal: Math.round(totalProj),
  };
}

// ─── Suggest Batting Order ──────────────────────────────────────────────

/**
 * Rule: openers with high strike rate first (maximize runs before 120 balls
 * run out), all-rounders in middle, pure bowlers at the tail.
 * Weight = recentSr × 0.6 + projectedPoints × 0.8 (fallback to 0 if missing)
 */
export function suggestBattingOrder(
  squad: EligiblePlayer[],
  projections: PlayerProjection[]
): OrderSuggestion[] {
  const projMap = new Map(projections.map((p) => [p.playerId, p]));

  const scored = squad.map((p) => {
    const proj = projMap.get(p.playerId);
    const sr = p.recentSr ?? 0;
    const pts = proj?.projectedPoints ?? 0;
    // Bowlers get pushed to the bottom heavily
    const roleBonus =
      p.role === "batsman" || p.role === "wicket_keeper"
        ? 200
        : p.role === "all_rounder"
          ? 100
          : 0;
    const weight = sr * 0.6 + pts * 0.8 + roleBonus;
    return { player: p, weight };
  });

  scored.sort((a, b) => b.weight - a.weight);

  return scored.map((s, i) => ({
    playerId: s.player.playerId,
    suggestedPosition: i + 1,
    reason: battingReason(s.player, i + 1),
  }));
}

function battingReason(p: EligiblePlayer, pos: number): string {
  if (pos === 1 || pos === 2) {
    return `${p.role === "wicket_keeper" ? "keeper-batter" : "opener"}${
      p.recentSr ? ` with SR ${p.recentSr.toFixed(0)}` : ""
    } — attack from ball one.`;
  }
  if (pos === 3 || pos === 4) {
    return "anchor + aggressor role — middle overs builder.";
  }
  if (pos <= 7) {
    return p.role === "all_rounder"
      ? "finisher with late-order hitting."
      : "middle-order consolidator.";
  }
  return "lower order — 120-ball budget may run out before you bat.";
}

// ─── Suggest Bowling Order ──────────────────────────────────────────────

/**
 * Rule: best economy first (lock down early), wicket-takers in the middle,
 * and use the bowling-order cap of 4 overs per bowler intelligently.
 * Weight = -recentEcon × 2 (lower = better) + projected points × 0.5
 */
export function suggestBowlingOrder(
  squad: EligiblePlayer[],
  projections: PlayerProjection[]
): OrderSuggestion[] {
  const projMap = new Map(projections.map((p) => [p.playerId, p]));

  const canBowl = (role: string) =>
    role === "bowler" || role === "all_rounder";
  const bowlers = squad.filter((p) => canBowl(p.role));

  const scored = bowlers.map((p) => {
    const proj = projMap.get(p.playerId);
    const econ = p.recentEcon ?? 10; // high default for unknown
    const pts = proj?.projectedPoints ?? 0;
    // Lower economy = higher weight. Pure bowlers get a boost.
    const roleBonus = p.role === "bowler" ? 20 : 0;
    const weight = -econ * 5 + pts * 0.5 + roleBonus;
    return { player: p, weight };
  });

  scored.sort((a, b) => b.weight - a.weight);

  return scored.map((s, i) => ({
    playerId: s.player.playerId,
    suggestedPosition: i + 1,
    reason: bowlingReason(s.player, i + 1),
  }));
}

function bowlingReason(p: EligiblePlayer, pos: number): string {
  if (pos === 1) {
    return `lead strike bowler${
      p.recentEcon ? ` — ER ${p.recentEcon.toFixed(1)}` : ""
    } — use full 4-over quota first.`;
  }
  if (pos === 2) {
    return "second pick — get 4 overs in early while budget is fresh.";
  }
  if (pos === 3 || pos === 4) {
    return "middle-overs specialist.";
  }
  return p.role === "all_rounder"
    ? "death-overs option — saves your best for last."
    : "backup — may not bowl if budget exhausted.";
}

// ─── What If analysis ──────────────────────────────────────────────────

export interface WhatIfInput {
  actualBattingOrder: string[];
  actualBowlingPriority: string[];
  suggestedBattingOrder: string[];
  suggestedBowlingPriority: string[];
  projectionsByPlayerId: Map<string, PlayerProjection>;
}

export interface WhatIfResult {
  actualEstimate: number;
  suggestedEstimate: number;
  deltaPoints: number;
  topDifferentialMoves: Array<{
    playerId: string;
    actualPos: number;
    suggestedPos: number;
    impact: number;
  }>;
}

/**
 * Quick delta estimate: sum projections of the first 7 in each order
 * (because the 120-ball budget usually exhausts around there). This is
 * a fast heuristic — the real engine runs on live data at settlement.
 */
export function whatIf(input: WhatIfInput): WhatIfResult {
  const score = (order: string[]) => {
    return order
      .slice(0, 7)
      .reduce(
        (s, pid) =>
          s + (input.projectionsByPlayerId.get(pid)?.projectedPoints ?? 0),
        0
      );
  };

  const actualEstimate = score(input.actualBattingOrder);
  const suggestedEstimate = score(input.suggestedBattingOrder);

  // Find biggest position changes
  const actualPosMap = new Map(
    input.actualBattingOrder.map((p, i) => [p, i + 1])
  );
  const suggestedPosMap = new Map(
    input.suggestedBattingOrder.map((p, i) => [p, i + 1])
  );
  const moves = input.suggestedBattingOrder.map((pid) => {
    const actualPos = actualPosMap.get(pid) ?? 99;
    const suggestedPos = suggestedPosMap.get(pid) ?? 99;
    const pts = input.projectionsByPlayerId.get(pid)?.projectedPoints ?? 0;
    const impact = (actualPos - suggestedPos) * pts * 0.1;
    return { playerId: pid, actualPos, suggestedPos, impact };
  });
  moves.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));

  return {
    actualEstimate: Math.round(actualEstimate),
    suggestedEstimate: Math.round(suggestedEstimate),
    deltaPoints: Math.round(suggestedEstimate - actualEstimate),
    topDifferentialMoves: moves.slice(0, 5),
  };
}
