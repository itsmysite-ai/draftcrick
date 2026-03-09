#!/usr/bin/env npx tsx
/**
 * Clear all sports data from PostgreSQL and Redis.
 * Usage: cd packages/api && npx tsx ../../scripts/clear-sports-data.ts
 */
import "dotenv/config";
import postgres from "postgres";
import Redis from "ioredis";

const DB_URL = process.env.DATABASE_URL || "postgresql://postgres:Dreamproject@34.57.117.132:5432/draftplay";
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

async function tryDelete(sql: any, table: string) {
  try {
    await sql.unsafe(`DELETE FROM ${table}`);
    console.log(`  Deleted ${table}`);
  } catch (err: any) {
    console.log(`  ${table}: skipped (${err.message?.slice(0, 80)})`);
  }
}

async function main() {
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

  await sql.end();

  console.log("\nClearing Redis sports cache...");
  try {
    const redis = new Redis(REDIS_URL);
    const keys = await redis.keys("dashboard:*");
    if (keys.length > 0) { await redis.del(...keys); console.log(`  Deleted ${keys.length} Redis keys`); }
    else { console.log("  No dashboard cache keys"); }
    const locks = await redis.keys("refresh_lock:*");
    if (locks.length > 0) { await redis.del(...locks); console.log(`  Deleted ${locks.length} lock keys`); }
    redis.disconnect();
  } catch (err: any) {
    console.log(`  Redis: ${err.message}`);
  }

  console.log("\n✓ All sports data cleared. Next dashboard request triggers fresh Gemini fetch.");
}

main().catch(console.error);
