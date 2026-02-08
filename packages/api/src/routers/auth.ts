import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import { registerSchema, loginSchema } from "@draftcrick/shared";

export const authRouter = router({
  /**
   * Get current session user
   */
  getSession: publicProcedure.query(({ ctx }) => {
    return ctx.user;
  }),

  /**
   * Register a new user
   */
  register: publicProcedure
    .input(registerSchema)
    .mutation(async ({ ctx, input }) => {
      // Auth registration is handled by Better Auth middleware.
      // This endpoint provides additional profile setup.
      // The actual user creation happens in the auth handler.
      return { success: true };
    }),

  /**
   * Get current user's profile
   */
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    // Will be implemented with DB queries
    return { userId: ctx.user.id };
  }),

  /**
   * Update user preferences
   */
  updatePreferences: protectedProcedure
    .input(
      z.object({
        comfortMode: z.boolean().optional(),
        preferredLang: z.string().optional(),
        displayName: z.string().min(1).max(50).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Will update user preferences in DB
      return { success: true };
    }),
});
