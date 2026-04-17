import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { eq, desc, asc, and, or, lte, inArray } from "drizzle-orm";
import { matches, contests, tournaments } from "@draftplay/db";
import { getVisibleTournamentNames } from "../services/admin-config";
import { getLogger } from "../lib/logger";
import { determineMatchPhase, calculateNextRefreshAfter } from "@draftplay/shared";
import { applyMatchPhaseChange } from "../services/match-lifecycle";

const log = getLogger("match-router");

// ── In-memory lock to prevent concurrent refreshes for the same match ──
const refreshInProgress = new Set<string>();
const REFRESH_STALE_MS = 300_000; // 5 minutes

/**
 * Background-refresh a live match's scores + status from Cricbuzz.
 * Non-blocking — fires and forgets so user responses aren't delayed.
 */
async function backgroundRefreshMatch(db: any, match: any) {
  if (refreshInProgress.has(match.id)) return;
  refreshInProgress.add(match.id);

  try {
    const cbIdMatch = match.externalId?.match(/cb-(?:match-)?(\d+)/);
    if (!cbIdMatch) return;

    // 1. Refresh match score summary + status
    const { fetchMatchScoreById } = await import("../providers/cricbuzz/cricbuzz-client");
    const cbScore = await fetchMatchScoreById(parseInt(cbIdMatch[1]!, 10));

    if (cbScore) {
      const now = new Date();
      const updateSet: Record<string, any> = { lastRefreshedAt: now };

      // Stale data guard
      const extractOvers = (s: string | null | undefined) => {
        if (!s) return 0;
        let total = 0;
        for (const m of s.matchAll(/\((\d+(?:\.\d+)?)\)/g)) total += parseFloat(m[1]!);
        return total;
      };
      const currentOvers = extractOvers(match.scoreSummary);
      const newOvers = extractOvers(cbScore.scoreSummary);
      if (cbScore.scoreSummary && newOvers >= currentOvers) {
        updateSet.scoreSummary = cbScore.scoreSummary;
      }

      let newStatus = match.status;
      if (cbScore.status && cbScore.status !== match.status) { newStatus = cbScore.status; updateSet.status = newStatus; }
      if (cbScore.result) updateSet.result = cbScore.result;
      if (cbScore.tossWinner) updateSet.tossWinner = cbScore.tossWinner;
      if (cbScore.tossDecision) updateSet.tossDecision = cbScore.tossDecision;

      // Compute the next-refresh schedule based on the incoming phase.
      // match_phase itself is NOT written here — applyMatchPhaseChange below
      // is the canonical path that fires all side-effects (draft, contests,
      // notifications, CM hooks).
      const phase = determineMatchPhase(match.startTime, null, newStatus);
      updateSet.nextRefreshAfter = calculateNextRefreshAfter(phase, now);

      await db.update(matches).set(updateSet).where(eq(matches.id, match.id));

      // Apply phase change canonically (no-op if unchanged). Side-effects:
      // draft enablement/disablement, contest status transitions, user
      // notifications, CM round hooks, prediction grace periods.
      await applyMatchPhaseChange(
        db,
        match.id,
        phase,
        "background:liveMatchRefresh"
      );
    }

    // 2. Fetch confirmed playing XI if toss just happened
    const { fetchAndStorePlayingXI } = await import("../services/playing-xi-fetch");
    await fetchAndStorePlayingXI(db, match.id);

    // 3. Refresh player scores
    const { refreshMatchScoresFromCricbuzz } = await import("../services/live-scores");
    await refreshMatchScoresFromCricbuzz(db, match.id);

    log.info({ matchId: match.id, teams: `${match.teamHome} vs ${match.teamAway}` }, "Auto-refreshed live match scores");
  } catch (err: any) {
    log.error({ matchId: match.id, err: err.message }, "Background refresh failed");
  } finally {
    refreshInProgress.delete(match.id);
  }
}

export const matchRouter = router({
  /**
   * List matches with optional filters
   */
  list: publicProcedure
    .input(
      z
        .object({
          status: z
            .enum(["upcoming", "live", "completed", "abandoned"])
            .optional(),
          sport: z.string().optional(),
          tournament: z.string().optional(),
          limit: z.number().int().min(1).max(50).default(20),
          cursor: z.string().uuid().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const filters = input ?? {};
      const conditions = [];

      // Only show matches from visible tournaments
      const visibleNames = await getVisibleTournamentNames();
      if (visibleNames.length === 0) return { matches: [], nextCursor: null };
      conditions.push(inArray(matches.tournament, visibleNames));

      if (filters.status) {
        conditions.push(eq(matches.status, filters.status));
      }
      if (filters.sport) {
        conditions.push(eq(matches.sport, filters.sport));
      }
      if (filters.tournament) {
        conditions.push(eq(matches.tournament, filters.tournament));
      }

      const result = await ctx.db.query.matches.findMany({
        where: and(...conditions),
        orderBy: [asc(matches.startTime)],
        limit: filters.limit,
      });

      return {
        matches: result,
        nextCursor:
          result.length === filters.limit
            ? result[result.length - 1]?.id
            : null,
      };
    }),

  /**
   * Get a single match by ID
   */
  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const match = await ctx.db.query.matches.findFirst({
        where: eq(matches.id, input.id),
        with: {
          playerScores: true,
        },
      });
      return match ?? null;
    }),

  /**
   * Get a single match by external ID (e.g. cb-match-12345)
   */
  getByExternalId: publicProcedure
    .input(z.object({ externalId: z.string() }))
    .query(async ({ ctx, input }) => {
      const match = await ctx.db.query.matches.findFirst({
        where: eq(matches.externalId, input.externalId),
      });
      return match ?? null;
    }),

  /**
   * Get live + upcoming + recently completed matches (only from visible tournaments).
   * For live matches, triggers a background Cricbuzz refresh if data is stale (>2.5 min).
   */
  live: publicProcedure.query(async ({ ctx }) => {
    // Only show matches from admin-visible tournaments
    const visibleNames = await getVisibleTournamentNames();
    if (visibleNames.length === 0) return [];

    // Return ALL matches for visible tournaments (live + upcoming + every
    // completed). Mobile home needs the full completed set so the DB lookup
    // on older matches doesn't fall through to a stale AI "upcoming" flag —
    // which was causing weeks-old matches to render in "more matches" and
    // "next match" sections. `result` size is bounded by visible tournaments,
    // which is small (~1-3 leagues × ~70 matches each).
    const result = await ctx.db.query.matches.findMany({
      where: and(
        inArray(matches.tournament, visibleNames),
        or(
          eq(matches.status, "live"),
          eq(matches.status, "upcoming"),
          eq(matches.status, "completed"),
        ),
      ),
      orderBy: [desc(matches.status), asc(matches.startTime)],
    });

    // Fire-and-forget background work for every poll:
    //
    // (a) Refresh matches that are due — live matches every 5m, pre_match
    //     every 2h (when toss/XI info lands, status flips to live),
    //     idle within 48h every 12h. Without this, upcoming matches never
    //     got re-pulled from Cricbuzz, so transitions like pre_match → live
    //     and toss-time XI fetches never fired. We respect each match's
    //     own `nextRefreshAfter` column (computed by calculateNextRefreshAfter
    //     during the previous refresh); if null (never refreshed), refresh
    //     eagerly for live/upcoming matches that are within 48h of start.
    //
    // (b) Run tickRoundLifecycles so time-based transitions (idle →
    //     pre_match at T-24h) fire even when no match has produced a
    //     score yet. Previously only called from processScoreUpdate which
    //     required a live match to already exist — chicken-and-egg.
    const now = Date.now();
    const in48hMs = now + 48 * 60 * 60 * 1000;
    for (const m of result) {
      if (!m.externalId) continue;
      if (m.status === "completed") continue;

      const lastRefresh = m.lastRefreshedAt ? new Date(m.lastRefreshedAt).getTime() : 0;
      const nextRefresh = m.nextRefreshAfter ? new Date(m.nextRefreshAfter).getTime() : 0;
      const startMs = m.startTime ? new Date(m.startTime).getTime() : 0;

      let shouldRefresh = false;
      if (m.status === "live") {
        // Always refresh live matches if stale
        shouldRefresh = now - lastRefresh > REFRESH_STALE_MS;
      } else if (m.status === "upcoming" && startMs > 0 && startMs < in48hMs) {
        // Upcoming matches within 48h: refresh if due, or if never refreshed.
        // Phase-based interval (pre_match = 2h, idle = 12h) is encoded in
        // nextRefreshAfter by the previous call to calculateNextRefreshAfter.
        if (!m.nextRefreshAfter) {
          shouldRefresh = now - lastRefresh > REFRESH_STALE_MS;
        } else {
          shouldRefresh = nextRefresh <= now;
        }
      }

      if (shouldRefresh) {
        backgroundRefreshMatch(ctx.db, m);
      }
    }

    // Time-based CM round lifecycle sweep. Fire-and-forget; errors logged
    // inside cm-service. Runs on every home/live poll so idle→pre_match
    // catches up even when nothing else triggers it.
    import("../services/cm-service")
      .then(({ tickRoundLifecycles }) => tickRoundLifecycles(ctx.db))
      .catch((err) =>
        log.error({ err }, "tickRoundLifecycles from match.live failed")
      );

    return result;
  }),
});
