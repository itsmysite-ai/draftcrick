/**
 * Live Mini-Predictions Engine.
 *
 * Community-driven predictions during live matches.
 * League members create questions, vote on outcomes,
 * and earn/lose fantasy points based on results.
 *
 * AI assists with:
 *  - Rating question difficulty (determines point values)
 *  - Suggesting predictions based on match state
 *  - Auto-resolving predictions using ball-by-ball data
 *  - Generating fun one-liners after resolution
 */

import { eq, and, sql, desc, ne, inArray } from "drizzle-orm";
import type { Database } from "@draftplay/db";
import { livePredictions, livePredictionVotes, livePredictionComments, fantasyTeams, users, contests } from "@draftplay/db";
import { createGeminiClientGlobal, GEMINI_MODEL } from "./gemini-client";
import { getLogger } from "../lib/logger";
import { sendBatchNotifications, NOTIFICATION_TYPES } from "./notifications";

const log = getLogger("live-predictions");

// Point values by difficulty
const DIFFICULTY_CONFIG = {
  easy:   { ptsCorrect: 5,  ptsWrong: -2  },
  medium: { ptsCorrect: 10, ptsWrong: -5  },
  hard:   { ptsCorrect: 20, ptsWrong: -10 },
} as const;

type Difficulty = keyof typeof DIFFICULTY_CONFIG;

// Max predictions per user per match, max votes per user per match
const MAX_CREATED_PER_USER_PER_MATCH = 11;
const MAX_VOTES_PER_USER_PER_MATCH = 25;
const MAX_PREDICTION_POINTS_PER_MATCH = 50; // cap total impact ±50
const MIN_VOTER_FLOOR = 2; // absolute minimum non-creator votes
const MIN_VOTER_PCT = 0.25; // 25% of contest members (excl. creator)

// ─── CREATE ─────────────────────────────────────────────────────────

export async function createLivePrediction(
  db: Database,
  contestId: string,
  matchId: string,
  creatorId: string,
  question: string,
  optionA: string,
  optionB: string,
  deadlineType: string,
  matchContext?: { teamA?: string; teamB?: string; format?: string; score?: string },
): Promise<typeof livePredictions.$inferSelect> {
  // Check creator hasn't exceeded limit (per contest, not per match)
  const creatorCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(livePredictions)
    .where(and(
      eq(livePredictions.contestId, contestId),
      eq(livePredictions.creatorId, creatorId),
      ne(livePredictions.status, "abandoned"),
    ));

  if (Number(creatorCount[0]?.count ?? 0) >= MAX_CREATED_PER_USER_PER_MATCH) {
    throw new Error(`You can only create ${MAX_CREATED_PER_USER_PER_MATCH} predictions per contest`);
  }

  // AI rates difficulty
  const difficulty = await rateDifficulty(question, optionA, optionB, matchContext);
  const pts = DIFFICULTY_CONFIG[difficulty];

  const [prediction] = await db
    .insert(livePredictions)
    .values({
      contestId,
      matchId,
      creatorId,
      question,
      optionA,
      optionB,
      difficulty,
      ptsCorrect: pts.ptsCorrect,
      ptsWrong: pts.ptsWrong,
      deadlineType,
      status: "open",
    })
    .returning();

  log.info({ predictionId: prediction!.id, question, difficulty }, "Live prediction created");

  // Notify other contest members about the new prediction
  notifyContestMembers(db, contestId, creatorId, question, prediction!.id).catch((err) =>
    log.warn({ err }, "Failed to send prediction notifications")
  );

  return prediction!;
}

/** Fire-and-forget: notify other members in this contest */
async function notifyContestMembers(
  db: Database,
  contestId: string,
  creatorId: string,
  question: string,
  predictionId: string,
) {
  // Get all users in this contest except the creator
  const members = await db
    .select({ userId: fantasyTeams.userId })
    .from(fantasyTeams)
    .where(and(
      eq(fantasyTeams.contestId, contestId),
      ne(fantasyTeams.userId, creatorId),
    ));

  if (members.length === 0) return;

  // Get creator display name
  const creator = await db.query.users.findFirst({
    where: eq(users.id, creatorId),
    columns: { displayName: true, email: true },
  });
  const creatorName = creator?.displayName ?? creator?.email?.split("@")[0] ?? "someone";

  const memberIds = members.map((m) => m.userId);
  const shortQuestion = question.length > 60 ? question.slice(0, 57) + "..." : question;

  await sendBatchNotifications(
    db,
    memberIds,
    NOTIFICATION_TYPES.PREDICTION_POSTED,
    `${creatorName} posted a prediction`,
    shortQuestion,
    { contestId, predictionId },
  );
}

// ─── CLOSE (creator locks voting before resolving) ──────────────────

/**
 * Close a prediction — only the creator can do this.
 * Stops new votes from being cast. Creator must then resolve it.
 */
export async function closeLivePrediction(
  db: Database,
  predictionId: string,
  userId: string,
): Promise<void> {
  const prediction = await db.query.livePredictions.findFirst({
    where: eq(livePredictions.id, predictionId),
  });

  if (!prediction) throw new Error("Prediction not found");
  if (prediction.creatorId !== userId) throw new Error("Only the creator can close this prediction");
  if (prediction.status !== "open") throw new Error("Prediction is not open");

  await db
    .update(livePredictions)
    .set({ status: "closed" })
    .where(eq(livePredictions.id, predictionId));

  log.info({ predictionId, userId }, "Prediction closed by creator");
}

// ─── VOTE ───────────────────────────────────────────────────────────

export async function voteLivePrediction(
  db: Database,
  predictionId: string,
  userId: string,
  pickedOption: "a" | "b",
): Promise<typeof livePredictionVotes.$inferSelect> {
  // Get prediction
  const prediction = await db.query.livePredictions.findFirst({
    where: eq(livePredictions.id, predictionId),
  });

  if (!prediction) throw new Error("Prediction not found");
  if (prediction.status !== "open") throw new Error("Prediction is no longer open for voting");

  // Insert vote (unique constraint prevents double-voting)
  const [vote] = await db
    .insert(livePredictionVotes)
    .values({ predictionId, userId, pickedOption })
    .returning();

  // Update vote counts
  const col = pickedOption === "a" ? livePredictions.votesA : livePredictions.votesB;
  await db
    .update(livePredictions)
    .set({ [pickedOption === "a" ? "votesA" : "votesB"]: sql`${col} + 1` })
    .where(eq(livePredictions.id, predictionId));

  log.info({ predictionId, userId, pickedOption }, "Vote cast");
  return vote!;
}

// ─── RESOLVE ────────────────────────────────────────────────────────

/**
 * Resolve a prediction — can be called by any league member, or by the AI auto-resolver.
 * Awards/deducts fantasy points from each voter's contest total.
 */
export async function resolveLivePrediction(
  db: Database,
  predictionId: string,
  winningOption: "a" | "b",
  resolvedBy: string, // "ai" or "user:{userId}"
  aiExplanation?: string,
): Promise<{ winners: number; losers: number }> {
  const prediction = await db.query.livePredictions.findFirst({
    where: eq(livePredictions.id, predictionId),
  });

  if (!prediction) throw new Error("Prediction not found");
  if (prediction.status === "resolved") throw new Error("Already resolved");

  // Only the creator (or AI) can resolve
  if (resolvedBy.startsWith("user:")) {
    const userId = resolvedBy.replace("user:", "");
    if (prediction.creatorId !== userId) {
      throw new Error("Only the creator can resolve this prediction");
    }
  }

  // Check if any non-creator users voted — creator's own vote doesn't count
  const nonCreatorVotes = await db
    .select({ count: sql<number>`count(*)` })
    .from(livePredictionVotes)
    .where(and(
      eq(livePredictionVotes.predictionId, predictionId),
      ne(livePredictionVotes.userId, prediction.creatorId),
    ));

  const nonCreatorCount = Number(nonCreatorVotes[0]?.count ?? 0);

  if (nonCreatorCount === 0) {
    await db
      .update(livePredictions)
      .set({ status: "abandoned", resolvedBy, resolvedAt: new Date() })
      .where(eq(livePredictions.id, predictionId));
    log.info({ predictionId }, "Prediction abandoned — no non-creator votes");
    return { winners: 0, losers: 0, abandoned: true } as any;
  }

  // Minimum voter threshold: max(2, 25% of contest members excl. creator)
  const contest = await db.query.contests.findFirst({
    where: eq(contests.id, prediction.contestId),
    columns: { currentEntries: true },
  });
  const memberCount = Math.max(0, (contest?.currentEntries ?? 1) - 1); // exclude creator
  // For small groups (duels, 3-person): require at least 1 non-creator vote
  // For larger groups: max(2, 25% of members)
  const minVoters = memberCount <= 2 ? 1 : Math.max(MIN_VOTER_FLOOR, Math.ceil(memberCount * MIN_VOTER_PCT));

  if (nonCreatorCount < minVoters) {
    throw new Error(
      `Not enough votes to resolve. Need at least ${minVoters} votes, got ${nonCreatorCount}. ` +
      `Wait for more people to vote or mark as abandoned.`
    );
  }

  // Generate AI roast
  const roast = await generateRoast(prediction.question, winningOption === "a" ? prediction.optionA : prediction.optionB);

  // Mark as resolved
  await db
    .update(livePredictions)
    .set({
      result: winningOption,
      status: "resolved",
      resolvedBy,
      resolvedAt: new Date(),
      aiExplanation: aiExplanation ?? null,
      aiRoast: roast,
    })
    .where(eq(livePredictions.id, predictionId));

  // Auto-post roast + result as system comment
  const winnerLabel = winningOption === "a" ? prediction.optionA : prediction.optionB;
  const resultMsg = `✅ Result: ${winnerLabel}`;
  await db.insert(livePredictionComments).values({
    predictionId,
    isSystem: true,
    message: roast ? `${resultMsg}\n\n${roast}` : resultMsg,
  });

  // Get all votes
  const votes = await db.query.livePredictionVotes.findMany({
    where: eq(livePredictionVotes.predictionId, predictionId),
  });

  let winners = 0;
  let losers = 0;

  for (const vote of votes) {
    const isCorrect = vote.pickedOption === winningOption;
    const points = isCorrect ? prediction.ptsCorrect : prediction.ptsWrong;

    // Update vote record
    await db
      .update(livePredictionVotes)
      .set({ pointsAwarded: points })
      .where(eq(livePredictionVotes.id, vote.id));

    // Update fantasy team's prediction points (capped at ±MAX)
    // Find the user's team in this contest
    const team = await db.query.fantasyTeams.findFirst({
      where: and(
        eq(fantasyTeams.userId, vote.userId),
        eq(fantasyTeams.contestId, prediction.contestId),
      ),
      columns: { id: true, predictionPoints: true },
    });

    if (team) {
      const currentPredPts = Number(team.predictionPoints);
      const newPredPts = Math.max(-MAX_PREDICTION_POINTS_PER_MATCH, Math.min(MAX_PREDICTION_POINTS_PER_MATCH, currentPredPts + points));
      const actualDelta = newPredPts - currentPredPts;

      if (actualDelta !== 0) {
        await db
          .update(fantasyTeams)
          .set({
            predictionPoints: String(newPredPts),
            totalPoints: sql`${fantasyTeams.totalPoints} + ${actualDelta}`,
          })
          .where(eq(fantasyTeams.id, team.id));
      }
    }

    if (isCorrect) winners++;
    else losers++;
  }

  log.info({ predictionId, winningOption, winners, losers }, "Prediction resolved");
  return { winners, losers };
}

// ─── LIST ───────────────────────────────────────────────────────────

export async function listLivePredictions(
  db: Database,
  contestId: string,
  matchId: string,
  userId?: string,
) {
  const preds = await db.query.livePredictions.findMany({
    where: and(
      eq(livePredictions.contestId, contestId),
      eq(livePredictions.matchId, matchId),
    ),
    orderBy: [desc(livePredictions.createdAt)],
    with: {
      creator: { columns: { id: true, displayName: true, username: true } },
      votes: {
        columns: { userId: true, pickedOption: true, pointsAwarded: true },
        with: { user: { columns: { displayName: true, username: true } } },
      },
    },
  });

  // Fetch comment counts for all predictions in one query
  const predIds = preds.map((p) => p.id);
  const commentCounts: Record<string, number> = {};
  if (predIds.length > 0) {
    const countRows = await db
      .select({
        predictionId: livePredictionComments.predictionId,
        count: sql<number>`count(*)`.as("count"),
      })
      .from(livePredictionComments)
      .where(inArray(livePredictionComments.predictionId, predIds))
      .groupBy(livePredictionComments.predictionId);
    for (const row of countRows) {
      commentCounts[row.predictionId] = Number(row.count);
    }
  }

  return preds.map((p) => {
    const myVote = userId ? p.votes.find((v) => v.userId === userId) : null;
    const voterName = (v: any) =>
      v.user?.displayName || v.user?.username?.split("@")[0] || "anon";

    return {
      ...p,
      myVote: myVote ? { pickedOption: myVote.pickedOption, pointsAwarded: myVote.pointsAwarded } : null,
      creatorName: p.creator?.displayName || p.creator?.username?.split("@")[0] || "Unknown",
      totalVotes: p.votesA + p.votesB,
      pctA: p.votesA + p.votesB > 0 ? Math.round((p.votesA / (p.votesA + p.votesB)) * 100) : 50,
      pctB: p.votesA + p.votesB > 0 ? Math.round((p.votesB / (p.votesA + p.votesB)) * 100) : 50,
      // Who picked what — shown after voting
      votersA: p.votes.filter((v) => v.pickedOption === "a").map((v) => voterName(v)),
      votersB: p.votes.filter((v) => v.pickedOption === "b").map((v) => voterName(v)),
      commentCount: commentCounts[p.id] ?? 0,
    };
  });
}

// ─── USER TITLES ────────────────────────────────────────────────────

/**
 * Calculate fun auto-title for a user based on their prediction history in a match.
 */
export async function getUserPredictionTitle(
  db: Database,
  userId: string,
  matchId: string,
): Promise<string | null> {
  const votes = await db
    .select({
      pointsAwarded: livePredictionVotes.pointsAwarded,
    })
    .from(livePredictionVotes)
    .innerJoin(livePredictions, eq(livePredictionVotes.predictionId, livePredictions.id))
    .where(and(
      eq(livePredictions.matchId, matchId),
      eq(livePredictionVotes.userId, userId),
      eq(livePredictions.status, "resolved"),
    ));

  if (votes.length === 0) return null;

  const resolved = votes.filter((v) => v.pointsAwarded !== null);
  if (resolved.length === 0) return null;

  const correct = resolved.filter((v) => (v.pointsAwarded ?? 0) > 0).length;
  const wrong = resolved.length - correct;
  const totalPts = resolved.reduce((s, v) => s + (v.pointsAwarded ?? 0), 0);

  // Streak detection — check last N consecutive results
  let streak = 0;
  let streakType: "win" | "loss" | null = null;
  for (let i = resolved.length - 1; i >= 0; i--) {
    const isWin = (resolved[i]!.pointsAwarded ?? 0) > 0;
    if (streakType === null) {
      streakType = isWin ? "win" : "loss";
      streak = 1;
    } else if ((isWin && streakType === "win") || (!isWin && streakType === "loss")) {
      streak++;
    } else {
      break;
    }
  }

  if (streakType === "win" && streak >= 5) return "prophet";
  if (streakType === "win" && streak >= 3) return "on fire";
  if (streakType === "loss" && streak >= 3) return "cursed";
  if (totalPts <= -20) return "ATM";
  if (totalPts >= 30) return "shark";
  if (correct > 0 && wrong === 0 && resolved.length >= 2) return "flawless";

  return null;
}

// ─── ABANDON (creator gives up on low-participation prediction) ─────

/**
 * Creator explicitly abandons a prediction that didn't get enough votes.
 */
export async function abandonLivePrediction(
  db: Database,
  predictionId: string,
  userId: string,
): Promise<void> {
  const prediction = await db.query.livePredictions.findFirst({
    where: eq(livePredictions.id, predictionId),
  });

  if (!prediction) throw new Error("Prediction not found");
  if (prediction.creatorId !== userId) throw new Error("Only the creator can abandon this prediction");
  if (prediction.status === "resolved") throw new Error("Cannot abandon a resolved prediction");

  await db
    .update(livePredictions)
    .set({ status: "abandoned", resolvedBy: `user:${userId}`, resolvedAt: new Date() })
    .where(eq(livePredictions.id, predictionId));

  log.info({ predictionId, userId }, "Prediction abandoned by creator");
}

// ─── AUTO-CLOSE (called when match ends) ────────────────────────────

/**
 * Auto-close and abandon all open/closed predictions for a match.
 * Called from match-lifecycle when phase → post_match.
 */
export async function autoCloseMatchPredictions(
  db: Database,
  matchId: string,
): Promise<{ closed: number; abandoned: number }> {
  // Get all contests for this match
  const matchContests = await db.query.contests.findMany({
    where: eq(contests.matchId, matchId),
    columns: { id: true },
  });
  if (matchContests.length === 0) return { closed: 0, abandoned: 0 };

  const contestIds = matchContests.map((c) => c.id);

  // Find all open or closed (unresolved) predictions
  const openPreds = await db.query.livePredictions.findMany({
    where: and(
      inArray(livePredictions.contestId, contestIds),
      inArray(livePredictions.status, ["open", "closed"]),
    ),
  });

  let closed = 0;
  let abandoned = 0;

  for (const pred of openPreds) {
    // Check if any non-creator votes exist
    const nonCreatorVoteCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(livePredictionVotes)
      .where(and(
        eq(livePredictionVotes.predictionId, pred.id),
        ne(livePredictionVotes.userId, pred.creatorId),
      ));

    const hasNonCreatorVotes = Number(nonCreatorVoteCount[0]?.count ?? 0) > 0;

    if (hasNonCreatorVotes) {
      // Close it — creator can still resolve after match ends
      if (pred.status === "open") {
        await db
          .update(livePredictions)
          .set({ status: "closed" })
          .where(eq(livePredictions.id, pred.id));
        closed++;
      }
    } else {
      // No non-creator votes → abandon
      await db
        .update(livePredictions)
        .set({ status: "abandoned", resolvedBy: "system:match_ended", resolvedAt: new Date() })
        .where(eq(livePredictions.id, pred.id));
      abandoned++;
    }
  }

  log.info({ matchId, closed, abandoned }, "Auto-closed predictions on match end");
  return { closed, abandoned };
}

/**
 * After the 15-min grace period: abandon all predictions still in "closed" (unresolved) state.
 * Called from finalizePredictionsAndSettle after the deadline expires.
 */
export async function autoAbandonUnresolvedPredictions(
  db: Database,
  matchId: string,
): Promise<{ abandoned: number }> {
  const matchContests = await db.query.contests.findMany({
    where: eq(contests.matchId, matchId),
    columns: { id: true },
  });
  if (matchContests.length === 0) return { abandoned: 0 };

  const contestIds = matchContests.map((c) => c.id);

  // Find all still-unresolved predictions (closed but not resolved)
  const unresolvedPreds = await db.query.livePredictions.findMany({
    where: and(
      inArray(livePredictions.contestId, contestIds),
      inArray(livePredictions.status, ["open", "closed"]),
    ),
    columns: { id: true },
  });

  let abandoned = 0;
  for (const pred of unresolvedPreds) {
    await db
      .update(livePredictions)
      .set({ status: "abandoned", resolvedBy: "system:deadline_expired", resolvedAt: new Date() })
      .where(eq(livePredictions.id, pred.id));

    // Post system comment
    await db.insert(livePredictionComments).values({
      predictionId: pred.id,
      isSystem: true,
      message: "⏰ Time's up! This prediction was auto-abandoned — no one resolved it within 15 minutes.",
    });
    abandoned++;
  }

  log.info({ matchId, abandoned }, "Auto-abandoned unresolved predictions after deadline");
  return { abandoned };
}

// ─── AI HELPERS ─────────────────────────────────────────────────────

/**
 * AI rates the difficulty of a user-created prediction.
 */
async function rateDifficulty(
  question: string,
  optionA: string,
  optionB: string,
  matchContext?: { teamA?: string; teamB?: string; format?: string; score?: string },
): Promise<Difficulty> {
  try {
    const client = await createGeminiClientGlobal();
    const prompt = `You are rating the difficulty of a cricket prediction question for a fantasy game.

Match: ${matchContext?.teamA ?? "Team A"} vs ${matchContext?.teamB ?? "Team B"} (${matchContext?.format ?? "T20"})
${matchContext?.score ? `Current score: ${matchContext.score}` : ""}

Question: "${question}"
Option A: "${optionA}"
Option B: "${optionB}"

Rate the difficulty as exactly one word: easy, medium, or hard.
- easy: roughly 50/50 chance, common cricket event (boundary this over, wicket this over)
- medium: requires cricket knowledge, 20-40% probability (specific player milestone, exact margin)
- hard: very specific, <15% probability (exact score, first-ball wicket, specific dismissal type)

Reply with ONLY one word: easy, medium, or hard.`;

    const response = await client.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
    });

    const text = (response.text ?? "").trim().toLowerCase();
    if (text === "easy" || text === "medium" || text === "hard") return text;
    return "easy"; // default
  } catch (err) {
    log.warn({ err: String(err) }, "AI difficulty rating failed, defaulting to easy");
    return "easy";
  }
}

/**
 * AI suggests 2-3 predictions based on current match state.
 */
export async function suggestPredictions(
  matchContext: {
    teamA: string;
    teamB: string;
    format: string;
    score?: string;
    overs?: string;
    recentEvents?: string;
  },
): Promise<Array<{ question: string; optionA: string; optionB: string }>> {
  try {
    const client = await createGeminiClientGlobal();
    const prompt = `You are creating fun prediction questions for a fantasy cricket league group chat during a live match.

Match: ${matchContext.teamA} vs ${matchContext.teamB} (${matchContext.format})
${matchContext.score ? `Score: ${matchContext.score}` : "Match just started"}
${matchContext.overs ? `Overs: ${matchContext.overs}` : ""}
${matchContext.recentEvents ? `Recent: ${matchContext.recentEvents}` : ""}

Generate exactly 3 fun, casual cricket prediction questions that friends would bet on while watching together.
Each must be a binary A/B or Yes/No question that resolves within the next few overs or by end of innings.

Keep them short, informal, fun — like something you'd ask in a WhatsApp group.

Reply in this exact JSON format, nothing else:
[
  {"question": "...", "optionA": "...", "optionB": "..."},
  {"question": "...", "optionA": "...", "optionB": "..."},
  {"question": "...", "optionA": "...", "optionB": "..."}
]`;

    const response = await client.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
    });

    const text = (response.text ?? "").trim();
    // Extract JSON from response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const suggestions = JSON.parse(jsonMatch[0]);
    return suggestions.filter((s: any) => s.question && s.optionA && s.optionB).slice(0, 3);
  } catch (err) {
    log.warn({ err: String(err) }, "AI suggestion generation failed");
    return [];
  }
}

/**
 * AI attempts to resolve a prediction using match data.
 * Returns null if it can't determine the answer confidently.
 */
export async function aiResolvePrediction(
  prediction: { question: string; optionA: string; optionB: string },
  matchData: { score?: string; recentEvents?: string; ballByBall?: string },
): Promise<{ winner: "a" | "b"; explanation: string } | null> {
  try {
    const client = await createGeminiClientGlobal();
    const prompt = `You are resolving a cricket prediction question based on match data.

Question: "${prediction.question}"
Option A: "${prediction.optionA}"
Option B: "${prediction.optionB}"

Match data:
${matchData.score ? `Score: ${matchData.score}` : ""}
${matchData.recentEvents ? `Recent events: ${matchData.recentEvents}` : ""}
${matchData.ballByBall ? `Ball-by-ball: ${matchData.ballByBall}` : ""}

Can you determine which option won based on this data?

If YES, reply in this exact JSON format:
{"winner": "a" or "b", "explanation": "one line explanation", "confident": true}

If the data is insufficient or ambiguous, reply:
{"confident": false}`;

    const response = await client.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
    });

    const text = (response.text ?? "").trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const result = JSON.parse(jsonMatch[0]);
    if (!result.confident) return null;
    if (result.winner !== "a" && result.winner !== "b") return null;

    return { winner: result.winner, explanation: result.explanation || "" };
  } catch (err) {
    log.warn({ err: String(err) }, "AI resolution failed");
    return null;
  }
}

/**
 * AI generates a fun one-liner after a prediction resolves.
 */
async function generateRoast(question: string, winningAnswer: string): Promise<string | null> {
  try {
    const client = await createGeminiClientGlobal();
    const prompt = `A group of friends were betting on cricket predictions in their fantasy league.

The prediction was: "${question}"
The answer was: "${winningAnswer}"

Write a single short, funny one-liner reaction (max 15 words). Be playful and witty, like a friend roasting the group. Don't be mean. Cricket banter only. Include 1-2 relevant emojis.

Reply with ONLY the one-liner, no quotes, no explanation.`;

    const response = await client.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
    });

    const text = (response.text ?? "").trim();
    return text.length > 0 && text.length < 200 ? text : null;
  } catch (err) {
    log.warn({ err: String(err) }, "AI roast generation failed");
    return null;
  }
}

// ─── COMMENTS ───────────────────────────────────────────────────────

const MAX_COMMENTS_PER_PREDICTION = 50;
const MAX_COMMENT_LENGTH = 200;

/**
 * Add a comment to a prediction thread.
 */
export async function addPredictionComment(
  db: Database,
  predictionId: string,
  userId: string,
  message: string,
): Promise<{ id: string }> {
  const prediction = await db.query.livePredictions.findFirst({
    where: eq(livePredictions.id, predictionId),
    columns: { id: true, contestId: true },
  });
  if (!prediction) throw new Error("Prediction not found");

  // Verify user is in this contest
  const team = await db.query.fantasyTeams.findFirst({
    where: and(
      eq(fantasyTeams.userId, userId),
      eq(fantasyTeams.contestId, prediction.contestId),
    ),
    columns: { id: true },
  });
  if (!team) throw new Error("You must be in this contest to comment");

  // Check comment count
  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(livePredictionComments)
    .where(eq(livePredictionComments.predictionId, predictionId));
  if (Number(countResult[0]?.count ?? 0) >= MAX_COMMENTS_PER_PREDICTION) {
    throw new Error("Comment limit reached for this prediction");
  }

  const trimmed = message.trim().slice(0, MAX_COMMENT_LENGTH);
  if (trimmed.length === 0) throw new Error("Comment cannot be empty");

  const [comment] = await db
    .insert(livePredictionComments)
    .values({ predictionId, userId, message: trimmed })
    .returning({ id: livePredictionComments.id });

  return comment!;
}

/**
 * Get comments for a prediction, ordered by time.
 */
export async function getPredictionComments(
  db: Database,
  predictionId: string,
): Promise<Array<{
  id: string;
  userId: string | null;
  displayName: string;
  isSystem: boolean;
  message: string;
  createdAt: Date;
}>> {
  const comments = await db
    .select({
      id: livePredictionComments.id,
      userId: livePredictionComments.userId,
      isSystem: livePredictionComments.isSystem,
      message: livePredictionComments.message,
      createdAt: livePredictionComments.createdAt,
      displayName: users.displayName,
      username: users.username,
    })
    .from(livePredictionComments)
    .leftJoin(users, eq(livePredictionComments.userId, users.id))
    .where(eq(livePredictionComments.predictionId, predictionId))
    .orderBy(livePredictionComments.createdAt)
    .limit(MAX_COMMENTS_PER_PREDICTION);

  return comments.map((c) => ({
    id: c.id,
    userId: c.userId,
    displayName: c.isSystem ? "DraftPlay AI" : (c.displayName || c.username?.split("@")[0] || "anon"),
    isSystem: c.isSystem,
    message: c.message,
    createdAt: c.createdAt,
  }));
}
