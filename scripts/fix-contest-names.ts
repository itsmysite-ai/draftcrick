#!/usr/bin/env npx tsx
/**
 * Fix verbose contest names:
 *  1. League contests: strip "• TeamA vs TeamB" suffix
 *  2. H2H contests: replace "TeamA vs TeamB — H2H" with "{creator}'s H2H Duel"
 * Usage: cd packages/api && npx tsx ../../scripts/fix-contest-names.ts
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });
dotenv.config({ override: false });
import postgres from "postgres";

const DB_URL = process.env.DATABASE_URL || "postgresql://chandanreddy@localhost:5432/draftplay_local";

async function main() {
  const sql = postgres(DB_URL);
  let totalFixed = 0;

  // 1. Fix league contests with "• TeamA vs TeamB"
  const leagueRows = await sql`
    SELECT id, name FROM contests
    WHERE league_id IS NOT NULL AND name LIKE '%•%'
  `;

  if (leagueRows.length > 0) {
    console.log(`League contests (${leagueRows.length}):\n`);
    for (const row of leagueRows) {
      const oldName = row.name as string;
      const newName = oldName.split(" • ")[0]!.trim();
      console.log(`  "${oldName}" → "${newName}"`);
      await sql`UPDATE contests SET name = ${newName} WHERE id = ${row.id}`;
    }
    totalFixed += leagueRows.length;
  }

  // 2. Fix H2H contests with "TeamA vs TeamB — H2H"
  const h2hRows = await sql`
    SELECT c.id, c.name,
           u.display_name, u.username
    FROM contests c
    LEFT JOIN fantasy_teams ft ON ft.contest_id = c.id
    LEFT JOIN users u ON u.id = ft.user_id
    WHERE c.contest_type = 'h2h' AND c.name LIKE '%— H2H'
    ORDER BY c.id, ft.created_at ASC
  `;

  // Group by contest — first team entry is the creator
  const h2hMap = new Map<string, { oldName: string; creator: string }>();
  for (const row of h2hRows) {
    if (!h2hMap.has(row.id as string)) {
      const displayName = (row.display_name as string) || (row.username as string) || "Unknown";
      const cleanName = displayName.split("@")[0]!.trim();
      h2hMap.set(row.id as string, { oldName: row.name as string, creator: cleanName });
    }
  }

  if (h2hMap.size > 0) {
    console.log(`\nH2H contests (${h2hMap.size}):\n`);
    for (const [id, { oldName, creator }] of h2hMap) {
      const newName = `${creator}'s H2H Duel`;
      console.log(`  "${oldName}" → "${newName}"`);
      await sql`UPDATE contests SET name = ${newName} WHERE id = ${id}`;
    }
    totalFixed += h2hMap.size;
  }

  if (totalFixed === 0) {
    console.log("No contest names to fix.");
  } else {
    console.log(`\nFixed ${totalFixed} contest name(s) total.`);
  }

  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
