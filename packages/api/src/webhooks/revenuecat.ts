/**
 * RevenueCat Webhook Handler — raw Hono route (not tRPC).
 *
 * Handles Apple IAP subscription lifecycle via RevenueCat's server notifications:
 * - INITIAL_PURCHASE → activate subscription
 * - RENEWAL → extend subscription period
 * - CANCELLATION → set cancelAtPeriodEnd
 * - EXPIRATION → mark as expired
 * - BILLING_ISSUE_DETECTED → mark as past_due
 * - NON_RENEWING_PURCHASE → activate Day Pass (consumable)
 *
 * Authenticates via Authorization header shared secret.
 * Returns 200 for all processed events to prevent RevenueCat retries.
 */

import { Hono } from "hono";
import { getDb } from "@draftplay/db";
import { subscriptions, subscriptionEvents } from "@draftplay/db";
import { eq } from "drizzle-orm";
import { DAY_PASS_CONFIG, REVENUECAT_PRODUCT_IDS } from "@draftplay/shared";
import type { SubscriptionTier } from "@draftplay/shared";
import { invalidateUserTierCache } from "../services/subscription";
import { getLogger } from "../lib/logger";

const log = getLogger("webhook-revenuecat");

export const revenuecatWebhook = new Hono();

/** Verify the shared secret in Authorization header */
function verifyAuth(authHeader: string | undefined): boolean {
  const expectedKey = process.env.REVENUECAT_WEBHOOK_AUTH_KEY;
  if (!expectedKey) {
    log.warn("REVENUECAT_WEBHOOK_AUTH_KEY not configured, rejecting webhook");
    return false;
  }
  return authHeader === `Bearer ${expectedKey}`;
}

/** Map a RevenueCat product ID to our subscription tier */
function productIdToTier(productId: string): SubscriptionTier | null {
  for (const [tier, id] of Object.entries(REVENUECAT_PRODUCT_IDS)) {
    if (productId === id) return tier as SubscriptionTier;
  }
  return null;
}

revenuecatWebhook.post("/", async (c) => {
  // Verify authorization
  const authHeader = c.req.header("authorization") ?? c.req.header("Authorization");
  if (!verifyAuth(authHeader)) {
    log.warn("Invalid webhook authorization");
    return c.json({ error: "Unauthorized" }, 401);
  }

  let payload: any;
  try {
    payload = await c.req.json();
  } catch {
    log.warn("Invalid JSON in webhook body");
    return c.json({ error: "Invalid JSON" }, 400);
  }

  const event = payload.event;
  if (!event) {
    return c.json({ error: "Missing event" }, 400);
  }

  const eventType = event.type as string;
  const appUserId = event.app_user_id as string; // Our internal user UUID
  const productId = event.product_id as string;
  const originalTransactionId = event.original_transaction_id as string | undefined;

  log.info({ eventType, appUserId, productId }, "RevenueCat webhook received");

  if (!appUserId) {
    log.warn({ eventType }, "Webhook missing app_user_id");
    return c.json({ status: "ok" });
  }

  const db = getDb();

  try {
    switch (eventType) {
      case "INITIAL_PURCHASE": {
        const tier = productIdToTier(productId);
        if (!tier) {
          log.warn({ productId }, "Unknown product ID for initial purchase");
          break;
        }
        await handleInitialPurchase(db, appUserId, tier, originalTransactionId);
        break;
      }

      case "RENEWAL": {
        await handleRenewal(db, appUserId);
        break;
      }

      case "CANCELLATION": {
        await handleCancellation(db, appUserId);
        break;
      }

      case "EXPIRATION": {
        await handleExpiration(db, appUserId);
        break;
      }

      case "BILLING_ISSUE_DETECTED": {
        await handleBillingIssue(db, appUserId);
        break;
      }

      case "NON_RENEWING_PURCHASE": {
        // Day Pass (consumable IAP)
        if (productId === "draftplay_daypass_24hr") {
          await handleDayPassPurchase(db, appUserId);
        }
        break;
      }

      default:
        log.debug({ eventType }, "Unhandled RevenueCat webhook event type");
    }
  } catch (err) {
    log.error({ eventType, appUserId, error: String(err) }, "RevenueCat webhook handler error");
  }

  return c.json({ status: "ok" });
});

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

async function handleInitialPurchase(
  db: any,
  userId: string,
  tier: SubscriptionTier,
  originalTransactionId?: string
): Promise<void> {
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setFullYear(periodEnd.getFullYear() + 1);

  const existing = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
  });

  if (existing) {
    // Update existing subscription
    if (existing.status === "active" && existing.tier === tier) {
      log.debug({ userId, tier }, "RevenueCat: subscription already active, skipping");
      return;
    }

    const fromTier = existing.tier;
    await db
      .update(subscriptions)
      .set({
        tier,
        status: "active",
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
        paymentProvider: "apple",
        purchasePlatform: "ios",
        appleOriginalTransactionId: originalTransactionId ?? null,
        updatedAt: now,
      })
      .where(eq(subscriptions.id, existing.id));

    await db.insert(subscriptionEvents).values({
      userId,
      subscriptionId: existing.id,
      event: fromTier !== tier ? "upgraded" : "created",
      fromTier,
      toTier: tier,
      metadata: { source: "revenuecat", provider: "apple", originalTransactionId },
    });
  } else {
    // Create new subscription
    const result = await db
      .insert(subscriptions)
      .values({
        userId,
        tier,
        status: "active",
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        billingCycle: "yearly",
        paymentProvider: "apple",
        purchasePlatform: "ios",
        appleOriginalTransactionId: originalTransactionId ?? null,
      })
      .returning({ id: subscriptions.id });

    await db.insert(subscriptionEvents).values({
      userId,
      subscriptionId: result[0]!.id,
      event: "created",
      fromTier: "basic",
      toTier: tier,
      metadata: { source: "revenuecat", provider: "apple", originalTransactionId },
    });
  }

  await invalidateUserTierCache(userId);
  log.info({ userId, tier, originalTransactionId }, "RevenueCat: subscription activated (Apple IAP)");
}

async function handleRenewal(db: any, userId: string): Promise<void> {
  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
  });

  if (!sub) {
    log.warn({ userId }, "RevenueCat: no subscription found for renewal");
    return;
  }

  const now = new Date();
  const newPeriodEnd = new Date(sub.currentPeriodEnd ?? now);
  newPeriodEnd.setFullYear(newPeriodEnd.getFullYear() + 1);

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
    userId,
    subscriptionId: sub.id,
    event: "renewed",
    fromTier: sub.tier,
    toTier: sub.tier,
    metadata: { source: "revenuecat", newPeriodEnd: newPeriodEnd.toISOString() },
  });

  await invalidateUserTierCache(userId);
  log.info({ userId }, "RevenueCat: subscription renewed");
}

async function handleCancellation(db: any, userId: string): Promise<void> {
  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
  });

  if (!sub || sub.status === "cancelled" || sub.status === "expired") return;

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
    metadata: { source: "revenuecat", cancelAtPeriodEnd: true },
  });

  await invalidateUserTierCache(userId);
  log.info({ userId }, "RevenueCat: subscription set to cancel at period end");
}

async function handleExpiration(db: any, userId: string): Promise<void> {
  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
  });

  if (!sub || sub.status === "expired") return;

  await db
    .update(subscriptions)
    .set({ status: "expired", cancelAtPeriodEnd: false, updatedAt: new Date() })
    .where(eq(subscriptions.id, sub.id));

  await db.insert(subscriptionEvents).values({
    userId,
    subscriptionId: sub.id,
    event: "expired",
    fromTier: sub.tier,
    toTier: sub.tier,
    metadata: { source: "revenuecat" },
  });

  await invalidateUserTierCache(userId);
  log.info({ userId }, "RevenueCat: subscription expired");
}

async function handleBillingIssue(db: any, userId: string): Promise<void> {
  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
  });

  if (!sub) return;

  await db
    .update(subscriptions)
    .set({ status: "past_due", updatedAt: new Date() })
    .where(eq(subscriptions.id, sub.id));

  await db.insert(subscriptionEvents).values({
    userId,
    subscriptionId: sub.id,
    event: "payment_failed",
    fromTier: sub.tier,
    toTier: sub.tier,
    metadata: { source: "revenuecat" },
  });

  await invalidateUserTierCache(userId);
  log.info({ userId }, "RevenueCat: billing issue detected");
}

async function handleDayPassPurchase(db: any, userId: string): Promise<void> {
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setHours(expiresAt.getHours() + DAY_PASS_CONFIG.durationHours);

  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
  });

  if (!sub) {
    log.warn({ userId }, "RevenueCat: no subscription found for Day Pass activation");
    return;
  }

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
    metadata: { source: "revenuecat", provider: "apple", dayPassExpiresAt: expiresAt.toISOString() },
  });

  await invalidateUserTierCache(userId);
  log.info({ userId, dayPassExpiresAt: expiresAt.toISOString() }, "RevenueCat: Day Pass activated (Apple IAP)");
}
