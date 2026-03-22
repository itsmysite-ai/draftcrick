import { eq, and, sql } from "drizzle-orm";
import type { Database } from "@draftplay/db";
import {
  contests,
  fantasyTeams,
} from "@draftplay/db";
import { updateContestRanks } from "./leaderboard";
import { awardCoins } from "./pop-coins";
import { sendPushNotification } from "./notifications";
import { getLogger } from "../lib/logger";

const log = getLogger("settlement");

interface PrizeSlot {
  rank: number;
  amount: number;
}

/**
 * Settle a contest after the match is completed.
 * 1. Calculate final ranks
 * 2. Distribute prizes to wallets
 * 3. Create transaction records
 * 4. Mark contest as settled
 */
export async function settleContest(
  db: Database,
  contestId: string
): Promise<{ settled: boolean; winners: number }> {
  // Get the contest
  const contest = await db.query.contests.findFirst({
    where: eq(contests.id, contestId),
  });

  if (!contest || contest.status === "settled") {
    return { settled: false, winners: 0 };
  }

  // Mark as settling
  await db
    .update(contests)
    .set({ status: "settling" })
    .where(eq(contests.id, contestId));

  // Update final ranks
  await updateContestRanks(db, contestId);

  // Get prize distribution
  const prizeDistribution = contest.prizeDistribution as PrizeSlot[];

  // Get ranked teams
  const teams = await db.query.fantasyTeams.findMany({
    where: eq(fantasyTeams.contestId, contestId),
    orderBy: (t, { asc }) => [asc(t.rank)],
  });

  let winnersCount = 0;

  // Distribute prizes (Pop Coins)
  for (const prize of prizeDistribution) {
    const team = teams.find((t) => t.rank === prize.rank);
    if (!team || prize.amount <= 0) continue;

    await awardCoins(db, team.userId, Math.floor(prize.amount), "contest_win", {
      contestId,
      rank: prize.rank,
      totalPoints: Number(team.totalPoints),
      contestName: contest.name,
    });

    // Send push notification to winner
    try {
      await sendPushNotification(
        db,
        team.userId,
        "contest_result",
        "Contest Win!",
        `You won ${Math.floor(prize.amount)} PC in ${contest.name} (Rank #${prize.rank})`,
        { contestId, rank: prize.rank },
      );
    } catch {
      log.warn({ userId: team.userId, contestId }, "Failed to send winner notification");
    }

    winnersCount++;
  }

  // Mark as settled
  await db
    .update(contests)
    .set({ status: "settled" })
    .where(eq(contests.id, contestId));

  return { settled: true, winners: winnersCount };
}

/**
 * Calculate prize distribution for a contest based on entries and fee.
 * Uses a standard payout structure.
 */
/**
 * Distribute remainder coins to top ranks so prize sum exactly equals pool.
 */
function distributeRemainder(slots: PrizeSlot[], pool: number): PrizeSlot[] {
  const total = slots.reduce((s, p) => s + p.amount, 0);
  let remainder = pool - total;
  for (let i = 0; i < slots.length && remainder > 0; i++) {
    slots[i].amount += 1;
    remainder--;
  }
  return slots;
}

export function calculatePrizeDistribution(
  entryFee: number,
  maxEntries: number,
  rake = 0 // no platform cut — 100% of pool goes to winners
): PrizeSlot[] {
  const totalPool = entryFee * maxEntries;
  const prizePool = Math.floor(totalPool * (1 - rake));

  if (maxEntries <= 2) {
    return [{ rank: 1, amount: prizePool }];
  }

  let slots: PrizeSlot[];

  if (maxEntries <= 10) {
    slots = [
      { rank: 1, amount: Math.floor(prizePool * 0.6) },
      { rank: 2, amount: Math.floor(prizePool * 0.25) },
      { rank: 3, amount: Math.floor(prizePool * 0.15) },
    ];
  } else if (maxEntries <= 100) {
    slots = [
      { rank: 1, amount: Math.floor(prizePool * 0.4) },
      { rank: 2, amount: Math.floor(prizePool * 0.2) },
      { rank: 3, amount: Math.floor(prizePool * 0.12) },
      { rank: 4, amount: Math.floor(prizePool * 0.08) },
      { rank: 5, amount: Math.floor(prizePool * 0.06) },
      { rank: 6, amount: Math.floor(prizePool * 0.05) },
      { rank: 7, amount: Math.floor(prizePool * 0.04) },
      { rank: 8, amount: Math.floor(prizePool * 0.03) },
      { rank: 9, amount: Math.floor(prizePool * 0.01) },
      { rank: 10, amount: Math.floor(prizePool * 0.01) },
    ];
  } else {
    const winnerCount = Math.max(10, Math.floor(maxEntries * 0.1));
    slots = [
      { rank: 1, amount: Math.floor(prizePool * 0.25) },
      { rank: 2, amount: Math.floor(prizePool * 0.12) },
      { rank: 3, amount: Math.floor(prizePool * 0.08) },
    ];

    const remainingPool = Math.floor(prizePool * 0.55);
    const remainingSlots = winnerCount - 3;
    const perSlot = Math.floor(remainingPool / remainingSlots);

    for (let i = 4; i <= winnerCount; i++) {
      slots.push({ rank: i, amount: perSlot });
    }
  }

  return distributeRemainder(slots, prizePool);
}
