-- Migration: Add multi-provider payment support (Razorpay + Apple IAP via RevenueCat)
-- Supports hybrid payment model: Razorpay for Android/Web, Apple IAP for iOS

ALTER TABLE subscriptions ADD COLUMN payment_provider TEXT NOT NULL DEFAULT 'razorpay';
ALTER TABLE subscriptions ADD COLUMN revenuecat_customer_id TEXT;
ALTER TABLE subscriptions ADD COLUMN apple_original_transaction_id TEXT;
ALTER TABLE subscriptions ADD COLUMN purchase_platform TEXT;

CREATE INDEX idx_subscriptions_provider ON subscriptions(payment_provider);
