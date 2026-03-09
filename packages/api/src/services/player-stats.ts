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
 * Uses playerMatchScores for historical data.
 */
export async function getPlayerStatsForMatch(
  db: NodePgDatabase<any>,
  teamA: string,
  teamB: string,
  tournament: string,
  sortBy: string = "avgFantasyPoints",
  sortDir: "asc" | "desc" = "desc",
): Promise<PlayerStatRow[]> {
  const cacheKey = `player-stats:${teamA}:${teamB}:${sortBy}:${sortDir}`;
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

    // Get all match scores for these players
    const scores = await db
      .select()
      .from(playerMatchScores)
      .where(inArray(playerMatchScores.playerId, playerIds));

    // Aggregate per player
    const statsMap = new Map<string, PlayerStatRow>();

    for (const p of teamPlayers) {
      const playerScores = scores.filter((s) => s.playerId === p.id);
      if (playerScores.length === 0) {
        statsMap.set(p.id, {
          playerId: p.id,
          playerName: p.name,
          team: p.team,
          role: p.role ?? "unknown",
          matches: 0,
          totalRuns: 0, avgRuns: 0, highScore: 0,
          totalFours: 0, totalSixes: 0, strikeRate: 0,
          totalWickets: 0, avgWickets: 0, bestBowling: 0, economyRate: 0,
          totalCatches: 0, totalStumpings: 0, totalRunOuts: 0,
          totalFantasyPoints: 0, avgFantasyPoints: 0, bestFantasyPoints: 0,
          formAvg: 0,
        });
        continue;
      }

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
