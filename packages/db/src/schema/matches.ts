import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  jsonb,
  index,
  integer,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { tournaments } from "./tournaments";

export const matches = pgTable(
  "matches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    externalId: text("external_id").unique().notNull(),
    sport: text("sport").notNull().default("cricket"),
    format: text("format").notNull(), // t20, odi, test
    tournament: text("tournament").notNull(),
    teamHome: text("team_home").notNull(),
    teamAway: text("team_away").notNull(),
    venue: text("venue").notNull(),
    city: text("city"),
    startTime: timestamp("start_time", { withTimezone: true }).notNull(),
    status: text("status").notNull().default("upcoming"), // upcoming, live, completed, abandoned
    tossWinner: text("toss_winner"),
    tossDecision: text("toss_decision"), // bat, bowl
    playingXiHome: jsonb("playing_xi_home"),
    playingXiAway: jsonb("playing_xi_away"),
    result: text("result"),
    draftEnabled: boolean("draft_enabled").default(false),

    // Smart refresh columns
    tournamentId: uuid("tournament_id").references(() => tournaments.id),
    matchPhase: text("match_phase").notNull().default("idle"), // idle, pre_match, live, post_match, completed
    lastRefreshedAt: timestamp("last_refreshed_at", { withTimezone: true }),
    nextRefreshAfter: timestamp("next_refresh_after", { withTimezone: true }),
    refreshCount: integer("refresh_count").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_matches_status").on(table.status),
    index("idx_matches_start_time").on(table.startTime),
    index("idx_matches_tournament").on(table.tournamentId),
    index("idx_matches_phase").on(table.matchPhase),
    index("idx_matches_next_refresh").on(table.nextRefreshAfter),
  ]
);

export const matchesRelations = relations(matches, ({ one, many }) => ({
  tournamentRef: one(tournaments, {
    fields: [matches.tournamentId],
    references: [tournaments.id],
  }),
  playerScores: many(playerMatchScores),
  contests: many(contests),
}));

// Forward reference - will be properly connected in index.ts
import { playerMatchScores } from "./players";
import { contests } from "./contests";
