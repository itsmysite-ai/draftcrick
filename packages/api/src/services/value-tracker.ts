import { eq, sql, inArray, desc } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { getFromHotCache, setHotCache } from "./sports-cache";
import { getLogger } from "../lib/logger";

const log = getLogger("value-tracker");

export interface PlayerValueEntry {
  playerId: string;
  playerName: string;
  team: string;
  role: string;
  currentPrice: number;
  priceChange: number;
  netTransfers: number;
  transferInCount: number;
  transferOutCount: number;
  ownershipPct: number;
  trend: "rising" | "falling" | "stable";
}

/**
 * Get player value/price changes for a match.
 * Uses playerOwnership table if data exists, otherwise computes from contest team data.
 */
export async function getValueTracker(
  db: NodePgDatabase<any>,
  matchId: string,
  teamA: string,
  teamB: string,
): Promise<PlayerValueEntry[]> {
  const cacheKey = `value-tracker:${matchId}`;
  const cached = await getFromHotCache<PlayerValueEntry[]>(cacheKey);
  if (cached) return cached;

  try {
    const { players, playerMatchScores, fantasyTeams } = await import("@draftplay/db");

    // Get players from both teams
    const teamPlayers = await db
      .select()
      .from(players)
      .where(
        sql`lower(${players.team}) IN (${teamA.toLowerCase()}, ${teamB.toLowerCase()})`,
      );

    if (teamPlayers.length === 0) return [];

    // Try playerOwnership table first
    try {
      const { playerOwnership } = await import("@draftplay/db");
      const ownership = await db
        .select()
        .from(playerOwnership)
        .where(eq(playerOwnership.matchId, matchId));

      if (ownership.length > 0) {
        const playerMap = new Map(teamPlayers.map((p) => [p.id, p]));
        const result: PlayerValueEntry[] = ownership.map((o) => {
          const player = playerMap.get(o.playerId);
          const change = Number(o.priceChange ?? 0);
          return {
            playerId: o.playerId,
            playerName: player?.name ?? "Unknown",
            team: player?.team ?? "",
            role: player?.role ?? "unknown",
            currentPrice: Number(o.currentPrice ?? 0),
            priceChange: change,
            netTransfers: o.netTransfers ?? 0,
            transferInCount: o.transferInCount ?? 0,
            transferOutCount: o.transferOutCount ?? 0,
            ownershipPct: Number(o.overallOwnershipPct ?? 0),
            trend: change > 0 ? "rising" : change < 0 ? "falling" : "stable",
          };
        });

        result.sort((a, b) => Math.abs(b.priceChange) - Math.abs(a.priceChange));
        await setHotCache(cacheKey, result, 1800);
        return result;
      }
    } catch {
      // Table may not exist yet, fall through to computed data
    }

    // Fallback: compute ownership from fantasyTeams
    const teams = await db
      .select()
      .from(fantasyTeams)
      .where(eq(fantasyTeams.matchId, matchId));

    const totalTeams = teams.length;
    if (totalTeams === 0) {
      // Return base player data with no ownership
      const result: PlayerValueEntry[] = teamPlayers.map((p) => {
        const credits = getCreditsFromStats(p.stats);
        return {
          playerId: p.id,
          playerName: p.name,
          team: p.team,
          role: p.role ?? "unknown",
          currentPrice: credits,
          priceChange: 0,
          netTransfers: 0,
          transferInCount: 0,
          transferOutCount: 0,
          ownershipPct: 0,
          trend: "stable" as const,
        };
      });
      await setHotCache(cacheKey, result, 1800);
      return result;
    }

    // Count selections per player
    const selectionCounts = new Map<string, number>();
    for (const t of teams) {
      const playerList = (t.players as any[]) ?? [];
      for (const p of playerList) {
        const pid = p.playerId ?? p.id;
        if (pid) selectionCounts.set(pid, (selectionCounts.get(pid) ?? 0) + 1);
      }
    }

    const result: PlayerValueEntry[] = teamPlayers.map((p) => {
      const count = selectionCounts.get(p.id) ?? 0;
      const pct = totalTeams > 0 ? round((count / totalTeams) * 100) : 0;
      const credits = getCreditsFromStats(p.stats);
      return {
        playerId: p.id,
        playerName: p.name,
        team: p.team,
        role: p.role ?? "unknown",
        currentPrice: credits,
        priceChange: 0,
        netTransfers: 0,
        transferInCount: count,
        transferOutCount: 0,
        ownershipPct: pct,
        trend: "stable" as const,
      };
    });

    result.sort((a, b) => b.ownershipPct - a.ownershipPct);
    await setHotCache(cacheKey, result, 1800);
    return result;
  } catch (err) {
    log.error({ err }, "Failed to get value tracker");
    return [];
  }
}

function getCreditsFromStats(stats: any): number {
  if (!stats) return 8;
  if (typeof stats === "object" && "credits" in stats) return Number(stats.credits) || 8;
  return 8;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
