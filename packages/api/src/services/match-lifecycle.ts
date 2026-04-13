/**
 * Match Lifecycle Automation Service.
 *
 * Phase flow:
 *   idle → pre_match → live → post_match (15 min) → completed
 *
 * - pre_match:  Draft opens, users notified
 * - live:       Contests lock, draft closes
 * - post_match: Match over — 15 min grace period for users to resolve predictions
 * - completed:  Auto-abandon unresolved predictions, settle contests, award prizes
 */

import { eq, and, inArray } from "drizzle-orm";
import type { Database } from "@draftplay/db";
import { matches, contests, fantasyTeams, users } from "@draftplay/db";
import { lockMatchContests, completeMatch } from "../jobs/score-updater";
import { settleMatchContests } from "../jobs/settle-contest";
import { sendBatchNotifications } from "./notifications";
import { autoCloseMatchPredictions, autoAbandonUnresolvedPredictions } from "./live-predictions";
import { onMatchPhaseTransition as cmOnMatchPhaseTransition } from "./cm-service";
import { getLogger } from "../lib/logger";

const log = getLogger("match-lifecycle");

/** 15-minute grace period for users to resolve predictions after match ends */
const PREDICTION_GRACE_PERIOD_MS = 15 * 60 * 1000;

export interface PhaseTransitionResult {
  fromPhase: string;
  toPhase: string;
  actions: string[];
}

/**
 * Get all unique user IDs who have entries in contests for a given match.
 */
async function getMatchParticipantUserIds(db: Database, matchId: string): Promise<string[]> {
  const matchContests = await db.query.contests.findMany({
    where: eq(contests.matchId, matchId),
    columns: { id: true },
  });
  if (matchContests.length === 0) return [];

  const contestIds = matchContests.map(c => c.id);
  const teams = await db.query.fantasyTeams.findMany({
    where: inArray(fantasyTeams.contestId, contestIds),
    columns: { userId: true },
  });

  return [...new Set(teams.map(t => t.userId))];
}

/**
 * Canonical "change a match's phase" helper. Every code path that needs to
 * alter `matches.match_phase` — admin mutations, refresh jobs, background
 * fetches, automated ticks — MUST go through this function. It:
 *
 *   1. Reads the current phase (so this is idempotent — no-op on same phase)
 *   2. Writes the new phase to the matches table
 *   3. Calls onPhaseTransition() to fire every downstream side-effect
 *      (draft enablement, contest status flips, notifications, CM hooks,
 *       prediction grace periods, settlement)
 *
 * Prior to this helper, refresh/background paths silently wrote
 * `match_phase` directly and skipped side-effects — leading to "drafts open
 * but no users notified", "contests stuck at upcoming", "CM rounds never
 * transitioning", etc. Never write to matches.match_phase without calling
 * this function.
 *
 * @param source free-form label for logs — e.g. "admin:updatePhase",
 *               "refresh:refreshMatch", "tick:idle_to_pre_match"
 */
export async function applyMatchPhaseChange(
  db: Database,
  matchId: string,
  toPhase: string,
  source: string
): Promise<PhaseTransitionResult | null> {
  const match = await db.query.matches.findFirst({
    where: eq(matches.id, matchId),
    columns: { id: true, matchPhase: true },
  });
  if (!match) {
    log.warn({ matchId, source }, "applyMatchPhaseChange: match not found");
    return null;
  }

  const fromPhase = match.matchPhase ?? "idle";
  if (fromPhase === toPhase) {
    // No-op — phase already at target
    return { fromPhase, toPhase, actions: [] };
  }

  // Persist the phase change
  await db
    .update(matches)
    .set({ matchPhase: toPhase })
    .where(eq(matches.id, matchId));

  log.info(
    { matchId, fromPhase, toPhase, source },
    "Match phase updated"
  );

  // Fire all downstream side-effects
  try {
    return await onPhaseTransition(db, matchId, fromPhase, toPhase);
  } catch (err) {
    log.error(
      { err, matchId, fromPhase, toPhase, source },
      "onPhaseTransition failed after phase change"
    );
    return { fromPhase, toPhase, actions: ["phase-transition-error"] };
  }
}

/**
 * Execute side-effects for a match phase transition.
 * Called from the updatePhase endpoint after the phase column is updated.
 */
export async function onPhaseTransition(
  db: Database,
  matchId: string,
  fromPhase: string,
  toPhase: string
): Promise<PhaseTransitionResult> {
  const actions: string[] = [];

  // No-op for same phase
  if (fromPhase === toPhase) return { fromPhase, toPhase, actions };

  // Load the match for context
  const match = await db.query.matches.findFirst({
    where: eq(matches.id, matchId),
  });
  if (!match) {
    log.warn({ matchId }, "Match not found during phase transition");
    return { fromPhase, toPhase, actions };
  }

  const matchLabel = `${match.teamHome} vs ${match.teamAway}`;

  // ─── Transition: * → pre_match ────────────────────────────────────
  if (toPhase === "pre_match") {
    // Enable draft for this match
    await db.update(matches)
      .set({ draftEnabled: true })
      .where(eq(matches.id, matchId));
    actions.push("Draft enabled");

    // Open all upcoming contests for this match
    const openedContests = await db.update(contests)
      .set({ status: "open" })
      .where(and(eq(contests.matchId, matchId), eq(contests.status, "upcoming")))
      .returning({ id: contests.id });
    if (openedContests.length > 0) {
      actions.push(`Opened ${openedContests.length} contest(s)`);
    }

    // Notify ALL users that a new match is open for drafting
    const allUsers = await db.query.users.findMany({ columns: { id: true } });
    const allUserIds = allUsers.map(u => u.id);
    if (allUserIds.length > 0) {
      const { sent } = await sendBatchNotifications(
        db, allUserIds, "deadline_reminder",
        "Draft Open!",
        `${matchLabel} — Draft is now open. Build your team before the match starts!`,
        { matchId, type: "draft_open" }
      );
      actions.push(`Notified ${sent} users (draft open)`);
    }

    log.info({ matchId, matchLabel, actions }, "Phase → pre_match");
  }

  // ─── Transition: * → live ─────────────────────────────────────────
  if (toPhase === "live") {
    // Lock all open contests (no more entries)
    const locked = await lockMatchContests(db, matchId);
    actions.push(`Locked ${locked} contest(s)`);

    // Disable draft (team selection closed)
    await db.update(matches)
      .set({ draftEnabled: false, status: "live" })
      .where(eq(matches.id, matchId));
    actions.push("Draft closed, status → live");

    // Notify participants that match is live
    const userIds = await getMatchParticipantUserIds(db, matchId);
    if (userIds.length > 0) {
      const { sent } = await sendBatchNotifications(
        db, userIds, "status_alert",
        "Match is Live!",
        `${matchLabel} has started. Follow live scores and track your team!`,
        { matchId, type: "match_live" }
      );
      actions.push(`Notified ${sent} users (match live)`);
    }

    log.info({ matchId, matchLabel, locked, actions }, "Phase → live");
  }

  // ─── Transition: * → post_match ───────────────────────────────────
  // Match is over. 15-min grace period starts for prediction resolution.
  // NO settlement happens here — that's in the completed phase.
  if (toPhase === "post_match") {
    const deadline = new Date(Date.now() + PREDICTION_GRACE_PERIOD_MS);

    // Update match status + set prediction deadline
    await db.update(matches)
      .set({ status: "completed", predictionDeadline: deadline })
      .where(eq(matches.id, matchId));
    actions.push(`Status → completed, prediction deadline → ${deadline.toISOString()}`);

    // Close open predictions (stop new votes) but keep them resolvable
    const predResult = await autoCloseMatchPredictions(db, matchId);
    if (predResult.closed > 0 || predResult.abandoned > 0) {
      actions.push(`Predictions: ${predResult.closed} closed, ${predResult.abandoned} abandoned (no votes)`);
    }

    // Notify participants about the 15-min grace period
    const userIds = await getMatchParticipantUserIds(db, matchId);
    if (userIds.length > 0) {
      const { sent } = await sendBatchNotifications(
        db, userIds, "status_alert",
        "Match Over — Resolve Your Predictions!",
        `${matchLabel} — You have 15 minutes to resolve your prediction questions. Unresolved predictions will be auto-abandoned.`,
        { matchId, type: "prediction_deadline", predictionDeadline: deadline.toISOString() }
      );
      actions.push(`Notified ${sent} users (prediction deadline)`);

      // Schedule 5-min-remaining reminder
      setTimeout(async () => {
        try {
          const freshMatch = await db.query.matches.findFirst({
            where: eq(matches.id, matchId),
            columns: { predictionDeadline: true, matchPhase: true },
          });
          // Only send if still in post_match (not yet transitioned to completed)
          if (freshMatch?.predictionDeadline && freshMatch.matchPhase === "post_match") {
            await sendBatchNotifications(
              db, userIds, "urgent_deadline",
              "5 Minutes Left!",
              `${matchLabel} — Only 5 minutes left to resolve your predictions!`,
              { matchId, type: "prediction_deadline_reminder" }
            );
            log.info({ matchId }, "Sent 5-min prediction deadline reminder");
          }
        } catch (err) {
          log.warn({ matchId, err: String(err) }, "Failed to send 5-min reminder");
        }
      }, PREDICTION_GRACE_PERIOD_MS - 5 * 60 * 1000);

      // Auto-transition to completed after 15 minutes
      setTimeout(async () => {
        try {
          // Check we're still in post_match (admin may have manually moved to completed)
          const freshMatch = await db.query.matches.findFirst({
            where: eq(matches.id, matchId),
            columns: { matchPhase: true },
          });
          if (freshMatch?.matchPhase !== "post_match") {
            log.info({ matchId, currentPhase: freshMatch?.matchPhase }, "Skipping auto-complete — already transitioned");
            return;
          }

          // Update phase to completed
          await db.update(matches)
            .set({ matchPhase: "completed" })
            .where(eq(matches.id, matchId));

          // Fire completed transition
          await onPhaseTransition(db, matchId, "post_match", "completed");
          log.info({ matchId }, "Auto-transitioned post_match → completed after 15-min deadline");
        } catch (err) {
          log.warn({ matchId, err: String(err) }, "Auto-transition to completed failed");
        }
      }, PREDICTION_GRACE_PERIOD_MS);
    }

    log.info({ matchId, matchLabel, actions }, "Phase → post_match");
  }

  // ─── Transition: * → completed ────────────────────────────────────
  // Grace period is over. Abandon unresolved predictions, settle contests, award prizes.
  if (toPhase === "completed") {
    // Abandon any still-unresolved predictions
    const { abandoned } = await autoAbandonUnresolvedPredictions(db, matchId);
    if (abandoned > 0) {
      actions.push(`Auto-abandoned ${abandoned} unresolved prediction(s)`);
    }

    // Clear prediction deadline
    await db.update(matches)
      .set({ status: "completed", draftEnabled: false, predictionDeadline: null })
      .where(eq(matches.id, matchId));
    actions.push("Status → completed, deadline cleared");

    // Complete match — transitions live contests → settling
    const resultText = match.result ?? "Match completed";
    await completeMatch(db, matchId, resultText);
    actions.push("Contests → settling");

    // Settle all contests + award prizes
    const { settledCount, totalWinners } = await settleMatchContests(db, matchId);
    actions.push(`Settled ${settledCount} contest(s), ${totalWinners} winner(s)`);

    // Notify participants that results are final
    const userIds = await getMatchParticipantUserIds(db, matchId);
    if (userIds.length > 0) {
      const { sent } = await sendBatchNotifications(
        db, userIds, "status_alert",
        "Results Finalized!",
        `${matchLabel} — All predictions resolved. Check your final scores and rankings!`,
        { matchId, type: "match_finalized" }
      );
      actions.push(`Notified ${sent} users (results finalized)`);
    }

    log.info({ matchId, matchLabel, settledCount, totalWinners, actions }, "Phase → completed");
  }

  // ─── Transition: * → idle (reset) ─────────────────────────────────
  if (toPhase === "idle") {
    await db.update(matches)
      .set({ draftEnabled: false, predictionDeadline: null })
      .where(eq(matches.id, matchId));
    actions.push("Draft disabled, deadline cleared");

    log.info({ matchId, matchLabel, actions }, "Phase → idle");
  }

  // Cricket Manager rounds piggyback on the same phase transitions:
  //  - pre_match: refresh player pool + open the round
  //  - live:      lock entries, round → live
  //  - completed: settle the round if this was its last match
  try {
    await cmOnMatchPhaseTransition(db, matchId, toPhase);
  } catch (err) {
    log.warn(
      { matchId, toPhase, err: String(err) },
      "CM phase transition hook failed (non-fatal)"
    );
  }

  return { fromPhase, toPhase, actions };
}

/**
 * Manually finalize predictions and settle.
 * Triggers the same flow as completed phase — for admin use when
 * auto-transition didn't fire (e.g. server restart during grace period).
 */
export async function finalizePredictionsAndSettle(
  db: Database,
  matchId: string,
): Promise<{ abandoned: number; settledCount: number; totalWinners: number }> {
  const match = await db.query.matches.findFirst({
    where: eq(matches.id, matchId),
    columns: { matchPhase: true, teamHome: true, teamAway: true },
  });

  if (!match) {
    log.warn({ matchId }, "Match not found for finalization");
    return { abandoned: 0, settledCount: 0, totalWinners: 0 };
  }

  // Update phase to completed and fire the transition
  const fromPhase = match.matchPhase ?? "post_match";
  await db.update(matches)
    .set({ matchPhase: "completed" })
    .where(eq(matches.id, matchId));

  const result = await onPhaseTransition(db, matchId, fromPhase, "completed");
  log.info({ matchId, result }, "Manual finalization complete");

  // Extract counts from actions (best effort)
  const abandonMatch = result.actions.find(a => a.includes("abandoned"));
  const settleMatch = result.actions.find(a => a.includes("Settled"));
  const abandoned = abandonMatch ? parseInt(abandonMatch.match(/\d+/)?.[0] ?? "0") : 0;
  const settledCount = settleMatch ? parseInt(settleMatch.match(/\d+/)?.[0] ?? "0") : 0;
  const totalWinners = settleMatch ? parseInt(settleMatch.match(/(\d+) winner/)?.[1] ?? "0") : 0;

  return { abandoned, settledCount, totalWinners };
}
