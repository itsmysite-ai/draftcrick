import {
  pgTable,
  uuid,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { tournamentLeagues } from "./tournament-leagues";
import { users } from "./users";

export const chipUsage = pgTable(
  "chip_usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tournamentLeagueId: uuid("tournament_league_id").references(() => tournamentLeagues.id),
    userId: uuid("user_id").references(() => users.id),
    chipType: text("chip_type").notNull(), // wildcard, triple_captain, bench_boost, free_hit, power_play, death_over_specialist
    matchId: text("match_id").notNull(),
    activatedAt: timestamp("activated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    unique("uq_chip_usage").on(
      table.tournamentLeagueId,
      table.userId,
      table.chipType,
      table.matchId
    ),
  ]
);

export const chipUsageRelations = relations(chipUsage, ({ one }) => ({
  tournamentLeague: one(tournamentLeagues, {
    fields: [chipUsage.tournamentLeagueId],
    references: [tournamentLeagues.id],
  }),
  user: one(users, {
    fields: [chipUsage.userId],
    references: [users.id],
  }),
}));
