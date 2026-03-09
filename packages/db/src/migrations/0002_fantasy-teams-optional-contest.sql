CREATE TABLE "notification_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"deadlines" boolean DEFAULT true NOT NULL,
	"scores" boolean DEFAULT true NOT NULL,
	"status_alerts" boolean DEFAULT true NOT NULL,
	"rank_changes" boolean DEFAULT true NOT NULL,
	"promotions" boolean DEFAULT false NOT NULL,
	"quiet_hours_start" text,
	"quiet_hours_end" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_device_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"platform" text NOT NULL,
	"device_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fantasy_teams" DROP CONSTRAINT "uq_user_contest";--> statement-breakpoint
ALTER TABLE "fantasy_teams" ALTER COLUMN "contest_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "standings" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "fantasy_teams" ADD COLUMN "match_id" text;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_device_tokens" ADD CONSTRAINT "push_device_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_push_tokens_user" ON "push_device_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_push_tokens_token" ON "push_device_tokens" USING btree ("token");--> statement-breakpoint
ALTER TABLE "fantasy_teams" ADD CONSTRAINT "uq_user_contest" UNIQUE("user_id","contest_id","match_id");