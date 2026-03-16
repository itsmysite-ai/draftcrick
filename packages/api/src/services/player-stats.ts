import { eq, sql, and, inArray, desc } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { getFromHotCache, setHotCache } from "./sports-cache";
import { getLogger } from "../lib/logger";

const log = getLogger("player-stats");

export interface PlayerStatRow {
  playerId: string;
  playerName: string;
  team: string;
  role: string;
  matches: number;
  /** "match" = from playerMatchScores, "profile" = from Gemini player profile */
  source: "match" | "profile";
  // Batting
  totalRuns: number;
  avgRuns: number;
  highScore: number;
  totalFours: number;
  totalSixes: number;
  strikeRate: number;
  // Bowling
  totalWickets: number;
  avgWickets: number;
  bestBowling: number;
  economyRate: number;
  // Fielding
  totalCatches: number;
  totalStumpings: number;
  totalRunOuts: number;
  // Fantasy
  totalFantasyPoints: number;
  avgFantasyPoints: number;
  bestFantasyPoints: number;
  // Form (last 3 matches avg)
  formAvg: number;
}

/**
 * Get aggregated player stats for a match (all players from both teams).
 *
 * Two data sources:
 * 1. playerMatchScores — real match performance data (runs, wickets, etc.)
 *    Only used when rows have actual scoring data (not just linked placeholders).
 * 2. players.stats JSON — Gemini-sourced career/profile stats (battingAvg, SR, etc.)
 *    Used as fallback when no real match data exists (pre-match scenario).
 */
export async function getPlayerStatsForMatch(
  db: NodePgDatabase<any>,
  teamA: string,
  teamB: string,
  tournament: string,
  sortBy: string = "avgFantasyPoints",
  sortDir: "asc" | "desc" = "desc",
): Promise<PlayerStatRow[]> {
  const cacheKey = `player-stats:v2:${teamA}:${teamB}:${sortBy}:${sortDir}`;
  const cached = await getFromHotCache<PlayerStatRow[]>(cacheKey);
  if (cached) return cached;

  try {
    const { players, playerMatchScores } = await import("@draftplay/db");

    // Get players from both teams
    const teamPlayers = await db
      .select()
      .from(players)
      .where(
        sql`lower(${players.team}) IN (${teamA.toLowerCase()}, ${teamB.toLowerCase()})`,
      );

    if (teamPlayers.length === 0) return [];

    const playerIds = teamPlayers.map((p) => p.id);

    // Get match scores — only rows with actual performance data
    const allScores = await db
      .select()
      .from(playerMatchScores)
      .where(inArray(playerMatchScores.playerId, playerIds));

    // Filter out placeholder rows (linked but no actual match data yet)
    const realScores = allScores.filter((s) =>
      (s.runs ?? 0) > 0 || (s.wickets ?? 0) > 0 || (s.ballsFaced ?? 0) > 0 ||
      (s.catches ?? 0) > 0 || Number(s.fantasyPoints ?? 0) > 0 || Number(s.oversBowled ?? 0) > 0
    );

    // Aggregate per player
    const statsMap = new Map<string, PlayerStatRow>();

    for (const p of teamPlayers) {
      const playerScores = realScores.filter((s) => s.playerId === p.id);
      const gs = (p.stats as any) ?? {};

      if (playerScores.length === 0) {
        // No real match data — use Gemini profile stats
        // Field mapping: stats JSON uses "average" (batting), "bowlingAverage", "strikeRate", "economyRate"
        statsMap.set(p.id, {
          playerId: p.id,
          playerName: p.name,
          team: p.team,
          role: p.role ?? "unknown",
          source: "profile",
          matches: gs.matchesPlayed ?? 0,
          totalRuns: 0,
          avgRuns: round(gs.average ?? 0),
          highScore: 0,
          totalFours: 0,
          totalSixes: 0,
          strikeRate: round(gs.strikeRate ?? 0),
          totalWickets: 0,
          avgWickets: round(gs.bowlingAverage ?? 0),
          bestBowling: 0,
          economyRate: round(gs.economyRate ?? 0),
          totalCatches: 0,
          totalStumpings: 0,
          totalRunOuts: 0,
          totalFantasyPoints: 0,
          avgFantasyPoints: round(gs.recentForm ?? 0),
          bestFantasyPoints: 0,
          formAvg: round(gs.recentForm ?? 0),
        });
        continue;
      }

      // Real match data — aggregate from playerMatchScores
      const matchCount = playerScores.length;
      const totalRuns = playerScores.reduce((s, sc) => s + (sc.runs ?? 0), 0);
      const totalBallsFaced = playerScores.reduce((s, sc) => s + (sc.ballsFaced ?? 0), 0);
      const totalWickets = playerScores.reduce((s, sc) => s + (sc.wickets ?? 0), 0);
      const totalOvers = playerScores.reduce((s, sc) => s + Number(sc.oversBowled ?? 0), 0);
      const totalRunsConceded = playerScores.reduce((s, sc) => s + (sc.runsConceded ?? 0), 0);
      const totalCatches = playerScores.reduce((s, sc) => s + (sc.catches ?? 0), 0);
      const totalStumpings = playerScores.reduce((s, sc) => s + (sc.stumpings ?? 0), 0);
      const totalRunOuts = playerScores.reduce((s, sc) => s + (sc.runOuts ?? 0), 0);
      const totalFP = playerScores.reduce((s, sc) => s + Number(sc.fantasyPoints ?? 0), 0);
      const highScore = Math.max(...playerScores.map((sc) => sc.runs ?? 0));
      const bestBowling = Math.max(...playerScores.map((sc) => sc.wickets ?? 0));
      const bestFP = Math.max(...playerScores.map((sc) => Number(sc.fantasyPoints ?? 0)));

      // Form: last 3 matches avg fantasy points
      const recent = playerScores.slice(-3);
      const formAvg = recent.length > 0
        ? recent.reduce((s, sc) => s + Number(sc.fantasyPoints ?? 0), 0) / recent.length
        : 0;

      statsMap.set(p.id, {
        playerId: p.id,
        playerName: p.name,
        team: p.team,
        role: p.role ?? "unknown",
        source: "match",
        matches: matchCount,
        totalRuns,
        avgRuns: matchCount > 0 ? round(totalRuns / matchCount) : 0,
        highScore,
        totalFours: playerScores.reduce((s, sc) => s + (sc.fours ?? 0), 0),
        totalSixes: playerScores.reduce((s, sc) => s + (sc.sixes ?? 0), 0),
        strikeRate: totalBallsFaced > 0 ? round((totalRuns / totalBallsFaced) * 100) : 0,
        totalWickets,
        avgWickets: matchCount > 0 ? round(totalWickets / matchCount) : 0,
        bestBowling,
        economyRate: totalOvers > 0 ? round(totalRunsConceded / totalOvers) : 0,
        totalCatches,
        totalStumpings,
        totalRunOuts,
        totalFantasyPoints: round(totalFP),
        avgFantasyPoints: matchCount > 0 ? round(totalFP / matchCount) : 0,
        bestFantasyPoints: round(bestFP),
        formAvg: round(formAvg),
      });
    }

    let result = Array.from(statsMap.values());

    // Sort
    const key = sortBy as keyof PlayerStatRow;
    result.sort((a, b) => {
      const va = (a[key] ?? 0) as number;
      const vb = (b[key] ?? 0) as number;
      return sortDir === "desc" ? vb - va : va - vb;
    });

    await setHotCache(cacheKey, result, 1800);
    return result;
  } catch (err) {
    log.error({ err }, "Failed to get player stats");
    return [];
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
