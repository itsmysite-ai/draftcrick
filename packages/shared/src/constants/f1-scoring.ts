import type { F1ScoringRules } from "../types/contest";

export const DEFAULT_F1_RACE_SCORING: F1ScoringRules = {
  raceFinishPoints: {
    1: 25, 2: 18, 3: 15, 4: 12, 5: 10,
    6: 8, 7: 6, 8: 4, 9: 2, 10: 1,
  },
  sprintFinishPoints: {
    1: 8, 2: 7, 3: 6, 4: 5, 5: 4,
    6: 3, 7: 2, 8: 1,
  },
  fastestLapBonus: 5,
  polePositionBonus: 3,
  dnfPenalty: -10,
  positionsGainedPoints: 2,
  constructorFinishPoints: {
    1: 25, 2: 18, 3: 15,
  },
  driverOfTheDayBonus: 10,
  playerOfMatchBonus: 10,
};

export interface F1MatchStats {
  finishPosition: number;
  gridPosition: number;
  fastestLap: boolean;
  dnf: boolean;
  driverOfTheDay: boolean;
  sprintFinishPosition?: number;
}

export function calculateF1FantasyPoints(
  stats: F1MatchStats,
  rules: F1ScoringRules
): number {
  let points = 0;

  // Race finish position
  if (!stats.dnf && rules.raceFinishPoints) {
    points += rules.raceFinishPoints[stats.finishPosition] ?? 0;
  }

  // Fastest lap (only if finished in top 10 per F1 rules)
  if (stats.fastestLap && stats.finishPosition <= 10 && rules.fastestLapBonus) {
    points += rules.fastestLapBonus;
  }

  // Pole position
  if (stats.gridPosition === 1 && rules.polePositionBonus) {
    points += rules.polePositionBonus;
  }

  // Positions gained
  if (!stats.dnf && rules.positionsGainedPoints) {
    const gained = stats.gridPosition - stats.finishPosition;
    if (gained > 0) {
      points += gained * rules.positionsGainedPoints;
    }
  }

  // Sprint finish
  if (stats.sprintFinishPosition && rules.sprintFinishPoints) {
    points += rules.sprintFinishPoints[stats.sprintFinishPosition] ?? 0;
  }

  // DNF penalty
  if (stats.dnf && rules.dnfPenalty) {
    points += rules.dnfPenalty;
  }

  // Driver of the day
  if (stats.driverOfTheDay && rules.driverOfTheDayBonus) {
    points += rules.driverOfTheDayBonus;
  }

  return points;
}
