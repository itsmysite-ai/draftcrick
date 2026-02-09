import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";
import { matches } from "./matches";

export const predictions = pgTable(
  "predictions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id),
    predictionType: text("prediction_type").notNull(), // winner, margin, top_scorer, top_bowler, toss
    predictionValue: text("prediction_value").notNull(),
    isCorrect: boolean("is_correct"),
    pointsEarned: integer("points_earned").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("uq_user_match_prediction").on(
      table.userId,
      table.matchId,
      table.predictionType
    ),
  ]
);

export const predictionsRelations = relations(predictions, ({ one }) => ({
  user: one(users, {
    fields: [predictions.userId],
    references: [users.id],
  }),
  match: one(matches, {
    fields: [predictions.matchId],
    references: [matches.id],
  }),
}));
