import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  decimal,
  boolean,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";

/**
 * Subscriptions table — one active subscription per user.
 * Completely separate from wallets/transactions (contest money).
 * Subscription money is SaaS revenue (PROGA-safe).
 */
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id)
      .unique(),
    tier: text("tier").notNull().default("free"), // free, pro, elite
    status: text("status").notNull().default("active"), // active, cancelled, expired, past_due
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true })
      .notNull()
      .defaultNow(),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }), // null for free tier
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    razorpaySubscriptionId: text("razorpay_subscription_id"),
    razorpayCustomerId: text("razorpay_customer_id"),
    priceInPaise: decimal("price_in_paise", { precision: 10, scale: 0 }), // actual price paid (after discount)
    promoCodeId: uuid("promo_code_id"), // FK to promo_codes if a code was applied
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_subscriptions_user").on(table.userId),
    index("idx_subscriptions_status").on(table.status),
  ]
);

/**
 * Subscription events — audit log of all subscription lifecycle changes.
 * Every create, upgrade, downgrade, cancel, renewal, expiration is logged.
 */
export const subscriptionEvents = pgTable(
  "subscription_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    subscriptionId: uuid("subscription_id").references(() => subscriptions.id),
    event: text("event").notNull(), // created, upgraded, downgraded, cancelled, renewed, expired, payment_failed, payment_succeeded, promo_applied
    fromTier: text("from_tier"),
    toTier: text("to_tier"),
    metadata: jsonb("metadata"), // payment details, promo code info, etc.
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_sub_events_user").on(table.userId),
    index("idx_sub_events_sub").on(table.subscriptionId),
  ]
);

/**
 * Promo codes — for influencer deals, discount campaigns, and user-redeemable codes.
 * Admin creates codes in the portal, users redeem during subscription checkout.
 */
export const promoCodes = pgTable(
  "promo_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(), // e.g. "CRICKGURU50", "VIRAT20"
    description: text("description"), // "50% off first month via CricketGuru YouTube"
    discountType: text("discount_type").notNull().default("percentage"), // percentage, fixed_amount, free_trial
    discountValue: integer("discount_value").notNull(), // 50 (= 50% off) or 5000 (= ₹50 off in paise)
    applicableTiers: jsonb("applicable_tiers").notNull().default(["pro", "elite"]), // which tiers this code works for
    maxRedemptions: integer("max_redemptions"), // null = unlimited
    currentRedemptions: integer("current_redemptions").notNull().default(0),
    maxPerUser: integer("max_per_user").notNull().default(1), // how many times one user can use it
    validFrom: timestamp("valid_from", { withTimezone: true }).notNull().defaultNow(),
    validUntil: timestamp("valid_until", { withTimezone: true }), // null = no expiry
    durationMonths: integer("duration_months").notNull().default(1), // how many months the discount lasts
    influencerName: text("influencer_name"), // "CricketGuru", "ViratFan" — null for generic codes
    influencerCommission: integer("influencer_commission"), // paise per redemption (e.g. 2000 = ₹20)
    isActive: boolean("is_active").notNull().default(true),
    createdBy: uuid("created_by"), // admin user ID
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_promo_code_unique").on(table.code),
    index("idx_promo_active").on(table.isActive),
  ]
);

/**
 * Promo code redemptions — tracks which user redeemed which code and when.
 */
export const promoRedemptions = pgTable(
  "promo_redemptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    promoCodeId: uuid("promo_code_id")
      .notNull()
      .references(() => promoCodes.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    subscriptionId: uuid("subscription_id").references(() => subscriptions.id),
    discountAppliedPaise: integer("discount_applied_paise").notNull(), // actual discount amount
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_promo_redemptions_user").on(table.userId),
    index("idx_promo_redemptions_code").on(table.promoCodeId),
  ]
);

// Relations
export const subscriptionsRelations = relations(subscriptions, ({ one, many }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id],
  }),
  events: many(subscriptionEvents),
}));

export const subscriptionEventsRelations = relations(subscriptionEvents, ({ one }) => ({
  user: one(users, {
    fields: [subscriptionEvents.userId],
    references: [users.id],
  }),
  subscription: one(subscriptions, {
    fields: [subscriptionEvents.subscriptionId],
    references: [subscriptions.id],
  }),
}));

export const promoCodesRelations = relations(promoCodes, ({ many }) => ({
  redemptions: many(promoRedemptions),
}));

export const promoRedemptionsRelations = relations(promoRedemptions, ({ one }) => ({
  promoCode: one(promoCodes, {
    fields: [promoRedemptions.promoCodeId],
    references: [promoCodes.id],
  }),
  user: one(users, {
    fields: [promoRedemptions.userId],
    references: [users.id],
  }),
  subscription: one(subscriptions, {
    fields: [promoRedemptions.subscriptionId],
    references: [subscriptions.id],
  }),
}));
