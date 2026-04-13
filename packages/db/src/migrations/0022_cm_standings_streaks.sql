-- Cricket Manager — extend league standings with streak + aggregate columns
-- Enables #10 (season standings depth), #12 (win metric fix needs losses counter),
-- and the "season champion" / "unbeaten" awards.
-- Idempotent: safe to re-run.

ALTER TABLE "cm_league_standings"
  ADD COLUMN IF NOT EXISTS "losses" integer NOT NULL DEFAULT 0;

ALTER TABLE "cm_league_standings"
  ADD COLUMN IF NOT EXISTS "worst_nrr" numeric(8,4);

ALTER TABLE "cm_league_standings"
  ADD COLUMN IF NOT EXISTS "avg_nrr" numeric(8,4);

ALTER TABLE "cm_league_standings"
  ADD COLUMN IF NOT EXISTS "current_win_streak" integer NOT NULL DEFAULT 0;

ALTER TABLE "cm_league_standings"
  ADD COLUMN IF NOT EXISTS "best_win_streak" integer NOT NULL DEFAULT 0;
