import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, gte } from "drizzle-orm";
import { guruConversations } from "@draftplay/db";
import { router, protectedProcedure } from "../trpc";
import { sendGuruMessage, getUserConversations, getConversation } from "../services/guru-chat";
import { getTierConfigs } from "../services/subscription";
import { getLogger } from "../lib/logger";

const log = getLogger("guru-router");

export const guruRouter = router({
  /**
   * Get today's guru usage for the current user (for client-side counter display).
   */
  getUsageToday: protectedProcedure.query(async ({ ctx }) => {
    const configs = await getTierConfigs();
    const tier = ctx.tier ?? "basic";
    const limit = configs[tier].features.guruQuestionsPerDay;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayConversations = await ctx.db.query.guruConversations.findMany({
      where: and(
        eq(guruConversations.userId, ctx.user.id),
        gte(guruConversations.createdAt, todayStart)
      ),
      columns: { id: true },
    });

    return {
      used: todayConversations.length,
      limit, // null = unlimited
      remaining: limit === null ? null : Math.max(0, limit - todayConversations.length),
    };
  }),

  /**
   * Start a new conversation or send a message to an existing one.
   */
  sendMessage: protectedProcedure
    .input(
      z.object({
        conversationId: z.string().uuid().nullable().default(null),
        message: z.string().min(1).max(2000),
        context: z
          .object({
            upcomingMatches: z
              .array(
                z.object({
                  id: z.string(),
                  teamA: z.string(),
                  teamB: z.string(),
                  date: z.string(),
                  format: z.string().optional(),
                  venue: z.string().optional(),
                  tournament: z.string().optional(),
                })
              )
              .optional(),
            userTeams: z
              .array(
                z.object({
                  leagueName: z.string(),
                  players: z.array(z.string()),
                })
              )
              .optional(),
            fdrData: z
              .array(
                z.object({
                  matchId: z.string(),
                  teamA: z.string(),
                  teamAFdr: z.number(),
                  teamB: z.string(),
                  teamBFdr: z.number(),
                })
              )
              .optional(),
            projections: z
              .array(
                z.object({
                  playerName: z.string(),
                  projected: z.number(),
                  captainRank: z.number(),
                })
              )
              .optional(),
          })
          .optional()
          .default({}),
        userCountry: z.string().length(2).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // --- Free-tier daily limit gate ---
      // Only enforce limit for new conversations (continuing existing ones is always allowed)
      if (!input.conversationId) {
        const configs = await getTierConfigs();
        const tier = ctx.tier ?? "basic";
        const dailyLimit = configs[tier].features.guruQuestionsPerDay;

        if (dailyLimit !== null) {
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);

          const todayConversations = await ctx.db.query.guruConversations.findMany({
            where: and(
              eq(guruConversations.userId, ctx.user.id),
              gte(guruConversations.createdAt, todayStart)
            ),
            columns: { id: true },
          });

          if (todayConversations.length >= dailyLimit) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: `You've used all ${dailyLimit} Guru questions for today. Upgrade to Pro for unlimited access.`,
            });
          }
        }
      }

      const result = await sendGuruMessage(
        ctx.db,
        ctx.user.id,
        input.conversationId,
        input.message,
        input.context,
        input.userCountry
      );
      return result;
    }),

  /**
   * Get user's conversation history.
   */
  getConversations: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(50).default(20),
        })
        .optional()
        .default({})
    )
    .query(async ({ ctx, input }) => {
      const conversations = await getUserConversations(
        ctx.db,
        ctx.user.id,
        input.limit
      );
      return conversations;
    }),

  /**
   * Get a single conversation by ID.
   */
  getConversation: protectedProcedure
    .input(z.object({ conversationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const conversation = await getConversation(ctx.db, input.conversationId);
      if (!conversation || conversation.userId !== ctx.user.id) {
        return null;
      }
      return conversation;
    }),
});
