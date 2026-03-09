#!/usr/bin/env npx tsx
import "dotenv/config";
import postgres from "postgres";
import Redis from "ioredis";

const DB_URL = process.env.DATABASE_URL || "postgresql://postgres:Dreamproject@34.57.117.132:5432/draftplay";

async function main() {
  const sql = postgres(DB_URL);

  const counts = await sql`SELECT (SELECT count(*) FROM tournaments) as t, (SELECT count(*) FROM matches) as m, (SELECT count(*) FROM players) as p`;
  console.log("Counts:", counts[0]);

  const logs = await sql`SELECT id, status, trigger, duration_ms, records_upserted, error_message, created_at FROM data_refresh_log ORDER BY created_at DESC LIMIT 5`;
  console.log("\nRecent refresh logs:");
  logs.forEach((l: any) => console.log(JSON.stringify(l)));

  // Check for stuck in_progress entries
  const stuck = await sql`SELECT count(*) as c FROM data_refresh_log WHERE status = 'in_progress'`;
  console.log("\nStuck in_progress entries:", stuck[0].c);

  await sql.end();

  // Check Redis locks
  try {
    const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
    const locks = await redis.keys("refresh_lock:*");
    console.log("\nRedis refresh locks:", locks);
    const dashKeys = await redis.keys("dashboard:*");
    console.log("Redis dashboard cache keys:", dashKeys);
    if (locks.length > 0) {
      for (const k of locks) {
        const ttl = await redis.ttl(k);
        console.log(`  ${k} TTL: ${ttl}s`);
      }
    }
    redis.disconnect();
  } catch (e: any) {
    console.log("Redis:", e.message);
  }
}

main().catch(console.error);
