import {
  pgTable,
  uuid,
  text,
  integer,
  decimal,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { leagues } from "./contests";
import { users } from "./users";
import { players } from "./players";

export const draftRooms = pgTable("draft_rooms", {
  id: uuid("id").primaryKey().defaultRandom(),
  leagueId: uuid("league_id")
    .notNull()
    .references(() => leagues.id),
  type: text("type").notNull(), // snake_draft, auction
  status: text("status").notNull().default("waiting"), // waiting, in_progress, completed
  currentTurn: integer("current_turn").notNull().default(0),
  currentRound: integer("current_round").notNull().default(1),
  pickOrder: jsonb("pick_order").notNull(), // [userId, ...]
  timePerPick: integer("time_per_pick").notNull().default(60),
  currentPickDeadline: timestamp("current_pick_deadline", {
    withTimezone: true,
  }),
  settings: jsonb("settings").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const draftPicks = pgTable("draft_picks", {
  id: uuid("id").primaryKey().defaultRandom(),
  roomId: uuid("room_id")
    .notNull()
    .references(() => draftRooms.id),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  playerId: uuid("player_id")
    .notNull()
    .references(() => players.id),
  pickNumber: integer("pick_number").notNull(),
  round: integer("round").notNull(),
  bidAmount: decimal("bid_amount", { precision: 10, scale: 2 }),
  pickedAt: timestamp("picked_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const trades = pgTable("trades", {
  id: uuid("id").primaryKey().defaultRandom(),
  leagueId: uuid("league_id")
    .notNull()
    .references(() => leagues.id),
  fromUserId: uuid("from_user_id")
    .notNull()
    .references(() => users.id),
  toUserId: uuid("to_user_id")
    .notNull()
    .references(() => users.id),
  playersOffered: jsonb("players_offered").notNull(), // [playerId, ...]
  playersRequested: jsonb("players_requested").notNull(),
  status: text("status").notNull().default("pending"), // pending, accepted, rejected, expired
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Relations
export const draftRoomsRelations = relations(draftRooms, ({ one, many }) => ({
  league: one(leagues, {
    fields: [draftRooms.leagueId],
    references: [leagues.id],
  }),
  picks: many(draftPicks),
}));

export const draftPicksRelations = relations(draftPicks, ({ one }) => ({
  room: one(draftRooms, {
    fields: [draftPicks.roomId],
    references: [draftRooms.id],
  }),
  user: one(users, {
    fields: [draftPicks.userId],
    references: [users.id],
  }),
  player: one(players, {
    fields: [draftPicks.playerId],
    references: [players.id],
  }),
}));

export const tradesRelations = relations(trades, ({ one }) => ({
  league: one(leagues, {
    fields: [trades.leagueId],
    references: [leagues.id],
  }),
  fromUser: one(users, {
    fields: [trades.fromUserId],
    references: [users.id],
  }),
}));
