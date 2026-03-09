/**
 * Pop Coins Service — virtual currency engine.
 *
 * Handles earning, spending, daily claims, and streak bonuses.
 * No real money in/out — PROGA-compliant.
 */

import { eq, sql } from "drizzle-orm";
import type { Database } from "@draftplay/db";
import { wallets, transactions } from "@draftplay/db";
import { getLogger } from "../lib/logger";

const log = getLogger("pop-coins");

const SIGNUP_BONUS = 500;
const MAX_STREAK_MULTIPLIER = 7; // 7 days = max +70%
const STREAK_BONUS_PER_DAY = 0.1; // +10% per consecutive day

/**
 * Get wallet balance, auto-creating with signup bonus if needed.
 */
export async function getBalance(db: Database, userId: string) {
  let wallet = await db.query.wallets.findFirst({
    where: eq(wallets.userId, userId),
  });

  if (!wallet) {
    const [created] = await db
      .insert(wallets)
      .values({ userId, coinBalance: SIGNUP_BONUS })
      .returning();
    wallet = created!;

    await db.insert(transactions).values({
      userId,
      type: "achievement",
      amount: SIGNUP_BONUS,
      status: "completed",
      metadata: { reason: "signup_bonus" },
    });

    log.info({ userId }, "Created wallet with signup bonus");
  }

  return {
    coinBalance: wallet.coinBalance,
    totalEarned: wallet.totalEarned,
    totalSpent: wallet.totalSpent,
    totalWon: wallet.totalWon,
    lastDailyClaimAt: wallet.lastDailyClaimAt,
    loginStreak: wallet.loginStreak,
  };
}

/**
 * Check if user can claim daily reward right now.
 */
export function canClaimDaily(lastClaimAt: Date | null): boolean {
  if (!lastClaimAt) return true;
  const now = new Date();
  const last = new Date(lastClaimAt);
  // Reset at midnight UTC
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const lastClaimDay = new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), last.getUTCDate()));
  return todayStart > lastClaimDay;
}

/**
 * Check if streak is still active (claimed yesterday).
 */
function isStreakActive(lastClaimAt: Date | null): boolean {
  if (!lastClaimAt) return false;
  const now = new Date();
  const last = new Date(lastClaimAt);
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setUTCDate(yesterdayStart.getUTCDate() - 1);
  const lastClaimDay = new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), last.getUTCDate()));
  return lastClaimDay.getTime() === yesterdayStart.getTime();
}

/**
 * Claim daily Pop Coins reward. Tier determines base amount.
 * Streak bonus: +10% per consecutive day (max 7 days = +70%).
 */
export async function claimDailyReward(
  db: Database,
  userId: string,
  dailyCoinDrip: number
): Promise<{ coinsAwarded: number; newStreak: number; streakBonus: number }> {
  const wallet = await getBalance(db, userId);

  if (!canClaimDaily(wallet.lastDailyClaimAt)) {
    throw new Error("Daily reward already claimed today");
  }

  // Calculate streak
  const streakContinues = isStreakActive(wallet.lastDailyClaimAt);
  const newStreak = streakContinues ? Math.min(wallet.loginStreak + 1, MAX_STREAK_MULTIPLIER) : 1;
  const streakMultiplier = 1 + (newStreak - 1) * STREAK_BONUS_PER_DAY;
  const streakBonus = Math.floor(dailyCoinDrip * (streakMultiplier - 1));
  const totalCoins = dailyCoinDrip + streakBonus;

  const now = new Date();

  await db
    .update(wallets)
    .set({
      coinBalance: sql`${wallets.coinBalance} + ${totalCoins}`,
      totalEarned: sql`${wallets.totalEarned} + ${totalCoins}`,
      lastDailyClaimAt: now,
      loginStreak: newStreak,
      updatedAt: now,
    })
    .where(eq(wallets.userId, userId));

  await db.insert(transactions).values({
    userId,
    type: "daily_claim",
    amount: totalCoins,
    status: "completed",
    metadata: { baseDrip: dailyCoinDrip, streakBonus, streak: newStreak },
  });

  log.info({ userId, totalCoins, newStreak, streakBonus }, "Daily reward claimed");

  return { coinsAwarded: totalCoins, newStreak, streakBonus };
}

/**
 * Deduct Pop Coins from user wallet. Throws if insufficient balance.
 */
export async function deductCoins(
  db: Database,
  userId: string,
  amount: number,
  type: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  if (amount <= 0) throw new Error("Amount must be positive");

  const wallet = await getBalance(db, userId);

  if (wallet.coinBalance < amount) {
    throw new Error(`Insufficient Pop Coins. Need ${amount}, have ${wallet.coinBalance}`);
  }

  await db
    .update(wallets)
    .set({
      coinBalance: sql`${wallets.coinBalance} - ${amount}`,
      totalSpent: sql`${wallets.totalSpent} + ${amount}`,
      updatedAt: new Date(),
    })
    .where(eq(wallets.userId, userId));

  await db.insert(transactions).values({
    userId,
    type,
    amount,
    status: "completed",
    metadata: metadata ?? null,
  });

  log.info({ userId, amount, type }, "Pop Coins deducted");
}

/**
 * Award Pop Coins to user wallet.
 */
export async function awardCoins(
  db: Database,
  userId: string,
  amount: number,
  type: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  if (amount <= 0) return;

  // Ensure wallet exists
  await getBalance(db, userId);

  const isWinning = type === "contest_win" || type === "prediction_win";

  await db
    .update(wallets)
    .set({
      coinBalance: sql`${wallets.coinBalance} + ${amount}`,
      totalEarned: sql`${wallets.totalEarned} + ${amount}`,
      ...(isWinning ? { totalWon: sql`${wallets.totalWon} + ${amount}` } : {}),
      updatedAt: new Date(),
    })
    .where(eq(wallets.userId, userId));

  await db.insert(transactions).values({
    userId,
    type,
    amount,
    status: "completed",
    metadata: metadata ?? null,
  });

  log.info({ userId, amount, type }, "Pop Coins awarded");
}
