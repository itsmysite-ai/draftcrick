-- Cricket Manager — add toss call column to entries
-- Spec: /docs/CRICKET_MANAGER_DRAFT.md §2 (toss)
-- Idempotent: safe to re-run.

ALTER TABLE "cm_entries"
  ADD COLUMN IF NOT EXISTS "toss" text NOT NULL DEFAULT 'bat_first';
