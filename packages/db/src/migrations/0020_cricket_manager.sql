-- Cricket Manager — round-based fantasy format layered on the `leagues` table.
-- Leagues with format = 'cricket_manager' are managed via this schema.
-- Spec: /docs/CRICKET_MANAGER_DRAFT.md
-- Idempotent: safe to re-run; uses IF NOT EXISTS where possible.

-- ─── Rounds ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "cm_rounds" (
  "id"                    uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "league_id"             uuid NOT NULL,
  "tournament_id"         uuid,
  "round_number"          integer NOT NULL,
  "name"                  text NOT NULL,
  "status"                text NOT NULL DEFAULT 'upcoming',
  "match_ids"             jsonb NOT NULL DEFAULT '[]'::jsonb,
  "window_start"          timestamp with time zone NOT NULL,
  "window_end"            timestamp with time zone NOT NULL,
  "lock_time"             timestamp with time zone NOT NULL,
  "eligible_players"      jsonb NOT NULL DEFAULT '[]'::jsonb,
  "ball_limit"            integer NOT NULL DEFAULT 120,
  "min_bowlers"           integer NOT NULL DEFAULT 5,
  "max_overs_per_bowler"  integer NOT NULL DEFAULT 4,
  "matches_completed"     integer NOT NULL DEFAULT 0,
  "matches_total"         integer NOT NULL DEFAULT 0,
  "total_entries"         integer NOT NULL DEFAULT 0,
  "avg_nrr"               numeric(8,4),
  "best_nrr"              numeric(8,4),
  "created_at"            timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"            timestamp with time zone NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE "cm_rounds"
    ADD CONSTRAINT "cm_rounds_league_fk"
    FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "cm_rounds"
    ADD CONSTRAINT "cm_rounds_tournament_fk"
    FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id")
    ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "idx_cm_rounds_league"     ON "cm_rounds" ("league_id");
CREATE INDEX IF NOT EXISTS "idx_cm_rounds_tournament" ON "cm_rounds" ("tournament_id");
CREATE INDEX IF NOT EXISTS "idx_cm_rounds_status"     ON "cm_rounds" ("status");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_cm_rounds_number" ON "cm_rounds" ("league_id","round_number");

-- ─── Contests ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "cm_contests" (
  "id"                  uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "round_id"            uuid NOT NULL,
  "league_id"           uuid NOT NULL,
  "name"                text NOT NULL,
  "contest_type"        text NOT NULL DEFAULT 'mega',
  "entry_fee"           integer NOT NULL DEFAULT 0,
  "prize_pool"          integer NOT NULL DEFAULT 0,
  "prize_distribution"  jsonb NOT NULL DEFAULT '[]'::jsonb,
  "max_members"         integer NOT NULL DEFAULT 10000,
  "current_members"     integer NOT NULL DEFAULT 0,
  "invite_code"         text UNIQUE,
  "status"              text NOT NULL DEFAULT 'upcoming',
  "created_by"          uuid,
  "created_at"          timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"          timestamp with time zone NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE "cm_contests"
    ADD CONSTRAINT "cm_contests_round_fk"
    FOREIGN KEY ("round_id") REFERENCES "public"."cm_rounds"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "cm_contests"
    ADD CONSTRAINT "cm_contests_league_fk"
    FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "cm_contests"
    ADD CONSTRAINT "cm_contests_created_by_fk"
    FOREIGN KEY ("created_by") REFERENCES "public"."users"("id")
    ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "idx_cm_contests_round"  ON "cm_contests" ("round_id");
CREATE INDEX IF NOT EXISTS "idx_cm_contests_league" ON "cm_contests" ("league_id");
CREATE INDEX IF NOT EXISTS "idx_cm_contests_status" ON "cm_contests" ("status");
CREATE INDEX IF NOT EXISTS "idx_cm_contests_invite" ON "cm_contests" ("invite_code");

-- ─── Entries ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "cm_entries" (
  "id"                    uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "round_id"              uuid NOT NULL,
  "user_id"               uuid NOT NULL,
  "players"               jsonb NOT NULL,
  "batting_order"         jsonb NOT NULL,
  "bowling_priority"      jsonb NOT NULL,
  "chip_used"             text,
  "chip_target"           text,
  "batting_total"         integer NOT NULL DEFAULT 0,
  "batting_balls_used"    integer NOT NULL DEFAULT 0,
  "batting_wickets"       integer NOT NULL DEFAULT 0,
  "batting_details"       jsonb,
  "bowling_total"         integer NOT NULL DEFAULT 0,
  "bowling_balls_bowled"  integer NOT NULL DEFAULT 0,
  "bowling_wickets"       integer NOT NULL DEFAULT 0,
  "bowling_details"       jsonb,
  "nrr"                   numeric(8,4) NOT NULL DEFAULT '0',
  "batting_sr"            numeric(8,4) NOT NULL DEFAULT '0',
  "submitted_at"          timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"            timestamp with time zone NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE "cm_entries"
    ADD CONSTRAINT "cm_entries_round_fk"
    FOREIGN KEY ("round_id") REFERENCES "public"."cm_rounds"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "cm_entries"
    ADD CONSTRAINT "cm_entries_user_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
    ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "idx_cm_entries_round" ON "cm_entries" ("round_id");
CREATE INDEX IF NOT EXISTS "idx_cm_entries_user"  ON "cm_entries" ("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_cm_entries_round_user" ON "cm_entries" ("round_id","user_id");

-- ─── Contest Members ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "cm_contest_members" (
  "contest_id"  uuid NOT NULL,
  "user_id"     uuid NOT NULL,
  "entry_id"    uuid NOT NULL,
  "rank"        integer,
  "prize_won"   integer NOT NULL DEFAULT 0,
  "joined_at"   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "cm_contest_members_pk" PRIMARY KEY ("contest_id","user_id")
);

DO $$ BEGIN
  ALTER TABLE "cm_contest_members"
    ADD CONSTRAINT "cm_cm_contest_fk"
    FOREIGN KEY ("contest_id") REFERENCES "public"."cm_contests"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "cm_contest_members"
    ADD CONSTRAINT "cm_cm_user_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
    ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "cm_contest_members"
    ADD CONSTRAINT "cm_cm_entry_fk"
    FOREIGN KEY ("entry_id") REFERENCES "public"."cm_entries"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "idx_cm_cm_user" ON "cm_contest_members" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_cm_cm_rank" ON "cm_contest_members" ("contest_id","rank");

-- ─── League Standings ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "cm_league_standings" (
  "league_id"     uuid NOT NULL,
  "user_id"       uuid NOT NULL,
  "total_nrr"     numeric(10,4) NOT NULL DEFAULT '0',
  "rounds_played" integer NOT NULL DEFAULT 0,
  "wins"          integer NOT NULL DEFAULT 0,
  "best_nrr"      numeric(8,4),
  "current_rank"  integer,
  "prize_won"     integer NOT NULL DEFAULT 0,
  "updated_at"    timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "cm_league_standings_pk" PRIMARY KEY ("league_id","user_id")
);

DO $$ BEGIN
  ALTER TABLE "cm_league_standings"
    ADD CONSTRAINT "cm_ls_league_fk"
    FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "cm_league_standings"
    ADD CONSTRAINT "cm_ls_user_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
    ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "idx_cm_ls_user" ON "cm_league_standings" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_cm_ls_rank" ON "cm_league_standings" ("league_id","current_rank");

-- ─── Chips ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "cm_chips" (
  "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id"         uuid NOT NULL,
  "tournament_id"   uuid NOT NULL,
  "chip_type"       text NOT NULL,
  "used_in_round"   uuid,
  "used_at"         timestamp with time zone,
  "created_at"      timestamp with time zone NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE "cm_chips"
    ADD CONSTRAINT "cm_chips_user_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
    ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "cm_chips"
    ADD CONSTRAINT "cm_chips_tournament_fk"
    FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id")
    ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "cm_chips"
    ADD CONSTRAINT "cm_chips_used_round_fk"
    FOREIGN KEY ("used_in_round") REFERENCES "public"."cm_rounds"("id")
    ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "uq_cm_chips_user_tournament_type"
  ON "cm_chips" ("user_id","tournament_id","chip_type");
CREATE INDEX IF NOT EXISTS "idx_cm_chips_user" ON "cm_chips" ("user_id");
