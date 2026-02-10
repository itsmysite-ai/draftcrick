import {
  pgTable,
  uuid,
  text,
  decimal,
  timestamp,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { tournamentLeagues } from "./tournament-leagues";
import { users } from "./users";

export const playoffBrackets = pgTable("playoff_brackets", {
  id: uuid("id").primaryKey().defaultRandom(),
  tournamentLeagueId: uuid("tournament_league_id").references(() => tournamentLeagues.id),
  round: text("round").notNull(),
  matchId: text("match_id"),
  teamAUserId: uuid("team_a_user_id").references(() => users.id),
  teamBUserId: uuid("team_b_user_id").references(() => users.id),
  winnerUserId: uuid("winner_user_id").references(() => users.id),
  teamAPoints: decimal("team_a_points", { precision: 10, scale: 2 }),
  teamBPoints: decimal("team_b_points", { precision: 10, scale: 2 }),
  status: text("status").default("upcoming"), // upcoming, live, completed
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const playoffBracketsRelations = relations(playoffBrackets, ({ one }) => ({
  tournamentLeague: one(tournamentLeagues, {
    fields: [playoffBrackets.tournamentLeagueId],
    references: [tournamentLeagues.id],
  }),
  teamAUser: one(users, {
    fields: [playoffBrackets.teamAUserId],
    references: [users.id],
    relationName: "playoffTeamA",
  }),
  teamBUser: one(users, {
    fields: [playoffBrackets.teamBUserId],
    references: [users.id],
    relationName: "playoffTeamB",
  }),
  winnerUser: one(users, {
    fields: [playoffBrackets.winnerUserId],
    references: [users.id],
    relationName: "playoffWinner",
  }),
}));
