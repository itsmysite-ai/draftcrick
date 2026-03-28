/**
 * Migration: Setup pg_cron jobs on production database.
 *
 * Prerequisites:
 *   - Cloud SQL flag `cloudsql.enable_pg_cron` must be `on`
 *   - Run as a user with superuser/cloudsqlsuperuser privileges
 *
 * Jobs:
 *   1. cache-cleanup    — every 5 min: delete expired cache entries
 *   2. chat-purge       — every hour: keep last 200 messages per match
 *   3. flag-cleanup     — every hour: delete expired feature flags
 *
 * Usage:
 *   DATABASE_URL=<prod-url> npx tsx scripts/migrate-pg-cron.ts
 *   DATABASE_URL=<prod-url> npx tsx scripts/migrate-pg-cron.ts --dry-run
 */

const isDryRun = process.argv.includes("--dry-run");

async function main() {
  const postgres = (await import("postgres")).default;
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("ERROR: DATABASE_URL not set");
    process.exit(1);
  }

  const sql = postgres(dbUrl);

  console.log(`\n=== pg_cron Migration ${isDryRun ? "(DRY RUN)" : ""} ===\n`);

  try {
    // 1. Create extension
    console.log("1. Creating pg_cron extension...");
    if (!isDryRun) {
      await sql`CREATE EXTENSION IF NOT EXISTS pg_cron`;
    }
    console.log("   ✓ pg_cron extension ready");

    // 2. Check existing jobs
    const existing = isDryRun ? [] : await sql`SELECT jobid, jobname, schedule FROM cron.job`;
    console.log(`\n   Existing jobs: ${existing.length}`);
    for (const j of existing) {
      console.log(`   - #${j.jobid} ${j.jobname}: ${j.schedule}`);
    }

    // 3. Schedule jobs (cron.schedule is idempotent by jobname)
    const jobs = [
      {
        name: "cache-cleanup",
        schedule: "*/5 * * * *",
        command: "DELETE FROM cache_entries WHERE expires_at < NOW()",
        description: "Clean expired cache entries (every 5 min)",
      },
      {
        name: "chat-purge",
        schedule: "0 * * * *",
        command: `DELETE FROM chat_messages WHERE id IN (
          SELECT id FROM (
            SELECT id, ROW_NUMBER() OVER (PARTITION BY match_id ORDER BY created_at DESC) as rn
            FROM chat_messages
          ) sub WHERE rn > 200
        )`,
        description: "Purge old chat messages, keep last 200 per match (hourly)",
      },
      {
        name: "flag-cleanup",
        schedule: "0 * * * *",
        command: "DELETE FROM feature_flags WHERE expires_at IS NOT NULL AND expires_at < NOW()",
        description: "Clean expired feature flags (hourly)",
      },
    ];

    console.log("\n2. Scheduling cron jobs...");
    for (const job of jobs) {
      const existingJob = existing.find((e: any) => e.jobname === job.name);
      if (existingJob) {
        console.log(`   SKIP: "${job.name}" already exists (#${existingJob.jobid})`);
        continue;
      }

      console.log(`   ADD: "${job.name}" — ${job.description}`);
      console.log(`         Schedule: ${job.schedule}`);
      if (!isDryRun) {
        await sql`SELECT cron.schedule(${job.name}, ${job.schedule}, ${job.command})`;
        console.log(`         ✓ Scheduled`);
      }
    }

    // 4. Verify
    if (!isDryRun) {
      console.log("\n3. Verification:");
      const allJobs = await sql`SELECT jobid, jobname, schedule, active FROM cron.job ORDER BY jobid`;
      for (const j of allJobs) {
        console.log(`   #${j.jobid} [${j.active ? "ACTIVE" : "INACTIVE"}] ${j.jobname}: ${j.schedule}`);
      }
    }

    console.log(`\n=== Done ${isDryRun ? "(no changes — remove --dry-run to apply)" : ""} ===\n`);
  } catch (err: any) {
    console.error("Migration failed:", err.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
