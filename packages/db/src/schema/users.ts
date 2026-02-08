import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  integer,
  decimal,
  date,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").unique(),
  phone: text("phone").unique(),
  username: text("username").unique().notNull(),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  role: text("role").notNull().default("user"), // user, admin, moderator
  kycStatus: text("kyc_status").notNull().default("pending"), // pending, verified, rejected
  comfortMode: boolean("comfort_mode").notNull().default(false),
  preferredLang: text("preferred_lang").notNull().default("en"),
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
  cashBalance: decimal("cash_balance", { precision: 12, scale: 2 })
    .notNull()
    .default("0.00"),
  bonusBalance: decimal("bonus_balance", { precision: 12, scale: 2 })
    .notNull()
    .default("0.00"),
  totalDeposited: decimal("total_deposited", { precision: 12, scale: 2 })
    .notNull()
    .default("0.00"),
  totalWithdrawn: decimal("total_withdrawn", { precision: 12, scale: 2 })
    .notNull()
    .default("0.00"),
  totalWinnings: decimal("total_winnings", { precision: 12, scale: 2 })
    .notNull()
    .default("0.00"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const transactions = pgTable("transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  type: text("type").notNull(), // deposit, withdrawal, entry_fee, winnings, bonus, refund, tds
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  status: text("status").notNull().default("pending"), // pending, completed, failed, reversed
  contestId: uuid("contest_id"),
  gateway: text("gateway"),
  gatewayRef: text("gateway_ref"),
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
