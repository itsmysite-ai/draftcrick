-- Add team column to player_match_scores (was missing from initial migrations)
ALTER TABLE player_match_scores ADD COLUMN IF NOT EXISTS team text;
