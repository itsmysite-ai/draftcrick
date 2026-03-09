#!/usr/bin/env npx tsx
/** Clear all sports data from PG and Redis. Does NOT trigger a refresh. */
import "dotenv/config";
import postgres from "postgres";
import Redis from "ioredis";

const DB_URL = process.env.DATABASE_URL || "postgresql://postgres:Dreamproject@34.57.117.132:5432/draftplay";

async function main() {
  const sql = postgres(DB_URL);
  await sql.unsafe("TRUNCATE tournaments, matches, players CASCADE");
  await sql`DELETE FROM data_refresh_log`;
  const c = await sql`SELECT (SELECT count(*) FROM tournaments) as t, (SELECT count(*) FROM matches) as m, (SELECT count(*) FROM players) as p`;
  console.log("DB cleared:", c[0]);
  await sql.end();

  try {
    const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
    await redis.flushall();
    console.log("Redis flushed");
    redis.disconnect();
  } catch (e: any) {
    console.log("Redis:", e.message);
  }
  console.log("Ready for tests to trigger fresh cold start.");
}

main().catch(console.error);
