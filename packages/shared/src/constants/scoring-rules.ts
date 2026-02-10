import type { ScoringRules } from "../types";

/**
 * Default scoring rules for T20 cricket fantasy.
 * Based on industry standards (Dream11/CrickBattle).
 */
export const DEFAULT_T20_SCORING: ScoringRules = {
  // Batting
  runPoints: 1,
  boundaryBonus: 1, // +1 per four (total 2 per four)
  sixBonus: 2, // +2 per six (total 3 per six)
  halfCenturyBonus: 20,
  centuryBonus: 50,
  strikeRateBonus: [
    { threshold: 200, points: 10 },
    { threshold: 175, points: 6 },
    { threshold: 150, points: 4 },
  ],
  duckPenalty: -5,

  // Bowling
  wicketPoints: 25,
  maidenOverPoints: 15,
  threeWicketBonus: 15,
  fiveWicketBonus: 30,
  economyRateBonus: [
    { threshold: 4, points: 10 }, // < 4 economy
    { threshold: 5, points: 6 },
    { threshold: 6, points: 4 },
  ],

  // Fielding
  catchPoints: 10,
  stumpingPoints: 15,
  runOutDirectPoints: 15,
  runOutIndirectPoints: 10,

  // Other
  playerOfMatchBonus: 25,
};

export const DEFAULT_ODI_SCORING: ScoringRules = {
  runPoints: 1,
  boundaryBonus: 1,
  sixBonus: 2,
  halfCenturyBonus: 10,
  centuryBonus: 30,
  strikeRateBonus: [
    { threshold: 150, points: 8 },
    { threshold: 125, points: 4 },
    { threshold: 100, points: 2 },
  ],
  duckPenalty: -3,

  wicketPoints: 25,
  maidenOverPoints: 10,
  threeWicketBonus: 10,
  fiveWicketBonus: 25,
  economyRateBonus: [
    { threshold: 3, points: 8 },
    { threshold: 4, points: 4 },
    { threshold: 5, points: 2 },
  ],

  catchPoints: 8,
  stumpingPoints: 12,
  runOutDirectPoints: 12,
  runOutIndirectPoints: 8,

  playerOfMatchBonus: 20,
};

export const DEFAULT_TEST_SCORING: ScoringRules = {
  runPoints: 1,
  boundaryBonus: 1,
  sixBonus: 2,
  halfCenturyBonus: 10,
  centuryBonus: 30,
  strikeRateBonus: [],
  duckPenalty: -4,

  wicketPoints: 20,
  maidenOverPoints: 5,
  threeWicketBonus: 10,
  fiveWicketBonus: 25,
  economyRateBonus: [],

  catchPoints: 8,
  stumpingPoints: 12,
  runOutDirectPoints: 12,
  runOutIndirectPoints: 8,

  playerOfMatchBonus: 15,
};

export function getScoringRulesForFormat(
  format: "t20" | "odi" | "test"
): ScoringRules {
  switch (format) {
    case "t20":
      return DEFAULT_T20_SCORING;
    case "odi":
      return DEFAULT_ODI_SCORING;
    case "test":
      return DEFAULT_TEST_SCORING;
  }
}
