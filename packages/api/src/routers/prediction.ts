import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { createPredictionSchema } from "@draftplay/shared";
import { eq, and } from "drizzle-orm";
import { predictions, fantasyTeams, contests, matches } from "@draftplay/db";
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
import {
  createLivePrediction,
  closeLivePrediction,
  abandonLivePrediction,
  voteLivePrediction,
  resolveLivePrediction,
  listLivePredictions,
  suggestPredictions,
  getUserPredictionTitle,
  addPredictionComment,
  getPredictionComments,
} from "../services/live-predictions";
import { DEFAULT_TIER_CONFIGS, type SubscriptionTier } from "@draftplay/shared";

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

  // ─── LIVE MINI-PREDICTIONS ──────────────────────────────────────

  /**
   * Create a live prediction in a contest during a live match.
   */
  liveCreate: protectedProcedure
    .input(z.object({
      contestId: z.string().uuid(),
      matchId: z.string().uuid(),
      question: z.string().min(5).max(200),
      optionA: z.string().min(1).max(50),
      optionB: z.string().min(1).max(50),
      deadlineType: z.enum(["end_of_over", "end_of_innings", "end_of_match"]).default("end_of_over"),
      matchContext: z.object({
        teamA: z.string().optional(),
        teamB: z.string().optional(),
        format: z.string().optional(),
        score: z.string().optional(),
      }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify user has a team in this contest
      const team = await ctx.db.query.fantasyTeams.findFirst({
        where: and(
          eq(fantasyTeams.userId, ctx.user.id),
          eq(fantasyTeams.contestId, input.contestId),
        ),
        columns: { id: true },
      });
      if (!team) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You must have a team in this contest to create predictions" });
      }

      try {
        return await createLivePrediction(
          ctx.db,
          input.contestId,
          input.matchId,
          ctx.user.id,
          input.question,
          input.optionA,
          input.optionB,
          input.deadlineType,
          input.matchContext,
        );
      } catch (err: any) {
        throw new TRPCError({ code: "BAD_REQUEST", message: err.message });
      }
    }),

  /**
   * Close a live prediction — only the creator can do this.
   * Stops new votes; creator must then resolve with the correct answer.
   */
  liveClose: protectedProcedure
    .input(z.object({
      predictionId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        await closeLivePrediction(ctx.db, input.predictionId, ctx.user.id);
        return { success: true };
      } catch (err: any) {
        const code = err.message.includes("not found") ? "NOT_FOUND" as const
          : err.message.includes("Only the creator") ? "FORBIDDEN" as const
          : "BAD_REQUEST" as const;
        throw new TRPCError({ code, message: err.message });
      }
    }),

  /**
   * Abandon a live prediction — creator gives up when not enough votes.
   */
  liveAbandon: protectedProcedure
    .input(z.object({
      predictionId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        await abandonLivePrediction(ctx.db, input.predictionId, ctx.user.id);
        return { success: true };
      } catch (err: any) {
        const code = err.message.includes("not found") ? "NOT_FOUND" as const
          : err.message.includes("Only the creator") ? "FORBIDDEN" as const
          : "BAD_REQUEST" as const;
        throw new TRPCError({ code, message: err.message });
      }
    }),

  /**
   * Vote on a live prediction.
   */
  liveVote: protectedProcedure
    .input(z.object({
      predictionId: z.string().uuid(),
      pickedOption: z.enum(["a", "b"]),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await voteLivePrediction(ctx.db, input.predictionId, ctx.user.id, input.pickedOption);
      } catch (err: any) {
        const code = err.message.includes("not found") ? "NOT_FOUND" as const
          : err.message.includes("not open") ? "BAD_REQUEST" as const
          : "BAD_REQUEST" as const;
        throw new TRPCError({ code, message: err.message });
      }
    }),

  /**
   * Resolve a live prediction — any contest member can declare the result.
   */
  liveResolve: protectedProcedure
    .input(z.object({
      predictionId: z.string().uuid(),
      winningOption: z.enum(["a", "b"]),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await resolveLivePrediction(
          ctx.db,
          input.predictionId,
          input.winningOption,
          `user:${ctx.user.id}`,
        );
      } catch (err: any) {
        throw new TRPCError({ code: "BAD_REQUEST", message: err.message });
      }
    }),

  /**
   * List live predictions for a contest + match.
   */
  liveList: protectedProcedure
    .input(z.object({
      contestId: z.string().uuid(),
      matchId: z.string().uuid(),
    }))
    .query(async ({ ctx, input }) => {
      const preds = await listLivePredictions(ctx.db, input.contestId, input.matchId, ctx.user.id);

      // Also get the user's prediction title for this match
      const title = await getUserPredictionTitle(ctx.db, ctx.user.id, input.matchId);

      // Get prediction deadline for countdown timer
      const match = await ctx.db.query.matches.findFirst({
        where: eq(matches.id, input.matchId),
        columns: { predictionDeadline: true },
      });

      return {
        predictions: preds,
        myTitle: title,
        myUserId: ctx.user.id,
        predictionDeadline: match?.predictionDeadline?.toISOString() ?? null,
      };
    }),

  /**
   * Generate 3 AI-suggested predictions per click.
   * Tier-gated: basic=2, pro=5, elite=10 generation attempts per match.
   * Each attempt produces 3 questions.
   */
  liveSuggest: protectedProcedure
    .input(z.object({
      matchId: z.string().uuid(),
      teamA: z.string(),
      teamB: z.string(),
      format: z.string().default("T20"),
      score: z.string().optional(),
      overs: z.string().optional(),
      recentEvents: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const tier: SubscriptionTier = (ctx.tier as SubscriptionTier) ?? "basic";
      const limit = DEFAULT_TIER_CONFIGS[tier].features.predictionSuggestionsPerMatch;

      // Track usage in Redis (expires after 24h — longer than any match)
      const { getFromHotCache, setHotCache } = await import("../services/sports-cache");
      const usageKey = `prediction-suggest:${ctx.user.id}:${input.matchId}`;
      const currentUsage = (await getFromHotCache<number>(usageKey)) ?? 0;

      if (currentUsage >= limit) {
        const nextTier = tier === "basic" ? "Pro" : tier === "pro" ? "Elite" : null;
        throw new TRPCError({
          code: "FORBIDDEN",
          message: JSON.stringify({
            type: "PAYWALL",
            feature: "predictionSuggestionsPerMatch",
            currentTier: tier,
            used: currentUsage,
            limit,
            description: nextTier
              ? `You've used all ${limit} AI generation attempts. Upgrade to ${nextTier} for more.`
              : `You've used all ${limit} AI generation attempts for this match.`,
          }),
        });
      }

      const suggestions = await suggestPredictions({
        teamA: input.teamA,
        teamB: input.teamB,
        format: input.format,
        score: input.score,
        overs: input.overs,
        recentEvents: input.recentEvents,
      });

      // Increment usage counter
      const newUsage = currentUsage + 1;
      await setHotCache(usageKey, newUsage, 86400); // 24h TTL

      return {
        suggestions: suggestions.slice(0, 3),
        used: newUsage,
        limit,
        tier,
      };
    }),

  /**
   * Get current AI suggestion usage for a match (how many attempts used/remaining).
   */
  liveSuggestUsage: protectedProcedure
    .input(z.object({ matchId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const tier: SubscriptionTier = (ctx.tier as SubscriptionTier) ?? "basic";
      const limit = DEFAULT_TIER_CONFIGS[tier].features.predictionSuggestionsPerMatch;
      const { getFromHotCache } = await import("../services/sports-cache");
      const used = (await getFromHotCache<number>(`prediction-suggest:${ctx.user.id}:${input.matchId}`)) ?? 0;
      return { used, limit, tier };
    }),

  /**
   * Add a comment to a prediction thread.
   */
  addComment: protectedProcedure
    .input(z.object({
      predictionId: z.string().uuid(),
      message: z.string().min(1).max(200),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await addPredictionComment(ctx.db, input.predictionId, ctx.user.id, input.message);
      } catch (err: any) {
        const code = err.message.includes("not found") ? "NOT_FOUND" as const
          : err.message.includes("must be") ? "FORBIDDEN" as const
          : "BAD_REQUEST" as const;
        throw new TRPCError({ code, message: err.message });
      }
    }),

  /**
   * Get comments for a prediction.
   */
  getComments: protectedProcedure
    .input(z.object({ predictionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return await getPredictionComments(ctx.db, input.predictionId);
    }),
});
