import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../trpc";
import { chatMessages, chatFlags } from "@draftplay/db";
import { eq, desc, and, isNull, gt, lt, sql } from "drizzle-orm";
import { getLogger } from "../lib/logger";
import { generateGuruMessages } from "../services/chat-guru";

const log = getLogger("chat");

/** Simple profanity filter — block obvious slurs. Expand as needed. */
const BLOCKED_WORDS = [
  "fuck", "shit", "bitch", "asshole", "nigger", "faggot", "cunt",
  "chutiya", "madarchod", "behenchod", "gaand", "lund", "randi",
];

function containsProfanity(text: string): boolean {
  const lower = text.toLowerCase();
  return BLOCKED_WORDS.some((w) => lower.includes(w));
}

/** In-memory rate limit: 1 message per 2 seconds per user */
const rateLimitMap = new Map<string, number>();
function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const last = rateLimitMap.get(userId) ?? 0;
  if (now - last < 2000) return true;
  rateLimitMap.set(userId, now);
  // Cleanup old entries periodically
  if (rateLimitMap.size > 5000) {
    for (const [k, v] of rateLimitMap) {
      if (now - v > 10000) rateLimitMap.delete(k);
    }
  }
  return false;
}

export const chatRouter = router({
  /** Get recent messages for a room (general or match-specific) */
  getMessages: publicProcedure
    .input(
      z.object({
        matchId: z.string().uuid().nullable().optional(),
        limit: z.number().min(1).max(100).default(50),
        after: z.string().datetime().optional(), // for polling — only get messages after this timestamp
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [];

      if (input.matchId) {
        conditions.push(eq(chatMessages.matchId, input.matchId));
      } else {
        conditions.push(isNull(chatMessages.matchId));
      }

      if (input.after) {
        conditions.push(gt(chatMessages.createdAt, new Date(input.after)));
      }

      const messages = await ctx.db
        .select({
          id: chatMessages.id,
          userId: chatMessages.userId,
          message: chatMessages.message,
          type: chatMessages.type,
          displayName: chatMessages.displayName,
          flagCount: chatMessages.flagCount,
          createdAt: chatMessages.createdAt,
        })
        .from(chatMessages)
        .where(and(...conditions))
        .orderBy(desc(chatMessages.createdAt))
        .limit(input.limit);

      // Return in chronological order, with flagged messages redacted
      return messages.reverse().map((m) => ({
        ...m,
        message: m.flagCount >= 3
          ? "🚩 this message was flagged as offensive by the community"
          : m.message,
        flagged: m.flagCount >= 3,
      }));
    }),

  /** Send a chat message */
  send: protectedProcedure
    .input(
      z.object({
        matchId: z.string().uuid().nullable().optional(),
        message: z.string().min(1).max(280),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Rate limit
      if (isRateLimited(ctx.user.id)) {
        log.warn({ userId: ctx.user.id }, "Chat rate limited");
        return { ok: false, error: "Slow down — wait a moment before sending" };
      }

      // Profanity filter
      if (containsProfanity(input.message)) {
        log.warn({ userId: ctx.user.id }, "Chat profanity blocked");
        return { ok: false, error: "Message contains inappropriate language" };
      }

      // Get display name
      const user = await ctx.db.query.users.findFirst({
        where: eq((await import("@draftplay/db")).users.id, ctx.user.id),
        columns: { displayName: true, username: true },
      });

      const rows = await ctx.db
        .insert(chatMessages)
        .values({
          userId: ctx.user.id,
          matchId: input.matchId ?? null,
          message: input.message.trim(),
          type: "user",
          displayName: user?.displayName ?? user?.username ?? "anon",
        })
        .returning({ id: chatMessages.id, createdAt: chatMessages.createdAt });

      const msg = rows[0];
      log.debug({ userId: ctx.user.id, matchId: input.matchId }, "Chat message sent");
      return { ok: true, id: msg?.id, createdAt: msg?.createdAt };
    }),

  /** Get active chat rooms — general + live matches */
  getActiveRooms: publicProcedure.query(async ({ ctx }) => {
    // General room is always active
    const rooms: { id: string | null; name: string; type: "general" | "match" }[] = [
      { id: null, name: "general", type: "general" },
    ];

    // Find live matches
    try {
      const liveMatches = await ctx.db.query.matches.findMany({
        where: eq((await import("@draftplay/db")).matches.status, "live"),
        columns: { id: true, teamHome: true, teamAway: true },
      });

      for (const m of liveMatches) {
        rooms.push({
          id: m.id,
          name: `${m.teamHome} vs ${m.teamAway}`,
          type: "match",
        });
      }
    } catch {
      // If matches table doesn't have these columns, just return general
    }

    return rooms;
  }),

  /** Trigger AI Guru to generate messages for a room */
  triggerGuru: publicProcedure
    .input(z.object({ matchId: z.string().uuid().nullable().optional() }))
    .mutation(async ({ input }) => {
      await generateGuruMessages(input.matchId ?? null);
      return { ok: true };
    }),

  /** Flag a message — 3 flags hides it */
  flag: protectedProcedure
    .input(z.object({ messageId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Insert flag (unique constraint prevents double-flagging)
        await ctx.db.insert(chatFlags).values({
          messageId: input.messageId,
          userId: ctx.user.id,
        });

        // Increment flag count on the message
        await ctx.db
          .update(chatMessages)
          .set({ flagCount: sql`${chatMessages.flagCount} + 1` })
          .where(eq(chatMessages.id, input.messageId));

        log.debug({ messageId: input.messageId, userId: ctx.user.id }, "Message flagged");
        return { ok: true };
      } catch (error: any) {
        // Unique constraint violation = already flagged
        if (error?.code === "23505") {
          return { ok: false, error: "You already flagged this message" };
        }
        throw error;
      }
    }),

  /** Purge messages older than 24 hours */
  purgeOld: publicProcedure.mutation(async ({ ctx }) => {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await ctx.db
      .delete(chatMessages)
      .where(lt(chatMessages.createdAt, cutoff));
    log.info("Purged old chat messages");
    return { ok: true };
  }),
});
