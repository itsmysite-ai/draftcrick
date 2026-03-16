/**
 * Maps Cricbuzz player profile data → AIPlayer.
 * Converts scraped HTML stats into our normalized AIPlayer interface.
 *
 * NOTE: Nationality is set to the raw Cricbuzz "country" field (often a birth place
 * like "Anand, Gujarat"). The calling code must call resolveNationalitiesWithGemini()
 * to convert these to proper country names before upserting.
 */

import type { AIPlayer, PlayerRole } from "@draftplay/shared";
import type { CricbuzzPlayerProfile } from "./cricbuzz-client";

/**
 * Map a Cricbuzz role string to our PlayerRole enum.
 */
function mapRole(role: string): PlayerRole {
  const lower = role.toLowerCase();
  if (/wicket|keeper|wk/i.test(lower)) return "wicket_keeper";
  if (/all.?round/i.test(lower)) return "all_rounder";
  if (/bowl/i.test(lower)) return "bowler";
  if (/bat/i.test(lower)) return "batsman";
  return "all_rounder"; // Default
}

/**
 * Parse a numeric stat string. Returns null for "--", "-", "", or non-numeric.
 */
function parseStat(val: string | undefined): number | null {
  if (!val) return null;
  const cleaned = val.replace(/[*†]/g, "").trim();
  if (!cleaned || cleaned === "--" || cleaned === "-") return null;
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Pick the best format stats for a tournament context.
 * For IPL → use IPL stats, for T20 tournaments → T20, else try ODI, then Test.
 */
function pickFormat(
  stats: Record<string, Record<string, string>>,
  tournamentName: string
): Record<string, string> {
  const lower = tournamentName.toLowerCase();

  // IPL-specific stats if available
  if (lower.includes("ipl") || lower.includes("premier league")) {
    if (stats["IPL"]) return stats["IPL"];
  }

  // T20 leagues or internationals
  if (lower.includes("t20") || lower.includes("twenty20") || lower.includes("ipl") || lower.includes("bbl") || lower.includes("psl") || lower.includes("cpl")) {
    return stats["T20"] ?? stats["IPL"] ?? stats["ODI"] ?? stats["Test"] ?? {};
  }

  // ODI
  if (lower.includes("odi") || lower.includes("one day") || lower.includes("world cup")) {
    return stats["ODI"] ?? stats["T20"] ?? stats["Test"] ?? {};
  }

  // Test
  if (lower.includes("test") || lower.includes("ashes") || lower.includes("border-gavaskar")) {
    return stats["Test"] ?? stats["ODI"] ?? stats["T20"] ?? {};
  }

  // Default: prefer T20 → ODI → Test (most fantasy platforms focus on limited overs)
  return stats["T20"] ?? stats["IPL"] ?? stats["ODI"] ?? stats["Test"] ?? {};
}

/**
 * Convert a CricbuzzPlayerProfile to an AIPlayer.
 * @param cricbuzzId - Cricbuzz profile ID (numeric string). Used as stable external ID (cb-{id}).
 *
 * Nationality is set to the raw Cricbuzz "country" / birth place field.
 * Call resolveNationalitiesWithGemini() on the returned players to get proper country names.
 */
export function mapCricbuzzPlayerToAIPlayer(
  profile: CricbuzzPlayerProfile,
  teamName: string,
  tournamentName: string,
  cricbuzzId?: string
): AIPlayer {
  const battingFormat = pickFormat(profile.battingStats, tournamentName);
  const bowlingFormat = pickFormat(profile.bowlingStats, tournamentName);

  const matchesPlayed =
    parseStat(battingFormat["Matches"]) ??
    parseStat(bowlingFormat["Matches"]) ??
    null;

  return {
    id: cricbuzzId ? `cb-${cricbuzzId}` : "",
    name: profile.name,
    team: teamName,
    role: mapRole(profile.role),
    nationality: profile.country || teamName, // Raw value — Gemini resolves later
    battingStyle: profile.battingStyle,
    bowlingStyle: profile.bowlingStyle,
    credits: null, // Calculated by our engine, not from Cricbuzz
    battingAvg: parseStat(battingFormat["Average"] ?? battingFormat["Avg"]),
    bowlingAvg: parseStat(bowlingFormat["Avg"] ?? bowlingFormat["Average"]),
    strikeRate: parseStat(battingFormat["SR"]),
    economyRate: parseStat(bowlingFormat["Eco"] ?? bowlingFormat["Econ"]),
    bowlingStrikeRate: parseStat(bowlingFormat["SR"]),
    matchesPlayed,
    recentForm: null, // Cricbuzz doesn't provide this — Gemini enrichment
    sentimentScore: null, // Gemini enrichment
    injuryStatus: null, // Gemini enrichment
    formNote: null, // Gemini enrichment
    tournamentName,
    sourceUrl: null,
    imageUrl: profile.imageUrl ?? null,
  };
}
