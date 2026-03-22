/**
 * Sports Data Service — Write-through PostgreSQL persistence.
 * Source of truth for all sports data. Manages staleness checks,
 * Gemini API refreshes, and audit logging.
 *
 * See /docs/SMART_REFRESH_ARCHITECTURE.md for full spec.
 */

import { eq, and, or, ilike, inArray, sql } from "drizzle-orm";
import { getDb } from "@draftplay/db";
import { tournaments, dataRefreshLog, matches, players, playerMatchScores } from "@draftplay/db";
import type { Database } from "@draftplay/db";
import { calculatePlayerCredits } from "./credits-engine";
import type {
  Sport,
  AITournament,
  AIMatch,
  AIPlayer,
  AITeamStanding,
  SportsDashboardData,
  PlayerDiffEntry,
  PlayerFieldChange,
} from "@draftplay/shared";
import {
  determineMatchPhase,
  calculateNextRefreshAfter,
  type MatchPhase,
  type RefreshTrigger,
  type RefreshResult,
} from "@draftplay/shared";
import { fetchSportsData, fetchTournamentStandings, discoverTournaments, resolveNationalitiesWithGemini } from "./gemini-sports";
import {
  fetchDashboardWithFallback,
  discoverTournamentsWithFallback,
  fetchStandingsWithFallback,
  fetchF1StandingsFromJolpica,
} from "../providers";
import { acquireRefreshLock, releaseRefreshLock } from "./sports-cache";
import { getAdminConfig } from "./admin-config";
import { getLogger } from "../lib/logger";

export type DataSourcePreference = "auto" | "espn" | "jolpica" | "gemini" | "cricbuzz";

export async function getDataSourcePreference(): Promise<DataSourcePreference> {
  const val = await getAdminConfig<string>("dataSource");
  if (val === "espn" || val === "jolpica" || val === "gemini" || val === "cricbuzz") return val;
  return "auto";
}

const log = getLogger("sports-data");

// ---------------------------------------------------------------------------
// Stable external ID generation
// ---------------------------------------------------------------------------

function normalizeTournamentExternalId(t: AITournament): string {
  return t.name
    .toLowerCase()
    .replace(/\s*\(postponed\)\s*/gi, " ")
    .replace(/\s*\d{4}(-\d{2,4})?\s*$/, "") // strip trailing year (e.g. "2026", "2025-26")
    .replace(/,\s*$/, "")                     // strip trailing comma left after year removal
    .trim()
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

// Map adjective nationality forms to country names for consistent dedup
const NATIONALITY_MAP: Record<string, string> = {
  indian: "india", english: "england", australian: "australia",
  south_african: "south_africa", sri_lankan: "sri_lanka",
  pakistani: "pakistan", bangladeshi: "bangladesh", afghan: "afghanistan",
  new_zealander: "new_zealand", kiwi: "new_zealand",
  west_indian: "west_indies", windies: "west_indies",
  irish: "ireland", scottish: "scotland", dutch: "netherlands",
  namibian: "namibia", omani: "oman", nepalese: "nepal", nepali: "nepal",
  zimbabwean: "zimbabwe", ugandan: "uganda", papuan: "papua_new_guinea",
  american: "usa", canadian: "canada",
};

/**
 * Map of formal/legal first names → commonly-known cricket first names.
 * Prevents "Joseph Charles Buttler" and "Jos Buttler" from becoming separate IDs.
 */
const FIRST_NAME_CANONICAL: Record<string, string> = {
  joseph: "jos",
  samuel: "sam",
  philip: "phil",
  benjamin: "ben",
  christopher: "chris",
  william: "will",
  thomas: "tom",
  joshua: "josh",
  matthew: "matt",
  nicholas: "nick",
  alexander: "alex",
  michael: "mike",
  daniel: "dan",
  andrew: "andy",
  jonathan: "jon",
  timothy: "tim",
  edward: "ed",
  richard: "ricky",
  david: "dave",
  robert: "rob",
  james: "jimmy",
  // Cricket-specific
  ravichandran: "ravichandran", // R Ashwin — keep full
  suryakumar: "suryakumar",
  rishabh: "rishabh",
  ravindra: "ravindra",
};

/**
 * Collapse a player name to first + last name only, stripping middle names.
 * Handles special cases like "KL Rahul", "de Villiers", "van der Dussen".
 */
function collapseToFirstLast(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 2) return name; // already first + last (or single name)

  // Preserve name particles (de, van, von, du, el, al, bin, di)
  const particles = new Set(["de", "van", "von", "du", "el", "al", "bin", "di", "der", "den", "la", "le"]);
  const firstPart = parts[0]!;

  // Find the last "real" name (last name + any preceding particles)
  let lastIdx = parts.length - 1;
  while (lastIdx > 1 && particles.has(parts[lastIdx - 1]!.toLowerCase())) {
    lastIdx--;
  }

  const lastName = parts.slice(lastIdx).join(" ");
  return `${firstPart} ${lastName}`;
}

export function normalizePlayerExternalId(name: string, nationality: string): string {
  // Expand common abbreviations before normalizing to prevent
  // "Mohd. Siraj" and "Mohammed Siraj" from becoming different IDs
  let expanded = name
    .replace(/\bMohd\.?\b/gi, "Mohammed")
    .replace(/\bMd\.?\b/gi, "Mohammed")
    .replace(/\bMoh\.?\b/gi, "Mohammed")
    .replace(/\bDK\b/g, "Dinesh Karthik")
    .replace(/\bSKY\b/g, "Suryakumar Yadav")
    .replace(/\bKL\b/g, "KL") // keep KL Rahul as-is
    .replace(/\bJr\.?\b/gi, "Junior")
    .replace(/\bSr\.?\b/gi, "Senior");

  // Strip middle names: "Joseph Charles Buttler" → "Joseph Buttler"
  expanded = collapseToFirstLast(expanded);

  // Canonicalize first name: "Joseph Buttler" → "Jos Buttler"
  const words = expanded.split(/\s+/);
  if (words.length >= 2) {
    const firstLower = words[0]!.toLowerCase();
    const canonical = FIRST_NAME_CANONICAL[firstLower];
    if (canonical) {
      words[0] = canonical;
      expanded = words.join(" ");
    }
  }

  const normName = expanded
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

  // Normalize nationality: "Indian" → "india", "English" → "england", etc.
  let normNat = nationality
    ? nationality
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "")
    : "unknown";
  normNat = NATIONALITY_MAP[normNat] ?? normNat;

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
    .where(and(eq(tournaments.sport, sport), eq(tournaments.isVisible, true)));

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
    description: t.description ?? null,
    teams: Array.isArray(t.teams) ? (t.teams as AITournament["teams"]) : null,
  }));

  const aiMatches: AIMatch[] = pgMatches.map((m) => ({
    id: m.externalId,
    teamA: m.teamHome,
    teamB: m.teamAway,
    sport: m.sport as Sport,
    format: m.format,
    tournamentName: m.tournament,
    // Send ISO string so the client can format in the user's local timezone
    time: m.startTime.toISOString(),
    date: m.startTime.toISOString(),
    venue: m.venue,
    status: m.status as AIMatch["status"],
    scoreSummary: m.scoreSummary ?? null,
    tossWinner: m.tossWinner ?? null,
    tossDecision: m.tossDecision ?? null,
    result: m.result ?? null,
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

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const maxFutureDate = new Date(today);
  maxFutureDate.setDate(maxFutureDate.getDate() + 90);

  for (const t of aiTournaments) {
    // Skip tournaments that have already ended
    if (t.endDate && t.endDate !== "unknown") {
      const endDate = new Date(t.endDate + "T23:59:59");
      if (endDate < today) {
        log.debug({ name: t.name, endDate: t.endDate }, "Skipping past tournament");
        continue;
      }
    }

    // Skip tournaments that start more than 90 days from now
    if (t.startDate && t.startDate !== "unknown") {
      const startDate = new Date(t.startDate + "T00:00:00");
      if (startDate > maxFutureDate) {
        log.debug({ name: t.name, startDate: t.startDate }, "Skipping tournament too far in future (>90 days)");
        continue;
      }
    }

    const externalId = t.id && t.id.length > 0
      ? t.id
      : normalizeTournamentExternalId(t);
    // Clean up display name but preserve the year/season suffix so that
    // multiple editions (e.g. IPL 2026, IPL 2027) coexist as separate rows.
    const displayName = t.name
      .replace(/\s*\(Postponed\)\s*/gi, " ")
      .replace(/,\s*$/, "")
      .trim();

    // Normal upsert by externalId+sport
    await database
      .insert(tournaments)
      .values({
        externalId,
        name: displayName,
        sport,
        category: t.category,
        description: t.description,
        startDate: t.startDate,
        endDate: t.endDate,
        status: "active",
        lastRefreshedAt: now,
        refreshSource: "gemini",
      })
      .onConflictDoUpdate({
        target: [tournaments.externalId, tournaments.sport],
        set: {
          name: displayName,
          category: t.category,
          description: t.description,
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
export interface UpsertMatchesResult {
  total: number;
  newCount: number;
  updatedCount: number;
  skippedCount: number;
  newMatches: string[];
  updatedMatches: string[];
}

export async function upsertMatches(
  sport: Sport,
  aiMatches: AIMatch[],
  db?: Database
): Promise<UpsertMatchesResult> {
  const database = db ?? getDb();
  const now = new Date();

  // Build a lookup for tournament externalId → tournament UUID.
  // Primary linkage is always by externalId (e.g. "cb-9241").
  // Name-based fallback exists only for non-Cricbuzz providers that don't set tournamentExternalId.
  const pgTournaments = await database
    .select({
      id: tournaments.id,
      externalId: tournaments.externalId,
      name: tournaments.name,
    })
    .from(tournaments)
    .where(eq(tournaments.sport, sport));

  /** Strip trailing year from a name for lookup purposes */
  const stripYear = (s: string) => s.replace(/\s*\d{4}(-\d{2,4})?\s*$/, "").trim().toLowerCase();

  const tournamentLookup = new Map<string, string>();
  for (const t of pgTournaments) {
    // Index by externalId first — this is the authoritative key
    if (t.externalId) {
      tournamentLookup.set(t.externalId.toLowerCase(), t.id);
    }
    // Name-based keys as fallback (last-write-wins is fine for fallback — the
    // externalId path should always be used for Cricbuzz matches)
    tournamentLookup.set(t.name.toLowerCase(), t.id);
    tournamentLookup.set(stripYear(t.name), t.id);
  }

  // Pre-load existing match externalIds to distinguish new vs updated
  const existingRows = await database
    .select({ externalId: matches.externalId })
    .from(matches)
    .where(eq(matches.sport, sport));
  const existingSet = new Set(existingRows.map((r) => r.externalId));

  const result: UpsertMatchesResult = {
    total: 0, newCount: 0, updatedCount: 0, skippedCount: 0,
    newMatches: [], updatedMatches: [],
  };

  for (const m of aiMatches) {
    // Skip matches with placeholder/undecided teams (TBC, TBD, T.B.C, etc.)
    const tbcPattern = /^t\.?b\.?[cd]\.?$/i;
    if (tbcPattern.test(m.teamA.trim()) || tbcPattern.test(m.teamB.trim())) {
      log.debug({ teamA: m.teamA, teamB: m.teamB }, "Skipping TBC match");
      result.skippedCount++;
      continue;
    }

    const externalId = m.id && m.id.length > 0
      ? m.id
      : normalizeMatchExternalId(m);

    // Parse the AI match date+time into a proper timestamp
    let startTime: Date;
    try {
      startTime = parseAIDateTime(m.date, m.time);
    } catch {
      log.warn({ matchId: externalId, date: m.date, time: m.time }, "Failed to parse match date/time, skipping");
      result.skippedCount++;
      continue;
    }

    const phase = determineMatchPhase(startTime, null, m.status);
    // Derive correct status from phase — Gemini often returns stale "upcoming" for past matches
    const correctedStatus = phase === "completed" ? "completed"
      : phase === "live" ? "live"
      : phase === "post_match" ? "completed"
      : m.status;
    const nextRefresh = calculateNextRefreshAfter(phase, now);
    // Link by tournament externalId first (authoritative for Cricbuzz matches).
    // Fall back to name-based lookup only for providers that don't set tournamentExternalId.
    const tournamentId =
      (m.tournamentExternalId ? tournamentLookup.get(m.tournamentExternalId.toLowerCase()) : null) ??
      tournamentLookup.get(m.tournamentName.toLowerCase()) ??
      tournamentLookup.get(stripYear(m.tournamentName)) ??
      null;

    const isNew = !existingSet.has(externalId);
    const fetchAction = isNew ? "new" : "updated";
    const matchLabel = `${m.teamA} vs ${m.teamB}`;

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
        status: correctedStatus,
        tournamentId,
        matchPhase: phase,
        draftEnabled: phase === "pre_match",
        lastRefreshedAt: now,
        nextRefreshAfter: nextRefresh,
        refreshCount: 1,
        lastFetchAction: fetchAction,
        lastFetchedAt: now,
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
          status: correctedStatus,
          tournamentId,
          matchPhase: phase,
          draftEnabled: phase === "pre_match",
          lastRefreshedAt: now,
          nextRefreshAfter: nextRefresh,
          refreshCount: sql`${matches.refreshCount} + 1`,
          lastFetchAction: "updated",
          lastFetchedAt: now,
        },
      });

    result.total++;
    if (isNew) {
      result.newCount++;
      result.newMatches.push(matchLabel);
      existingSet.add(externalId);
    } else {
      result.updatedCount++;
      result.updatedMatches.push(matchLabel);
    }
  }

  log.info({ sport, total: result.total, new: result.newCount, updated: result.updatedCount, skipped: result.skippedCount }, "Upserted matches");

  // ── Backfill tournament dates from match start times ──
  // If a tournament has null startDate/endDate, derive them from its matches.
  try {
    const tournamentsWithNullDates = await database
      .select({ id: tournaments.id, externalId: tournaments.externalId })
      .from(tournaments)
      .where(and(eq(tournaments.sport, sport), or(
        sql`${tournaments.startDate} IS NULL`,
        sql`${tournaments.endDate} IS NULL`,
      )));

    for (const t of tournamentsWithNullDates) {
      const matchDates = await database
        .select({
          minStart: sql<string>`MIN(${matches.startTime})`,
          maxStart: sql<string>`MAX(${matches.startTime})`,
        })
        .from(matches)
        .where(eq(matches.tournamentId, t.id));

      const row = matchDates[0];
      if (row?.minStart && row?.maxStart) {
        const startISO = new Date(row.minStart).toISOString().split("T")[0]!;
        const endISO = new Date(row.maxStart).toISOString().split("T")[0]!;
        await database
          .update(tournaments)
          .set({ startDate: startISO, endDate: endISO, updatedAt: now })
          .where(eq(tournaments.id, t.id));
        log.debug({ tournament: t.externalId, startDate: startISO, endDate: endISO }, "Backfilled tournament dates from matches");
      }
    }
  } catch (err) {
    log.warn({ err }, "Failed to backfill tournament dates");
  }

  // Auto-create contests for leagues tied to tournaments with new matches
  if (result.newCount > 0) {
    const tournamentsWithNewMatches = new Set(
      aiMatches
        .filter((m) => result.newMatches.includes(`${m.teamA} vs ${m.teamB}`))
        .map((m) => m.tournamentName)
    );

    for (const tournamentName of tournamentsWithNewMatches) {
      try {
        const { autoCreateContestsForTournament } = await import("../routers/league");
        await autoCreateContestsForTournament(database, tournamentName);
      } catch (err) {
        log.error({ tournament: tournamentName, err }, "Failed to auto-create league contests for new matches");
      }
    }
  }

  return result;
}

/**
 * Upsert players from Gemini into PostgreSQL using stable external IDs.
 * Deduplicates by name+nationality — same player in multiple tournaments = one row.
 * Returns count of upserted records.
 */
export interface UpsertPlayersResult {
  total: number;
  newCount: number;
  updatedCount: number;
  skippedCount: number;
  newNames: string[];
  updatedNames: string[];
  skippedNames: string[];
}

export async function upsertPlayers(
  sport: Sport,
  aiPlayers: AIPlayer[],
  db?: Database
): Promise<UpsertPlayersResult> {
  const database = db ?? getDb();
  const now = new Date();

  // Pre-load disabled player externalIds — skip these entirely during upsert
  const disabledRows = await database
    .select({ externalId: players.externalId })
    .from(players)
    .where(eq(players.isDisabled, true));
  const disabledSet = new Set(disabledRows.map((r) => r.externalId));

  // Pre-load existing player externalIds to distinguish new vs updated
  const existingRows = await database
    .select({ externalId: players.externalId })
    .from(players);
  const existingSet = new Set(existingRows.map((r) => r.externalId));

  // Local deduplication: keep latest entry per externalId.
  // Prefer provider-assigned IDs (e.g., "cb-576" from Cricbuzz) over name-derived IDs.
  const dedupMap = new Map<string, AIPlayer>();
  for (const p of aiPlayers) {
    const externalId = p.id && p.id.length > 0
      ? p.id
      : normalizePlayerExternalId(p.name, p.nationality);
    dedupMap.set(externalId, p);
  }

  // Resolve nationalities via Gemini AI for players that need it.
  // "Needs it" = nationality looks like a raw birth place, franchise name, or is missing.
  const KNOWN_COUNTRIES = new Set([
    "india", "australia", "england", "south africa", "new zealand", "west indies",
    "pakistan", "sri lanka", "bangladesh", "afghanistan", "zimbabwe", "ireland",
    "scotland", "netherlands", "nepal", "uae", "usa", "canada", "oman", "namibia",
    "kenya", "unknown",
  ]);
  const needsResolution: Array<{ name: string; birthPlace: string | null; team: string }> = [];
  for (const p of dedupMap.values()) {
    if (!p.nationality || !KNOWN_COUNTRIES.has(p.nationality.toLowerCase())) {
      needsResolution.push({ name: p.name, birthPlace: p.nationality || null, team: p.team });
    }
  }

  if (needsResolution.length > 0) {
    log.info({ count: needsResolution.length }, "Resolving nationalities via Gemini");
    try {
      const resolved = await resolveNationalitiesWithGemini(needsResolution);
      // Build a lookup by normalized player name
      const resolvedMap = new Map<string, string>();
      for (const r of resolved) {
        resolvedMap.set(r.playerName.toLowerCase().trim(), r.nationality);
      }
      // Apply resolved nationalities back to AIPlayer objects
      for (const p of dedupMap.values()) {
        const resolved = resolvedMap.get(p.name.toLowerCase().trim());
        if (resolved) {
          p.nationality = resolved;
        }
      }
      log.info({ resolved: resolved.length, needed: needsResolution.length }, "Nationalities resolved via Gemini");
    } catch (err) {
      log.warn({ error: err instanceof Error ? err.message : String(err) }, "Gemini nationality resolution failed — using raw values");
    }
  }

  const result: UpsertPlayersResult = {
    total: 0, newCount: 0, updatedCount: 0, skippedCount: 0,
    newNames: [], updatedNames: [], skippedNames: [],
  };

  for (const [externalId, p] of dedupMap) {
    if (disabledSet.has(externalId)) {
      log.debug({ externalId }, "Skipping disabled player during upsert");
      result.skippedCount++;
      result.skippedNames.push(p.name);
      continue;
    }

    const isNew = !existingSet.has(externalId);
    const fetchAction = isNew ? "new" : "updated";

    // Build cleanStats: only include non-null fields so JSONB merge preserves existing values
    const cleanStats: Record<string, number | string> = {};
    if (p.credits != null) cleanStats.geminiCredits = p.credits;
    if (p.battingAvg != null) cleanStats.average = p.battingAvg;
    if (p.bowlingAvg != null) cleanStats.bowlingAverage = p.bowlingAvg;
    // Extended stats (populated when Gemini returns richer data)
    if ((p as any).strikeRate != null) cleanStats.strikeRate = (p as any).strikeRate;
    if ((p as any).economyRate != null) cleanStats.economyRate = (p as any).economyRate;
    if ((p as any).bowlingStrikeRate != null) cleanStats.bowlingStrikeRate = (p as any).bowlingStrikeRate;
    if ((p as any).matchesPlayed != null) cleanStats.matchesPlayed = (p as any).matchesPlayed;
    if ((p as any).recentForm != null) cleanStats.recentForm = (p as any).recentForm;
    if ((p as any).sentimentScore != null) cleanStats.sentimentScore = (p as any).sentimentScore;
    if ((p as any).injuryStatus != null) cleanStats.injuryStatus = (p as any).injuryStatus;
    if ((p as any).formNote != null) cleanStats.formNote = (p as any).formNote;

    // Calculate deterministic credits from stats (no recentAvgFP on initial fetch)
    const calculatedCredits = calculatePlayerCredits({
      role: p.role as import("@draftplay/shared").CricketRole,
      battingAvg: p.battingAvg,
      strikeRate: (p as any).strikeRate ?? null,
      bowlingAvg: p.bowlingAvg,
      economyRate: (p as any).economyRate ?? null,
      bowlingStrikeRate: (p as any).bowlingStrikeRate ?? null,
      matchesPlayed: (p as any).matchesPlayed ?? null,
      recentForm: (p as any).recentForm ?? null,
      sentimentScore: (p as any).sentimentScore ?? null,
      injuryStatus: (p as any).injuryStatus ?? null,
      recentAvgFP: null,
    });
    cleanStats.calculatedCredits = calculatedCredits;
    cleanStats.credits = calculatedCredits; // active credits (admin override survives via JSONB merge)

    // Only update photoUrl if we have a new one (don't overwrite existing with null)
    const photoUrl = (p as any).imageUrl ?? null;

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
        photoUrl,
        stats: cleanStats,
        lastFetchAction: fetchAction,
        lastFetchedAt: now,
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
          // Only update photo if new value is not null (preserve existing photo)
          ...(photoUrl ? { photoUrl } : {}),
          // Merge Gemini stats with existing adminCredits (admin override survives refresh)
          stats: sql`jsonb_strip_nulls(
            COALESCE(${players.stats}, '{}'::jsonb)
            || ${JSON.stringify(cleanStats)}::jsonb
          )`,
          lastFetchAction: "updated",
          lastFetchedAt: now,
          updatedAt: now,
        },
      });

    result.total++;
    if (isNew) {
      result.newCount++;
      result.newNames.push(p.name);
      existingSet.add(externalId); // track for rest of batch
    } else {
      result.updatedCount++;
      result.updatedNames.push(p.name);
    }
  }

  log.info({ sport, ...result, newNames: undefined, updatedNames: undefined, skippedNames: undefined }, "Upserted players");
  return result;
}

// ---------------------------------------------------------------------------
// Player enrichment — Gemini AI pass for form, sentiment, injury data
// ---------------------------------------------------------------------------

export interface EnrichPlayersResult {
  total: number;
  enrichedCount: number;
  skippedCount: number;
  enrichedNames: string[];
}

/**
 * Enrich existing DB players with Gemini AI form/sentiment/injury data.
 * Loads players for a match, calls Gemini enrichment, updates JSONB stats,
 * and recalculates credits with the enriched recentForm/sentimentScore.
 */
export async function enrichAndUpdatePlayers(
  matchId: string,
  db?: Database
): Promise<EnrichPlayersResult> {
  const database = db ?? getDb();

  // Load match + tournament
  const match = await database.query.matches.findFirst({
    where: eq(matches.id, matchId),
  });
  if (!match) throw new Error(`Match not found: ${matchId}`);

  let tournamentName = match.tournament ?? "Unknown";
  if (match.tournamentId) {
    const t = await database.query.tournaments.findFirst({
      where: eq(tournaments.id, match.tournamentId),
    });
    if (t) tournamentName = t.name;
  }

  // Load players linked to this match
  const linkedPlayers = await database
    .select({
      id: players.id,
      name: players.name,
      team: players.team,
      role: players.role,
      nationality: players.nationality,
      battingAvg: sql<number | null>`(${players.stats}->>'average')::numeric`,
      bowlingAvg: sql<number | null>`(${players.stats}->>'bowlingAverage')::numeric`,
      strikeRate: sql<number | null>`(${players.stats}->>'strikeRate')::numeric`,
      economyRate: sql<number | null>`(${players.stats}->>'economyRate')::numeric`,
      bowlingStrikeRate: sql<number | null>`(${players.stats}->>'bowlingStrikeRate')::numeric`,
      matchesPlayed: sql<number | null>`(${players.stats}->>'matchesPlayed')::numeric`,
      externalId: players.externalId,
    })
    .from(playerMatchScores)
    .innerJoin(players, eq(players.id, playerMatchScores.playerId))
    .where(eq(playerMatchScores.matchId, matchId));

  if (linkedPlayers.length === 0) {
    log.info({ matchId }, "No linked players to enrich");
    return { total: 0, enrichedCount: 0, skippedCount: 0, enrichedNames: [] };
  }

  // Query recent avg fantasy points (last 5 matches per player) for credit calculation
  const playerIds = linkedPlayers.map((p) => p.id);
  const recentFPRows = await database
    .select({
      playerId: playerMatchScores.playerId,
      avgFP: sql<number>`AVG(${playerMatchScores.fantasyPoints}::numeric)`.as("avg_fp"),
    })
    .from(playerMatchScores)
    .innerJoin(matches, eq(matches.id, playerMatchScores.matchId))
    .where(
      and(
        inArray(playerMatchScores.playerId, playerIds),
        sql`${playerMatchScores.fantasyPoints}::numeric > 0`
      )
    )
    .groupBy(playerMatchScores.playerId);

  const recentFPMap = new Map<string, number>();
  for (const row of recentFPRows) {
    recentFPMap.set(row.playerId, Number(row.avgFP));
  }

  // Call Gemini enrichment
  const { enrichPlayersWithGemini } = await import("./gemini-sports");
  const enrichmentData = await enrichPlayersWithGemini(
    linkedPlayers.map((p) => ({ name: p.name, team: p.team, role: p.role })),
    tournamentName
  );

  // Build lookup by normalized name for fuzzy matching
  const enrichmentMap = new Map<string, (typeof enrichmentData)[number]>();
  for (const e of enrichmentData) {
    enrichmentMap.set(e.name.toLowerCase().trim(), e);
  }

  const result: EnrichPlayersResult = {
    total: linkedPlayers.length,
    enrichedCount: 0,
    skippedCount: 0,
    enrichedNames: [],
  };
  const now = new Date();

  for (const player of linkedPlayers) {
    const enrichment = enrichmentMap.get(player.name.toLowerCase().trim());
    if (!enrichment || (enrichment.recentForm == null && enrichment.sentimentScore == null && enrichment.injuryStatus == null && enrichment.formNote == null)) {
      result.skippedCount++;
      continue;
    }

    // Build enrichment-only JSONB patch
    const patch: Record<string, number | string> = {};
    if (enrichment.recentForm != null) patch.recentForm = enrichment.recentForm;
    if (enrichment.sentimentScore != null) patch.sentimentScore = enrichment.sentimentScore;
    if (enrichment.injuryStatus != null) patch.injuryStatus = enrichment.injuryStatus;
    if (enrichment.formNote != null) patch.formNote = enrichment.formNote;

    // Store recent avg FP in stats for UI display
    const playerAvgFP = recentFPMap.get(player.id);
    if (playerAvgFP != null) patch.recentAvgFP = Math.round(playerAvgFP * 10) / 10;

    // Recalculate credits with enriched data + actual recent fantasy points
    const calculatedCredits = calculatePlayerCredits({
      role: player.role as import("@draftplay/shared").CricketRole,
      battingAvg: player.battingAvg != null ? Number(player.battingAvg) : null,
      strikeRate: player.strikeRate != null ? Number(player.strikeRate) : null,
      bowlingAvg: player.bowlingAvg != null ? Number(player.bowlingAvg) : null,
      economyRate: player.economyRate != null ? Number(player.economyRate) : null,
      bowlingStrikeRate: player.bowlingStrikeRate != null ? Number(player.bowlingStrikeRate) : null,
      matchesPlayed: player.matchesPlayed != null ? Number(player.matchesPlayed) : null,
      recentForm: enrichment.recentForm,
      sentimentScore: enrichment.sentimentScore,
      injuryStatus: enrichment.injuryStatus,
      recentAvgFP: recentFPMap.get(player.id) ?? null,
    });
    patch.calculatedCredits = calculatedCredits;
    patch.credits = calculatedCredits;

    // JSONB merge — preserves admin overrides
    await database
      .update(players)
      .set({
        stats: sql`jsonb_strip_nulls(
          COALESCE(${players.stats}, '{}'::jsonb)
          || ${JSON.stringify(patch)}::jsonb
        )`,
        updatedAt: now,
      })
      .where(eq(players.id, player.id));

    result.enrichedCount++;
    result.enrichedNames.push(player.name);
  }

  log.info(
    { matchId, tournament: tournamentName, ...result, enrichedNames: undefined },
    "Enriched players with Gemini AI data"
  );
  return result;
}

// ---------------------------------------------------------------------------
// Player diff — compare Gemini response against existing DB (for approve/reject flow)
// ---------------------------------------------------------------------------

/**
 * Compare AI player data against existing DB players without writing anything.
 * Returns a diff for each player: new, updated (with field-level changes), or no_change.
 */
export async function diffPlayers(
  sport: Sport,
  aiPlayers: AIPlayer[],
  db?: Database
): Promise<PlayerDiffEntry[]> {
  const database = db ?? getDb();

  // Pre-load disabled externalIds
  const disabledRows = await database
    .select({ externalId: players.externalId })
    .from(players)
    .where(eq(players.isDisabled, true));
  const disabledSet = new Set(disabledRows.map((r) => r.externalId));

  // Pre-load ALL existing players as Map<externalId, row>
  const existingRows = await database.select().from(players);
  const existingMap = new Map(existingRows.map((r) => [r.externalId, r]));

  // Dedup incoming by externalId (same logic as upsertPlayers — prefer provider ID)
  const dedupMap = new Map<string, AIPlayer>();
  for (const p of aiPlayers) {
    const externalId = p.id && p.id.length > 0
      ? p.id
      : normalizePlayerExternalId(p.name, p.nationality);
    dedupMap.set(externalId, p);
  }

  const diffs: PlayerDiffEntry[] = [];

  for (const [externalId, ai] of dedupMap) {
    if (disabledSet.has(externalId)) continue;

    const proposed = {
      name: ai.name,
      team: ai.team,
      role: ai.role,
      nationality: ai.nationality,
      battingStyle: ai.battingStyle,
      bowlingStyle: ai.bowlingStyle,
      credits: ai.credits,
      battingAvg: ai.battingAvg,
      bowlingAvg: ai.bowlingAvg,
      strikeRate: (ai as any).strikeRate ?? null,
      economyRate: (ai as any).economyRate ?? null,
      bowlingStrikeRate: (ai as any).bowlingStrikeRate ?? null,
      matchesPlayed: (ai as any).matchesPlayed ?? null,
      recentForm: (ai as any).recentForm ?? null,
      sentimentScore: (ai as any).sentimentScore ?? null,
      injuryStatus: (ai as any).injuryStatus ?? null,
      formNote: (ai as any).formNote ?? null,
    };

    const existing = existingMap.get(externalId);

    if (!existing) {
      diffs.push({
        externalId,
        name: ai.name,
        team: ai.team,
        changeType: "new",
        changes: [],
        reason: "New player",
        proposed,
      });
      continue;
    }

    // Compare fields — skip if new value is null (missing data, not a real change)
    const stats = (existing.stats as Record<string, number | string | undefined>) ?? {};
    const comparisons: [string, string | number | null | undefined, string | number | null | undefined][] = [
      ["name", existing.name, ai.name],
      ["team", existing.team, ai.team],
      ["role", existing.role, ai.role],
      ["nationality", existing.nationality, ai.nationality],
      ["battingStyle", existing.battingStyle, ai.battingStyle],
      ["bowlingStyle", existing.bowlingStyle, ai.bowlingStyle],
      ["credits", stats.geminiCredits ?? stats.credits ?? null, ai.credits],
      ["battingAvg", stats.average ?? null, ai.battingAvg],
      ["bowlingAvg", stats.bowlingAverage ?? null, ai.bowlingAvg],
      ["strikeRate", stats.strikeRate ?? null, (ai as any).strikeRate],
      ["economyRate", stats.economyRate ?? null, (ai as any).economyRate],
      ["recentForm", stats.recentForm ?? null, (ai as any).recentForm],
      ["sentimentScore", stats.sentimentScore ?? null, (ai as any).sentimentScore],
    ];

    const changes: PlayerFieldChange[] = [];
    for (const [field, oldVal, newVal] of comparisons) {
      const norm = (v: string | number | null | undefined) =>
        v === undefined || v === "" ? null : v;
      // Skip if new value is null — Gemini just didn't return this field, not a real change
      if (norm(newVal) === null && norm(oldVal) !== null) continue;
      if (norm(oldVal) !== norm(newVal)) {
        changes.push({ field, oldValue: norm(oldVal) ?? null, newValue: norm(newVal) ?? null });
      }
    }

    const changeType = changes.length > 0 ? "updated" as const : "no_change" as const;
    const reason =
      changes.length > 0
        ? changes.map((c) => `${c.field}: ${c.oldValue ?? "—"} → ${c.newValue ?? "—"}`).join(", ")
        : "No changes";

    diffs.push({ externalId, name: ai.name, team: ai.team, changeType, changes, reason, proposed });
  }

  log.info(
    { sport, total: diffs.length, new: diffs.filter((d) => d.changeType === "new").length, updated: diffs.filter((d) => d.changeType === "updated").length, unchanged: diffs.filter((d) => d.changeType === "no_change").length },
    "Diffed players against DB"
  );
  return diffs;
}

/**
 * Apply only admin-approved player changes from a diff.
 * Converts approved entries to AIPlayer[] and delegates to upsertPlayers().
 */
export async function applyApprovedPlayers(
  sport: Sport,
  approved: PlayerDiffEntry[],
  db?: Database
): Promise<UpsertPlayersResult> {
  const aiPlayers: AIPlayer[] = approved.map((d) => ({
    id: d.externalId,  // Preserve original externalId to avoid duplicates
    name: d.proposed.name,
    team: d.proposed.team,
    role: d.proposed.role as AIPlayer["role"],
    nationality: d.proposed.nationality,
    battingStyle: d.proposed.battingStyle,
    bowlingStyle: d.proposed.bowlingStyle,
    credits: d.proposed.credits,
    battingAvg: d.proposed.battingAvg,
    bowlingAvg: d.proposed.bowlingAvg,
    strikeRate: d.proposed.strikeRate ?? null,
    economyRate: d.proposed.economyRate ?? null,
    bowlingStrikeRate: d.proposed.bowlingStrikeRate ?? null,
    matchesPlayed: d.proposed.matchesPlayed ?? null,
    recentForm: d.proposed.recentForm ?? null,
    sentimentScore: d.proposed.sentimentScore ?? null,
    injuryStatus: d.proposed.injuryStatus ?? null,
    formNote: d.proposed.formNote ?? null,
    tournamentName: "",
    sourceUrl: null,
  }));

  return upsertPlayers(sport, aiPlayers, db);
}

// ---------------------------------------------------------------------------
// Player–Match linking
// ---------------------------------------------------------------------------

/**
 * Link players to a single match.
 *
 * When `playerExternalIds` are provided (e.g., from Cricbuzz: ["cb-576", "cb-11813"]),
 * links by exact externalId — no fuzzy matching needed.
 *
 * Falls back to team-name ILIKE matching when IDs aren't available.
 */
export async function linkPlayersToMatch(
  matchId: string,
  teamHome: string,
  teamAway: string,
  db?: Database,
  playerExternalIds?: string[],
  /** Maps externalId → team name for this specific match context (e.g., "India" not "Mumbai Indians") */
  playerTeamMap?: Map<string, string>
): Promise<number> {
  const database = db ?? getDb();

  let teamPlayers: { id: string; externalId: string }[];

  if (playerExternalIds && playerExternalIds.length > 0) {
    // Precise ID-based linking — no fuzzy matching
    teamPlayers = await database
      .select({ id: players.id, externalId: players.externalId })
      .from(players)
      .where(
        and(
          eq(players.isDisabled, false),
          inArray(players.externalId, playerExternalIds)
        )
      );
    log.info({ matchId, requestedIds: playerExternalIds.length, foundPlayers: teamPlayers.length }, "Linking players by externalId");
  } else {
    // Fallback: fuzzy team-name matching (for Gemini/ESPN where we don't have provider IDs)
    const stripSuffix = (t: string) => t.replace(/ Men$| Women$/, "");
    teamPlayers = await database
      .select({ id: players.id, externalId: players.externalId })
      .from(players)
      .where(
        and(
          eq(players.isDisabled, false),
          or(
            ilike(players.team, `%${stripSuffix(teamHome)}%`),
            ilike(players.team, `%${stripSuffix(teamAway)}%`),
            eq(players.team, teamHome),
            eq(players.team, teamAway),
          )
        )
      );
  }

  if (teamPlayers.length === 0) return 0;

  await database
    .insert(playerMatchScores)
    .values(
      teamPlayers.map((p) => ({
        playerId: p.id,
        matchId,
        isPlaying: true,
        team: playerTeamMap?.get(p.externalId) ?? null,
      }))
    )
    .onConflictDoNothing();

  // If we have team mappings and some records already existed (onConflictDoNothing skipped them),
  // backfill any missing per-match teams
  if (playerTeamMap && playerTeamMap.size > 0) {
    for (const tp of teamPlayers) {
      const matchTeam = playerTeamMap.get(tp.externalId);
      if (matchTeam) {
        await database
          .update(playerMatchScores)
          .set({ team: matchTeam })
          .where(
            and(
              eq(playerMatchScores.playerId, tp.id),
              eq(playerMatchScores.matchId, matchId),
              sql`${playerMatchScores.team} IS NULL`
            )
          );
      }
    }
  }

  log.info({ matchId, playersLinked: teamPlayers.length }, "Linked players to match");
  return teamPlayers.length;
}

// ---------------------------------------------------------------------------
// Standings persistence
// ---------------------------------------------------------------------------

/**
 * Update tournament standings (points table) in PostgreSQL.
 * Writes AITeamStanding[] as JSONB on each matching tournament row.
 */
export interface UpdateStandingsResult {
  updated: number;
  teamsCount: number;
  fetchAction: "new" | "updated" | "unchanged";
}

export async function updateTournamentStandings(
  sport: Sport,
  standingsMap: Map<string, AITeamStanding[]>,
  db?: Database
): Promise<UpdateStandingsResult> {
  const database = db ?? getDb();
  let updated = 0;
  let teamsCount = 0;
  let fetchAction: "new" | "updated" | "unchanged" = "unchanged";
  const now = new Date();

  for (const [tournamentName, standings] of standingsMap) {
    teamsCount = standings.length;

    // Check if standings already exist to determine action
    const existing = await database
      .select({ standings: tournaments.standings })
      .from(tournaments)
      .where(
        and(
          eq(tournaments.name, tournamentName),
          eq(tournaments.sport, sport)
        )
      );
    const hadStandings = existing.length > 0 && Array.isArray(existing[0]?.standings) && (existing[0]?.standings as any[]).length > 0;
    const currentAction = hadStandings ? "updated" : "new";

    // Try exact name match first
    let result = await database
      .update(tournaments)
      .set({
        standings: standings as any,
        standingsUpdatedAt: now,
        standingsFetchAction: currentAction,
        updatedAt: now,
      })
      .where(
        and(
          eq(tournaments.name, tournamentName),
          eq(tournaments.sport, sport)
        )
      )
      .returning({ id: tournaments.id });

    // Fallback: try year-stripped name
    if (result.length === 0) {
      const stripped = tournamentName.replace(/\s*\d{4}(-\d{2,4})?\s*$/, "").trim();
      if (stripped !== tournamentName) {
        result = await database
          .update(tournaments)
          .set({
            standings: standings as any,
            standingsUpdatedAt: now,
            standingsFetchAction: currentAction,
            updatedAt: now,
          })
          .where(
            and(
              eq(tournaments.name, stripped),
              eq(tournaments.sport, sport)
            )
          )
          .returning({ id: tournaments.id });
      }
    }

    if (result.length > 0) {
      updated++;
      fetchAction = currentAction;
    }
  }

  log.info({ sport, count: updated, fetchAction }, "Updated tournament standings");
  return { updated, teamsCount, fetchAction };
}

// ---------------------------------------------------------------------------
// Lightweight tournament discovery
// ---------------------------------------------------------------------------

/**
 * Discovery-only refresh: fetch tournament names from Gemini and upsert into PG.
 * Does NOT fetch matches, players, or standings.
 * New tournaments are inserted with isVisible=false so admin must explicitly enable them.
 */
export async function executeDiscovery(
  sport: Sport,
  userId?: string
): Promise<{ discovered: number; tournaments: string[] }> {
  const db = getDb();
  const startTime = Date.now();

  // Create refresh log entry
  const logEntries = await db
    .insert(dataRefreshLog)
    .values({
      entityType: "discovery",
      entityId: sport,
      sport,
      trigger: "manual",
      triggeredByUserId: userId,
      status: "in_progress",
    })
    .returning({ id: dataRefreshLog.id });
  const logEntryId = logEntries[0]?.id;

  try {
    const preference = await getDataSourcePreference();
    log.info({ sport, preference }, "Starting tournament discovery via provider chain");

    const { data: aiTournaments, source } = await discoverTournamentsWithFallback(sport, preference);
    log.info({ sport, source, count: aiTournaments.length }, "Discovery data received");
    const upserted = await upsertTournaments(sport, aiTournaments, db);
    const tournamentNames = aiTournaments.map((t) => t.name);

    const durationMs = Date.now() - startTime;

    if (logEntryId) {
      await db
        .update(dataRefreshLog)
        .set({
          status: "success",
          completedAt: new Date(),
          durationMs,
          recordsUpserted: upserted,
        })
        .where(eq(dataRefreshLog.id, logEntryId));
    }

    log.info({ sport, discovered: upserted, durationMs }, "Tournament discovery completed");
    return { discovered: upserted, tournaments: tournamentNames };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);

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

    log.error({ sport, error: errorMsg }, "Tournament discovery failed");
    return { discovered: 0, tournaments: [] };
  }
}

// ---------------------------------------------------------------------------
// Refresh orchestration
// ---------------------------------------------------------------------------

/**
 * Execute a full dashboard refresh: fetch from Gemini, upsert into PG, log result.
 * Acquires a distributed lock to prevent concurrent refreshes.
 * When activeTournaments is provided, ONLY fetches data for those tournaments
 * (saves Gemini API costs by not fetching irrelevant tournament data).
 */
export async function executeRefresh(
  sport: Sport,
  trigger: RefreshTrigger,
  userId?: string,
  activeTournaments?: string[],
  seriesHints?: Array<{ name: string; externalId: string }>
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
    const preference = await getDataSourcePreference();
    log.info({ sport, trigger, activeTournaments, preference }, "Starting data refresh via provider chain");

    // Provider chain respects admin preference (auto = full fallback, espn = ESPN only, etc.)
    const { data, source: dataSource } = await fetchDashboardWithFallback(sport, activeTournaments, preference, seriesHints);
    log.info({ sport, dataSource, tournaments: data.tournaments.length, matches: data.matches.length }, "Dashboard data received");

    // When refreshing for specific active tournaments, filter by externalId (ID-based).
    // seriesHints carry the authoritative externalIds from the DB.
    let filteredTournaments = data.tournaments;
    let filteredMatches = data.matches;

    if (seriesHints && seriesHints.length > 0) {
      // ID-based filtering — most precise
      const hintIds = new Set(seriesHints.map(h => h.externalId.toLowerCase()));

      filteredTournaments = data.tournaments.filter(t => hintIds.has(t.id.toLowerCase()));
      const keptExternalIds = new Set(filteredTournaments.map(t => t.id.toLowerCase()));

      filteredMatches = data.matches.filter(m =>
        m.tournamentExternalId && keptExternalIds.has(m.tournamentExternalId.toLowerCase())
      );

      log.info({
        hintIds: [...hintIds],
        totalTournaments: data.tournaments.length,
        filteredTournaments: filteredTournaments.length,
        totalMatches: data.matches.length,
        filteredMatches: filteredMatches.length,
      }, "Filtered dashboard data by externalId hints");
    } else if (activeTournaments && activeTournaments.length > 0) {
      // Name-based filtering as fallback (for non-Cricbuzz providers or when no hints available)
      const activeSet = new Set(activeTournaments.map(n => n.toLowerCase()));
      const stripYear = (s: string) => s.replace(/\s*\d{4}(-\d{2,4})?\s*$/, "").trim().toLowerCase();

      filteredTournaments = data.tournaments.filter(t => {
        const name = t.name.replace(/\s*\d{4}(-\d{2,4})?\s*$/, "").replace(/,\s*$/, "").trim().toLowerCase();
        return activeSet.has(name) || activeSet.has(stripYear(t.name));
      });

      const keptExternalIds = new Set(filteredTournaments.map(t => t.id.toLowerCase()));

      filteredMatches = data.matches.filter(m => {
        if (m.tournamentExternalId && keptExternalIds.has(m.tournamentExternalId.toLowerCase())) return true;
        const mName = m.tournamentName.replace(/\s*\d{4}(-\d{2,4})?\s*$/, "").trim().toLowerCase();
        return activeSet.has(mName) || activeSet.has(stripYear(m.tournamentName));
      });

      log.info({
        activeTournaments,
        totalTournaments: data.tournaments.length,
        filteredTournaments: filteredTournaments.length,
        totalMatches: data.matches.length,
        filteredMatches: filteredMatches.length,
      }, "Filtered dashboard data by name (no hints available)");
    }

    const tournamentsUpserted = await upsertTournaments(sport, filteredTournaments, db);
    const matchesUpserted = await upsertMatches(sport, filteredMatches, db);

    // Only fetch standings for active tournaments (saves API costs)
    // Players are now fetched per-match from admin UI, not during refresh
    const stripTrailingYear = (s: string) => s.replace(/\s*\d{4}(-\d{2,4})?\s*$/, "").trim();
    const tournamentNames = data.tournaments.map((t) => stripTrailingYear(t.name));

    // Best-effort standings fetch — failure does NOT block the refresh
    // Only fetch standings for tournaments that have already started (avoid Gemini hallucinating)
    try {
      const now = new Date();
      // Check DB for start dates (more reliable than Gemini response dates)
      const dbTournaments = await db
        .select({ name: tournaments.name, startDate: tournaments.startDate })
        .from(tournaments)
        .where(eq(tournaments.sport, sport));

      const startedTournaments = tournamentNames.filter((tName) => {
        const dbT = dbTournaments.find((dt) => dt.name.toLowerCase() === tName.toLowerCase());
        if (!dbT || !dbT.startDate) return true; // no date info → fetch anyway (benefit of the doubt)
        return new Date(dbT.startDate + "T00:00:00") <= now;
      });

      if (startedTournaments.length > 0) {
        log.info({ sport, tournaments: startedTournaments, preference }, "Fetching standings for started tournaments");

        // For F1: always use Jolpica for standings (ESPN doesn't support them).
        // Jolpica is supplementary — not affected by admin preference unless "gemini" is forced.
        if (sport === "f1" && preference !== "gemini") {
          const { data: standingsMap, source: standingsSource } = await fetchF1StandingsFromJolpica(startedTournaments);
          log.info({ sport, standingsSource }, "F1 standings received from Jolpica");
          await updateTournamentStandings(sport, standingsMap, db);
        } else {
          const { data: standingsMap, source: standingsSource } = await fetchStandingsWithFallback(sport, startedTournaments, preference);
          log.info({ sport, standingsSource }, "Standings data received");
          await updateTournamentStandings(sport, standingsMap, db);
        }
      } else {
        log.info({ sport }, "No tournaments have started yet — skipping standings fetch");
      }
    } catch (standingsError) {
      log.warn(
        { sport, error: String(standingsError) },
        "Standings fetch failed — dashboard refresh continues"
      );
    }

    const totalUpserted = tournamentsUpserted + matchesUpserted.total;

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
      { sport, trigger, durationMs, tournamentsUpserted, matchesUpserted: matchesUpserted.total },
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
// Map common timezone abbreviations to UTC offset in minutes
const TZ_OFFSETS: Record<string, number> = {
  IST: 330,   // India Standard Time (UTC+5:30)
  SLST: 330,  // Sri Lanka Standard Time
  PKT: 300,   // Pakistan Standard Time (UTC+5:00)
  BST: 360,   // Bangladesh Standard Time (UTC+6:00)
  AEST: 600,  // Australian Eastern Standard Time (UTC+10:00)
  AEDT: 660,  // Australian Eastern Daylight Time (UTC+11:00)
  NZST: 720,  // New Zealand Standard Time (UTC+12:00)
  NZDT: 780,  // New Zealand Daylight Time (UTC+13:00)
  SAST: 120,  // South Africa Standard Time (UTC+2:00)
  GMT: 0,
  UTC: 0,
  EST: -300,  // Eastern Standard Time (UTC-5:00)
  EDT: -240,  // Eastern Daylight Time (UTC-4:00)
  CST: -360,  // Central Standard Time (UTC-6:00)
  PST: -480,  // Pacific Standard Time (UTC-8:00)
  AST: 240,   // Arabian Standard Time (UTC+4:00) — UAE, Oman
  WIB: 420,   // Western Indonesia Time (UTC+7:00)
};

function parseAIDateTime(dateStr: string, timeStr: string): Date {
  // ── Fast path: if either field is already an ISO string, use it directly ──
  // Cricbuzz passes ISO strings from the raw Unix timestamp — no re-parsing needed.
  for (const s of [dateStr, timeStr]) {
    if (s && (s.includes("T") || s.endsWith("Z"))) {
      const parsed = new Date(s);
      if (!isNaN(parsed.getTime())) return parsed;
    }
  }

  // ── Slow path: parse human-readable strings from Gemini ──
  // Extract timezone abbreviation if present (e.g., "7:30 PM IST" → "IST")
  const tzMatch = timeStr.match(/\s+([A-Z]{2,4})\s*$/);
  const tzAbbrev = tzMatch?.[1] ?? null;
  const tzOffsetMinutes = tzAbbrev ? TZ_OFFSETS[tzAbbrev] ?? null : null;

  // Strip timezone abbreviation for parsing
  const cleanTime = timeStr.replace(/\s*[A-Z]{2,4}\s*$/, "").trim();

  // Parse the date part to get year/month/day
  const dateParsed = new Date(dateStr);
  if (isNaN(dateParsed.getTime())) {
    throw new Error(`Cannot parse date: ${dateStr}`);
  }
  const year = dateParsed.getFullYear();
  const month = dateParsed.getMonth(); // 0-indexed
  const day = dateParsed.getDate();

  // Parse the time part manually to avoid timezone ambiguity
  // Handles "7:30 PM", "19:30", "7:30PM", "7:30 pm"
  const timeMatch = cleanTime.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM|am|pm))?$/i);
  if (!timeMatch) {
    // Fallback: return date-only at midnight UTC
    return new Date(Date.UTC(year, month, day));
  }

  let hours = parseInt(timeMatch[1]!, 10);
  const minutes = parseInt(timeMatch[2]!, 10);
  const ampm = timeMatch[3]?.toUpperCase();

  if (ampm === "PM" && hours !== 12) hours += 12;
  if (ampm === "AM" && hours === 12) hours = 0;

  if (tzOffsetMinutes !== null) {
    // Build UTC time directly: wall-clock time minus the source timezone offset
    // e.g., "7:30 PM IST" = 19:30 IST = 19:30 - 5:30 = 14:00 UTC
    const wallClockMs = Date.UTC(year, month, day, hours, minutes);
    return new Date(wallClockMs - tzOffsetMinutes * 60_000);
  }

  // No timezone info — assume UTC
  return new Date(Date.UTC(year, month, day, hours, minutes));
}
