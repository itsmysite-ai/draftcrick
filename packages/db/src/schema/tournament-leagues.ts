import {
  pgTable,
  uuid,
  text,
  integer,
  decimal,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { leagues } from "./contests";

export const tournamentLeagues = pgTable("tournament_leagues", {
  id: uuid("id").primaryKey().defaultRandom(),
  leagueId: uuid("league_id").references(() => leagues.id),
  tournamentId: text("tournament_id").notNull(),
  mode: text("mode").notNull(), // salary_cap, draft, auction
  status: text("status").notNull().default("setup"), // setup, active, playoffs, completed

  // Trade rules
  totalTradesAllowed: integer("total_trades_allowed").default(30),
  freeTrades: integer("free_trades").default(30),
  penaltyPerExtraTrade: decimal("penalty_per_extra_trade", { precision: 10, scale: 2 }).default("0"),
  tradeResetBeforePlayoffs: boolean("trade_reset_before_playoffs").default(false),
  playoffTradesAllowed: integer("playoff_trades_allowed").default(10),

  // Lock rules
  teamLockMinutesBeforeMatch: integer("team_lock_minutes_before_match").default(0),
  playerDropLockHours: integer("player_drop_lock_hours").default(24),
  captainLockTime: text("captain_lock_time").default("match_start"), // match_start, innings_break, 1hr_after_start
  opponentTeamVisibility: text("opponent_team_visibility").default("after_match_start"), // always, after_match_start, after_30min

  // Playoff config
  playoffFormat: text("playoff_format"), // none, ipl_style, semi_final, custom
  playoffTeams: integer("playoff_teams").default(4),
  excludePlayoffMatches: boolean("exclude_playoff_matches").default(false),

  // Chips config
  chipsEnabled: boolean("chips_enabled").default(true),
  wildcardsPerTournament: integer("wildcards_per_tournament").default(2),
  tripleCaptainCount: integer("triple_captain_count").default(1),
  benchBoostCount: integer("bench_boost_count").default(1),
  freeHitCount: integer("free_hit_count").default(1),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const tournamentLeaguesRelations = relations(tournamentLeagues, ({ one }) => ({
  league: one(leagues, {
    fields: [tournamentLeagues.leagueId],
    references: [leagues.id],
  }),
}));
