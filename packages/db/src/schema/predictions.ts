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
import { leagues, contests } from "./contests";

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

// ============================================================
// LIVE MINI-PREDICTIONS (community-driven, during live matches)
// ============================================================

/**
 * A live prediction created by a league member during a match.
 * Points awarded/deducted are added to the creator & voters' fantasy totals.
 */
export const livePredictions = pgTable(
  "live_predictions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contestId: uuid("contest_id")
      .notNull()
      .references(() => contests.id),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id),
    creatorId: uuid("creator_id")
      .notNull()
      .references(() => users.id),

    question: text("question").notNull(),
    optionA: text("option_a").notNull(),
    optionB: text("option_b").notNull(),

    // AI-rated difficulty determines point values
    difficulty: text("difficulty").notNull().default("easy"), // easy, medium, hard
    ptsCorrect: integer("pts_correct").notNull().default(5),  // +5 / +10 / +20
    ptsWrong: integer("pts_wrong").notNull().default(-2),     // -2 / -5 / -10

    // Deadline
    deadlineType: text("deadline_type").notNull().default("end_of_over"), // end_of_over, end_of_innings, end_of_match
    deadlineAt: timestamp("deadline_at", { withTimezone: true }), // optional hard deadline

    // Resolution
    result: text("result"), // "a" or "b" — null until resolved
    aiExplanation: text("ai_explanation"), // one-line explanation from AI
    aiRoast: text("ai_roast"), // fun one-liner from AI after resolution
    resolvedBy: text("resolved_by"), // "ai", "user:{userId}", or null
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),

    // Stats
    votesA: integer("votes_a").notNull().default(0),
    votesB: integer("votes_b").notNull().default(0),

    status: text("status").notNull().default("open"), // open, closed, resolved, cancelled
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_live_predictions_contest").on(table.contestId),
    index("idx_live_predictions_match").on(table.matchId),
    index("idx_live_predictions_status").on(table.status),
  ]
);

/**
 * A vote on a live prediction. One vote per user per prediction.
 */
export const livePredictionVotes = pgTable(
  "live_prediction_votes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    predictionId: uuid("prediction_id")
      .notNull()
      .references(() => livePredictions.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    pickedOption: text("picked_option").notNull(), // "a" or "b"
    pointsAwarded: integer("points_awarded"), // set after resolution (+pts or -pts)
    votedAt: timestamp("voted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("uq_live_prediction_vote").on(table.predictionId, table.userId),
    index("idx_live_prediction_votes_prediction").on(table.predictionId),
  ]
);

// ── Live Prediction Comments ──────────────────────────────────────

export const livePredictionComments = pgTable(
  "live_prediction_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    predictionId: uuid("prediction_id")
      .notNull()
      .references(() => livePredictions.id),
    userId: uuid("user_id")
      .references(() => users.id), // null for system messages (AI roast)
    isSystem: boolean("is_system").notNull().default(false),
    message: text("message").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_live_prediction_comments_pred").on(table.predictionId),
  ]
);

// Relations for live predictions
export const livePredictionsRelations = relations(livePredictions, ({ one, many }) => ({
  contest: one(contests, {
    fields: [livePredictions.contestId],
    references: [contests.id],
  }),
  match: one(matches, {
    fields: [livePredictions.matchId],
    references: [matches.id],
  }),
  creator: one(users, {
    fields: [livePredictions.creatorId],
    references: [users.id],
  }),
  votes: many(livePredictionVotes),
  comments: many(livePredictionComments),
}));

export const livePredictionVotesRelations = relations(livePredictionVotes, ({ one }) => ({
  prediction: one(livePredictions, {
    fields: [livePredictionVotes.predictionId],
    references: [livePredictions.id],
  }),
  user: one(users, {
    fields: [livePredictionVotes.userId],
    references: [users.id],
  }),
}));

export const livePredictionCommentsRelations = relations(livePredictionComments, ({ one }) => ({
  prediction: one(livePredictions, {
    fields: [livePredictionComments.predictionId],
    references: [livePredictions.id],
  }),
  user: one(users, {
    fields: [livePredictionComments.userId],
    references: [users.id],
  }),
}));
