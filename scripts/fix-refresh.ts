#!/usr/bin/env npx tsx
/**
 * Fix stuck refresh entries and clear stale cache so a fresh cold start can succeed.
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import postgres from "postgres";

const DB_URL = process.env.DATABASE_URL || "postgresql://postgres:Dreamproject@34.57.117.132:5432/draftplay";

async function main() {
  const sql = postgres(DB_URL);

  // 1. Fix stuck in_progress entries
  const fixed = await sql`UPDATE data_refresh_log SET status = 'failed', error_message = 'manually cleaned up', completed_at = NOW() WHERE status = 'in_progress' RETURNING id`;
  console.log(`Fixed ${fixed.length} stuck refresh log entries`);

  // 2. Clear all cache entries (including stale locks)
  try {
    const result = await sql`DELETE FROM cache_entries`;
    console.log("Cleared all cache entries");
  } catch (e: any) {
    console.log("Cache clear:", e.message);
  }

  await sql.end();
  console.log("\nDone. Next API call will trigger a fresh cold start refresh.");
}

main().catch(console.error);
