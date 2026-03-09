#!/usr/bin/env npx tsx
/**
 * Fix stuck refresh entries and clear stale state so a fresh cold start can succeed.
 */
import "dotenv/config";
import postgres from "postgres";
import Redis from "ioredis";

const DB_URL = process.env.DATABASE_URL || "postgresql://postgres:Dreamproject@34.57.117.132:5432/draftplay";

async function main() {
  const sql = postgres(DB_URL);

  // 1. Fix stuck in_progress entries
  const fixed = await sql`UPDATE data_refresh_log SET status = 'failed', error_message = 'manually cleaned up', completed_at = NOW() WHERE status = 'in_progress' RETURNING id`;
  console.log(`Fixed ${fixed.length} stuck refresh log entries`);

  // 2. Clear all Redis state
  try {
    const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
    const allKeys = await redis.keys("*");
    if (allKeys.length > 0) {
      await redis.del(...allKeys);
      console.log(`Cleared ${allKeys.length} Redis keys`);
    } else {
      console.log("Redis already empty");
    }
    redis.disconnect();
  } catch (e: any) {
    console.log("Redis:", e.message);
  }

  await sql.end();
  console.log("\nDone. Next API call will trigger a fresh cold start refresh.");
}

main().catch(console.error);
