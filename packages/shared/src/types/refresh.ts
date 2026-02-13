/**
 * Smart Refresh Architecture types.
 * See /docs/SMART_REFRESH_ARCHITECTURE.md for full spec.
 */

/** Match phase determines refresh frequency */
export type MatchPhase =
  | "idle"
  | "pre_match"
  | "live"
  | "post_match"
  | "completed";

/** Refresh intervals in milliseconds per match phase. null = never auto-refresh. */
export const REFRESH_INTERVALS: Record<MatchPhase, number | null> = {
  idle: 12 * 60 * 60 * 1000, // 12 hours
  pre_match: 2 * 60 * 60 * 1000, // 2 hours
  live: 5 * 60 * 1000, // 5 minutes
  post_match: 30 * 60 * 1000, // 30 minutes
  completed: null, // Never auto-refresh
};

/** What triggered a data refresh */
export type RefreshTrigger = "user_request" | "cold_start" | "manual";

/** Status of a refresh operation */
export type RefreshStatus = "in_progress" | "success" | "failed" | "skipped";

/** Entry logged to data_refresh_log after each refresh */
export interface RefreshLogEntry {
  entityType: "tournament" | "match" | "dashboard";
  entityId?: string;
  sport: string;
  trigger: RefreshTrigger;
  triggeredByUserId?: string;
  startedAt: Date;
  completedAt?: Date;
  durationMs?: number;
  status: RefreshStatus;
  errorMessage?: string;
  recordsUpserted?: number;
  recordsUnchanged?: number;
}

/** Result returned after executing a refresh */
export interface RefreshResult {
  refreshed: boolean;
  trigger: RefreshTrigger;
  durationMs: number;
  recordsUpserted: number;
  error?: string;
}

/**
 * Determine match phase based on timing and status.
 * Phase drives the refresh interval — live matches refresh every 5min,
 * idle matches every 12h, etc.
 */
export function determineMatchPhase(
  startTime: Date | string,
  endTime?: Date | string | null,
  status?: string
): MatchPhase {
  const now = new Date();
  const start = new Date(startTime);

  const hoursUntilStart =
    (start.getTime() - now.getTime()) / (1000 * 60 * 60);

  // Completed or cancelled
  if (status === "completed" || status === "cancelled" || status === "abandoned") {
    return "completed";
  }

  // Post-match: match ended less than 6 hours ago
  if (endTime) {
    const end = new Date(endTime);
    if (now > end) {
      const hoursSinceEnd =
        (now.getTime() - end.getTime()) / (1000 * 60 * 60);
      return hoursSinceEnd < 6 ? "post_match" : "completed";
    }
  }

  // Live
  if (status === "live" || status === "in_progress") {
    return "live";
  }

  // Pre-match: within 48 hours
  if (hoursUntilStart <= 48 && hoursUntilStart > 0) {
    return "pre_match";
  }

  // If start time has passed but not marked live/completed, treat as live
  if (hoursUntilStart <= 0) {
    return "live";
  }

  return "idle";
}

/**
 * Calculate the next refresh timestamp based on current phase.
 * Returns null for completed matches (never refresh).
 */
export function calculateNextRefreshAfter(
  phase: MatchPhase,
  fromTime?: Date
): Date | null {
  const interval = REFRESH_INTERVALS[phase];
  if (interval === null) return null;
  const base = fromTime ?? new Date();
  return new Date(base.getTime() + interval);
}
