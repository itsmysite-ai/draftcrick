/**
 * Cleanup script: Reset matches, delete test users, delete all contests.
 * Usage: DATABASE_URL=postgresql://chandanreddy@localhost:5432/draftplay_local npx tsx scripts/cleanup-test-data.ts
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { getDb } from "../packages/db/src/index";
import { sql } from "drizzle-orm";

async function cleanup() {
  // Safety: require explicit --confirm flag to prevent accidental execution
  if (!process.argv.includes("--confirm")) {
    console.log("⚠️  This script RESETS all matches, DELETES test users and their data, and DELETES all contests.");
    console.log("   Run with --confirm to proceed:");
    console.log("   npx tsx scripts/cleanup-test-data.ts --confirm");
    process.exit(1);
  }

  const db = getDb();
  console.log("Starting cleanup...\n");

  // 1. Delete fantasy teams (references contests)
  const t1 = await db.execute(sql`DELETE FROM fantasy_teams`);
  console.log(`Fantasy teams deleted: ${t1.rowCount ?? 0}`);

  // 2. Delete H2H matchups (references contests)
  try {
    const t2 = await db.execute(sql`DELETE FROM h2h_matchups`);
    console.log(`H2H matchups deleted: ${t2.rowCount ?? 0}`);
  } catch { /* skip */ }

  // 3. Delete all contests
  const t3 = await db.execute(sql`DELETE FROM contests`);
  console.log(`Contests deleted: ${t3.rowCount ?? 0}`);

  // 4. Delete player match scores
  const t4 = await db.execute(sql`DELETE FROM player_match_scores`);
  console.log(`Player match scores deleted: ${t4.rowCount ?? 0}`);

  // 5. Delete player locks, ownership, projections
  for (const tbl of ["player_locks", "player_ownership", "player_projections", "player_statuses"]) {
    try {
      const r = await db.execute(sql`DELETE FROM ${sql.raw(tbl)}`);
      console.log(`${tbl} deleted: ${r.rowCount ?? 0}`);
    } catch { /* skip */ }
  }

  // 6. Reset all matches to upcoming/pre_match
  const t6 = await db.execute(
    sql`UPDATE matches SET status = 'upcoming', match_phase = 'pre_match', draft_enabled = true, result = NULL WHERE status != 'upcoming'`
  );
  console.log(`Matches reset: ${t6.rowCount ?? 0}`);

  // 7. Find and delete test users + their related data
  const testUsers = await db.execute(
    sql`SELECT id, email FROM users WHERE email LIKE '%@draftplay.test' OR email LIKE '%test%@draftplay%'`
  );
  console.log(`\nTest users found: ${(testUsers as any).length ?? testUsers.rows?.length ?? 0}`);

  const userCondition = sql`user_id IN (SELECT id FROM users WHERE email LIKE '%@draftplay.test' OR email LIKE '%test%@draftplay%')`;

  // Delete related data (FK order)
  for (const tbl of [
    "transactions", "wallets", "subscription_events", "subscriptions",
    "notifications", "notification_preferences", "push_device_tokens",
    "guru_conversations", "referrals", "user_profiles",
    "draft_picks", "league_members", "league_awards",
    "tournament_team_submissions", "tournament_trades",
    "prediction_answers", "prediction_standings",
    "chip_usage", "advance_team_queue",
  ]) {
    try {
      const r = await db.execute(sql`DELETE FROM ${sql.raw(tbl)} WHERE ${userCondition}`);
      if ((r.rowCount ?? 0) > 0) console.log(`  ${tbl} deleted: ${r.rowCount}`);
    } catch { /* table might not exist or no user_id column */ }
  }

  // Delete the test users themselves
  const uDel = await db.execute(
    sql`DELETE FROM users WHERE email LIKE '%@draftplay.test' OR email LIKE '%test%@draftplay%'`
  );
  console.log(`  Test users deleted: ${uDel.rowCount ?? 0}`);

  // Summary
  const users = await db.execute(sql`SELECT count(*) as cnt FROM users`);
  const matches = await db.execute(sql`SELECT count(*) as cnt FROM matches`);
  const contests = await db.execute(sql`SELECT count(*) as cnt FROM contests`);

  console.log("\n--- Remaining ---");
  console.log(`Users: ${(users as any)[0]?.cnt ?? users.rows?.[0]?.cnt}`);
  console.log(`Matches: ${(matches as any)[0]?.cnt ?? matches.rows?.[0]?.cnt}`);
  console.log(`Contests: ${(contests as any)[0]?.cnt ?? contests.rows?.[0]?.cnt}`);
  console.log("\nCleanup complete!");
  process.exit(0);
}

cleanup().catch((e) => {
  console.error("Cleanup failed:", e);
  process.exit(1);
});
