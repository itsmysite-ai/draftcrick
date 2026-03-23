/**
 * Subscription Service — manages user tier, subscription lifecycle, Day Pass, and promo codes.
 *
 * 3-tier paid model: Basic / Pro / Elite (yearly billing).
 * Day Pass: 24hr Elite access via one-time payment.
 * No free tier — every user must have an active subscription or trial.
 *
 * Tier configs are admin-configurable via admin_config ("subscription_tiers" key).
 * Falls back to DEFAULT_TIER_CONFIGS from shared types if no admin override exists.
 *
 * Uses PG cache (5min TTL) for tier lookups to avoid DB hits on every request.
 */

import { eq, and, sql, lt } from "drizzle-orm";
import { getDb } from "@draftplay/db";
import {
  subscriptions,
  subscriptionEvents,
  promoCodes,
  promoRedemptions,
} from "@draftplay/db";
import type { Database } from "@draftplay/db";
import {
  type SubscriptionTier,
  type TierConfig,
  type TierFeatures,
  type PurchasePlatform,
  DEFAULT_TIER_CONFIGS,
  DAY_PASS_CONFIG,
  REVENUECAT_PRODUCT_IDS,
  REVENUECAT_DAYPASS_PRODUCT_ID,
  tierAtLeast,
  getEffectiveTier,
} from "@draftplay/shared";
import { getFromHotCache, setHotCache, invalidateHotCache } from "./sports-cache";
import { getAdminConfig, setAdminConfig } from "./admin-config";
import { getPaymentMode, createRazorpaySubscription, cancelRazorpaySubscription, createDayPassOrder } from "./razorpay";
import { getLogger } from "../lib/logger";

const log = getLogger("subscription");

const TIER_CACHE_TTL = 300; // 5 min

// ---------------------------------------------------------------------------
// Tier config resolution (admin overrides merge on top of defaults)
// ---------------------------------------------------------------------------

/**
 * Get effective tier configs. Admin overrides merge on top of DEFAULT_TIER_CONFIGS.
 * Admin can change pricing, toggle features, and edit display text per tier.
 */
export async function getTierConfigs(): Promise<Record<SubscriptionTier, TierConfig>> {
  const cacheKey = "subscription:tier-configs";
  const cached = await getFromHotCache<Record<SubscriptionTier, TierConfig>>(cacheKey);
  if (cached) return cached;

  const adminOverrides = await getAdminConfig<Record<string, Partial<TierConfig>>>("subscription_tiers");

  const configs = { ...DEFAULT_TIER_CONFIGS };

  if (adminOverrides) {
    for (const tier of ["basic", "pro", "elite"] as SubscriptionTier[]) {
      const override = adminOverrides[tier];
      if (override) {
        configs[tier] = {
          ...configs[tier],
          ...override,
          features: {
            ...configs[tier].features,
            ...(override.features ?? {}),
          } as TierFeatures,
        };
      }
    }
  }

  await setHotCache(cacheKey, configs, TIER_CACHE_TTL);
  return configs;
}

/**
 * Admin: update tier configs. Merges with defaults, caches.
 */
export async function updateTierConfigs(
  overrides: Record<string, Partial<TierConfig>>,
  adminUserId: string
): Promise<void> {
  await setAdminConfig("subscription_tiers", overrides, "Subscription tier configuration", adminUserId);
  await invalidateHotCache("subscription:tier-configs");
  log.info({ adminUserId }, "Tier configs updated by admin");
}

// ---------------------------------------------------------------------------
// User tier resolution
// ---------------------------------------------------------------------------

export interface UserTierResult {
  baseTier: SubscriptionTier;
  effectiveTier: SubscriptionTier;
  dayPassActive: boolean;
  dayPassExpiresAt: Date | null;
  isTrialing: boolean;
}

/**
 * Get a user's current subscription tier with Day Pass overlay.
 * Returns "basic" if no active subscription exists.
 * Day Pass grants Elite features for 24hrs regardless of base tier.
 */
export async function getUserTier(db: Database, userId: string): Promise<SubscriptionTier> {
  const result = await getUserTierFull(db, userId);
  return result.effectiveTier;
}

/**
 * Full tier resolution with Day Pass and trial info.
 */
export async function getUserTierFull(db: Database, userId: string): Promise<UserTierResult> {
  const cacheKey = `subscription:tier-full:${userId}`;
  const cached = await getFromHotCache<UserTierResult>(cacheKey);
  if (cached) return cached;

  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
  });

  const defaultResult: UserTierResult = {
    baseTier: "basic",
    effectiveTier: "basic",
    dayPassActive: false,
    dayPassExpiresAt: null,
    isTrialing: false,
  };

  if (!sub) {
    await setHotCache(cacheKey, defaultResult, TIER_CACHE_TTL);
    return defaultResult;
  }

  // Check if subscription is not active/trialing
  if (sub.status !== "active" && sub.status !== "trialing") {
    await setHotCache(cacheKey, defaultResult, TIER_CACHE_TTL);
    return defaultResult;
  }

  // Check if period has expired
  if (sub.currentPeriodEnd && new Date(sub.currentPeriodEnd) < new Date()) {
    // Check if trial ended — mark as expired
    await db
      .update(subscriptions)
      .set({ status: "expired", updatedAt: new Date() })
      .where(eq(subscriptions.id, sub.id));
    await db.insert(subscriptionEvents).values({
      userId,
      subscriptionId: sub.id,
      event: "expired",
      fromTier: sub.tier,
      toTier: sub.tier,
    });
    await setHotCache(cacheKey, defaultResult, TIER_CACHE_TTL);
    return defaultResult;
  }

  const baseTier = sub.tier as SubscriptionTier;
  const now = new Date();

  // Check Day Pass status
  let dayPassActive = sub.dayPassActive ?? false;
  const dayPassExpiresAt = sub.dayPassExpiresAt ? new Date(sub.dayPassExpiresAt) : null;

  if (dayPassActive && dayPassExpiresAt) {
    if (dayPassExpiresAt < now) {
      // Day Pass expired — deactivate lazily
      dayPassActive = false;
      await db
        .update(subscriptions)
        .set({ dayPassActive: false, updatedAt: now })
        .where(eq(subscriptions.id, sub.id));
    }
  }

  const isTrialing = sub.status === "trialing";
  const effectiveTier = getEffectiveTier(baseTier, dayPassActive);

  const result: UserTierResult = {
    baseTier,
    effectiveTier,
    dayPassActive,
    dayPassExpiresAt: dayPassActive ? dayPassExpiresAt : null,
    isTrialing,
  };

  await setHotCache(cacheKey, result, TIER_CACHE_TTL);
  return result;
}

/**
 * Get a user's full subscription details (for profile/subscription screen).
 */
export async function getUserSubscription(db: Database, userId: string) {
  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
  });

  if (!sub) {
    return {
      tier: "basic" as SubscriptionTier,
      status: "expired" as const,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      priceInPaise: null,
      priceUsdCents: null,
      currency: "INR" as const,
      billingCycle: "yearly" as const,
      trialEndsAt: null,
      dayPassActive: false,
      dayPassExpiresAt: null,
    };
  }

  return {
    tier: sub.tier as SubscriptionTier,
    status: sub.status,
    currentPeriodEnd: sub.currentPeriodEnd,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    priceInPaise: sub.priceInPaise ? Number(sub.priceInPaise) : null,
    priceUsdCents: sub.priceUsdCents,
    currency: sub.currency,
    billingCycle: sub.billingCycle,
    trialEndsAt: sub.trialEndsAt,
    dayPassActive: sub.dayPassActive,
    dayPassExpiresAt: sub.dayPassExpiresAt,
  };
}

/** Invalidate tier cache for a user (call after any subscription change). */
export async function invalidateUserTierCache(userId: string): Promise<void> {
  await invalidateHotCache(`subscription:tier-full:${userId}`);
  // Also invalidate legacy key if cached
  await invalidateHotCache(`subscription:tier:${userId}`);
}

// ---------------------------------------------------------------------------
// Subscribe / Upgrade / Cancel
// ---------------------------------------------------------------------------

/**
 * Create or upgrade a subscription (yearly billing).
 * Stub mode: directly activates (no payment).
 * Live mode: creates Razorpay subscription, sets status "pending", returns checkout URL.
 * Basic tier with free trial: sets status "trialing" for 7 days.
 */
export async function subscribeTier(
  db: Database,
  userId: string,
  tier: SubscriptionTier,
  promoCode?: string,
  userEmail?: string | null,
  platform?: PurchasePlatform
): Promise<{
  subscriptionId: string;
  tier: SubscriptionTier;
  discountApplied: number;
  paymentMode: "stub" | "live";
  checkoutUrl?: string;
  isTrialing?: boolean;
  provider?: "razorpay" | "apple";
  productId?: string;
}> {
  const configs = await getTierConfigs();
  const tierConfig = configs[tier];
  if (!tierConfig) throw new Error(`Unknown tier: ${tier}`);

  // Check existing subscription
  const existing = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
  });

  const fromTier = (existing?.tier ?? "basic") as SubscriptionTier;
  const isUpgrade = existing && (existing.status === "active" || existing.status === "trialing");
  const event = isUpgrade ? (tierAtLeast(tier, fromTier) ? "upgraded" : "downgraded") : "created";

  // Resolve promo code discount
  let discountApplied = 0;
  let promoCodeId: string | null = null;

  if (promoCode) {
    const promo = await validatePromoCode(db, promoCode, userId, tier);
    if (promo) {
      promoCodeId = promo.id;
      if (promo.discountType === "percentage") {
        discountApplied = Math.round(tierConfig.priceYearlyINR * promo.discountValue / 100);
      } else if (promo.discountType === "fixed_amount") {
        discountApplied = promo.discountValue;
      } else if (promo.discountType === "free_trial") {
        discountApplied = tierConfig.priceYearlyINR; // 100% off first year
      }
    }
  }

  const finalPrice = Math.max(0, tierConfig.priceYearlyINR - discountApplied);
  const now = new Date();

  // ── iOS: route to Apple IAP via RevenueCat ──
  // On iOS, we don't process payment server-side. We return the product ID
  // so the client can initiate the Apple payment sheet via RevenueCat SDK.
  // The RevenueCat webhook will activate the subscription once Apple confirms.
  if (platform === "ios") {
    const productId = REVENUECAT_PRODUCT_IDS[tier];

    // Create or update subscription record as "pending" (awaiting Apple confirmation)
    let subscriptionId: string;
    if (existing) {
      const result = await db
        .update(subscriptions)
        .set({
          tier,
          status: "pending",
          paymentProvider: "apple",
          purchasePlatform: "ios",
          cancelAtPeriodEnd: false,
          promoCodeId,
          updatedAt: now,
        })
        .where(eq(subscriptions.id, existing.id))
        .returning({ id: subscriptions.id });
      subscriptionId = result[0]!.id;
    } else {
      const result = await db
        .insert(subscriptions)
        .values({
          userId,
          tier,
          status: "pending",
          billingCycle: "yearly",
          paymentProvider: "apple",
          purchasePlatform: "ios",
          promoCodeId,
        })
        .returning({ id: subscriptions.id });
      subscriptionId = result[0]!.id;
    }

    await db.insert(subscriptionEvents).values({
      userId,
      subscriptionId,
      event: "created",
      fromTier: (existing?.tier ?? "basic") as string,
      toTier: tier,
      metadata: { provider: "apple", productId, platform: "ios", status: "pending_apple_iap" },
    });

    log.info({ userId, tier, productId, platform: "ios" }, "iOS subscription initiated — awaiting Apple IAP");

    return {
      subscriptionId,
      tier,
      discountApplied: 0, // Apple handles pricing
      paymentMode: "live",
      provider: "apple",
      productId,
    };
  }

  // Check if this is a free trial eligible subscription
  const isNewBasicTrial = tier === "basic" && tierConfig.hasFreeTrial && !existing;

  let periodEnd: Date;
  let trialEndsAt: Date | null = null;
  let status: string;

  if (isNewBasicTrial) {
    // 7-day free trial for Basic tier
    trialEndsAt = new Date(now);
    trialEndsAt.setDate(trialEndsAt.getDate() + tierConfig.freeTrialDays);
    periodEnd = trialEndsAt;
    status = "trialing";
  } else {
    periodEnd = new Date(now);
    periodEnd.setFullYear(periodEnd.getFullYear() + 1); // yearly billing
    status = "active";
  }

  // Determine payment mode
  const paymentMode = await getPaymentMode();
  const isLive = paymentMode === "live";

  let subscriptionId: string;
  let checkoutUrl: string | undefined;

  // In live mode and not a free trial, create Razorpay subscription
  let razorpaySubscriptionId: string | null = null;
  if (isLive && !isNewBasicTrial) {
    const rpResult = await createRazorpaySubscription(db, userId, tier, userEmail ?? null);
    razorpaySubscriptionId = rpResult.razorpaySubscriptionId;
    checkoutUrl = rpResult.shortUrl;
    status = "pending"; // wait for Razorpay webhook to activate
  }

  if (existing) {
    // Update existing subscription
    const result = await db
      .update(subscriptions)
      .set({
        tier,
        status: isLive && !isNewBasicTrial ? "pending" : status,
        currentPeriodStart: isLive && !isNewBasicTrial ? undefined : now,
        currentPeriodEnd: isLive && !isNewBasicTrial ? undefined : periodEnd,
        cancelAtPeriodEnd: false,
        billingCycle: "yearly",
        priceInPaise: String(finalPrice),
        promoCodeId,
        trialEndsAt,
        razorpaySubscriptionId: razorpaySubscriptionId ?? existing.razorpaySubscriptionId,
        updatedAt: now,
      })
      .where(eq(subscriptions.id, existing.id))
      .returning({ id: subscriptions.id });
    subscriptionId = result[0]!.id;
  } else {
    // Create new subscription
    const result = await db
      .insert(subscriptions)
      .values({
        userId,
        tier,
        status,
        currentPeriodStart: isLive && !isNewBasicTrial ? undefined : now,
        currentPeriodEnd: isLive && !isNewBasicTrial ? undefined : periodEnd,
        billingCycle: "yearly",
        priceInPaise: String(finalPrice),
        promoCodeId,
        trialEndsAt,
        razorpaySubscriptionId,
      })
      .returning({ id: subscriptions.id });
    subscriptionId = result[0]!.id;
  }

  // Log event
  await db.insert(subscriptionEvents).values({
    userId,
    subscriptionId,
    event: isNewBasicTrial ? "trial_started" : event,
    fromTier,
    toTier: tier,
    metadata: {
      priceInPaise: finalPrice,
      promoCode: promoCode ?? null,
      discountApplied,
      paymentMode,
      billingCycle: "yearly",
      isTrialing: isNewBasicTrial,
      razorpaySubscriptionId: razorpaySubscriptionId ?? undefined,
    },
  });

  // Record promo redemption
  if (promoCodeId) {
    await db.insert(promoRedemptions).values({
      promoCodeId,
      userId,
      subscriptionId,
      discountAppliedPaise: discountApplied,
    });
    // Increment redemption counter
    await db
      .update(promoCodes)
      .set({ currentRedemptions: sql`${promoCodes.currentRedemptions} + 1`, updatedAt: now })
      .where(eq(promoCodes.id, promoCodeId));
  }

  // Only invalidate cache in stub mode or trial (immediate activation)
  if (!isLive || isNewBasicTrial) {
    await invalidateUserTierCache(userId);
  }

  log.info({ userId, tier, event, discountApplied, paymentMode, isTrialing: isNewBasicTrial }, "Subscription updated");

  return { subscriptionId, tier, discountApplied, paymentMode, checkoutUrl, isTrialing: isNewBasicTrial };
}

/**
 * Purchase a Day Pass — 24hr Elite access via one-time payment.
 * Stub mode: activates immediately.
 * Live mode: creates Razorpay order, returns checkout URL.
 */
export async function purchaseDayPass(
  db: Database,
  userId: string,
  userEmail?: string | null,
  platform?: PurchasePlatform
): Promise<{
  success: boolean;
  dayPassExpiresAt: Date;
  paymentMode: "stub" | "live";
  checkoutUrl?: string;
  orderId?: string;
  provider?: "razorpay" | "apple";
  productId?: string;
}> {
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setHours(expiresAt.getHours() + DAY_PASS_CONFIG.durationHours);

  // ── iOS: route to Apple IAP via RevenueCat ──
  if (platform === "ios") {
    log.info({ userId, platform: "ios" }, "iOS Day Pass initiated — awaiting Apple IAP");
    return {
      success: true,
      dayPassExpiresAt: expiresAt,
      paymentMode: "live",
      provider: "apple",
      productId: REVENUECAT_DAYPASS_PRODUCT_ID,
    };
  }

  const paymentMode = await getPaymentMode();
  const isLive = paymentMode === "live";

  // Ensure subscription record exists
  let sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
  });

  if (!sub) {
    // Create a basic subscription record first
    const result = await db
      .insert(subscriptions)
      .values({
        userId,
        tier: "basic",
        status: "active",
        currentPeriodStart: now,
        billingCycle: "yearly",
      })
      .returning();
    sub = result[0]!;
  }

  let checkoutUrl: string | undefined;
  let orderId: string | undefined;
  let razorpayPaymentId: string | null = null;

  if (isLive) {
    const orderResult = await createDayPassOrder(db, userId, userEmail ?? null);
    checkoutUrl = orderResult.checkoutUrl;
    orderId = orderResult.orderId;
    // In live mode, Day Pass activates on payment.captured webhook
    // Log the pending purchase
    await db.insert(subscriptionEvents).values({
      userId,
      subscriptionId: sub.id,
      event: "day_pass_purchased",
      fromTier: sub.tier,
      toTier: sub.tier,
      metadata: { orderId, paymentMode, status: "pending" },
    });

    return { success: true, dayPassExpiresAt: expiresAt, paymentMode, checkoutUrl, orderId };
  }

  // Stub mode: activate immediately
  await db
    .update(subscriptions)
    .set({
      dayPassActive: true,
      dayPassExpiresAt: expiresAt,
      updatedAt: now,
    })
    .where(eq(subscriptions.id, sub.id));

  await db.insert(subscriptionEvents).values({
    userId,
    subscriptionId: sub.id,
    event: "day_pass_purchased",
    fromTier: sub.tier,
    toTier: sub.tier,
    metadata: {
      dayPassExpiresAt: expiresAt.toISOString(),
      priceINR: DAY_PASS_CONFIG.priceINR,
      paymentMode,
    },
  });

  await invalidateUserTierCache(userId);
  log.info({ userId, dayPassExpiresAt: expiresAt.toISOString() }, "Day Pass activated (stub mode)");

  return { success: true, dayPassExpiresAt: expiresAt, paymentMode };
}

/**
 * Activate Day Pass from webhook (live mode).
 */
export async function activateDayPassFromWebhook(
  db: Database,
  userId: string,
  razorpayPaymentId: string
): Promise<void> {
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setHours(expiresAt.getHours() + DAY_PASS_CONFIG.durationHours);

  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
  });

  if (!sub) {
    log.warn({ userId, razorpayPaymentId }, "Webhook: no subscription found for Day Pass activation");
    return;
  }

  await db
    .update(subscriptions)
    .set({
      dayPassActive: true,
      dayPassExpiresAt: expiresAt,
      dayPassRazorpayPaymentId: razorpayPaymentId,
      updatedAt: now,
    })
    .where(eq(subscriptions.id, sub.id));

  await invalidateUserTierCache(userId);
  log.info({ userId, razorpayPaymentId, dayPassExpiresAt: expiresAt.toISOString() }, "Day Pass activated via webhook");
}

/**
 * Batch expire Day Passes that have passed their expiry time.
 * Can be called from a cron job or periodically.
 */
export async function expireDayPasses(db: Database): Promise<number> {
  const now = new Date();
  const expired = await db
    .update(subscriptions)
    .set({ dayPassActive: false, updatedAt: now })
    .where(
      and(
        eq(subscriptions.dayPassActive, true),
        lt(subscriptions.dayPassExpiresAt, now)
      )
    )
    .returning({ userId: subscriptions.userId });

  for (const { userId } of expired) {
    await invalidateUserTierCache(userId);
  }

  if (expired.length > 0) {
    log.info({ count: expired.length }, "Expired Day Passes cleaned up");
  }

  return expired.length;
}

/**
 * Cancel subscription. Sets cancelAtPeriodEnd — sub stays active until period end.
 */
export async function cancelSubscription(db: Database, userId: string, reason?: string, reasonCategory?: string): Promise<void> {
  const sub = await db.query.subscriptions.findFirst({
    where: and(
      eq(subscriptions.userId, userId),
      sql`${subscriptions.status} IN ('active', 'trialing')`,
    ),
  });

  if (!sub) {
    const { TRPCError } = await import("@trpc/server");
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "No active subscription to cancel",
    });
  }

  const paymentMode = await getPaymentMode();

  // Apple IAP: cancellation is managed by Apple via Settings app.
  // We only mark it locally — RevenueCat webhook will handle the actual expiry.
  if (sub.paymentProvider === "apple") {
    await db
      .update(subscriptions)
      .set({ cancelAtPeriodEnd: true, updatedAt: new Date() })
      .where(eq(subscriptions.id, sub.id));

    await db.insert(subscriptionEvents).values({
      userId,
      subscriptionId: sub.id,
      event: "cancelled",
      fromTier: sub.tier,
      toTier: sub.tier,
      metadata: { provider: "apple", note: "User must cancel via Apple Settings", ...(reason && { reason }), ...(reasonCategory && { reasonCategory }) },
    });

    await invalidateUserTierCache(userId);
    log.info({ userId, tier: sub.tier, provider: "apple" }, "Apple subscription cancel requested (user must cancel via Apple Settings)");
    return;
  }

  if (paymentMode === "live" && sub.razorpaySubscriptionId) {
    // Live mode: mark for cancellation at period end, let Razorpay webhook handle expiry
    await db
      .update(subscriptions)
      .set({ cancelAtPeriodEnd: true, updatedAt: new Date() })
      .where(eq(subscriptions.id, sub.id));

    try {
      await cancelRazorpaySubscription(sub.razorpaySubscriptionId);
    } catch (err) {
      log.error({ userId, razorpaySubscriptionId: sub.razorpaySubscriptionId, error: String(err) }, "Failed to cancel Razorpay subscription");
    }

    await db.insert(subscriptionEvents).values({
      userId,
      subscriptionId: sub.id,
      event: "cancelled",
      fromTier: sub.tier,
      toTier: sub.tier, // stays until period end
      metadata: { cancelledAt: new Date().toISOString(), expiresAt: sub.currentPeriodEnd?.toISOString(), paymentMode, ...(reason && { reason }), ...(reasonCategory && { reasonCategory }) },
    });

    log.info({ userId, tier: sub.tier, paymentMode, reasonCategory }, "Subscription cancelled (active until period end)");
  } else {
    // Stub mode or trial: cancel immediately, mark as cancelled
    await db
      .update(subscriptions)
      .set({
        status: "cancelled",
        cancelAtPeriodEnd: false,
        currentPeriodEnd: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, sub.id));

    await db.insert(subscriptionEvents).values({
      userId,
      subscriptionId: sub.id,
      event: "cancelled",
      fromTier: sub.tier,
      toTier: sub.tier,
      metadata: { cancelledAt: new Date().toISOString(), paymentMode, immediate: true, ...(reason && { reason }), ...(reasonCategory && { reasonCategory }) },
    });

    await invalidateUserTierCache(userId);
    log.info({ userId, fromTier: sub.tier, paymentMode }, "Subscription cancelled immediately (stub mode)");
  }
}

/**
 * Get subscription event history for a user.
 */
export async function getSubscriptionHistory(db: Database, userId: string) {
  return db.query.subscriptionEvents.findMany({
    where: eq(subscriptionEvents.userId, userId),
    orderBy: (events, { desc }) => [desc(events.createdAt)],
    limit: 50,
  });
}

// ---------------------------------------------------------------------------
// Promo code validation
// ---------------------------------------------------------------------------

/**
 * Validate a promo code for a user + tier. Returns the promo record if valid, null otherwise.
 */
export async function validatePromoCode(
  db: Database,
  code: string,
  userId: string,
  tier: SubscriptionTier
): Promise<{ id: string; discountType: string; discountValue: number; durationMonths: number } | null> {
  const promo = await db.query.promoCodes.findFirst({
    where: and(
      eq(promoCodes.code, code.toUpperCase()),
      eq(promoCodes.isActive, true),
    ),
  });

  if (!promo) {
    log.debug({ code }, "Promo code not found");
    return null;
  }

  const now = new Date();

  // Check validity period
  if (promo.validFrom > now) return null;
  if (promo.validUntil && promo.validUntil < now) return null;

  // Check max redemptions
  if (promo.maxRedemptions !== null && promo.currentRedemptions >= promo.maxRedemptions) return null;

  // Check applicable tiers
  const applicableTiers = promo.applicableTiers as string[];
  if (!applicableTiers.includes(tier)) return null;

  // Check per-user limit
  const userRedemptions = await db.query.promoRedemptions.findMany({
    where: and(
      eq(promoRedemptions.promoCodeId, promo.id),
      eq(promoRedemptions.userId, userId),
    ),
  });
  if (userRedemptions.length >= promo.maxPerUser) return null;

  return {
    id: promo.id,
    discountType: promo.discountType,
    discountValue: promo.discountValue,
    durationMonths: promo.durationMonths,
  };
}

// ---------------------------------------------------------------------------
// Webhook handlers (called from /webhooks/razorpay route)
// ---------------------------------------------------------------------------

/**
 * Activate a subscription after Razorpay confirms payment.
 * Called on: subscription.activated, subscription.charged (first charge)
 */
export async function activateSubscriptionFromWebhook(
  db: Database,
  razorpaySubscriptionId: string,
  razorpayEventId?: string
): Promise<void> {
  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.razorpaySubscriptionId, razorpaySubscriptionId),
  });

  if (!sub) {
    log.warn({ razorpaySubscriptionId }, "Webhook: subscription not found for Razorpay ID");
    return;
  }

  // Idempotency: skip if already active
  if (sub.status === "active") {
    log.debug({ razorpaySubscriptionId }, "Webhook: subscription already active, skipping");
    return;
  }

  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setFullYear(periodEnd.getFullYear() + 1); // yearly billing

  await db
    .update(subscriptions)
    .set({
      status: "active",
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      updatedAt: now,
    })
    .where(eq(subscriptions.id, sub.id));

  await db.insert(subscriptionEvents).values({
    userId: sub.userId,
    subscriptionId: sub.id,
    event: "renewed",
    fromTier: sub.tier,
    toTier: sub.tier,
    metadata: { razorpaySubscriptionId, razorpayEventId, source: "webhook" },
  });

  await invalidateUserTierCache(sub.userId);
  log.info({ userId: sub.userId, tier: sub.tier, razorpaySubscriptionId }, "Webhook: subscription activated");
}

/**
 * Extend subscription period on recurring charge (yearly renewal).
 * Called on: subscription.charged (subsequent charges)
 */
export async function renewSubscription(
  db: Database,
  razorpaySubscriptionId: string,
  razorpayEventId?: string
): Promise<void> {
  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.razorpaySubscriptionId, razorpaySubscriptionId),
  });

  if (!sub) {
    log.warn({ razorpaySubscriptionId }, "Webhook: subscription not found for renewal");
    return;
  }

  const now = new Date();
  const newPeriodEnd = new Date(sub.currentPeriodEnd ?? now);
  newPeriodEnd.setFullYear(newPeriodEnd.getFullYear() + 1); // yearly renewal

  await db
    .update(subscriptions)
    .set({
      status: "active",
      currentPeriodEnd: newPeriodEnd,
      cancelAtPeriodEnd: false,
      updatedAt: now,
    })
    .where(eq(subscriptions.id, sub.id));

  await db.insert(subscriptionEvents).values({
    userId: sub.userId,
    subscriptionId: sub.id,
    event: "renewed",
    fromTier: sub.tier,
    toTier: sub.tier,
    metadata: { razorpaySubscriptionId, razorpayEventId, source: "webhook", newPeriodEnd: newPeriodEnd.toISOString() },
  });

  await invalidateUserTierCache(sub.userId);
  log.info({ userId: sub.userId, razorpaySubscriptionId }, "Webhook: subscription renewed (yearly)");
}

/**
 * Handle payment failure from Razorpay.
 * Sets subscription to "past_due" status.
 */
export async function handlePaymentFailed(
  db: Database,
  razorpaySubscriptionId: string,
  razorpayEventId?: string
): Promise<void> {
  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.razorpaySubscriptionId, razorpaySubscriptionId),
  });

  if (!sub) {
    log.warn({ razorpaySubscriptionId }, "Webhook: subscription not found for payment failure");
    return;
  }

  await db
    .update(subscriptions)
    .set({ status: "past_due", updatedAt: new Date() })
    .where(eq(subscriptions.id, sub.id));

  await db.insert(subscriptionEvents).values({
    userId: sub.userId,
    subscriptionId: sub.id,
    event: "payment_failed",
    fromTier: sub.tier,
    toTier: sub.tier,
    metadata: { razorpaySubscriptionId, razorpayEventId, source: "webhook" },
  });

  await invalidateUserTierCache(sub.userId);
  log.info({ userId: sub.userId, razorpaySubscriptionId }, "Webhook: payment failed");
}

/**
 * Handle external cancellation from Razorpay (subscription.cancelled or subscription.completed).
 */
export async function handleExternalCancellation(
  db: Database,
  razorpaySubscriptionId: string,
  razorpayEventId?: string
): Promise<void> {
  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.razorpaySubscriptionId, razorpaySubscriptionId),
  });

  if (!sub) {
    log.warn({ razorpaySubscriptionId }, "Webhook: subscription not found for cancellation");
    return;
  }

  // Skip if already cancelled/expired
  if (sub.status === "cancelled" || sub.status === "expired") {
    log.debug({ razorpaySubscriptionId }, "Webhook: subscription already cancelled/expired, skipping");
    return;
  }

  await db
    .update(subscriptions)
    .set({ status: "cancelled", cancelAtPeriodEnd: false, updatedAt: new Date() })
    .where(eq(subscriptions.id, sub.id));

  await db.insert(subscriptionEvents).values({
    userId: sub.userId,
    subscriptionId: sub.id,
    event: "cancelled",
    fromTier: sub.tier,
    toTier: sub.tier,
    metadata: { razorpaySubscriptionId, razorpayEventId, source: "webhook" },
  });

  await invalidateUserTierCache(sub.userId);
  log.info({ userId: sub.userId, razorpaySubscriptionId }, "Webhook: subscription cancelled externally");
}
