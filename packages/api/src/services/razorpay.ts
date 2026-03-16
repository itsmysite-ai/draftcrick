/**
 * Razorpay Service — payment gateway abstraction with stub/live mode toggle.
 *
 * Payment mode is stored in admin_config ("payment_mode" key).
 * Falls back to "stub" if Razorpay env vars are missing, regardless of admin setting.
 *
 * Stub mode: subscriptions activate immediately (no real payment).
 * Live mode: creates Razorpay subscription, returns checkout URL, activates on webhook.
 */

import crypto from "crypto";
import Razorpay from "razorpay";
import { eq } from "drizzle-orm";
import type { Database } from "@draftplay/db";
import { subscriptions } from "@draftplay/db";
import type { SubscriptionTier } from "@draftplay/shared";
import { getAdminConfig, setAdminConfig } from "./admin-config";
import { getLogger } from "../lib/logger";

const log = getLogger("razorpay");

// ---------------------------------------------------------------------------
// Razorpay SDK singleton
// ---------------------------------------------------------------------------

let razorpayInstance: Razorpay | null = null;

function getRazorpay(): Razorpay {
  if (!razorpayInstance) {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      throw new Error("Razorpay credentials not configured");
    }
    razorpayInstance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return razorpayInstance;
}

// ---------------------------------------------------------------------------
// Configuration helpers
// ---------------------------------------------------------------------------

/** Check if Razorpay env vars (key_id + key_secret) are present. */
export function isRazorpayConfigured(): boolean {
  return !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

/**
 * Get effective payment mode. Double-guarded:
 * - Returns "stub" if env vars are missing (regardless of admin setting)
 * - Returns admin_config "payment_mode" value otherwise
 */
export async function getPaymentMode(): Promise<"stub" | "live"> {
  if (!isRazorpayConfigured()) return "stub";
  const mode = await getAdminConfig<string>("payment_mode");
  return mode === "live" ? "live" : "stub";
}

/**
 * Admin: set payment mode. Blocks switching to "live" if env vars are missing.
 */
export async function setPaymentMode(
  mode: "stub" | "live",
  adminUserId: string
): Promise<void> {
  if (mode === "live" && !isRazorpayConfigured()) {
    throw new Error("Cannot enable live mode: Razorpay credentials not configured");
  }
  await setAdminConfig("payment_mode", mode, "Payment processing mode (stub/live)", adminUserId);
  log.info({ mode, adminUserId }, "Payment mode updated");
}

/** Get Razorpay plan ID for a subscription tier (yearly plans). */
function getPlanId(tier: SubscriptionTier): string {
  if (tier === "basic") {
    const planId = process.env.RAZORPAY_PLAN_BASIC;
    if (!planId) throw new Error("RAZORPAY_PLAN_BASIC env var not set");
    return planId;
  }
  if (tier === "pro") {
    const planId = process.env.RAZORPAY_PLAN_PRO;
    if (!planId) throw new Error("RAZORPAY_PLAN_PRO env var not set");
    return planId;
  }
  if (tier === "elite") {
    const planId = process.env.RAZORPAY_PLAN_ELITE;
    if (!planId) throw new Error("RAZORPAY_PLAN_ELITE env var not set");
    return planId;
  }
  throw new Error(`No Razorpay plan for tier: ${tier}`);
}

// ---------------------------------------------------------------------------
// Customer management
// ---------------------------------------------------------------------------

/**
 * Get or create a Razorpay customer for a user.
 * Stores the razorpayCustomerId on the subscription record.
 */
export async function getOrCreateRazorpayCustomer(
  db: Database,
  userId: string,
  email: string | null
): Promise<string> {
  // Check if user already has a Razorpay customer ID
  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
  });

  if (sub?.razorpayCustomerId) {
    return sub.razorpayCustomerId;
  }

  // Create customer in Razorpay
  const rz = getRazorpay();
  const customer = await rz.customers.create({
    name: `User ${userId.slice(0, 8)}`,
    email: email ?? undefined,
    fail_existing: 0, // return existing if found
    notes: { draftplay_user_id: userId },
  });

  log.info({ userId, razorpayCustomerId: customer.id }, "Razorpay customer created");
  return customer.id;
}

// ---------------------------------------------------------------------------
// Subscription management
// ---------------------------------------------------------------------------

/**
 * Create a Razorpay subscription (live mode only).
 * Returns the subscription ID and checkout URL (short_url).
 */
export async function createRazorpaySubscription(
  db: Database,
  userId: string,
  tier: SubscriptionTier,
  email: string | null
): Promise<{ razorpaySubscriptionId: string; shortUrl: string }> {
  const rz = getRazorpay();
  const customerId = await getOrCreateRazorpayCustomer(db, userId, email);
  const planId = getPlanId(tier);

  const rpSub = await rz.subscriptions.create({
    plan_id: planId,
    total_count: 10, // 10 yearly cycles (auto-renew)
    customer_notify: 1,
    notes: {
      draftplay_user_id: userId,
      tier,
      billing_cycle: "yearly",
    },
  });

  // Store the customer ID on the subscription record
  const existingSub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
  });
  if (existingSub) {
    await db
      .update(subscriptions)
      .set({ razorpayCustomerId: customerId, updatedAt: new Date() })
      .where(eq(subscriptions.id, existingSub.id));
  }

  log.info(
    { userId, tier, razorpaySubscriptionId: rpSub.id },
    "Razorpay subscription created"
  );

  return {
    razorpaySubscriptionId: rpSub.id,
    shortUrl: rpSub.short_url,
  };
}

/**
 * Create a Razorpay order for Day Pass (one-time payment, not subscription).
 * Returns the order ID for checkout.
 */
export async function createDayPassOrder(
  db: Database,
  userId: string,
  email: string | null
): Promise<{ orderId: string; checkoutUrl: string }> {
  const { DAY_PASS_CONFIG } = await import("@draftplay/shared");
  const rz = getRazorpay();

  const order = await rz.orders.create({
    amount: DAY_PASS_CONFIG.priceINR, // paise
    currency: "INR",
    receipt: `daypass_${userId.slice(0, 8)}_${Date.now()}`,
    notes: {
      draftplay_user_id: userId,
      type: "day_pass",
      duration_hours: String(DAY_PASS_CONFIG.durationHours),
    },
  });

  log.info({ userId, orderId: order.id }, "Day Pass Razorpay order created");

  return {
    orderId: order.id,
    checkoutUrl: order.short_url ?? "",
  };
}

/**
 * Cancel a Razorpay subscription at cycle end.
 */
export async function cancelRazorpaySubscription(
  razorpaySubscriptionId: string
): Promise<void> {
  const rz = getRazorpay();
  await rz.subscriptions.cancel(razorpaySubscriptionId, true); // cancel at cycle end
  log.info({ razorpaySubscriptionId }, "Razorpay subscription cancelled");
}

// ---------------------------------------------------------------------------
// Webhook signature verification
// ---------------------------------------------------------------------------

/**
 * Verify Razorpay webhook HMAC-SHA256 signature.
 */
export function verifyWebhookSignature(body: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    log.warn("RAZORPAY_WEBHOOK_SECRET not set — rejecting webhook");
    return false;
  }

  try {
    const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
    return crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(signature, "hex")
    );
  } catch {
    return false;
  }
}
