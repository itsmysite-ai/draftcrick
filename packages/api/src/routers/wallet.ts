import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { eq, desc, and, sql } from "drizzle-orm";
import { wallets, transactions } from "@draftcrick/db";
import { TRPCError } from "@trpc/server";

export const walletRouter = router({
  /**
   * Get user's wallet balance
   */
  getBalance: protectedProcedure.query(async ({ ctx }) => {
    let wallet = await ctx.db.query.wallets.findFirst({
      where: eq(wallets.userId, ctx.user.id),
    });

    // Auto-create wallet if it doesn't exist
    if (!wallet) {
      const [created] = await ctx.db
        .insert(wallets)
        .values({ userId: ctx.user.id })
        .returning();
      wallet = created!;
    }

    return {
      cashBalance: Number(wallet.cashBalance),
      bonusBalance: Number(wallet.bonusBalance),
      totalBalance: Number(wallet.cashBalance) + Number(wallet.bonusBalance),
      totalDeposited: Number(wallet.totalDeposited),
      totalWithdrawn: Number(wallet.totalWithdrawn),
      totalWinnings: Number(wallet.totalWinnings),
    };
  }),

  /**
   * Deposit funds (creates a pending transaction).
   * In production, this initiates Razorpay/Stripe checkout.
   * For development, directly credits the wallet.
   */
  deposit: protectedProcedure
    .input(
      z.object({
        amount: z.number().min(1).max(100000),
        gateway: z.enum(["razorpay", "stripe"]).default("razorpay"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Ensure wallet exists
      const existing = await ctx.db.query.wallets.findFirst({
        where: eq(wallets.userId, ctx.user.id),
      });
      if (!existing) {
        await ctx.db.insert(wallets).values({ userId: ctx.user.id });
      }

      // In dev mode: directly credit. In production: create pending + redirect to gateway.
      const [txn] = await ctx.db
        .insert(transactions)
        .values({
          userId: ctx.user.id,
          type: "deposit",
          amount: String(input.amount),
          status: "completed",
          gateway: input.gateway,
          metadata: { environment: "development" },
        })
        .returning();

      // Credit wallet
      await ctx.db
        .update(wallets)
        .set({
          cashBalance: sql`${wallets.cashBalance} + ${String(input.amount)}`,
          totalDeposited: sql`${wallets.totalDeposited} + ${String(input.amount)}`,
          updatedAt: new Date(),
        })
        .where(eq(wallets.userId, ctx.user.id));

      return { transactionId: txn!.id, status: "completed" };
    }),

  /**
   * Withdraw funds
   */
  withdraw: protectedProcedure
    .input(
      z.object({
        amount: z.number().min(10).max(100000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const wallet = await ctx.db.query.wallets.findFirst({
        where: eq(wallets.userId, ctx.user.id),
      });

      if (!wallet || Number(wallet.cashBalance) < input.amount) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Insufficient balance",
        });
      }

      // Debit wallet
      await ctx.db
        .update(wallets)
        .set({
          cashBalance: sql`${wallets.cashBalance} - ${String(input.amount)}`,
          totalWithdrawn: sql`${wallets.totalWithdrawn} + ${String(input.amount)}`,
          updatedAt: new Date(),
        })
        .where(eq(wallets.userId, ctx.user.id));

      const [txn] = await ctx.db
        .insert(transactions)
        .values({
          userId: ctx.user.id,
          type: "withdrawal",
          amount: String(input.amount),
          status: "completed",
          metadata: { environment: "development" },
        })
        .returning();

      return { transactionId: txn!.id, status: "completed" };
    }),

  /**
   * Get transaction history
   */
  getTransactions: protectedProcedure
    .input(
      z.object({
        type: z
          .enum(["deposit", "withdrawal", "entry_fee", "winnings", "bonus", "refund", "tds"])
          .optional(),
        limit: z.number().int().min(1).max(100).default(20),
        cursor: z.string().uuid().optional(),
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
        amount: Number(t.amount),
      }));
    }),
});
