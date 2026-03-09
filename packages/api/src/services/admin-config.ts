/**
 * Admin Config Service — cached config reader for admin-managed settings.
 *
 * Reads from Redis (5min TTL) → PostgreSQL fallback.
 * Used by team.ts (rules), sports.ts (visible tournaments), and admin router.
 */

import { getLogger } from "../lib/logger";
import { getFromHotCache, setHotCache, invalidateHotCache } from "./sports-cache";
import { getDb } from "@draftplay/db";
import { adminConfig, tournaments } from "@draftplay/db";
import { eq } from "drizzle-orm";

const log = getLogger("admin-config");

/** Cache TTL for admin config: 5 minutes */
const CONFIG_CACHE_TTL = 300;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TeamRules {
  maxBudget: number;
  maxOverseas: number;
  maxFromOneTeam: number;
  roleLimits: Record<string, { min: number; max: number }>;
}

export interface FeatureFlags {
  draftEnabled: boolean;
  auctionEnabled: boolean;
  predictionsEnabled: boolean;
  progaActive: boolean;
}

/** Default rules if nothing is configured */
const DEFAULT_TEAM_RULES: TeamRules = {
  maxBudget: 100,
  maxOverseas: 4,
  maxFromOneTeam: 7,
  roleLimits: {
    wicket_keeper: { min: 1, max: 4 },
    batsman: { min: 1, max: 6 },
    all_rounder: { min: 1, max: 6 },
    bowler: { min: 1, max: 6 },
  },
};

// ---------------------------------------------------------------------------
// Core config reader
// ---------------------------------------------------------------------------

/**
 * Get an admin config value by key. Uses Redis cache with PG fallback.
 */
export async function getAdminConfig<T = unknown>(key: string): Promise<T | null> {
  // 1. Try Redis cache
  const cacheKey = `admin-config:${key}`;
  const cached = await getFromHotCache<T>(cacheKey);
  if (cached !== null) return cached;

  // 2. Fallback to PG
  try {
    const db = getDb();
    const row = await db.query.adminConfig.findFirst({
      where: eq(adminConfig.key, key),
    });

    if (!row) return null;

    const value = row.value as T;

    // Cache for next time
    await setHotCache(cacheKey, value, CONFIG_CACHE_TTL);

    return value;
  } catch (error) {
    log.error({ key, error: String(error) }, "Failed to read admin config from PG");
    return null;
  }
}

/**
 * Update an admin config value. Invalidates cache.
 */
export async function setAdminConfig(
  key: string,
  value: unknown,
  description?: string,
  updatedBy?: string
): Promise<void> {
  const db = getDb();

  // Check if key exists
  const existing = await db.query.adminConfig.findFirst({
    where: eq(adminConfig.key, key),
  });

  if (existing) {
    await db
      .update(adminConfig)
      .set({ value, description, updatedBy, updatedAt: new Date() })
      .where(eq(adminConfig.key, key));
  } else {
    await db.insert(adminConfig).values({ key, value, description, updatedBy });
  }

  // Invalidate cache
  await invalidateHotCache(`admin-config:${key}`);
  log.info({ key }, "Admin config updated");
}

// ---------------------------------------------------------------------------
// Team rules (global + per-tournament merge)
// ---------------------------------------------------------------------------

/**
 * Get effective team rules for a tournament.
 * Merges global defaults with per-tournament overrides.
 */
export async function getEffectiveTeamRules(tournamentId?: string): Promise<TeamRules> {
  // 1. Get global rules
  const globalRules = (await getAdminConfig<TeamRules>("global_team_rules")) ?? DEFAULT_TEAM_RULES;

  if (!tournamentId) return globalRules;

  // 2. Check per-tournament overrides
  try {
    const cacheKey = `admin-config:tournament-rules:${tournamentId}`;
    const cached = await getFromHotCache<Partial<TeamRules>>(cacheKey);

    if (cached !== null) {
      return { ...globalRules, ...cached };
    }

    const db = getDb();
    const tournament = await db.query.tournaments.findFirst({
      where: eq(tournaments.id, tournamentId),
      columns: { tournamentRules: true },
    });

    const overrides = tournament?.tournamentRules as Partial<TeamRules> | null;

    if (overrides) {
      await setHotCache(cacheKey, overrides, CONFIG_CACHE_TTL);
      return { ...globalRules, ...overrides };
    }

    return globalRules;
  } catch (error) {
    log.warn({ tournamentId, error: String(error) }, "Failed to read tournament rules, using global defaults");
    return globalRules;
  }
}

// ---------------------------------------------------------------------------
// Visible tournaments
// ---------------------------------------------------------------------------

/**
 * Get list of tournament names marked as visible by admin.
 * Replaces the hardcoded ACTIVE_TOURNAMENTS array in sports.ts.
 */
export async function getVisibleTournamentNames(): Promise<string[]> {
  const cacheKey = "admin-config:visible-tournaments";
  const cached = await getFromHotCache<string[]>(cacheKey);
  if (cached !== null) return cached;

  try {
    const db = getDb();
    const visibleTournaments = await db.query.tournaments.findMany({
      where: eq(tournaments.isVisible, true),
      columns: { name: true },
    });

    const names = visibleTournaments.map((t) => t.name);
    await setHotCache(cacheKey, names, CONFIG_CACHE_TTL);

    return names;
  } catch (error) {
    log.error({ error: String(error) }, "Failed to read visible tournaments");
    return [];
  }
}

/**
 * Get feature flags.
 */
export async function getFeatureFlags(): Promise<FeatureFlags> {
  const flags = await getAdminConfig<FeatureFlags>("feature_flags");
  return flags ?? {
    draftEnabled: true,
    auctionEnabled: true,
    predictionsEnabled: false,
    progaActive: true,
  };
}

/**
 * Invalidate all admin config caches (call after any admin update).
 */
export async function invalidateAdminConfigCache(): Promise<void> {
  await invalidateHotCache("admin-config:");
  log.info("Admin config cache invalidated");
}
