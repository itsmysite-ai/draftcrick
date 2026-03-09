import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { desc, and, eq } from "drizzle-orm";
import { transactions } from "@draftplay/db";
import { getBalance, claimDailyReward, canClaimDaily } from "../services/pop-coins";
import { getUserTier, getTierConfigs } from "../services/subscription";
import { TRPCError } from "@trpc/server";

export const walletRouter = router({
  /**
   * Get user's Pop Coins balance + daily claim status
   */
  getBalance: protectedProcedure.query(async ({ ctx }) => {
    const wallet = await getBalance(ctx.db, ctx.user.id);
    const canClaim = canClaimDaily(wallet.lastDailyClaimAt);

    return {
      coinBalance: wallet.coinBalance,
      totalEarned: wallet.totalEarned,
      totalSpent: wallet.totalSpent,
      totalWon: wallet.totalWon,
      canClaimDaily: canClaim,
      currentStreak: wallet.loginStreak,
    };
  }),

  /**
   * Claim daily Pop Coins reward (tier-based amount + streak bonus)
   */
  claimDaily: protectedProcedure.mutation(async ({ ctx }) => {
    const tier = await getUserTier(ctx.db, ctx.user.id);
    const configs = await getTierConfigs();
    const dailyCoinDrip = configs[tier].features.dailyCoinDrip;

    try {
      const result = await claimDailyReward(ctx.db, ctx.user.id, dailyCoinDrip);
      return {
        success: true,
        coinsAwarded: result.coinsAwarded,
        newStreak: result.newStreak,
        streakBonus: result.streakBonus,
        tier,
      };
    } catch (e: any) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: e.message,
      });
    }
  }),

  /**
   * Get transaction history
   */
  getTransactions: protectedProcedure
    .input(
      z.object({
        type: z
          .enum([
            "daily_claim",
            "contest_entry",
            "contest_win",
            "prediction_win",
            "referral_bonus",
            "pack_purchase",
            "streak_bonus",
            "achievement",
          ])
          .optional(),
        limit: z.number().int().min(1).max(100).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(transactions.userId, ctx.user.id)];

      if (input.type) {
        conditions.push(eq(transactions.type, input.type));
      }

      const result = await ctx.db.query.transactions.findMany({
        where: and(...conditions),
        orderBy: [desc(transactions.createdAt)],
        limit: input.limit,
      });

      return result.map((t) => ({
        ...t,
        amount: t.amount,
      }));
    }),
});
