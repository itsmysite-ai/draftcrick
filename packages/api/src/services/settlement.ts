import { eq, and, sql } from "drizzle-orm";
import type { Database } from "@draftcrick/db";
import {
  contests,
  fantasyTeams,
  wallets,
  transactions,
} from "@draftcrick/db";
import { updateContestRanks } from "./leaderboard";

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

  // Distribute prizes
  for (const prize of prizeDistribution) {
    const team = teams.find((t) => t.rank === prize.rank);
    if (!team || prize.amount <= 0) continue;

    // Credit wallet
    await db
      .update(wallets)
      .set({
        cashBalance: sql`${wallets.cashBalance} + ${String(prize.amount)}`,
        totalWinnings: sql`${wallets.totalWinnings} + ${String(prize.amount)}`,
        updatedAt: new Date(),
      })
      .where(eq(wallets.userId, team.userId));

    // Create transaction record
    await db.insert(transactions).values({
      userId: team.userId,
      type: "winnings",
      amount: String(prize.amount),
      status: "completed",
      contestId: contestId,
      metadata: {
        rank: prize.rank,
        totalPoints: Number(team.totalPoints),
        contestName: contest.name,
      },
    });

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
export function calculatePrizeDistribution(
  entryFee: number,
  maxEntries: number,
  rake = 0.12 // 12% platform fee
): PrizeSlot[] {
  const totalPool = entryFee * maxEntries;
  const prizePool = totalPool * (1 - rake);

  if (maxEntries <= 2) {
    // H2H
    return [{ rank: 1, amount: Math.floor(prizePool * 100) / 100 }];
  }

  if (maxEntries <= 10) {
    return [
      { rank: 1, amount: Math.floor(prizePool * 0.6 * 100) / 100 },
      { rank: 2, amount: Math.floor(prizePool * 0.25 * 100) / 100 },
      { rank: 3, amount: Math.floor(prizePool * 0.15 * 100) / 100 },
    ];
  }

  if (maxEntries <= 100) {
    return [
      { rank: 1, amount: Math.floor(prizePool * 0.4 * 100) / 100 },
      { rank: 2, amount: Math.floor(prizePool * 0.2 * 100) / 100 },
      { rank: 3, amount: Math.floor(prizePool * 0.12 * 100) / 100 },
      { rank: 4, amount: Math.floor(prizePool * 0.08 * 100) / 100 },
      { rank: 5, amount: Math.floor(prizePool * 0.06 * 100) / 100 },
      { rank: 6, amount: Math.floor(prizePool * 0.05 * 100) / 100 },
      { rank: 7, amount: Math.floor(prizePool * 0.04 * 100) / 100 },
      { rank: 8, amount: Math.floor(prizePool * 0.03 * 100) / 100 },
      { rank: 9, amount: Math.floor(prizePool * 0.01 * 100) / 100 },
      { rank: 10, amount: Math.floor(prizePool * 0.01 * 100) / 100 },
    ];
  }

  // Large contests — top 10% get prizes
  const winnerCount = Math.max(10, Math.floor(maxEntries * 0.1));
  const slots: PrizeSlot[] = [
    { rank: 1, amount: Math.floor(prizePool * 0.25 * 100) / 100 },
    { rank: 2, amount: Math.floor(prizePool * 0.12 * 100) / 100 },
    { rank: 3, amount: Math.floor(prizePool * 0.08 * 100) / 100 },
  ];

  const remainingPool = prizePool * 0.55;
  const remainingSlots = winnerCount - 3;
  const perSlot = Math.floor((remainingPool / remainingSlots) * 100) / 100;

  for (let i = 4; i <= winnerCount; i++) {
    slots.push({ rank: i, amount: perSlot });
  }

  return slots;
}
