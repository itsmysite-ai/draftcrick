import { and, eq, inArray } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { getScoringRulesForFormat } from "@draftplay/shared";
import { getFromHotCache, setHotCache } from "./sports-cache";
import { getLogger } from "../lib/logger";

const log = getLogger("points-breakdown");

export interface PointsCategory {
  category: string;
  label: string;
  stat: string;
  points: number;
}

export interface PlayerPointsBreakdown {
  playerId: string;
  playerName: string;
  team: string;
  role: string;
  photoUrl: string | null;
  totalFantasyPoints: number;
  categories: PointsCategory[];
}

/**
 * Get detailed fantasy points breakdown for all players in a match.
 * Shows exactly how each scoring rule contributed to a player's total.
 */
export async function getPointsBreakdownForMatch(
  db: NodePgDatabase<any>,
  matchId: string,
  format: string,
): Promise<PlayerPointsBreakdown[]> {
  const cacheKey = `pts-breakdown:${matchId}`;
  const cached = await getFromHotCache<PlayerPointsBreakdown[]>(cacheKey);
  if (cached) return cached;

  try {
    const { playerMatchScores, players } = await import("@draftplay/db");

    const scores = await db
      .select()
      .from(playerMatchScores)
      .where(eq(playerMatchScores.matchId, matchId));

    if (scores.length === 0) return [];

    const playerIds = scores.map((s) => s.playerId);
    const playerRecords = await db
      .select()
      .from(players)
      .where(inArray(players.id, playerIds));

    const playerMap = new Map(playerRecords.map((p) => [p.id, p]));
    const formatKey = format.toLowerCase() as "t20" | "odi" | "test";
    const rules = getScoringRulesForFormat(
      formatKey === "t20" || formatKey === "odi" || formatKey === "test" ? formatKey : "t20",
    );

    const result: PlayerPointsBreakdown[] = scores.map((sc) => {
      const player = playerMap.get(sc.playerId);
      const categories: PointsCategory[] = [];

      // Batting
      const runPts = (sc.runs ?? 0) * (rules.runPoints ?? 1);
      if (runPts > 0) categories.push({ category: "batting", label: "Runs", stat: `${sc.runs}`, points: runPts });

      const fourPts = (sc.fours ?? 0) * (rules.boundaryBonus ?? 1);
      if (fourPts > 0) categories.push({ category: "batting", label: "Fours", stat: `${sc.fours}`, points: fourPts });

      const sixPts = (sc.sixes ?? 0) * (rules.sixBonus ?? 2);
      if (sixPts > 0) categories.push({ category: "batting", label: "Sixes", stat: `${sc.sixes}`, points: sixPts });

      if ((sc.runs ?? 0) >= 100) {
        categories.push({ category: "batting", label: "Century", stat: "100+", points: rules.centuryBonus ?? 50 });
      } else if ((sc.runs ?? 0) >= 50) {
        categories.push({ category: "batting", label: "Half Century", stat: "50+", points: rules.halfCenturyBonus ?? 20 });
      }

      if ((sc.runs ?? 0) === 0 && (sc.ballsFaced ?? 0) > 0) {
        categories.push({ category: "batting", label: "Duck", stat: "0(x)", points: rules.duckPenalty ?? -5 });
      }

      // Strike rate bonus
      if ((sc.ballsFaced ?? 0) >= 10 && rules.strikeRateBonus) {
        const sr = ((sc.runs ?? 0) / (sc.ballsFaced ?? 1)) * 100;
        for (const bonus of rules.strikeRateBonus) {
          if (sr >= bonus.threshold) {
            categories.push({ category: "batting", label: "Strike Rate", stat: `${sr.toFixed(1)}`, points: bonus.points });
            break;
          }
        }
      }

      // Bowling
      const wicketPts = (sc.wickets ?? 0) * (rules.wicketPoints ?? 25);
      if (wicketPts > 0) categories.push({ category: "bowling", label: "Wickets", stat: `${sc.wickets}`, points: wicketPts });

      const maidenPts = (sc.maidens ?? 0) * (rules.maidenOverPoints ?? 15);
      if (maidenPts > 0) categories.push({ category: "bowling", label: "Maidens", stat: `${sc.maidens}`, points: maidenPts });

      if ((sc.wickets ?? 0) >= 5) {
        categories.push({ category: "bowling", label: "5-Wicket Haul", stat: `${sc.wickets}w`, points: rules.fiveWicketBonus ?? 30 });
      } else if ((sc.wickets ?? 0) >= 3) {
        categories.push({ category: "bowling", label: "3-Wicket Haul", stat: `${sc.wickets}w`, points: rules.threeWicketBonus ?? 15 });
      }

      // Economy rate bonus
      if (Number(sc.oversBowled ?? 0) >= 2 && rules.economyRateBonus) {
        const er = (sc.runsConceded ?? 0) / Number(sc.oversBowled ?? 1);
        for (const bonus of rules.economyRateBonus) {
          if (er <= bonus.threshold) {
            categories.push({ category: "bowling", label: "Economy Rate", stat: `${er.toFixed(2)}`, points: bonus.points });
            break;
          }
        }
      }

      // Fielding
      const catchPts = (sc.catches ?? 0) * (rules.catchPoints ?? 10);
      if (catchPts > 0) categories.push({ category: "fielding", label: "Catches", stat: `${sc.catches}`, points: catchPts });

      const stumpPts = (sc.stumpings ?? 0) * (rules.stumpingPoints ?? 15);
      if (stumpPts > 0) categories.push({ category: "fielding", label: "Stumpings", stat: `${sc.stumpings}`, points: stumpPts });

      const roPts = (sc.runOuts ?? 0) * (rules.runOutDirectPoints ?? 15);
      if (roPts > 0) categories.push({ category: "fielding", label: "Run Outs", stat: `${sc.runOuts}`, points: roPts });

      const totalCalc = categories.reduce((s, c) => s + c.points, 0);

      return {
        playerId: sc.playerId,
        playerName: player?.name ?? "Unknown",
        team: player?.team ?? "",
        role: player?.role ?? "unknown",
        photoUrl: (player as any)?.photoUrl ?? null,
        totalFantasyPoints: Number(sc.fantasyPoints ?? totalCalc),
        categories,
      };
    });

    // Sort by total points descending
    result.sort((a, b) => b.totalFantasyPoints - a.totalFantasyPoints);

    await setHotCache(cacheKey, result, 3600);
    return result;
  } catch (err) {
    log.error({ err }, "Failed to get points breakdown");
    return [];
  }
}
