/**
 * Match Lifecycle Automation Service.
 *
 * Fires side-effects when a match phase changes:
 *   idle → pre_match → live → post_match → completed
 *
 * Each transition can trigger: notifications, contest locking, draft toggling,
 * score processing, settlement, and awards.
 */

import { eq, and, inArray } from "drizzle-orm";
import type { Database } from "@draftplay/db";
import { matches, contests, fantasyTeams } from "@draftplay/db";
import { lockMatchContests, completeMatch } from "../jobs/score-updater";
import { settleMatchContests } from "../jobs/settle-contest";
import { sendBatchNotifications } from "./notifications";
import { getLogger } from "../lib/logger";

const log = getLogger("match-lifecycle");

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

    // Notify participants that draft is open
    const userIds = await getMatchParticipantUserIds(db, matchId);
    if (userIds.length > 0) {
      const { sent } = await sendBatchNotifications(
        db, userIds, "deadline_reminder",
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
  if (toPhase === "post_match") {
    // Complete match — transitions live contests → settling
    const resultText = match.result ?? "Match completed";
    await completeMatch(db, matchId, resultText);
    actions.push("Contests → settling");

    // Update match status
    await db.update(matches)
      .set({ status: "completed" })
      .where(eq(matches.id, matchId));
    actions.push("Status → completed");

    // Auto-settle contests
    const { settledCount, totalWinners } = await settleMatchContests(db, matchId);
    actions.push(`Settled ${settledCount} contest(s), ${totalWinners} winner(s)`);

    // Notify participants
    const userIds = await getMatchParticipantUserIds(db, matchId);
    if (userIds.length > 0) {
      const { sent } = await sendBatchNotifications(
        db, userIds, "status_alert",
        "Match Complete!",
        `${matchLabel} — Results are in. Check your scores and rankings!`,
        { matchId, type: "match_complete" }
      );
      actions.push(`Notified ${sent} users (match complete)`);
    }

    log.info({ matchId, matchLabel, settledCount, totalWinners, actions }, "Phase → post_match");
  }

  // ─── Transition: * → completed ────────────────────────────────────
  if (toPhase === "completed") {
    // Ensure match is marked completed
    await db.update(matches)
      .set({ status: "completed", draftEnabled: false })
      .where(eq(matches.id, matchId));
    actions.push("Status → completed, draft disabled");

    // If there are still unsettled contests, settle them now
    const unsettled = await db.query.contests.findMany({
      where: and(
        eq(contests.matchId, matchId),
        eq(contests.status, "settling")
      ),
      columns: { id: true },
    });
    if (unsettled.length > 0) {
      const { settledCount, totalWinners } = await settleMatchContests(db, matchId);
      actions.push(`Settled ${settledCount} remaining contest(s), ${totalWinners} winner(s)`);
    }

    log.info({ matchId, matchLabel, actions }, "Phase → completed");
  }

  // ─── Transition: * → idle (reset) ─────────────────────────────────
  if (toPhase === "idle") {
    await db.update(matches)
      .set({ draftEnabled: false })
      .where(eq(matches.id, matchId));
    actions.push("Draft disabled");

    log.info({ matchId, matchLabel, actions }, "Phase → idle");
  }

  return { fromPhase, toPhase, actions };
}
