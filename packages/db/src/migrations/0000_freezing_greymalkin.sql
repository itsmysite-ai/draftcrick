CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"contest_id" uuid,
	"gateway" text,
	"gateway_ref" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"favorite_team" text,
	"bio" text,
	"win_count" integer DEFAULT 0 NOT NULL,
	"contest_count" integer DEFAULT 0 NOT NULL,
	"prediction_streak" integer DEFAULT 0 NOT NULL,
	"badges" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"referral_code" text NOT NULL,
	"referred_by" uuid,
	"login_streak" integer DEFAULT 0 NOT NULL,
	"last_login_date" date,
	CONSTRAINT "user_profiles_referral_code_unique" UNIQUE("referral_code")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firebase_uid" text NOT NULL,
	"email" text,
	"phone" text,
	"username" text NOT NULL,
	"display_name" text NOT NULL,
	"avatar_url" text,
	"role" text DEFAULT 'user' NOT NULL,
	"kyc_status" text DEFAULT 'pending' NOT NULL,
	"preferred_lang" text DEFAULT 'en' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_firebase_uid_unique" UNIQUE("firebase_uid"),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_phone_unique" UNIQUE("phone"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"cash_balance" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"bonus_balance" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"total_deposited" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"total_withdrawn" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"total_winnings" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" text NOT NULL,
	"sport" text DEFAULT 'cricket' NOT NULL,
	"format" text NOT NULL,
	"tournament" text NOT NULL,
	"team_home" text NOT NULL,
	"team_away" text NOT NULL,
	"venue" text NOT NULL,
	"city" text,
	"start_time" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'upcoming' NOT NULL,
	"toss_winner" text,
	"toss_decision" text,
	"playing_xi_home" jsonb,
	"playing_xi_away" jsonb,
	"result" text,
	"draft_enabled" boolean DEFAULT false,
	"tournament_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "matches_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE TABLE "player_match_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"match_id" uuid NOT NULL,
	"runs" integer DEFAULT 0 NOT NULL,
	"balls_faced" integer DEFAULT 0 NOT NULL,
	"fours" integer DEFAULT 0 NOT NULL,
	"sixes" integer DEFAULT 0 NOT NULL,
	"wickets" integer DEFAULT 0 NOT NULL,
	"overs_bowled" numeric(4, 1) DEFAULT '0' NOT NULL,
	"runs_conceded" integer DEFAULT 0 NOT NULL,
	"maidens" integer DEFAULT 0 NOT NULL,
	"catches" integer DEFAULT 0 NOT NULL,
	"stumpings" integer DEFAULT 0 NOT NULL,
	"run_outs" integer DEFAULT 0 NOT NULL,
	"fantasy_points" numeric(8, 2) DEFAULT '0' NOT NULL,
	"is_playing" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_player_match" UNIQUE("player_id","match_id")
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" text NOT NULL,
	"name" text NOT NULL,
	"team" text NOT NULL,
	"role" text NOT NULL,
	"photo_url" text,
	"nationality" text,
	"batting_style" text,
	"bowling_style" text,
	"stats" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "players_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE TABLE "contests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"league_id" uuid,
	"match_id" uuid NOT NULL,
	"name" text NOT NULL,
	"entry_fee" numeric(10, 2) DEFAULT '0' NOT NULL,
	"prize_pool" numeric(12, 2) DEFAULT '0' NOT NULL,
	"max_entries" integer NOT NULL,
	"current_entries" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"prize_distribution" jsonb NOT NULL,
	"contest_type" text DEFAULT 'public' NOT NULL,
	"is_guaranteed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fantasy_teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"contest_id" uuid NOT NULL,
	"players" jsonb NOT NULL,
	"captain_id" uuid NOT NULL,
	"vice_captain_id" uuid NOT NULL,
	"total_points" numeric(8, 2) DEFAULT '0' NOT NULL,
	"rank" integer,
	"credits_used" numeric(6, 1),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_user_contest" UNIQUE("user_id","contest_id")
);
--> statement-breakpoint
CREATE TABLE "league_members" (
	"league_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pk_league_member" UNIQUE("league_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "leagues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"owner_id" uuid NOT NULL,
	"format" text NOT NULL,
	"sport" text DEFAULT 'cricket' NOT NULL,
	"tournament" text NOT NULL,
	"season" text,
	"is_private" boolean DEFAULT true NOT NULL,
	"invite_code" text,
	"max_members" integer DEFAULT 10 NOT NULL,
	"rules" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"template" text DEFAULT 'casual' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leagues_invite_code_unique" UNIQUE("invite_code")
);
--> statement-breakpoint
CREATE TABLE "draft_picks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"pick_number" integer NOT NULL,
	"round" integer NOT NULL,
	"bid_amount" numeric(10, 2),
	"picked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "draft_rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"league_id" uuid NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'waiting' NOT NULL,
	"current_turn" integer DEFAULT 0 NOT NULL,
	"current_round" integer DEFAULT 1 NOT NULL,
	"pick_order" jsonb NOT NULL,
	"time_per_pick" integer DEFAULT 60 NOT NULL,
	"current_pick_deadline" timestamp with time zone,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"league_id" uuid NOT NULL,
	"from_user_id" uuid NOT NULL,
	"to_user_id" uuid NOT NULL,
	"players_offered" jsonb NOT NULL,
	"players_requested" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prediction_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid,
	"user_id" uuid,
	"league_id" uuid,
	"answer" text NOT NULL,
	"is_correct" boolean,
	"points_awarded" integer DEFAULT 0,
	"submitted_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "uq_prediction_answer" UNIQUE("question_id","user_id","league_id")
);
--> statement-breakpoint
CREATE TABLE "prediction_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" text NOT NULL,
	"tournament_id" text NOT NULL,
	"question_text" text NOT NULL,
	"question_type" text NOT NULL,
	"options" jsonb NOT NULL,
	"correct_answer" text,
	"difficulty" text DEFAULT 'medium',
	"points_value" integer DEFAULT 10,
	"bonus_for_exact" boolean DEFAULT false,
	"deadline_type" text DEFAULT 'match_start',
	"custom_deadline" timestamp with time zone,
	"generated_by" text DEFAULT 'admin',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "prediction_standings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"league_id" uuid,
	"user_id" uuid,
	"tournament_id" text NOT NULL,
	"total_points" integer DEFAULT 0,
	"correct_predictions" integer DEFAULT 0,
	"total_predictions" integer DEFAULT 0,
	"accuracy_pct" numeric(5, 2) DEFAULT '0',
	"current_streak" integer DEFAULT 0,
	"best_streak" integer DEFAULT 0,
	CONSTRAINT "uq_prediction_standing" UNIQUE("league_id","user_id","tournament_id")
);
--> statement-breakpoint
CREATE TABLE "predictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"match_id" uuid NOT NULL,
	"prediction_type" text NOT NULL,
	"prediction_value" text NOT NULL,
	"is_correct" boolean,
	"points_earned" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_user_match_prediction" UNIQUE("user_id","match_id","prediction_type")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"data" jsonb,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referrals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"referrer_id" uuid NOT NULL,
	"referee_id" uuid NOT NULL,
	"bonus_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tournament_leagues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"league_id" uuid,
	"tournament_id" text NOT NULL,
	"mode" text NOT NULL,
	"status" text DEFAULT 'setup' NOT NULL,
	"total_trades_allowed" integer DEFAULT 30,
	"free_trades" integer DEFAULT 30,
	"penalty_per_extra_trade" numeric(10, 2) DEFAULT '0',
	"trade_reset_before_playoffs" boolean DEFAULT false,
	"playoff_trades_allowed" integer DEFAULT 10,
	"team_lock_minutes_before_match" integer DEFAULT 0,
	"player_drop_lock_hours" integer DEFAULT 24,
	"captain_lock_time" text DEFAULT 'match_start',
	"opponent_team_visibility" text DEFAULT 'after_match_start',
	"playoff_format" text,
	"playoff_teams" integer DEFAULT 4,
	"exclude_playoff_matches" boolean DEFAULT false,
	"chips_enabled" boolean DEFAULT true,
	"wildcards_per_tournament" integer DEFAULT 2,
	"triple_captain_count" integer DEFAULT 1,
	"bench_boost_count" integer DEFAULT 1,
	"free_hit_count" integer DEFAULT 1,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "advance_team_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_league_id" uuid,
	"user_id" uuid,
	"match_id" text NOT NULL,
	"squad" jsonb NOT NULL,
	"playing_xi" jsonb NOT NULL,
	"captain_id" text NOT NULL,
	"vice_captain_id" text NOT NULL,
	"queued_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "uq_advance_queue_user_match" UNIQUE("tournament_league_id","user_id","match_id")
);
--> statement-breakpoint
CREATE TABLE "tournament_team_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_league_id" uuid,
	"user_id" uuid,
	"match_id" text NOT NULL,
	"squad" jsonb NOT NULL,
	"playing_xi" jsonb NOT NULL,
	"chip_used" text,
	"total_points" numeric(10, 2) DEFAULT '0',
	"captain_points" numeric(10, 2) DEFAULT '0',
	"submitted_at" timestamp with time zone DEFAULT now(),
	"is_auto_submitted" boolean DEFAULT false,
	CONSTRAINT "uq_tournament_user_match" UNIQUE("tournament_league_id","user_id","match_id")
);
--> statement-breakpoint
CREATE TABLE "tournament_trades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_league_id" uuid,
	"user_id" uuid,
	"trade_type" text NOT NULL,
	"player_out_id" text,
	"player_in_id" text,
	"proposed_to_user_id" uuid,
	"players_offered" jsonb,
	"players_requested" jsonb,
	"status" text DEFAULT 'pending',
	"vetoed_by" uuid,
	"veto_reason" text,
	"is_free_trade" boolean DEFAULT true,
	"penalty_points" numeric(10, 2) DEFAULT '0',
	"executed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "player_locks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_league_id" uuid,
	"player_id" text NOT NULL,
	"locked_by_user_id" uuid,
	"locked_at" timestamp with time zone DEFAULT now(),
	"unlocks_at" timestamp with time zone NOT NULL,
	"reason" text,
	CONSTRAINT "uq_tournament_player_lock" UNIQUE("tournament_league_id","player_id")
);
--> statement-breakpoint
CREATE TABLE "player_statuses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" text NOT NULL,
	"tournament_id" text NOT NULL,
	"status" text NOT NULL,
	"status_note" text,
	"updated_at" timestamp with time zone DEFAULT now(),
	"updated_by" text DEFAULT 'system',
	CONSTRAINT "uq_player_tournament_status" UNIQUE("player_id","tournament_id")
);
--> statement-breakpoint
CREATE TABLE "chip_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_league_id" uuid,
	"user_id" uuid,
	"chip_type" text NOT NULL,
	"match_id" text NOT NULL,
	"activated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "uq_chip_usage" UNIQUE("tournament_league_id","user_id","chip_type","match_id")
);
--> statement-breakpoint
CREATE TABLE "playoff_brackets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_league_id" uuid,
	"round" text NOT NULL,
	"match_id" text,
	"team_a_user_id" uuid,
	"team_b_user_id" uuid,
	"winner_user_id" uuid,
	"team_a_points" numeric(10, 2),
	"team_b_points" numeric(10, 2),
	"status" text DEFAULT 'upcoming',
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "commissioner_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"league_id" uuid,
	"commissioner_id" uuid,
	"action_type" text NOT NULL,
	"target_user_id" uuid,
	"details" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "h2h_matchups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"league_id" uuid,
	"match_id" text NOT NULL,
	"round_number" integer NOT NULL,
	"home_user_id" uuid,
	"away_user_id" uuid,
	"home_points" numeric(10, 2),
	"away_points" numeric(10, 2),
	"winner_user_id" uuid,
	"is_draw" boolean DEFAULT false,
	"home_league_points" integer DEFAULT 0,
	"away_league_points" integer DEFAULT 0,
	"status" text DEFAULT 'upcoming',
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "league_awards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"league_id" uuid,
	"match_id" text,
	"round_number" integer,
	"award_type" text NOT NULL,
	"user_id" uuid,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "custom_tournaments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_by" uuid,
	"name" text NOT NULL,
	"description" text,
	"source_tournament_ids" text[],
	"selected_match_ids" text[] NOT NULL,
	"h2h_rounds" jsonb,
	"status" text DEFAULT 'draft',
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "fixture_difficulty" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" text NOT NULL,
	"team_id" text NOT NULL,
	"overall_fdr" integer NOT NULL,
	"batting_fdr" integer NOT NULL,
	"bowling_fdr" integer NOT NULL,
	"factors" jsonb NOT NULL,
	"generated_by" text DEFAULT 'ai',
	"generated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "uq_fixture_difficulty" UNIQUE("match_id","team_id")
);
--> statement-breakpoint
CREATE TABLE "player_ownership" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" text NOT NULL,
	"match_id" text NOT NULL,
	"overall_ownership_pct" numeric(5, 2) DEFAULT '0',
	"captain_pct" numeric(5, 2) DEFAULT '0',
	"vice_captain_pct" numeric(5, 2) DEFAULT '0',
	"effective_ownership" numeric(5, 2) DEFAULT '0',
	"transfer_in_count" integer DEFAULT 0,
	"transfer_out_count" integer DEFAULT 0,
	"net_transfers" integer DEFAULT 0,
	"current_price" numeric(10, 2),
	"price_change" numeric(10, 2) DEFAULT '0',
	"calculated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "uq_player_ownership" UNIQUE("player_id","match_id")
);
--> statement-breakpoint
CREATE TABLE "player_projections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" text NOT NULL,
	"match_id" text NOT NULL,
	"projected_points" numeric(10, 2) NOT NULL,
	"confidence_low" numeric(10, 2),
	"confidence_high" numeric(10, 2),
	"breakdown" jsonb NOT NULL,
	"factors" jsonb NOT NULL,
	"captain_rank" integer,
	"differential_score" numeric(5, 2),
	"generated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "uq_player_projection" UNIQUE("player_id","match_id")
);
--> statement-breakpoint
CREATE TABLE "guru_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"context_snapshot" jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_referred_by_users_id_fk" FOREIGN KEY ("referred_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_match_scores" ADD CONSTRAINT "player_match_scores_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_match_scores" ADD CONSTRAINT "player_match_scores_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contests" ADD CONSTRAINT "contests_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contests" ADD CONSTRAINT "contests_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fantasy_teams" ADD CONSTRAINT "fantasy_teams_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fantasy_teams" ADD CONSTRAINT "fantasy_teams_contest_id_contests_id_fk" FOREIGN KEY ("contest_id") REFERENCES "public"."contests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fantasy_teams" ADD CONSTRAINT "fantasy_teams_captain_id_players_id_fk" FOREIGN KEY ("captain_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fantasy_teams" ADD CONSTRAINT "fantasy_teams_vice_captain_id_players_id_fk" FOREIGN KEY ("vice_captain_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_members" ADD CONSTRAINT "league_members_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_members" ADD CONSTRAINT "league_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leagues" ADD CONSTRAINT "leagues_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_picks" ADD CONSTRAINT "draft_picks_room_id_draft_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."draft_rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_picks" ADD CONSTRAINT "draft_picks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_picks" ADD CONSTRAINT "draft_picks_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_rooms" ADD CONSTRAINT "draft_rooms_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_to_user_id_users_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prediction_answers" ADD CONSTRAINT "prediction_answers_question_id_prediction_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."prediction_questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prediction_answers" ADD CONSTRAINT "prediction_answers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prediction_answers" ADD CONSTRAINT "prediction_answers_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prediction_standings" ADD CONSTRAINT "prediction_standings_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prediction_standings" ADD CONSTRAINT "prediction_standings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrer_id_users_id_fk" FOREIGN KEY ("referrer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referee_id_users_id_fk" FOREIGN KEY ("referee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_leagues" ADD CONSTRAINT "tournament_leagues_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advance_team_queue" ADD CONSTRAINT "advance_team_queue_tournament_league_id_tournament_leagues_id_fk" FOREIGN KEY ("tournament_league_id") REFERENCES "public"."tournament_leagues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advance_team_queue" ADD CONSTRAINT "advance_team_queue_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_team_submissions" ADD CONSTRAINT "tournament_team_submissions_tournament_league_id_tournament_leagues_id_fk" FOREIGN KEY ("tournament_league_id") REFERENCES "public"."tournament_leagues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_team_submissions" ADD CONSTRAINT "tournament_team_submissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_trades" ADD CONSTRAINT "tournament_trades_tournament_league_id_tournament_leagues_id_fk" FOREIGN KEY ("tournament_league_id") REFERENCES "public"."tournament_leagues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_trades" ADD CONSTRAINT "tournament_trades_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_trades" ADD CONSTRAINT "tournament_trades_proposed_to_user_id_users_id_fk" FOREIGN KEY ("proposed_to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_trades" ADD CONSTRAINT "tournament_trades_vetoed_by_users_id_fk" FOREIGN KEY ("vetoed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_locks" ADD CONSTRAINT "player_locks_tournament_league_id_tournament_leagues_id_fk" FOREIGN KEY ("tournament_league_id") REFERENCES "public"."tournament_leagues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_locks" ADD CONSTRAINT "player_locks_locked_by_user_id_users_id_fk" FOREIGN KEY ("locked_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chip_usage" ADD CONSTRAINT "chip_usage_tournament_league_id_tournament_leagues_id_fk" FOREIGN KEY ("tournament_league_id") REFERENCES "public"."tournament_leagues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chip_usage" ADD CONSTRAINT "chip_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playoff_brackets" ADD CONSTRAINT "playoff_brackets_tournament_league_id_tournament_leagues_id_fk" FOREIGN KEY ("tournament_league_id") REFERENCES "public"."tournament_leagues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playoff_brackets" ADD CONSTRAINT "playoff_brackets_team_a_user_id_users_id_fk" FOREIGN KEY ("team_a_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playoff_brackets" ADD CONSTRAINT "playoff_brackets_team_b_user_id_users_id_fk" FOREIGN KEY ("team_b_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playoff_brackets" ADD CONSTRAINT "playoff_brackets_winner_user_id_users_id_fk" FOREIGN KEY ("winner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commissioner_actions" ADD CONSTRAINT "commissioner_actions_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commissioner_actions" ADD CONSTRAINT "commissioner_actions_commissioner_id_users_id_fk" FOREIGN KEY ("commissioner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commissioner_actions" ADD CONSTRAINT "commissioner_actions_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "h2h_matchups" ADD CONSTRAINT "h2h_matchups_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "h2h_matchups" ADD CONSTRAINT "h2h_matchups_home_user_id_users_id_fk" FOREIGN KEY ("home_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "h2h_matchups" ADD CONSTRAINT "h2h_matchups_away_user_id_users_id_fk" FOREIGN KEY ("away_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "h2h_matchups" ADD CONSTRAINT "h2h_matchups_winner_user_id_users_id_fk" FOREIGN KEY ("winner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_awards" ADD CONSTRAINT "league_awards_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_awards" ADD CONSTRAINT "league_awards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_tournaments" ADD CONSTRAINT "custom_tournaments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guru_conversations" ADD CONSTRAINT "guru_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_matches_status" ON "matches" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_matches_start_time" ON "matches" USING btree ("start_time");--> statement-breakpoint
CREATE INDEX "idx_pms_match" ON "player_match_scores" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "idx_contests_match" ON "contests" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "idx_contests_status" ON "contests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_prediction_questions_match" ON "prediction_questions" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_user" ON "notifications" USING btree ("user_id","is_read");