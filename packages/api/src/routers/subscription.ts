import { z } from "zod";
import { router, publicProcedure, protectedProcedure, adminProcedure } from "../trpc";
import {
  getTierConfigs,
  updateTierConfigs,
  getUserTierFull,
  getUserSubscription,
  subscribeTier,
  cancelSubscription,
  getSubscriptionHistory,
  validatePromoCode,
  purchaseDayPass,
  expireDayPasses,
} from "../services/subscription";
import { type SubscriptionTier, type TierConfig, DAY_PASS_CONFIG } from "@draftplay/shared";
import { promoCodes, promoRedemptions, subscriptions, subscriptionEvents, users } from "@draftplay/db";
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
    return { tiers: Object.values(configs), dayPass: DAY_PASS_CONFIG };
  }),

  /**
   * Get current user's subscription status (with Day Pass + trial info).
   */
  getMyTier: protectedProcedure.query(async ({ ctx }) => {
    const sub = await getUserSubscription(ctx.db, ctx.user.id);
    const tierFull = await getUserTierFull(ctx.db, ctx.user.id);
    const configs = await getTierConfigs();
    const tierConfig = configs[tierFull.effectiveTier];

    // Fetch user's declared country for currency display
    const dbUser = await ctx.db.query.users.findFirst({
      where: eq(users.id, ctx.user.id),
      columns: { preferences: true },
    });
    const declaredCountry = (dbUser?.preferences as any)?.country ?? null;

    // Resolve pricing country (IP-based in live mode, declared in stub mode)
    const { resolvePricingCountry, extractClientIP, getPricingMode } = await import("../services/pricing-geo");
    const clientIP = extractClientIP((name: string) => ctx.req.req.header(name));
    const pricingGeo = await resolvePricingCountry(declaredCountry, clientIP);
    const pricingMode = await getPricingMode();

    return {
      ...sub,
      effectiveTier: tierFull.effectiveTier,
      baseTier: tierFull.baseTier,
      dayPassActive: tierFull.dayPassActive,
      dayPassExpiresAt: tierFull.dayPassExpiresAt,
      isTrialing: tierFull.isTrialing,
      tierConfig,
      country: pricingGeo.countryCode ?? declaredCountry,
      pricingSource: pricingGeo.source,
      pricingMode,
    };
  }),

  /**
   * Subscribe to a tier (Basic, Pro, or Elite) — yearly billing.
   * In stub mode (no Razorpay), directly activates.
   */
  subscribe: protectedProcedure
    .input(
      z.object({
        tier: z.enum(["basic", "pro", "elite"]),
        promoCode: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return subscribeTier(ctx.db, ctx.user.id, input.tier, input.promoCode, ctx.user.email);
    }),

  /**
   * Purchase a Day Pass — 24hr Elite access.
   */
  purchaseDayPass: protectedProcedure.mutation(async ({ ctx }) => {
    return purchaseDayPass(ctx.db, ctx.user.id, ctx.user.email);
  }),

  /**
   * Cancel subscription. Stays active until period end.
   */
  cancel: protectedProcedure
    .input(
      z.object({
        reason: z.string().max(500).optional(),
        reasonCategory: z.string().max(100).optional(),
      }).optional().default({})
    )
    .mutation(async ({ ctx, input }) => {
      await cancelSubscription(ctx.db, ctx.user.id, input.reason, input.reasonCategory);
      return { success: true };
    }),

  /**
   * Validate a promo code before applying.
   */
  validatePromo: protectedProcedure
    .input(z.object({ code: z.string(), tier: z.enum(["basic", "pro", "elite"]) }))
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
        discountDisplay = "First year free";
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
            z.enum(["basic", "pro", "elite"]),
            z.object({
              priceYearlyINR: z.number().optional(),
              priceYearlyUSD: z.number().optional(),
              hasFreeTrial: z.boolean().optional(),
              freeTrialDays: z.number().int().min(0).optional(),
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
                  hasGuruVerdict: z.boolean().optional(),
                  rateMyTeamPerDay: z.number().int().min(0).optional(),
                  maxLeagues: z.number().int().min(0).optional(),
                  playerComparesPerDay: z.number().int().min(0).optional(),
                  teamSolverPerDay: z.number().int().min(0).optional(),
                  predictionSuggestionsPerMatch: z.number().int().min(0).optional(),
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
          applicableTiers: z.array(z.enum(["basic", "pro", "elite"])).min(1),
          maxRedemptions: z.number().int().min(1).nullable().optional(),
          maxPerUser: z.number().int().min(1).default(1),
          validFrom: z.date().optional(),
          validUntil: z.date().nullable().optional(),
          durationMonths: z.number().int().min(1).default(12), // default to 1 year
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
          status: z.enum(["active", "cancelled", "expired", "past_due", "trialing"]).optional(),
          tier: z.enum(["basic", "pro", "elite"]).optional(),
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
          tier: z.enum(["basic", "pro", "elite"]),
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
              currentPeriodEnd: periodEnd,
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
        } else {
          const result = await ctx.db
            .insert(subscriptions)
            .values({
              userId: input.userId,
              tier: input.tier,
              status: "active",
              currentPeriodStart: now,
              currentPeriodEnd: periodEnd,
              billingCycle: "yearly",
              priceInPaise: "0",
            })
            .returning({ id: subscriptions.id });

          await ctx.db.insert(subscriptionEvents).values({
            userId: input.userId,
            subscriptionId: result[0]!.id,
            event: "admin_override",
            fromTier: "basic",
            toTier: input.tier,
            metadata: { reason: input.reason, adminId: ctx.user.id },
          });
        }

        await invalidateUserTierCache(input.userId);
        return { success: true };
      }),

    /**
     * Grant a Day Pass to a user (admin override).
     */
    grantDayPass: adminProcedure
      .input(
        z.object({
          userId: z.string().uuid(),
          reason: z.string().min(1),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { invalidateUserTierCache, DAY_PASS_CONFIG: _ } = await import("../services/subscription");
        const { DAY_PASS_CONFIG: dpConfig } = await import("@draftplay/shared");

        const now = new Date();
        const expiresAt = new Date(now);
        expiresAt.setHours(expiresAt.getHours() + dpConfig.durationHours);

        const sub = await ctx.db.query.subscriptions.findFirst({
          where: eq(subscriptions.userId, input.userId),
        });

        if (!sub) {
          throw new Error("User has no subscription record");
        }

        await ctx.db
          .update(subscriptions)
          .set({
            dayPassActive: true,
            dayPassExpiresAt: expiresAt,
            updatedAt: now,
          })
          .where(eq(subscriptions.id, sub.id));

        await ctx.db.insert(subscriptionEvents).values({
          userId: input.userId,
          subscriptionId: sub.id,
          event: "day_pass_purchased",
          fromTier: sub.tier,
          toTier: sub.tier,
          metadata: { reason: input.reason, adminId: ctx.user.id, source: "admin_grant" },
        });

        await invalidateUserTierCache(input.userId);
        return { success: true, dayPassExpiresAt: expiresAt };
      }),

    /**
     * Expire all Day Passes that have passed their expiry time.
     */
    expireDayPasses: adminProcedure.mutation(async ({ ctx }) => {
      const count = await expireDayPasses(ctx.db);
      return { expired: count };
    }),

    /**
     * Get payment settings (mode + Razorpay config status).
     */
    getPaymentSettings: adminProcedure.query(async () => {
      const { getPaymentMode, isRazorpayConfigured } = await import("../services/razorpay");
      const { getPricingMode } = await import("../services/pricing-geo");
      return {
        mode: await getPaymentMode(),
        pricingMode: await getPricingMode(),
        razorpayConfigured: isRazorpayConfigured(),
        hasKeyId: !!process.env.RAZORPAY_KEY_ID,
        hasKeySecret: !!process.env.RAZORPAY_KEY_SECRET,
        hasWebhookSecret: !!process.env.RAZORPAY_WEBHOOK_SECRET,
        hasPlanBasic: !!process.env.RAZORPAY_PLAN_BASIC,
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
     * Get pricing geo settings (mode + current status).
     */
    getPricingSettings: adminProcedure.query(async () => {
      const { getPricingMode } = await import("../services/pricing-geo");
      return {
        pricingMode: await getPricingMode(),
      };
    }),

    /**
     * Toggle pricing mode between stub (declared country) and live (IP-based).
     */
    setPricingMode: adminProcedure
      .input(z.object({ mode: z.enum(["stub", "live"]) }))
      .mutation(async ({ ctx, input }) => {
        const { setPricingMode } = await import("../services/pricing-geo");
        await setPricingMode(input.mode, ctx.user.id);
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

      // Day Pass metrics
      const activeDayPasses = await ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(subscriptions)
        .where(eq(subscriptions.dayPassActive, true));

      const totalDayPassPurchases = await ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(subscriptionEvents)
        .where(eq(subscriptionEvents.event, "day_pass_purchased"));

      return {
        subscriptionsByTierAndStatus: allSubs,
        totalPromoRedemptions: totalPromo[0]?.total ?? 0,
        activeDayPasses: activeDayPasses[0]?.count ?? 0,
        totalDayPassPurchases: totalDayPassPurchases[0]?.count ?? 0,
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
          .where(
            sql`${subscriptions.status} IN ('active', 'trialing')`,
          )
          .groupBy(subscriptions.tier);

        const totalActiveUsers = totalUsers[0]?.count ?? 0;
        const basicCount = activePaid.find(r => r.tier === "basic")?.count ?? 0;
        const proCount = activePaid.find(r => r.tier === "pro")?.count ?? 0;
        const eliteCount = activePaid.find(r => r.tier === "elite")?.count ?? 0;
        const totalPaidUsers = basicCount + proCount + eliteCount;

        // ARR = sum of all active subscriptions' yearly price
        const arrResult = await ctx.db
          .select({ arr: sql<number>`coalesce(sum(price_in_paise::int), 0)::int` })
          .from(subscriptions)
          .where(
            sql`${subscriptions.status} IN ('active', 'trialing')`,
          );
        const arrPaise = arrResult[0]?.arr ?? 0;

        // Day Pass revenue
        const dayPassRevenue = await ctx.db
          .select({ count: sql<number>`count(*)::int` })
          .from(subscriptionEvents)
          .where(eq(subscriptionEvents.event, "day_pass_purchased"));
        const dayPassCount = dayPassRevenue[0]?.count ?? 0;
        const dayPassRevenuePaise = dayPassCount * DAY_PASS_CONFIG.priceINR;

        // ── 2. Conversion rates ──
        const conversions = await ctx.db
          .select({
            toTier: subscriptionEvents.toTier,
            count: sql<number>`count(distinct ${subscriptionEvents.userId})::int`,
          })
          .from(subscriptionEvents)
          .where(and(
            sql`${subscriptionEvents.event} IN ('created', 'upgraded')`,
            eq(subscriptionEvents.fromTier, "basic"),
            sql`${subscriptionEvents.toTier} IN ('pro', 'elite')`,
          ))
          .groupBy(subscriptionEvents.toTier);

        const basicToPro = conversions.find(r => r.toTier === "pro")?.count ?? 0;
        const basicToElite = conversions.find(r => r.toTier === "elite")?.count ?? 0;

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

        const totalChurned = await ctx.db
          .select({ count: sql<number>`count(*)::int` })
          .from(subscriptionEvents)
          .where(eq(subscriptionEvents.event, "cancelled"));

        const avgDaysToChurn = await ctx.db.execute<{ avgDays: number }>(sql`
          SELECT coalesce(avg(
            extract(epoch from (se.created_at - s.current_period_start)) / 86400
          )::int, 0) AS "avgDays"
          FROM subscription_events se
          JOIN subscriptions s ON se.subscription_id = s.id
          WHERE se.event = 'cancelled'
        `);

        // ── 4. Monthly trends ──
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

        const promoRetention = await ctx.db
          .select({
            promoCodeId: promoRedemptions.promoCodeId,
            stillActive: sql<number>`count(case when ${subscriptions.status} IN ('active', 'trialing') then 1 end)::int`,
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

        // ── 7. At-risk users ──
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
            basicUsers: basicCount,
            proUsers: proCount,
            eliteUsers: eliteCount,
            totalPaidUsers,
            conversionRate: totalActiveUsers > 0
              ? Number(((totalPaidUsers / totalActiveUsers) * 100).toFixed(1))
              : 0,
            arrPaise,
            arrDisplay: `₹${(arrPaise / 100).toFixed(0)}`,
            arpu: totalPaidUsers > 0
              ? Number(((arrPaise / totalPaidUsers) / 100).toFixed(0))
              : 0,
            dayPassPurchases: dayPassCount,
            dayPassRevenuePaise,
            dayPassRevenueDisplay: `₹${(dayPassRevenuePaise / 100).toFixed(0)}`,
          },
          conversion: {
            basicToPro,
            basicToElite,
            proToElite: proToElite[0]?.count ?? 0,
            basicToProRate: basicCount > 0
              ? Number(((basicToPro / basicCount) * 100).toFixed(1))
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
