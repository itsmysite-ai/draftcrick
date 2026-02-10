import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";

export const customTournaments = pgTable("custom_tournaments", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdBy: uuid("created_by").references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),

  sourceTournamentIds: text("source_tournament_ids").array(),
  selectedMatchIds: text("selected_match_ids").array().notNull(),
  h2hRounds: jsonb("h2h_rounds"),

  status: text("status").default("draft"), // draft, active, completed
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const customTournamentsRelations = relations(customTournaments, ({ one }) => ({
  creator: one(users, {
    fields: [customTournaments.createdBy],
    references: [users.id],
  }),
}));
