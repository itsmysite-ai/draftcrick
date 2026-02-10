import {
  pgTable,
  uuid,
  text,
  decimal,
  boolean,
  timestamp,
  jsonb,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { tournamentLeagues } from "./tournament-leagues";
import { users } from "./users";

export const tournamentTeamSubmissions = pgTable(
  "tournament_team_submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tournamentLeagueId: uuid("tournament_league_id").references(() => tournamentLeagues.id),
    userId: uuid("user_id").references(() => users.id),
    matchId: text("match_id").notNull(),

    squad: jsonb("squad").notNull(), // [{playerId, role, isCaptain, isViceCaptain}]
    playingXi: jsonb("playing_xi").notNull(), // [{playerId, role}]

    chipUsed: text("chip_used"), // wildcard, triple_captain, bench_boost, free_hit, power_play, death_over_specialist

    totalPoints: decimal("total_points", { precision: 10, scale: 2 }).default("0"),
    captainPoints: decimal("captain_points", { precision: 10, scale: 2 }).default("0"),

    submittedAt: timestamp("submitted_at", { withTimezone: true }).defaultNow(),
    isAutoSubmitted: boolean("is_auto_submitted").default(false),
  },
  (table) => [
    unique("uq_tournament_user_match").on(
      table.tournamentLeagueId,
      table.userId,
      table.matchId
    ),
  ]
);

export const advanceTeamQueue = pgTable(
  "advance_team_queue",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tournamentLeagueId: uuid("tournament_league_id").references(() => tournamentLeagues.id),
    userId: uuid("user_id").references(() => users.id),
    matchId: text("match_id").notNull(),
    squad: jsonb("squad").notNull(),
    playingXi: jsonb("playing_xi").notNull(),
    captainId: text("captain_id").notNull(),
    viceCaptainId: text("vice_captain_id").notNull(),
    queuedAt: timestamp("queued_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    unique("uq_advance_queue_user_match").on(
      table.tournamentLeagueId,
      table.userId,
      table.matchId
    ),
  ]
);

export const tournamentTeamSubmissionsRelations = relations(
  tournamentTeamSubmissions,
  ({ one }) => ({
    tournamentLeague: one(tournamentLeagues, {
      fields: [tournamentTeamSubmissions.tournamentLeagueId],
      references: [tournamentLeagues.id],
    }),
    user: one(users, {
      fields: [tournamentTeamSubmissions.userId],
      references: [users.id],
    }),
  })
);

export const advanceTeamQueueRelations = relations(
  advanceTeamQueue,
  ({ one }) => ({
    tournamentLeague: one(tournamentLeagues, {
      fields: [advanceTeamQueue.tournamentLeagueId],
      references: [tournamentLeagues.id],
    }),
    user: one(users, {
      fields: [advanceTeamQueue.userId],
      references: [users.id],
    }),
  })
);
