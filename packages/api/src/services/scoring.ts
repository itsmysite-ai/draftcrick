import type { ScoringRules, PlayerMatchScore } from "@draftcrick/shared";
import { calculateFantasyPoints } from "@draftcrick/shared";

/**
 * Calculate fantasy points for a player in a match, applying captain/VC multipliers.
 */
export function calculateTeamPlayerPoints(
  score: PlayerMatchScore,
  rules: ScoringRules,
  isCaptain: boolean,
  isViceCaptain: boolean,
  captainMultiplier = 2,
  viceCaptainMultiplier = 1.5
): number {
  const basePoints = calculateFantasyPoints(
    {
      runs: score.runs,
      ballsFaced: score.ballsFaced,
      fours: score.fours,
      sixes: score.sixes,
      wickets: score.wickets,
      oversBowled: score.oversBowled,
      runsConceded: score.runsConceded,
      maidens: score.maidens,
      catches: score.catches,
      stumpings: score.stumpings,
      runOuts: score.runOuts,
    },
    rules
  );

  if (isCaptain) return basePoints * captainMultiplier;
  if (isViceCaptain) return basePoints * viceCaptainMultiplier;
  return basePoints;
}

/**
 * Calculate total fantasy points for a full team.
 */
export function calculateTeamTotalPoints(
  playerScores: Map<string, PlayerMatchScore>,
  teamPlayers: { playerId: string }[],
  captainId: string,
  viceCaptainId: string,
  rules: ScoringRules,
  captainMultiplier = 2,
  viceCaptainMultiplier = 1.5
): number {
  let total = 0;

  for (const tp of teamPlayers) {
    const score = playerScores.get(tp.playerId);
    if (!score) continue;

    total += calculateTeamPlayerPoints(
      score,
      rules,
      tp.playerId === captainId,
      tp.playerId === viceCaptainId,
      captainMultiplier,
      viceCaptainMultiplier
    );
  }

  return Math.round(total * 100) / 100;
}
