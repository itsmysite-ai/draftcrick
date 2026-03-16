#!/usr/bin/env npx tsx
/**
 * Fetch team logos for all visible tournaments from Cricbuzz.
 * Uses the matches page RSC data to extract team imageIds programmatically.
 * Works for any Cricbuzz series — no hardcoded team lists needed.
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });
dotenv.config({ override: false });
import postgres from "postgres";
import { fetchSeriesTeamLogos } from "../packages/api/src/providers/cricbuzz/cricbuzz-client";

async function main() {
  const sql = postgres(process.env.DATABASE_URL || "postgresql://chandanreddy@localhost:5432/draftplay_local");

  // Get all tournaments with Cricbuzz external IDs
  const tournaments = await sql`
    SELECT id, name, external_id, teams
    FROM tournaments
    WHERE external_id LIKE 'cb-%'
    ORDER BY name
  `;

  console.log(`Found ${tournaments.length} tournaments with Cricbuzz IDs\n`);

  for (const t of tournaments) {
    const seriesId = parseInt(t.external_id.replace("cb-", ""), 10);
    const seriesSlug = t.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    console.log(`\n--- ${t.name} (cb-${seriesId}) ---`);

    const teamInfos = await fetchSeriesTeamLogos(seriesId, seriesSlug);

    if (teamInfos.length === 0) {
      console.log("  No teams found");
      continue;
    }

    // Merge with existing team data
    const existingTeams = Array.isArray(t.teams) ? (t.teams as any[]) : [];
    const merged = teamInfos.map((info) => {
      const existing = existingTeams.find(
        (et: any) => et.name?.toLowerCase() === info.name.toLowerCase()
      );
      return {
        ...(existing || {}),
        name: info.name,
        shortName: info.shortName,
        logo: info.logoUrl || (existing as any)?.logo || null,
      };
    });

    await sql`UPDATE tournaments SET teams = ${JSON.stringify(merged)} WHERE id = ${t.id}`;

    const withLogos = merged.filter((m) => m.logo);
    console.log(`  Updated: ${merged.length} teams, ${withLogos.length} with logos`);
    for (const team of merged) {
      console.log(`  ${team.logo ? "✅" : "⚠️"} ${team.shortName} ${team.name}`);
    }

    await new Promise((r) => setTimeout(r, 500));
  }

  await sql.end();
  console.log("\nDone!");
}

main().catch(console.error);
