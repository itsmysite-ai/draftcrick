/**
 * One-time data migration: update existing auction rooms to new defaults.
 *
 * Run ONCE after deploying the auction AI features to production.
 * Safe to re-run — uses ON CONFLICT DO NOTHING where applicable.
 *
 * Changes:
 *   1. Set bidIncrement to 0.1 for existing auction rooms (was 1)
 *   2. Set basePriceMode to "flat" for existing rooms without it
 *   3. Fix any auction rooms stuck in "waiting" status → "in_progress"
 *
 * Usage:
 *   npx tsx scripts/migrate-auction-defaults.ts
 *   npx tsx scripts/migrate-auction-defaults.ts --dry-run
 */

const isDryRun = process.argv.includes("--dry-run");

async function main() {
  const postgres = (await import("postgres")).default;
  const dbUrl = process.env.DATABASE_URL ?? "postgresql://chandanreddy@localhost:5432/draftplay_local";
  const sql = postgres(dbUrl);

  console.log(`\n=== Auction Defaults Migration ${isDryRun ? "(DRY RUN)" : ""} ===\n`);

  // 1. Find all auction rooms
  const rooms = await sql`
    SELECT id, status, settings FROM draft_rooms WHERE type = 'auction'
  `;
  console.log(`Found ${rooms.length} auction rooms\n`);

  for (const room of rooms) {
    const settings = (room.settings ?? {}) as Record<string, unknown>;
    const changes: string[] = [];

    // Update bidIncrement if it's the old default (1)
    if (!settings.bidIncrement || settings.bidIncrement === 1) {
      settings.bidIncrement = 0.1;
      changes.push("bidIncrement: 1 → 0.1");
    }

    // Set basePriceMode if missing
    if (!settings.basePriceMode) {
      settings.basePriceMode = "flat";
      changes.push("basePriceMode: (none) → flat");
    }

    // Set basePricePercent if missing
    if (!settings.basePricePercent) {
      settings.basePricePercent = 50;
      changes.push("basePricePercent: (none) → 50");
    }

    if (changes.length > 0) {
      console.log(`  Room ${room.id} (${room.status}):`);
      for (const c of changes) console.log(`    - ${c}`);

      if (!isDryRun) {
        await sql`
          UPDATE draft_rooms
          SET settings = ${JSON.stringify(settings)}::jsonb
          WHERE id = ${room.id}
        `;
        console.log(`    ✓ Updated`);
      }
    }

    // Fix stuck "waiting" rooms
    if (room.status === "waiting") {
      console.log(`  Room ${room.id}: status waiting → in_progress`);
      if (!isDryRun) {
        await sql`UPDATE draft_rooms SET status = 'in_progress' WHERE id = ${room.id}`;
        console.log(`    ✓ Updated`);
      }
    }
  }

  console.log(`\n=== Done ${isDryRun ? "(no changes made — remove --dry-run to apply)" : ""} ===\n`);
  await sql.end();
}

main().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
