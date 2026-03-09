import { eq, sql, desc, inArray } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { getFromHotCache, setHotCache } from "./sports-cache";
import { getLogger } from "../lib/logger";

const log = getLogger("stat-topfives");

export interface TopFiveEntry {
  playerId: string;
  playerName: string;
  team: string;
  role: string;
  value: number;
  matches: number;
}

export interface StatTopFives {
  topRunScorers: TopFiveEntry[];
  topWicketTakers: TopFiveEntry[];
  topFantasyScorers: TopFiveEntry[];
  topSixHitters: TopFiveEntry[];
  topCatchers: TopFiveEntry[];
  mostConsistent: TopFiveEntry[]; // lowest std deviation in fantasy pts
}

/**
 * Get top 5 players in various categories for a tournament.
 * Aggregates across all matches in the tournament.
 */
export async function getStatTopFives(
  db: NodePgDatabase<any>,
  tournament: string,
): Promise<StatTopFives> {
  const cacheKey = `stat-top5:${tournament}`;
  const cached = await getFromHotCache<StatTopFives>(cacheKey);
  if (cached) return cached;

  try {
    const { matches, playerMatchScores, players } = await import("@draftplay/db");

    // Get all matches in this tournament
    const tournamentMatches = await db
      .select({ id: matches.id })
      .from(matches)
      .where(sql`lower(${matches.tournament}) = ${tournament.toLowerCase()}`);

    if (tournamentMatches.length === 0) {
      return emptyResult();
    }

    const matchIds = tournamentMatches.map((m) => m.id);

    // Get all player scores for these matches
    const scores = await db
      .select()
      .from(playerMatchScores)
      .where(inArray(playerMatchScores.matchId, matchIds));

    if (scores.length === 0) return emptyResult();

    // Get player info
    const playerIds = [...new Set(scores.map((s) => s.playerId))];
    const playerRecords = await db
      .select()
      .from(players)
      .where(inArray(players.id, playerIds));

    const playerMap = new Map(playerRecords.map((p) => [p.id, p]));

    // Aggregate per player
    const agg = new Map<string, {
      runs: number; wickets: number; fp: number; sixes: number; catches: number;
      fpList: number[]; matches: number;
    }>();

    for (const sc of scores) {
      const existing = agg.get(sc.playerId) ?? {
        runs: 0, wickets: 0, fp: 0, sixes: 0, catches: 0, fpList: [], matches: 0,
      };
      existing.runs += sc.runs ?? 0;
      existing.wickets += sc.wickets ?? 0;
      existing.fp += Number(sc.fantasyPoints ?? 0);
      existing.sixes += sc.sixes ?? 0;
      existing.catches += sc.catches ?? 0;
      existing.fpList.push(Number(sc.fantasyPoints ?? 0));
      existing.matches += 1;
      agg.set(sc.playerId, existing);
    }

    const toEntry = (pid: string, value: number): TopFiveEntry => {
      const p = playerMap.get(pid);
      return {
        playerId: pid,
        playerName: p?.name ?? "Unknown",
        team: p?.team ?? "",
        role: p?.role ?? "unknown",
        value: round(value),
        matches: agg.get(pid)?.matches ?? 0,
      };
    };

    const entries = Array.from(agg.entries());

    const topRunScorers = entries
      .sort((a, b) => b[1].runs - a[1].runs)
      .slice(0, 5)
      .map(([pid, d]) => toEntry(pid, d.runs));

    const topWicketTakers = entries
      .sort((a, b) => b[1].wickets - a[1].wickets)
      .slice(0, 5)
      .map(([pid, d]) => toEntry(pid, d.wickets));

    const topFantasyScorers = entries
      .sort((a, b) => b[1].fp - a[1].fp)
      .slice(0, 5)
      .map(([pid, d]) => toEntry(pid, d.fp));

    const topSixHitters = entries
      .sort((a, b) => b[1].sixes - a[1].sixes)
      .slice(0, 5)
      .map(([pid, d]) => toEntry(pid, d.sixes));

    const topCatchers = entries
      .sort((a, b) => b[1].catches - a[1].catches)
      .slice(0, 5)
      .map(([pid, d]) => toEntry(pid, d.catches));

    // Most consistent: min std deviation (min 2 matches)
    const consistencyEntries = entries
      .filter(([, d]) => d.matches >= 2)
      .map(([pid, d]) => {
        const avg = d.fp / d.matches;
        const variance = d.fpList.reduce((s, v) => s + (v - avg) ** 2, 0) / d.matches;
        return { pid, stdDev: Math.sqrt(variance), avg };
      })
      .sort((a, b) => a.stdDev - b.stdDev)
      .slice(0, 5);

    const mostConsistent = consistencyEntries.map((c) => toEntry(c.pid, c.avg));

    const result: StatTopFives = {
      topRunScorers,
      topWicketTakers,
      topFantasyScorers,
      topSixHitters,
      topCatchers,
      mostConsistent,
    };

    await setHotCache(cacheKey, result, 3600);
    return result;
  } catch (err) {
    log.error({ err }, "Failed to get stat top fives");
    return emptyResult();
  }
}

function emptyResult(): StatTopFives {
  return {
    topRunScorers: [],
    topWicketTakers: [],
    topFantasyScorers: [],
    topSixHitters: [],
    topCatchers: [],
    mostConsistent: [],
  };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
