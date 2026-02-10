import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

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
    tournamentId: text("tournament_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_matches_status").on(table.status),
    index("idx_matches_start_time").on(table.startTime),
  ]
);

export const matchesRelations = relations(matches, ({ many }) => ({
  playerScores: many(playerMatchScores),
  contests: many(contests),
}));

// Forward reference - will be properly connected in index.ts
import { playerMatchScores } from "./players";
import { contests } from "./contests";
