import type { PlayerMatchScore } from "../types";
import type { ScoringRules } from "../types";

/**
 * Calculate fantasy points for a player's performance in a match.
 */
export function calculateFantasyPoints(
  score: Omit<PlayerMatchScore, "id" | "playerId" | "matchId" | "fantasyPoints" | "isPlaying" | "updatedAt">,
  rules: ScoringRules
): number {
  let points = 0;

  // Batting points
  points += score.runs * (rules.runPoints ?? 1);
  points += score.fours * (rules.boundaryBonus ?? 1);
  points += score.sixes * (rules.sixBonus ?? 2);

  if (score.runs >= 100) {
    points += rules.centuryBonus ?? 50;
  } else if (score.runs >= 50) {
    points += rules.halfCenturyBonus ?? 20;
  }

  // Duck penalty (only for batsmen who faced at least 1 ball)
  if (score.runs === 0 && score.ballsFaced > 0) {
    points += rules.duckPenalty ?? -5;
  }

  // Strike rate bonus (min 10 balls faced)
  if (score.ballsFaced >= 10 && rules.strikeRateBonus) {
    const sr = (score.runs / score.ballsFaced) * 100;
    for (const bonus of rules.strikeRateBonus) {
      if (sr >= bonus.threshold) {
        points += bonus.points;
        break;
      }
    }
  }

  // Bowling points
  points += score.wickets * (rules.wicketPoints ?? 25);
  points += score.maidens * (rules.maidenOverPoints ?? 15);

  if (score.wickets >= 5) {
    points += rules.fiveWicketBonus ?? 30;
  } else if (score.wickets >= 3) {
    points += rules.threeWicketBonus ?? 15;
  }

  // Economy rate bonus (min 2 overs bowled)
  if (score.oversBowled >= 2 && rules.economyRateBonus) {
    const er = score.runsConceded / score.oversBowled;
    for (const bonus of rules.economyRateBonus) {
      if (er <= bonus.threshold) {
        points += bonus.points;
        break;
      }
    }
  }

  // Fielding points
  points += score.catches * (rules.catchPoints ?? 10);
  points += score.stumpings * (rules.stumpingPoints ?? 15);
  points += score.runOuts * (rules.runOutDirectPoints ?? 15);

  return Math.round(points * 100) / 100;
}
