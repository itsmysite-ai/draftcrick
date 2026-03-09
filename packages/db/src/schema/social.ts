import {
  pgTable,
  uuid,
  text,
  decimal,
  boolean,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";

export const referrals = pgTable("referrals", {
  id: uuid("id").primaryKey().defaultRandom(),
  referrerId: uuid("referrer_id")
    .notNull()
    .references(() => users.id),
  refereeId: uuid("referee_id")
    .notNull()
    .references(() => users.id),
  bonusAmount: decimal("bonus_amount", { precision: 10, scale: 2 })
    .notNull()
    .default("0"),
  status: text("status").notNull().default("pending"), // pending, credited
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    type: text("type").notNull(), // match_reminder, score_milestone, contest_result, social, system
    title: text("title").notNull(),
    body: text("body").notNull(),
    data: jsonb("data"),
    isRead: boolean("is_read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_notifications_user").on(table.userId, table.isRead),
  ]
);

export const referralsRelations = relations(referrals, ({ one }) => ({
  referrer: one(users, {
    fields: [referrals.referrerId],
    references: [users.id],
  }),
  referee: one(users, {
    fields: [referrals.refereeId],
    references: [users.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

// ── Push Device Tokens ──────────────────────────────────────

export const pushDeviceTokens = pgTable(
  "push_device_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    platform: text("platform").notNull(), // ios, android, web
    deviceId: text("device_id"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_push_tokens_user").on(table.userId),
    index("idx_push_tokens_token").on(table.token),
  ]
);

export const pushDeviceTokensRelations = relations(
  pushDeviceTokens,
  ({ one }) => ({
    user: one(users, {
      fields: [pushDeviceTokens.userId],
      references: [users.id],
    }),
  })
);

// ── Notification Preferences ────────────────────────────────

export const notificationPreferences = pgTable("notification_preferences", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  deadlines: boolean("deadlines").notNull().default(true),
  scores: boolean("scores").notNull().default(true),
  statusAlerts: boolean("status_alerts").notNull().default(true),
  rankChanges: boolean("rank_changes").notNull().default(true),
  promotions: boolean("promotions").notNull().default(false),
  quietHoursStart: text("quiet_hours_start"), // "22:00" HH:mm
  quietHoursEnd: text("quiet_hours_end"), // "07:00" HH:mm
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const notificationPreferencesRelations = relations(
  notificationPreferences,
  ({ one }) => ({
    user: one(users, {
      fields: [notificationPreferences.userId],
      references: [users.id],
    }),
  })
);
