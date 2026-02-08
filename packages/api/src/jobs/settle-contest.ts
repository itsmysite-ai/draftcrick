import type { Database } from "@draftcrick/db";
import { eq, and } from "drizzle-orm";
import { contests } from "@draftcrick/db";
import { settleContest } from "../services/settlement";

/**
 * Settlement job — runs after a match completes.
 * Settles all contests associated with the match.
 *
 * In production, this is a BullMQ worker triggered by Pub/Sub.
 */
export async function settleMatchContests(
  db: Database,
  matchId: string
): Promise<{ settledCount: number; totalWinners: number }> {
  const unsettledContests = await db.query.contests.findMany({
    where: and(
      eq(contests.matchId, matchId),
      eq(contests.status, "settling")
    ),
  });

  let settledCount = 0;
  let totalWinners = 0;

  for (const contest of unsettledContests) {
    const result = await settleContest(db, contest.id);
    if (result.settled) {
      settledCount++;
      totalWinners += result.winners;
    }
  }

  return { settledCount, totalWinners };
}
