/**
 * Feature Flag Service — controls early access and gradual feature rollout.
 *
 * Features can be set to:
 * - "elite_only"    → Only Elite subscribers can access (early access)
 * - "pro_and_above" → Pro and Elite can access
 * - "all"           → Everyone can access
 * - "disabled"      → Nobody can access (feature hidden)
 *
 * Admin can promote features through the tiers as they mature:
 *   elite_only → pro_and_above → all
 *
 * Stored in admin_config table under key "early_access_features".
 * PG-cached with 5-minute TTL.
 */

import type { SubscriptionTier } from "@draftplay/shared";
import { tierAtLeast } from "@draftplay/shared";
import { getAdminConfig, setAdminConfig } from "./admin-config";
import { getFromHotCache, setHotCache, invalidateHotCache } from "./sports-cache";
import { getLogger } from "../lib/logger";

const log = getLogger("feature-flags");

const CACHE_KEY = "feature-flags:early-access";
const CACHE_TTL = 300; // 5 min

export type FeatureAccess = "elite_only" | "pro_and_above" | "all" | "disabled";

export interface FeatureFlag {
  access: FeatureAccess;
  badge: "early_access" | null;
}

export type FeatureFlagMap = Record<string, FeatureFlag>;

/** Default feature flags — admin overrides merge on top */
const DEFAULT_FEATURE_FLAGS: FeatureFlagMap = {
  team_solver: { access: "elite_only", badge: "early_access" },
  gurus_verdict: { access: "elite_only", badge: "early_access" },
  confidence_intervals: { access: "elite_only", badge: "early_access" },
  live_predictions: { access: "elite_only", badge: "early_access" },
  ai_insights: { access: "elite_only", badge: "early_access" },
  player_compare: { access: "pro_and_above", badge: null },
  rate_my_team: { access: "pro_and_above", badge: null },
  projected_points: { access: "pro_and_above", badge: null },
  captain_picks: { access: "pro_and_above", badge: null },
  differentials: { access: "pro_and_above", badge: null },
  playing_xi: { access: "pro_and_above", badge: null },
  value_tracker: { access: "pro_and_above", badge: null },
};

/**
 * Get all feature flags (defaults merged with admin overrides).
 */
export async function getFeatureFlags(): Promise<FeatureFlagMap> {
  const cached = await getFromHotCache<FeatureFlagMap>(CACHE_KEY);
  if (cached) return cached;

  const overrides = await getAdminConfig<FeatureFlagMap>("early_access_features");
  const flags = { ...DEFAULT_FEATURE_FLAGS };

  if (overrides) {
    for (const [key, override] of Object.entries(overrides)) {
      flags[key] = { ...flags[key], ...override };
    }
  }

  await setHotCache(CACHE_KEY, flags, CACHE_TTL);
  return flags;
}

/**
 * Check if a user's tier can access a specific feature.
 */
export async function canAccessFeature(
  featureKey: string,
  userTier: SubscriptionTier
): Promise<boolean> {
  const flags = await getFeatureFlags();
  const flag = flags[featureKey];

  if (!flag) return true; // Unknown feature = unrestricted

  switch (flag.access) {
    case "all":
      return true;
    case "pro_and_above":
      return tierAtLeast(userTier, "pro");
    case "elite_only":
      return tierAtLeast(userTier, "elite");
    case "disabled":
      return false;
    default:
      return true;
  }
}

/**
 * Get the badge for a feature (if any).
 */
export async function getFeatureBadge(
  featureKey: string
): Promise<"early_access" | null> {
  const flags = await getFeatureFlags();
  return flags[featureKey]?.badge ?? null;
}

/**
 * Get all features accessible by a given tier, with badges.
 */
export async function getFeaturesForTier(
  userTier: SubscriptionTier
): Promise<Array<{ key: string; badge: "early_access" | null }>> {
  const flags = await getFeatureFlags();
  const accessible: Array<{ key: string; badge: "early_access" | null }> = [];

  for (const [key, flag] of Object.entries(flags)) {
    if (flag.access === "disabled") continue;

    let hasAccess = false;
    switch (flag.access) {
      case "all":
        hasAccess = true;
        break;
      case "pro_and_above":
        hasAccess = tierAtLeast(userTier, "pro");
        break;
      case "elite_only":
        hasAccess = tierAtLeast(userTier, "elite");
        break;
    }

    if (hasAccess) {
      accessible.push({ key, badge: flag.badge });
    }
  }

  return accessible;
}

/**
 * Admin: update feature flags.
 */
export async function updateFeatureFlags(
  updates: Partial<FeatureFlagMap>,
  adminUserId: string
): Promise<void> {
  // Get existing overrides, merge with updates
  const existing = (await getAdminConfig<FeatureFlagMap>("early_access_features")) ?? {};
  const merged = { ...existing, ...updates };

  await setAdminConfig("early_access_features", merged, "Early access feature flags", adminUserId);
  await invalidateHotCache(CACHE_KEY);
  log.info({ adminUserId, updated: Object.keys(updates) }, "Feature flags updated");
}
