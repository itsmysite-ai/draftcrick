/**
 * Live Scores Service — fetches player stats from Cricbuzz and feeds
 * them into the existing scoring pipeline.
 *
 * Flow: DB match → Cricbuzz match ID → scrape scorecard stats →
 *       match players to DB → processScoreUpdate → leaderboard updated
 */

import { eq, and, inArray } from "drizzle-orm";
import type { Database } from "@draftplay/db";
import { matches, players, playerMatchScores } from "@draftplay/db";
import { fetchScorecardStats } from "../providers/cricbuzz/cricbuzz-client";
import type { ScorecardPlayerStats } from "../providers/cricbuzz/cricbuzz-client";
import { processScoreUpdate } from "../jobs/score-updater";
import { linkPlayersToMatch } from "./sports-data";
import { getLogger } from "../lib/logger";

const log = getLogger("live-scores");

/**
 * Refresh player scores for a match by scraping Cricbuzz scorecard.
 * Returns the number of players updated.
 */
export async function refreshMatchScoresFromCricbuzz(
  db: Database,
  matchId: string
): Promise<{ updated: number; source: string; details: string }> {
  // 1. Load match from DB
  const match = await db.query.matches.findFirst({
    where: eq(matches.id, matchId),
  });

  if (!match) {
    throw new Error(`Match ${matchId} not found`);
  }

  if (!match.externalId) {
    throw new Error(`Match ${matchId} has no externalId — cannot resolve Cricbuzz match`);
  }

  // 2. Extract Cricbuzz match ID from externalId (format: "cb-match-148331")
  const cbMatchId = parseCricbuzzMatchId(match.externalId);
  if (!cbMatchId) {
    throw new Error(`Cannot parse Cricbuzz match ID from externalId: ${match.externalId}`);
  }

  log.info({ matchId, cbMatchId, teams: `${match.teamHome} vs ${match.teamAway}` }, "Fetching live scorecard stats from Cricbuzz");

  // 3. Scrape scorecard stats
  const scorecardStats = await fetchScorecardStats(cbMatchId);

  if (scorecardStats.length === 0) {
    return { updated: 0, source: "cricbuzz", details: "No scorecard data available yet" };
  }

  // 4. Map Cricbuzz player IDs to DB player UUIDs
  const cricbuzzExternalIds = scorecardStats.map((s) => `cb-${s.cricbuzzId}`);

  // Ensure all players are linked to this match
  await linkPlayersToMatch(matchId, match.teamHome, match.teamAway, db, cricbuzzExternalIds);

  // Build mapping: cricbuzzId → DB player UUID
  const dbPlayers = await db
    .select({ id: players.id, externalId: players.externalId })
    .from(players)
    .where(
      and(
        eq(players.isDisabled, false),
        inArray(players.externalId, cricbuzzExternalIds)
      )
    );

  const externalToDbId = new Map<string, string>();
  for (const p of dbPlayers) {
    externalToDbId.set(p.externalId, p.id);
  }

  // 5. Format score updates for the pipeline
  const scoreUpdates: Array<{
    playerId: string;
    runs: number;
    ballsFaced: number;
    fours: number;
    sixes: number;
    isDismissed: boolean;
    wickets: number;
    oversBowled: number;
    runsConceded: number;
    maidens: number;
    catches: number;
    stumpings: number;
    runOuts: number;
  }> = [];

  let unmatchedCount = 0;

  for (const stat of scorecardStats) {
    const dbPlayerId = externalToDbId.get(`cb-${stat.cricbuzzId}`);
    if (!dbPlayerId) {
      log.warn({ cricbuzzId: stat.cricbuzzId, name: stat.name }, "Player not found in DB — skipping");
      unmatchedCount++;
      continue;
    }

    scoreUpdates.push({
      playerId: dbPlayerId,
      runs: stat.runs,
      ballsFaced: stat.ballsFaced,
      fours: stat.fours,
      sixes: stat.sixes,
      isDismissed: stat.isDismissed,
      wickets: stat.wickets,
      oversBowled: stat.oversBowled,
      runsConceded: stat.runsConceded,
      maidens: stat.maidens,
      catches: stat.catches,
      stumpings: stat.stumpings,
      runOuts: stat.runOuts,
    });
  }

  if (scoreUpdates.length === 0) {
    return { updated: 0, source: "cricbuzz", details: `Scorecard has ${scorecardStats.length} players but none matched DB records` };
  }

  // 5b. Stale data guard — compare total runs from new data vs existing DB scores
  // Cricbuzz CDN sometimes serves cached/stale scorecard pages
  const existingScores = await db.query.playerMatchScores.findMany({
    where: eq(playerMatchScores.matchId, matchId),
    columns: { runs: true, wickets: true },
  });
  const existingTotalRuns = existingScores.reduce((sum, s) => sum + (s.runs ?? 0), 0);
  const newTotalRuns = scoreUpdates.reduce((sum, s) => sum + s.runs, 0);

  if (existingTotalRuns > 0 && newTotalRuns < existingTotalRuns * 0.5) {
    log.warn({ matchId, existingTotalRuns, newTotalRuns }, "Stale scorecard detected — skipping player score update");
    return { updated: 0, source: "cricbuzz", details: `Skipped stale data (new total runs ${newTotalRuns} < existing ${existingTotalRuns})` };
  }

  // 6. Feed into existing scoring pipeline
  await processScoreUpdate(db, matchId, scoreUpdates);

  const details = `${scoreUpdates.length} players scored` + (unmatchedCount > 0 ? `, ${unmatchedCount} unmatched` : "");
  log.info({ matchId, updated: scoreUpdates.length, unmatched: unmatchedCount }, "Live scores updated from Cricbuzz");

  return { updated: scoreUpdates.length, source: "cricbuzz", details };
}

/**
 * Parse Cricbuzz match ID from an externalId string.
 * Formats: "cb-match-148331" → 148331, "cb-148331" → 148331
 */
function parseCricbuzzMatchId(externalId: string): number | null {
  const match = externalId.match(/cb-(?:match-)?(\d+)/);
  return match ? parseInt(match[1]!, 10) : null;
}

/**
 * Poll all live matches and refresh their scores.
 * Call this periodically (e.g., every 2-3 minutes) during live matches.
 */
export async function pollLiveMatchScores(
  db: Database
): Promise<{ matchesPolled: number; results: Array<{ matchId: string; teams: string; updated: number; error?: string }> }> {
  const liveMatches = await db.query.matches.findMany({
    where: eq(matches.status, "live"),
    columns: { id: true, teamHome: true, teamAway: true, externalId: true },
  });

  if (liveMatches.length === 0) {
    return { matchesPolled: 0, results: [] };
  }

  const results: Array<{ matchId: string; teams: string; updated: number; error?: string }> = [];

  for (const match of liveMatches) {
    const teams = `${match.teamHome} vs ${match.teamAway}`;
    try {
      if (!match.externalId) {
        results.push({ matchId: match.id, teams, updated: 0, error: "No externalId" });
        continue;
      }
      const result = await refreshMatchScoresFromCricbuzz(db, match.id);
      results.push({ matchId: match.id, teams, updated: result.updated });
    } catch (err: any) {
      log.error({ matchId: match.id, err: err.message }, "Failed to refresh scores for live match");
      results.push({ matchId: match.id, teams, updated: 0, error: err.message });
    }
  }

  return { matchesPolled: liveMatches.length, results };
}
