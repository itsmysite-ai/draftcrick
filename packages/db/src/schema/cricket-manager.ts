import {
  pgTable,
  uuid,
  text,
  integer,
  decimal,
  timestamp,
  jsonb,
  index,
  unique,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";
import { tournaments } from "./tournaments";
import { leagues } from "./contests";

// ─────────────────────────────────────────────────────────────────────────────
// Cricket Manager — round-based fantasy format
//
// Leagues with format = 'cricket_manager' are managed via this schema.
// The league itself (public admin-created or private user-created) lives in
// the existing `leagues` table; `cm_rounds` hang off a league. This keeps
// browsing, joining, membership, and invite codes unified with every other
// league format.
//
// Spec: /docs/CRICKET_MANAGER_DRAFT.md
// ─────────────────────────────────────────────────────────────────────────────

// Rounds — admin-composed groups of matches inside a league
export const cmRounds = pgTable(
  "cm_rounds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leagueId: uuid("league_id")
      .notNull()
      .references(() => leagues.id, { onDelete: "cascade" }),
    tournamentId: uuid("tournament_id").references(() => tournaments.id),
    roundNumber: integer("round_number").notNull(),
    name: text("name").notNull(), // "Round 1 — Opening Fixtures"
    status: text("status").notNull().default("upcoming"),
    // upcoming, open, locked, live, settled, void

    // Hand-picked match IDs (JSONB array of UUIDs)
    matchIds: jsonb("match_ids").$type<string[]>().notNull().default([]),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    windowEnd: timestamp("window_end", { withTimezone: true }).notNull(),
    lockTime: timestamp("lock_time", { withTimezone: true }).notNull(),

    // Player pool — populated when round transitions to open
    eligiblePlayers: jsonb("eligible_players")
      .$type<
        Array<{
          playerId: string;
          name: string;
          team: string;
          role: string;
          photoUrl?: string | null;
          nationality?: string | null;
          battingStyle?: string;
          bowlingStyle?: string;
          recentSr?: number;
          recentAvg?: number;
          recentEcon?: number;
          recentBowlSr?: number;
          formNote?: string | null;
          recentForm?: number | null;
        }>
      >()
      .notNull()
      .default([]),

    // Config (denormalized from league.rules.cricketManager for perf)
    ballLimit: integer("ball_limit").notNull().default(120),
    minBowlers: integer("min_bowlers").notNull().default(5),
    maxOversPerBowler: integer("max_overs_per_bowler").notNull().default(4),

    // Progress
    matchesCompleted: integer("matches_completed").notNull().default(0),
    matchesTotal: integer("matches_total").notNull().default(0),

    // Stats (after settlement)
    totalEntries: integer("total_entries").notNull().default(0),
    avgNrr: decimal("avg_nrr", { precision: 8, scale: 4 }),
    bestNrr: decimal("best_nrr", { precision: 8, scale: 4 }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_cm_rounds_league").on(table.leagueId),
    index("idx_cm_rounds_tournament").on(table.tournamentId),
    index("idx_cm_rounds_status").on(table.status),
    unique("uq_cm_rounds_number").on(table.leagueId, table.roundNumber),
  ]
);

// Contests — buckets of members competing on a round.
// For v1, a single "mega" contest is auto-created per round at league publish time.
export const cmContests = pgTable(
  "cm_contests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roundId: uuid("round_id")
      .notNull()
      .references(() => cmRounds.id, { onDelete: "cascade" }),
    leagueId: uuid("league_id")
      .notNull()
      .references(() => leagues.id, { onDelete: "cascade" }),

    name: text("name").notNull(),
    contestType: text("contest_type").notNull().default("mega"),
    // mega, private, h2h, free

    entryFee: integer("entry_fee").notNull().default(0),
    prizePool: integer("prize_pool").notNull().default(0),
    prizeDistribution: jsonb("prize_distribution")
      .$type<Array<{ rank: number; percent: number }>>()
      .notNull()
      .default([]),

    maxMembers: integer("max_members").notNull().default(10000),
    currentMembers: integer("current_members").notNull().default(0),

    inviteCode: text("invite_code").unique(),
    status: text("status").notNull().default("upcoming"),
    // upcoming, open, locked, live, settled

    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_cm_contests_round").on(table.roundId),
    index("idx_cm_contests_league").on(table.leagueId),
    index("idx_cm_contests_status").on(table.status),
    index("idx_cm_contests_invite").on(table.inviteCode),
  ]
);

// Entries — a member's squad + strategy + live/final simulation results.
// One entry per (round, user). Shared across contests within the round.
export const cmEntries = pgTable(
  "cm_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roundId: uuid("round_id")
      .notNull()
      .references(() => cmRounds.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),

    players: jsonb("players")
      .$type<Array<{ playerId: string }>>()
      .notNull(),
    battingOrder: jsonb("batting_order")
      .$type<Array<{ position: number; playerId: string }>>()
      .notNull(),
    bowlingPriority: jsonb("bowling_priority")
      .$type<Array<{ priority: number; playerId: string }>>()
      .notNull(),

    chipUsed: text("chip_used"),
    chipTarget: text("chip_target"),

    // Toss call — "bat_first" means batters bat the full 120 balls,
    // "bowl_first" means batters chase bowlTotal + 1 and stop when reached.
    toss: text("toss").notNull().default("bat_first"),

    // Batting sim
    battingTotal: integer("batting_total").notNull().default(0),
    battingBallsUsed: integer("batting_balls_used").notNull().default(0),
    battingWickets: integer("batting_wickets").notNull().default(0),
    battingDetails: jsonb("batting_details"),

    // Bowling sim
    bowlingTotal: integer("bowling_total").notNull().default(0),
    bowlingBallsBowled: integer("bowling_balls_bowled").notNull().default(0),
    bowlingWickets: integer("bowling_wickets").notNull().default(0),
    bowlingDetails: jsonb("bowling_details"),

    nrr: decimal("nrr", { precision: 8, scale: 4 }).notNull().default("0"),
    battingSr: decimal("batting_sr", { precision: 8, scale: 4 })
      .notNull()
      .default("0"),

    submittedAt: timestamp("submitted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_cm_entries_round").on(table.roundId),
    index("idx_cm_entries_user").on(table.userId),
    unique("uq_cm_entries_round_user").on(table.roundId, table.userId),
  ]
);

// Contest members — links users to contests; one entry shared across contests in a round
export const cmContestMembers = pgTable(
  "cm_contest_members",
  {
    contestId: uuid("contest_id")
      .notNull()
      .references(() => cmContests.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => cmEntries.id, { onDelete: "cascade" }),

    rank: integer("rank"),
    prizeWon: integer("prize_won").notNull().default(0),

    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.contestId, table.userId] }),
    index("idx_cm_cm_user").on(table.userId),
    index("idx_cm_cm_rank").on(table.contestId, table.rank),
  ]
);

// Per-league standings — cumulative NRR, wins, rank across all rounds in a league.
// Separate from leagueMembers so we don't pollute the shared table with
// format-specific stats.
export const cmLeagueStandings = pgTable(
  "cm_league_standings",
  {
    leagueId: uuid("league_id")
      .notNull()
      .references(() => leagues.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    totalNrr: decimal("total_nrr", { precision: 10, scale: 4 })
      .notNull()
      .default("0"),
    roundsPlayed: integer("rounds_played").notNull().default(0),
    wins: integer("wins").notNull().default(0),
    losses: integer("losses").notNull().default(0),
    bestNrr: decimal("best_nrr", { precision: 8, scale: 4 }),
    worstNrr: decimal("worst_nrr", { precision: 8, scale: 4 }),
    avgNrr: decimal("avg_nrr", { precision: 8, scale: 4 }),
    currentWinStreak: integer("current_win_streak").notNull().default(0),
    bestWinStreak: integer("best_win_streak").notNull().default(0),
    currentRank: integer("current_rank"),
    prizeWon: integer("prize_won").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.leagueId, table.userId] }),
    index("idx_cm_ls_user").on(table.userId),
    index("idx_cm_ls_rank").on(table.leagueId, table.currentRank),
  ]
);

// Chips — inventory per user per tournament
export const cmChips = pgTable(
  "cm_chips",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    tournamentId: uuid("tournament_id")
      .notNull()
      .references(() => tournaments.id),
    chipType: text("chip_type").notNull(),

    usedInRound: uuid("used_in_round").references(() => cmRounds.id),
    usedAt: timestamp("used_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("uq_cm_chips_user_tournament_type").on(
      table.userId,
      table.tournamentId,
      table.chipType
    ),
    index("idx_cm_chips_user").on(table.userId),
  ]
);

// ─────────────────────────────────────────────────────────────────────────────
// Relations
// ─────────────────────────────────────────────────────────────────────────────

export const cmRoundsRelations = relations(cmRounds, ({ one, many }) => ({
  league: one(leagues, {
    fields: [cmRounds.leagueId],
    references: [leagues.id],
  }),
  tournament: one(tournaments, {
    fields: [cmRounds.tournamentId],
    references: [tournaments.id],
  }),
  contests: many(cmContests),
  entries: many(cmEntries),
}));

export const cmContestsRelations = relations(cmContests, ({ one, many }) => ({
  round: one(cmRounds, {
    fields: [cmContests.roundId],
    references: [cmRounds.id],
  }),
  league: one(leagues, {
    fields: [cmContests.leagueId],
    references: [leagues.id],
  }),
  members: many(cmContestMembers),
}));

export const cmEntriesRelations = relations(cmEntries, ({ one, many }) => ({
  round: one(cmRounds, {
    fields: [cmEntries.roundId],
    references: [cmRounds.id],
  }),
  user: one(users, {
    fields: [cmEntries.userId],
    references: [users.id],
  }),
  contestMemberships: many(cmContestMembers),
}));

export const cmContestMembersRelations = relations(
  cmContestMembers,
  ({ one }) => ({
    contest: one(cmContests, {
      fields: [cmContestMembers.contestId],
      references: [cmContests.id],
    }),
    user: one(users, {
      fields: [cmContestMembers.userId],
      references: [users.id],
    }),
    entry: one(cmEntries, {
      fields: [cmContestMembers.entryId],
      references: [cmEntries.id],
    }),
  })
);

export const cmLeagueStandingsRelations = relations(
  cmLeagueStandings,
  ({ one }) => ({
    league: one(leagues, {
      fields: [cmLeagueStandings.leagueId],
      references: [leagues.id],
    }),
    user: one(users, {
      fields: [cmLeagueStandings.userId],
      references: [users.id],
    }),
  })
);

export const cmChipsRelations = relations(cmChips, ({ one }) => ({
  user: one(users, {
    fields: [cmChips.userId],
    references: [users.id],
  }),
  tournament: one(tournaments, {
    fields: [cmChips.tournamentId],
    references: [tournaments.id],
  }),
  usedRound: one(cmRounds, {
    fields: [cmChips.usedInRound],
    references: [cmRounds.id],
  }),
}));
