import {
  pgTable,
  uuid,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

export const playerStatuses = pgTable(
  "player_statuses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    playerId: text("player_id").notNull(),
    tournamentId: text("tournament_id").notNull(),
    status: text("status").notNull(), // available, injured, out_of_tournament, unavailable_next_match, doubtful
    statusNote: text("status_note"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
    updatedBy: text("updated_by").default("system"),
  },
  (table) => [
    unique("uq_player_tournament_status").on(table.playerId, table.tournamentId),
  ]
);
