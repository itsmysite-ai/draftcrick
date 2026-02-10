import { eq, and } from "drizzle-orm";
import type { Database } from "@draftcrick/db";
import {
  matches,
  playerMatchScores,
  fantasyTeams,
  contests,
} from "@draftcrick/db";
import { calculateFantasyPoints, DEFAULT_T20_SCORING } from "@draftcrick/shared";
import { updateContestRanks } from "../services/leaderboard";

/**
 * Score updater job.
 * In production, this runs as a BullMQ worker that:
 * 1. Polls CricAPI/SportRadar for live match data
 * 2. Updates player_match_scores in Cloud SQL
 * 3. Recalculates fantasy points for all teams
 * 4. Updates leaderboard rankings
 * 5. Broadcasts via Socket.io
 *
 * For development, this simulates score updates.
 */
export async function processScoreUpdate(
  db: Database,
  matchId: string,
  scoreUpdates: Array<{
    playerId: string;
    runs: number;
    ballsFaced: number;
    fours: number;
    sixes: number;
    wickets: number;
    oversBowled: number;
    runsConceded: number;
    maidens: number;
    catches: number;
    stumpings: number;
    runOuts: number;
  }>
): Promise<void> {
  // 1. Update player match scores
  for (const update of scoreUpdates) {
    const fantasyPoints = calculateFantasyPoints(update, DEFAULT_T20_SCORING);

    await db
      .update(playerMatchScores)
      .set({
        runs: update.runs,
        ballsFaced: update.ballsFaced,
        fours: update.fours,
        sixes: update.sixes,
        wickets: update.wickets,
        oversBowled: String(update.oversBowled),
        runsConceded: update.runsConceded,
        maidens: update.maidens,
        catches: update.catches,
        stumpings: update.stumpings,
        runOuts: update.runOuts,
        fantasyPoints: String(fantasyPoints),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(playerMatchScores.playerId, update.playerId),
          eq(playerMatchScores.matchId, matchId)
        )
      );
  }

  // 2. Recalculate total points for all fantasy teams in this match's contests
  const matchContests = await db.query.contests.findMany({
    where: and(
      eq(contests.matchId, matchId),
      eq(contests.status, "live")
    ),
  });

  for (const contest of matchContests) {
    // Get all teams in this contest
    const teams = await db.query.fantasyTeams.findMany({
      where: eq(fantasyTeams.contestId, contest.id),
    });

    // Get all player scores for this match
    const allScores = await db.query.playerMatchScores.findMany({
      where: eq(playerMatchScores.matchId, matchId),
    });

    const scoreMap = new Map(allScores.map((s) => [s.playerId, s]));

    // Recalculate each team's total
    for (const team of teams) {
      const teamPlayers = team.players as Array<{ playerId: string }>;
      let totalPoints = 0;

      for (const tp of teamPlayers) {
        const score = scoreMap.get(tp.playerId);
        if (!score) continue;

        let points = Number(score.fantasyPoints);

        // Apply captain/VC multipliers
        if (tp.playerId === team.captainId) {
          points *= 2;
        } else if (tp.playerId === team.viceCaptainId) {
          points *= 1.5;
        }

        totalPoints += points;
      }

      await db
        .update(fantasyTeams)
        .set({
          totalPoints: String(Math.round(totalPoints * 100) / 100),
          updatedAt: new Date(),
        })
        .where(eq(fantasyTeams.id, team.id));
    }

    // Update contest ranks
    await updateContestRanks(db, contest.id);
  }
}

/**
 * Lock contests when a match starts (status: upcoming → live).
 */
export async function lockMatchContests(
  db: Database,
  matchId: string
): Promise<number> {
  const result = await db
    .update(contests)
    .set({ status: "live" })
    .where(
      and(eq(contests.matchId, matchId), eq(contests.status, "open"))
    )
    .returning();

  // Update match status
  await db
    .update(matches)
    .set({ status: "live" })
    .where(eq(matches.id, matchId));

  return result.length;
}

/**
 * Mark match as completed and trigger settlement.
 */
export async function completeMatch(
  db: Database,
  matchId: string,
  result: string
): Promise<void> {
  await db
    .update(matches)
    .set({ status: "completed", result })
    .where(eq(matches.id, matchId));

  // Mark all live contests for this match as settling
  await db
    .update(contests)
    .set({ status: "settling" })
    .where(
      and(eq(contests.matchId, matchId), eq(contests.status, "live"))
    );
}
