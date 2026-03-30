import { eq, desc, sql, and } from "drizzle-orm";
import type { Database } from "@draftplay/db";
import { fantasyTeams, contests, users, playerMatchScores } from "@draftplay/db";

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  displayName: string;
  totalPoints: number;
  teamId: string;
  teamName: string | null;
}

/**
 * Calculate live points for a team from playerMatchScores.
 * Applies captain (2x) and vice-captain (1.5x) multipliers.
 */
async function calculateLivePoints(
  db: Database,
  team: { id: string; players: any; captainId: string; viceCaptainId: string; predictionPoints: string | null },
  matchId: string,
  scoreMap: Map<string, number>
): Promise<number> {
  const teamPlayers = team.players as Array<{ playerId: string }>;
  let total = 0;

  for (const tp of teamPlayers) {
    const pts = scoreMap.get(tp.playerId) ?? 0;
    if (tp.playerId === team.captainId) {
      total += pts * 2;
    } else if (tp.playerId === team.viceCaptainId) {
      total += pts * 1.5;
    } else {
      total += pts;
    }
  }

  // Add prediction points
  const predPts = Number(team.predictionPoints ?? 0);
  return Math.round((total + predPts) * 100) / 100;
}

/**
 * Calculate and return the leaderboard for a contest.
 * For live/open matches, computes points dynamically from playerMatchScores
 * so points display even before the scoring pipeline runs.
 */
export async function getContestLeaderboard(
  db: Database,
  contestId: string
): Promise<LeaderboardEntry[]> {
  // Get contest to find the matchId
  const contest = await db.query.contests.findFirst({
    where: eq(contests.id, contestId),
    columns: { id: true, matchId: true, status: true },
  });

  const teams = await db
    .select({
      teamId: fantasyTeams.id,
      teamName: fantasyTeams.name,
      userId: fantasyTeams.userId,
      username: users.username,
      displayName: users.displayName,
      totalPoints: fantasyTeams.totalPoints,
      players: fantasyTeams.players,
      captainId: fantasyTeams.captainId,
      viceCaptainId: fantasyTeams.viceCaptainId,
      predictionPoints: fantasyTeams.predictionPoints,
      matchId: fantasyTeams.matchId,
    })
    .from(fantasyTeams)
    .innerJoin(users, eq(fantasyTeams.userId, users.id))
    .where(eq(fantasyTeams.contestId, contestId))
    .orderBy(desc(fantasyTeams.totalPoints));

  // Compute live points from playerMatchScores when contest is active,
  // or when settled but stored points are all zero (scores weren't persisted).
  const allStoredZero = teams.every((t) => Number(t.totalPoints) === 0);
  const isLiveOrOpen = contest && (contest.status !== "settled" || allStoredZero);
  if (isLiveOrOpen && contest.matchId) {
    const allScores = await db.query.playerMatchScores.findMany({
      where: eq(playerMatchScores.matchId, contest.matchId),
      columns: { playerId: true, fantasyPoints: true },
    });

    // Only compute live if there are actual scores
    if (allScores.length > 0) {
      const scoreMap = new Map(allScores.map((s) => [s.playerId, Number(s.fantasyPoints)]));

      const withLivePoints = await Promise.all(
        teams.map(async (t) => ({
          ...t,
          livePoints: await calculateLivePoints(db, {
            id: t.teamId,
            players: t.players,
            captainId: t.captainId,
            viceCaptainId: t.viceCaptainId,
            predictionPoints: t.predictionPoints,
          }, contest.matchId, scoreMap),
        }))
      );

      // Sort by live points descending
      withLivePoints.sort((a, b) => b.livePoints - a.livePoints);

      return withLivePoints.map((t, index) => ({
        rank: index + 1,
        userId: t.userId,
        username: t.username,
        displayName: t.displayName,
        totalPoints: t.livePoints,
        teamId: t.teamId,
        teamName: t.teamName,
      }));
    }
  }

  // Fallback: use stored totalPoints (for settled contests or no scores yet)
  return teams.map((t, index) => ({
    rank: index + 1,
    userId: t.userId,
    username: t.username,
    displayName: t.displayName,
    totalPoints: Number(t.totalPoints),
    teamId: t.teamId,
    teamName: t.teamName,
  }));
}

/**
 * Update ranks for all teams in a contest based on their total points.
 */
export async function updateContestRanks(
  db: Database,
  contestId: string
): Promise<void> {
  const leaderboard = await getContestLeaderboard(db, contestId);

  for (const entry of leaderboard) {
    await db
      .update(fantasyTeams)
      .set({ rank: entry.rank })
      .where(
        and(
          eq(fantasyTeams.id, entry.teamId),
          eq(fantasyTeams.contestId, contestId)
        )
      );
  }
}

/**
 * Get a user's rank and percentile in a contest.
 */
export async function getUserContestPosition(
  db: Database,
  contestId: string,
  userId: string
): Promise<{ rank: number; totalEntries: number; percentile: number } | null> {
  const leaderboard = await getContestLeaderboard(db, contestId);
  const entry = leaderboard.find((e) => e.userId === userId);

  if (!entry) return null;

  return {
    rank: entry.rank,
    totalEntries: leaderboard.length,
    percentile: Math.max(1, Math.round((entry.rank / leaderboard.length) * 100)),
  };
}
