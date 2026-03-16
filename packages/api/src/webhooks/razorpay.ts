/**
 * Razorpay Webhook Handler — raw Hono route (not tRPC).
 *
 * Handles Razorpay subscription lifecycle events:
 * - subscription.activated → activate subscription
 * - subscription.charged → renew subscription period
 * - subscription.cancelled / completed → cancel subscription
 * - payment.failed → mark as past_due
 *
 * Authenticates via HMAC-SHA256 signature (x-razorpay-signature header).
 * Returns 200 for all processed events (even on errors) to prevent Razorpay retries.
 */

import { Hono } from "hono";
import { getDb } from "@draftplay/db";
import { verifyWebhookSignature } from "../services/razorpay";
import {
  activateSubscriptionFromWebhook,
  renewSubscription,
  handlePaymentFailed,
  handleExternalCancellation,
  activateDayPassFromWebhook,
} from "../services/subscription";
import { getLogger } from "../lib/logger";

const log = getLogger("webhook-razorpay");

export const razorpayWebhook = new Hono();

razorpayWebhook.post("/", async (c) => {
  const body = await c.req.text();
  const signature = c.req.header("x-razorpay-signature") ?? "";

  // Verify HMAC signature
  if (!verifyWebhookSignature(body, signature)) {
    log.warn("Invalid webhook signature");
    return c.json({ error: "Invalid signature" }, 401);
  }

  let payload: any;
  try {
    payload = JSON.parse(body);
  } catch {
    log.warn("Invalid JSON in webhook body");
    return c.json({ error: "Invalid JSON" }, 400);
  }

  const event = payload.event as string;
  const eventId = payload.event_id as string | undefined;

  log.info({ event, eventId }, "Razorpay webhook received");

  const db = getDb();

  try {
    switch (event) {
      case "subscription.activated": {
        const rpSubId = payload.payload?.subscription?.entity?.id;
        if (rpSubId) {
          await activateSubscriptionFromWebhook(db, rpSubId, eventId);
        }
        break;
      }

      case "subscription.charged": {
        const rpSubId = payload.payload?.subscription?.entity?.id;
        if (rpSubId) {
          // First charge activates, subsequent charges renew
          await renewSubscription(db, rpSubId, eventId);
        }
        break;
      }

      case "subscription.cancelled":
      case "subscription.completed": {
        const rpSubId = payload.payload?.subscription?.entity?.id;
        if (rpSubId) {
          await handleExternalCancellation(db, rpSubId, eventId);
        }
        break;
      }

      case "payment.captured": {
        // Day Pass one-time payments
        const payment = payload.payload?.payment?.entity;
        const notes = payment?.notes;
        if (notes?.type === "day_pass" && notes?.draftplay_user_id) {
          await activateDayPassFromWebhook(db, notes.draftplay_user_id, payment.id);
        }
        break;
      }

      case "payment.failed": {
        const rpSubId =
          payload.payload?.payment?.entity?.subscription_id ??
          payload.payload?.subscription?.entity?.id;
        if (rpSubId) {
          await handlePaymentFailed(db, rpSubId, eventId);
        }
        break;
      }

      default:
        log.debug({ event }, "Unhandled webhook event type");
    }
  } catch (err) {
    log.error({ event, eventId, error: String(err) }, "Webhook handler error");
    // Still return 200 to prevent Razorpay retries for processing errors
  }

  return c.json({ status: "ok" });
});
