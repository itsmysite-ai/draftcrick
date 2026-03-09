import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  date,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  firebaseUid: text("firebase_uid").unique().notNull(),
  email: text("email").unique(),
  phone: text("phone").unique(),
  username: text("username").unique().notNull(),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  role: text("role").notNull().default("user"), // user, admin, moderator
  kycStatus: text("kyc_status").notNull().default("pending"), // pending, verified, rejected
  preferredLang: text("preferred_lang").notNull().default("en"),
  ageConfirmed: boolean("age_confirmed").notNull().default(false),
  termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const userProfiles = pgTable("user_profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id),
  favoriteTeam: text("favorite_team"),
  bio: text("bio"),
  winCount: integer("win_count").notNull().default(0),
  contestCount: integer("contest_count").notNull().default(0),
  predictionStreak: integer("prediction_streak").notNull().default(0),
  badges: jsonb("badges").notNull().default([]),
  referralCode: text("referral_code").unique().notNull(),
  referredBy: uuid("referred_by").references(() => users.id),
  loginStreak: integer("login_streak").notNull().default(0),
  lastLoginDate: date("last_login_date"),
});

export const wallets = pgTable("wallets", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id),
  coinBalance: integer("coin_balance").notNull().default(500),
  totalEarned: integer("total_earned").notNull().default(0),
  totalSpent: integer("total_spent").notNull().default(0),
  totalWon: integer("total_won").notNull().default(0),
  lastDailyClaimAt: timestamp("last_daily_claim_at", { withTimezone: true }),
  loginStreak: integer("login_streak").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const transactions = pgTable("transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  type: text("type").notNull(), // daily_claim, contest_entry, contest_win, prediction_win, referral_bonus, pack_purchase, streak_bonus, achievement
  amount: integer("amount").notNull(),
  status: text("status").notNull().default("completed"), // completed, failed, reversed
  contestId: uuid("contest_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(userProfiles, {
    fields: [users.id],
    references: [userProfiles.userId],
  }),
  wallet: one(wallets, {
    fields: [users.id],
    references: [wallets.userId],
  }),
  transactions: many(transactions),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, {
    fields: [transactions.userId],
    references: [users.id],
  }),
}));
