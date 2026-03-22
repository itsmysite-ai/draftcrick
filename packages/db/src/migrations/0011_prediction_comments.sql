CREATE TABLE IF NOT EXISTS "live_prediction_comments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "prediction_id" uuid NOT NULL REFERENCES "live_predictions"("id"),
  "user_id" uuid REFERENCES "users"("id"),
  "is_system" boolean NOT NULL DEFAULT false,
  "message" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_live_prediction_comments_pred" ON "live_prediction_comments" ("prediction_id");
