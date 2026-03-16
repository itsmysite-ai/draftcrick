import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });
dotenv.config({ override: false });
import { fetchRawHtml } from "../packages/api/src/providers/cricbuzz/cricbuzz-client";

async function main() {
  // The schedule page has series entries with imageId — but are those team images or series images?
  // Let's extract the full structure around IPL on the schedule page
  const html = await fetchRawHtml("/cricket-schedule/upcoming-series/league");

  // Find all RSC data chunks
  const chunks = html.split("self.__next_f.push");
  for (let i = 0; i < chunks.length; i++) {
    if (chunks[i].includes("Indian Premier League")) {
      // Check if this chunk has actual series data (not just description text)
      if (chunks[i].includes("seriesId") || chunks[i].includes("startDt")) {
        console.log(`=== Chunk ${i} (length: ${chunks[i].length}) ===`);
        // Print the relevant portion
        const iplIdx = chunks[i].indexOf("Indian Premier League");
        const start = Math.max(0, iplIdx - 500);
        const end = Math.min(chunks[i].length, iplIdx + 1000);
        console.log(chunks[i].substring(start, end));
        console.log("\n");
      }
    }
  }

  // Also check /live-cricket-scores page - it shows series tabs with logos
  console.log("\n=== Checking live scores page ===");
  const liveHtml = await fetchRawHtml("/live-cricket-scores");
  const liveChunks = liveHtml.split("self.__next_f.push");
  for (let i = 0; i < liveChunks.length; i++) {
    if (liveChunks[i].includes("seriesAdWrapper") || liveChunks[i].includes("seriesTab")) {
      console.log(`Live chunk ${i}:`, liveChunks[i].substring(0, 500));
    }
  }

  // Look for series-specific image URLs using known IPL Cricbuzz patterns
  // Try common logo URL patterns
  const logoTests = [
    "https://static.cricbuzz.com/a/img/v1/series/i1/c9241/i.jpg",
    "https://static.cricbuzz.com/a/img/v1/i1/c9241/logo.jpg",
    "https://static.cricbuzz.com/a/img/v1/152x152/i1/c9241/logo.jpg",
    "https://static.cricbuzz.com/a/img/v1/i1/c9241/indian-premier-league.jpg",
  ];
  // (we can't fetch these directly here, but printed for reference)
  console.log("\nLogo URL patterns to test manually:", logoTests);
}
main().catch((e) => console.error(e.message));
