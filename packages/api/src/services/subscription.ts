/**
 * Subscription Service — manages user tier, subscription lifecycle, and promo codes.
 *
 * Tier configs are admin-configurable via admin_config ("subscription_tiers" key).
 * Falls back to DEFAULT_TIER_CONFIGS from shared types if no admin override exists.
 *
 * Uses Redis cache (5min TTL) for tier lookups to avoid DB hits on every request.
 */

import { eq, and, sql, gte, lte } from "drizzle-orm";
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
  DEFAULT_TIER_CONFIGS,
  tierAtLeast,
} from "@draftplay/shared";
import { getFromHotCache, setHotCache, invalidateHotCache } from "./sports-cache";
import { getAdminConfig, setAdminConfig } from "./admin-config";
import { getPaymentMode, createRazorpaySubscription, cancelRazorpaySubscription } from "./razorpay";
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
    for (const tier of ["free", "pro", "elite"] as SubscriptionTier[]) {
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

/**
 * Get a user's current subscription tier. Cached in Redis for 5 min.
 * Returns "free" if no active subscription exists.
 */
export async function getUserTier(db: Database, userId: string): Promise<SubscriptionTier> {
  const cacheKey = `subscription:tier:${userId}`;
  const cached = await getFromHotCache<SubscriptionTier>(cacheKey);
  if (cached) return cached;

  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
  });

  if (!sub || sub.status !== "active") {
    await setHotCache(cacheKey, "free", TIER_CACHE_TTL);
    return "free";
  }

  // Check if period has expired
  if (sub.currentPeriodEnd && new Date(sub.currentPeriodEnd) < new Date()) {
    // Mark as expired
    await db
      .update(subscriptions)
      .set({ status: "expired", updatedAt: new Date() })
      .where(eq(subscriptions.id, sub.id));
    await db.insert(subscriptionEvents).values({
      userId,
      subscriptionId: sub.id,
      event: "expired",
      fromTier: sub.tier,
      toTier: "free",
    });
    await setHotCache(cacheKey, "free", TIER_CACHE_TTL);
    return "free";
  }

  const tier = sub.tier as SubscriptionTier;
  await setHotCache(cacheKey, tier, TIER_CACHE_TTL);
  return tier;
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
      tier: "free" as SubscriptionTier,
      status: "active" as const,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      priceInPaise: null,
    };
  }

  return {
    tier: sub.tier as SubscriptionTier,
    status: sub.status,
    currentPeriodEnd: sub.currentPeriodEnd,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    priceInPaise: sub.priceInPaise ? Number(sub.priceInPaise) : null,
  };
}

/** Invalidate tier cache for a user (call after any subscription change). */
export async function invalidateUserTierCache(userId: string): Promise<void> {
  await invalidateHotCache(`subscription:tier:${userId}`);
}

// ---------------------------------------------------------------------------
// Subscribe / Upgrade / Cancel
// ---------------------------------------------------------------------------

/**
 * Create or upgrade a subscription.
 * Stub mode: directly activates (no payment).
 * Live mode: creates Razorpay subscription, sets status "pending", returns checkout URL.
 */
export async function subscribeTier(
  db: Database,
  userId: string,
  tier: SubscriptionTier,
  promoCode?: string,
  userEmail?: string | null
): Promise<{
  subscriptionId: string;
  tier: SubscriptionTier;
  discountApplied: number;
  paymentMode: "stub" | "live";
  checkoutUrl?: string;
}> {
  if (tier === "free") {
    throw new Error("Cannot subscribe to free tier — cancel instead");
  }

  const configs = await getTierConfigs();
  const tierConfig = configs[tier];
  if (!tierConfig) throw new Error(`Unknown tier: ${tier}`);

  // Check existing subscription
  const existing = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
  });

  const fromTier = (existing?.tier ?? "free") as SubscriptionTier;
  const isUpgrade = existing && existing.status === "active";
  const event = isUpgrade ? (tierAtLeast(tier, fromTier) ? "upgraded" : "downgraded") : "created";

  // Resolve promo code discount
  let discountApplied = 0;
  let promoCodeId: string | null = null;

  if (promoCode) {
    const promo = await validatePromoCode(db, promoCode, userId, tier);
    if (promo) {
      promoCodeId = promo.id;
      if (promo.discountType === "percentage") {
        discountApplied = Math.round(tierConfig.priceInPaise * promo.discountValue / 100);
      } else if (promo.discountType === "fixed_amount") {
        discountApplied = promo.discountValue;
      } else if (promo.discountType === "free_trial") {
        discountApplied = tierConfig.priceInPaise; // 100% off
      }
    }
  }

  const finalPrice = Math.max(0, tierConfig.priceInPaise - discountApplied);
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  // Determine payment mode
  const paymentMode = await getPaymentMode();
  const isLive = paymentMode === "live";

  let subscriptionId: string;
  let checkoutUrl: string | undefined;

  // In live mode, create Razorpay subscription first to get the ID
  let razorpaySubscriptionId: string | null = null;
  if (isLive) {
    const rpResult = await createRazorpaySubscription(db, userId, tier, userEmail ?? null);
    razorpaySubscriptionId = rpResult.razorpaySubscriptionId;
    checkoutUrl = rpResult.shortUrl;
  }

  if (existing) {
    // Update existing subscription
    const result = await db
      .update(subscriptions)
      .set({
        tier,
        status: isLive ? "pending" : "active",
        currentPeriodStart: isLive ? undefined : now,
        currentPeriodEnd: isLive ? undefined : periodEnd,
        cancelAtPeriodEnd: false,
        priceInPaise: String(finalPrice),
        promoCodeId,
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
        status: isLive ? "pending" : "active",
        currentPeriodStart: isLive ? undefined : now,
        currentPeriodEnd: isLive ? undefined : periodEnd,
        priceInPaise: String(finalPrice),
        promoCodeId,
        razorpaySubscriptionId,
      })
      .returning({ id: subscriptions.id });
    subscriptionId = result[0]!.id;
  }

  // Log event
  await db.insert(subscriptionEvents).values({
    userId,
    subscriptionId,
    event,
    fromTier,
    toTier: tier,
    metadata: {
      priceInPaise: finalPrice,
      promoCode: promoCode ?? null,
      discountApplied,
      paymentMode,
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

  // Only invalidate cache in stub mode (immediate activation)
  // In live mode, cache invalidation happens when webhook confirms payment
  if (!isLive) {
    await invalidateUserTierCache(userId);
  }

  log.info({ userId, tier, event, discountApplied, paymentMode }, "Subscription updated");

  return { subscriptionId, tier, discountApplied, paymentMode, checkoutUrl };
}

/**
 * Cancel subscription. Sets cancelAtPeriodEnd — sub stays active until period end.
 */
export async function cancelSubscription(db: Database, userId: string): Promise<void> {
  const sub = await db.query.subscriptions.findFirst({
    where: and(eq(subscriptions.userId, userId), eq(subscriptions.status, "active")),
  });

  if (!sub || sub.tier === "free") {
    throw new Error("No active paid subscription to cancel");
  }

  const paymentMode = await getPaymentMode();

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
      metadata: { cancelledAt: new Date().toISOString(), expiresAt: sub.currentPeriodEnd?.toISOString(), paymentMode },
    });

    log.info({ userId, tier: sub.tier, paymentMode }, "Subscription cancelled (active until period end)");
  } else {
    // Stub mode: cancel immediately, downgrade to free
    await db
      .update(subscriptions)
      .set({
        tier: "free",
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
      toTier: "free",
      metadata: { cancelledAt: new Date().toISOString(), paymentMode, immediate: true },
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
  periodEnd.setMonth(periodEnd.getMonth() + 1);

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
 * Extend subscription period on recurring charge.
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
  newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);

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
  log.info({ userId: sub.userId, razorpaySubscriptionId }, "Webhook: subscription renewed");
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
    toTier: "free",
    metadata: { razorpaySubscriptionId, razorpayEventId, source: "webhook" },
  });

  await invalidateUserTierCache(sub.userId);
  log.info({ userId: sub.userId, razorpaySubscriptionId }, "Webhook: subscription cancelled externally");
}
