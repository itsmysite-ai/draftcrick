/**
 * Awards Service — auto-calculated match awards and running tournament awards.
 *
 * Per-match: manager_of_match, best_captain, biggest_differential, most_improved
 * Running: orange_cap, purple_cap
 */

import { eq, and, desc, sql } from "drizzle-orm";
import type { Database } from "@draftplay/db";
import {
  leagueAwards,
  tournamentLeagues,
  tournamentTeamSubmissions,
  leagueMembers,
} from "@draftplay/db";
import { sendPushNotification } from "./notifications";
import { getLogger } from "../lib/logger";

const log = getLogger("awards");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AwardType =
  | "manager_of_match"
  | "best_captain"
  | "biggest_differential"
  | "most_improved"
  | "orange_cap"
  | "purple_cap";

// ---------------------------------------------------------------------------
// Per-Match Awards
// ---------------------------------------------------------------------------

/**
 * Calculate and insert awards for a completed match.
 * Called after match scoring is finalized.
 */
export async function calculateMatchAwards(
  db: Database,
  tournamentLeagueId: string,
  matchId: string
) {
  const tl = await db.query.tournamentLeagues.findFirst({
    where: eq(tournamentLeagues.id, tournamentLeagueId),
  });

  if (!tl?.leagueId) {
    log.warn({ tournamentLeagueId }, "No league linked — skipping awards");
    return [];
  }

  // Get all submissions for this match
  const submissions = await db.query.tournamentTeamSubmissions.findMany({
    where: and(
      eq(tournamentTeamSubmissions.tournamentLeagueId, tournamentLeagueId),
      eq(tournamentTeamSubmissions.matchId, matchId)
    ),
    orderBy: [desc(tournamentTeamSubmissions.totalPoints)],
  });

  if (submissions.length === 0) return [];

  const awards: {
    awardType: AwardType;
    userId: string | null;
    details: Record<string, unknown>;
  }[] = [];

  // 1. Manager of the Match — highest totalPoints
  const topSubmission = submissions[0]!;
  if (topSubmission.userId) {
    awards.push({
      awardType: "manager_of_match",
      userId: topSubmission.userId,
      details: { points: Number(topSubmission.totalPoints) },
    });
  }

  // 2. Best Captain Pick — highest captainPoints
  const sortedByCaptain = [...submissions].sort(
    (a, b) => Number(b.captainPoints) - Number(a.captainPoints)
  );
  const topCaptain = sortedByCaptain[0]!;
  if (topCaptain.userId) {
    awards.push({
      awardType: "best_captain",
      userId: topCaptain.userId,
      details: { captainPoints: Number(topCaptain.captainPoints) },
    });
  }

  // 3. Most Improved — biggest rank jump from previous match standings
  const prevStandings = await getPreviousMatchRanks(
    db,
    tournamentLeagueId,
    matchId
  );
  if (prevStandings.size > 0) {
    const currentRanks = new Map<string, number>();
    submissions.forEach((s, i) => {
      if (s.userId) currentRanks.set(s.userId, i + 1);
    });

    let biggestJump = 0;
    let mostImprovedUserId: string | null = null;
    for (const [userId, prevRank] of prevStandings) {
      const currentRank = currentRanks.get(userId);
      if (currentRank === undefined) continue;
      const jump = prevRank - currentRank;
      if (jump > biggestJump) {
        biggestJump = jump;
        mostImprovedUserId = userId;
      }
    }

    if (mostImprovedUserId && biggestJump > 0) {
      awards.push({
        awardType: "most_improved",
        userId: mostImprovedUserId,
        details: { rankJump: biggestJump },
      });
    }
  }

  // Insert awards + send notifications
  const inserted = [];
  for (const award of awards) {
    const [row] = await db
      .insert(leagueAwards)
      .values({
        leagueId: tl.leagueId,
        matchId,
        awardType: award.awardType,
        userId: award.userId,
        details: award.details,
      })
      .returning();

    inserted.push(row!);

    // Send push notification
    if (award.userId) {
      const awardLabel = formatAwardName(award.awardType);
      await sendPushNotification(
        db,
        award.userId,
        "rank_change",
        `You won ${awardLabel}!`,
        `Congratulations on earning ${awardLabel} for this match.`,
        { matchId, awardType: award.awardType }
      ).catch((err) => {
        log.warn({ userId: award.userId, error: String(err) }, "Failed to send award notification");
      });
    }
  }

  log.info(
    { tournamentLeagueId, matchId, awardCount: inserted.length },
    "Match awards calculated"
  );

  return inserted;
}

// ---------------------------------------------------------------------------
// Running Awards (Orange Cap, Purple Cap)
// ---------------------------------------------------------------------------

/**
 * Calculate running tournament awards (orange cap = top scorer, purple cap = top wicket-taker).
 * These are recalculated after every match.
 */
export async function calculateRunningAwards(
  db: Database,
  tournamentLeagueId: string
) {
  const tl = await db.query.tournamentLeagues.findFirst({
    where: eq(tournamentLeagues.id, tournamentLeagueId),
  });

  if (!tl?.leagueId) return [];

  // Orange Cap — user with highest cumulative totalPoints
  const standings = await db
    .select({
      userId: tournamentTeamSubmissions.userId,
      totalPoints: sql<string>`SUM(${tournamentTeamSubmissions.totalPoints}::numeric)`,
    })
    .from(tournamentTeamSubmissions)
    .where(
      eq(tournamentTeamSubmissions.tournamentLeagueId, tournamentLeagueId)
    )
    .groupBy(tournamentTeamSubmissions.userId)
    .orderBy(desc(sql`SUM(${tournamentTeamSubmissions.totalPoints}::numeric)`))
    .limit(1);

  const awards = [];

  if (standings[0]?.userId) {
    // Delete previous orange cap, insert new
    await db
      .delete(leagueAwards)
      .where(
        and(
          eq(leagueAwards.leagueId, tl.leagueId),
          eq(leagueAwards.awardType, "orange_cap")
        )
      );

    const [row] = await db
      .insert(leagueAwards)
      .values({
        leagueId: tl.leagueId,
        awardType: "orange_cap",
        userId: standings[0].userId,
        details: { totalPoints: Number(standings[0].totalPoints) },
      })
      .returning();

    awards.push(row!);
  }

  log.info(
    { tournamentLeagueId, awards: awards.length },
    "Running awards updated"
  );

  return awards;
}

// ---------------------------------------------------------------------------
// Query Awards
// ---------------------------------------------------------------------------

export async function getAwards(
  db: Database,
  tournamentLeagueId: string,
  matchId?: string
) {
  const tl = await db.query.tournamentLeagues.findFirst({
    where: eq(tournamentLeagues.id, tournamentLeagueId),
  });

  if (!tl?.leagueId) return [];

  const conditions = [eq(leagueAwards.leagueId, tl.leagueId)];
  if (matchId) {
    conditions.push(eq(leagueAwards.matchId, matchId));
  }

  return db.query.leagueAwards.findMany({
    where: and(...conditions),
    orderBy: [desc(leagueAwards.createdAt)],
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getPreviousMatchRanks(
  db: Database,
  tournamentLeagueId: string,
  currentMatchId: string
): Promise<Map<string, number>> {
  // Get all submissions excluding current match, aggregate by user
  const rows = await db
    .select({
      userId: tournamentTeamSubmissions.userId,
      totalPoints: sql<string>`SUM(${tournamentTeamSubmissions.totalPoints}::numeric)`,
    })
    .from(tournamentTeamSubmissions)
    .where(
      and(
        eq(tournamentTeamSubmissions.tournamentLeagueId, tournamentLeagueId),
        sql`${tournamentTeamSubmissions.matchId} != ${currentMatchId}`
      )
    )
    .groupBy(tournamentTeamSubmissions.userId)
    .orderBy(desc(sql`SUM(${tournamentTeamSubmissions.totalPoints}::numeric)`));

  const ranks = new Map<string, number>();
  rows.forEach((r, i) => {
    if (r.userId) ranks.set(r.userId, i + 1);
  });
  return ranks;
}

function formatAwardName(awardType: string): string {
  const names: Record<string, string> = {
    manager_of_match: "Manager of the Match",
    best_captain: "Best Captain Pick",
    biggest_differential: "Biggest Differential",
    most_improved: "Most Improved",
    orange_cap: "Orange Cap",
    purple_cap: "Purple Cap",
  };
  return names[awardType] ?? awardType;
}
