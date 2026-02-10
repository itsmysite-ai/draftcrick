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
import { leagues } from "./contests";

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

// ============================================================
// PREDICTION QUESTIONS
// ============================================================
export const predictionQuestions = pgTable(
  "prediction_questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    matchId: text("match_id").notNull(),
    tournamentId: text("tournament_id").notNull(),

    questionText: text("question_text").notNull(),
    questionType: text("question_type").notNull(), // match_winner, victory_margin, top_scorer, top_wicket_taker, century_scored, first_innings_total, player_performance, sixes_count, custom_yes_no, custom_range, custom_multi_choice

    options: jsonb("options").notNull(),
    correctAnswer: text("correct_answer"),
    difficulty: text("difficulty").default("medium"), // easy, medium, hard
    pointsValue: integer("points_value").default(10),
    bonusForExact: boolean("bonus_for_exact").default(false),

    deadlineType: text("deadline_type").default("match_start"), // match_start, innings_break, custom
    customDeadline: timestamp("custom_deadline", { withTimezone: true }),

    generatedBy: text("generated_by").default("admin"), // admin, ai, system
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_prediction_questions_match").on(table.matchId),
  ]
);

// ============================================================
// PREDICTION ANSWERS
// ============================================================
export const predictionAnswers = pgTable(
  "prediction_answers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    questionId: uuid("question_id").references(() => predictionQuestions.id),
    userId: uuid("user_id").references(() => users.id),
    leagueId: uuid("league_id").references(() => leagues.id),

    answer: text("answer").notNull(),
    isCorrect: boolean("is_correct"),
    pointsAwarded: integer("points_awarded").default(0),

    submittedAt: timestamp("submitted_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    unique("uq_prediction_answer").on(table.questionId, table.userId, table.leagueId),
  ]
);

// ============================================================
// PREDICTION STANDINGS
// ============================================================
export const predictionStandings = pgTable(
  "prediction_standings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leagueId: uuid("league_id").references(() => leagues.id),
    userId: uuid("user_id").references(() => users.id),
    tournamentId: text("tournament_id").notNull(),

    totalPoints: integer("total_points").default(0),
    correctPredictions: integer("correct_predictions").default(0),
    totalPredictions: integer("total_predictions").default(0),
    accuracyPct: decimal("accuracy_pct", { precision: 5, scale: 2 }).default("0"),
    currentStreak: integer("current_streak").default(0),
    bestStreak: integer("best_streak").default(0),
  },
  (table) => [
    unique("uq_prediction_standing").on(table.leagueId, table.userId, table.tournamentId),
  ]
);

// Relations for new prediction tables
export const predictionQuestionsRelations = relations(predictionQuestions, ({ many }) => ({
  answers: many(predictionAnswers),
}));

export const predictionAnswersRelations = relations(predictionAnswers, ({ one }) => ({
  question: one(predictionQuestions, {
    fields: [predictionAnswers.questionId],
    references: [predictionQuestions.id],
  }),
  user: one(users, {
    fields: [predictionAnswers.userId],
    references: [users.id],
  }),
  league: one(leagues, {
    fields: [predictionAnswers.leagueId],
    references: [leagues.id],
  }),
}));

export const predictionStandingsRelations = relations(predictionStandings, ({ one }) => ({
  league: one(leagues, {
    fields: [predictionStandings.leagueId],
    references: [leagues.id],
  }),
  user: one(users, {
    fields: [predictionStandings.userId],
    references: [users.id],
  }),
}));
