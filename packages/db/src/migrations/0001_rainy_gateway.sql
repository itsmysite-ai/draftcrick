CREATE TABLE "data_refresh_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"sport" text DEFAULT 'cricket' NOT NULL,
	"trigger" text NOT NULL,
	"triggered_by_user_id" uuid,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"duration_ms" integer,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"error_message" text,
	"records_upserted" integer DEFAULT 0,
	"records_unchanged" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tournaments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" text NOT NULL,
	"name" text NOT NULL,
	"short_name" text,
	"sport" text DEFAULT 'cricket' NOT NULL,
	"format" text,
	"status" text DEFAULT 'upcoming' NOT NULL,
	"start_date" date,
	"end_date" date,
	"country" text,
	"teams" jsonb,
	"venue_info" jsonb,
	"category" text,
	"last_refreshed_at" timestamp with time zone,
	"refresh_source" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "matches" ALTER COLUMN "tournament_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "match_phase" text DEFAULT 'idle' NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "last_refreshed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "next_refresh_after" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "refresh_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_refresh_log_entity" ON "data_refresh_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_refresh_log_sport_status" ON "data_refresh_log" USING btree ("sport","status");--> statement-breakpoint
CREATE INDEX "idx_refresh_log_created" ON "data_refresh_log" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_tournaments_external_id_sport" ON "tournaments" USING btree ("external_id","sport");--> statement-breakpoint
CREATE INDEX "idx_tournaments_sport_status" ON "tournaments" USING btree ("sport","status");--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_matches_tournament" ON "matches" USING btree ("tournament_id");--> statement-breakpoint
CREATE INDEX "idx_matches_phase" ON "matches" USING btree ("match_phase");--> statement-breakpoint
CREATE INDEX "idx_matches_next_refresh" ON "matches" USING btree ("next_refresh_after");