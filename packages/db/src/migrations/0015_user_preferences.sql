-- Add preferences JSONB column to users table
-- This column was in the Drizzle schema but missing from prior migrations
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences jsonb;
