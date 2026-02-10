import {
  pgTable,
  uuid,
  text,
  decimal,
  boolean,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { tournamentLeagues } from "./tournament-leagues";
import { users } from "./users";

export const tournamentTrades = pgTable("tournament_trades", {
  id: uuid("id").primaryKey().defaultRandom(),
  tournamentLeagueId: uuid("tournament_league_id").references(() => tournamentLeagues.id),
  userId: uuid("user_id").references(() => users.id),

  tradeType: text("trade_type").notNull(), // drop_add, inter_team, waiver_claim

  playerOutId: text("player_out_id"),
  playerInId: text("player_in_id"),

  proposedToUserId: uuid("proposed_to_user_id").references(() => users.id),
  playersOffered: jsonb("players_offered"),
  playersRequested: jsonb("players_requested"),
  status: text("status").default("pending"), // pending, accepted, rejected, vetoed, expired
  vetoedBy: uuid("vetoed_by").references(() => users.id),
  vetoReason: text("veto_reason"),

  isFreeTrade: boolean("is_free_trade").default(true),
  penaltyPoints: decimal("penalty_points", { precision: 10, scale: 2 }).default("0"),

  executedAt: timestamp("executed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const tournamentTradesRelations = relations(tournamentTrades, ({ one }) => ({
  tournamentLeague: one(tournamentLeagues, {
    fields: [tournamentTrades.tournamentLeagueId],
    references: [tournamentLeagues.id],
  }),
  user: one(users, {
    fields: [tournamentTrades.userId],
    references: [users.id],
    relationName: "tournamentTradeUser",
  }),
  proposedToUser: one(users, {
    fields: [tournamentTrades.proposedToUserId],
    references: [users.id],
    relationName: "tournamentTradeProposedTo",
  }),
  vetoedByUser: one(users, {
    fields: [tournamentTrades.vetoedBy],
    references: [users.id],
    relationName: "tournamentTradeVetoedBy",
  }),
}));
