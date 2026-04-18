-- League Prizes — free-form influencer-style rewards
-- Announced by platform admin on behalf of the influencer who owns
-- the league. Goods / services / experiences only (no cash). Editable
-- at any time by platform admins.
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS "league_prizes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "league_id" uuid NOT NULL REFERENCES "leagues"("id") ON DELETE CASCADE,
  "rank_from" integer NOT NULL,
  "rank_to" integer NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "image_url" text,
  "display_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT NOW(),
  "updated_at" timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_league_prizes_league"
  ON "league_prizes" ("league_id", "display_order");
