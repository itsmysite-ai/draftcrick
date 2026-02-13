import {
  pgTable,
  uuid,
  text,
  date,
  timestamp,
  jsonb,
  index,
  integer,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { matches } from "./matches";

export const tournaments = pgTable(
  "tournaments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    externalId: text("external_id").notNull(),
    name: text("name").notNull(),
    shortName: text("short_name"),
    sport: text("sport").notNull().default("cricket"),
    format: text("format"), // T20, ODI, Test
    status: text("status").notNull().default("upcoming"), // upcoming, active, completed, cancelled
    startDate: date("start_date"),
    endDate: date("end_date"),
    country: text("country"),

    // Metadata from Gemini
    teams: jsonb("teams"), // [{name, shortName, logo}]
    venueInfo: jsonb("venue_info"), // [{name, city, country}]
    category: text("category"), // international, domestic, league, bilateral, qualifier, friendly

    // Standings data (AITeamStanding[]) — fetched via Gemini, cached as JSONB
    standings: jsonb("standings").default([]),

    // Refresh tracking
    lastRefreshedAt: timestamp("last_refreshed_at", { withTimezone: true }),
    refreshSource: text("refresh_source"), // gemini, manual, seed

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_tournaments_external_id_sport").on(
      table.externalId,
      table.sport
    ),
    index("idx_tournaments_sport_status").on(table.sport, table.status),
  ]
);

export const tournamentsRelations = relations(tournaments, ({ many }) => ({
  matches: many(matches),
}));

export const dataRefreshLog = pgTable(
  "data_refresh_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityType: text("entity_type").notNull(), // tournament, match, dashboard
    entityId: text("entity_id"),
    sport: text("sport").notNull().default("cricket"),

    // Refresh details
    trigger: text("trigger").notNull(), // user_request, cold_start, manual
    triggeredByUserId: uuid("triggered_by_user_id"),

    // Timing
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    durationMs: integer("duration_ms"),

    // Result
    status: text("status").notNull().default("in_progress"), // in_progress, success, failed, skipped
    errorMessage: text("error_message"),

    // Data stats
    recordsUpserted: integer("records_upserted").default(0),
    recordsUnchanged: integer("records_unchanged").default(0),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_refresh_log_entity").on(table.entityType, table.entityId),
    index("idx_refresh_log_sport_status").on(table.sport, table.status),
    index("idx_refresh_log_created").on(table.createdAt),
  ]
);
