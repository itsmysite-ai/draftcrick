import { getDb } from "../packages/db/src/index";
import { matches, playerMatchScores, players } from "../packages/db/src/schema";
import { eq } from "drizzle-orm";

async function main() {
  const db = getDb();
  const liveMatches = await db
    .select({
      id: matches.id,
      externalId: matches.externalId,
      teamHome: matches.teamHome,
      teamAway: matches.teamAway,
      status: matches.status,
      scoreSummary: matches.scoreSummary,
    })
    .from(matches)
    .where(eq(matches.status, "live"));

  console.log("Live matches:", JSON.stringify(liveMatches, null, 2));

  if (liveMatches.length > 0) {
    const matchId = liveMatches[0].id;
    const scores = await db.select().from(playerMatchScores).where(eq(playerMatchScores.matchId, matchId));
    console.log("\nTotal player_match_scores rows:", scores.length);
    const withPoints = scores.filter((s) => Number(s.fantasyPoints) > 0);
    console.log("Players with fantasyPoints > 0:", withPoints.length);

    const playerRows = await db
      .select({ id: players.id, name: players.name })
      .from(players)
      .where(eq(players.isDisabled, false));
    const nameMap = new Map(playerRows.map((p) => [p.id, p.name]));

    if (withPoints.length > 0) {
      console.log("\nTop scorers:");
      const sorted = withPoints.sort((a, b) => Number(b.fantasyPoints) - Number(a.fantasyPoints));
      for (const s of sorted.slice(0, 15)) {
        console.log(
          `  ${(nameMap.get(s.playerId) || s.playerId).padEnd(25)} runs=${String(s.runs).padStart(3)} wkts=${s.wickets} catches=${s.catches} fp=${s.fantasyPoints}`
        );
      }
    } else {
      console.log("\nNo player scores yet. First 5 rows:");
      for (const s of scores.slice(0, 5)) {
        console.log(`  ${nameMap.get(s.playerId) || s.playerId}: runs=${s.runs} fp=${s.fantasyPoints}`);
      }
    }
  }
  process.exit(0);
}
main();
