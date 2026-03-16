#!/usr/bin/env npx tsx
import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });
dotenv.config({ override: false });
import postgres from "postgres";

const DB_URL = process.env.DATABASE_URL || "postgresql://chandanreddy@localhost:5432/draftplay_local";

async function main() {
  const sql = postgres(DB_URL);

  // Update contests to "upcoming" where:
  // - contest status is currently "open"
  // - the linked match does NOT have draft_enabled = true
  const result = await sql`
    UPDATE contests
    SET status = 'upcoming'
    WHERE status = 'open'
      AND match_id IN (
        SELECT m.id FROM matches m
        WHERE m.draft_enabled IS NOT TRUE
      )
  `;

  console.log(`Updated ${result.count} contests from "open" to "upcoming"`);

  // Show current status distribution
  const stats = await sql`
    SELECT c.status, count(*) as cnt,
           bool_or(m.draft_enabled) as any_draft_enabled
    FROM contests c
    LEFT JOIN matches m ON c.match_id = m.id
    GROUP BY c.status
    ORDER BY c.status
  `;
  console.log("\nContest status distribution:");
  for (const s of stats) {
    console.log(`  ${s.status}: ${s.cnt} (draft_enabled: ${s.any_draft_enabled})`);
  }

  await sql.end();
}

main().catch(console.error);
