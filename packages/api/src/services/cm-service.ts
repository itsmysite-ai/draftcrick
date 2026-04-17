/**
 * Cricket Manager — business logic service layer
 *
 * Layered on top of the existing `leagues` / `leagueMembers` tables. A league
 * with format='cricket_manager' gets CM rounds attached via `cm_rounds.leagueId`.
 *
 * Handles: round composition, lifecycle transitions, entry validation +
 * submission, live updates, settlement, season standings.
 *
 * Spec: /docs/CRICKET_MANAGER_DRAFT.md
 */

import { and, eq, inArray, sql, desc } from "drizzle-orm";
import {
  leagues,
  leagueMembers,
  cmRounds,
  cmContests,
  cmEntries,
  cmContestMembers,
  cmLeagueStandings,
  leagueAwards,
  matches,
  players,
  playerMatchScores,
  tournaments,
} from "@draftplay/db";
import type { Database } from "@draftplay/db";
import type { LeagueRules } from "@draftplay/shared";
import { TRPCError } from "@trpc/server";
import { getLogger } from "../lib/logger";
import { deductCoins, awardCoins } from "./pop-coins";
import {
  sendBatchNotifications,
  NOTIFICATION_TYPES,
} from "./notifications";
import {
  simulateEntry,
  aggregatePlayerStats,
  type AggregatedPlayerStats,
  type PlayerRole,
  type RawMatchScore,
} from "./cm-engine";

const log = getLogger("cm-service");

// ─── Types ──────────────────────────────────────────────────────────────

export interface EligiblePlayer {
  playerId: string;
  name: string;
  team: string;
  role: string;
  photoUrl?: string | null;
  nationality?: string | null;
  battingStyle?: string;
  bowlingStyle?: string;
  recentSr?: number;
  recentAvg?: number;
  recentEcon?: number;
  recentBowlSr?: number;
  formNote?: string | null;
  recentForm?: number | null;
}

export interface ComposeRoundInput {
  leagueId: string;
  roundNumber: number;
  name: string;
  matchIds: string[];
  lockTime?: Date;
}

export interface UpdateRoundInput {
  roundId: string;
  name?: string;
  matchIds?: string[];
  lockTime?: Date;
}

// Default CM config used when a league's rules don't specify
const DEFAULT_CM_CONFIG = {
  ballLimit: 120,
  minBowlers: 5,
  maxOversPerBowler: 4,
  prizeDistribution: [
    { rank: 1, percent: 50 },
    { rank: 2, percent: 30 },
    { rank: 3, percent: 20 },
  ],
};

function getCmConfig(league: typeof leagues.$inferSelect) {
  const rules = (league.rules ?? {}) as LeagueRules;
  const cm = rules.cricketManager ?? {};
  return {
    ballLimit: cm.ballLimit ?? DEFAULT_CM_CONFIG.ballLimit,
    minBowlers: cm.minBowlersInSquad ?? DEFAULT_CM_CONFIG.minBowlers,
    maxOversPerBowler:
      cm.maxOversPerBowler ?? DEFAULT_CM_CONFIG.maxOversPerBowler,
    prizeDistribution:
      cm.prizeDistribution ?? DEFAULT_CM_CONFIG.prizeDistribution,
    roundPrizeSplit: cm.roundPrizeSplit ?? {},
    prizePool: cm.prizePool ?? 0,
  };
}

// ─── Round composition ─────────────────────────────────────────────────

export async function composeRound(db: Database, input: ComposeRoundInput) {
  const league = await db.query.leagues.findFirst({
    where: eq(leagues.id, input.leagueId),
  });
  if (!league) {
    throw new TRPCError({ code: "NOT_FOUND", message: "League not found" });
  }
  if (league.format !== "cricket_manager") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "League is not a Cricket Manager league",
    });
  }

  if (input.matchIds.length === 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "At least one match required",
    });
  }

  const matchRows = await db
    .select()
    .from(matches)
    .where(inArray(matches.id, input.matchIds));

  if (matchRows.length !== input.matchIds.length) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "One or more match IDs are invalid",
    });
  }

  // All matches must belong to the league's tournament AND be upcoming.
  // Composing a round with live/completed matches is almost always an admin
  // mistake — under the new lifecycle model the round would be unfair for
  // users who can't react to info already revealed during those matches.
  for (const m of matchRows) {
    if (m.tournament !== league.tournament) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Match ${m.id} does not belong to the league's tournament`,
      });
    }
    if (m.status === "live" || m.status === "completed") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Match "${m.teamHome} vs ${m.teamAway}" is already ${m.status} — pick upcoming matches only`,
      });
    }
  }

  const windowStart = new Date(
    Math.min(...matchRows.map((m) => m.startTime.getTime()))
  );
  const windowEnd = new Date(
    Math.max(...matchRows.map((m) => m.startTime.getTime())) +
      4 * 60 * 60 * 1000 // +4h cushion
  );
  // lockTime is display-only metadata now — entries lock when first match
  // goes live, not at a wall-clock time. Store first match start for UI display.
  const lockTime = input.lockTime ?? windowStart;

  const cfg = getCmConfig(league);

  // Resolve tournamentId if available (via tournament name match)
  const tournamentRow = await db.query.tournaments.findFirst({
    where: eq(tournaments.name, league.tournament),
  });

  const roundRows = await db
    .insert(cmRounds)
    .values({
      leagueId: input.leagueId,
      tournamentId: tournamentRow?.id,
      roundNumber: input.roundNumber,
      name: input.name,
      matchIds: input.matchIds,
      windowStart,
      windowEnd,
      lockTime,
      ballLimit: cfg.ballLimit,
      minBowlers: cfg.minBowlers,
      maxOversPerBowler: cfg.maxOversPerBowler,
      matchesTotal: input.matchIds.length,
      // New rule: rounds are open from creation until first match goes live.
      status: "open",
    })
    .returning();

  const round = roundRows[0]!;

  // Auto-populate the eligible player pool from the teams playing these matches.
  // This runs again later (on pre_match phase transition) to catch playing-XI updates.
  try {
    await populateRoundPlayerPool(db, round.id);
  } catch (err) {
    log.warn(
      { err, roundId: round.id },
      "Initial player pool population failed — will retry on pre_match"
    );
  }

  // Fire-and-forget: prewarm AI projections for every match in this round
  // so the build-entry UI never sees a mix of cached-for-some / blank-for-rest.
  prewarmRoundProjections(db, round.id).catch((err) => {
    log.warn({ err, roundId: round.id }, "Projection prewarm failed — baseline will cover");
  });

  // Auto-create the default Mega contest for this round
  const roundPrizePool =
    cfg.roundPrizeSplit.perRoundPct != null
      ? Math.round((cfg.prizePool * cfg.roundPrizeSplit.perRoundPct) / 100)
      : 0;

  await db.insert(cmContests).values({
    roundId: round.id,
    leagueId: league.id,
    name: `${round.name} — Mega Contest`,
    contestType: "mega",
    entryFee: 0, // League entry fee covers round participation
    prizePool: roundPrizePool,
    prizeDistribution: cfg.prizeDistribution,
    maxMembers: league.maxMembers,
    status: "open",
  });

  log.info(
    { roundId: round.id, leagueId: input.leagueId },
    "CM round composed"
  );
  return round;
}

/**
 * Check if any match in the round has gone live or completed. Once the
 * round's first match kicks off, admin can no longer edit or delete it.
 */
async function anyMatchStarted(
  db: Database,
  matchIds: string[]
): Promise<boolean> {
  if (matchIds.length === 0) return false;
  const rows = await db
    .select({ status: matches.status })
    .from(matches)
    .where(inArray(matches.id, matchIds));
  return rows.some(
    (m) =>
      m.status === "live" ||
      m.status === "completed" ||
      m.status === "abandoned"
  );
}

export async function updateRound(db: Database, input: UpdateRoundInput) {
  const round = await db.query.cmRounds.findFirst({
    where: eq(cmRounds.id, input.roundId),
  });
  if (!round) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Round not found" });
  }
  // Allow edits as long as no match in the round has started.
  if (round.status === "settled") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Cannot edit a settled round",
    });
  }
  if (await anyMatchStarted(db, round.matchIds)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Cannot edit round — a match in this round has already started",
    });
  }

  const updates: Partial<typeof cmRounds.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (input.name !== undefined) updates.name = input.name;
  if (input.matchIds !== undefined) {
    updates.matchIds = input.matchIds;
    updates.matchesTotal = input.matchIds.length;
    const matchRows = await db
      .select()
      .from(matches)
      .where(inArray(matches.id, input.matchIds));
    if (matchRows.length !== input.matchIds.length) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Invalid match IDs",
      });
    }
    // Re-validate: new match list can't contain anything already started.
    for (const m of matchRows) {
      if (m.status === "live" || m.status === "completed") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Match "${m.teamHome} vs ${m.teamAway}" is already ${m.status}`,
        });
      }
    }
    const newWindowStart = new Date(
      Math.min(...matchRows.map((m) => m.startTime.getTime()))
    );
    updates.windowStart = newWindowStart;
    updates.windowEnd = new Date(
      Math.max(...matchRows.map((m) => m.startTime.getTime())) +
        4 * 60 * 60 * 1000
    );
    // Keep lock_time in sync with the new first match
    updates.lockTime = newWindowStart;
  }
  if (input.lockTime !== undefined) updates.lockTime = input.lockTime;

  await db.update(cmRounds).set(updates).where(eq(cmRounds.id, input.roundId));
}

export async function deleteRound(db: Database, roundId: string) {
  const round = await db.query.cmRounds.findFirst({
    where: eq(cmRounds.id, roundId),
  });
  if (!round) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Round not found" });
  }
  if (round.status === "settled") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Cannot delete a settled round",
    });
  }
  if (await anyMatchStarted(db, round.matchIds)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Cannot delete round — a match in this round has already started",
    });
  }
  await db.delete(cmRounds).where(eq(cmRounds.id, roundId));
}

// ─── Player pool population ────────────────────────────────────────────

/**
 * Populate the eligible_players JSONB for a round. Called when round transitions
 * upcoming → open. Uses all players on teams playing any of the round's matches.
 */
export async function populateRoundPlayerPool(
  db: Database,
  roundId: string
): Promise<EligiblePlayer[]> {
  const round = await db.query.cmRounds.findFirst({
    where: eq(cmRounds.id, roundId),
  });
  if (!round)
    throw new TRPCError({ code: "NOT_FOUND", message: "Round not found" });

  const matchRows = await db
    .select()
    .from(matches)
    .where(inArray(matches.id, round.matchIds));

  const teamNames = new Set<string>();
  for (const m of matchRows) {
    teamNames.add(m.teamHome);
    teamNames.add(m.teamAway);
  }

  const playerRows = await db
    .select()
    .from(players)
    .where(inArray(players.team, Array.from(teamNames)));

  const eligible: EligiblePlayer[] = playerRows.map((p) => {
    const s = (p.stats as Record<string, unknown> | null) ?? {};
    const num = (k: string): number | undefined => {
      const v = s[k];
      return typeof v === "number" ? v : undefined;
    };
    const str = (k: string): string | undefined => {
      const v = s[k];
      return typeof v === "string" ? v : undefined;
    };
    return {
      playerId: p.id,
      name: p.name,
      team: p.team,
      role: p.role,
      photoUrl: p.photoUrl ?? null,
      nationality: p.nationality ?? null,
      battingStyle: p.battingStyle ?? undefined,
      bowlingStyle: p.bowlingStyle ?? undefined,
      recentSr: num("strikeRate"),
      recentAvg: num("average") ?? num("battingAverage"),
      recentEcon: num("economyRate"),
      recentBowlSr: num("bowlingStrikeRate"),
      formNote: str("formNote") ?? null,
      recentForm: num("recentForm") ?? null,
    };
  });

  await db
    .update(cmRounds)
    .set({ eligiblePlayers: eligible, updatedAt: new Date() })
    .where(eq(cmRounds.id, roundId));

  log.info({ roundId, count: eligible.length }, "Populated round player pool");
  return eligible;
}

/**
 * Prewarm AI projections for every match in a CM round.
 *
 * Called once after populateRoundPlayerPool completes so by the time
 * users open the build-entry UI, projections are already in cache for
 * every eligible player. Without this, only players whose matches were
 * previously opened by salary-cap users had projections, which biased
 * CM team-building.
 *
 * Fire-and-forget: errors are logged but never thrown — a failed
 * prewarm falls back to the stats baseline at read time. Each match is
 * projected independently so a single Gemini failure doesn't sink the
 * whole round.
 */
export async function prewarmRoundProjections(
  db: Database,
  roundId: string
): Promise<{ matches: number; prewarmed: number }> {
  const round = await db.query.cmRounds.findFirst({
    where: eq(cmRounds.id, roundId),
  });
  if (!round) return { matches: 0, prewarmed: 0 };

  const matchRows = await db
    .select()
    .from(matches)
    .where(inArray(matches.id, round.matchIds));
  if (matchRows.length === 0) return { matches: 0, prewarmed: 0 };

  // For each match, gather the playing roster (teams' players) and call
  // the shared projection engine — same cache key salary-cap uses.
  const { getProjectionsForMatch } = await import("./projection-engine");

  let prewarmed = 0;
  for (const m of matchRows) {
    try {
      const rosterRows = await db
        .select({
          id: players.id,
          name: players.name,
          role: players.role,
          team: players.team,
        })
        .from(players)
        .where(inArray(players.team, [m.teamHome, m.teamAway]));

      if (rosterRows.length === 0) continue;

      const result = await getProjectionsForMatch(
        db,
        m.id,
        m.teamHome,
        m.teamAway,
        m.format ?? "T20",
        m.venue ?? null,
        m.tournament ?? "unknown",
        rosterRows
      );
      if (result && result.players.length > 0) {
        prewarmed += result.players.length;
      }
    } catch (err) {
      log.error(
        { err, roundId, matchId: m.id },
        "Failed to prewarm projections for match — baseline will cover it"
      );
    }
  }

  log.info({ roundId, matches: matchRows.length, prewarmed }, "Prewarmed CM round projections");
  return { matches: matchRows.length, prewarmed };
}

// ─── Entry validation + submission ─────────────────────────────────────

export interface SubmitEntryInput {
  roundId: string;
  players: Array<{ playerId: string }>;
  battingOrder: Array<{ position: number; playerId: string }>;
  bowlingPriority: Array<{ priority: number; playerId: string }>;
  toss: "bat_first" | "bowl_first";
  chipUsed?: string;
  chipTarget?: string;
}

export async function submitEntry(
  db: Database,
  userId: string,
  input: SubmitEntryInput
) {
  const round = await db.query.cmRounds.findFirst({
    where: eq(cmRounds.id, input.roundId),
  });
  if (!round)
    throw new TRPCError({ code: "NOT_FOUND", message: "Round not found" });
  // New rule: entry is accepted as long as the round is `open`. No wall-clock
  // gate — the status is the single source of truth. Round flips to `live`
  // the moment the first match goes live via onMatchPhaseTransition.
  if (round.status !== "open") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        round.status === "live"
          ? "round is live — entries are locked"
          : round.status === "settled"
            ? "round is already settled"
            : `round not accepting entries (status: ${round.status})`,
    });
  }

  // Must be a league member
  const membership = await db.query.leagueMembers.findFirst({
    where: and(
      eq(leagueMembers.leagueId, round.leagueId),
      eq(leagueMembers.userId, userId)
    ),
  });
  if (!membership) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Join the league first",
    });
  }

  validateEntryShape(input, round);

  // Upsert entry
  const existing = await db.query.cmEntries.findFirst({
    where: and(
      eq(cmEntries.roundId, input.roundId),
      eq(cmEntries.userId, userId)
    ),
  });

  if (existing) {
    await db
      .update(cmEntries)
      .set({
        players: input.players,
        battingOrder: input.battingOrder,
        bowlingPriority: input.bowlingPriority,
        toss: input.toss,
        chipUsed: input.chipUsed,
        chipTarget: input.chipTarget,
        updatedAt: new Date(),
      })
      .where(eq(cmEntries.id, existing.id));
    return existing;
  }

  const entryRows = await db
    .insert(cmEntries)
    .values({
      roundId: input.roundId,
      userId,
      players: input.players,
      battingOrder: input.battingOrder,
      bowlingPriority: input.bowlingPriority,
      toss: input.toss,
      chipUsed: input.chipUsed,
      chipTarget: input.chipTarget,
    })
    .returning();

  const entry = entryRows[0]!;

  // Auto-join the round's mega contest
  const megaContest = await db.query.cmContests.findFirst({
    where: and(
      eq(cmContests.roundId, input.roundId),
      eq(cmContests.contestType, "mega")
    ),
  });
  if (megaContest) {
    await db
      .insert(cmContestMembers)
      .values({
        contestId: megaContest.id,
        userId,
        entryId: entry.id,
      })
      .onConflictDoNothing();
    await db
      .update(cmContests)
      .set({
        currentMembers: sql`${cmContests.currentMembers} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(cmContests.id, megaContest.id));
  }

  // Ensure user has a standings row
  await db
    .insert(cmLeagueStandings)
    .values({ leagueId: round.leagueId, userId })
    .onConflictDoNothing();

  log.info(
    { entryId: entry.id, userId, roundId: input.roundId },
    "CM entry submitted"
  );
  return entry;
}

function validateEntryShape(
  input: SubmitEntryInput,
  round: typeof cmRounds.$inferSelect
) {
  if (input.players.length !== 11) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Must select exactly 11 players (got ${input.players.length})`,
    });
  }

  const uniqueIds = new Set(input.players.map((p) => p.playerId));
  if (uniqueIds.size !== 11) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Duplicate players" });
  }

  const eligibleIds = new Set(
    (round.eligiblePlayers as EligiblePlayer[]).map((p) => p.playerId)
  );
  if (eligibleIds.size > 0) {
    for (const p of input.players) {
      if (!eligibleIds.has(p.playerId)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Player ${p.playerId} is not eligible for this round`,
        });
      }
    }
  }

  if (input.battingOrder.length !== 11) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Batting order must have 11 slots",
    });
  }
  const positions = new Set(input.battingOrder.map((b) => b.position));
  if (positions.size !== 11) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Batting order positions must be 1..11 and unique",
    });
  }
  for (const b of input.battingOrder) {
    if (b.position < 1 || b.position > 11) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Invalid batting position",
      });
    }
    if (!uniqueIds.has(b.playerId)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Batting order references player not in squad",
      });
    }
  }

  for (const b of input.bowlingPriority) {
    if (!uniqueIds.has(b.playerId)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Bowling priority references player not in squad",
      });
    }
  }

  // Minimum bowler count (based on role from the round's player pool)
  const poolByRole = new Map<string, string>();
  for (const p of round.eligiblePlayers as EligiblePlayer[]) {
    poolByRole.set(p.playerId, p.role);
  }
  if (poolByRole.size > 0) {
    const bowlerCount = input.players.filter((p) => {
      const r = poolByRole.get(p.playerId);
      return r === "bowler" || r === "all_rounder";
    }).length;
    if (bowlerCount < round.minBowlers) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Need at least ${round.minBowlers} bowlers (got ${bowlerCount})`,
      });
    }
  }
}

// ─── Simulation ────────────────────────────────────────────────────────

export async function runEntrySimulation(
  db: Database,
  entryId: string
): Promise<{ nrr: number; battingTotal: number; bowlingTotal: number }> {
  const entry = await db.query.cmEntries.findFirst({
    where: eq(cmEntries.id, entryId),
  });
  if (!entry)
    throw new TRPCError({ code: "NOT_FOUND", message: "Entry not found" });

  const round = await db.query.cmRounds.findFirst({
    where: eq(cmRounds.id, entry.roundId),
  });
  if (!round)
    throw new TRPCError({ code: "NOT_FOUND", message: "Round not found" });

  const playerIds = (entry.players as Array<{ playerId: string }>).map(
    (p) => p.playerId
  );

  const statsMap = await fetchAggregatedStats(db, round.matchIds, playerIds);
  const phantomFillER = await computeRoundAvgER(db, round.matchIds);

  const result = simulateEntry(
    {
      players: entry.players as Array<{ playerId: string }>,
      battingOrder: entry.battingOrder as Array<{
        position: number;
        playerId: string;
      }>,
      bowlingPriority: entry.bowlingPriority as Array<{
        priority: number;
        playerId: string;
      }>,
    },
    statsMap,
    {
      ballLimit: round.ballLimit,
      maxOversPerBowler: round.maxOversPerBowler,
      phantomFillER,
    },
    (entry.toss as "bat_first" | "bowl_first") ?? "bat_first"
  );

  await db
    .update(cmEntries)
    .set({
      battingTotal: result.batting.total,
      battingBallsUsed: result.batting.ballsUsed,
      battingWickets: result.batting.wickets,
      battingDetails: result.batting.details,
      bowlingTotal: result.bowling.total,
      bowlingBallsBowled: result.bowling.ballsBowled,
      bowlingWickets: result.bowling.wickets,
      bowlingDetails: result.bowling.details,
      nrr: result.nrr.toString(),
      battingSr: result.battingSr.toString(),
      updatedAt: new Date(),
    })
    .where(eq(cmEntries.id, entryId));

  return {
    nrr: result.nrr,
    battingTotal: result.batting.total,
    bowlingTotal: result.bowling.total,
  };
}

export async function fetchAggregatedStats(
  db: Database,
  matchIds: string[],
  playerIds: string[]
): Promise<Map<string, AggregatedPlayerStats>> {
  if (playerIds.length === 0 || matchIds.length === 0) return new Map();

  const scoreRows = await db
    .select({
      playerId: playerMatchScores.playerId,
      runs: playerMatchScores.runs,
      ballsFaced: playerMatchScores.ballsFaced,
      overs: playerMatchScores.oversBowled,
      runsConceded: playerMatchScores.runsConceded,
      wickets: playerMatchScores.wickets,
      isPlaying: playerMatchScores.isPlaying,
      role: players.role,
    })
    .from(playerMatchScores)
    .innerJoin(players, eq(playerMatchScores.playerId, players.id))
    .where(
      and(
        inArray(playerMatchScores.matchId, matchIds),
        inArray(playerMatchScores.playerId, playerIds)
      )
    );

  const raw: RawMatchScore[] = scoreRows.map((r) => ({
    playerId: r.playerId,
    role: (r.role as PlayerRole) ?? "batsman",
    runs: r.runs,
    ballsFaced: r.ballsFaced,
    isDismissed: r.ballsFaced > 0, // v1 heuristic — refine when dismissal flag available
    overs: Number(r.overs ?? 0),
    runsConceded: r.runsConceded,
    wickets: r.wickets,
  }));

  return aggregatePlayerStats(raw);
}

// Fallback ER used when a round has no real bowling data yet (e.g. preview
// before any match has started). A league-typical T20 ER for mid-innings.
const FALLBACK_PHANTOM_ER = 8.5;

/**
 * Compute the round's own average bowling ER from every bowler in every match
 * of the round. Used as the phantom-fill ER for `bat_first` simulations — the
 * value self-calibrates to the round's conditions (batting paradises vs
 * bowler-friendly pitches) rather than using a hardcoded constant.
 */
export async function computeRoundAvgER(
  db: Database,
  matchIds: string[]
): Promise<number> {
  if (matchIds.length === 0) return FALLBACK_PHANTOM_ER;
  const rows = await db
    .select({
      overs: playerMatchScores.oversBowled,
      runsConceded: playerMatchScores.runsConceded,
    })
    .from(playerMatchScores)
    .where(inArray(playerMatchScores.matchId, matchIds));

  let totalBalls = 0;
  let totalRuns = 0;
  for (const r of rows) {
    const ov = Number(r.overs ?? 0);
    if (ov <= 0) continue;
    totalBalls += oversToBallsLocal(ov);
    totalRuns += r.runsConceded ?? 0;
  }
  if (totalBalls === 0) return FALLBACK_PHANTOM_ER;
  return (totalRuns / totalBalls) * 6;
}

// Local copy of the engine's cricket-notation overs→balls helper — avoids
// importing it just for one call site.
function oversToBallsLocal(overs: number): number {
  const full = Math.floor(overs);
  const partial = Math.round((overs - full) * 10);
  return full * 6 + partial;
}

export async function rerankContest(db: Database, contestId: string) {
  const members = await db
    .select({
      contestId: cmContestMembers.contestId,
      userId: cmContestMembers.userId,
      entryId: cmContestMembers.entryId,
      nrr: cmEntries.nrr,
      battingSr: cmEntries.battingSr,
      bowlingWickets: cmEntries.bowlingWickets,
      submittedAt: cmEntries.submittedAt,
    })
    .from(cmContestMembers)
    .innerJoin(cmEntries, eq(cmContestMembers.entryId, cmEntries.id))
    .where(eq(cmContestMembers.contestId, contestId));

  members.sort((a, b) => {
    const nrrA = Number(a.nrr);
    const nrrB = Number(b.nrr);
    if (nrrA !== nrrB) return nrrB - nrrA;
    const srA = Number(a.battingSr);
    const srB = Number(b.battingSr);
    if (srA !== srB) return srB - srA;
    if (a.bowlingWickets !== b.bowlingWickets)
      return b.bowlingWickets - a.bowlingWickets;
    return a.submittedAt.getTime() - b.submittedAt.getTime();
  });

  for (let i = 0; i < members.length; i++) {
    const m = members[i]!;
    await db
      .update(cmContestMembers)
      .set({ rank: i + 1 })
      .where(
        and(
          eq(cmContestMembers.contestId, contestId),
          eq(cmContestMembers.userId, m.userId)
        )
      );
  }
}

/**
 * Hook from score-updater: when a match updates, re-simulate all entries for
 * every live CM round that includes this match.
 */
export async function onMatchScoreUpdate(db: Database, matchId: string) {
  const liveRounds = await db
    .select()
    .from(cmRounds)
    .where(
      and(
        eq(cmRounds.status, "live"),
        sql`${cmRounds.matchIds} @> ${JSON.stringify([matchId])}::jsonb`
      )
    );

  for (const round of liveRounds) {
    const entries = await db
      .select()
      .from(cmEntries)
      .where(eq(cmEntries.roundId, round.id));

    for (const e of entries) {
      try {
        await runEntrySimulation(db, e.id);
      } catch (err) {
        log.error({ err, entryId: e.id }, "Failed to re-simulate entry");
      }
    }

    const contests = await db
      .select()
      .from(cmContests)
      .where(eq(cmContests.roundId, round.id));
    for (const c of contests) {
      await rerankContest(db, c.id);
    }
  }
}

/**
 * Hook from match-lifecycle.onPhaseTransition: when a match's phase changes,
 * advance the status of any CM rounds containing it.
 *
 *   pre_match    → refresh player pool (playing XI may now be known), round → open
 *   live         → round → live (and previously, open → locked at lockTime)
 *   completed    → if all matches in the round are complete, settle the round
 *
 * This ties CM into the same lifecycle pipeline as every other format, so admins
 * never have to touch CM-specific controls.
 */
export async function onMatchPhaseTransition(
  db: Database,
  matchId: string,
  toPhase: string
) {
  const rounds = await db
    .select()
    .from(cmRounds)
    .where(sql`${cmRounds.matchIds} @> ${JSON.stringify([matchId])}::jsonb`);

  for (const round of rounds) {
    if (round.status === "settled" || round.status === "void") continue;

    try {
      // pre_match: refresh player pool (playing XI likely just posted) so
      // entries built before the XI announcement get the latest info.
      // Round status does NOT transition here — entries remain open until
      // the first match actually goes live.
      if (toPhase === "pre_match") {
        try {
          await populateRoundPlayerPool(db, round.id);
        } catch (err) {
          log.warn(
            { err, roundId: round.id },
            "pre_match pool refresh failed"
          );
        }
        // Re-prewarm projections once lineups / form data may have been
        // updated. Fire-and-forget — baseline covers any shortfall.
        prewarmRoundProjections(db, round.id).catch((err) => {
          log.warn(
            { err, roundId: round.id },
            "pre_match projection prewarm failed"
          );
        });
      }

      // live: first match in the round just started → round → live,
      // entries freeze. Only the FIRST live transition flips the round;
      // subsequent live events are no-ops.
      if (toPhase === "live") {
        if (
          round.status === "upcoming" ||
          round.status === "open" ||
          round.status === "locked"
        ) {
          await db
            .update(cmRounds)
            .set({ status: "live", updatedAt: new Date() })
            .where(eq(cmRounds.id, round.id));
          await db
            .update(cmContests)
            .set({ status: "live", updatedAt: new Date() })
            .where(eq(cmContests.roundId, round.id));
          log.info(
            { roundId: round.id, matchId },
            "CM round → live (first match live)"
          );

          // Notify members that entries are now locked + round is live
          try {
            await notifyLeagueMembers(
              db,
              round.leagueId,
              NOTIFICATION_TYPES.STATUS_ALERT,
              `${round.name} is live!`,
              "entries are locked. watch your NRR climb as matches play out.",
              { type: "cm_round_live", roundId: round.id }
            );
          } catch (err) {
            log.warn({ err, roundId: round.id }, "round-live notify failed");
          }
        }
      }

      // completed: bump matches counter, settle if this was the last one.
      if (toPhase === "completed") {
        const matchRows = await db
          .select()
          .from(matches)
          .where(inArray(matches.id, round.matchIds));
        const completedCount = matchRows.filter(
          (m) => m.status === "completed" || m.status === "abandoned"
        ).length;

        // Always keep matchesCompleted fresh so the round hub can show "3/7 done"
        if (completedCount !== round.matchesCompleted) {
          await db
            .update(cmRounds)
            .set({
              matchesCompleted: completedCount,
              updatedAt: new Date(),
            })
            .where(eq(cmRounds.id, round.id));
        }

        if (completedCount === matchRows.length && round.status !== "settled") {
          await settleRound(db, round.id);
          log.info(
            { roundId: round.id, matchId },
            "CM round settled (all matches complete)"
          );
        }
      }
    } catch (err) {
      log.error(
        { err, roundId: round.id, matchId, toPhase },
        "CM onMatchPhaseTransition failed for round"
      );
    }
  }
}

// ─── Lifecycle transitions (manual/cron fallback) ─────────────────────

/**
 * Reconcile round statuses against their match states + pre-phase any
 * upcoming matches that should be in `pre_match` now (start time within 24h).
 * Called from:
 *   - score-updater pipeline (after every score refresh)
 *   - admin `cricketManager.tickLifecycles` mutation
 *   - standalone cron (future)
 *
 * Two passes in order:
 *
 * Pass 1 — Time-based match phase-up:
 *   - Any match `status=upcoming, match_phase=idle, start_time < now + 24h`
 *     → applyMatchPhaseChange(..., "pre_match") which fires all side-effects
 *     (draft enablement, contest flips, user notifications, CM pool refresh)
 *
 * Pass 2 — CM round reconciliation:
 *   - upcoming | locked → open (legacy rows; nothing sets these going forward)
 *   - any non-live round with ≥1 match live/completed → live
 *   - live round with zero live/completed matches → demote to open (rollbacks)
 *   - live round with all matches complete → settle
 */
export async function tickRoundLifecycles(db: Database) {
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // ── Pass 1: pre-phase upcoming matches to pre_match if start is within 24h
  try {
    // postgres-js doesn't auto-bind Date inside raw sql`` templates —
    // it needs an ISO string. Drizzle's typed gte/lte do the conversion;
    // raw templates don't. Without this the whole tick was failing
    // silently every poll, blocking idle→pre_match transitions and the
    // round lifecycle reconciliation that follows.
    const in24hIso = in24h.toISOString();
    const toPhaseUp = await db
      .select({ id: matches.id, teamHome: matches.teamHome, teamAway: matches.teamAway })
      .from(matches)
      .where(
        and(
          eq(matches.status, "upcoming"),
          eq(matches.matchPhase, "idle"),
          sql`${matches.startTime} < ${in24hIso}`
        )
      );

    if (toPhaseUp.length > 0) {
      // Dynamic import to avoid circular dep: cm-service ↔ match-lifecycle
      const { applyMatchPhaseChange } = await import("./match-lifecycle");
      for (const m of toPhaseUp) {
        try {
          await applyMatchPhaseChange(db, m.id, "pre_match", "tick:auto_pre_match");
          log.info(
            { matchId: m.id, match: `${m.teamHome} vs ${m.teamAway}` },
            "tick: match auto-transitioned idle → pre_match (24h window)"
          );
        } catch (err) {
          log.error({ err, matchId: m.id }, "tick: auto pre_match failed");
        }
      }
    }
  } catch (err) {
    log.error({ err }, "tick: pre_match scan failed");
  }

  // ── Pass 2: CM round reconciliation
  // Fetch all non-terminal rounds
  const rounds = await db
    .select()
    .from(cmRounds)
    .where(
      inArray(cmRounds.status, ["upcoming", "open", "locked", "live"])
    );

  for (const r of rounds) {
    try {
      const matchRows = await db
        .select()
        .from(matches)
        .where(inArray(matches.id, r.matchIds));

      const liveCount = matchRows.filter((m) => m.status === "live").length;
      const completedCount = matchRows.filter(
        (m) => m.status === "completed" || m.status === "abandoned"
      ).length;
      const totalMatches = matchRows.length;

      // Refresh matchesCompleted counter
      if (completedCount !== r.matchesCompleted) {
        await db
          .update(cmRounds)
          .set({ matchesCompleted: completedCount, updatedAt: new Date() })
          .where(eq(cmRounds.id, r.id));
      }

      // All matches done → settle
      if (totalMatches > 0 && completedCount === totalMatches) {
        if (r.status !== "settled") {
          try {
            await settleRound(db, r.id);
            log.info({ roundId: r.id }, "tick: round settled");
          } catch (err) {
            log.error({ err, roundId: r.id }, "tick: settle failed");
          }
        }
        continue;
      }

      // Any match live or completed → round is live
      const shouldBeLive = liveCount > 0 || completedCount > 0;

      if (shouldBeLive && r.status !== "live") {
        await db
          .update(cmRounds)
          .set({ status: "live", updatedAt: new Date() })
          .where(eq(cmRounds.id, r.id));
        await db
          .update(cmContests)
          .set({ status: "live", updatedAt: new Date() })
          .where(eq(cmContests.roundId, r.id));
        log.info({ roundId: r.id }, "tick: round → live");
        continue;
      }

      // No live/completed matches → round is open (for editing)
      if (!shouldBeLive && r.status !== "open") {
        await db
          .update(cmRounds)
          .set({ status: "open", updatedAt: new Date() })
          .where(eq(cmRounds.id, r.id));
        await db
          .update(cmContests)
          .set({ status: "open", updatedAt: new Date() })
          .where(eq(cmContests.roundId, r.id));
        log.info({ roundId: r.id }, "tick: round → open");
      }
    } catch (err) {
      log.error({ err, roundId: r.id }, "tickRoundLifecycles failed");
    }
  }
}

// ─── Settlement ────────────────────────────────────────────────────────

export async function settleRound(db: Database, roundId: string) {
  const round = await db.query.cmRounds.findFirst({
    where: eq(cmRounds.id, roundId),
  });
  if (!round)
    throw new TRPCError({ code: "NOT_FOUND", message: "Round not found" });

  // Final simulation pass
  const entries = await db
    .select()
    .from(cmEntries)
    .where(eq(cmEntries.roundId, roundId));
  for (const e of entries) {
    try {
      await runEntrySimulation(db, e.id);
    } catch (err) {
      log.error({ err, entryId: e.id }, "Final sim failed");
    }
  }

  // Rerank each contest + pay out prizes
  const contests = await db
    .select()
    .from(cmContests)
    .where(eq(cmContests.roundId, roundId));

  for (const c of contests) {
    await rerankContest(db, c.id);

    if (c.prizePool > 0) {
      const ranked = await db
        .select({
          userId: cmContestMembers.userId,
          rank: cmContestMembers.rank,
        })
        .from(cmContestMembers)
        .where(eq(cmContestMembers.contestId, c.id));

      const distribution = c.prizeDistribution as Array<{
        rank: number;
        percent: number;
      }>;
      for (const d of distribution) {
        const winner = ranked.find((r) => r.rank === d.rank);
        if (winner) {
          const prize = Math.round((c.prizePool * d.percent) / 100);
          if (prize > 0) {
            try {
              await awardCoins(db, winner.userId, prize, "cm_contest_win", {
                contestId: c.id,
                roundId,
                rank: d.rank,
              });
              await db
                .update(cmContestMembers)
                .set({ prizeWon: prize })
                .where(
                  and(
                    eq(cmContestMembers.contestId, c.id),
                    eq(cmContestMembers.userId, winner.userId)
                  )
                );
            } catch (err) {
              log.error(
                { err, userId: winner.userId, contestId: c.id },
                "Failed to award prize"
              );
            }
          }
        }
      }
    }

    await db
      .update(cmContests)
      .set({ status: "settled", updatedAt: new Date() })
      .where(eq(cmContests.id, c.id));
  }

  // Update league standings — win metric fix (battingTotal > bowlingTotal)
  // + streak tracking + losses + worst/avg NRR.
  for (const e of entries) {
    // A "win" is when batting beat bowling (spec §7.4).
    // For bowl_first chases, batting >= bowling +1 means we reached the target.
    // For bat_first, batting > bowling is the natural rule.
    const won = e.battingTotal > e.bowlingTotal;
    const nrrNum = Number(e.nrr);

    // Load existing standing to compute streak + avg correctly
    const existing = await db.query.cmLeagueStandings.findFirst({
      where: and(
        eq(cmLeagueStandings.leagueId, round.leagueId),
        eq(cmLeagueStandings.userId, e.userId)
      ),
    });

    if (!existing) {
      await db.insert(cmLeagueStandings).values({
        leagueId: round.leagueId,
        userId: e.userId,
        totalNrr: nrrNum.toFixed(4),
        roundsPlayed: 1,
        wins: won ? 1 : 0,
        losses: won ? 0 : 1,
        bestNrr: nrrNum.toFixed(4),
        worstNrr: nrrNum.toFixed(4),
        avgNrr: nrrNum.toFixed(4),
        currentWinStreak: won ? 1 : 0,
        bestWinStreak: won ? 1 : 0,
      });
    } else {
      const newRounds = existing.roundsPlayed + 1;
      const newTotal = Number(existing.totalNrr) + nrrNum;
      const newWins = existing.wins + (won ? 1 : 0);
      const newLosses = existing.losses + (won ? 0 : 1);
      const newCurrentStreak = won ? existing.currentWinStreak + 1 : 0;
      const newBestStreak = Math.max(existing.bestWinStreak, newCurrentStreak);
      const newBest = Math.max(Number(existing.bestNrr ?? -Infinity), nrrNum);
      const newWorst = Math.min(Number(existing.worstNrr ?? Infinity), nrrNum);
      const newAvg = newTotal / newRounds;

      await db
        .update(cmLeagueStandings)
        .set({
          totalNrr: newTotal.toFixed(4),
          roundsPlayed: newRounds,
          wins: newWins,
          losses: newLosses,
          bestNrr: newBest.toFixed(4),
          worstNrr: newWorst.toFixed(4),
          avgNrr: newAvg.toFixed(4),
          currentWinStreak: newCurrentStreak,
          bestWinStreak: newBestStreak,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(cmLeagueStandings.leagueId, round.leagueId),
            eq(cmLeagueStandings.userId, e.userId)
          )
        );
    }
  }

  // Rerank league season leaderboard
  await rerankLeagueStandings(db, round.leagueId);

  // Award round-level badges (Master Manager, Bowling Masterclass, 10-win streak)
  try {
    await awardRoundBadges(db, round, entries);
  } catch (err) {
    log.error({ err, roundId }, "Failed to award round badges");
  }

  // Round stats
  const nrrs = entries.map((e) => Number(e.nrr));
  const avgNrr =
    nrrs.length > 0 ? nrrs.reduce((s, n) => s + n, 0) / nrrs.length : 0;
  const bestNrr = nrrs.length > 0 ? Math.max(...nrrs) : 0;

  await db
    .update(cmRounds)
    .set({
      status: "settled",
      totalEntries: entries.length,
      avgNrr: avgNrr.toFixed(4),
      bestNrr: bestNrr.toFixed(4),
      matchesCompleted: round.matchesTotal,
      updatedAt: new Date(),
    })
    .where(eq(cmRounds.id, roundId));

  // Notify participants with their final rank + prize
  try {
    await notifyRoundSettled(db, round, entries);
  } catch (err) {
    log.warn({ err, roundId }, "settlement notify failed");
  }

  // Check if the whole league is now done (all rounds settled)
  try {
    await maybeSettleLeague(db, round.leagueId);
  } catch (err) {
    log.error({ err, leagueId: round.leagueId }, "league settle check failed");
  }

  log.info({ roundId, entries: entries.length }, "CM round settled");
}

// ─── Helpers: notifications, awards, league-level settlement ──────────

async function notifyLeagueMembers(
  db: Database,
  leagueId: string,
  type: "deadline_reminder" | "status_alert" | "contest_result" | "rank_change" | "tournament_award",
  title: string,
  body: string,
  data?: Record<string, unknown>
) {
  const members = await db
    .select({ userId: leagueMembers.userId })
    .from(leagueMembers)
    .where(eq(leagueMembers.leagueId, leagueId));
  if (members.length === 0) return;
  await sendBatchNotifications(
    db,
    members.map((m) => m.userId),
    type,
    title,
    body,
    data
  );
}

async function notifyRoundSettled(
  db: Database,
  round: typeof cmRounds.$inferSelect,
  entries: Array<typeof cmEntries.$inferSelect>
) {
  if (entries.length === 0) return;

  // Get each user's rank + prize in the round's mega contest
  const megaContest = await db.query.cmContests.findFirst({
    where: and(
      eq(cmContests.roundId, round.id),
      eq(cmContests.contestType, "mega")
    ),
  });
  const membersMap = new Map<string, { rank: number | null; prizeWon: number }>();
  if (megaContest) {
    const rows = await db
      .select({
        userId: cmContestMembers.userId,
        rank: cmContestMembers.rank,
        prizeWon: cmContestMembers.prizeWon,
      })
      .from(cmContestMembers)
      .where(eq(cmContestMembers.contestId, megaContest.id));
    for (const r of rows) {
      membersMap.set(r.userId, { rank: r.rank, prizeWon: r.prizeWon });
    }
  }

  // Group users into "winners" and "participants" for distinct messaging
  for (const e of entries) {
    const info = membersMap.get(e.userId);
    const rank = info?.rank ?? "—";
    const prize = info?.prizeWon ?? 0;
    const nrr = Number(e.nrr).toFixed(2);
    const title =
      prize > 0
        ? `${round.name} — you won ${prize} PC!`
        : `${round.name} results are in`;
    const body =
      prize > 0
        ? `finished #${rank} with NRR ${nrr}. prize credited to your wallet.`
        : `finished #${rank} with NRR ${nrr}. check the leaderboard for winners.`;
    await sendBatchNotifications(
      db,
      [e.userId],
      NOTIFICATION_TYPES.CONTEST_RESULT,
      title,
      body,
      {
        type: "cm_round_settled",
        roundId: round.id,
        leagueId: round.leagueId,
        rank,
        prize,
        nrr,
      }
    );
  }
}

/**
 * Emit round-level awards per the spec (§13.7):
 *  - Master Manager: NRR > 5.0 in a single round
 *  - Bowling Masterclass: 10 wickets in bowling simulation
 *  - Tactician: top 10% of the round's contest
 *  - Unbeaten: 10-round win streak
 */
async function awardRoundBadges(
  db: Database,
  round: typeof cmRounds.$inferSelect,
  entries: Array<typeof cmEntries.$inferSelect>
) {
  // Count how many in the top 10% — ceiling of size/10, min 1
  const top10Threshold = Math.max(1, Math.ceil(entries.length / 10));

  // Fetch ranks for tactician check
  const megaContest = await db.query.cmContests.findFirst({
    where: and(
      eq(cmContests.roundId, round.id),
      eq(cmContests.contestType, "mega")
    ),
  });
  const rankByUser = new Map<string, number>();
  if (megaContest) {
    const rows = await db
      .select({
        userId: cmContestMembers.userId,
        rank: cmContestMembers.rank,
      })
      .from(cmContestMembers)
      .where(eq(cmContestMembers.contestId, megaContest.id));
    for (const r of rows) {
      if (r.rank != null) rankByUser.set(r.userId, r.rank);
    }
  }

  const awardsToInsert: Array<{
    leagueId: string;
    roundNumber: number;
    awardType: string;
    userId: string;
    details: Record<string, unknown>;
  }> = [];

  for (const e of entries) {
    const nrrNum = Number(e.nrr);
    // Master Manager — NRR > 5.0
    if (nrrNum > 5.0) {
      awardsToInsert.push({
        leagueId: round.leagueId,
        roundNumber: round.roundNumber,
        awardType: "cm_master_manager",
        userId: e.userId,
        details: { nrr: nrrNum.toFixed(2), round: round.name },
      });
    }
    // Bowling Masterclass — bowling side took 10 wickets
    if (e.bowlingWickets >= 10) {
      awardsToInsert.push({
        leagueId: round.leagueId,
        roundNumber: round.roundNumber,
        awardType: "cm_bowling_masterclass",
        userId: e.userId,
        details: {
          wickets: e.bowlingWickets,
          conceded: e.bowlingTotal,
          round: round.name,
        },
      });
    }
    // Tactician — top 10% of contest
    const rank = rankByUser.get(e.userId);
    if (rank != null && rank <= top10Threshold) {
      awardsToInsert.push({
        leagueId: round.leagueId,
        roundNumber: round.roundNumber,
        awardType: "cm_tactician",
        userId: e.userId,
        details: { rank, totalEntries: entries.length, round: round.name },
      });
    }
  }

  // Unbeaten — check who's on a 10-round win streak after this round
  const streakRows = await db
    .select()
    .from(cmLeagueStandings)
    .where(
      and(
        eq(cmLeagueStandings.leagueId, round.leagueId),
        sql`${cmLeagueStandings.currentWinStreak} >= 10`
      )
    );
  for (const s of streakRows) {
    // Only award if they don't already have it for this round
    awardsToInsert.push({
      leagueId: round.leagueId,
      roundNumber: round.roundNumber,
      awardType: "cm_unbeaten",
      userId: s.userId,
      details: { winStreak: s.currentWinStreak, round: round.name },
    });
  }

  if (awardsToInsert.length > 0) {
    await db.insert(leagueAwards).values(awardsToInsert);

    // Push notify winners of each award
    const notifyUsers = new Set(awardsToInsert.map((a) => a.userId));
    const uniqueAwardsByUser = new Map<string, string[]>();
    for (const a of awardsToInsert) {
      const arr = uniqueAwardsByUser.get(a.userId) ?? [];
      arr.push(a.awardType);
      uniqueAwardsByUser.set(a.userId, arr);
    }
    for (const userId of notifyUsers) {
      const awards = uniqueAwardsByUser.get(userId) ?? [];
      const label = awards
        .map((t) => awardLabel(t))
        .join(", ");
      await sendBatchNotifications(
        db,
        [userId],
        NOTIFICATION_TYPES.TOURNAMENT_AWARD,
        `Award unlocked: ${label}`,
        `nice one — you earned ${awards.length > 1 ? "awards" : "an award"} in ${round.name}.`,
        {
          type: "cm_award",
          roundId: round.id,
          leagueId: round.leagueId,
          awards,
        }
      );
    }
  }
}

function awardLabel(awardType: string): string {
  switch (awardType) {
    case "cm_master_manager":
      return "Master Manager";
    case "cm_bowling_masterclass":
      return "Bowling Masterclass";
    case "cm_tactician":
      return "Tactician";
    case "cm_unbeaten":
      return "Unbeaten";
    case "cm_season_champion":
      return "Season Champion";
    default:
      return awardType;
  }
}

/**
 * Check if a league is done (all rounds settled). If so, distribute the
 * `finalPct` share of the prize pool to the top-ranked users in
 * `cm_league_standings`, award Season Champion, and mark the league settled.
 */
async function maybeSettleLeague(db: Database, leagueId: string) {
  const league = await db.query.leagues.findFirst({
    where: eq(leagues.id, leagueId),
  });
  if (!league || league.format !== "cricket_manager") return;
  if (league.status === "completed" || league.status === "archived") return;

  const allRounds = await db
    .select({ id: cmRounds.id, status: cmRounds.status })
    .from(cmRounds)
    .where(eq(cmRounds.leagueId, leagueId));

  if (allRounds.length === 0) return;
  const allSettled = allRounds.every(
    (r) => r.status === "settled" || r.status === "void"
  );
  if (!allSettled) return;

  const rules = (league.rules ?? {}) as LeagueRules;
  const cm = rules.cricketManager ?? {};
  const prizePool = cm.prizePool ?? 0;
  const finalPct = cm.roundPrizeSplit?.finalPct ?? 0;
  const finalPool = Math.round((prizePool * finalPct) / 100);
  const prizeDist = cm.prizeDistribution ?? [
    { rank: 1, percent: 50 },
    { rank: 2, percent: 30 },
    { rank: 3, percent: 20 },
  ];

  // Distribute final pool based on season standings
  if (finalPool > 0 && prizeDist.length > 0) {
    const standings = await db
      .select()
      .from(cmLeagueStandings)
      .where(eq(cmLeagueStandings.leagueId, leagueId))
      .orderBy(
        sql`${cmLeagueStandings.currentRank} NULLS LAST`,
        desc(cmLeagueStandings.totalNrr)
      );

    for (const d of prizeDist) {
      const winner = standings[d.rank - 1];
      if (!winner) continue;
      const prize = Math.round((finalPool * d.percent) / 100);
      if (prize <= 0) continue;

      try {
        await awardCoins(db, winner.userId, prize, "cm_season_reward", {
          leagueId,
          rank: d.rank,
        });
        await db
          .update(cmLeagueStandings)
          .set({
            prizeWon: sql`${cmLeagueStandings.prizeWon} + ${prize}`,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(cmLeagueStandings.leagueId, leagueId),
              eq(cmLeagueStandings.userId, winner.userId)
            )
          );

        // Season Champion award for rank 1
        if (d.rank === 1) {
          await db.insert(leagueAwards).values({
            leagueId,
            awardType: "cm_season_champion",
            userId: winner.userId,
            details: {
              totalNrr: Number(winner.totalNrr).toFixed(2),
              wins: winner.wins,
              prize,
            },
          });
        }
      } catch (err) {
        log.error(
          { err, userId: winner.userId, leagueId },
          "Failed to pay final season prize"
        );
      }
    }
  }

  // Mark league completed
  await db
    .update(leagues)
    .set({ status: "completed" })
    .where(eq(leagues.id, leagueId));

  // Notify all members
  try {
    await notifyLeagueMembers(
      db,
      leagueId,
      "tournament_award",
      `${league.name} has ended`,
      "the final standings are in. check your season rank and prizes.",
      { type: "cm_league_settled", leagueId }
    );
  } catch (err) {
    log.warn({ err, leagueId }, "league settled notify failed");
  }

  log.info({ leagueId, finalPool }, "CM league settled");
}

/**
 * Join a CM league, charging the one-time entry fee from rules.cricketManager.entryFee.
 * Used by the mobile "Join Mega League" flow to keep the economy honest.
 */
export async function joinCmLeague(
  db: Database,
  userId: string,
  leagueId: string
) {
  const league = await db.query.leagues.findFirst({
    where: eq(leagues.id, leagueId),
  });
  if (!league) {
    throw new TRPCError({ code: "NOT_FOUND", message: "League not found" });
  }
  if (league.format !== "cricket_manager") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "League is not a Cricket Manager league",
    });
  }
  if (league.status === "completed") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "League has already ended",
    });
  }

  const existing = await db.query.leagueMembers.findFirst({
    where: and(
      eq(leagueMembers.leagueId, leagueId),
      eq(leagueMembers.userId, userId)
    ),
  });
  if (existing) {
    throw new TRPCError({ code: "CONFLICT", message: "Already a member" });
  }

  const memberCountRows = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(leagueMembers)
    .where(eq(leagueMembers.leagueId, leagueId));
  if ((memberCountRows[0]?.c ?? 0) >= league.maxMembers) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "League is full" });
  }

  const rules = (league.rules ?? {}) as LeagueRules;
  const entryFee = rules.cricketManager?.entryFee ?? 0;

  // Charge entry fee once (mega-league model: covers all rounds)
  if (entryFee > 0) {
    await deductCoins(db, userId, entryFee, "cm_league_entry", {
      leagueId,
    });
  }

  await db.insert(leagueMembers).values({
    leagueId,
    userId,
    role: "member",
  });

  log.info({ userId, leagueId, entryFee }, "User joined CM league");
  return league;
}

async function rerankLeagueStandings(db: Database, leagueId: string) {
  const standings = await db
    .select()
    .from(cmLeagueStandings)
    .where(eq(cmLeagueStandings.leagueId, leagueId))
    .orderBy(desc(cmLeagueStandings.totalNrr));

  for (let i = 0; i < standings.length; i++) {
    const s = standings[i]!;
    await db
      .update(cmLeagueStandings)
      .set({ currentRank: i + 1 })
      .where(
        and(
          eq(cmLeagueStandings.leagueId, leagueId),
          eq(cmLeagueStandings.userId, s.userId)
        )
      );
  }
}
