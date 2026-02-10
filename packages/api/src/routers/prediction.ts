import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { createPredictionSchema } from "@draftcrick/shared";
import { eq, and } from "drizzle-orm";
import { predictions } from "@draftcrick/db";

const NOT_IMPLEMENTED = () => {
  throw new TRPCError({
    code: "METHOD_NOT_SUPPORTED",
    message: "NOT_IMPLEMENTED — wired in Phase 5",
  });
};

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

  // --- Phase 5 stubs: Question/Answer system ---

  getQuestions: protectedProcedure
    .input(
      z.object({
        matchId: z.string(),
        tournamentId: z.string().optional(),
      })
    )
    .query(async () => NOT_IMPLEMENTED()),

  submitAnswer: protectedProcedure
    .input(
      z.object({
        questionId: z.string().uuid(),
        leagueId: z.string().uuid(),
        answer: z.string(),
      })
    )
    .mutation(async () => NOT_IMPLEMENTED()),

  getStandings: protectedProcedure
    .input(
      z.object({
        leagueId: z.string().uuid(),
        tournamentId: z.string(),
      })
    )
    .query(async () => NOT_IMPLEMENTED()),

  createQuestion: protectedProcedure
    .input(
      z.object({
        matchId: z.string(),
        tournamentId: z.string(),
        questionText: z.string(),
        questionType: z.string(),
        options: z.array(z.any()),
        difficulty: z.enum(["easy", "medium", "hard"]).optional(),
        pointsValue: z.number().int().optional(),
      })
    )
    .mutation(async () => NOT_IMPLEMENTED()),
});
