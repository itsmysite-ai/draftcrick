import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { leagues } from "./contests";
import { users } from "./users";

export const commissionerActions = pgTable("commissioner_actions", {
  id: uuid("id").primaryKey().defaultRandom(),
  leagueId: uuid("league_id").references(() => leagues.id),
  commissionerId: uuid("commissioner_id").references(() => users.id),
  actionType: text("action_type").notNull(), // assign_points, grant_trades, edit_team, veto_trade, change_rule, kick_member, ban_member, send_announcement, set_entry_fee, set_prizes
  targetUserId: uuid("target_user_id").references(() => users.id),
  details: jsonb("details").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const commissionerActionsRelations = relations(commissionerActions, ({ one }) => ({
  league: one(leagues, {
    fields: [commissionerActions.leagueId],
    references: [leagues.id],
  }),
  commissioner: one(users, {
    fields: [commissionerActions.commissionerId],
    references: [users.id],
    relationName: "commissionerActionBy",
  }),
  targetUser: one(users, {
    fields: [commissionerActions.targetUserId],
    references: [users.id],
    relationName: "commissionerActionTarget",
  }),
}));
