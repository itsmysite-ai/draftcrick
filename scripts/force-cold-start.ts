#!/usr/bin/env npx tsx
/**
 * Force a true cold start: clear ALL data and Redis, then trigger dashboard.
 * Watches server logs for player fetch completion.
 */
import "dotenv/config";
import postgres from "postgres";
import Redis from "ioredis";

const DB_URL = process.env.DATABASE_URL || "postgresql://postgres:Dreamproject@34.57.117.132:5432/draftplay";
const API_BASE = process.env.API_URL ?? "http://localhost:3001";

async function main() {
  // Safety: require explicit --confirm flag to prevent accidental execution
  if (!process.argv.includes("--confirm")) {
    console.log("⚠️  This script DELETES ALL data (tournaments, matches, players), flushes Redis, and triggers a cold-start dashboard refresh.");
    console.log("   Run with --confirm to proceed:");
    console.log("   npx tsx scripts/force-cold-start.ts --confirm");
    process.exit(1);
  }

  const sql = postgres(DB_URL);

  // 1. TRUNCATE everything
  console.log("1. Clearing all sports data...");
  await sql.unsafe("TRUNCATE tournaments, matches, players CASCADE");
  await sql`DELETE FROM data_refresh_log`;
  console.log("   Done - all tables empty");

  // 2. Clear Redis completely
  try {
    const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
    await redis.flushall();
    console.log("   Redis flushed");
    redis.disconnect();
  } catch (e: any) {
    console.log("   Redis:", e.message);
  }

  // Verify empty
  const before = await sql`SELECT (SELECT count(*) FROM tournaments) as t, (SELECT count(*) FROM matches) as m, (SELECT count(*) FROM players) as p`;
  console.log(`   Before: ${before[0].t}T, ${before[0].m}M, ${before[0].p}P`);

  // 3. Trigger dashboard - this should be a TRUE cold start
  console.log("\n2. Triggering cold start via sports.dashboard...");
  const url = `${API_BASE}/trpc/sports.dashboard?input=${encodeURIComponent(JSON.stringify({ json: { sport: "cricket" } }))}`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    const dashboard = data?.result?.data?.json;
    console.log(`   Response: ${dashboard?.tournaments?.length ?? 0} tournaments, ${dashboard?.matches?.length ?? 0} matches`);
  } catch (e: any) {
    console.log("   API error:", e.message);
  }

  // 4. Wait and poll for player data
  console.log("\n3. Waiting for player fetch to complete...");
  for (let i = 0; i < 12; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const counts = await sql`SELECT (SELECT count(*) FROM players) as p`;
    const logs = await sql`SELECT status, records_upserted, error_message, duration_ms FROM data_refresh_log ORDER BY created_at DESC LIMIT 1`;
    const log = logs[0];
    console.log(`   [${(i+1)*5}s] Players: ${counts[0].p} | Refresh: ${log?.status ?? 'none'} (${log?.records_upserted ?? 0} records, ${log?.duration_ms ?? '?'}ms) ${log?.error_message ? '❌ ' + log.error_message : ''}`);

    if (log?.status === 'success' || log?.status === 'failed') {
      break;
    }
  }

  // 5. Final check
  const after = await sql`SELECT (SELECT count(*) FROM tournaments) as t, (SELECT count(*) FROM matches) as m, (SELECT count(*) FROM players) as p`;
  console.log(`\n4. Final: ${after[0].t} tournaments, ${after[0].m} matches, ${after[0].p} players`);

  await sql.end();
}

main().catch(console.error);
