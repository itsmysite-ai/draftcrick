import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { createPredictionSchema } from "@draftcrick/shared";
import { eq, and } from "drizzle-orm";
import { predictions } from "@draftcrick/db";

export const predictionRouter = router({
  /**
   * Create a prediction for a match
   */
  create: protectedProcedure
    .input(createPredictionSchema)
    .mutation(async ({ ctx, input }) => {
      const [prediction] = await ctx.db
        .insert(predictions)
        .values({
          userId: ctx.user.id,
          matchId: input.matchId,
          predictionType: input.predictionType,
          predictionValue: input.predictionValue,
        })
        .onConflictDoUpdate({
          target: [
            predictions.userId,
            predictions.matchId,
            predictions.predictionType,
          ],
          set: {
            predictionValue: input.predictionValue,
          },
        })
        .returning();
      return prediction;
    }),

  /**
   * Get user's predictions for a match
   */
  getByMatch: protectedProcedure
    .input(z.object({ matchId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db.query.predictions.findMany({
        where: and(
          eq(predictions.userId, ctx.user.id),
          eq(predictions.matchId, input.matchId)
        ),
      });
      return result;
    }),
});
