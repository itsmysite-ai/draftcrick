#!/usr/bin/env npx tsx
/**
 * Bulk-populate player photos from Cricbuzz.
 * Fetches each player's profile page and extracts the real player photo.
 * Only processes players with cb-{id} external IDs and no existing photo.
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });
dotenv.config({ override: false });
import postgres from "postgres";
import { fetchRawHtml, parsePlayerProfilePage } from "../packages/api/src/providers/cricbuzz/cricbuzz-client";
import * as cheerio from "cheerio";

async function main() {
  const sql = postgres(process.env.DATABASE_URL || "postgresql://chandanreddy@localhost:5432/draftplay_local");

  // Get all players with Cricbuzz IDs and no photo
  const players = await sql`
    SELECT id, name, external_id
    FROM players
    WHERE external_id LIKE 'cb-%'
      AND (photo_url IS NULL OR photo_url = '')
    ORDER BY name
  `;

  console.log(`Found ${players.length} players needing photos\n`);

  let updated = 0;
  let failed = 0;
  let noPhoto = 0;

  for (const p of players) {
    const cbId = p.external_id.replace("cb-", "");
    const slug = p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    try {
      const html = await fetchRawHtml(`/profiles/${cbId}/${slug}`);
      const $ = cheerio.load(html);
      const profile = parsePlayerProfilePage($);

      if (profile.imageUrl && !profile.imageUrl.includes("c582022")) {
        await sql`UPDATE players SET photo_url = ${profile.imageUrl} WHERE id = ${p.id}`;
        updated++;
        console.log(`✅ ${p.name}: ${profile.imageUrl.split("/").pop()}`);
      } else {
        noPhoto++;
        console.log(`⚠️ ${p.name}: no photo found`);
      }

      // Courtesy delay between requests
      await new Promise(r => setTimeout(r, 400));
    } catch (err) {
      failed++;
      console.log(`❌ ${p.name}: ${String(err).substring(0, 80)}`);
    }
  }

  console.log(`\nDone! Updated: ${updated}, No photo: ${noPhoto}, Failed: ${failed}`);

  // Final count
  const withPhotos = await sql`SELECT count(*) as cnt FROM players WHERE photo_url IS NOT NULL`;
  console.log(`Total players with photos: ${withPhotos[0]!.cnt} / ${players.length + (await sql`SELECT count(*) as cnt FROM players WHERE photo_url IS NOT NULL`)[0]!.cnt}`);

  await sql.end();
}

main().catch(console.error);
