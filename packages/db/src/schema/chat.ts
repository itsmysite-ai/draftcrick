import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";
import { matches } from "./matches";

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    matchId: uuid("match_id").references(() => matches.id, { onDelete: "cascade" }),
    message: text("message").notNull(),
    type: text("type").notNull().default("user"), // user, ai_reaction, ai_hottake, ai_celebration, system
    displayName: text("display_name"), // cached at send time so we don't join users table on every read
    flagCount: integer("flag_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_chat_match_created").on(table.matchId, table.createdAt),
    index("idx_chat_created").on(table.createdAt),
  ]
);

/** Tracks who flagged which message — prevents double-flagging */
export const chatFlags = pgTable(
  "chat_flags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => chatMessages.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_chat_flags_unique").on(table.messageId, table.userId),
  ]
);

export const chatMessagesRelations = relations(chatMessages, ({ one, many }) => ({
  user: one(users, {
    fields: [chatMessages.userId],
    references: [users.id],
  }),
  match: one(matches, {
    fields: [chatMessages.matchId],
    references: [matches.id],
  }),
  flags: many(chatFlags),
}));

export const chatFlagsRelations = relations(chatFlags, ({ one }) => ({
  message: one(chatMessages, {
    fields: [chatFlags.messageId],
    references: [chatMessages.id],
  }),
  user: one(users, {
    fields: [chatFlags.userId],
    references: [users.id],
  }),
}));
