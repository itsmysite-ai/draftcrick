#!/usr/bin/env npx tsx
/** Clear all sports data from PG and cache. Does NOT trigger a refresh. */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import postgres from "postgres";

const DB_URL = process.env.DATABASE_URL || "postgresql://postgres:Dreamproject@34.57.117.132:5432/draftplay";

async function main() {
  // Safety: require explicit --confirm flag to prevent accidental execution
  if (!process.argv.includes("--confirm")) {
    console.log("⚠️  This script DELETES all sports data from PG and clears cache.");
    console.log("   Run with --confirm to proceed:");
    console.log("   npx tsx scripts/clear-only.ts --confirm");
    process.exit(1);
  }

  const sql = postgres(DB_URL);
  await sql.unsafe("TRUNCATE tournaments, matches, players CASCADE");
  await sql`DELETE FROM data_refresh_log`;
  await sql`DELETE FROM cache_entries`;
  const c = await sql`SELECT (SELECT count(*) FROM tournaments) as t, (SELECT count(*) FROM matches) as m, (SELECT count(*) FROM players) as p`;
  console.log("DB and cache cleared:", c[0]);
  await sql.end();
  console.log("Ready for tests to trigger fresh cold start.");
}

main().catch(console.error);
