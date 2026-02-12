/**
 * Sports Data Service — Write-through PostgreSQL persistence.
 * Source of truth for all sports data. Manages staleness checks,
 * Gemini API refreshes, and audit logging.
 *
 * See /docs/SMART_REFRESH_ARCHITECTURE.md for full spec.
 */

import { eq, and, sql } from "drizzle-orm";
import { getDb } from "@draftcrick/db";
import { tournaments, dataRefreshLog, matches, players } from "@draftcrick/db";
import type { Database } from "@draftcrick/db";
import type {
  Sport,
  AITournament,
  AIMatch,
  AIPlayer,
  AITeamStanding,
  SportsDashboardData,
} from "@draftcrick/shared";
import {
  determineMatchPhase,
  calculateNextRefreshAfter,
  type MatchPhase,
  type RefreshTrigger,
  type RefreshResult,
} from "@draftcrick/shared";
import { fetchSportsData, fetchPlayerRosters, fetchTournamentStandings } from "./gemini-sports";
import { acquireRefreshLock, releaseRefreshLock } from "./sports-cache";
import { getLogger } from "../lib/logger";

const log = getLogger("sports-data");

// ---------------------------------------------------------------------------
// Stable external ID generation
// ---------------------------------------------------------------------------

function normalizeTournamentExternalId(t: AITournament): string {
  return t.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function normalizeMatchExternalId(m: AIMatch): string {
  const teams = [m.teamA, m.teamB]
    .map((t) => t.toLowerCase().replace(/[^a-z0-9]+/g, "_"))
    .sort()
    .join("_vs_");
  const dateStr = m.date.replace(/[^a-z0-9]/gi, "").toLowerCase();
  return `${teams}_${dateStr}`;
}

function normalizePlayerExternalId(name: string, nationality: string): string {
  const normName = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  const normNat = nationality
    ? nationality
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "")
    : "unknown";
  return `${normName}_${normNat}`;
}

// ---------------------------------------------------------------------------
// Read operations
// ---------------------------------------------------------------------------

/**
 * Get dashboard data for a sport from PostgreSQL.
 * Returns null if no data exists (cold start).
 */
export async function getDashboardFromPg(
  sport: Sport
): Promise<SportsDashboardData | null> {
  const db = getDb();

  const pgTournaments = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.sport, sport));

  if (pgTournaments.length === 0) {
    log.info({ sport }, "No tournaments in PG — cold start");
    return null;
  }

  const pgMatches = await db
    .select()
    .from(matches)
    .where(eq(matches.sport, sport));

  // Convert PG rows back to AI format for API compatibility
  const aiTournaments: AITournament[] = pgTournaments.map((t) => ({
    id: t.externalId,
    name: t.name,
    sport: t.sport as Sport,
    category: (t.category as AITournament["category"]) ?? "league",
    startDate: t.startDate,
    endDate: t.endDate,
    imageUrl: null,
    sourceUrl: null,
  }));

  const aiMatches: AIMatch[] = pgMatches.map((m) => ({
    id: m.externalId,
    teamA: m.teamHome,
    teamB: m.teamAway,
    sport: m.sport as Sport,
    format: m.format,
    tournamentName: m.tournament,
    time: m.startTime.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }),
    date: m.startTime.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    venue: m.venue,
    status: m.status as AIMatch["status"],
    scoreSummary: null,
    sourceUrl: null,
  }));

  const latestRefresh = pgTournaments.reduce(
    (latest, t) =>
      t.lastRefreshedAt && (!latest || t.lastRefreshedAt > latest)
        ? t.lastRefreshedAt
        : latest,
    null as Date | null
  );

  return {
    tournaments: aiTournaments,
    matches: aiMatches,
    lastFetched: latestRefresh?.toISOString() ?? new Date().toISOString(),
    sources: [],
    sport,
  };
}

// ---------------------------------------------------------------------------
// Staleness checks
// ---------------------------------------------------------------------------

/**
 * Check if dashboard data for a sport needs refreshing.
 * Returns true if any tournament is past its refresh window or no data exists.
 */
export async function shouldRefreshDashboard(sport: Sport): Promise<boolean> {
  const db = getDb();
  const now = new Date();

  const pgTournaments = await db
    .select({ lastRefreshedAt: tournaments.lastRefreshedAt })
    .from(tournaments)
    .where(eq(tournaments.sport, sport))
    .limit(1);

  // No data at all — definitely need to refresh
  if (pgTournaments.length === 0) return true;

  const last = pgTournaments[0]?.lastRefreshedAt;
  if (!last) return true;

  // Dashboard-level staleness: refresh if oldest tournament data is > 2 hours old
  const ageMs = now.getTime() - last.getTime();
  const twoHoursMs = 2 * 60 * 60 * 1000;
  return ageMs > twoHoursMs;
}

// ---------------------------------------------------------------------------
// Write operations — upsert Gemini data into PostgreSQL
// ---------------------------------------------------------------------------

/**
 * Upsert tournaments from Gemini into PostgreSQL using stable external IDs.
 * Returns count of upserted records.
 */
export async function upsertTournaments(
  sport: Sport,
  aiTournaments: AITournament[],
  db?: Database
): Promise<number> {
  const database = db ?? getDb();
  const now = new Date();
  let upserted = 0;

  for (const t of aiTournaments) {
    const externalId = normalizeTournamentExternalId(t);

    await database
      .insert(tournaments)
      .values({
        externalId,
        name: t.name,
        sport,
        category: t.category,
        startDate: t.startDate,
        endDate: t.endDate,
        status: "active",
        lastRefreshedAt: now,
        refreshSource: "gemini",
      })
      .onConflictDoUpdate({
        target: [tournaments.externalId, tournaments.sport],
        set: {
          name: t.name,
          category: t.category,
          startDate: t.startDate,
          endDate: t.endDate,
          lastRefreshedAt: now,
          refreshSource: "gemini",
          updatedAt: now,
        },
      });

    upserted++;
  }

  log.info({ sport, count: upserted }, "Upserted tournaments");
  return upserted;
}

/**
 * Upsert matches from Gemini into PostgreSQL using stable external IDs.
 * Links matches to their tournament via FK.
 * Returns count of upserted records.
 */
export async function upsertMatches(
  sport: Sport,
  aiMatches: AIMatch[],
  db?: Database
): Promise<number> {
  const database = db ?? getDb();
  const now = new Date();
  let upserted = 0;

  // Build a lookup for tournament name → tournament ID
  const pgTournaments = await database
    .select({ id: tournaments.id, externalId: tournaments.externalId, name: tournaments.name })
    .from(tournaments)
    .where(eq(tournaments.sport, sport));

  const tournamentLookup = new Map<string, string>();
  for (const t of pgTournaments) {
    tournamentLookup.set(t.name.toLowerCase(), t.id);
  }

  for (const m of aiMatches) {
    const externalId = normalizeMatchExternalId(m);

    // Parse the AI match date+time into a proper timestamp
    let startTime: Date;
    try {
      startTime = parseAIDateTime(m.date, m.time);
    } catch {
      log.warn({ matchId: externalId, date: m.date, time: m.time }, "Failed to parse match date/time, skipping");
      continue;
    }

    const phase = determineMatchPhase(startTime, null, m.status);
    const nextRefresh = calculateNextRefreshAfter(phase, now);
    const tournamentId = tournamentLookup.get(m.tournamentName.toLowerCase()) ?? null;

    await database
      .insert(matches)
      .values({
        externalId,
        sport,
        format: m.format,
        tournament: m.tournamentName,
        teamHome: m.teamA,
        teamAway: m.teamB,
        venue: m.venue ?? "TBD",
        startTime,
        status: m.status,
        tournamentId,
        matchPhase: phase,
        lastRefreshedAt: now,
        nextRefreshAfter: nextRefresh,
        refreshCount: 1,
      })
      .onConflictDoUpdate({
        target: matches.externalId,
        set: {
          format: m.format,
          tournament: m.tournamentName,
          teamHome: m.teamA,
          teamAway: m.teamB,
          venue: m.venue ?? "TBD",
          startTime,
          status: m.status,
          tournamentId,
          matchPhase: phase,
          lastRefreshedAt: now,
          nextRefreshAfter: nextRefresh,
          refreshCount: sql`${matches.refreshCount} + 1`,
        },
      });

    upserted++;
  }

  log.info({ sport, count: upserted }, "Upserted matches");
  return upserted;
}

/**
 * Upsert players from Gemini into PostgreSQL using stable external IDs.
 * Deduplicates by name+nationality — same player in multiple tournaments = one row.
 * Returns count of upserted records.
 */
export async function upsertPlayers(
  sport: Sport,
  aiPlayers: AIPlayer[],
  db?: Database
): Promise<number> {
  const database = db ?? getDb();
  const now = new Date();

  // Local deduplication: keep latest entry per externalId
  const dedupMap = new Map<string, AIPlayer>();
  for (const p of aiPlayers) {
    const externalId = normalizePlayerExternalId(p.name, p.nationality);
    dedupMap.set(externalId, p);
  }

  let upserted = 0;

  for (const [externalId, p] of dedupMap) {
    const stats: Record<string, number | undefined> = {
      credits: p.credits ?? undefined,
      average: p.battingAvg ?? undefined,
      bowlingAverage: p.bowlingAvg ?? undefined,
    };
    // Strip undefined keys
    const cleanStats = Object.fromEntries(
      Object.entries(stats).filter(([, v]) => v !== undefined)
    );

    await database
      .insert(players)
      .values({
        externalId,
        name: p.name,
        team: p.team,
        role: p.role,
        nationality: p.nationality,
        battingStyle: p.battingStyle,
        bowlingStyle: p.bowlingStyle,
        stats: cleanStats,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: players.externalId,
        set: {
          name: p.name,
          team: p.team,
          role: p.role,
          nationality: p.nationality,
          battingStyle: p.battingStyle,
          bowlingStyle: p.bowlingStyle,
          stats: cleanStats,
          updatedAt: now,
        },
      });

    upserted++;
  }

  log.info({ sport, count: upserted }, "Upserted players");
  return upserted;
}

// ---------------------------------------------------------------------------
// Standings persistence
// ---------------------------------------------------------------------------

/**
 * Update tournament standings (points table) in PostgreSQL.
 * Writes AITeamStanding[] as JSONB on each matching tournament row.
 */
export async function updateTournamentStandings(
  sport: Sport,
  standingsMap: Map<string, AITeamStanding[]>,
  db?: Database
): Promise<number> {
  const database = db ?? getDb();
  let updated = 0;

  for (const [tournamentName, standings] of standingsMap) {
    const result = await database
      .update(tournaments)
      .set({
        standings: standings as any,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(tournaments.name, tournamentName),
          eq(tournaments.sport, sport)
        )
      );

    updated++;
  }

  log.info({ sport, count: updated }, "Updated tournament standings");
  return updated;
}

// ---------------------------------------------------------------------------
// Refresh orchestration
// ---------------------------------------------------------------------------

/**
 * Execute a full dashboard refresh: fetch from Gemini, upsert into PG, log result.
 * Acquires a distributed lock to prevent concurrent refreshes.
 */
export async function executeRefresh(
  sport: Sport,
  trigger: RefreshTrigger,
  userId?: string
): Promise<RefreshResult> {
  const lockKey = `dashboard:${sport}`;
  const startTime = Date.now();
  const db = getDb();

  // Try to acquire distributed lock
  const locked = await acquireRefreshLock(lockKey);
  if (!locked) {
    log.debug({ sport }, "Refresh lock held by another process — skipping");
    return {
      refreshed: false,
      trigger,
      durationMs: Date.now() - startTime,
      recordsUpserted: 0,
    };
  }

  // Create refresh log entry
  const logEntries = await db
    .insert(dataRefreshLog)
    .values({
      entityType: "dashboard",
      entityId: sport,
      sport,
      trigger,
      triggeredByUserId: userId,
      status: "in_progress",
    })
    .returning({ id: dataRefreshLog.id });
  const logEntryId = logEntries[0]?.id;

  try {
    log.info({ sport, trigger }, "Starting Gemini refresh");

    const data = await fetchSportsData(sport);

    const tournamentsUpserted = await upsertTournaments(sport, data.tournaments, db);
    const matchesUpserted = await upsertMatches(sport, data.matches, db);

    // Best-effort player roster fetch — failure does NOT block the refresh
    let playersUpserted = 0;
    try {
      const tournamentNames = data.tournaments.map((t) => t.name);
      if (tournamentNames.length > 0) {
        const aiPlayers = await fetchPlayerRosters(sport, tournamentNames);
        playersUpserted = await upsertPlayers(sport, aiPlayers, db);
      }
    } catch (playerError) {
      log.warn(
        { sport, error: String(playerError) },
        "Player roster fetch failed — dashboard refresh continues"
      );
    }

    // Best-effort standings fetch — failure does NOT block the refresh
    try {
      const tournamentNames = data.tournaments.map((t) => t.name);
      if (tournamentNames.length > 0) {
        const standingsMap = await fetchTournamentStandings(sport, tournamentNames);
        await updateTournamentStandings(sport, standingsMap, db);
      }
    } catch (standingsError) {
      log.warn(
        { sport, error: String(standingsError) },
        "Standings fetch failed — dashboard refresh continues"
      );
    }

    const totalUpserted = tournamentsUpserted + matchesUpserted + playersUpserted;

    const durationMs = Date.now() - startTime;

    // Update log entry
    if (logEntryId) {
      await db
        .update(dataRefreshLog)
        .set({
          status: "success",
          completedAt: new Date(),
          durationMs,
          recordsUpserted: totalUpserted,
        })
        .where(eq(dataRefreshLog.id, logEntryId));
    }

    log.info(
      { sport, trigger, durationMs, tournamentsUpserted, matchesUpserted, playersUpserted },
      "Refresh completed"
    );

    return {
      refreshed: true,
      trigger,
      durationMs,
      recordsUpserted: totalUpserted,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);

    // Update log entry with failure
    if (logEntryId) {
      await db
        .update(dataRefreshLog)
        .set({
          status: "failed",
          completedAt: new Date(),
          durationMs,
          errorMessage: errorMsg,
        })
        .where(eq(dataRefreshLog.id, logEntryId));
    }

    log.error({ sport, trigger, durationMs, error: errorMsg }, "Refresh failed");

    return {
      refreshed: false,
      trigger,
      durationMs,
      recordsUpserted: 0,
      error: errorMsg,
    };
  } finally {
    await releaseRefreshLock(lockKey);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse AI date ("Feb 12, 2026") and time ("7:30 PM IST") into a Date.
 */
function parseAIDateTime(dateStr: string, timeStr: string): Date {
  // Strip timezone abbreviations (IST, GMT, etc.) — parse as UTC
  const cleanTime = timeStr.replace(/\s*[A-Z]{2,4}\s*$/, "").trim();
  const combined = `${dateStr} ${cleanTime}`;
  const parsed = new Date(combined);

  if (isNaN(parsed.getTime())) {
    // Fallback: try just the date
    const dateOnly = new Date(dateStr);
    if (isNaN(dateOnly.getTime())) {
      throw new Error(`Cannot parse date/time: ${combined}`);
    }
    return dateOnly;
  }
  return parsed;
}
