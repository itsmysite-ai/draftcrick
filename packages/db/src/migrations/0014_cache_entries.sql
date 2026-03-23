-- Cache entries table: replaces Redis hot cache with PostgreSQL
-- Expired rows cleaned up via pg_cron (or application-level piggyback cleanup)

CREATE TABLE IF NOT EXISTS cache_entries (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_cache_entries_expires ON cache_entries (expires_at);

-- Optional: enable pg_cron for automatic cleanup (Cloud SQL supports this)
-- Run once manually after enabling the pg_cron extension:
--
--   CREATE EXTENSION IF NOT EXISTS pg_cron;
--   SELECT cron.schedule(
--     'cleanup-expired-cache',
--     '*/5 * * * *',
--     $$DELETE FROM cache_entries WHERE expires_at < NOW()$$
--   );
