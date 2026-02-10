import {
  pgTable,
  uuid,
  text,
  integer,
  decimal,
  timestamp,
  jsonb,
  unique,
} from "drizzle-orm/pg-core";

export const fixtureDifficulty = pgTable(
  "fixture_difficulty",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    matchId: text("match_id").notNull(),
    teamId: text("team_id").notNull(),

    overallFdr: integer("overall_fdr").notNull(),
    battingFdr: integer("batting_fdr").notNull(),
    bowlingFdr: integer("bowling_fdr").notNull(),

    factors: jsonb("factors").notNull(),

    generatedBy: text("generated_by").default("ai"),
    generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    unique("uq_fixture_difficulty").on(table.matchId, table.teamId),
  ]
);

export const playerProjections = pgTable(
  "player_projections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    playerId: text("player_id").notNull(),
    matchId: text("match_id").notNull(),

    projectedPoints: decimal("projected_points", { precision: 10, scale: 2 }).notNull(),
    confidenceLow: decimal("confidence_low", { precision: 10, scale: 2 }),
    confidenceHigh: decimal("confidence_high", { precision: 10, scale: 2 }),

    breakdown: jsonb("breakdown").notNull(),
    factors: jsonb("factors").notNull(),

    captainRank: integer("captain_rank"),
    differentialScore: decimal("differential_score", { precision: 5, scale: 2 }),

    generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    unique("uq_player_projection").on(table.playerId, table.matchId),
  ]
);

export const playerOwnership = pgTable(
  "player_ownership",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    playerId: text("player_id").notNull(),
    matchId: text("match_id").notNull(),

    overallOwnershipPct: decimal("overall_ownership_pct", { precision: 5, scale: 2 }).default("0"),
    captainPct: decimal("captain_pct", { precision: 5, scale: 2 }).default("0"),
    viceCaptainPct: decimal("vice_captain_pct", { precision: 5, scale: 2 }).default("0"),
    effectiveOwnership: decimal("effective_ownership", { precision: 5, scale: 2 }).default("0"),
    transferInCount: integer("transfer_in_count").default(0),
    transferOutCount: integer("transfer_out_count").default(0),
    netTransfers: integer("net_transfers").default(0),

    currentPrice: decimal("current_price", { precision: 10, scale: 2 }),
    priceChange: decimal("price_change", { precision: 10, scale: 2 }).default("0"),

    calculatedAt: timestamp("calculated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    unique("uq_player_ownership").on(table.playerId, table.matchId),
  ]
);
