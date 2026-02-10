import {
  pgTable,
  uuid,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";

export const guruConversations = pgTable("guru_conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id),
  messages: jsonb("messages").notNull().default([]),
  contextSnapshot: jsonb("context_snapshot"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const guruConversationsRelations = relations(guruConversations, ({ one }) => ({
  user: one(users, {
    fields: [guruConversations.userId],
    references: [users.id],
  }),
}));
