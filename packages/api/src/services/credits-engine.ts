/**
 * Credits Calculation Engine — deterministic fantasy credits from player stats.
 * Pure function with zero side effects, no DB calls.
 *
 * Role-specific formulas:
 * - Batsman: 40% bat avg, 25% strike rate, 15% form, 10% sentiment, 10% experience
 * - Bowler: 35% bowl avg (inv), 25% economy (inv), 15% bowl SR (inv), 15% form, 10% sentiment
 * - All-rounder: 30% batting sub, 30% bowling sub, 20% form, 20% sentiment
 * - Wicket-keeper: 35% bat avg, 20% strike rate, 20% form, 15% sentiment, 10% experience
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
}

const DEFAULT = 8.0;
const MIN = 7.0;
const MAX = 10.0;

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

/** Scale matches played (experience): 0-50 → 7.0-10.0. */
function scaleExperience(matches: number): number {
  return scale(matches, 0, 50);
}

function calculateBatsmanCredits(s: PlayerStatsForCredits): number {
  const batAvg = s.battingAvg != null ? scale(s.battingAvg, 15, 55) : DEFAULT;
  const sr = s.strikeRate != null ? scale(s.strikeRate, 100, 180) : DEFAULT;
  const form = s.recentForm != null ? scaleScore(s.recentForm) : DEFAULT;
  const sentiment = s.sentimentScore != null ? scaleScore(s.sentimentScore) : DEFAULT;
  const exp = s.matchesPlayed != null ? scaleExperience(s.matchesPlayed) : DEFAULT;
  return batAvg * 0.40 + sr * 0.25 + form * 0.15 + sentiment * 0.10 + exp * 0.10;
}

function calculateBowlerCredits(s: PlayerStatsForCredits): number {
  const bowlAvg = s.bowlingAvg != null ? inverseScale(s.bowlingAvg, 35, 15) : DEFAULT;
  const econ = s.economyRate != null ? inverseScale(s.economyRate, 10, 5) : DEFAULT;
  const bowlSR = s.bowlingStrikeRate != null ? inverseScale(s.bowlingStrikeRate, 25, 12) : DEFAULT;
  const form = s.recentForm != null ? scaleScore(s.recentForm) : DEFAULT;
  const sentiment = s.sentimentScore != null ? scaleScore(s.sentimentScore) : DEFAULT;
  return bowlAvg * 0.35 + econ * 0.25 + bowlSR * 0.15 + form * 0.15 + sentiment * 0.10;
}

function calculateAllRounderCredits(s: PlayerStatsForCredits): number {
  const batAvg = s.battingAvg != null ? scale(s.battingAvg, 15, 55) : DEFAULT;
  const sr = s.strikeRate != null ? scale(s.strikeRate, 100, 180) : DEFAULT;
  const battingSub = batAvg * 0.6 + sr * 0.4;

  const bowlAvg = s.bowlingAvg != null ? inverseScale(s.bowlingAvg, 35, 15) : DEFAULT;
  const econ = s.economyRate != null ? inverseScale(s.economyRate, 10, 5) : DEFAULT;
  const bowlingSub = bowlAvg * 0.6 + econ * 0.4;

  const form = s.recentForm != null ? scaleScore(s.recentForm) : DEFAULT;
  const sentiment = s.sentimentScore != null ? scaleScore(s.sentimentScore) : DEFAULT;
  return battingSub * 0.30 + bowlingSub * 0.30 + form * 0.20 + sentiment * 0.20;
}

function calculateWicketKeeperCredits(s: PlayerStatsForCredits): number {
  const batAvg = s.battingAvg != null ? scale(s.battingAvg, 15, 55) : DEFAULT;
  const sr = s.strikeRate != null ? scale(s.strikeRate, 100, 180) : DEFAULT;
  const form = s.recentForm != null ? scaleScore(s.recentForm) : DEFAULT;
  const sentiment = s.sentimentScore != null ? scaleScore(s.sentimentScore) : DEFAULT;
  const exp = s.matchesPlayed != null ? scaleExperience(s.matchesPlayed) : DEFAULT;
  return batAvg * 0.35 + sr * 0.20 + form * 0.20 + sentiment * 0.15 + exp * 0.10;
}

/**
 * Calculate deterministic fantasy credits for a player based on role and stats.
 * Returns a value clamped to [7.0, 10.0], rounded to 1 decimal.
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
  return Math.round(Math.max(MIN, Math.min(MAX, raw)) * 10) / 10;
}
