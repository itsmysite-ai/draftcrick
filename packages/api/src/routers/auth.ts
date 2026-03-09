import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import {
  users,
  userProfiles,
  wallets,
  transactions,
  subscriptions,
  subscriptionEvents,
} from "@draftplay/db";
import { eq } from "drizzle-orm";
import { getFirebaseAuth } from "../services/auth";
import { getLogger } from "../lib/logger";

const logger = getLogger("auth");

export const authRouter = router({
  /**
   * Get current session user (from Firebase Auth token).
   */
  getSession: publicProcedure.query(({ ctx }) => {
    return ctx.user;
  }),

  /**
   * Sync Firebase Auth user to our PostgreSQL database.
   * Called after first sign-in to create the local user profile.
   */
  syncUser: protectedProcedure
    .input(
      z.object({
        username: z
          .string()
          .min(3)
          .max(20)
          .regex(/^[a-zA-Z0-9_]+$/),
        displayName: z.string().min(1).max(50),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // User record is auto-created by auth middleware in index.ts.
      // syncUser updates the username/displayName chosen during onboarding.
      await ctx.db
        .update(users)
        .set({
          username: input.username,
          displayName: input.displayName,
          updatedAt: new Date(),
        })
        .where(eq(users.id, ctx.user.id));

      return {
        success: true,
        userId: ctx.user.id,
        username: input.username,
      };
    }),

  /**
   * Get current user's profile
   */
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    const dbUser = await ctx.db.query.users.findFirst({
      where: eq(users.id, ctx.user.id),
      columns: { ageConfirmed: true },
    });
    return {
      userId: ctx.user.id,
      email: ctx.user.email,
      ageConfirmed: dbUser?.ageConfirmed ?? false,
    };
  }),

  /**
   * Update user preferences
   */
  updatePreferences: protectedProcedure
    .input(
      z.object({
        preferredLang: z.string().optional(),
        displayName: z.string().min(1).max(50).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Will update user preferences in DB
      return { success: true };
    }),

  /**
   * Record age confirmation + terms acceptance (called at registration).
   */
  acceptTerms: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.db
      .update(users)
      .set({
        ageConfirmed: true,
        termsAcceptedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, ctx.user.id));

    logger.info({ userId: ctx.user.id }, "Terms accepted");
    return { success: true };
  }),

  /**
   * Permanently delete user account and all associated data.
   * GDPR Article 17 — right to erasure.
   */
  deleteAccount: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.user.id;
    const firebaseUid = ctx.user.firebaseUid;

    logger.info({ userId }, "Account deletion requested");

    // Delete child rows in FK-safe order (no cascades defined)
    await ctx.db.delete(subscriptionEvents).where(eq(subscriptionEvents.userId, userId));
    await ctx.db.delete(subscriptions).where(eq(subscriptions.userId, userId));
    await ctx.db.delete(transactions).where(eq(transactions.userId, userId));
    await ctx.db.delete(wallets).where(eq(wallets.userId, userId));
    await ctx.db.delete(userProfiles).where(eq(userProfiles.userId, userId));
    await ctx.db.delete(users).where(eq(users.id, userId));

    // Delete Firebase Auth user (best-effort — DB is already clean)
    try {
      const auth = await getFirebaseAuth();
      await auth.deleteUser(firebaseUid);
      logger.info({ userId }, "Firebase user deleted");
    } catch (err: any) {
      logger.warn({ userId, err: err.message }, "Firebase user deletion failed — DB already cleaned");
    }

    return { success: true };
  }),
});
