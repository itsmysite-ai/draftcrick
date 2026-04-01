/**
 * Service to fetch and store confirmed playing XI from Cricbuzz.
 * Called from refreshScores (admin) and backgroundRefreshMatch (auto-refresh).
 */

import { eq, and, inArray } from "drizzle-orm";
import type { Database } from "@draftplay/db";
import { matches, contests, fantasyTeams, players } from "@draftplay/db";
import { getLogger } from "../lib/logger";

const log = getLogger("playing-xi-fetch");

export interface StoredPlayingXI {
  cricbuzzId: number;
  name: string;
  role: string;
  isCaptain: boolean;
  isKeeper: boolean;
}

/**
 * Fetch confirmed playing XI from Cricbuzz and store in DB.
 * Only runs when toss has happened and playingXiHome is not yet set.
 * Returns true if XI was stored (first time), false if skipped.
 */
export async function fetchAndStorePlayingXI(
  db: Database,
  matchId: string,
): Promise<{ stored: boolean; benchNotifications: number }> {
  const match = await db.query.matches.findFirst({
    where: eq(matches.id, matchId),
    columns: { id: true, externalId: true, playingXiHome: true, playingXiAway: true, teamHome: true, teamAway: true },
  });

  if (!match || !match.externalId) return { stored: false, benchNotifications: 0 };

  // Skip if already stored
  if (match.playingXiHome && (match.playingXiHome as any[]).length > 0) {
    return { stored: false, benchNotifications: 0 };
  }

  const cbIdMatch = match.externalId.match(/cb-(?:match-)?(\d+)/);
  if (!cbIdMatch) return { stored: false, benchNotifications: 0 };

  const { fetchPlayingXI } = await import("../providers/cricbuzz/cricbuzz-client");
  const result = await fetchPlayingXI(parseInt(cbIdMatch[1]!, 10));

  if (!result || !result.hasToss) return { stored: false, benchNotifications: 0 };

  // Extract playing XI (substitute: false)
  const xi1 = result.team1.players.filter((p) => !p.isSubstitute).map((p) => ({
    cricbuzzId: p.cricbuzzId,
    name: p.name,
    role: p.role,
    isCaptain: p.isCaptain,
    isKeeper: p.isKeeper,
  }));
  const xi2 = result.team2.players.filter((p) => !p.isSubstitute).map((p) => ({
    cricbuzzId: p.cricbuzzId,
    name: p.name,
    role: p.role,
    isCaptain: p.isCaptain,
    isKeeper: p.isKeeper,
  }));

  if (xi1.length !== 11 || xi2.length !== 11) {
    log.warn({ matchId, xi1: xi1.length, xi2: xi2.length }, "Playing XI count mismatch — skipping");
    return { stored: false, benchNotifications: 0 };
  }

  // Store in DB
  await db.update(matches).set({
    playingXiHome: xi1,
    playingXiAway: xi2,
    tossWinner: result.tossWinner ?? match.tossWinner,
    tossDecision: result.tossDecision ?? match.tossDecision,
  }).where(eq(matches.id, matchId));

  log.info({ matchId, team1: result.team1.shortName, team2: result.team2.shortName }, "Stored confirmed playing XI");

  // Build a set of bench player Cricbuzz IDs (substitute: true)
  const allBenchNames = new Set([
    ...result.team1.players.filter((p) => p.isSubstitute).map((p) => p.name.toLowerCase()),
    ...result.team2.players.filter((p) => p.isSubstitute).map((p) => p.name.toLowerCase()),
  ]);
  const allPlayingNames = new Set([
    ...xi1.map((p) => p.name.toLowerCase()),
    ...xi2.map((p) => p.name.toLowerCase()),
  ]);

  // Find open contests for this match and check for bench players in user teams
  const openContests = await db.query.contests.findMany({
    where: and(eq(contests.matchId, matchId), eq(contests.status, "open")),
    columns: { id: true },
  });

  if (openContests.length === 0) return { stored: true, benchNotifications: 0 };

  const contestIds = openContests.map((c) => c.id);
  const teams = await db.query.fantasyTeams.findMany({
    where: inArray(fantasyTeams.contestId, contestIds),
    columns: { id: true, userId: true, players: true },
  });

  // For each team, resolve player names and check against bench
  const allPlayerIds = new Set<string>();
  for (const t of teams) {
    const tp = t.players as Array<{ playerId: string }>;
    for (const p of tp) allPlayerIds.add(p.playerId);
  }

  const playerRecords = allPlayerIds.size > 0
    ? await db.query.players.findMany({
        where: inArray(players.id, [...allPlayerIds]),
        columns: { id: true, name: true },
      })
    : [];
  const playerNameMap = new Map(playerRecords.map((p) => [p.id, p.name]));

  // Group users by how many bench players they have
  const usersToNotify: Array<{ userId: string; benchCount: number; contestId: string }> = [];

  for (const team of teams) {
    const tp = team.players as Array<{ playerId: string }>;
    let benchCount = 0;
    for (const p of tp) {
      const name = playerNameMap.get(p.playerId)?.toLowerCase();
      if (name && allBenchNames.has(name) && !allPlayingNames.has(name)) {
        benchCount++;
      }
    }
    if (benchCount > 0) {
      usersToNotify.push({ userId: team.userId, benchCount, contestId: team.contestId ?? contestIds[0]! });
    }
  }

  // Send notifications
  if (usersToNotify.length > 0) {
    try {
      const { sendPushNotification, NOTIFICATION_TYPES } = await import("./notifications");
      for (const u of usersToNotify) {
        await sendPushNotification(
          db,
          u.userId,
          NOTIFICATION_TYPES.PLAYING_XI_ANNOUNCED,
          "Playing XI Announced!",
          `${u.benchCount} of your players ${u.benchCount === 1 ? "is" : "are"} on the bench. Edit your team before the match locks!`,
          { matchId, contestId: u.contestId },
        );
      }
      log.info({ matchId, notified: usersToNotify.length }, "Sent bench player notifications");
    } catch (err: any) {
      log.error({ err: err.message }, "Failed to send playing XI notifications");
    }
  }

  // Also notify users with no bench issues — just that XI is announced
  const notifiedUserIds = new Set(usersToNotify.map((u) => u.userId));
  const otherUsers = teams
    .filter((t) => !notifiedUserIds.has(t.userId))
    .map((t) => t.userId);
  const uniqueOtherUsers = [...new Set(otherUsers)];

  if (uniqueOtherUsers.length > 0) {
    try {
      const { sendBatchNotifications, NOTIFICATION_TYPES } = await import("./notifications");
      await sendBatchNotifications(
        db,
        uniqueOtherUsers,
        NOTIFICATION_TYPES.PLAYING_XI_ANNOUNCED,
        "Playing XI Announced!",
        `${match.teamHome} vs ${match.teamAway} — confirmed playing XI is out. Review your team!`,
        { matchId },
      );
    } catch { /* best effort */ }
  }

  return { stored: true, benchNotifications: usersToNotify.length };
}
