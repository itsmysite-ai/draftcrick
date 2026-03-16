/**
 * Credits Calculation Engine — deterministic fantasy credits from player stats.
 * Pure function with zero side effects, no DB calls.
 *
 * Sport: CRICKET (F1 / other sports will need separate engines)
 *
 * Output range: 7.0 – 10.0 (rounded to 1 decimal)
 *
 * WITHOUT recentAvgFP (pre-season / no match data):
 * - Batsman:       30% bat avg, 20% SR, 15% exp, 15% form, 10% sentiment, 10% baseline
 * - Bowler:        25% bowl avg, 20% econ, 20% exp, 15% form, 10% bowl SR, 10% sentiment
 * - All-rounder:   25% batting, 25% bowling, 15% exp, 10% form, 10% sentiment, 5% balance, 10% baseline
 * - Wicket-keeper: 25% bat avg, 20% SR, 15% exp, 15% form, 10% sentiment, 15% baseline
 *
 * WITH recentAvgFP (actual match performance — trumps career stats):
 * - Batsman:       20% bat avg, 15% SR, 30% recentFP, 10% form, 10% sentiment, 15% exp
 * - Bowler:        20% bowl avg, 15% econ, 10% bowl SR, 25% recentFP, 10% form, 5% sentiment, 15% exp
 * - All-rounder:   15% batting, 15% bowling, 30% recentFP, 10% form, 10% sentiment, 10% exp, 10% balance
 * - Wicket-keeper: 20% bat avg, 15% SR, 30% recentFP, 10% form, 10% sentiment, 15% exp
 *
 * Experience uses a power curve (x^0.6) to penalize low sample sizes:
 *   5 matches → 7.50,  16 → 8.00,  50 → 8.98,  100+ → 10.0
 *
 * Stat scaling ranges (wider = less sensitivity to small differences):
 * - Batting avg:       15 – 55      (higher = better)
 * - Strike rate:       100 – 180    (higher = better)
 * - Bowling avg:       12 – 40      (lower = better)
 * - Economy rate:      5 – 12       (lower = better)
 * - Bowling SR:        10 – 30      (lower = better)
 * - Experience:        0 – 100 matches, power 0.6 curve (more = better, steep penalty <30)
 * - Form/Sentiment:    1 – 10 score
 * - Recent avg FP:     15 – 80 pts
 *
 * Injury adjustment (applied after role calc):
 * - fit / null:    1.0x (no change)
 * - recovered:     0.95x (slight discount — returning from injury)
 * - doubtful:      0.85x (significant risk — may not play)
 * - injured:       0.70x (heavy discount — unlikely to play or perform)
 */

import type { CricketRole } from "@draftplay/shared";
import { getLogger } from "../lib/logger";

const log = getLogger("credits-engine");

export interface PlayerStatsForCredits {
  role: CricketRole;
  battingAvg: number | null;
  strikeRate: number | null;
  bowlingAvg: number | null;
  economyRate: number | null;
  bowlingStrikeRate: number | null;
  matchesPlayed: number | null;
  recentForm: number | null;
  sentimentScore: number | null;
  injuryStatus: string | null;
  recentAvgFP: number | null; // avg fantasy points over last 5 matches
}

const DEFAULT = 8.0;       // fallback for soft signals (form, sentiment) when missing
const STAT_UNKNOWN = 7.0;  // fallback for hard stats when 0 or missing — unknown players are cheap picks
const MIN = 7.0;
const MAX = 10.0;

/** Injury multipliers — applied to raw credits before clamping. */
const INJURY_MULTIPLIER: Record<string, number> = {
  fit: 1.0,
  recovered: 0.95,
  doubtful: 0.85,
  injured: 0.70,
};

/** Linear scale: value in [inMin, inMax] → [7.0, 10.0], clamped. */
function scale(value: number, inMin: number, inMax: number): number {
  const ratio = (value - inMin) / (inMax - inMin);
  return MIN + Math.max(0, Math.min(1, ratio)) * (MAX - MIN);
}

/** Inverse scale: lower input = higher output (bowling avg, economy). */
function inverseScale(value: number, inMax: number, inMin: number): number {
  return scale(value, inMax, inMin);
}

/** Scale a 1-10 score → 7.0-10.0. */
function scaleScore(score: number): number {
  return MIN + (Math.max(1, Math.min(10, score)) - 1) / 9 * (MAX - MIN);
}

/**
 * Scale matches played (experience): 0-100 → 7.0-10.0 using a power curve (x^0.6).
 * This penalizes low sample sizes harder than linear:
 *   5 matches → 7.50,  16 → 8.00,  50 → 8.98,  100+ → 10.0
 * A player with 16 matches scores a full point below a 100+ match veteran.
 */
function scaleExperience(matches: number): number {
  const capped = Math.min(matches, 100);
  const ratio = Math.pow(capped / 100, 0.6);
  return MIN + Math.max(0, Math.min(1, ratio)) * (MAX - MIN);
}

/** Scale recent avg fantasy points: 15-80 → 7.0-10.0. */
function scaleRecentFP(avgFP: number): number {
  return scale(avgFP, 15, 80);
}

/** Treat null or 0 as "no data" — 0 batting avg doesn't mean bad, it means unknown. */
function hasStat(v: number | null): v is number {
  return v != null && v > 0;
}

function calculateBatsmanCredits(s: PlayerStatsForCredits): number {
  const batAvg = hasStat(s.battingAvg) ? scale(s.battingAvg, 15, 55) : STAT_UNKNOWN;
  const sr = hasStat(s.strikeRate) ? scale(s.strikeRate, 100, 180) : STAT_UNKNOWN;
  const form = s.recentForm != null ? scaleScore(s.recentForm) : DEFAULT;
  const sentiment = s.sentimentScore != null ? scaleScore(s.sentimentScore) : DEFAULT;
  const exp = hasStat(s.matchesPlayed) ? scaleExperience(s.matchesPlayed) : STAT_UNKNOWN;

  if (hasStat(s.recentAvgFP)) {
    const rfp = scaleRecentFP(s.recentAvgFP);
    // 20% batAvg + 15% SR + 30% recentFP + 10% form + 10% sentiment + 15% exp = 100%
    return batAvg * 0.20 + sr * 0.15 + rfp * 0.30 + form * 0.10 + sentiment * 0.10 + exp * 0.15;
  }
  // 30% batAvg + 20% SR + 15% exp + 15% form + 10% sentiment + 10% baseline
  return batAvg * 0.30 + sr * 0.20 + exp * 0.15 + form * 0.15 + sentiment * 0.10 + STAT_UNKNOWN * 0.10;
}

function calculateBowlerCredits(s: PlayerStatsForCredits): number {
  const bowlAvg = hasStat(s.bowlingAvg) ? inverseScale(s.bowlingAvg, 40, 12) : STAT_UNKNOWN;
  const econ = hasStat(s.economyRate) ? inverseScale(s.economyRate, 12, 5) : STAT_UNKNOWN;
  const bowlSR = hasStat(s.bowlingStrikeRate) ? inverseScale(s.bowlingStrikeRate, 30, 10) : STAT_UNKNOWN;
  const form = s.recentForm != null ? scaleScore(s.recentForm) : DEFAULT;
  const sentiment = s.sentimentScore != null ? scaleScore(s.sentimentScore) : DEFAULT;
  const exp = hasStat(s.matchesPlayed) ? scaleExperience(s.matchesPlayed) : STAT_UNKNOWN;

  if (hasStat(s.recentAvgFP)) {
    const rfp = scaleRecentFP(s.recentAvgFP);
    // 20% bowlAvg + 15% econ + 10% bowlSR + 25% recentFP + 10% form + 5% sentiment + 15% exp = 100%
    return bowlAvg * 0.20 + econ * 0.15 + bowlSR * 0.10 + rfp * 0.25 + form * 0.10 + sentiment * 0.05 + exp * 0.15;
  }
  // 25% bowlAvg + 20% econ + 20% exp + 15% form + 10% bowlSR + 10% sentiment = 100%
  return bowlAvg * 0.25 + econ * 0.20 + exp * 0.20 + form * 0.15 + bowlSR * 0.10 + sentiment * 0.10;
}

function calculateAllRounderCredits(s: PlayerStatsForCredits): number {
  const batAvg = hasStat(s.battingAvg) ? scale(s.battingAvg, 15, 55) : STAT_UNKNOWN;
  const sr = hasStat(s.strikeRate) ? scale(s.strikeRate, 100, 180) : STAT_UNKNOWN;
  const battingSub = batAvg * 0.6 + sr * 0.4;

  const bowlAvg = hasStat(s.bowlingAvg) ? inverseScale(s.bowlingAvg, 40, 12) : STAT_UNKNOWN;
  const econ = hasStat(s.economyRate) ? inverseScale(s.economyRate, 12, 5) : STAT_UNKNOWN;
  const bowlingSub = bowlAvg * 0.6 + econ * 0.4;

  const form = s.recentForm != null ? scaleScore(s.recentForm) : DEFAULT;
  const sentiment = s.sentimentScore != null ? scaleScore(s.sentimentScore) : DEFAULT;
  const exp = hasStat(s.matchesPlayed) ? scaleExperience(s.matchesPlayed) : STAT_UNKNOWN;

  if (hasStat(s.recentAvgFP)) {
    const rfp = scaleRecentFP(s.recentAvgFP);
    // 15% batting + 15% bowling + 30% recentFP + 10% form + 10% sentiment + 10% exp + 10% balance
    const balance = Math.min(battingSub, bowlingSub); // reward balanced players
    return battingSub * 0.15 + bowlingSub * 0.15 + rfp * 0.30 + form * 0.10 + sentiment * 0.10 + exp * 0.10 + balance * 0.10;
  }
  // 25% batting + 25% bowling + 15% exp + 10% form + 10% sentiment + 5% balance + 10% baseline
  const balance = Math.min(battingSub, bowlingSub);
  return battingSub * 0.25 + bowlingSub * 0.25 + exp * 0.15 + form * 0.10 + sentiment * 0.10 + balance * 0.05 + STAT_UNKNOWN * 0.10;
}

function calculateWicketKeeperCredits(s: PlayerStatsForCredits): number {
  const batAvg = hasStat(s.battingAvg) ? scale(s.battingAvg, 15, 55) : STAT_UNKNOWN;
  const sr = hasStat(s.strikeRate) ? scale(s.strikeRate, 100, 180) : STAT_UNKNOWN;
  const form = s.recentForm != null ? scaleScore(s.recentForm) : DEFAULT;
  const sentiment = s.sentimentScore != null ? scaleScore(s.sentimentScore) : DEFAULT;
  const exp = hasStat(s.matchesPlayed) ? scaleExperience(s.matchesPlayed) : STAT_UNKNOWN;

  if (hasStat(s.recentAvgFP)) {
    const rfp = scaleRecentFP(s.recentAvgFP);
    // 20% batAvg + 15% SR + 30% recentFP + 10% form + 10% sentiment + 15% exp = 100%
    return batAvg * 0.20 + sr * 0.15 + rfp * 0.30 + form * 0.10 + sentiment * 0.10 + exp * 0.15;
  }
  // 25% batAvg + 20% SR + 15% exp + 15% form + 10% sentiment + 5% baseline + 10% keeping
  return batAvg * 0.25 + sr * 0.20 + exp * 0.15 + form * 0.15 + sentiment * 0.10 + STAT_UNKNOWN * 0.15;
}

/**
 * Calculate deterministic fantasy credits for a player based on role and stats.
 * Returns a value clamped to [7.0, 10.0], rounded to 1 decimal.
 *
 * Injury status applies a multiplier after the role-based calculation:
 * fit=1.0x, recovered=0.95x, doubtful=0.85x, injured=0.70x
 */
export function calculatePlayerCredits(stats: PlayerStatsForCredits): number {
  let raw: number;
  switch (stats.role) {
    case "batsman":
      raw = calculateBatsmanCredits(stats);
      break;
    case "bowler":
      raw = calculateBowlerCredits(stats);
      break;
    case "all_rounder":
      raw = calculateAllRounderCredits(stats);
      break;
    case "wicket_keeper":
      raw = calculateWicketKeeperCredits(stats);
      break;
    default:
      raw = DEFAULT;
  }

  // Apply injury adjustment
  const injury = stats.injuryStatus?.toLowerCase() ?? "fit";
  const multiplier = INJURY_MULTIPLIER[injury] ?? 1.0;
  if (multiplier < 1.0) {
    raw = raw * multiplier;
  }

  return Math.round(Math.max(MIN, Math.min(MAX, raw)) * 10) / 10;
}
