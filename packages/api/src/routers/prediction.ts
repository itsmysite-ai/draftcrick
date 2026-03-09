import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { createPredictionSchema } from "@draftplay/shared";
import { eq, and } from "drizzle-orm";
import { predictions } from "@draftplay/db";
import {
  generateMatchQuestions,
  getQuestionsByMatch,
  submitAnswer,
  getUserAnswers,
  gradeMatchQuestions,
  getStandings,
  getUserStreaks,
  createQuestion,
} from "../services/predictions";

export const predictionRouter = router({
  /**
   * Create a simple prediction for a match (legacy 5-type system)
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
   * Get user's simple predictions for a match
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

  // --- Question-based prediction system ---

  /**
   * Get prediction questions for a match
   */
  getQuestions: protectedProcedure
    .input(
      z.object({
        matchId: z.string(),
        deadlineType: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        return await getQuestionsByMatch(ctx.db, input.matchId, input.deadlineType);
      } catch (err: any) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: err.message });
      }
    }),

  /**
   * Submit an answer to a prediction question
   */
  submitAnswer: protectedProcedure
    .input(
      z.object({
        questionId: z.string().uuid(),
        leagueId: z.string().uuid(),
        answer: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await submitAnswer(
          ctx.db,
          ctx.user.id,
          input.questionId,
          input.leagueId,
          input.answer
        );
      } catch (err: any) {
        throw new TRPCError({
          code: err.message.includes("not found") ? "NOT_FOUND" : "BAD_REQUEST",
          message: err.message,
        });
      }
    }),

  /**
   * Get prediction standings for a league
   */
  getStandings: protectedProcedure
    .input(
      z.object({
        leagueId: z.string().uuid(),
        tournamentId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        return await getStandings(ctx.db, input.leagueId, input.tournamentId);
      } catch (err: any) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: err.message });
      }
    }),

  /**
   * Create a custom prediction question (admin)
   */
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
    .mutation(async ({ ctx, input }) => {
      try {
        return await createQuestion(
          ctx.db,
          input.matchId,
          input.tournamentId,
          input.questionText,
          input.questionType,
          input.options,
          input.difficulty,
          input.pointsValue
        );
      } catch (err: any) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: err.message });
      }
    }),

  // --- New procedures ---

  /**
   * Generate AI questions for a match
   */
  generateQuestions: protectedProcedure
    .input(
      z.object({
        matchId: z.string(),
        tournamentId: z.string(),
        teamA: z.string(),
        teamB: z.string(),
        format: z.string().default("T20"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await generateMatchQuestions(
          ctx.db,
          input.matchId,
          input.tournamentId,
          input.teamA,
          input.teamB,
          input.format
        );
      } catch (err: any) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: err.message });
      }
    }),

  /**
   * Grade all questions for a completed match
   */
  gradeMatch: protectedProcedure
    .input(
      z.object({
        matchId: z.string(),
        results: z.record(z.string(), z.string()), // questionId → correctAnswer
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await gradeMatchQuestions(ctx.db, input.matchId, input.results);
      } catch (err: any) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: err.message });
      }
    }),

  /**
   * Get user's answers for a match (with question data)
   */
  getUserAnswers: protectedProcedure
    .input(
      z.object({
        matchId: z.string(),
        leagueId: z.string().uuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        return await getUserAnswers(ctx.db, ctx.user.id, input.matchId, input.leagueId);
      } catch (err: any) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: err.message });
      }
    }),

  /**
   * Get user's streak stats
   */
  getStreaks: protectedProcedure
    .input(
      z.object({
        leagueId: z.string().uuid(),
        tournamentId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        return await getUserStreaks(ctx.db, ctx.user.id, input.leagueId, input.tournamentId);
      } catch (err: any) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: err.message });
      }
    }),
});
