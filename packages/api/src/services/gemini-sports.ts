/**
 * Gemini AI sports data service with Google Search grounding.
 * Sport-agnostic: pass any SportPromptConfig to fetch data for that sport.
 * Uses gemini-3.1-flash-lite-preview with googleSearch tool for real-time data.
 */

import type {
  AITournament,
  AIMatch,
  AIPlayer,
  AITeamStanding,
  SportsDashboardData,
  AIMatchStatus,
  TournamentCategory,
} from "@draftplay/shared";
import { SPORT_CONFIGS, DEFAULT_SPORT } from "@draftplay/shared";
import type { Sport } from "@draftplay/shared";
import { getLogger } from "../lib/logger";

const log = getLogger("gemini-sports");

// Lazy-load to avoid import issues if @google/genai isn't installed yet
let _ai: any = null;
async function getAI() {
  if (!_ai) {
    const { GoogleGenAI } = await import("@google/genai");
    _ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_CLOUD_API_KEY || process.env.GEMINI_API_KEY || process.env.API_KEY || "" });
  }
  return _ai;
}

function buildPrompt(sport: string, displayName: string, knownTournaments: string[], activeTournaments?: string[]): string {
  // If active tournaments are specified, ONLY ask about those to save API costs
  if (activeTournaments && activeTournaments.length > 0) {
    const tournamentList = activeTournaments.join(", ");
    return `
Search for current ${displayName.toLowerCase()} matches in these specific tournaments: ${tournamentList}.
Find matches scheduled for today and the next 3 days, plus any recently completed matches.

Return the data in this EXACT format for me to parse:
[TOURNAMENTS_START]
Tournament: Name | Category | StartDate | EndDate | Description
[TOURNAMENTS_END]

[MATCHES_START]
Match: Team A vs Team B | Format | Time | Date | Status | Tournament Name | Venue
[MATCHES_END]

CRITICAL: Each Match line MUST have exactly 7 pipe-separated fields in this order:
  Field 1: "Team A vs Team B" (the two teams)
  Field 2: Format (e.g., T20, ODI, Test)
  Field 3: Time with timezone (e.g., "7:30 PM IST")
  Field 4: Date as "Mon DD, YYYY" (e.g., "Feb 12, 2026")
  Field 5: Status (upcoming, live, completed, delayed, abandoned)
  Field 6: Tournament Name (e.g., "${activeTournaments[0]}") — NOT the venue
  Field 7: Venue (e.g., "Dubai International Stadium") — NOT the tournament name

Category must be one of: international, domestic, league, bilateral, qualifier, friendly
Format examples: ${SPORT_CONFIGS[sport]?.formatExamples.join(", ") ?? "League"}
StartDate/EndDate format: "YYYY-MM-DD" or "unknown"
Description: Brief 1-line summary (max 100 chars)

IMPORTANT — ONLY return data for these tournaments: ${tournamentList}. Do NOT include any other tournaments.

CRITICAL — Tournament names must use the FULL OFFICIAL name exactly as provided above. Never abbreviate (e.g. never "IPL" for "Indian Premier League"). NEVER append the year to tournament names — the year is in the dates. The tournament name in each Match line must match the Tournament line exactly.

IMPORTANT — Team naming rules:
- Use official full team names consistently across ALL matches in the same tournament.
- For women's tournaments, ALWAYS include "Women" in every team name.
- Never mix naming conventions within the same tournament.

CRITICAL — Do NOT include matches where one or both teams are undecided (TBC, TBD, T.B.C., "To Be Confirmed", etc.). Only return matches with confirmed, named teams.

Return ALL matches with confirmed teams for the requested tournaments (up to 20).
If there are live matches happening right now, mark them with status "live".
`.trim();
  }

  const tournamentsHint = knownTournaments.slice(0, 6).join(", ");
  return `
Search for current major ${displayName.toLowerCase()} tournaments happening globally right now and matches scheduled for today and the next 3 days.
Include known tournaments like: ${tournamentsHint}.

Return the data in this EXACT format for me to parse:
[TOURNAMENTS_START]
Tournament: Name | Category | StartDate | EndDate | Description
[TOURNAMENTS_END]

[MATCHES_START]
Match: Team A vs Team B | Format | Time | Date | Status | Tournament Name | Venue
[MATCHES_END]

CRITICAL: Each Match line MUST have exactly 7 pipe-separated fields in this order:
  Field 1: "Team A vs Team B" (the two teams)
  Field 2: Format (e.g., T20, ODI, Test)
  Field 3: Time with timezone (e.g., "7:30 PM IST")
  Field 4: Date as "Mon DD, YYYY" (e.g., "Feb 12, 2026")
  Field 5: Status (upcoming, live, completed, delayed, abandoned)
  Field 6: Tournament Name (e.g., "ICC Men's T20 World Cup") — NOT the venue
  Field 7: Venue (e.g., "Dubai International Stadium") — NOT the tournament name

Category must be one of: international, domestic, league, bilateral, qualifier, friendly
Format examples: ${SPORT_CONFIGS[sport]?.formatExamples.join(", ") ?? "League"}
StartDate/EndDate format: "YYYY-MM-DD" or "unknown"
Description: Brief 1-line summary (max 100 chars)

Example:
Tournament: ICC Men's T20 World Cup | international | 2026-02-01 | 2026-03-15 | ICC's flagship T20 tournament featuring 20 nations
Match: India vs Pakistan | T20 | 7:30 PM IST | Feb 12, 2026 | upcoming | ICC Men's T20 World Cup | Dubai International Stadium

CRITICAL — Tournament naming consistency:
- Always use the FULL OFFICIAL tournament name. Never use abbreviations.
- NEVER append the year to ANY tournament or series name. The year is already captured in StartDate/EndDate.
- Examples: "Indian Premier League" (NEVER "IPL" or "Indian Premier League 2026"), "Pakistan Super League" (NEVER "PSL"), "ICC Men's T20 World Cup" (NEVER with year suffix), "India vs England Test Series" (NEVER "India vs England Test Series 2025").
- The tournament name in each Match line must match the Tournament line exactly.

IMPORTANT — Team naming rules:
- Use official full team names consistently across ALL matches in the same tournament.
- For women's tournaments, ALWAYS include "Women" in every team name (e.g., "India Women" not "India", "Nepal Women" not "Nepal").
- For A-team / development tournaments, ALWAYS include the suffix (e.g., "Bangladesh A Women" not "Bangladesh A" or "Bangladesh").
- Never mix "Nepal" and "Nepal Women" or "UAE" and "UAE Women" within the same tournament.
- The team name in a match MUST match exactly how other matches in that tournament refer to the same team.

Return ALL currently active tournaments and as many scheduled matches as possible (up to 20).
If there are live matches happening right now, mark them with status "live".
`.trim();
}

function parseTournaments(text: string, sport: Sport): AITournament[] {
  const tournaments: AITournament[] = [];
  const section = text.match(/\[TOURNAMENTS_START\]([\s\S]*?)\[TOURNAMENTS_END\]/);
  if (!section) return tournaments;

  const lines: string[] = section[1].match(/Tournament: .+/g) || [];
  lines.forEach((line, index) => {
    const parts = line.replace("Tournament: ", "").split(" | ").map((s) => s.trim());
    if (parts.length >= 2) {
      const category = (parts[1]?.toLowerCase() || "league") as TournamentCategory;
      const validCategories: TournamentCategory[] = ["international", "domestic", "league", "bilateral", "qualifier", "friendly"];
      tournaments.push({
        id: `ai-tournament-${sport}-${index}`,
        name: parts[0],
        sport,
        category: validCategories.includes(category) ? category : "league",
        startDate: parts[2] && parts[2] !== "unknown" ? parts[2] : null,
        endDate: parts[3] && parts[3] !== "unknown" ? parts[3] : null,
        imageUrl: null,
        sourceUrl: null,
        description: parts[4]?.trim() || null,
      });
    }
  });

  return tournaments;
}

/** Heuristic: does this string look like a venue name? */
function looksLikeVenue(s: string): boolean {
  if (!s) return false;
  const venuePatterns = /stadium|ground|oval|park|arena|centre|center|cricket club|sports club|scg|mcg|waca|lords|edgbaston/i;
  // Venues typically contain a city/country after a comma
  const hasLocation = /,\s*[A-Z]/.test(s);
  return venuePatterns.test(s) || hasLocation;
}

function parseMatches(text: string, sport: Sport): AIMatch[] {
  const matches: AIMatch[] = [];
  const section = text.match(/\[MATCHES_START\]([\s\S]*?)\[MATCHES_END\]/);
  if (!section) return matches;

  const lines: string[] = section[1].match(/Match: .+/g) || [];
  lines.forEach((line, index) => {
    const parts = line.replace("Match: ", "").split(" | ").map((s) => s.trim());
    if (parts.length >= 6) {
      const teams = parts[0].split(" vs ").map((t) => t.trim());
      const status = (parts[4]?.toLowerCase() || "upcoming") as AIMatchStatus;
      const validStatuses: AIMatchStatus[] = ["upcoming", "live", "completed", "delayed", "abandoned"];

      // Gemini sometimes swaps tournament name and venue, or omits tournament name.
      // Detect and fix: if parts[5] looks like a venue, swap with parts[6].
      let tournamentName = parts[5] || "Unknown Tournament";
      let venue = parts[6] || null;

      if (looksLikeVenue(tournamentName)) {
        // parts[5] is actually the venue — swap
        venue = tournamentName;
        tournamentName = parts[6] || "Unknown Tournament";
      }

      matches.push({
        id: `ai-match-${sport}-${index}`,
        teamA: teams[0] || "TBA",
        teamB: teams[1] || "TBA",
        sport,
        format: parts[1] || "Unknown",
        time: parts[2] || "TBD",
        date: parts[3] || "TBD",
        status: validStatuses.includes(status) ? status : "upcoming",
        tournamentName,
        venue,
        scoreSummary: null,
        tossWinner: null,
        tossDecision: null,
        result: null,
        sourceUrl: null,
      });
    }
  });

  return matches;
}

/**
 * Fetch live sports data from Gemini AI with Google Search grounding.
 * This should be called at most once per day per sport (caching handled by caller).
 */
export async function fetchSportsData(sport: Sport = DEFAULT_SPORT, activeTournaments?: string[]): Promise<SportsDashboardData> {
  const config = SPORT_CONFIGS[sport];
  if (!config) {
    throw new Error(`No config found for sport: ${sport}`);
  }

  const apiKey = process.env.GEMINI_API_KEY ?? process.env.API_KEY;
  if (!apiKey) {
    log.warn("No GEMINI_API_KEY or API_KEY set — returning empty sports data");
    return {
      tournaments: [],
      matches: [],
      lastFetched: new Date().toISOString(),
      sources: [],
      sport,
    };
  }

  const ai = await getAI();
  const model = "gemini-3.1-flash-lite-preview";
  const prompt = buildPrompt(sport, config.displayName, config.knownTournaments, activeTournaments);

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const text: string = response.text || "";
    const groundingChunks =
      response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources = groundingChunks
      .filter((c: any) => c.web?.uri)
      .map((c: any) => c.web.uri);

    const tournaments = parseTournaments(text, sport);
    const matches = parseMatches(text, sport);

    // Attach source URLs to tournaments and matches
    if (sources.length > 0) {
      tournaments.forEach((t) => (t.sourceUrl = sources[0]));
      matches.forEach((m) => (m.sourceUrl = sources[0]));
    }

    return {
      tournaments,
      matches,
      lastFetched: new Date().toISOString(),
      sources,
      sport,
    };
  } catch (error) {
    log.error({ sport, error: String(error) }, "Gemini sports fetch failed");
    return {
      tournaments: [],
      matches: [],
      lastFetched: new Date().toISOString(),
      sources: [],
      sport,
    };
  }
}

// ---------------------------------------------------------------------------
// Lightweight tournament discovery via Gemini (no matches/players/standings)
// ---------------------------------------------------------------------------

function buildDiscoveryPrompt(sport: string, displayName: string, knownTournaments: string[]): string {
  const allKnown = knownTournaments.join(", ");
  return `
Today's date is ${new Date().toISOString().split("T")[0]}. Search for major ${displayName.toLowerCase()} tournaments that are currently active (ongoing right now) or upcoming (within next 90 days from today). Do NOT include tournaments that have already completed/finished — if the end date is before today, exclude it.

ONLY include these types:
1. ICC international events (World Cups, Champions Trophy, World Test Championship, etc.)
2. Top franchise leagues (IPL, PSL, BBL, CPL, SA20, ILT20, BPL, The Hundred, WPL, etc.)
3. Major bilateral series between top-8 ICC nations (India, Australia, England, South Africa, New Zealand, Pakistan, Sri Lanka, West Indies)

DO NOT include: domestic/county tournaments, A-team tours, youth/U19 events, associate nation tours, celebrity/legends leagues, or minor bilateral series.
Include BOTH men's AND women's international/franchise tournaments (e.g. Women's Premier League, Women's T20 World Cup, Women's Ashes, etc.).

Check these specifically: ${allKnown}.

CRITICAL — NAMING CONSISTENCY RULES:
- Always use the FULL OFFICIAL tournament name. Never use abbreviations or short forms.
- NEVER append the year to ANY tournament or series name. The year is already captured in StartDate/EndDate fields.
- Use these EXACT names every time (do NOT vary them across calls):
  • "Indian Premier League" (NEVER "IPL", NEVER "Indian Premier League 2026")
  • "Pakistan Super League" (NEVER "PSL", NEVER "Pakistan Super League 2026")
  • "Big Bash League" (NEVER "BBL")
  • "Caribbean Premier League" (NEVER "CPL")
  • "Bangladesh Premier League" (NEVER "BPL")
  • "Lanka Premier League" (NEVER "LPL")
  • "SA20" (this IS the official name)
  • "ILT20" (this IS the official name)
  • "The Hundred" (NEVER just "Hundred")
  • "Major League Cricket" (NEVER "MLC")
  • "Women's Premier League" (NEVER "WPL")
  • "ICC Men's T20 World Cup" (NEVER with year suffix)
  • "ICC Men's Cricket World Cup" (NEVER with year suffix)
  • "ICC Champions Trophy" (NEVER with year suffix)
- For bilateral series: "Team A vs Team B Format Series" (e.g. "India vs England Test Series", "South Africa vs New Zealand ODI Series")
  • Include the format(s) in the name (Test, ODI, T20I, or combined like "Test, ODI & T20I Series")
  • NEVER append the year — use StartDate/EndDate for that
- The name must be IDENTICAL every time you return it. This is used as a unique database key. If you are unsure, keep it simple and short.

Return ONLY tournament information in this EXACT format:
[TOURNAMENTS_START]
Tournament: Name | Category | StartDate | EndDate | Description
[TOURNAMENTS_END]

Category must be one of: international, league, bilateral
StartDate/EndDate format: "YYYY-MM-DD" or "unknown"
Description: A brief 1-line summary (max 100 chars). Example: "Annual T20 franchise league in India featuring 10 teams"

Do NOT include match data.
`.trim();
}

/**
 * Lightweight tournament discovery — fetches ONLY tournament names/metadata.
 * No matches, no players, no standings. Much cheaper than fetchSportsData().
 */
export async function discoverTournaments(sport: Sport = DEFAULT_SPORT): Promise<AITournament[]> {
  const config = SPORT_CONFIGS[sport];
  if (!config) {
    throw new Error(`No config found for sport: ${sport}`);
  }

  const apiKey = process.env.GEMINI_API_KEY ?? process.env.API_KEY;
  if (!apiKey) {
    log.warn("No GEMINI_API_KEY or API_KEY set — returning empty discovery");
    return [];
  }

  const ai = await getAI();
  const model = "gemini-3.1-flash-lite-preview";
  const prompt = buildDiscoveryPrompt(sport, config.displayName, config.knownTournaments);

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const text: string = response.text || "";
    const groundingChunks =
      response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources = groundingChunks
      .filter((c: any) => c.web?.uri)
      .map((c: any) => c.web.uri);

    const discoveredTournaments = parseTournaments(text, sport);

    if (sources.length > 0) {
      discoveredTournaments.forEach((t) => (t.sourceUrl = sources[0]));
    }

    // Filter out tournaments that have already completed (endDate in the past)
    const now = new Date();
    const activeTournaments = discoveredTournaments.filter((t) => {
      if (!t.endDate) return true; // unknown end date — keep it
      const end = new Date(t.endDate + "T23:59:59");
      return end >= now;
    });

    log.info(
      { sport, total: discoveredTournaments.length, active: activeTournaments.length },
      "Discovered tournaments from Gemini (filtered out completed)"
    );
    return activeTournaments;
  } catch (error) {
    log.error({ sport, error: String(error) }, "Gemini tournament discovery failed");
    return [];
  }
}

// ---------------------------------------------------------------------------
// Tournament enrichment via Gemini (resolve abbreviations, fill dates, verify)
// ---------------------------------------------------------------------------

/**
 * Enrich raw tournament data (e.g. from Cricbuzz scraping) using Gemini + Google Search.
 * Resolves abbreviated names ("WIW v AUSW" → "Australia Women tour of West Indies"),
 * fills in missing dates, and verifies tournaments are real/active via search grounding.
 *
 * Returns enriched tournaments with the same IDs (for DB linking).
 */
export async function enrichTournamentsWithGemini(
  rawTournaments: AITournament[],
  sport: Sport = "cricket"
): Promise<AITournament[]> {
  if (rawTournaments.length === 0) return [];

  const apiKey = process.env.GEMINI_API_KEY ?? process.env.API_KEY;
  if (!apiKey) {
    log.warn("No Gemini API key — skipping tournament enrichment");
    return rawTournaments;
  }

  const today = new Date().toISOString().split("T")[0];

  // Build a list of raw entries for Gemini to resolve
  const rawEntries = rawTournaments.map((t) => ({
    id: t.id,
    rawName: t.name,
    category: t.category,
    startDate: t.startDate ?? "unknown",
    endDate: t.endDate ?? "unknown",
    sourceUrl: t.sourceUrl ?? null,
  }));

  const prompt = `
Today's date is ${today}. I have ${rawEntries.length} ${sport} tournament entries scraped from Cricbuzz.

Your job: For EACH entry, use Google Search to find the ACTUAL official tournament/series name as it appears on Cricbuzz (cricbuzz.com) or ESPNcricinfo (espncricinfo.com). Do NOT guess or infer names — search for them.

STEPS for each entry:
1. Search Google for the tournament using the raw name + "cricbuzz" or "espncricinfo"
2. Use the EXACT official series name from the search results (e.g. Cricbuzz page title: "Australia Women tour of West Indies, 2026")
3. Strip the year from the name (we store years in date fields, not the name)
4. Get the actual start and end dates from the search results
5. Determine category: international, league, bilateral, qualifier

For abbreviated names like "WIW v AUSW", "SA v NZ", etc.:
- Search "WIW v AUSW 2026 cricbuzz" to find the actual series page
- Use the official name from the Cricbuzz series page (e.g. "Australia Women tour of West Indies")
- Do NOT try to construct the name yourself — copy it EXACTLY from the search result
- TOUR DIRECTION MATTERS: "X tour of Y" means X is visiting Y's home. Get this from the search result, do not guess.
- If the sourceUrl contains a slug like "aus-women-tour-of-wi-2026", use it as a hint for the correct name

CRITICAL — SKIP rules:
- Mark SKIP **ONLY** if Google Search confirms the tournament ended before ${today}
- If unsure, mark ACTIVE
- Upcoming tournaments are ALWAYS ACTIVE
- If you cannot find info, mark ACTIVE and keep original data unchanged

Here are the raw entries:
${rawEntries.map((e) => `- ID: ${e.id} | Raw Name: "${e.rawName}" | Category: ${e.category} | Start: ${e.startDate} | End: ${e.endDate}${e.sourceUrl ? ` | URL: ${e.sourceUrl}` : ""}`).join("\n")}

CRITICAL — Finding dates:
- If Start or End is "unknown", you MUST search Google for the actual dates. Try: "{tournament name} 2026 schedule cricbuzz" or check the URL provided.
- If the raw entry already has dates (not "unknown"), keep them unless Google Search shows they are clearly wrong.
- Dates must be in YYYY-MM-DD format.

Return ONLY the resolved data in this EXACT format (one line per tournament, keep the same ID):
[ENRICHED_START]
ID: {id} | Name: {resolved name} | Category: {category} | StartDate: {YYYY-MM-DD or unknown} | EndDate: {YYYY-MM-DD or unknown} | Status: {ACTIVE or SKIP} | Description: {brief description}
[ENRICHED_END]

RULES:
- NEVER append the year to the name (year goes in StartDate/EndDate)
- For leagues: use official full name (e.g. "Indian Premier League" not "IPL")
- Include "Women" for women's tournaments
- You MUST return exactly ${rawEntries.length} entries — one for each input ID. Do not omit any.
`.trim();

  try {
    const ai = await getAI();
    const model = "gemini-3.1-flash-lite-preview";

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const text: string = response.text || "";
    const section = text.match(/\[ENRICHED_START\]([\s\S]*?)\[ENRICHED_END\]/);
    if (!section) {
      log.warn("Gemini enrichment returned no parseable section — using raw data");
      return rawTournaments;
    }

    const lines = section[1]!.match(/ID: .+/g) || [];
    const enrichedMap = new Map<string, { name: string; category: TournamentCategory; startDate: string | null; endDate: string | null; skip: boolean; description: string | null }>();

    for (const line of lines) {
      const idMatch = line.match(/ID:\s*([^\|]+)/);
      const nameMatch = line.match(/Name:\s*([^\|]+)/);
      const catMatch = line.match(/Category:\s*([^\|]+)/);
      const startMatch = line.match(/StartDate:\s*([^\|]+)/);
      const endMatch = line.match(/EndDate:\s*([^\|]+)/);
      const statusMatch = line.match(/Status:\s*([^\|]+)/);
      const descMatch = line.match(/Description:\s*(.+)/);

      if (idMatch && nameMatch) {
        const id = idMatch[1]!.trim();
        const validCats: TournamentCategory[] = ["international", "league", "bilateral", "qualifier", "domestic", "friendly"];
        const cat = catMatch?.[1]?.trim().toLowerCase() as TournamentCategory;
        const startStr = startMatch?.[1]?.trim();
        const endStr = endMatch?.[1]?.trim();

        enrichedMap.set(id, {
          name: nameMatch[1]!.trim(),
          category: validCats.includes(cat) ? cat : "bilateral",
          startDate: startStr && startStr !== "unknown" ? startStr : null,
          endDate: endStr && endStr !== "unknown" ? endStr : null,
          skip: statusMatch?.[1]?.trim().toUpperCase() === "SKIP",
          description: descMatch?.[1]?.trim() ?? null,
        });
      }
    }

    log.info({ rawCount: rawTournaments.length, enrichedCount: enrichedMap.size, skipped: [...enrichedMap.values()].filter(e => e.skip).length }, "Gemini tournament enrichment complete");

    // Merge enriched data back into raw tournaments
    const result: AITournament[] = [];
    for (const t of rawTournaments) {
      const enriched = enrichedMap.get(t.id);
      if (enriched?.skip) {
        log.info({ id: t.id, name: t.name, enrichedName: enriched.name }, "Skipping tournament (Gemini marked as completed/invalid)");
        continue;
      }

      // Date merge strategy:
      // 1. If Cricbuzz has dates, use them (they come from the schedule page)
      // 2. If Cricbuzz dates are missing, use Gemini dates (from Google Search)
      // 3. If Cricbuzz dates are obviously wrong, prefer Gemini dates
      //    Wrong = end before start, or bilateral spanning more than 6 months
      let startDate = t.startDate;
      let endDate = t.endDate;

      let cricbuzzDatesInvalid = false;
      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const spanDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
        // End before start is clearly wrong
        if (spanDays < 0) cricbuzzDatesInvalid = true;
        // Bilateral series spanning > 180 days is suspicious (likely wrong year)
        if ((t.category === "bilateral") && spanDays > 180) cricbuzzDatesInvalid = true;
      }

      if (cricbuzzDatesInvalid) {
        // Cricbuzz dates are clearly wrong — use Gemini's or null (don't keep bad dates)
        startDate = enriched?.startDate ?? null;
        endDate = enriched?.endDate ?? null;
        log.info({ id: t.id, name: t.name, badStart: t.startDate, badEnd: t.endDate, fixedStart: startDate, fixedEnd: endDate }, "Fixed invalid Cricbuzz dates");
      } else {
        // Fill missing dates from Gemini
        if (!startDate) startDate = enriched?.startDate ?? null;
        if (!endDate) endDate = enriched?.endDate ?? null;
      }

      // Post-merge sanity check: even after Gemini enrichment, validate final dates
      const finalCategory = enriched?.category ?? t.category;
      if (startDate && endDate) {
        const s = new Date(startDate);
        const e = new Date(endDate);
        const span = (e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24);
        if (span < 0) {
          // End before start — null out end date
          log.warn({ id: t.id, name: enriched?.name ?? t.name, startDate, endDate }, "Post-merge: end before start, nulling end date");
          endDate = null;
        } else if (finalCategory === "bilateral" && span > 180) {
          // Bilateral > 6 months — likely wrong year on end date
          log.warn({ id: t.id, name: enriched?.name ?? t.name, startDate, endDate, spanDays: span }, "Post-merge: bilateral span too long, nulling end date");
          endDate = null;
        }
      }

      // Use Cricbuzz slug as ground truth for tour direction
      // Slug like "aus-women-tour-of-wi-2026" → touring team = "aus-women", host = "wi"
      let finalName = enriched?.name ?? t.name;
      if (t.sourceUrl) {
        const slugMatch = t.sourceUrl.match(/cricket-series\/\d+\/([^/]+)/);
        if (slugMatch) {
          const slug = slugMatch[1]!;
          const tourMatch = slug.match(/^(.+?)-tour-of-(.+?)(?:-\d{4})?$/);
          if (tourMatch && finalName.toLowerCase().includes("tour of")) {
            const [, slugTouring, slugHost] = tourMatch;
            // Check if Gemini reversed the direction by seeing if slug's touring team
            // appears after "tour of" in the enriched name (meaning it's listed as host)
            const nameMatch = finalName.match(/^(.+?)\s+tour of\s+(.+)$/i);
            if (nameMatch) {
              const [, nameTouring, nameHost] = nameMatch;
              const normSlugTouring = slugTouring!.replace(/-/g, " ").toLowerCase();
              const normNameHost = nameHost!.toLowerCase();
              // If slug's touring team is in the enriched name's host position, it's reversed
              if (normNameHost.includes(normSlugTouring.split(" ")[0]!) && !normNameHost.includes(slugHost!.replace(/-/g, " ").split(" ")[0]!)) {
                // Swap: use enriched name's host as touring, touring as host
                finalName = `${nameHost} tour of ${nameTouring}`;
                log.info({ id: t.id, slug, original: enriched?.name, corrected: finalName }, "Corrected tour direction from slug");
              }
            }
          }
        }
      }

      result.push({
        ...t,
        name: finalName,
        category: enriched?.category ?? t.category,
        startDate,
        endDate,
        description: enriched?.description ?? t.description,
      });
    }

    // Second pass: targeted date-filling for tournaments still missing dates
    const missingDates = result.filter(t => !t.startDate || !t.endDate);
    if (missingDates.length > 0 && missingDates.length <= 10) {
      log.info({ count: missingDates.length, names: missingDates.map(t => t.name) }, "Second pass: filling missing dates");
      try {
        const datePrompt = `
Today is ${today}. I need EXACT start and end dates for these ${sport} tournaments/series.

For EACH one, search Google (try "tournament name 2026 schedule cricbuzz" or "tournament name 2026 fixtures espncricinfo").

${missingDates.map(t => `- ID: ${t.id} | Name: "${t.name}" | Known start: ${t.startDate ?? "unknown"} | Known end: ${t.endDate ?? "unknown"}${t.sourceUrl ? ` | URL: ${t.sourceUrl}` : ""}`).join("\n")}

Return ONLY in this format:
[DATES_START]
ID: {id} | StartDate: {YYYY-MM-DD or unknown} | EndDate: {YYYY-MM-DD or unknown}
[DATES_END]

RULES:
- Dates MUST be from search results, not guessed
- If you truly cannot find a date, return "unknown"
- Return exactly ${missingDates.length} entries
`.trim();

        const dateResponse = await ai.models.generateContent({
          model,
          contents: datePrompt,
          config: { tools: [{ googleSearch: {} }] },
        });

        const dateText = dateResponse.text || "";
        const dateSection = dateText.match(/\[DATES_START\]([\s\S]*?)\[DATES_END\]/);
        if (dateSection) {
          const dateLines = dateSection[1]!.match(/ID: .+/g) || [];
          for (const line of dateLines) {
            const idMatch = line.match(/ID:\s*([^\|]+)/);
            const startMatch = line.match(/StartDate:\s*([^\|]+)/);
            const endMatch = line.match(/EndDate:\s*(.+)/);
            if (!idMatch) continue;
            const id = idMatch[1]!.trim();
            const start = startMatch?.[1]?.trim();
            const end = endMatch?.[1]?.trim();
            const t = result.find(r => r.id === id);
            if (t) {
              if (!t.startDate && start && start !== "unknown") t.startDate = start;
              if (!t.endDate && end && end !== "unknown") t.endDate = end;
            }
          }
          log.info({ filled: dateLines.length }, "Second pass date filling complete");
        }
      } catch (err) {
        log.warn({ error: String(err) }, "Second pass date filling failed — continuing with partial dates");
      }
    }

    return result;
  } catch (error) {
    log.error({ error: String(error) }, "Gemini tournament enrichment failed — using raw data");
    return rawTournaments;
  }
}

// ---------------------------------------------------------------------------
// Player roster fetching via Gemini
// ---------------------------------------------------------------------------

const PLAYER_BATCH_SIZE = 3;
const TEAM_BATCH_SIZE = 4;

function buildPlayerPrompt(
  sport: string,
  displayName: string,
  tournamentNames: string[]
): string {
  const tournamentList = tournamentNames.join(", ");
  return `
Search for the current squad/roster of players in these ${displayName.toLowerCase()} tournaments: ${tournamentList}.

For each tournament, list all players from every team participating.

Return the data in this EXACT format for me to parse (18 pipe-separated fields):
[PLAYERS_START]
Player: Full Name | Team Name | Role | Nationality | Batting Style | Bowling Style | Credits | Batting Avg | Bowling Avg | Strike Rate | Economy Rate | Bowling SR | Matches Played | Recent Form (1-10) | Sentiment (1-10) | Injury Status | Form Note | Tournament Name
[PLAYERS_END]

Field definitions (in order):
1-9: Name, Team, Role (batsman/bowler/all_rounder/wicket_keeper), Nationality, Batting Style, Bowling Style, Credits (7.0-10.0), Batting Avg, Bowling Avg
10. Strike Rate — batting strike rate (N/A for pure bowlers)
11. Economy Rate — bowling economy (N/A for pure batsmen)
12. Bowling SR — bowling strike rate (N/A for pure batsmen)
13. Matches Played — matches in this tournament/series
14. Recent Form (1-10) — last 5 matches performance. 10=exceptional, 5=average, 1=terrible
15. Sentiment (1-10) — current media buzz. 10=massive hype, 5=neutral, 1=controversy
16. Injury Status — fit, doubtful, injured, or recovered
17. Form Note — one sentence about current form
18. Tournament Name

Use "N/A" for unknown fields.

Example:
Player: Virat Kohli | Royal Challengers Bengaluru | batsman | India | Right-hand bat | Right-arm medium | 10.0 | 48.5 | N/A | 142.3 | N/A | N/A | 14 | 9 | 9 | fit | In exceptional form with 3 fifties in last 5 IPL innings | Indian Premier League

CRITICAL — Player naming rules:
- Use the player's COMMONLY KNOWN cricket name — scoreboards, ESPNcricinfo, broadcasts.
- Do NOT use full legal names with middle names.
- "Jos Buttler" NOT "Joseph Charles Buttler". "Sam Curran" NOT "Samuel Matthew Curran".
- "Mohammed" not "Mohd." — no abbreviations. "Suryakumar Yadav" not "SKY" — no nicknames.
- When in doubt, use the name as it appears on ESPNcricinfo player profiles.

CRITICAL — Nationality: COUNTRY NAME only ("India" not "Indian", "England" not "English").

CRITICAL — Squad accuracy: ONLY confirmed squad members. Do NOT hallucinate.

CRITICAL — Sentiment: Base on CURRENT media coverage, fan reactions, expert commentary. Use the full 1-10 range honestly.

IMPORTANT — Team naming: Use official names. Women's teams get suffix. Franchise leagues use franchise names.

Return ALL players for the requested tournaments. Include at least 15-25 players per team.
`.trim();
}

/**
 * Build a prompt that asks for players from specific teams only.
 * Used as a second pass when the initial tournament-wide fetch misses some teams.
 */
function buildTeamPlayerPrompt(
  sport: string,
  displayName: string,
  teamNames: string[],
  tournamentName: string,
  existingPlayerNames?: string[]
): string {
  const teamList = teamNames.join(", ");

  // If we already have players, include them so Gemini uses the same names
  const existingPlayersBlock = existingPlayerNames && existingPlayerNames.length > 0
    ? `
IMPORTANT — We already have these players in our database for this match:
${existingPlayerNames.map((n) => `- ${n}`).join("\n")}

Rules for existing players:
- Use the EXACT SAME NAME as listed above. Do NOT change spelling, add middle names, or use alternate forms.
- If a player above is still in the squad, include them with the EXACT name shown.
- If a player above has been dropped/replaced, do NOT include them.
- You may ADD new players not in the list above if they are confirmed squad members.
`
    : "";

  return `
Search for the current ${displayName.toLowerCase()} squad/roster for these specific teams in the "${tournamentName}" tournament: ${teamList}.

Return 15-25 players per team.
${existingPlayersBlock}
Return the data in this EXACT format for me to parse (18 pipe-separated fields):
[PLAYERS_START]
Player: Full Name | Team Name | Role | Nationality | Batting Style | Bowling Style | Credits | Batting Avg | Bowling Avg | Strike Rate | Economy Rate | Bowling SR | Matches Played | Recent Form (1-10) | Sentiment (1-10) | Injury Status | Form Note | Tournament Name
[PLAYERS_END]

Field definitions (in order):
1. Full Name — player's commonly known name
2. Team Name — official team name in this tournament
3. Role — one of: batsman, bowler, all_rounder, wicket_keeper
4. Nationality — country name (not adjective)
5. Batting Style — e.g. Right-hand bat, Left-hand bat
6. Bowling Style — e.g. Right-arm fast, Left-arm spin, Right-arm off-break, N/A
7. Credits — fantasy value 7.0-10.0 (current form + reputation)
8. Batting Avg — career or tournament batting average
9. Bowling Avg — career or tournament bowling average (N/A for pure batsmen)
10. Strike Rate — batting strike rate (N/A for pure bowlers)
11. Economy Rate — bowling economy rate (N/A for pure batsmen)
12. Bowling SR — bowling strike rate (N/A for pure batsmen)
13. Matches Played — matches in this tournament/series
14. Recent Form (1-10) — performance in last 5 matches. 10=exceptional, 7=good, 5=average, 3=poor, 1=terrible
15. Sentiment (1-10) — current media buzz and public perception. 10=massive hype, 7=positive coverage, 5=neutral, 3=criticism, 1=controversy
16. Injury Status — one of: fit, doubtful, injured, recovered
17. Form Note — one sentence about current form from recent media (e.g. "3 fifties in last 5 innings, looking in great touch")
18. Tournament Name

Use "N/A" for any truly unknown fields. Do NOT guess — only include stats you can verify.

Example:
Player: Virat Kohli | Royal Challengers Bengaluru | batsman | India | Right-hand bat | Right-arm medium | 10.0 | 48.5 | N/A | 142.3 | N/A | N/A | 14 | 9 | 9 | fit | In exceptional form with 3 fifties in last 5 IPL innings | Indian Premier League
Player: Jasprit Bumrah | Mumbai Indians | bowler | India | Right-hand bat | Right-arm fast | 9.5 | N/A | 20.3 | N/A | 6.7 | 14.2 | 12 | 8 | 8 | fit | Tournament's leading wicket-taker with consistent economy | Indian Premier League

CRITICAL — Player naming rules:
- Use the player's COMMONLY KNOWN cricket name — the name on scoreboards, ESPNcricinfo, and broadcasts.
- Do NOT use full legal/birth certificate names with middle names.
- "Jos Buttler" NOT "Joseph Charles Buttler". "Sam Curran" NOT "Samuel Matthew Curran".
- "Mohammed" not "Mohd." or "Md." — no abbreviations.
- "Suryakumar Yadav" not "SKY" — no nicknames.
- When in doubt, use the name as it appears on ESPNcricinfo player profiles.

CRITICAL — Nationality format rules:
- ALWAYS use the COUNTRY NAME: "India" not "Indian", "England" not "English", "Australia" not "Australian".

CRITICAL — Squad accuracy rules:
- ONLY return CONFIRMED squad members for the "${tournamentName}" tournament.
- Do NOT hallucinate or guess. Cross-reference with official squad announcements.

CRITICAL — Sentiment scoring rules:
- Base the sentiment score on CURRENT media coverage, social media buzz, and public perception.
- Factor in: recent performances, fan reactions, expert commentary, injury/comeback news, transfer buzz.
- A player returning from injury with positive media coverage = higher sentiment.
- A player facing criticism after poor performance = lower sentiment.
- Be honest — don't inflate sentiment. Use the full 1-10 range.

The "Team Name" field MUST exactly match one of: ${teamList}.
Return ALL players for ALL requested teams.
`.trim();
}

function parsePlayers(text: string, sport: Sport): AIPlayer[] {
  const players: AIPlayer[] = [];
  const section = text.match(/\[PLAYERS_START\]([\s\S]*?)\[PLAYERS_END\]/);
  if (!section) return players;

  const lines: string[] = section[1]?.match(/Player: .+/g) || [];
  const validRoles = ["batsman", "bowler", "all_rounder", "wicket_keeper"] as const;

  lines.forEach((line, index) => {
    const parts = line.replace("Player: ", "").split(" | ").map((s) => s.trim());
    if (parts.length < 6) return;

    let name = parts[0] ?? "Unknown";
    let team = parts[1] ?? "Unknown";

    // --- Garbage data rejection ---
    // Strip "Team Name: " prefix (Gemini sometimes wraps team in a label)
    team = team.replace(/^Team\s*Name\s*:\s*/i, "").trim();
    // Reject if team is empty or looks like a label
    if (!team || /^(team|name|unknown)$/i.test(team)) return;
    // Reject if name looks like a label or is too short
    if (!name || name.length < 2 || /^(player|name|unknown)$/i.test(name)) return;

    const rawRole = parts[2]?.toLowerCase().replace(/[\s-]+/g, "_") || "";
    const role = validRoles.includes(rawRole as any)
      ? (rawRole as AIPlayer["role"])
      : "batsman"; // default fallback
    const nationality = parts[3] || "Unknown";
    const battingStyle = parts[4] && parts[4] !== "N/A" ? parts[4] : null;
    const bowlingStyle = parts[5] && parts[5] !== "N/A" ? parts[5] : null;

    // Parse credits, clamp to 7.0-10.0
    let credits: number | null = null;
    if (parts[6] && parts[6] !== "N/A") {
      const parsed = parseFloat(parts[6]);
      if (!isNaN(parsed)) {
        credits = Math.max(7.0, Math.min(10.0, parsed));
      }
    }

    // Parse batting average
    let battingAvg: number | null = null;
    if (parts[7] && parts[7] !== "N/A") {
      const parsed = parseFloat(parts[7]);
      if (!isNaN(parsed)) battingAvg = parsed;
    }

    // Parse bowling average
    let bowlingAvg: number | null = null;
    if (parts[8] && parts[8] !== "N/A") {
      const parsed = parseFloat(parts[8]);
      if (!isNaN(parsed)) bowlingAvg = parsed;
    }

    // Helper for parsing optional numeric fields
    const parseNum = (idx: number, min?: number, max?: number): number | null => {
      const raw = parts[idx];
      if (!raw || raw === "N/A" || raw === "—" || raw === "-") return null;
      const v = parseFloat(raw);
      if (isNaN(v)) return null;
      if (min != null && max != null) return Math.max(min, Math.min(max, v));
      return v;
    };

    // Extended stats (18-field format): parts[9]-[17]
    // Backward compatible: if parts.length < 18, tournamentName is parts[9]
    const isExtended = parts.length >= 18;

    const strikeRate = isExtended ? parseNum(9, 0, 400) : null;
    const economyRate = isExtended ? parseNum(10, 0, 20) : null;
    const bowlingStrikeRate = isExtended ? parseNum(11, 0, 100) : null;
    const matchesPlayed = isExtended ? parseNum(12, 0, 200) : null;
    const recentForm = isExtended ? parseNum(13, 1, 10) : null;
    const sentimentScore = isExtended ? parseNum(14, 1, 10) : null;

    const injuryRaw = isExtended ? (parts[15] ?? "").trim() : "";
    const validInjury = ["fit", "doubtful", "injured", "recovered"];
    const injuryStatus = validInjury.includes(injuryRaw.toLowerCase()) ? injuryRaw.toLowerCase() : null;

    const formNote = isExtended && parts[16] && parts[16] !== "N/A" ? parts[16].trim() : null;
    const tournamentName = isExtended ? (parts[17] || "Unknown Tournament") : (parts[9] || "Unknown Tournament");

    players.push({
      id: `ai-player-${sport}-${index}`,
      name,
      team,
      role,
      nationality,
      battingStyle,
      bowlingStyle,
      credits,
      battingAvg,
      bowlingAvg,
      strikeRate,
      economyRate,
      bowlingStrikeRate,
      matchesPlayed,
      recentForm,
      sentimentScore,
      injuryStatus,
      formNote,
      tournamentName,
      sourceUrl: null,
    });
  });

  // Batch-level garbage detection: if >80% of players have the same role
  // AND >80% have no credits, the response is likely garbage — discard it
  if (players.length > 5) {
    const roleCounts = new Map<string, number>();
    let noCreditsCount = 0;
    for (const p of players) {
      roleCounts.set(p.role, (roleCounts.get(p.role) ?? 0) + 1);
      if (!p.credits) noCreditsCount++;
    }
    const maxRoleCount = Math.max(...roleCounts.values());
    const sameRoleRatio = maxRoleCount / players.length;
    const noCreditsRatio = noCreditsCount / players.length;
    if (sameRoleRatio > 0.8 && noCreditsRatio > 0.8) {
      log.warn(
        { playerCount: players.length, sameRoleRatio, noCreditsRatio },
        "Discarding garbage player batch — uniform roles + no credits"
      );
      return [];
    }
  }

  return players;
}

/**
 * Fetch player rosters for specific teams in a tournament.
 * Used as a second pass when the initial tournament-wide fetch misses some teams.
 * Batches teams (4 per call) to stay within token limits.
 */
export async function fetchPlayersByTeams(
  sport: Sport,
  teamNames: string[],
  tournamentName: string,
  existingPlayerNames?: string[]
): Promise<AIPlayer[]> {
  const config = SPORT_CONFIGS[sport];
  if (!config) throw new Error(`No config found for sport: ${sport}`);

  const apiKey = process.env.GEMINI_API_KEY ?? process.env.API_KEY;
  if (!apiKey) return [];

  const ai = await getAI();
  const model = "gemini-3.1-flash-lite-preview";
  const allPlayers: AIPlayer[] = [];

  for (let i = 0; i < teamNames.length; i += TEAM_BATCH_SIZE) {
    const batch = teamNames.slice(i, i + TEAM_BATCH_SIZE);
    const prompt = buildTeamPlayerPrompt(sport, config.displayName, batch, tournamentName, existingPlayerNames);

    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: { tools: [{ googleSearch: {} }] },
      });

      const text: string = response.text || "";
      const players = parsePlayers(text, sport);
      allPlayers.push(...players);

      log.info({ sport, teams: batch, playersFound: players.length }, "Fetched team-specific player batch");
    } catch (error) {
      log.warn({ sport, teams: batch, error: String(error) }, "Failed to fetch team-specific player batch");
    }
  }

  return allPlayers;
}

/**
 * Fetch updated stats for a single player via Gemini AI.
 * Returns a single AIPlayer or null if the fetch fails.
 */
export async function fetchSinglePlayer(
  sport: Sport,
  playerName: string,
  teamName: string,
  tournamentName: string
): Promise<AIPlayer | null> {
  const config = SPORT_CONFIGS[sport];
  if (!config) throw new Error(`No config found for sport: ${sport}`);

  const apiKey = process.env.GEMINI_API_KEY ?? process.env.API_KEY;
  if (!apiKey) return null;

  const ai = await getAI();
  const model = "gemini-3.1-flash-lite-preview";

  const prompt = `
Search for the latest stats and information about the ${config.displayName.toLowerCase()} player "${playerName}" who plays for "${teamName}" in the "${tournamentName}" tournament.

Return the data in this EXACT format (18 pipe-separated fields):
[PLAYERS_START]
Player: Full Name | Team Name | Role | Nationality | Batting Style | Bowling Style | Credits | Batting Avg | Bowling Avg | Strike Rate | Economy Rate | Bowling SR | Matches Played | Recent Form (1-10) | Sentiment (1-10) | Injury Status | Form Note | Tournament Name
[PLAYERS_END]

Field definitions (in order):
1. Full Name — MUST be exactly "${playerName}" (do not change the name)
2. Team Name — "${teamName}"
3. Role — one of: batsman, bowler, all_rounder, wicket_keeper
4. Nationality — country name (not adjective)
5. Batting Style — e.g. Right-hand bat, Left-hand bat
6. Bowling Style — e.g. Right-arm fast, Left-arm spin, N/A
7. Credits — fantasy value 7.0-10.0
8. Batting Avg — career or tournament batting average
9. Bowling Avg — career or tournament bowling average (N/A for pure batsmen)
10. Strike Rate — batting strike rate (N/A for pure bowlers)
11. Economy Rate — bowling economy rate (N/A for pure batsmen)
12. Bowling SR — bowling strike rate (N/A for pure batsmen)
13. Matches Played — matches in this tournament/series
14. Recent Form (1-10) — last 5 matches performance. 10=exceptional, 5=average, 1=terrible
15. Sentiment (1-10) — current media buzz. 10=massive hype, 5=neutral, 1=controversy
16. Injury Status — one of: fit, doubtful, injured, recovered
17. Form Note — one sentence about current form from recent media
18. Tournament Name — "${tournamentName}"

Use "N/A" for any truly unknown fields. Do NOT guess — only include stats you can verify.

CRITICAL: Return EXACTLY ONE player line for "${playerName}". Use the exact name provided.
`.trim();

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: { tools: [{ googleSearch: {} }] },
    });

    const text: string = response.text || "";
    const players = parsePlayers(text, sport);

    if (players.length === 0) {
      log.warn({ sport, playerName, teamName }, "Single player fetch returned no results");
      return null;
    }

    const player = players[0]!;
    log.info({ sport, playerName, teamName, fieldsReturned: Object.keys(player).length }, "Fetched single player from Gemini");
    return player;
  } catch (error) {
    log.warn({ sport, playerName, teamName, error: String(error) }, "Failed to fetch single player from Gemini");
    return null;
  }
}

/**
 * Fetch latest status for a single match via Gemini AI.
 * Returns status, score, result, toss info, etc.
 */
export interface SingleMatchUpdate {
  status: "upcoming" | "live" | "completed" | "delayed" | "abandoned";
  scoreSummary: string | null;
  result: string | null;
  tossWinner: string | null;
  tossDecision: string | null;
}

export async function fetchSingleMatchStatus(
  teamHome: string,
  teamAway: string,
  tournament: string,
  format: string,
  startTime: Date | string,
  currentScore?: string | null
): Promise<SingleMatchUpdate | null> {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.API_KEY;
  if (!apiKey) return null;

  const ai = await getAI();
  const model = "gemini-3.1-flash-lite-preview";

  const dateStr = new Date(startTime).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const currentScoreContext = currentScore
    ? `\nCURRENT KNOWN SCORE: ${currentScore}\nIMPORTANT: Only return a score that is MORE RECENT than the above. If you cannot find a newer score, return the current score exactly as shown above. NEVER return an older or less detailed score.`
    : "";

  const prompt = `
Search for the LATEST live status of this cricket match:
- ${teamHome} vs ${teamAway}
- Tournament: ${tournament}
- Format: ${format}
- Scheduled: ${dateStr}
${currentScoreContext}

Return the data in this EXACT format:
[MATCH_STATUS_START]
status: <upcoming|live|completed|delayed|abandoned>
score: <MUST include overs, e.g. "India 185/4 (18.2 ov)" or "India 245/10 (50 ov) & 120/3 (30.1 ov) vs Australia 280/10 (49.5 ov)" — ALWAYS include "(X.Y ov)" after each innings score. Use "N/A" only if match not started>
result: <result text, e.g. "India won by 6 wickets" or "Match drawn" or "N/A" if not completed>
toss_winner: <team that won the toss, or "N/A" if toss hasn't happened>
toss_decision: <bat or bowl, or "N/A" if toss hasn't happened>
[MATCH_STATUS_END]

CRITICAL RULES:
1. Score MUST always include overs in parentheses — e.g. "India 30/1 (4.2 ov)" NOT "India 30/1"
2. Only return verified, current information from live sources
3. If the match hasn't started yet, status should be "upcoming" with N/A for score and result
4. Do NOT return a score that is older or less detailed than the current known score
`.trim();

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: { tools: [{ googleSearch: {} }] },
    });

    const text: string = response.text || "";
    const section = text.match(/\[MATCH_STATUS_START\]([\s\S]*?)\[MATCH_STATUS_END\]/);
    if (!section) {
      log.warn({ teamHome, teamAway }, "Single match status fetch returned no parseable data");
      return null;
    }

    const lines = section[1]!.split("\n").map((l) => l.trim()).filter(Boolean);
    const get = (key: string): string | null => {
      const line = lines.find((l) => l.toLowerCase().startsWith(`${key}:`));
      if (!line) return null;
      const val = line.substring(line.indexOf(":") + 1).trim();
      return val === "N/A" || val === "n/a" || val === "" ? null : val;
    };

    const rawStatus = get("status")?.toLowerCase() ?? "upcoming";
    const validStatuses = ["upcoming", "live", "completed", "delayed", "abandoned"] as const;
    const status = validStatuses.includes(rawStatus as any) ? (rawStatus as SingleMatchUpdate["status"]) : "upcoming";

    const result: SingleMatchUpdate = {
      status,
      scoreSummary: get("score"),
      result: get("result"),
      tossWinner: get("toss_winner"),
      tossDecision: get("toss_decision"),
    };

    log.info({ teamHome, teamAway, status: result.status, hasScore: !!result.scoreSummary }, "Fetched single match status from Gemini");
    return result;
  } catch (error) {
    log.warn({ teamHome, teamAway, error: String(error) }, "Failed to fetch single match status from Gemini");
    return null;
  }
}

/**
 * Fetch player rosters for given tournaments via Gemini AI.
 * Batches tournaments (3 per call) to stay within token limits.
 * Returns all players across all batches.
 */
export async function fetchPlayerRosters(
  sport: Sport,
  tournamentNames: string[]
): Promise<AIPlayer[]> {
  const config = SPORT_CONFIGS[sport];
  if (!config) {
    throw new Error(`No config found for sport: ${sport}`);
  }

  const apiKey = process.env.GEMINI_API_KEY ?? process.env.API_KEY;
  if (!apiKey) {
    log.warn("No GEMINI_API_KEY or API_KEY set — skipping player roster fetch");
    return [];
  }

  const ai = await getAI();
  const model = "gemini-3.1-flash-lite-preview";
  const allPlayers: AIPlayer[] = [];

  // Batch tournaments to avoid token limits
  for (let i = 0; i < tournamentNames.length; i += PLAYER_BATCH_SIZE) {
    const batch = tournamentNames.slice(i, i + PLAYER_BATCH_SIZE);
    const prompt = buildPlayerPrompt(sport, config.displayName, batch);

    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const text: string = response.text || "";
      const groundingChunks =
        response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const sources = groundingChunks
        .filter((c: any) => c.web?.uri)
        .map((c: any) => c.web.uri);

      const players = parsePlayers(text, sport);

      // Attach source URLs
      if (sources.length > 0) {
        players.forEach((p) => (p.sourceUrl = sources[0]));
      }

      allPlayers.push(...players);
      log.info(
        { sport, batch, playersFound: players.length },
        "Fetched player batch from Gemini"
      );
    } catch (error) {
      log.warn(
        { sport, batch, error: String(error) },
        "Failed to fetch player batch from Gemini"
      );
      // Continue with next batch — don't fail the whole operation
    }
  }

  return allPlayers;
}

// ---------------------------------------------------------------------------
// Tournament standings fetching via Gemini
// ---------------------------------------------------------------------------

const STANDINGS_BATCH_SIZE = 3;

function buildStandingsPrompt(
  sport: string,
  displayName: string,
  tournamentNames: string[]
): string {
  const tournamentList = tournamentNames.join(", ");
  return `
Search for the current points table / standings for these ${displayName.toLowerCase()} tournaments: ${tournamentList}.

Return the data in this EXACT format for me to parse:
[STANDINGS_START]
Standing: Position | Team | Played | Won | Lost | Tied | NR | Points | NRR | Group | Tournament Name
[STANDINGS_END]

Position: integer starting at 1
Played/Won/Lost/Tied/NR: integers (NR = no result)
Points: integer
NRR: net run rate as string with sign (e.g., "+0.825", "-1.234", "+0.000")
Group: group name (e.g., "Group A") or "N/A" if no groups
Tournament Name: must match exactly one of the requested tournament names

Example:
Standing: 1 | India | 5 | 4 | 1 | 0 | 0 | 8 | +1.250 | Group A | ICC Champions Trophy 2025
Standing: 2 | Australia | 5 | 3 | 2 | 0 | 0 | 6 | +0.430 | Group A | ICC Champions Trophy 2025

IMPORTANT — Team naming rules:
- Use the official team name as it appears in the tournament schedule.
- For women's tournaments, ALWAYS use women's team names (e.g., "India Women" not "India").
- For A-team / development tournaments, include the suffix (e.g., "Bangladesh A Women").
- Team names in standings MUST match exactly how teams appear in the match fixtures.

Return ALL teams for each tournament's standings. Order by position within each group/tournament.
`.trim();
}

function parseStandings(
  text: string
): Array<AITeamStanding & { tournamentName: string }> {
  const standings: Array<AITeamStanding & { tournamentName: string }> = [];
  const section = text.match(
    /\[STANDINGS_START\]([\s\S]*?)\[STANDINGS_END\]/
  );
  if (!section) return standings;

  const lines: string[] = section[1]?.match(/Standing: .+/g) || [];

  lines.forEach((line) => {
    const parts = line
      .replace("Standing: ", "")
      .split(" | ")
      .map((s) => s.trim());
    if (parts.length < 11) return;

    const position = parseInt(parts[0] ?? "", 10);
    const played = parseInt(parts[2] ?? "", 10);
    const won = parseInt(parts[3] ?? "", 10);
    const lost = parseInt(parts[4] ?? "", 10);
    const tied = parseInt(parts[5] ?? "", 10);
    const noResult = parseInt(parts[6] ?? "", 10);
    const points = parseInt(parts[7] ?? "", 10);

    // Validate all numeric fields
    if (
      [position, played, won, lost, tied, noResult, points].some(isNaN)
    ) {
      return;
    }

    const nrr = parts[8] ?? "+0.000";
    const group = parts[9] && parts[9] !== "N/A" ? parts[9] : null;
    const tournamentName = parts[10] || "Unknown Tournament";

    standings.push({
      position,
      team: parts[1] || "Unknown",
      played,
      won,
      lost,
      tied,
      noResult,
      points,
      netRunRate: nrr,
      group,
      tournamentName,
    });
  });

  return standings;
}

/**
 * Fetch tournament standings (points tables) via Gemini AI.
 * Batches tournaments (3 per call) to stay within token limits.
 * Returns a Map of tournamentName → AITeamStanding[].
 */
export async function fetchTournamentStandings(
  sport: Sport,
  tournamentNames: string[]
): Promise<Map<string, AITeamStanding[]>> {
  const config = SPORT_CONFIGS[sport];
  if (!config) {
    throw new Error(`No config found for sport: ${sport}`);
  }

  const apiKey = process.env.GEMINI_API_KEY ?? process.env.API_KEY;
  if (!apiKey) {
    log.warn("No GEMINI_API_KEY or API_KEY set — skipping standings fetch");
    return new Map();
  }

  const ai = await getAI();
  const model = "gemini-3.1-flash-lite-preview";
  const result = new Map<string, AITeamStanding[]>();

  for (let i = 0; i < tournamentNames.length; i += STANDINGS_BATCH_SIZE) {
    const batch = tournamentNames.slice(i, i + STANDINGS_BATCH_SIZE);
    const prompt = buildStandingsPrompt(sport, config.displayName, batch);

    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const text: string = response.text || "";
      const parsed = parseStandings(text);

      // Group by tournament name
      for (const entry of parsed) {
        const { tournamentName, ...standing } = entry;
        if (!result.has(tournamentName)) {
          result.set(tournamentName, []);
        }
        result.get(tournamentName)!.push(standing);
      }

      log.info(
        { sport, batch, standingsFound: parsed.length },
        "Fetched standings batch from Gemini"
      );
    } catch (error) {
      log.warn(
        { sport, batch, error: String(error) },
        "Failed to fetch standings batch from Gemini"
      );
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Player enrichment — focused AI pass for form, sentiment, injury data
// ---------------------------------------------------------------------------

export interface PlayerEnrichmentData {
  name: string;
  team: string;
  recentForm: number | null;
  sentimentScore: number | null;
  injuryStatus: string | null;
  formNote: string | null;
}

const ENRICHMENT_BATCH_SIZE = 10;

function buildEnrichmentPrompt(
  players: Array<{ name: string; team: string; role: string }>,
  tournamentName: string
): string {
  const playerList = players.map((p) => `- ${p.name} (${p.team}, ${p.role})`).join("\n");

  return `
You are a cricket analyst. For each player below, provide their CURRENT form assessment based on the latest matches in "${tournamentName}" (or their most recent competitive cricket if the tournament hasn't started yet).

Players:
${playerList}

Return data in this EXACT format — one line per player, between markers:

[ENRICHMENT_START]
${players.map((p) => `${p.name} | ${p.team} | Recent Form (1-10) | Sentiment (1-10) | Injury Status | Form Note`).join("\n")}
[ENRICHMENT_END]

Field definitions:
1. Player Name — EXACT name from the list above
2. Team Name — EXACT team from the list above
3. Recent Form (1-10) — performance in last 5 matches. 10=exceptional (100+ runs or 3+ wickets consistently), 7=good, 5=average, 3=poor, 1=terrible
4. Sentiment (1-10) — current media/fan perception. 10=massive positive hype, 7=well-regarded, 5=neutral, 3=under scrutiny, 1=heavy criticism
5. Injury Status — EXACTLY one of: fit, doubtful, injured, recovered
6. Form Note — ONE sentence summarizing current form from recent matches/news

IMPORTANT:
- Use REAL data from recent matches. Do NOT guess or make up statistics.
- If you cannot find recent data for a player, use 5 for form, 5 for sentiment, "fit" for injury, and note the lack of data.
- Return EXACTLY ${players.length} lines between the markers.
`.trim();
}

function parseEnrichmentResponse(text: string): PlayerEnrichmentData[] {
  const results: PlayerEnrichmentData[] = [];

  const startIdx = text.indexOf("[ENRICHMENT_START]");
  const endIdx = text.indexOf("[ENRICHMENT_END]");
  if (startIdx === -1 || endIdx === -1) {
    log.warn("Enrichment response missing markers");
    return results;
  }

  const block = text.slice(startIdx + "[ENRICHMENT_START]".length, endIdx).trim();
  const lines = block.split("\n").filter((l) => l.trim().length > 0);

  for (const line of lines) {
    const parts = line.split("|").map((p) => p.trim());
    if (parts.length < 6) continue;

    const name = parts[0]!;
    const team = parts[1]!;

    const formRaw = parseFloat(parts[2] ?? "");
    const recentForm = !isNaN(formRaw) ? Math.max(1, Math.min(10, formRaw)) : null;

    const sentRaw = parseFloat(parts[3] ?? "");
    const sentimentScore = !isNaN(sentRaw) ? Math.max(1, Math.min(10, sentRaw)) : null;

    const injuryRaw = (parts[4] ?? "").toLowerCase();
    const validInjury = ["fit", "doubtful", "injured", "recovered"];
    const injuryStatus = validInjury.includes(injuryRaw) ? injuryRaw : null;

    const formNote = parts[5] && parts[5] !== "N/A" ? parts[5] : null;

    results.push({ name, team, recentForm, sentimentScore, injuryStatus, formNote });
  }

  return results;
}

/**
 * Enrich players with AI-assessed form, sentiment, injury status, and form notes.
 * Takes existing player data (name/team/role) and returns enrichment-only fields.
 * Batches players (10 per call) to stay within token limits.
 */
export async function enrichPlayersWithGemini(
  players: Array<{ name: string; team: string; role: string }>,
  tournamentName: string
): Promise<PlayerEnrichmentData[]> {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.API_KEY;
  if (!apiKey) {
    log.warn("No Gemini API key — skipping enrichment");
    return [];
  }

  const ai = await getAI();
  const model = "gemini-3.1-flash-lite-preview";
  const allResults: PlayerEnrichmentData[] = [];

  for (let i = 0; i < players.length; i += ENRICHMENT_BATCH_SIZE) {
    const batch = players.slice(i, i + ENRICHMENT_BATCH_SIZE);
    const prompt = buildEnrichmentPrompt(batch, tournamentName);

    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: { tools: [{ googleSearch: {} }] },
      });

      const text: string = response.text || "";
      const parsed = parseEnrichmentResponse(text);
      allResults.push(...parsed);

      log.info(
        { batchStart: i, batchSize: batch.length, enriched: parsed.length, tournament: tournamentName },
        "Enrichment batch completed"
      );
    } catch (error) {
      log.warn(
        { batchStart: i, batchSize: batch.length, error: String(error) },
        "Enrichment batch failed"
      );
    }
  }

  return allResults;
}

// ---------------------------------------------------------------------------
// Nationality resolution — Gemini AI determines player country from name/birthPlace/team
// ---------------------------------------------------------------------------

export interface NationalityResult {
  playerName: string;
  nationality: string;
}

/**
 * Use Gemini to resolve nationalities for a batch of cricket players.
 * Takes player name, birth place (from Cricbuzz), and team name → returns country.
 * This replaces hardcoded city/state lookup tables with AI-based resolution.
 */
export async function resolveNationalitiesWithGemini(
  players: Array<{ name: string; birthPlace: string | null; team: string }>,
): Promise<NationalityResult[]> {
  if (players.length === 0) return [];

  const apiKey = process.env.GEMINI_API_KEY ?? process.env.API_KEY;
  if (!apiKey) {
    log.warn("No Gemini API key — skipping nationality resolution");
    return [];
  }

  const ai = await getAI();
  const model = "gemini-3.1-flash-lite-preview";
  const BATCH_SIZE = 30;
  const allResults: NationalityResult[] = [];

  for (let i = 0; i < players.length; i += BATCH_SIZE) {
    const batch = players.slice(i, i + BATCH_SIZE);

    const playerLines = batch.map((p, idx) =>
      `${idx + 1}. ${p.name} | Birth Place: ${p.birthPlace || "unknown"} | Team: ${p.team}`
    ).join("\n");

    const prompt = `You are a cricket expert. For each player below, determine their NATIONALITY (the country they represent in international cricket, or their country of origin).

RULES:
- Return the country name (e.g., "India", "Australia", "England", "South Africa", "Afghanistan", "New Zealand", "West Indies", "Pakistan", "Sri Lanka", "Bangladesh", "Zimbabwe", "Ireland", "Netherlands", "USA", "Nepal", "Oman", "Namibia", "Scotland", "UAE", "Canada")
- For Caribbean players, use "West Indies"
- The team name is the franchise/club (e.g., "Mumbai Indians", "Chennai Super Kings") — do NOT use it as nationality
- Use your knowledge of cricket players to determine the correct country
- If the birth place is a city/state, infer the country from it
- If unsure, use "Unknown"

Players:
${playerLines}

Return ONLY in this exact format, one per line:
1. Player Name | Country
2. Player Name | Country
...`;

    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
      });

      const text: string = response.text || "";
      const lines = text.split("\n").filter((l: string) => l.trim());

      for (const line of lines) {
        const match = line.match(/^\d+\.\s*(.+?)\s*\|\s*(.+)$/);
        if (match) {
          allResults.push({
            playerName: match[1]!.trim(),
            nationality: match[2]!.trim(),
          });
        }
      }

      log.info(
        { batchStart: i, batchSize: batch.length, resolved: allResults.length },
        "Nationality resolution batch completed"
      );
    } catch (error) {
      log.warn(
        { batchStart: i, batchSize: batch.length, error: String(error) },
        "Nationality resolution batch failed"
      );
    }
  }

  return allResults;
}
