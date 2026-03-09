import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import { users } from "@draftplay/db";
import { eq } from "drizzle-orm";

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
    return { userId: ctx.user.id, email: ctx.user.email };
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
});
