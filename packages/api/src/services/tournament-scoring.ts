/**
 * Tournament Scoring Service — scores match results for tournament leagues.
 *
 * After a match completes:
 * 1. Fetch all team submissions for that match
 * 2. Look up player match scores from DB
 * 3. Calculate fantasy points per team (with chip modifiers)
 * 4. Update tournamentTeamSubmissions.totalPoints + captainPoints
 * 5. Trigger match awards + running awards
 */

import { eq, and } from "drizzle-orm";
import type { Database } from "@draftplay/db";
import { tournamentTeamSubmissions, playerMatchScores } from "@draftplay/db";
import { DEFAULT_T20_SCORING, DEFAULT_ODI_SCORING, DEFAULT_TEST_SCORING } from "@draftplay/shared";
import type { ScoringRules } from "@draftplay/shared";
import { calculateTeamPlayerPoints } from "./scoring";
import { getChipScoringModifiers } from "./chips";
import { calculateMatchAwards, calculateRunningAwards } from "./awards";
import { getLogger } from "../lib/logger";

const log = getLogger("tournament-scoring");

function getScoringRules(format: string): ScoringRules {
  const f = format.toLowerCase();
  if (f.includes("odi") || f.includes("50")) return DEFAULT_ODI_SCORING;
  if (f.includes("test")) return DEFAULT_TEST_SCORING;
  return DEFAULT_T20_SCORING;
}

interface SquadPlayer {
  playerId: string;
  role: string;
  isCaptain?: boolean;
  isViceCaptain?: boolean;
}

/**
 * Score all team submissions for a given match in a tournament league.
 */
export async function scoreMatchForTournament(
  db: Database,
  tournamentLeagueId: string,
  matchId: string,
  format = "T20"
): Promise<{ scored: number; awardsCreated: number }> {
  log.info({ tournamentLeagueId, matchId, format }, "Scoring match for tournament");

  // 1. Get all team submissions for this match
  const submissions = await db.query.tournamentTeamSubmissions.findMany({
    where: and(
      eq(tournamentTeamSubmissions.tournamentLeagueId, tournamentLeagueId),
      eq(tournamentTeamSubmissions.matchId, matchId),
    ),
  });

  if (submissions.length === 0) {
    log.info({ tournamentLeagueId, matchId }, "No submissions to score");
    return { scored: 0, awardsCreated: 0 };
  }

  // 2. Fetch all player match scores for this match
  const scores = await db.query.playerMatchScores.findMany({
    where: eq(playerMatchScores.matchId, matchId),
  });

  const scoreMap = new Map<string, any>();
  for (const s of scores) {
    scoreMap.set(s.playerId, {
      ...s,
      oversBowled: Number(s.oversBowled),
    });
  }

  const rules = getScoringRules(format);
  let scored = 0;

  // 3. Score each submission
  for (const sub of submissions) {
    const squad = (sub.squad as SquadPlayer[]) ?? [];
    const playingXi = (sub.playingXi as { playerId: string }[]) ?? [];

    // Determine captain and vice-captain
    const captain = squad.find((p) => p.isCaptain);
    const viceCaptain = squad.find((p) => p.isViceCaptain);
    const captainId = captain?.playerId ?? "";
    const viceCaptainId = viceCaptain?.playerId ?? "";

    // Get chip modifiers
    const chipMods = sub.chipUsed
      ? getChipScoringModifiers(sub.chipUsed as any)
      : null;

    const captainMult = chipMods?.captainMultiplier ?? 2;
    const vcMult = chipMods?.viceCaptainMultiplier ?? 1.5;

    // Determine which players to score: playing XI, or squad if bench_boost
    const playersToScore = chipMods?.includesBench ? squad : playingXi;

    let totalPoints = 0;
    let captainPoints = 0;

    for (const tp of playersToScore) {
      const playerScore = scoreMap.get(tp.playerId);
      if (!playerScore) continue;

      const isCaptain = tp.playerId === captainId;
      const isViceCaptain = tp.playerId === viceCaptainId;

      let pts = calculateTeamPlayerPoints(
        playerScore,
        rules,
        isCaptain,
        isViceCaptain,
        captainMult,
        vcMult,
      );

      // Apply chip-specific multipliers
      if (chipMods?.battingMultiplier && chipMods.battingMultiplier !== 1) {
        // power_play chip: boost batting points (runs, boundaries)
        const batPts = calculateTeamPlayerPoints(
          { ...playerScore, wickets: 0, oversBowled: 0, runsConceded: 0, maidens: 0 },
          rules,
          false,
          false,
        );
        pts += batPts * (chipMods.battingMultiplier - 1);
      }

      totalPoints += pts;
      if (isCaptain) captainPoints = pts;
    }

    totalPoints = Math.round(totalPoints * 100) / 100;
    captainPoints = Math.round(captainPoints * 100) / 100;

    // 4. Update submission with scored points
    await db
      .update(tournamentTeamSubmissions)
      .set({
        totalPoints: String(totalPoints),
        captainPoints: String(captainPoints),
      })
      .where(eq(tournamentTeamSubmissions.id, sub.id));

    scored++;
  }

  log.info({ tournamentLeagueId, matchId, scored }, "Match scoring complete");

  // 5. Calculate awards
  let awardsCreated = 0;
  try {
    const matchAwards = await calculateMatchAwards(db, tournamentLeagueId, matchId);
    awardsCreated += Array.isArray(matchAwards) ? matchAwards.length : (typeof matchAwards === "number" ? matchAwards : 0);
  } catch (err: any) {
    log.error({ err: err.message }, "Failed to calculate match awards");
  }

  try {
    const runningAwards = await calculateRunningAwards(db, tournamentLeagueId);
    awardsCreated += Array.isArray(runningAwards) ? runningAwards.length : (typeof runningAwards === "number" ? runningAwards : 0);
  } catch (err: any) {
    log.error({ err: err.message }, "Failed to calculate running awards");
  }

  return { scored, awardsCreated };
}
