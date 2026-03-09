-- Multi-sport support: add sport column to players and sport_stats to player_match_scores

-- Players: add sport column (defaults to 'cricket' for all existing rows)
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "sport" text NOT NULL DEFAULT 'cricket';

-- Player match scores: add sport column and sport_stats JSONB
ALTER TABLE "player_match_scores" ADD COLUMN IF NOT EXISTS "sport" text NOT NULL DEFAULT 'cricket';
ALTER TABLE "player_match_scores" ADD COLUMN IF NOT EXISTS "sport_stats" jsonb DEFAULT '{}';

-- Index for filtering players by sport
CREATE INDEX IF NOT EXISTS "idx_players_sport" ON "players" ("sport");

-- Index for filtering match scores by sport
CREATE INDEX IF NOT EXISTS "idx_pms_sport" ON "player_match_scores" ("sport");
