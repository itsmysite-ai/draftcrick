/**
 * Prediction Service — AI-generated questions, answer submission, grading, and standings.
 *
 * Handles the prediction league system: Gemini generates contextual questions per match,
 * users submit answers before deadlines, auto-grading resolves after match completion,
 * and standings track cumulative points with streak tracking.
 */

import { eq, and, desc, sql, inArray } from "drizzle-orm";
import type { Database } from "@draftplay/db";
import {
  predictionQuestions,
  predictionAnswers,
  predictionStandings,
} from "@draftplay/db";
import { getLogger } from "../lib/logger";
import { sendPushNotification } from "./notifications";

const log = getLogger("predictions");

// --- Types ---

type QuestionType =
  | "match_winner"
  | "victory_margin"
  | "top_scorer"
  | "top_wicket_taker"
  | "century_scored"
  | "first_innings_total"
  | "player_performance"
  | "sixes_count"
  | "custom_yes_no"
  | "custom_range"
  | "custom_multi_choice";

type Difficulty = "easy" | "medium" | "hard";

interface GeneratedQuestion {
  questionText: string;
  questionType: QuestionType;
  options: unknown[];
  difficulty: Difficulty;
  pointsValue: number;
  bonusForExact: boolean;
  deadlineType: "match_start" | "innings_break";
}

const DIFFICULTY_POINTS: Record<Difficulty, number> = {
  easy: 5,
  medium: 10,
  hard: 15,
};

const STREAK_BONUS = 2;

// --- AI Question Generation ---

export async function generateMatchQuestions(
  db: Database,
  matchId: string,
  tournamentId: string,
  teamA: string,
  teamB: string,
  format: string
): Promise<{ generated: number }> {
  log.info({ matchId, tournamentId, teamA, teamB, format }, "Generating prediction questions");

  let questions: GeneratedQuestion[];
  try {
    questions = await callGeminiForQuestions(teamA, teamB, format, tournamentId);
  } catch (err) {
    log.error({ err, matchId }, "Gemini question generation failed, using fallback");
    questions = getFallbackQuestions(teamA, teamB, format);
  }

  const rows = questions.map((q) => ({
    matchId,
    tournamentId,
    questionText: q.questionText,
    questionType: q.questionType,
    options: q.options,
    difficulty: q.difficulty,
    pointsValue: q.pointsValue,
    bonusForExact: q.bonusForExact,
    deadlineType: q.deadlineType,
    generatedBy: "ai" as const,
    isActive: true,
  }));

  if (rows.length > 0) {
    await db.insert(predictionQuestions).values(rows);
  }

  log.info({ matchId, count: rows.length }, "Prediction questions generated");
  return { generated: rows.length };
}

async function callGeminiForQuestions(
  teamA: string,
  teamB: string,
  format: string,
  tournamentId: string
): Promise<GeneratedQuestion[]> {
  const { createGeminiClientGlobal } = await import("./gemini-client");
  const ai = await createGeminiClientGlobal();

  const prompt = `Generate 6 prediction questions for a ${format} cricket match: ${teamA} vs ${teamB} in ${tournamentId}.

Return ONLY a JSON array of objects with these fields:
- questionText: string (the question)
- questionType: one of "match_winner", "victory_margin", "top_scorer", "top_wicket_taker", "century_scored", "first_innings_total", "sixes_count", "player_performance"
- options: array of string options for user to pick from (2-6 options)
- difficulty: "easy", "medium", or "hard"
- pointsValue: number (5 for easy, 10 for medium, 15 for hard)
- bonusForExact: boolean (true for numeric predictions like margin, total, sixes)
- deadlineType: "match_start" or "innings_break"

Include a mix of difficulties. Questions about first innings should use "innings_break" deadline.
Return valid JSON only, no markdown or explanation.`;

  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-lite-preview",
    contents: prompt,
    config: { temperature: 0.7, tools: [{ googleSearch: {} }] },
  });

  const text = response.text?.trim() ?? "[]";
  const cleaned = text.replace(/^```json?\n?/, "").replace(/\n?```$/, "");
  const parsed = JSON.parse(cleaned) as GeneratedQuestion[];

  return parsed.filter(
    (q) => q.questionText && q.questionType && Array.isArray(q.options)
  );
}

function getFallbackQuestions(
  teamA: string,
  teamB: string,
  format: string
): GeneratedQuestion[] {
  return [
    {
      questionText: `Who will win: ${teamA} or ${teamB}?`,
      questionType: "match_winner",
      options: [teamA, teamB, "Draw/No Result"],
      difficulty: "easy",
      pointsValue: 5,
      bonusForExact: false,
      deadlineType: "match_start",
    },
    {
      questionText: `What will be the first innings total?`,
      questionType: "first_innings_total",
      options: format === "T20"
        ? ["Under 140", "140-160", "160-180", "180-200", "Over 200"]
        : ["Under 200", "200-250", "250-300", "300-350", "Over 350"],
      difficulty: "medium",
      pointsValue: 10,
      bonusForExact: true,
      deadlineType: "match_start",
    },
    {
      questionText: `Who will be the top scorer of the match?`,
      questionType: "top_scorer",
      options: [`${teamA} player`, `${teamB} player`],
      difficulty: "hard",
      pointsValue: 15,
      bonusForExact: true,
      deadlineType: "match_start",
    },
    {
      questionText: `Who will take the most wickets?`,
      questionType: "top_wicket_taker",
      options: [`${teamA} bowler`, `${teamB} bowler`],
      difficulty: "hard",
      pointsValue: 15,
      bonusForExact: true,
      deadlineType: "match_start",
    },
    {
      questionText: `Will there be a century scored in this match?`,
      questionType: "century_scored",
      options: ["Yes", "No"],
      difficulty: "medium",
      pointsValue: 10,
      bonusForExact: false,
      deadlineType: "match_start",
    },
    {
      questionText: `How many sixes will be hit in total?`,
      questionType: "sixes_count",
      options: format === "T20"
        ? ["0-5", "6-10", "11-15", "16-20", "Over 20"]
        : ["0-5", "6-10", "11-15", "Over 15"],
      difficulty: "medium",
      pointsValue: 10,
      bonusForExact: true,
      deadlineType: "match_start",
    },
  ];
}

// --- Question Queries ---

export async function getQuestionsByMatch(
  db: Database,
  matchId: string,
  deadlineType?: string
) {
  const conditions = [
    eq(predictionQuestions.matchId, matchId),
    eq(predictionQuestions.isActive, true),
  ];
  if (deadlineType) {
    conditions.push(eq(predictionQuestions.deadlineType, deadlineType));
  }

  return db.query.predictionQuestions.findMany({
    where: and(...conditions),
    orderBy: [predictionQuestions.createdAt],
  });
}

// --- Answer Submission ---

export async function submitAnswer(
  db: Database,
  userId: string,
  questionId: string,
  leagueId: string,
  answer: string
) {
  log.info({ userId, questionId, leagueId }, "Submitting prediction answer");

  const question = await db.query.predictionQuestions.findFirst({
    where: eq(predictionQuestions.id, questionId),
  });

  if (!question) {
    throw new Error("Question not found");
  }

  if (!question.isActive) {
    throw new Error("This question is no longer accepting answers");
  }

  const [result] = await db
    .insert(predictionAnswers)
    .values({
      questionId,
      userId,
      leagueId,
      answer,
    })
    .onConflictDoUpdate({
      target: [
        predictionAnswers.questionId,
        predictionAnswers.userId,
        predictionAnswers.leagueId,
      ],
      set: { answer, submittedAt: sql`now()` },
    })
    .returning();

  return result;
}

// --- Get User Answers ---

export async function getUserAnswers(
  db: Database,
  userId: string,
  matchId: string,
  leagueId: string
) {
  const questions = await getQuestionsByMatch(db, matchId);
  const questionIds = questions.map((q) => q.id);

  if (questionIds.length === 0) return { questions, answers: [] };

  const answers = await db.query.predictionAnswers.findMany({
    where: and(
      inArray(predictionAnswers.questionId, questionIds),
      eq(predictionAnswers.userId, userId),
      eq(predictionAnswers.leagueId, leagueId)
    ),
  });

  return { questions, answers };
}

// --- Auto-Grading ---

export async function gradeMatchQuestions(
  db: Database,
  matchId: string,
  results: Record<string, string> // questionId → correctAnswer
): Promise<{ graded: number; notified: number }> {
  log.info({ matchId, questionCount: Object.keys(results).length }, "Grading prediction questions");

  const questions = await db.query.predictionQuestions.findMany({
    where: eq(predictionQuestions.matchId, matchId),
  });

  let graded = 0;

  for (const question of questions) {
    const correct = results[question.id];
    if (!correct) continue;

    // Set correct answer on the question
    await db
      .update(predictionQuestions)
      .set({ correctAnswer: correct, isActive: false })
      .where(eq(predictionQuestions.id, question.id));

    // Grade all answers for this question
    const answers = await db.query.predictionAnswers.findMany({
      where: eq(predictionAnswers.questionId, question.id),
    });

    for (const answer of answers) {
      const isCorrect = answer.answer.toLowerCase().trim() === correct.toLowerCase().trim();
      const basePoints = question.pointsValue ?? DIFFICULTY_POINTS[(question.difficulty ?? "medium") as Difficulty];
      // Apply streak bonus: check user's current streak from standings
      let streakBonus = 0;
      if (isCorrect && answer.userId && answer.leagueId) {
        const standing = await db.query.predictionStandings.findFirst({
          where: and(
            eq(predictionStandings.userId, answer.userId),
            eq(predictionStandings.leagueId, answer.leagueId),
          ),
        });
        if (standing && (standing.currentStreak ?? 0) >= 3) {
          streakBonus = STREAK_BONUS;
        }
      }
      const pointsAwarded = isCorrect ? basePoints + streakBonus : 0;

      await db
        .update(predictionAnswers)
        .set({ isCorrect, pointsAwarded })
        .where(eq(predictionAnswers.id, answer.id));

      graded++;
    }
  }

  // Update standings for all users who answered
  const allAnswers = await db.query.predictionAnswers.findMany({
    where: inArray(
      predictionAnswers.questionId,
      questions.map((q) => q.id)
    ),
    with: { question: true },
  });

  // Group by userId+leagueId and send notifications
  const userLeagueMap = new Map<string, { userId: string; leagueId: string; correct: number; total: number }>();
  for (const a of allAnswers) {
    if (!a.userId || !a.leagueId) continue;
    const key = `${a.userId}:${a.leagueId}`;
    if (!userLeagueMap.has(key)) {
      userLeagueMap.set(key, { userId: a.userId, leagueId: a.leagueId, correct: 0, total: 0 });
    }
    const entry = userLeagueMap.get(key)!;
    entry.total++;
    if (a.isCorrect) entry.correct++;
  }

  let notified = 0;
  const tournamentId = questions[0]?.tournamentId;
  for (const entry of userLeagueMap.values()) {
    if (tournamentId) {
      await updateStandings(db, entry.leagueId, entry.userId, tournamentId);
    }
    try {
      await sendPushNotification(
        db,
        entry.userId,
        "prediction_result",
        "Prediction Results",
        `You got ${entry.correct}/${entry.total} predictions right!`,
        { matchId }
      );
      notified++;
    } catch {
      // Notification failure shouldn't block grading
    }
  }

  log.info({ matchId, graded, notified }, "Prediction grading complete");
  return { graded, notified };
}

// --- Standings ---

export async function updateStandings(
  db: Database,
  leagueId: string,
  userId: string,
  tournamentId: string
) {
  // Aggregate all answers for this user in this league/tournament
  const answers = await db.query.predictionAnswers.findMany({
    where: and(
      eq(predictionAnswers.userId, userId),
      eq(predictionAnswers.leagueId, leagueId)
    ),
    with: { question: true },
  });

  // Filter to answers for questions in this tournament
  const relevant = answers.filter((a) => a.question?.tournamentId === tournamentId);

  const totalPredictions = relevant.length;
  const correctPredictions = relevant.filter((a) => a.isCorrect === true).length;
  const totalPoints = relevant.reduce((sum, a) => sum + (a.pointsAwarded ?? 0), 0);
  const accuracyPct = totalPredictions > 0
    ? ((correctPredictions / totalPredictions) * 100).toFixed(2)
    : "0";

  // Calculate streaks (ordered by submittedAt)
  const sorted = [...relevant].sort(
    (a, b) => new Date(a.submittedAt!).getTime() - new Date(b.submittedAt!).getTime()
  );

  let currentStreak = 0;
  let bestStreak = 0;
  let streak = 0;
  for (const a of sorted) {
    if (a.isCorrect === true) {
      streak++;
      if (streak > bestStreak) bestStreak = streak;
    } else if (a.isCorrect === false) {
      streak = 0;
    }
    // null = not graded yet, skip
  }
  currentStreak = streak;

  await db
    .insert(predictionStandings)
    .values({
      leagueId,
      userId,
      tournamentId,
      totalPoints,
      correctPredictions,
      totalPredictions,
      accuracyPct,
      currentStreak,
      bestStreak,
    })
    .onConflictDoUpdate({
      target: [
        predictionStandings.leagueId,
        predictionStandings.userId,
        predictionStandings.tournamentId,
      ],
      set: {
        totalPoints,
        correctPredictions,
        totalPredictions,
        accuracyPct,
        currentStreak,
        bestStreak,
      },
    });
}

export async function getStandings(
  db: Database,
  leagueId: string,
  tournamentId: string
) {
  return db.query.predictionStandings.findMany({
    where: and(
      eq(predictionStandings.leagueId, leagueId),
      eq(predictionStandings.tournamentId, tournamentId)
    ),
    orderBy: [desc(predictionStandings.totalPoints)],
  });
}

export async function getUserStreaks(
  db: Database,
  userId: string,
  leagueId: string,
  tournamentId: string
) {
  const standing = await db.query.predictionStandings.findFirst({
    where: and(
      eq(predictionStandings.userId, userId),
      eq(predictionStandings.leagueId, leagueId),
      eq(predictionStandings.tournamentId, tournamentId)
    ),
  });

  return {
    currentStreak: standing?.currentStreak ?? 0,
    bestStreak: standing?.bestStreak ?? 0,
    totalPoints: standing?.totalPoints ?? 0,
    correctPredictions: standing?.correctPredictions ?? 0,
    totalPredictions: standing?.totalPredictions ?? 0,
    accuracy: standing?.accuracyPct ?? "0",
  };
}

// --- Create Custom Question (Admin) ---

export async function createQuestion(
  db: Database,
  matchId: string,
  tournamentId: string,
  questionText: string,
  questionType: string,
  options: unknown[],
  difficulty?: string,
  pointsValue?: number
) {
  const [question] = await db
    .insert(predictionQuestions)
    .values({
      matchId,
      tournamentId,
      questionText,
      questionType,
      options,
      difficulty: difficulty ?? "medium",
      pointsValue: pointsValue ?? DIFFICULTY_POINTS[(difficulty ?? "medium") as Difficulty],
      generatedBy: "admin",
      isActive: true,
    })
    .returning();

  log.info({ questionId: question!.id, matchId }, "Custom prediction question created");
  return question;
}
