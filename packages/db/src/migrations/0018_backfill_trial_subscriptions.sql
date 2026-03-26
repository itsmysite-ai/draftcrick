-- Backfill trial subscriptions for existing users who don't have one
-- This ensures all users have a subscription record (basic trial, 7 days)
INSERT INTO subscriptions (user_id, tier, status, trial_ends_at, current_period_start, current_period_end)
SELECT u.id, 'basic', 'trialing', NOW() + INTERVAL '7 days', NOW(), NOW() + INTERVAL '7 days'
FROM users u
LEFT JOIN subscriptions s ON s.user_id = u.id
WHERE s.id IS NULL
ON CONFLICT DO NOTHING;
