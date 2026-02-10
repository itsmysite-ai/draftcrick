import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { leagues } from "./contests";
import { users } from "./users";

export const leagueAwards = pgTable("league_awards", {
  id: uuid("id").primaryKey().defaultRandom(),
  leagueId: uuid("league_id").references(() => leagues.id),
  matchId: text("match_id"),
  roundNumber: integer("round_number"),

  awardType: text("award_type").notNull(), // manager_of_match, highest_scorer, worst_transfer, best_captain, biggest_differential, most_improved, orange_cap, purple_cap
  userId: uuid("user_id").references(() => users.id),
  details: jsonb("details"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const leagueAwardsRelations = relations(leagueAwards, ({ one }) => ({
  league: one(leagues, {
    fields: [leagueAwards.leagueId],
    references: [leagues.id],
  }),
  user: one(users, {
    fields: [leagueAwards.userId],
    references: [users.id],
  }),
}));
