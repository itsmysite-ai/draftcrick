-- pg_cron cleanup jobs
-- Prerequisites: cloudsql.enable_pg_cron flag must be enabled on Cloud SQL instance
-- Run this migration from the 'postgres' database, not 'draftplay'
--   psql postgres_url -f 0019_pg_cron_cleanup.sql

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove existing jobs (idempotent)
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname IN ('cleanup-expired-cache', 'cleanup-old-chat', 'cleanup-orphan-flags');

-- Cache cleanup — every 5 minutes
SELECT cron.schedule('cleanup-expired-cache', '*/5 * * * *', $$DELETE FROM draftplay.public.cache_entries WHERE expires_at < NOW()$$);

-- Chat message cleanup — every hour (24h retention)
SELECT cron.schedule('cleanup-old-chat', '0 * * * *', $$DELETE FROM draftplay.public.chat_messages WHERE created_at < NOW() - INTERVAL '24 hours'$$);

-- Orphan flag cleanup — every hour
SELECT cron.schedule('cleanup-orphan-flags', '0 * * * *', $$DELETE FROM draftplay.public.chat_flags WHERE message_id NOT IN (SELECT id FROM draftplay.public.chat_messages)$$);
