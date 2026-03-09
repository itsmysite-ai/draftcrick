/**
 * Notification Router — L3
 *
 * Endpoints for device token management, notification inbox,
 * and user notification preferences.
 */

import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { eq, desc, and, lt, sql } from "drizzle-orm";
import { notifications } from "@draftplay/db";
import * as notifService from "../services/notifications";

export const notificationRouter = router({
  // ── Device Token Management ───────────────────────────────

  registerToken: protectedProcedure
    .input(
      z.object({
        token: z.string().min(1),
        platform: z.enum(["ios", "android", "web"]),
        deviceId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await notifService.registerDeviceToken(
        ctx.db,
        ctx.user.id,
        input.token,
        input.platform,
        input.deviceId
      );
      return { success: true };
    }),

  removeToken: protectedProcedure
    .input(z.object({ token: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await notifService.removeDeviceToken(ctx.db, ctx.user.id, input.token);
      return { success: true };
    }),

  // ── Notification Inbox ────────────────────────────────────

  getInbox: protectedProcedure
    .input(
      z.object({
        cursor: z.string().uuid().optional(),
        limit: z.number().min(1).max(50).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(notifications.userId, ctx.user.id)];
      if (input.cursor) {
        conditions.push(lt(notifications.id, input.cursor));
      }

      const items = await ctx.db.query.notifications.findMany({
        where: and(...conditions),
        orderBy: [desc(notifications.createdAt)],
        limit: input.limit + 1,
      });

      let nextCursor: string | null = null;
      if (items.length > input.limit) {
        const extra = items.pop()!;
        nextCursor = extra.id;
      }

      return { items, nextCursor };
    }),

  getUnreadCount: protectedProcedure.query(async ({ ctx }) => {
    const result = await ctx.db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, ctx.user.id),
          eq(notifications.isRead, false)
        )
      );
    return { count: result[0]?.count ?? 0 };
  }),

  markRead: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(notifications)
        .set({ isRead: true })
        .where(
          and(
            eq(notifications.id, input.id),
            eq(notifications.userId, ctx.user.id)
          )
        );
      return { success: true };
    }),

  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    const result = await ctx.db
      .update(notifications)
      .set({ isRead: true })
      .where(
        and(
          eq(notifications.userId, ctx.user.id),
          eq(notifications.isRead, false)
        )
      )
      .returning({ id: notifications.id });
    return { count: result.length };
  }),

  // ── Notification Preferences ──────────────────────────────

  getPreferences: protectedProcedure.query(async ({ ctx }) => {
    return notifService.getUserPreferences(ctx.db, ctx.user.id);
  }),

  updatePreferences: protectedProcedure
    .input(
      z.object({
        deadlines: z.boolean().optional(),
        scores: z.boolean().optional(),
        statusAlerts: z.boolean().optional(),
        rankChanges: z.boolean().optional(),
        promotions: z.boolean().optional(),
        quietHoursStart: z
          .string()
          .regex(/^\d{2}:\d{2}$/)
          .nullable()
          .optional(),
        quietHoursEnd: z
          .string()
          .regex(/^\d{2}:\d{2}$/)
          .nullable()
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await notifService.updateUserPreferences(ctx.db, ctx.user.id, input);
      return { success: true };
    }),
});
