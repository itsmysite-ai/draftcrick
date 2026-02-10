import {
  pgTable,
  uuid,
  text,
  integer,
  decimal,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { leagues } from "./contests";
import { users } from "./users";

export const h2hMatchups = pgTable("h2h_matchups", {
  id: uuid("id").primaryKey().defaultRandom(),
  leagueId: uuid("league_id").references(() => leagues.id),
  matchId: text("match_id").notNull(),
  roundNumber: integer("round_number").notNull(),

  homeUserId: uuid("home_user_id").references(() => users.id),
  awayUserId: uuid("away_user_id").references(() => users.id),
  homePoints: decimal("home_points", { precision: 10, scale: 2 }),
  awayPoints: decimal("away_points", { precision: 10, scale: 2 }),
  winnerUserId: uuid("winner_user_id").references(() => users.id),
  isDraw: boolean("is_draw").default(false),

  homeLeaguePoints: integer("home_league_points").default(0),
  awayLeaguePoints: integer("away_league_points").default(0),

  status: text("status").default("upcoming"), // upcoming, live, completed
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const h2hMatchupsRelations = relations(h2hMatchups, ({ one }) => ({
  league: one(leagues, {
    fields: [h2hMatchups.leagueId],
    references: [leagues.id],
  }),
  homeUser: one(users, {
    fields: [h2hMatchups.homeUserId],
    references: [users.id],
    relationName: "h2hHomeUser",
  }),
  awayUser: one(users, {
    fields: [h2hMatchups.awayUserId],
    references: [users.id],
    relationName: "h2hAwayUser",
  }),
  winnerUser: one(users, {
    fields: [h2hMatchups.winnerUserId],
    references: [users.id],
    relationName: "h2hWinner",
  }),
}));
