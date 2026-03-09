-- Compliance: age confirmation, terms acceptance, soft delete
ALTER TABLE "users" ADD COLUMN "age_confirmed" boolean NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "terms_accepted_at" timestamp with time zone;
ALTER TABLE "users" ADD COLUMN "deleted_at" timestamp with time zone;

CREATE INDEX IF NOT EXISTS "idx_users_deleted_at" ON "users" ("deleted_at");
