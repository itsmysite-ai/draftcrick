-- Migration: Switch from free/pro/elite (monthly) to basic/pro/elite (yearly) + Day Pass
-- Part of subscription pricing overhaul

-- 1. Rename "free" tier to "basic" in subscriptions
UPDATE subscriptions SET tier = 'basic' WHERE tier = 'free';

-- 2. Rename in subscription events audit log
UPDATE subscription_events SET from_tier = 'basic' WHERE from_tier = 'free';
UPDATE subscription_events SET to_tier = 'basic' WHERE to_tier = 'free';

-- 3. Add new columns for yearly billing + Day Pass
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS billing_cycle text NOT NULL DEFAULT 'yearly';
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'INR';
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS price_usd_cents integer;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS day_pass_active boolean NOT NULL DEFAULT false;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS day_pass_expires_at timestamptz;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS day_pass_razorpay_payment_id text;

-- 4. Index for efficient Day Pass expiry queries
CREATE INDEX IF NOT EXISTS idx_subscriptions_daypass ON subscriptions (day_pass_active, day_pass_expires_at);
