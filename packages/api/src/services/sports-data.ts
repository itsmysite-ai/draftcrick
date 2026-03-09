/**
 * Sports Data Service — Write-through PostgreSQL persistence.
 * Source of truth for all sports data. Manages staleness checks,
 * Gemini API refreshes, and audit logging.
 *
 * See /docs/SMART_REFRESH_ARCHITECTURE.md for full spec.
 */

import { eq, and, or, ilike, sql } from "drizzle-orm";
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
import { fetchSportsData, fetchTournamentStandings, discoverTournaments } from "./gemini-sports";
import { acquireRefreshLock, releaseRefreshLock } from "./sports-cache";
import { getLogger } from "../lib/logger";

const log = getLogger("sports-data");

// ---------------------------------------------------------------------------
// Stable external ID generation
// ---------------------------------------------------------------------------

function normalizeTournamentExternalId(t: AITournament): string {
  return t.name
    .toLowerCase()
    .replace(/\s*\d{4}(-\d{2,4})?\s*$/, "") // strip trailing year (e.g. "2026", "2025-26")
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
    description: t.description ?? null,
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

  for (const t of aiTournaments) {
    const externalId = normalizeTournamentExternalId(t);
    // Strip trailing year from display name for consistency
    const displayName = t.name.replace(/\s*\d{4}(-\d{2,4})?\s*$/, "").trim();

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

  // Build a lookup for tournament name → tournament ID
  const pgTournaments = await database
    .select({ id: tournaments.id, externalId: tournaments.externalId, name: tournaments.name })
    .from(tournaments)
    .where(eq(tournaments.sport, sport));

  /** Strip trailing year from a name for lookup purposes */
  const stripYear = (s: string) => s.replace(/\s*\d{4}(-\d{2,4})?\s*$/, "").trim().toLowerCase();

  const tournamentLookup = new Map<string, string>();
  for (const t of pgTournaments) {
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

    const externalId = normalizeMatchExternalId(m);

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
    const tournamentId =
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

  // Local deduplication: keep latest entry per externalId
  const dedupMap = new Map<string, AIPlayer>();
  for (const p of aiPlayers) {
    const externalId = normalizePlayerExternalId(p.name, p.nationality);
    dedupMap.set(externalId, p);
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

    // Calculate deterministic credits from stats
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
    });
    cleanStats.calculatedCredits = calculatedCredits;
    cleanStats.credits = calculatedCredits; // active credits (admin override survives via JSONB merge)

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

  // Dedup incoming by externalId (same as upsertPlayers)
  const dedupMap = new Map<string, AIPlayer>();
  for (const p of aiPlayers) {
    const externalId = normalizePlayerExternalId(p.name, p.nationality);
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
    id: "",
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
 * Link players to a single match based on team name matching.
 * Finds players whose team matches either teamHome or teamAway
 * (with "Men"/"Women" suffix stripping for fuzzy matching) and creates
 * playerMatchScores entries. Uses onConflictDoNothing for idempotency.
 */
export async function linkPlayersToMatch(
  matchId: string,
  teamHome: string,
  teamAway: string,
  db?: Database
): Promise<number> {
  const database = db ?? getDb();

  // Strip "Men"/"Women" suffix for fuzzy team matching
  const stripSuffix = (t: string) => t.replace(/ Men$| Women$/, "");

  const teamPlayers = await database
    .select({ id: players.id })
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

  if (teamPlayers.length === 0) return 0;

  await database
    .insert(playerMatchScores)
    .values(
      teamPlayers.map((p) => ({
        playerId: p.id,
        matchId,
        isPlaying: true,
      }))
    )
    .onConflictDoNothing();

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
    log.info({ sport }, "Starting tournament discovery");

    const aiTournaments = await discoverTournaments(sport);
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
  activeTournaments?: string[]
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
    log.info({ sport, trigger, activeTournaments }, "Starting Gemini refresh");

    // Pass active tournaments to Gemini so it only fetches data we need
    const data = await fetchSportsData(sport, activeTournaments);

    const tournamentsUpserted = await upsertTournaments(sport, data.tournaments, db);
    const matchesUpserted = await upsertMatches(sport, data.matches, db);

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
        log.info({ sport, tournaments: startedTournaments }, "Fetching standings for started tournaments");
        const standingsMap = await fetchTournamentStandings(sport, startedTournaments);
        await updateTournamentStandings(sport, standingsMap, db);
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
  // Extract timezone abbreviation if present
  const tzMatch = timeStr.match(/\s+([A-Z]{2,4})\s*$/);
  const tzAbbrev = tzMatch?.[1] ?? null;
  const tzOffsetMinutes = tzAbbrev ? TZ_OFFSETS[tzAbbrev] ?? null : null;

  // Strip timezone abbreviation for base parsing
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

  // If we have a known timezone offset, correct to proper UTC
  if (tzOffsetMinutes !== null) {
    // `parsed` assumed the time was in the machine's local timezone.
    // But it's actually in the source timezone (e.g., IST = UTC+330min).
    // parsed.getTime() gives UTC assuming machine-local interpretation.
    // We need to undo the machine-local offset and apply the source timezone offset.
    // machineOffsetMin = parsed.getTimezoneOffset() (positive means behind UTC, e.g., EST = +300)
    // parsed internally = wallclock + machineOffsetMin (in UTC millis)
    // We want           = wallclock - tzOffsetMinutes (in UTC millis, since tzOffsetMinutes is ahead of UTC)
    // So correct        = parsed.getTime() - (machineOffsetMin + tzOffsetMinutes) * 60000
    const machineOffsetMin = parsed.getTimezoneOffset(); // e.g., EST = 300 (5 hours behind UTC)
    const correction = -(machineOffsetMin + tzOffsetMinutes) * 60000;
    return new Date(parsed.getTime() + correction);
  }

  return parsed;
}
