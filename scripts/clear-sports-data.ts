#!/usr/bin/env npx tsx
/**
 * Clear all sports data from PostgreSQL and cache.
 * Usage: npx tsx scripts/clear-sports-data.ts --confirm
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });
dotenv.config({ override: false });
import postgres from "postgres";

const DB_URL = process.env.DATABASE_URL || "postgresql://chandanreddy@localhost:5432/draftplay_local";

async function tryDelete(sql: any, table: string) {
  try {
    await sql.unsafe(`DELETE FROM ${table}`);
    console.log(`  Deleted ${table}`);
  } catch (err: any) {
    console.log(`  ${table}: skipped (${err.message?.slice(0, 80)})`);
  }
}

async function main() {
  // Safety: require explicit --confirm flag to prevent accidental execution
  if (!process.argv.includes("--confirm")) {
    console.log("⚠️  This script DELETES all tournaments, matches, players, and contest data.");
    console.log("   Run with --confirm to proceed:");
    console.log("   npx tsx scripts/clear-sports-data.ts --confirm");
    process.exit(1);
  }

  const sql = postgres(DB_URL);

  console.log("Clearing sports data from PostgreSQL...");

  const before = await sql`
    SELECT
      (SELECT count(*) FROM tournaments) as tournaments,
      (SELECT count(*) FROM matches) as matches,
      (SELECT count(*) FROM players) as players
  `;
  console.log(`  Before: ${before[0].tournaments} tournaments, ${before[0].matches} matches, ${before[0].players} players`);

  // TRUNCATE with CASCADE to handle all FK dependencies
  await sql.unsafe("TRUNCATE tournaments, matches, players CASCADE");
  console.log("  Truncated tournaments, matches, players (CASCADE)");
  await tryDelete(sql, "data_refresh_log");

  const after = await sql`
    SELECT
      (SELECT count(*) FROM tournaments) as tournaments,
      (SELECT count(*) FROM matches) as matches,
      (SELECT count(*) FROM players) as players
  `;
  console.log(`  After: ${after[0].tournaments} tournaments, ${after[0].matches} matches, ${after[0].players} players`);

  console.log("\nClearing PG cache...");
  await tryDelete(sql, "cache_entries");

  await sql.end();

  console.log("\n✓ All sports data cleared. Next dashboard request triggers fresh Gemini fetch.");
}

main().catch(console.error);
