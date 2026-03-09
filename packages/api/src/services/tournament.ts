/**
 * Tournament League Service — season-long fantasy league business logic.
 *
 * Handles league creation, per-match team submission with trade counting,
 * auto-carry for inactive users, and standings aggregation.
 */

import { eq, and, desc, sql } from "drizzle-orm";
import type { Database } from "@draftplay/db";
import {
  tournamentLeagues,
  tournamentTeamSubmissions,
  leagues,
  leagueMembers,
} from "@draftplay/db";
import { getLogger } from "../lib/logger";

const log = getLogger("tournament");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SquadPlayer = {
  playerId: string;
  role: string;
  isCaptain?: boolean;
  isViceCaptain?: boolean;
};

type XiPlayer = { playerId: string; role: string };

// ---------------------------------------------------------------------------
// League CRUD
// ---------------------------------------------------------------------------

export async function createTournamentLeague(
  db: Database,
  userId: string,
  leagueId: string,
  tournamentId: string,
  mode: "salary_cap" | "draft" | "auction"
) {
  // Verify user is league owner
  const membership = await db.query.leagueMembers.findFirst({
    where: and(
      eq(leagueMembers.leagueId, leagueId),
      eq(leagueMembers.userId, userId)
    ),
  });

  if (!membership || membership.role !== "owner") {
    throw new Error("Only league owner can create a tournament league");
  }

  const [tl] = await db
    .insert(tournamentLeagues)
    .values({ leagueId, tournamentId, mode })
    .returning();

  log.info(
    { tournamentLeagueId: tl!.id, leagueId, tournamentId, mode },
    "Tournament league created"
  );

  return tl!;
}

export async function getTournamentLeague(db: Database, id: string) {
  const tl = await db.query.tournamentLeagues.findFirst({
    where: eq(tournamentLeagues.id, id),
    with: { league: true },
  });
  return tl ?? null;
}

export async function listTournamentLeagues(
  db: Database,
  filters: { tournamentId?: string; status?: string }
) {
  const conditions = [];
  if (filters.tournamentId) {
    conditions.push(eq(tournamentLeagues.tournamentId, filters.tournamentId));
  }
  if (filters.status) {
    conditions.push(eq(tournamentLeagues.status, filters.status));
  }

  const rows = await db.query.tournamentLeagues.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    with: { league: true },
    orderBy: [desc(tournamentLeagues.createdAt)],
  });

  return rows;
}

// ---------------------------------------------------------------------------
// Team Submission
// ---------------------------------------------------------------------------

/**
 * Get the user's current squad for a match.
 * If no submission exists for this match, carry from the most recent previous submission.
 */
export async function getCurrentSquad(
  db: Database,
  userId: string,
  tournamentLeagueId: string,
  matchId: string
): Promise<{
  squad: SquadPlayer[];
  playingXi: XiPlayer[];
  chipUsed: string | null;
  isCarried: boolean;
} | null> {
  // Check for existing submission for this exact match
  const existing = await db.query.tournamentTeamSubmissions.findFirst({
    where: and(
      eq(tournamentTeamSubmissions.tournamentLeagueId, tournamentLeagueId),
      eq(tournamentTeamSubmissions.userId, userId),
      eq(tournamentTeamSubmissions.matchId, matchId)
    ),
  });

  if (existing) {
    return {
      squad: existing.squad as SquadPlayer[],
      playingXi: existing.playingXi as XiPlayer[],
      chipUsed: existing.chipUsed,
      isCarried: false,
    };
  }

  // Carry from most recent submission
  const previous = await db.query.tournamentTeamSubmissions.findFirst({
    where: and(
      eq(tournamentTeamSubmissions.tournamentLeagueId, tournamentLeagueId),
      eq(tournamentTeamSubmissions.userId, userId)
    ),
    orderBy: [desc(tournamentTeamSubmissions.submittedAt)],
  });

  if (previous) {
    return {
      squad: previous.squad as SquadPlayer[],
      playingXi: previous.playingXi as XiPlayer[],
      chipUsed: null, // chips don't carry
      isCarried: true,
    };
  }

  return null;
}

/**
 * Submit (or update) a team for a specific match.
 * Counts player swaps against trade allowance.
 */
export async function submitTeam(
  db: Database,
  userId: string,
  tournamentLeagueId: string,
  matchId: string,
  squad: SquadPlayer[],
  playingXi: XiPlayer[]
) {
  // Get tournament league config for trade limits
  const tl = await db.query.tournamentLeagues.findFirst({
    where: eq(tournamentLeagues.id, tournamentLeagueId),
  });

  if (!tl) throw new Error("Tournament league not found");
  if (tl.status === "completed") throw new Error("Tournament is completed");

  // Count trades used so far
  const tradesUsed = await getTradesUsed(db, userId, tournamentLeagueId);
  const totalAllowed = tl.totalTradesAllowed ?? 30;

  // Count new trades: diff current submission's squad vs previous submission
  const current = await getCurrentSquad(db, userId, tournamentLeagueId, matchId);
  let newTrades = 0;

  if (current) {
    const prevPlayerIds = new Set(
      (current.squad as SquadPlayer[]).map((p) => p.playerId)
    );
    const newPlayerIds = new Set(squad.map((p) => p.playerId));
    // Players added that weren't in previous squad
    for (const pid of newPlayerIds) {
      if (!prevPlayerIds.has(pid)) newTrades++;
    }
  }

  // Check if chip gives unlimited transfers
  // (chip is tracked separately via useChip endpoint; don't validate here)
  if (newTrades > 0 && tradesUsed + newTrades > totalAllowed) {
    throw new Error(
      `Trade limit exceeded: ${tradesUsed + newTrades}/${totalAllowed} trades used`
    );
  }

  // Upsert submission
  const existing = await db.query.tournamentTeamSubmissions.findFirst({
    where: and(
      eq(tournamentTeamSubmissions.tournamentLeagueId, tournamentLeagueId),
      eq(tournamentTeamSubmissions.userId, userId),
      eq(tournamentTeamSubmissions.matchId, matchId)
    ),
  });

  if (existing) {
    const [updated] = await db
      .update(tournamentTeamSubmissions)
      .set({
        squad,
        playingXi,
        submittedAt: new Date(),
        isAutoSubmitted: false,
      })
      .where(eq(tournamentTeamSubmissions.id, existing.id))
      .returning();

    log.info({ userId, matchId, trades: newTrades }, "Team updated");
    return updated!;
  }

  const [row] = await db
    .insert(tournamentTeamSubmissions)
    .values({
      tournamentLeagueId,
      userId,
      matchId,
      squad,
      playingXi,
      isAutoSubmitted: false,
    })
    .returning();

  log.info({ userId, matchId, trades: newTrades }, "Team submitted");
  return row!;
}

/**
 * Count total player swaps across all submissions for a user.
 * Each submission after the first is compared to the previous to count diffs.
 */
export async function getTradesUsed(
  db: Database,
  userId: string,
  tournamentLeagueId: string
): Promise<number> {
  const submissions = await db.query.tournamentTeamSubmissions.findMany({
    where: and(
      eq(tournamentTeamSubmissions.tournamentLeagueId, tournamentLeagueId),
      eq(tournamentTeamSubmissions.userId, userId)
    ),
    orderBy: [tournamentTeamSubmissions.submittedAt],
  });

  if (submissions.length <= 1) return 0;

  let totalTrades = 0;
  for (let i = 1; i < submissions.length; i++) {
    const prevIds = new Set(
      (submissions[i - 1]!.squad as SquadPlayer[]).map((p) => p.playerId)
    );
    const currIds = (submissions[i]!.squad as SquadPlayer[]).map(
      (p) => p.playerId
    );
    for (const id of currIds) {
      if (!prevIds.has(id)) totalTrades++;
    }
  }

  return totalTrades;
}

/**
 * Auto-carry teams for users who haven't submitted for a match.
 * Called at match deadline (cron or admin trigger).
 */
export async function autoCarryTeams(
  db: Database,
  tournamentLeagueId: string,
  matchId: string
) {
  const tl = await db.query.tournamentLeagues.findFirst({
    where: eq(tournamentLeagues.id, tournamentLeagueId),
    with: { league: true },
  });

  if (!tl?.leagueId) return 0;

  // Get all league members
  const members = await db.query.leagueMembers.findMany({
    where: eq(leagueMembers.leagueId, tl.leagueId),
  });

  // Get users who already submitted for this match
  const existingSubmissions = await db.query.tournamentTeamSubmissions.findMany({
    where: and(
      eq(tournamentTeamSubmissions.tournamentLeagueId, tournamentLeagueId),
      eq(tournamentTeamSubmissions.matchId, matchId)
    ),
  });
  const submittedUserIds = new Set(
    existingSubmissions.map((s) => s.userId).filter(Boolean)
  );

  let autoCarried = 0;

  for (const member of members) {
    if (submittedUserIds.has(member.userId)) continue;

    // Get their most recent submission
    const lastSubmission = await db.query.tournamentTeamSubmissions.findFirst({
      where: and(
        eq(tournamentTeamSubmissions.tournamentLeagueId, tournamentLeagueId),
        eq(tournamentTeamSubmissions.userId, member.userId)
      ),
      orderBy: [desc(tournamentTeamSubmissions.submittedAt)],
    });

    if (!lastSubmission) continue; // first match, no team to carry

    await db.insert(tournamentTeamSubmissions).values({
      tournamentLeagueId,
      userId: member.userId,
      matchId,
      squad: lastSubmission.squad,
      playingXi: lastSubmission.playingXi,
      isAutoSubmitted: true,
    });

    autoCarried++;
  }

  log.info({ tournamentLeagueId, matchId, autoCarried }, "Auto-carried teams");
  return autoCarried;
}

// ---------------------------------------------------------------------------
// Standings
// ---------------------------------------------------------------------------

export async function getStandings(
  db: Database,
  tournamentLeagueId: string
) {
  const rows = await db
    .select({
      userId: tournamentTeamSubmissions.userId,
      totalPoints: sql<string>`SUM(${tournamentTeamSubmissions.totalPoints}::numeric)`,
      matchesPlayed: sql<number>`COUNT(*)::int`,
    })
    .from(tournamentTeamSubmissions)
    .where(
      eq(
        tournamentTeamSubmissions.tournamentLeagueId,
        tournamentLeagueId
      )
    )
    .groupBy(tournamentTeamSubmissions.userId)
    .orderBy(
      desc(
        sql`SUM(${tournamentTeamSubmissions.totalPoints}::numeric)`
      )
    );

  return rows.map((r, i) => ({
    rank: i + 1,
    userId: r.userId,
    totalPoints: Number(r.totalPoints) || 0,
    matchesPlayed: r.matchesPlayed,
  }));
}
