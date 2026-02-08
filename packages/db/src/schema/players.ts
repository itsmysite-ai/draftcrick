import {
  pgTable,
  uuid,
  text,
  integer,
  decimal,
  boolean,
  timestamp,
  jsonb,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { matches } from "./matches";

export const players = pgTable("players", {
  id: uuid("id").primaryKey().defaultRandom(),
  externalId: text("external_id").unique().notNull(),
  name: text("name").notNull(),
  team: text("team").notNull(),
  role: text("role").notNull(), // batsman, bowler, all_rounder, wicket_keeper
  photoUrl: text("photo_url"),
  nationality: text("nationality"),
  battingStyle: text("batting_style"),
  bowlingStyle: text("bowling_style"),
  stats: jsonb("stats").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const playerMatchScores = pgTable(
  "player_match_scores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id),
    runs: integer("runs").notNull().default(0),
    ballsFaced: integer("balls_faced").notNull().default(0),
    fours: integer("fours").notNull().default(0),
    sixes: integer("sixes").notNull().default(0),
    wickets: integer("wickets").notNull().default(0),
    oversBowled: decimal("overs_bowled", { precision: 4, scale: 1 })
      .notNull()
      .default("0"),
    runsConceded: integer("runs_conceded").notNull().default(0),
    maidens: integer("maidens").notNull().default(0),
    catches: integer("catches").notNull().default(0),
    stumpings: integer("stumpings").notNull().default(0),
    runOuts: integer("run_outs").notNull().default(0),
    fantasyPoints: decimal("fantasy_points", { precision: 8, scale: 2 })
      .notNull()
      .default("0"),
    isPlaying: boolean("is_playing").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_pms_match").on(table.matchId),
    unique("uq_player_match").on(table.playerId, table.matchId),
  ]
);

export const playersRelations = relations(players, ({ many }) => ({
  matchScores: many(playerMatchScores),
}));

export const playerMatchScoresRelations = relations(
  playerMatchScores,
  ({ one }) => ({
    player: one(players, {
      fields: [playerMatchScores.playerId],
      references: [players.id],
    }),
    match: one(matches, {
      fields: [playerMatchScores.matchId],
      references: [matches.id],
    }),
  })
);
