-- pg_cron cleanup jobs
-- Prerequisites: cloudsql.enable_pg_cron flag must be enabled on Cloud SQL instance
-- Run this migration from the 'postgres' database, not 'draftplay'
--   psql postgres_url -f 0019_pg_cron_cleanup.sql
--
-- Uses cron.schedule_in_database() to run queries inside the 'draftplay' database
-- (Cloud SQL does not support cross-database references like draftplay.public.*)

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove existing jobs (idempotent)
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname IN ('cleanup-expired-cache', 'cleanup-old-chat', 'cleanup-orphan-flags');

-- Cache cleanup — every 5 minutes
SELECT cron.schedule_in_database('cleanup-expired-cache', '*/5 * * * *', $$DELETE FROM cache_entries WHERE expires_at < NOW()$$, 'draftplay');

-- Chat message cleanup — every hour (24h retention)
SELECT cron.schedule_in_database('cleanup-old-chat', '0 * * * *', $$DELETE FROM chat_messages WHERE created_at < NOW() - INTERVAL '24 hours'$$, 'draftplay');

-- Orphan flag cleanup — every hour
SELECT cron.schedule_in_database('cleanup-orphan-flags', '0 * * * *', $$DELETE FROM chat_flags WHERE message_id NOT IN (SELECT id FROM chat_messages)$$, 'draftplay');
