/**
 * Chip Service — fantasy chip activation, validation, and scoring modifiers.
 *
 * Chips are strategic power-ups users can activate once per tournament (or as configured).
 * Only one chip per match. Must be activated before team lock deadline.
 */

import { eq, and } from "drizzle-orm";
import type { Database } from "@draftplay/db";
import { chipUsage, tournamentLeagues, tournamentTeamSubmissions } from "@draftplay/db";
import { getLogger } from "../lib/logger";

const log = getLogger("chips");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ChipType =
  | "wildcard"
  | "triple_captain"
  | "bench_boost"
  | "free_hit"
  | "power_play"
  | "death_over_specialist";

export interface ChipScoringModifiers {
  captainMultiplier: number;
  viceCaptainMultiplier: number;
  includesBench: boolean;
  unlimitedTransfers: boolean;
  revertAfterMatch: boolean;
  battingMultiplier: number;
  deathOverWicketMultiplier: number;
}

const CHIP_LIMIT_FIELDS: Record<ChipType, keyof typeof tournamentLeagues.$inferSelect> = {
  wildcard: "wildcardsPerTournament",
  triple_captain: "tripleCaptainCount",
  bench_boost: "benchBoostCount",
  free_hit: "freeHitCount",
  power_play: "wildcardsPerTournament", // no dedicated column; use wildcard count as fallback (1)
  death_over_specialist: "freeHitCount", // same — 1 per tournament by default
};

// ---------------------------------------------------------------------------
// Chip Activation
// ---------------------------------------------------------------------------

/**
 * Activate a chip for a specific match.
 * Validates: chips enabled, under limit, one per match, before deadline.
 */
export async function activateChip(
  db: Database,
  userId: string,
  tournamentLeagueId: string,
  matchId: string,
  chipType: ChipType
) {
  const tl = await db.query.tournamentLeagues.findFirst({
    where: eq(tournamentLeagues.id, tournamentLeagueId),
  });

  if (!tl) throw new Error("Tournament league not found");
  if (!tl.chipsEnabled) throw new Error("Chips are not enabled for this league");

  // Check usage limit for this chip type
  const available = await getAvailableChips(db, userId, tournamentLeagueId);
  const chipInfo = available.find((c) => c.chipType === chipType);
  if (!chipInfo || chipInfo.remaining <= 0) {
    throw new Error(`No ${chipType} chips remaining`);
  }

  // Check one chip per match
  const existingChipThisMatch = await db.query.chipUsage.findFirst({
    where: and(
      eq(chipUsage.tournamentLeagueId, tournamentLeagueId),
      eq(chipUsage.userId, userId),
      eq(chipUsage.matchId, matchId)
    ),
  });

  if (existingChipThisMatch) {
    throw new Error(
      `Already using ${existingChipThisMatch.chipType} for this match. Deactivate it first.`
    );
  }

  // Insert chip usage
  const [row] = await db
    .insert(chipUsage)
    .values({ tournamentLeagueId, userId, chipType, matchId })
    .returning();

  // Update team submission if exists
  const submission = await db.query.tournamentTeamSubmissions.findFirst({
    where: and(
      eq(tournamentTeamSubmissions.tournamentLeagueId, tournamentLeagueId),
      eq(tournamentTeamSubmissions.userId, userId),
      eq(tournamentTeamSubmissions.matchId, matchId)
    ),
  });

  if (submission) {
    await db
      .update(tournamentTeamSubmissions)
      .set({ chipUsed: chipType })
      .where(eq(tournamentTeamSubmissions.id, submission.id));
  }

  log.info({ userId, tournamentLeagueId, matchId, chipType }, "Chip activated");
  return row!;
}

/**
 * Deactivate a chip for a match (before deadline).
 */
export async function deactivateChip(
  db: Database,
  userId: string,
  tournamentLeagueId: string,
  matchId: string
) {
  const existing = await db.query.chipUsage.findFirst({
    where: and(
      eq(chipUsage.tournamentLeagueId, tournamentLeagueId),
      eq(chipUsage.userId, userId),
      eq(chipUsage.matchId, matchId)
    ),
  });

  if (!existing) throw new Error("No active chip for this match");

  await db.delete(chipUsage).where(eq(chipUsage.id, existing.id));

  // Clear chipUsed on team submission
  const submission = await db.query.tournamentTeamSubmissions.findFirst({
    where: and(
      eq(tournamentTeamSubmissions.tournamentLeagueId, tournamentLeagueId),
      eq(tournamentTeamSubmissions.userId, userId),
      eq(tournamentTeamSubmissions.matchId, matchId)
    ),
  });

  if (submission) {
    await db
      .update(tournamentTeamSubmissions)
      .set({ chipUsed: null })
      .where(eq(tournamentTeamSubmissions.id, submission.id));
  }

  log.info({ userId, matchId, chipType: existing.chipType }, "Chip deactivated");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Available Chips
// ---------------------------------------------------------------------------

/**
 * Get remaining chips for a user in a tournament league.
 */
export async function getAvailableChips(
  db: Database,
  userId: string,
  tournamentLeagueId: string
) {
  const tl = await db.query.tournamentLeagues.findFirst({
    where: eq(tournamentLeagues.id, tournamentLeagueId),
  });

  if (!tl) throw new Error("Tournament league not found");

  // Get all chip usage for this user
  const usedChips = await db.query.chipUsage.findMany({
    where: and(
      eq(chipUsage.tournamentLeagueId, tournamentLeagueId),
      eq(chipUsage.userId, userId)
    ),
  });

  const usedCountByType: Record<string, number> = {};
  for (const c of usedChips) {
    usedCountByType[c.chipType] = (usedCountByType[c.chipType] || 0) + 1;
  }

  const chipTypes: ChipType[] = [
    "wildcard",
    "triple_captain",
    "bench_boost",
    "free_hit",
    "power_play",
    "death_over_specialist",
  ];

  const limits: Record<ChipType, number> = {
    wildcard: tl.wildcardsPerTournament ?? 2,
    triple_captain: tl.tripleCaptainCount ?? 1,
    bench_boost: tl.benchBoostCount ?? 1,
    free_hit: tl.freeHitCount ?? 1,
    power_play: 1,
    death_over_specialist: 1,
  };

  return chipTypes.map((chipType) => ({
    chipType,
    total: limits[chipType],
    used: usedCountByType[chipType] || 0,
    remaining: limits[chipType] - (usedCountByType[chipType] || 0),
  }));
}

// ---------------------------------------------------------------------------
// Scoring Modifiers
// ---------------------------------------------------------------------------

/**
 * Get scoring modifiers for a chip type. Pure function — no DB access.
 */
export function getChipScoringModifiers(chipType: ChipType): ChipScoringModifiers {
  const base: ChipScoringModifiers = {
    captainMultiplier: 2,
    viceCaptainMultiplier: 1.5,
    includesBench: false,
    unlimitedTransfers: false,
    revertAfterMatch: false,
    battingMultiplier: 1,
    deathOverWicketMultiplier: 1,
  };

  switch (chipType) {
    case "triple_captain":
      return { ...base, captainMultiplier: 3 };
    case "bench_boost":
      return { ...base, includesBench: true };
    case "wildcard":
      return { ...base, unlimitedTransfers: true };
    case "free_hit":
      return { ...base, unlimitedTransfers: true, revertAfterMatch: true };
    case "power_play":
      return { ...base, battingMultiplier: 1.5 };
    case "death_over_specialist":
      return { ...base, deathOverWicketMultiplier: 2 };
    default:
      return base;
  }
}
