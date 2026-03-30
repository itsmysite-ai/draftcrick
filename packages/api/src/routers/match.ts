import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { eq, desc, asc, and, or, gte, lte, inArray } from "drizzle-orm";
import { matches, contests, tournaments } from "@draftplay/db";
import { getVisibleTournamentNames } from "../services/admin-config";
import { getLogger } from "../lib/logger";
import { determineMatchPhase, calculateNextRefreshAfter } from "@draftplay/shared";

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

      // Sync matchPhase + draftEnabled
      const phase = determineMatchPhase(match.startTime, null, newStatus);
      if (match.matchPhase !== phase) updateSet.matchPhase = phase;
      updateSet.nextRefreshAfter = calculateNextRefreshAfter(phase, now);
      if (phase === "live") updateSet.draftEnabled = false;
      else if (phase === "completed" || phase === "post_match") updateSet.draftEnabled = false;

      await db.update(matches).set(updateSet).where(eq(matches.id, match.id));

      // Auto-transition contests on status change
      if (newStatus !== match.status) {
        if (newStatus === "live") {
          await db.update(contests).set({ status: "live" })
            .where(and(eq(contests.matchId, match.id), eq(contests.status, "open")));
        } else if (newStatus === "completed") {
          await db.update(contests).set({ status: "settling" })
            .where(and(eq(contests.matchId, match.id), eq(contests.status, "live")));
          await db.update(contests).set({ status: "cancelled" })
            .where(and(eq(contests.matchId, match.id), eq(contests.status, "open")));
        }
      }
    }

    // 2. Refresh player scores
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

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const result = await ctx.db.query.matches.findMany({
      where: and(
        inArray(matches.tournament, visibleNames),
        or(
          eq(matches.status, "live"),
          eq(matches.status, "upcoming"),
          and(
            eq(matches.status, "completed"),
            gte(matches.startTime, oneDayAgo),
          ),
        ),
      ),
      orderBy: [desc(matches.status), asc(matches.startTime)],
    });

    // Fire-and-forget: refresh any stale live matches in the background
    const now = Date.now();
    for (const m of result) {
      if (m.status !== "live") continue;
      if (!m.externalId) continue;
      const lastRefresh = m.lastRefreshedAt ? new Date(m.lastRefreshedAt).getTime() : 0;
      if (now - lastRefresh > REFRESH_STALE_MS) {
        backgroundRefreshMatch(ctx.db, m);
      }
    }

    return result;
  }),
});
