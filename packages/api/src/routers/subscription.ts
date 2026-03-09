import { z } from "zod";
import { router, publicProcedure, protectedProcedure, adminProcedure } from "../trpc";
import {
  getTierConfigs,
  updateTierConfigs,
  getUserTier,
  getUserSubscription,
  subscribeTier,
  cancelSubscription,
  getSubscriptionHistory,
  validatePromoCode,
} from "../services/subscription";
import { type SubscriptionTier, type TierConfig } from "@draftplay/shared";
import { promoCodes, promoRedemptions, subscriptions, subscriptionEvents } from "@draftplay/db";
import { eq, desc, and, sql } from "drizzle-orm";

export const subscriptionRouter = router({
  // -------------------------------------------------------------------------
  // User-facing endpoints
  // -------------------------------------------------------------------------

  /**
   * Get all tier configs (for subscription screen display).
   * Returns admin-overridden configs merged with defaults.
   */
  getTierConfigs: publicProcedure.query(async () => {
    const configs = await getTierConfigs();
    return Object.values(configs);
  }),

  /**
   * Get current user's subscription status.
   */
  getMyTier: protectedProcedure.query(async ({ ctx }) => {
    const sub = await getUserSubscription(ctx.db, ctx.user.id);
    const configs = await getTierConfigs();
    const tierConfig = configs[sub.tier];
    return { ...sub, tierConfig };
  }),

  /**
   * Subscribe to a paid tier (Pro or Elite).
   * In stub mode (no Razorpay), directly activates.
   */
  subscribe: protectedProcedure
    .input(
      z.object({
        tier: z.enum(["pro", "elite"]),
        promoCode: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return subscribeTier(ctx.db, ctx.user.id, input.tier, input.promoCode, ctx.user.email);
    }),

  /**
   * Cancel subscription. Stays active until period end.
   */
  cancel: protectedProcedure.mutation(async ({ ctx }) => {
    await cancelSubscription(ctx.db, ctx.user.id);
    return { success: true };
  }),

  /**
   * Validate a promo code before applying.
   */
  validatePromo: protectedProcedure
    .input(z.object({ code: z.string(), tier: z.enum(["pro", "elite"]) }))
    .query(async ({ ctx, input }) => {
      const result = await validatePromoCode(ctx.db, input.code, ctx.user.id, input.tier);
      if (!result) return { valid: false as const, message: "Invalid or expired promo code" };

      const configs = await getTierConfigs();
      const tierConfig = configs[input.tier];
      let discountDisplay = "";
      if (result.discountType === "percentage") {
        discountDisplay = `${result.discountValue}% off`;
      } else if (result.discountType === "fixed_amount") {
        discountDisplay = `₹${(result.discountValue / 100).toFixed(0)} off`;
      } else {
        discountDisplay = `${result.durationMonths} month(s) free`;
      }

      return {
        valid: true as const,
        discountDisplay,
        discountType: result.discountType,
        discountValue: result.discountValue,
        durationMonths: result.durationMonths,
      };
    }),

  /**
   * Get subscription event history.
   */
  getHistory: protectedProcedure.query(async ({ ctx }) => {
    return getSubscriptionHistory(ctx.db, ctx.user.id);
  }),

  // -------------------------------------------------------------------------
  // Admin endpoints — tier config, promo codes, user management
  // -------------------------------------------------------------------------

  admin: router({
    /**
     * Get all tier configs (with admin override details).
     */
    getTierConfigs: adminProcedure.query(async () => {
      return getTierConfigs();
    }),

    /**
     * Update tier configs (pricing, features, display text).
     * Merges provided overrides with defaults.
     */
    updateTierConfigs: adminProcedure
      .input(
        z.object({
          tiers: z.record(
            z.enum(["free", "pro", "elite"]),
            z.object({
              priceMonthly: z.number().optional(),
              priceInPaise: z.number().optional(),
              displayFeatures: z.array(z.string()).optional(),
              features: z
                .object({
                  teamsPerMatch: z.number().nullable().optional(),
                  guruQuestionsPerDay: z.number().nullable().optional(),
                  fdrLevel: z.enum(["basic", "full", "full_historical"]).optional(),
                  hasProjectedPoints: z.boolean().optional(),
                  hasConfidence: z.boolean().optional(),
                  hasRateMyTeam: z.boolean().optional(),
                  hasCaptainPicks: z.boolean().optional(),
                  hasDifferentials: z.boolean().optional(),
                  hasPlayingXI: z.boolean().optional(),
                  hasPitchWeather: z.boolean().optional(),
                  hasHeadToHead: z.boolean().optional(),
                  isAdFree: z.boolean().optional(),
                  guruPriority: z.boolean().optional(),
                  dailyCoinDrip: z.number().int().min(0).optional(),
                  hasPlayerStats: z.boolean().optional(),
                  hasPlayerCompare: z.boolean().optional(),
                  hasTeamSolver: z.boolean().optional(),
                  hasPointsBreakdown: z.boolean().optional(),
                  hasValueTracker: z.boolean().optional(),
                  hasStatTopFives: z.boolean().optional(),
                })
                .optional(),
            })
          ),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await updateTierConfigs(input.tiers as Record<string, Partial<TierConfig>>, ctx.user.id);
        return { success: true };
      }),

    // -----------------------------------------------------------------------
    // Promo code management
    // -----------------------------------------------------------------------

    /**
     * List all promo codes.
     */
    listPromoCodes: adminProcedure.query(async ({ ctx }) => {
      return ctx.db.query.promoCodes.findMany({
        orderBy: (codes, { desc }) => [desc(codes.createdAt)],
      });
    }),

    /**
     * Create a new promo code.
     */
    createPromoCode: adminProcedure
      .input(
        z.object({
          code: z.string().min(3).max(30).transform((s) => s.toUpperCase()),
          description: z.string().optional(),
          discountType: z.enum(["percentage", "fixed_amount", "free_trial"]),
          discountValue: z.number().int().min(1),
          applicableTiers: z.array(z.enum(["pro", "elite"])).min(1),
          maxRedemptions: z.number().int().min(1).nullable().optional(),
          maxPerUser: z.number().int().min(1).default(1),
          validFrom: z.date().optional(),
          validUntil: z.date().nullable().optional(),
          durationMonths: z.number().int().min(1).default(1),
          influencerName: z.string().optional(),
          influencerCommission: z.number().int().optional(), // paise per redemption
        })
      )
      .mutation(async ({ ctx, input }) => {
        const result = await ctx.db
          .insert(promoCodes)
          .values({
            code: input.code,
            description: input.description,
            discountType: input.discountType,
            discountValue: input.discountValue,
            applicableTiers: input.applicableTiers,
            maxRedemptions: input.maxRedemptions ?? null,
            maxPerUser: input.maxPerUser,
            validFrom: input.validFrom ?? new Date(),
            validUntil: input.validUntil ?? null,
            durationMonths: input.durationMonths,
            influencerName: input.influencerName,
            influencerCommission: input.influencerCommission,
            createdBy: ctx.user.id,
          })
          .returning();
        return result[0];
      }),

    /**
     * Toggle a promo code active/inactive.
     */
    togglePromoCode: adminProcedure
      .input(z.object({ id: z.string().uuid(), isActive: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        await ctx.db
          .update(promoCodes)
          .set({ isActive: input.isActive, updatedAt: new Date() })
          .where(eq(promoCodes.id, input.id));
        return { success: true };
      }),

    /**
     * Get promo code redemption stats.
     */
    getPromoRedemptions: adminProcedure
      .input(z.object({ promoCodeId: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        return ctx.db.query.promoRedemptions.findMany({
          where: eq(promoRedemptions.promoCodeId, input.promoCodeId),
          with: { user: true },
          orderBy: (r, { desc }) => [desc(r.createdAt)],
        });
      }),

    // -----------------------------------------------------------------------
    // User subscription management
    // -----------------------------------------------------------------------

    /**
     * List all subscriptions (for admin dashboard).
     */
    listSubscriptions: adminProcedure
      .input(
        z.object({
          status: z.enum(["active", "cancelled", "expired", "past_due"]).optional(),
          tier: z.enum(["free", "pro", "elite"]).optional(),
          limit: z.number().int().min(1).max(100).default(50),
        })
      )
      .query(async ({ ctx, input }) => {
        const conditions = [];
        if (input.status) conditions.push(eq(subscriptions.status, input.status));
        if (input.tier) conditions.push(eq(subscriptions.tier, input.tier));

        return ctx.db.query.subscriptions.findMany({
          where: conditions.length > 0 ? and(...conditions) : undefined,
          with: { user: true },
          orderBy: (s, { desc }) => [desc(s.createdAt)],
          limit: input.limit,
        });
      }),

    /**
     * Override a user's subscription tier (for support/testing).
     */
    overrideUserTier: adminProcedure
      .input(
        z.object({
          userId: z.string().uuid(),
          tier: z.enum(["free", "pro", "elite"]),
          reason: z.string().min(1),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { invalidateUserTierCache } = await import("../services/subscription");

        const existing = await ctx.db.query.subscriptions.findFirst({
          where: eq(subscriptions.userId, input.userId),
        });

        const now = new Date();
        const periodEnd = new Date(now);
        periodEnd.setFullYear(periodEnd.getFullYear() + 10); // admin override = effectively permanent

        if (existing) {
          await ctx.db
            .update(subscriptions)
            .set({
              tier: input.tier,
              status: "active",
              currentPeriodStart: now,
              currentPeriodEnd: input.tier === "free" ? null : periodEnd,
              cancelAtPeriodEnd: false,
              updatedAt: now,
            })
            .where(eq(subscriptions.id, existing.id));

          await ctx.db.insert(subscriptionEvents).values({
            userId: input.userId,
            subscriptionId: existing.id,
            event: "admin_override",
            fromTier: existing.tier,
            toTier: input.tier,
            metadata: { reason: input.reason, adminId: ctx.user.id },
          });
        } else if (input.tier !== "free") {
          const result = await ctx.db
            .insert(subscriptions)
            .values({
              userId: input.userId,
              tier: input.tier,
              status: "active",
              currentPeriodStart: now,
              currentPeriodEnd: periodEnd,
              priceInPaise: "0",
            })
            .returning({ id: subscriptions.id });

          await ctx.db.insert(subscriptionEvents).values({
            userId: input.userId,
            subscriptionId: result[0]!.id,
            event: "admin_override",
            fromTier: "free",
            toTier: input.tier,
            metadata: { reason: input.reason, adminId: ctx.user.id },
          });
        }

        await invalidateUserTierCache(input.userId);
        return { success: true };
      }),

    /**
     * Get payment settings (mode + Razorpay config status).
     */
    getPaymentSettings: adminProcedure.query(async () => {
      const { getPaymentMode, isRazorpayConfigured } = await import("../services/razorpay");
      return {
        mode: await getPaymentMode(),
        razorpayConfigured: isRazorpayConfigured(),
        hasKeyId: !!process.env.RAZORPAY_KEY_ID,
        hasKeySecret: !!process.env.RAZORPAY_KEY_SECRET,
        hasWebhookSecret: !!process.env.RAZORPAY_WEBHOOK_SECRET,
        hasPlanPro: !!process.env.RAZORPAY_PLAN_PRO,
        hasPlanElite: !!process.env.RAZORPAY_PLAN_ELITE,
      };
    }),

    /**
     * Toggle payment mode between stub and live.
     */
    setPaymentMode: adminProcedure
      .input(z.object({ mode: z.enum(["stub", "live"]) }))
      .mutation(async ({ ctx, input }) => {
        const { setPaymentMode } = await import("../services/razorpay");
        await setPaymentMode(input.mode, ctx.user.id);
        return { success: true, mode: input.mode };
      }),

    /**
     * Get subscription metrics (for admin dashboard).
     */
    getMetrics: adminProcedure.query(async ({ ctx }) => {
      const allSubs = await ctx.db
        .select({
          tier: subscriptions.tier,
          status: subscriptions.status,
          count: sql<number>`count(*)::int`,
        })
        .from(subscriptions)
        .groupBy(subscriptions.tier, subscriptions.status);

      const totalPromo = await ctx.db
        .select({ total: sql<number>`count(*)::int` })
        .from(promoRedemptions);

      return {
        subscriptionsByTierAndStatus: allSubs,
        totalPromoRedemptions: totalPromo[0]?.total ?? 0,
      };
    }),

    /**
     * Comprehensive business analytics — conversion, churn, revenue, promo ROI.
     * All derived from subscriptionEvents audit log + current subscriptions.
     */
    getAnalytics: adminProcedure
      .input(
        z.object({
          months: z.number().int().min(1).max(24).default(6),
        }).optional().default({ months: 6 })
      )
      .query(async ({ ctx, input }) => {
        const { users } = await import("@draftplay/db");
        const monthsAgoDate = new Date();
        monthsAgoDate.setMonth(monthsAgoDate.getMonth() - input.months);
        const monthsAgo = monthsAgoDate.toISOString();

        // ── 1. Overview snapshot ──
        const totalUsers = await ctx.db
          .select({ count: sql<number>`count(*)::int` })
          .from(users);

        const activePaid = await ctx.db
          .select({
            tier: subscriptions.tier,
            count: sql<number>`count(*)::int`,
            revenue: sql<number>`coalesce(sum(price_in_paise::int), 0)::int`,
          })
          .from(subscriptions)
          .where(and(
            eq(subscriptions.status, "active"),
            sql`${subscriptions.tier} != 'free'`,
          ))
          .groupBy(subscriptions.tier);

        const totalActiveUsers = totalUsers[0]?.count ?? 0;
        const proCount = activePaid.find(r => r.tier === "pro")?.count ?? 0;
        const eliteCount = activePaid.find(r => r.tier === "elite")?.count ?? 0;
        const totalPaidUsers = proCount + eliteCount;
        const freeUsers = totalActiveUsers - totalPaidUsers;

        // MRR = sum of all active paid subscriptions' monthly price
        const mrrResult = await ctx.db
          .select({ mrr: sql<number>`coalesce(sum(price_in_paise::int), 0)::int` })
          .from(subscriptions)
          .where(and(
            eq(subscriptions.status, "active"),
            sql`${subscriptions.tier} != 'free'`,
          ));
        const mrrPaise = mrrResult[0]?.mrr ?? 0;

        // ── 2. Conversion rates ──
        // How many users ever upgraded from free to a paid tier
        const conversions = await ctx.db
          .select({
            toTier: subscriptionEvents.toTier,
            count: sql<number>`count(distinct ${subscriptionEvents.userId})::int`,
          })
          .from(subscriptionEvents)
          .where(and(
            sql`${subscriptionEvents.event} IN ('created', 'upgraded')`,
            eq(subscriptionEvents.fromTier, "free"),
            sql`${subscriptionEvents.toTier} IN ('pro', 'elite')`,
          ))
          .groupBy(subscriptionEvents.toTier);

        const freeToPro = conversions.find(r => r.toTier === "pro")?.count ?? 0;
        const freeToElite = conversions.find(r => r.toTier === "elite")?.count ?? 0;

        const proToElite = await ctx.db
          .select({ count: sql<number>`count(distinct ${subscriptionEvents.userId})::int` })
          .from(subscriptionEvents)
          .where(and(
            sql`${subscriptionEvents.event} IN ('upgraded')`,
            eq(subscriptionEvents.fromTier, "pro"),
            eq(subscriptionEvents.toTier, "elite"),
          ));

        // ── 3. Churn metrics ──
        const churnByMonth = await ctx.db
          .select({
            month: sql<string>`to_char(${subscriptionEvents.createdAt}, 'YYYY-MM')`,
            fromTier: subscriptionEvents.fromTier,
            count: sql<number>`count(*)::int`,
          })
          .from(subscriptionEvents)
          .where(and(
            eq(subscriptionEvents.event, "cancelled"),
            sql`${subscriptionEvents.createdAt} >= ${monthsAgo}`,
          ))
          .groupBy(sql`to_char(${subscriptionEvents.createdAt}, 'YYYY-MM')`, subscriptionEvents.fromTier)
          .orderBy(sql`to_char(${subscriptionEvents.createdAt}, 'YYYY-MM')`);

        // Total cancellations (all time)
        const totalChurned = await ctx.db
          .select({ count: sql<number>`count(*)::int` })
          .from(subscriptionEvents)
          .where(eq(subscriptionEvents.event, "cancelled"));

        // Avg days before cancellation
        const avgDaysToChurn = await ctx.db.execute<{ avgDays: number }>(sql`
          SELECT coalesce(avg(
            extract(epoch from (se.created_at - s.current_period_start)) / 86400
          )::int, 0) AS "avgDays"
          FROM subscription_events se
          JOIN subscriptions s ON se.subscription_id = s.id
          WHERE se.event = 'cancelled'
        `);

        // ── 4. Monthly trends (new subs, upgrades, cancellations, revenue) ──
        const monthlyTrends = await ctx.db
          .select({
            month: sql<string>`to_char(${subscriptionEvents.createdAt}, 'YYYY-MM')`,
            event: subscriptionEvents.event,
            count: sql<number>`count(*)::int`,
          })
          .from(subscriptionEvents)
          .where(sql`${subscriptionEvents.createdAt} >= ${monthsAgo}`)
          .groupBy(sql`to_char(${subscriptionEvents.createdAt}, 'YYYY-MM')`, subscriptionEvents.event)
          .orderBy(sql`to_char(${subscriptionEvents.createdAt}, 'YYYY-MM')`);

        // ── 5. Promo code ROI ──
        const promoPerformance = await ctx.db
          .select({
            id: promoCodes.id,
            code: promoCodes.code,
            influencerName: promoCodes.influencerName,
            discountType: promoCodes.discountType,
            discountValue: promoCodes.discountValue,
            commissionPerRedemption: promoCodes.influencerCommission,
            totalRedemptions: promoCodes.currentRedemptions,
            maxRedemptions: promoCodes.maxRedemptions,
            isActive: promoCodes.isActive,
            totalDiscountGiven: sql<number>`coalesce(sum(${promoRedemptions.discountAppliedPaise}), 0)::int`,
            uniqueUsers: sql<number>`count(distinct ${promoRedemptions.userId})::int`,
          })
          .from(promoCodes)
          .leftJoin(promoRedemptions, eq(promoRedemptions.promoCodeId, promoCodes.id))
          .groupBy(
            promoCodes.id, promoCodes.code, promoCodes.influencerName,
            promoCodes.discountType, promoCodes.discountValue,
            promoCodes.influencerCommission, promoCodes.currentRedemptions,
            promoCodes.maxRedemptions, promoCodes.isActive,
          )
          .orderBy(desc(promoCodes.currentRedemptions));

        // How many promo-acquired users are still active
        const promoRetention = await ctx.db
          .select({
            promoCodeId: promoRedemptions.promoCodeId,
            stillActive: sql<number>`count(case when ${subscriptions.status} = 'active' and ${subscriptions.tier} != 'free' then 1 end)::int`,
            total: sql<number>`count(*)::int`,
          })
          .from(promoRedemptions)
          .leftJoin(subscriptions, eq(subscriptions.userId, promoRedemptions.userId))
          .groupBy(promoRedemptions.promoCodeId);

        const promoRetentionMap = new Map(promoRetention.map(r => [r.promoCodeId, r]));

        // ── 6. Payment failure tracking ──
        const paymentFailures = await ctx.db
          .select({
            month: sql<string>`to_char(${subscriptionEvents.createdAt}, 'YYYY-MM')`,
            count: sql<number>`count(*)::int`,
          })
          .from(subscriptionEvents)
          .where(and(
            eq(subscriptionEvents.event, "payment_failed"),
            sql`${subscriptionEvents.createdAt} >= ${monthsAgo}`,
          ))
          .groupBy(sql`to_char(${subscriptionEvents.createdAt}, 'YYYY-MM')`)
          .orderBy(sql`to_char(${subscriptionEvents.createdAt}, 'YYYY-MM')`);

        // ── 7. At-risk users (cancelled or past_due) ──
        const atRisk = await ctx.db
          .select({
            status: subscriptions.status,
            count: sql<number>`count(*)::int`,
          })
          .from(subscriptions)
          .where(sql`${subscriptions.status} IN ('cancelled', 'past_due', 'expired')`)
          .groupBy(subscriptions.status);

        // ── Assemble response ──
        return {
          overview: {
            totalUsers: totalActiveUsers,
            freeUsers,
            proUsers: proCount,
            eliteUsers: eliteCount,
            conversionRate: totalActiveUsers > 0
              ? Number(((totalPaidUsers / totalActiveUsers) * 100).toFixed(1))
              : 0,
            mrrPaise,
            mrrDisplay: `₹${(mrrPaise / 100).toFixed(0)}`,
            arpu: totalPaidUsers > 0
              ? Number(((mrrPaise / totalPaidUsers) / 100).toFixed(0))
              : 0,
          },
          conversion: {
            freeToPro,
            freeToElite,
            proToElite: proToElite[0]?.count ?? 0,
            freeToProRate: totalActiveUsers > 0
              ? Number(((freeToPro / totalActiveUsers) * 100).toFixed(1))
              : 0,
          },
          churn: {
            totalChurned: totalChurned[0]?.count ?? 0,
            avgDaysBeforeChurn: avgDaysToChurn[0]?.avgDays ?? 0,
            byMonth: churnByMonth.map(r => ({
              month: r.month,
              tier: r.fromTier,
              count: r.count,
            })),
          },
          monthlyTrends: monthlyTrends.map(r => ({
            month: r.month,
            event: r.event,
            count: r.count,
          })),
          promoROI: promoPerformance.map(p => {
            const retention = promoRetentionMap.get(p.id) ?? { stillActive: 0, total: 0 };
            const totalCommission = (p.commissionPerRedemption ?? 0) * (p.totalRedemptions ?? 0);
            return {
              code: p.code,
              influencer: p.influencerName,
              discountType: p.discountType,
              discountValue: p.discountValue,
              isActive: p.isActive,
              totalRedemptions: p.totalRedemptions ?? 0,
              maxRedemptions: p.maxRedemptions,
              uniqueUsers: p.uniqueUsers,
              totalDiscountGivenPaise: p.totalDiscountGiven,
              totalCommissionPaise: totalCommission,
              retainedUsers: retention.stillActive,
              retentionRate: retention.total > 0
                ? Number(((retention.stillActive / retention.total) * 100).toFixed(1))
                : 0,
            };
          }),
          paymentFailures,
          atRisk: {
            cancelled: atRisk.find(r => r.status === "cancelled")?.count ?? 0,
            pastDue: atRisk.find(r => r.status === "past_due")?.count ?? 0,
            expired: atRisk.find(r => r.status === "expired")?.count ?? 0,
          },
        };
      }),
  }),
});
