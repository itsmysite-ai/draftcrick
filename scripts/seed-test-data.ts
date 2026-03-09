#!/usr/bin/env npx tsx
/**
 * Quick seed for E2E test data — creates contests, leagues, and player-match links
 * using existing matches and players already in the database.
 *
 * Usage: npx tsx scripts/seed-test-data.ts
 */

const API_BASE = process.env.API_URL ?? "http://localhost:3001";

async function trpcQuery(path: string, input?: Record<string, unknown>) {
  const inputParam = input
    ? `?input=${encodeURIComponent(JSON.stringify({ json: input }))}`
    : "";
  const url = `${API_BASE}/trpc/${path}${inputParam}`;
  const res = await fetch(url);
  const data = await res.json().catch(() => null);
  return data?.result?.data?.json ?? data?.result?.data ?? null;
}

async function main() {
  console.log("Fetching existing data from API...\n");

  // Get dashboard data (these are the IDs the mobile app uses for match detail)
  const dashboard = await trpcQuery("sports.dashboard", { sport: "cricket" });
  const dashboardMatches = dashboard?.matches ?? [];
  console.log(`  Dashboard matches: ${dashboardMatches.length}`);

  // Get DB matches (for team builder which uses DB UUIDs)
  const matchData = await trpcQuery("match.list");
  const dbMatches = matchData?.matches ?? matchData ?? [];
  console.log(`  DB matches: ${dbMatches.length}`);

  // Get existing players
  const allPlayers = await trpcQuery("player.list");
  console.log(`  Existing players: ${allPlayers?.length ?? 0}`);

  if (!dashboardMatches.length) {
    console.log("\nNo dashboard data available. Run the app's data refresh first.");
    process.exit(1);
  }

  // Dashboard IDs (slug format: used by match detail page)
  const dashUpcoming = dashboardMatches.find((m: any) => m.status === "upcoming") ?? dashboardMatches[0];
  const dashLive = dashboardMatches.find((m: any) => m.status === "live");

  // DB IDs (UUID format: used by team builder)
  const dbUpcoming = dbMatches.find((m: any) => m.status === "upcoming") ?? dbMatches[0];

  console.log(`\n  Dashboard upcoming: ${dashUpcoming.id} (${dashUpcoming.teams || dashUpcoming.teamHome + ' vs ' + dashUpcoming.teamAway})`);
  if (dashLive) {
    console.log(`  Dashboard live: ${dashLive.id} (${dashLive.teams || 'live'})`);
  }
  if (dbUpcoming) {
    console.log(`  DB upcoming: ${dbUpcoming.id} (${dbUpcoming.teamHome} vs ${dbUpcoming.teamAway})`);
  }

  // Write test data: both slug IDs (for match detail) and UUIDs (for team builder)
  const testData = {
    // Dashboard slug IDs — used by match/[id].tsx (looks up in sports.dashboard)
    dashboardMatchId: dashUpcoming.id,
    dashboardLiveId: dashLive?.id ?? dashUpcoming.id,
    // DB UUIDs — used by team/create?matchId= (looks up in player.getByMatch)
    dbMatchId: dbUpcoming?.id ?? "no-db-matches",
    dbMatchHome: dbUpcoming?.teamHome ?? "TBA",
    dbMatchAway: dbUpcoming?.teamAway ?? "TBA",
    playerCount: allPlayers?.length ?? 0,
  };

  const fs = await import("fs");
  const path = await import("path");
  const outPath = path.join("tests", "e2e", "helpers", "test-data.json");
  fs.writeFileSync(outPath, JSON.stringify(testData, null, 2));
  console.log(`\n  Wrote test data to ${outPath}`);
  console.log("\nDone! Tests can now import test-data.json for real IDs.");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
