import { eq, desc, sql, and } from "drizzle-orm";
import type { Database } from "@draftcrick/db";
import { fantasyTeams, contests, users } from "@draftcrick/db";

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  displayName: string;
  totalPoints: number;
  teamId: string;
}

/**
 * Calculate and return the leaderboard for a contest.
 * In production, this would use Redis sorted sets for real-time caching.
 * For now, we compute from the database.
 */
export async function getContestLeaderboard(
  db: Database,
  contestId: string
): Promise<LeaderboardEntry[]> {
  const teams = await db
    .select({
      teamId: fantasyTeams.id,
      userId: fantasyTeams.userId,
      username: users.username,
      displayName: users.displayName,
      totalPoints: fantasyTeams.totalPoints,
    })
    .from(fantasyTeams)
    .innerJoin(users, eq(fantasyTeams.userId, users.id))
    .where(eq(fantasyTeams.contestId, contestId))
    .orderBy(desc(fantasyTeams.totalPoints));

  return teams.map((t, index) => ({
    rank: index + 1,
    userId: t.userId,
    username: t.username,
    displayName: t.displayName,
    totalPoints: Number(t.totalPoints),
    teamId: t.teamId,
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
    percentile:
      leaderboard.length > 1
        ? Math.round(
            ((leaderboard.length - entry.rank) / (leaderboard.length - 1)) * 100
          )
        : 100,
  };
}
