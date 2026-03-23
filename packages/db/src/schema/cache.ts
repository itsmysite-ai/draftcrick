import { pgTable, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";

export const cacheEntries = pgTable(
  "cache_entries",
  {
    key: text("key").primaryKey(),
    value: jsonb("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("idx_cache_entries_expires").on(table.expiresAt)]
);
