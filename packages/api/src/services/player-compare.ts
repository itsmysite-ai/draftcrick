import { inArray } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { getFromHotCache, setHotCache } from "./sports-cache";
import { getLogger } from "../lib/logger";

const log = getLogger("player-compare");

export interface PlayerCompareProfile {
  playerId: string;
  name: string;
  team: string;
  role: string;
  matches: number;
  /** "match" = from playerMatchScores, "profile" = from Gemini player profile */
  source: "match" | "profile";
  // Batting
  avgRuns: number;
  strikeRate: number;
  highScore: number;
  fifties: number;
  hundreds: number;
  // Bowling
  avgWickets: number;
  economyRate: number;
  bestBowling: number;
  threeWicketHauls: number;
  // Fielding
  totalCatches: number;
  // Fantasy
  avgFantasyPoints: number;
  bestFantasyPoints: number;
  formLast3: number;
  consistency: number; // std deviation — lower = more consistent
}

/**
 * Compare 2-3 players side by side.
 * Uses real match data when available, falls back to Gemini profile stats.
 */
export async function comparePlayers(
  db: NodePgDatabase<any>,
  playerIds: string[],
): Promise<PlayerCompareProfile[]> {
  if (playerIds.length < 2 || playerIds.length > 3) return [];

  const cacheKey = `player-compare:v2:${[...playerIds].sort().join(",")}`;
  const cached = await getFromHotCache<PlayerCompareProfile[]>(cacheKey);
  if (cached) return cached;

  try {
    const { players, playerMatchScores } = await import("@draftplay/db");

    const playerRecords = await db
      .select()
      .from(players)
      .where(inArray(players.id, playerIds));

    if (playerRecords.length < 2) return [];

    const allScores = await db
      .select()
      .from(playerMatchScores)
      .where(inArray(playerMatchScores.playerId, playerIds));

    // Filter out placeholder rows (linked but no actual match data)
    const realScores = allScores.filter((s) =>
      (s.runs ?? 0) > 0 || (s.wickets ?? 0) > 0 || (s.ballsFaced ?? 0) > 0 ||
      (s.catches ?? 0) > 0 || Number(s.fantasyPoints ?? 0) > 0 || Number(s.oversBowled ?? 0) > 0
    );

    const result: PlayerCompareProfile[] = playerRecords.map((p) => {
      const pScores = realScores.filter((s) => s.playerId === p.id);
      const gs = (p.stats as any) ?? {};

      if (pScores.length === 0) {
        // No real match data — use Gemini profile stats
        return {
          playerId: p.id,
          name: p.name,
          team: p.team,
          role: p.role ?? "unknown",
          source: "profile" as const,
          matches: gs.matchesPlayed ?? 0,
          avgRuns: round(gs.average ?? 0),
          strikeRate: round(gs.strikeRate ?? 0),
          highScore: 0,
          fifties: 0,
          hundreds: 0,
          avgWickets: round(gs.bowlingAverage ?? 0),
          economyRate: round(gs.economyRate ?? 0),
          bestBowling: 0,
          threeWicketHauls: 0,
          totalCatches: 0,
          avgFantasyPoints: round(gs.recentForm ?? 0),
          bestFantasyPoints: 0,
          formLast3: round(gs.recentForm ?? 0),
          consistency: 0,
        };
      }

      // Real match data
      const matchCount = pScores.length;
      const totalRuns = pScores.reduce((s, sc) => s + (sc.runs ?? 0), 0);
      const totalBalls = pScores.reduce((s, sc) => s + (sc.ballsFaced ?? 0), 0);
      const totalWickets = pScores.reduce((s, sc) => s + (sc.wickets ?? 0), 0);
      const totalOvers = pScores.reduce((s, sc) => s + Number(sc.oversBowled ?? 0), 0);
      const totalRunsConceded = pScores.reduce((s, sc) => s + (sc.runsConceded ?? 0), 0);
      const totalCatches = pScores.reduce((s, sc) => s + (sc.catches ?? 0), 0);
      const fps = pScores.map((sc) => Number(sc.fantasyPoints ?? 0));
      const totalFP = fps.reduce((s, v) => s + v, 0);
      const avgFP = matchCount > 0 ? totalFP / matchCount : 0;

      const variance = matchCount > 0
        ? fps.reduce((s, v) => s + (v - avgFP) ** 2, 0) / matchCount
        : 0;

      const recent = pScores.slice(-3);
      const formLast3 = recent.length > 0
        ? recent.reduce((s, sc) => s + Number(sc.fantasyPoints ?? 0), 0) / recent.length
        : 0;

      return {
        playerId: p.id,
        name: p.name,
        team: p.team,
        role: p.role ?? "unknown",
        source: "match" as const,
        matches: matchCount,
        avgRuns: matchCount > 0 ? round(totalRuns / matchCount) : 0,
        strikeRate: totalBalls > 0 ? round((totalRuns / totalBalls) * 100) : 0,
        highScore: matchCount > 0 ? Math.max(...pScores.map((sc) => sc.runs ?? 0)) : 0,
        fifties: pScores.filter((sc) => (sc.runs ?? 0) >= 50 && (sc.runs ?? 0) < 100).length,
        hundreds: pScores.filter((sc) => (sc.runs ?? 0) >= 100).length,
        avgWickets: matchCount > 0 ? round(totalWickets / matchCount) : 0,
        economyRate: totalOvers > 0 ? round(totalRunsConceded / totalOvers) : 0,
        bestBowling: matchCount > 0 ? Math.max(...pScores.map((sc) => sc.wickets ?? 0)) : 0,
        threeWicketHauls: pScores.filter((sc) => (sc.wickets ?? 0) >= 3).length,
        totalCatches,
        avgFantasyPoints: round(avgFP),
        bestFantasyPoints: matchCount > 0 ? round(Math.max(...fps)) : 0,
        formLast3: round(formLast3),
        consistency: round(Math.sqrt(variance)),
      };
    });

    await setHotCache(cacheKey, result, 3600);
    return result;
  } catch (err) {
    log.error({ err }, "Failed to compare players");
    return [];
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
