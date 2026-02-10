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

export const playerLocks = pgTable(
  "player_locks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tournamentLeagueId: uuid("tournament_league_id").references(() => tournamentLeagues.id),
    playerId: text("player_id").notNull(),
    lockedByUserId: uuid("locked_by_user_id").references(() => users.id),
    lockedAt: timestamp("locked_at", { withTimezone: true }).defaultNow(),
    unlocksAt: timestamp("unlocks_at", { withTimezone: true }).notNull(),
    reason: text("reason"), // dropped, new_entrant, waiver
  },
  (table) => [
    unique("uq_tournament_player_lock").on(
      table.tournamentLeagueId,
      table.playerId
    ),
  ]
);

export const playerLocksRelations = relations(playerLocks, ({ one }) => ({
  tournamentLeague: one(tournamentLeagues, {
    fields: [playerLocks.tournamentLeagueId],
    references: [tournamentLeagues.id],
  }),
  lockedByUser: one(users, {
    fields: [playerLocks.lockedByUserId],
    references: [users.id],
  }),
}));
