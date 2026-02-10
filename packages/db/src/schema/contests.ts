import {
  pgTable,
  uuid,
  text,
  integer,
  decimal,
  boolean,
  timestamp,
  jsonb,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";
import { matches } from "./matches";
import { players } from "./players";

export const leagues = pgTable("leagues", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id),
  format: text("format").notNull(), // salary_cap, draft, auction, prediction
  sport: text("sport").notNull().default("cricket"),
  tournament: text("tournament").notNull(),
  season: text("season"),
  isPrivate: boolean("is_private").notNull().default(true),
  inviteCode: text("invite_code").unique(),
  maxMembers: integer("max_members").notNull().default(10),
  rules: jsonb("rules").notNull().default({}),
  template: text("template").notNull().default("casual"), // casual, competitive, pro, custom
  status: text("status").notNull().default("active"), // active, completed, archived
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const leagueMembers = pgTable(
  "league_members",
  {
    leagueId: uuid("league_id")
      .notNull()
      .references(() => leagues.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    role: text("role").notNull().default("member"), // owner, admin, member
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("pk_league_member").on(table.leagueId, table.userId),
  ]
);

export const contests = pgTable(
  "contests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leagueId: uuid("league_id").references(() => leagues.id),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id),
    name: text("name").notNull(),
    entryFee: decimal("entry_fee", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    prizePool: decimal("prize_pool", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    maxEntries: integer("max_entries").notNull(),
    currentEntries: integer("current_entries").notNull().default(0),
    status: text("status").notNull().default("open"), // open, locked, live, settling, settled, cancelled
    prizeDistribution: jsonb("prize_distribution").notNull(),
    contestType: text("contest_type").notNull().default("public"), // public, private, h2h
    isGuaranteed: boolean("is_guaranteed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_contests_match").on(table.matchId),
    index("idx_contests_status").on(table.status),
  ]
);

export const fantasyTeams = pgTable(
  "fantasy_teams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    contestId: uuid("contest_id")
      .notNull()
      .references(() => contests.id),
    players: jsonb("players").notNull(), // [{playerId, role, isPlaying}]
    captainId: uuid("captain_id")
      .notNull()
      .references(() => players.id),
    viceCaptainId: uuid("vice_captain_id")
      .notNull()
      .references(() => players.id),
    totalPoints: decimal("total_points", { precision: 8, scale: 2 })
      .notNull()
      .default("0"),
    rank: integer("rank"),
    creditsUsed: decimal("credits_used", { precision: 6, scale: 1 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("uq_user_contest").on(table.userId, table.contestId),
  ]
);

// Relations
export const leaguesRelations = relations(leagues, ({ one, many }) => ({
  owner: one(users, {
    fields: [leagues.ownerId],
    references: [users.id],
  }),
  members: many(leagueMembers),
  contests: many(contests),
}));

export const leagueMembersRelations = relations(leagueMembers, ({ one }) => ({
  league: one(leagues, {
    fields: [leagueMembers.leagueId],
    references: [leagues.id],
  }),
  user: one(users, {
    fields: [leagueMembers.userId],
    references: [users.id],
  }),
}));

export const contestsRelations = relations(contests, ({ one, many }) => ({
  league: one(leagues, {
    fields: [contests.leagueId],
    references: [leagues.id],
  }),
  match: one(matches, {
    fields: [contests.matchId],
    references: [matches.id],
  }),
  teams: many(fantasyTeams),
}));

export const fantasyTeamsRelations = relations(fantasyTeams, ({ one }) => ({
  user: one(users, {
    fields: [fantasyTeams.userId],
    references: [users.id],
  }),
  contest: one(contests, {
    fields: [fantasyTeams.contestId],
    references: [contests.id],
  }),
  captain: one(players, {
    fields: [fantasyTeams.captainId],
    references: [players.id],
  }),
}));
