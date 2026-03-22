#!/usr/bin/env npx tsx
/**
 * Clear all user-created contest data (leagues, contests, fantasy_teams, league_members).
 * Usage: npx tsx scripts/clear-user-data.ts
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });
dotenv.config({ override: false });
import postgres from "postgres";

const DB_URL = process.env.DATABASE_URL || "postgresql://chandanreddy@localhost:5432/draftplay_local";

async function main() {
  // Safety: require explicit --confirm flag to prevent accidental execution
  if (!process.argv.includes("--confirm")) {
    console.log("⚠️  This script DELETES all user contest data (leagues, contests, fantasy_teams, league_members).");
    console.log("   Run with --confirm to proceed:");
    console.log("   npx tsx scripts/clear-user-data.ts --confirm");
    process.exit(1);
  }

  const sql = postgres(DB_URL, { max: 1 });

  // First, show what exists
  console.log("\n=== Current data ===");
  const leagues = await sql`SELECT id, name, created_at FROM leagues`;
  console.log(`Leagues (${leagues.length}):`, leagues.map((l: any) => `${l.name} (${l.id.slice(0,8)})`));

  const contests = await sql`SELECT id, name, contest_type, status, match_id FROM contests`;
  console.log(`Contests (${contests.length}):`, contests.map((c: any) => `${c.name} [${c.contest_type}/${c.status}] (${c.id.slice(0,8)})`));

  const teams = await sql`SELECT id, name, user_id, contest_id FROM fantasy_teams`;
  console.log(`Fantasy teams (${teams.length}):`, teams.map((t: any) => `${t.name || 'unnamed'} (${t.id.slice(0,8)})`));

  const members = await sql`SELECT count(*) as cnt FROM league_members`;
  console.log(`League members: ${members[0].cnt}`);

  // Delete in correct order (child → parent due to foreign keys)
  console.log("\n=== Deleting... ===");

  const ftDel = await sql`DELETE FROM fantasy_teams RETURNING id`;
  console.log(`  Deleted ${ftDel.length} fantasy_teams`);

  const cDel = await sql`DELETE FROM contests RETURNING id`;
  console.log(`  Deleted ${cDel.length} contests`);

  await sql`DELETE FROM league_members`;
  console.log(`  Deleted league_members`);

  const lDel = await sql`DELETE FROM leagues RETURNING id`;
  console.log(`  Deleted ${lDel.length} leagues`);

  console.log("\nDone!");
  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
