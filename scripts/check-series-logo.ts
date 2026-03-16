import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });
dotenv.config({ override: false });
import { fetchRawHtml } from "../packages/api/src/providers/cricbuzz/cricbuzz-client";

async function main() {
  const html = await fetchRawHtml("/cricket-series/9241/indian-premier-league-2026/matches");

  // Find matchDetailsMap chunk
  const chunkStart = html.indexOf("matchDetailsMap");
  const searchBack = html.lastIndexOf("self.__next_f.push", chunkStart);
  const nextChunk = html.indexOf("self.__next_f.push", chunkStart);
  const chunk = html.substring(searchBack, nextChunk !== -1 ? nextChunk : undefined);

  // Look for series-level image/logo references
  const patterns = [
    /seriesId[\\]*"[:\\s]*(\d+)/,
    /seriesName[\\]*"[:\\s]*[\\]*"([^"\\]+)/,
    /imageId[\\]*"[:\\s]*(\d+)/,  // first imageId before any team
  ];

  for (const p of patterns) {
    const m = chunk.match(p);
    if (m) console.log(`${p.source}: ${m[1]}`);
  }

  // Search for "image" or "logo" or "img" near "series"
  const seriesContext = chunk.substring(0, 2000);
  console.log("\n=== First 2000 chars of matchDetails chunk ===");
  console.log(seriesContext);

  // Also check the series page itself
  console.log("\n\n=== Checking series home page ===");
  const homeHtml = await fetchRawHtml("/cricket-series/9241/indian-premier-league-2026");

  // Check og:image
  const ogMatch = homeHtml.match(/og:image[\\]*"[^>]*content[\\]*"[=:][\\]*"([^"\\]+)/);
  console.log("og:image:", ogMatch?.[1] || "not found");

  // Check for series image in RSC data
  const seriesImagePattern = /seriesImage[\\]*"[:\\s]*[\\]*"?(\d+)/g;
  let m;
  while ((m = seriesImagePattern.exec(homeHtml)) !== null) {
    console.log("seriesImage:", m[1]);
  }

  // Check for any image near "Indian Premier League" in the HTML
  const iplIdx = homeHtml.indexOf("Indian Premier League");
  if (iplIdx > 0) {
    const nearby = homeHtml.substring(Math.max(0, iplIdx - 500), iplIdx + 500);
    const imgRefs = nearby.match(/(?:image|img|logo|banner)[A-Za-z]*[\\]*"[:\\s]*[\\]*"?([^"\\,\s}]+)/gi);
    if (imgRefs) {
      console.log("\nImage refs near series name:");
      for (const r of imgRefs) console.log("  ", r);
    }
  }

  // Look for all unique keys in the RSC data containing "image" or "logo"
  const allImageKeys = homeHtml.match(/[a-zA-Z]*(?:image|logo|img|banner)[a-zA-Z]*[\\]*":/gi) || [];
  const uniqueKeys = [...new Set(allImageKeys)];
  console.log("\nAll image-related keys in HTML:", uniqueKeys.slice(0, 20));
}
main().catch((e) => console.error(e.message));
