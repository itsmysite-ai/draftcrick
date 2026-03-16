/**
 * Cricbuzz DataProvider.
 * Scrapes Cricbuzz for ALL cricket data: tournaments, matches, standings, players.
 * Uses HTML parsing for schedule/live pages and RSC JSON extraction for series data.
 */

import type { Sport, AIPlayer, AITournament, AITeamStanding, SportsDashboardData } from "@draftplay/shared";
import type { DataProvider, DataSourceType, ProviderResult } from "../types";
import {
  fetchPage,
  resolveTeam,
  parseTeamPlayersPage,
  parsePlayerProfilePage,
  parseSchedulePage,
  parseLiveScoresPage,
  fetchSeriesMatches,
  fetchPointsTable,
  resolveSeries,
  cacheSeriesMapping,
  fetchScorecardPlayers,
  resolveCricbuzzMatchId,
  fetchSeriesSquadPlayers,
  fetchMatchToss,
  type CricbuzzPlayerLink,
} from "./cricbuzz-client";
import { mapCricbuzzPlayerToAIPlayer } from "./cricbuzz-player-mapper";
import {
  mapScheduleEntryToTournament,
  mapRscMatchToAIMatch,
  mapRscPointsTableToStandings,
  shouldIncludeTournament,
} from "./cricbuzz-dashboard-mapper";
import { getLogger } from "../../lib/logger";

const log = getLogger("cricbuzz-provider");

/** Max players to fetch detailed stats for per team (to limit scraping) */
const MAX_PLAYERS_PER_TEAM = 25;
/** Max concurrent profile fetches */
const CONCURRENCY = 3;
/** Max series to fetch detailed matches for during dashboard refresh */
const MAX_SERIES_DETAIL_FETCH = 5;

/**
 * Map Cricbuzz squad role text (e.g. "Batter", "All-Rounder", "Bowler") to AIPlayer role.
 */
function mapSquadRole(
  roleText: string,
  isKeeper: boolean
): AIPlayer["role"] {
  if (isKeeper) return "wicket_keeper";
  const lower = roleText.toLowerCase();
  if (lower.includes("bat")) return "batsman";
  if (lower.includes("bowl")) return "bowler";
  if (lower.includes("all")) return "all_rounder";
  if (lower.includes("wk") || lower.includes("keeper")) return "wicket_keeper";
  return "all_rounder"; // fallback
}

/**
 * Fetch profiles in batches with limited concurrency.
 */
async function fetchProfilesBatched(
  playerLinks: CricbuzzPlayerLink[],
  teamName: string,
  tournamentName: string
): Promise<AIPlayer[]> {
  const results: AIPlayer[] = [];

  for (let i = 0; i < playerLinks.length; i += CONCURRENCY) {
    const batch = playerLinks.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.allSettled(
      batch.map(async (link) => {
        try {
          const $ = await fetchPage(`/profiles/${link.profileId}/${link.slug}`);
          const profile = parsePlayerProfilePage($);
          return mapCricbuzzPlayerToAIPlayer(profile, teamName, tournamentName, link.profileId);
        } catch (err) {
          log.warn(
            { profileId: link.profileId, name: link.name, error: err instanceof Error ? err.message : String(err) },
            "Failed to fetch player profile"
          );
          return null;
        }
      })
    );

    for (const result of batchResults) {
      if (result.status === "fulfilled" && result.value) {
        results.push(result.value);
      }
    }
  }

  return results;
}

export class CricbuzzProvider implements DataProvider {
  readonly source: DataSourceType = "cricbuzz";
  readonly supportedSports: Sport[] = ["cricket"];

  /**
   * Fetch tournaments + matches for cricket dashboard.
   * 1. Scrape live scores page for current matches
   * 2. Scrape schedule pages for upcoming series (international + league)
   * 3. For active tournaments, fetch detailed match lists via RSC JSON
   */
  async fetchDashboard(
    _sport: Sport,
    activeTournaments?: string[],
    seriesHints?: Array<{ name: string; externalId: string }>
  ): Promise<ProviderResult<SportsDashboardData>> {
    const start = Date.now();
    const tournaments: AITournament[] = [];
    const matches: import("@draftplay/shared").AIMatch[] = [];
    const sources: string[] = [];
    const seenTournamentIds = new Set<string>();
    const seenMatchIds = new Set<string>();

    // Step 1: Fetch live scores page — used ONLY to discover active series IDs.
    // Does NOT create tournament entries (live page names are messy — trailing commas, missing years).
    // Tournament entries are created in Step 2 from schedule pages which have clean data.
    const liveSeriesIds = new Set<number>();
    try {
      const live$ = await fetchPage("/cricket-match/live-scores");
      const liveMatches = parseLiveScoresPage(live$);
      sources.push("https://www.cricbuzz.com/cricket-match/live-scores");

      for (const lm of liveMatches) {
        if (!shouldIncludeTournament(lm.seriesName)) continue;
        if (lm.seriesId) {
          liveSeriesIds.add(lm.seriesId);
        }
      }
      log.info({ liveSeriesCount: liveSeriesIds.size }, "Discovered active series from live scores");
    } catch (err) {
      log.warn({ error: err instanceof Error ? err.message : String(err) }, "Failed to fetch live scores");
    }

    // Step 2: Fetch schedule pages for tournament discovery
    const scheduleCategories = ["international", "league"] as const;
    for (const category of scheduleCategories) {
      try {
        const $ = await fetchPage(`/cricket-schedule/series/${category}`);
        const entries = parseSchedulePage($, category);
        sources.push(`https://www.cricbuzz.com/cricket-schedule/series/${category}`);

        for (const entry of entries) {
          if (!shouldIncludeTournament(entry.seriesName)) continue;
          if (!entry.dateRange) continue; // skip entries without date info

          const tournament = mapScheduleEntryToTournament(entry);
          if (!seenTournamentIds.has(tournament.id)) {
            seenTournamentIds.add(tournament.id);
            tournaments.push(tournament);
          }
        }
      } catch (err) {
        log.warn({ category, error: err instanceof Error ? err.message : String(err) }, "Failed to fetch schedule page");
      }
    }

    // Step 3: For active tournaments (or top discovered ones), fetch detailed matches via RSC JSON.
    // RSC JSON provides timestamps, formats, venues — everything needed for stable match externalIds.
    const seriesToFetch: Array<{ id: number; slug: string; name: string }> = [];

    // Build a set of hint externalIds for quick lookup
    const hintExternalIds = new Set<string>();
    if (seriesHints) {
      for (const hint of seriesHints) {
        hintExternalIds.add(hint.externalId.toLowerCase());
      }
    }

    // Use series hints (externalId-based) for precise resolution — avoids name collision issues
    if (seriesHints && seriesHints.length > 0) {
      for (const hint of seriesHints) {
        if (hint.externalId.startsWith("cb-")) {
          const seriesId = parseInt(hint.externalId.replace("cb-", ""), 10);
          if (!isNaN(seriesId)) {
            // Find slug from schedule-discovered tournaments first (by ID), then cache, then generate
            const scheduleEntry = tournaments.find(t => t.id === hint.externalId);
            const cachedSeries = resolveSeries(hint.name);
            const slug = scheduleEntry?.sourceUrl?.match(/\/([^/]+)\/matches/)?.[1]
              ?? cachedSeries?.slug
              ?? hint.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
            seriesToFetch.push({ id: seriesId, slug, name: hint.name });
            log.info({ name: hint.name, seriesId, slug, source: "externalId-hint" }, "Resolved series from externalId hint");

            // Ensure we have a tournament entry with this exact externalId
            if (!seenTournamentIds.has(hint.externalId)) {
              // Create a tournament entry for this hint — schedule may not have this exact ID
              tournaments.push({
                id: hint.externalId,
                name: hint.name,
                sport: "cricket",
                category: "league",
                startDate: scheduleEntry?.startDate ?? null,
                endDate: scheduleEntry?.endDate ?? null,
                imageUrl: null,
                sourceUrl: `https://www.cricbuzz.com/cricket-series/${seriesId}`,
                description: hint.name,
              });
              seenTournamentIds.add(hint.externalId);
            }
          }
        }
      }
    }

    if (activeTournaments && activeTournaments.length > 0) {
      for (const name of activeTournaments) {
        // Skip all activeTournaments if we already have seriesHints — hints are authoritative
        if (seriesHints && seriesHints.length > 0) continue;
        const series = resolveSeries(name);
        if (series) {
          // Skip if this series ID is already being fetched
          if (!seriesToFetch.some(s => s.id === series.id)) {
            seriesToFetch.push({ id: series.id, slug: series.slug, name });
            log.info({ name, seriesId: series.id, slug: series.slug }, "Resolved active tournament to series");
          }
        } else {
          log.warn({ name }, "Could not resolve active tournament to Cricbuzz series");
        }
      }
    }

    // Fetch matches for tournaments discovered from live scores + schedule
    for (const t of tournaments) {
      const seriesId = parseInt(t.id.replace("cb-", ""), 10);
      if (isNaN(seriesId)) continue;
      if (seriesToFetch.some((s) => s.id === seriesId)) continue;

      // If seriesHints are provided, only fetch series that are in the hints
      // (prevents fetching unrelated tournaments when refreshing a specific one)
      if (hintExternalIds.size > 0 && !hintExternalIds.has(t.id.toLowerCase())) continue;

      const series = resolveSeries(t.name);
      if (series) {
        seriesToFetch.push({ id: series.id, slug: series.slug, name: t.name });
      } else {
        // No cached slug — generate from the series ID and tournament's sourceUrl
        const slugFromUrl = t.sourceUrl?.match(/\/cricket-series\/\d+\/([^/]+)/)?.[1];
        const slug = slugFromUrl ?? t.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        seriesToFetch.push({ id: seriesId, slug, name: t.name });
      }
    }

    // Fetch detailed matches for each series (limited to avoid excessive scraping)
    log.info({ seriesToFetch: seriesToFetch.map(s => ({ id: s.id, slug: s.slug, name: s.name })) }, "Series to fetch matches for");
    for (const series of seriesToFetch.slice(0, MAX_SERIES_DETAIL_FETCH)) {
      try {
        const matchesData = await fetchSeriesMatches(series.id, series.slug);
        log.info({ seriesId: series.id, hasData: !!matchesData, detailCount: matchesData?.matchDetails?.length ?? 0 }, "Fetched series matches RSC data");
        if (matchesData?.matchDetails) {
          // Find the tournament we created for this series so matches use the same externalId
          const parentTournament = tournaments.find(t => t.id === `cb-${series.id}`);
          const parentExternalId = parentTournament?.id ?? `cb-${series.id}`;

          for (const detail of matchesData.matchDetails) {
            if (!detail.matchDetailsMap?.match) continue;
            for (const matchEntry of detail.matchDetailsMap.match) {
              const aiMatch = mapRscMatchToAIMatch(matchEntry);
              // Ensure match's tournamentExternalId matches the tournament entry we created,
              // even if the RSC JSON returns a slightly different seriesId
              aiMatch.tournamentExternalId = parentExternalId;
              if (!seenMatchIds.has(aiMatch.id)) {
                seenMatchIds.add(aiMatch.id);
                matches.push(aiMatch);
              }
            }
          }
          sources.push(`https://www.cricbuzz.com/cricket-series/${series.id}/${series.slug}/matches`);
        }
      } catch (err) {
        log.warn(
          { seriesId: series.id, name: series.name, error: err instanceof Error ? err.message : String(err) },
          "Failed to fetch series matches"
        );
      }
    }

    const durationMs = Date.now() - start;
    log.info(
      { tournaments: tournaments.length, matches: matches.length, durationMs },
      "Cricbuzz fetchDashboard complete"
    );

    return {
      data: {
        tournaments,
        matches,
        lastFetched: new Date().toISOString(),
        sources,
        sport: "cricket",
      },
      source: "cricbuzz",
      fetchedAt: new Date().toISOString(),
      durationMs,
    };
  }

  /**
   * Discover available tournaments from Cricbuzz schedule.
   * Fetches both the schedule pages and the all-series listing.
   */
  async discoverTournaments(_sport: Sport): Promise<ProviderResult<AITournament[]>> {
    const start = Date.now();
    const tournaments: AITournament[] = [];
    const seenIds = new Set<string>();

    // Fetch schedule pages (international + league)
    for (const category of ["international", "league"] as const) {
      try {
        const $ = await fetchPage(`/cricket-schedule/series/${category}`);
        const entries = parseSchedulePage($, category);

        for (const entry of entries) {
          if (!shouldIncludeTournament(entry.seriesName)) continue;
          if (!entry.dateRange) continue; // skip entries without date info
          const tournament = mapScheduleEntryToTournament(entry);
          if (!seenIds.has(tournament.id)) {
            seenIds.add(tournament.id);
            tournaments.push(tournament);
          }
        }
      } catch (err) {
        log.warn({ category, error: err instanceof Error ? err.message : String(err) }, "Failed to fetch schedule");
      }
    }

    // Note: all-series page (/cricket-schedule/series/all) intentionally skipped —
    // it returns noisy data with incomplete names (trailing commas, missing years).
    // Schedule pages + live scores already discover all relevant tournaments.

    const durationMs = Date.now() - start;
    log.info({ count: tournaments.length, durationMs }, "Cricbuzz discoverTournaments complete");

    return {
      data: tournaments,
      source: "cricbuzz",
      fetchedAt: new Date().toISOString(),
      durationMs,
    };
  }

  /**
   * Fetch standings/points tables for specified tournaments.
   * Uses RSC JSON extraction from Cricbuzz points table pages.
   */
  async fetchStandings(
    _sport: Sport,
    tournamentNames: string[]
  ): Promise<ProviderResult<Map<string, AITeamStanding[]>>> {
    const start = Date.now();
    const standingsMap = new Map<string, AITeamStanding[]>();

    // Pre-populate cache if empty (e.g., after server restart)
    if (!resolveSeries(tournamentNames[0] ?? "")) {
      log.info("Series cache empty — re-discovering from schedule pages");
      for (const category of ["international", "league"] as const) {
        try {
          const $ = await fetchPage(`/cricket-schedule/series/${category}`);
          parseSchedulePage($, category);
        } catch { /* ignore */ }
      }
    }

    for (const name of tournamentNames) {
      const series = resolveSeries(name);
      if (!series) {
        log.warn({ tournamentName: name }, "Cannot resolve series for standings — not in cache");
        continue;
      }

      try {
        const data = await fetchPointsTable(series.id, series.slug);
        if (data?.pointsTable && data.pointsTable.length > 0) {
          const standings = mapRscPointsTableToStandings(data);
          standingsMap.set(name, standings);
          log.info({ tournamentName: name, teams: standings.length }, "Fetched standings from Cricbuzz");
        } else {
          log.info({ tournamentName: name }, "No points table available on Cricbuzz");
        }
      } catch (err) {
        log.warn(
          { tournamentName: name, seriesId: series.id, error: err instanceof Error ? err.message : String(err) },
          "Failed to fetch standings from Cricbuzz"
        );
      }
    }

    const durationMs = Date.now() - start;
    log.info({ tournaments: tournamentNames, standingsCount: standingsMap.size, durationMs }, "Cricbuzz fetchStandings complete");

    return {
      data: standingsMap,
      source: "cricbuzz",
      fetchedAt: new Date().toISOString(),
      durationMs,
    };
  }

  /**
   * Fetch live match status from Cricbuzz RSC data.
   * Resolves the match by team names + date within the series, then extracts score/result/toss.
   */
  async fetchMatchStatus(
    _sport: Sport,
    teamHome: string,
    teamAway: string,
    tournament: string,
    _format: string,
    startTime: Date | string,
    _currentScore?: string
  ): Promise<ProviderResult<{ status: string; scoreSummary: string | null; result: string | null; tossWinner: string | null; tossDecision: string | null } | null>> {
    const start = Date.now();

    let series = resolveSeries(tournament);
    if (!series) {
      // Try populating cache from schedule pages
      for (const category of ["international", "league"] as const) {
        try {
          const $ = await fetchPage(`/cricket-schedule/series/${category}`);
          parseSchedulePage($, category);
        } catch { /* ignore */ }
      }
      series = resolveSeries(tournament);
    }

    if (!series) {
      log.warn({ tournament, teamHome, teamAway }, "Cannot resolve series for match status");
      return { data: null, source: "cricbuzz", fetchedAt: new Date().toISOString(), durationMs: Date.now() - start };
    }

    // Fetch series matches and find the specific match
    const matchesData = await fetchSeriesMatches(series.id, series.slug);
    if (!matchesData?.matchDetails) {
      return { data: null, source: "cricbuzz", fetchedAt: new Date().toISOString(), durationMs: Date.now() - start };
    }

    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
    const homeNorm = normalize(teamHome);
    const awayNorm = normalize(teamAway);
    const matchStartTime = typeof startTime === "string" ? new Date(startTime) : startTime;
    const targetDate = matchStartTime.toISOString().slice(0, 10);

    for (const detail of matchesData.matchDetails) {
      const entries = detail.matchDetailsMap?.match;
      if (!entries) continue;

      for (const entry of entries) {
        const mi = entry.matchInfo;
        const t1 = normalize(mi.team1.teamName);
        const t2 = normalize(mi.team2.teamName);

        const teamsMatch =
          ((t1.includes(homeNorm) || homeNorm.includes(t1)) &&
           (t2.includes(awayNorm) || awayNorm.includes(t2))) ||
          ((t1.includes(awayNorm) || awayNorm.includes(t1)) &&
           (t2.includes(homeNorm) || homeNorm.includes(t2)));

        if (!teamsMatch) continue;

        const matchDate = new Date(parseInt(mi.startDate, 10));
        const dayDiff = Math.abs(matchDate.getTime() - matchStartTime.getTime()) / (1000 * 60 * 60 * 24);
        if (dayDiff > 2) continue;

        log.info({ matchId: mi.matchId, team1: mi.team1.teamName, team2: mi.team2.teamName, matchDesc: mi.matchDesc, state: mi.state, statusText: mi.status }, "Matched Cricbuzz match for status fetch");

        // Build score summary from match scores
        let scoreSummary: string | null = null;
        const ms = entry.matchScore;
        if (ms) {
          const parts: string[] = [];
          const formatInnings = (inn?: { runs: number; wickets: number; overs: number }) =>
            inn ? `${inn.runs}/${inn.wickets} (${inn.overs})` : null;

          const t1i1 = formatInnings(ms.team1Score?.inngs1);
          const t1i2 = formatInnings(ms.team1Score?.inngs2);
          const t2i1 = formatInnings(ms.team2Score?.inngs1);
          const t2i2 = formatInnings(ms.team2Score?.inngs2);

          if (t1i1) parts.push(`${mi.team1.teamSName} ${t1i1}${t1i2 ? ` & ${t1i2}` : ""}`);
          if (t2i1) parts.push(`${mi.team2.teamSName} ${t2i1}${t2i2 ? ` & ${t2i2}` : ""}`);
          if (parts.length > 0) scoreSummary = parts.join(" vs ");
        }

        // Determine status
        const state = mi.state?.toLowerCase();
        let status: string;
        if (state === "complete" || state === "completed") status = "completed";
        else if (state === "in progress") status = "live";
        else status = "upcoming";

        // Result text (e.g., "India won by 5 wickets")
        const result = (state === "complete" || state === "completed") ? (mi.status || null) : null;

        // Toss info — try status string first, then fetch from match page
        let tossWinner: string | null = null;
        let tossDecision: string | null = null;
        const tossMatch = mi.status?.match(/(\w[\w\s]+?)\s+(?:opt|elected|chose)\s+to\s+(bat|bowl|field)/i);
        if (tossMatch) {
          tossWinner = tossMatch[1]!.trim();
          tossDecision = tossMatch[2]!.toLowerCase() === "bat" ? "bat" : "bowl";
        }

        // If no toss from status string and match is live/completed, fetch from match info page
        if (!tossWinner && status !== "upcoming") {
          const matchSlug = `${mi.team1.teamSName.toLowerCase()}-vs-${mi.team2.teamSName.toLowerCase()}-${mi.matchDesc.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
          log.info({ matchId: mi.matchId, matchSlug, url: `/live-cricket-scores/${mi.matchId}/${matchSlug}` }, "Fetching toss from match page");
          const tossData = await fetchMatchToss(mi.matchId, matchSlug, [teamHome, teamAway]);
          if (tossData) {
            tossWinner = tossData.tossWinner;
            tossDecision = tossData.tossDecision;
          }
        }

        const durationMs = Date.now() - start;
        log.info({ matchId: mi.matchId, status, scoreSummary, result, tossWinner, tossDecision, durationMs }, "Cricbuzz fetchMatchStatus complete");

        return {
          data: { status, scoreSummary, result, tossWinner, tossDecision },
          source: "cricbuzz",
          fetchedAt: new Date().toISOString(),
          durationMs,
        };
      }
    }

    log.warn({ tournament, teamHome, teamAway, targetDate }, "Match not found in Cricbuzz series data");
    return { data: null, source: "cricbuzz", fetchedAt: new Date().toISOString(), durationMs: Date.now() - start };
  }

  async fetchPlayers(
    sport: Sport,
    teamNames: string[],
    tournamentName: string,
    _existingPlayerNames?: string[],
    matchContext?: { startTime: Date; format?: string },
    tournamentExternalId?: string
  ): Promise<ProviderResult<AIPlayer[]>> {
    const start = Date.now();
    const allPlayers: AIPlayer[] = [];

    // Pre-cache series mapping from externalId hint (avoids name collision between editions)
    if (tournamentExternalId?.startsWith("cb-")) {
      const seriesId = parseInt(tournamentExternalId.replace("cb-", ""), 10);
      if (!isNaN(seriesId)) {
        const existing = resolveSeries(tournamentName);
        if (!existing || existing.id !== seriesId) {
          const slug = existing?.slug ?? tournamentName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
          cacheSeriesMapping(tournamentName, { id: seriesId, slug });
          log.info({ tournamentName, seriesId, source: "externalId-hint" }, "Cached series mapping from externalId hint for fetchPlayers");
        }
      }
    }

    // Strategy 1: Try scorecard-based approach (gives exact playing XI)
    // Only works for completed/in-progress matches with scorecard data
    if (matchContext?.startTime) {
      const scorecardPlayers = await this.fetchPlayersFromScorecard(
        teamNames, tournamentName, matchContext.startTime
      );
      if (scorecardPlayers.length > 0) {
        // Fetch full profiles for the playing XI players only
        const profilePlayers = await this.enrichScorecardPlayers(scorecardPlayers, tournamentName);
        const durationMs = Date.now() - start;
        log.info({ teams: teamNames, totalPlayers: profilePlayers.length, durationMs, method: "scorecard" }, "Cricbuzz fetchPlayers complete (scorecard)");
        return {
          data: profilePlayers,
          source: "cricbuzz",
          fetchedAt: new Date().toISOString(),
          durationMs,
        };
      }
      log.info({ teams: teamNames }, "Scorecard approach failed, trying squad page");
    }

    // Strategy 2: Try Playwright-based squad scraping (announced tournament squads)
    {
      const squadPlayers = await this.fetchPlayersFromSquadPage(teamNames, tournamentName);
      if (squadPlayers.length > 0) {
        const profilePlayers = await this.enrichSquadPagePlayers(squadPlayers, tournamentName);
        const durationMs = Date.now() - start;
        log.info({ teams: teamNames, totalPlayers: profilePlayers.length, durationMs, method: "squad-page" }, "Cricbuzz fetchPlayers complete (squad page)");
        return {
          data: profilePlayers,
          source: "cricbuzz",
          fetchedAt: new Date().toISOString(),
          durationMs,
        };
      }
      log.info({ teams: teamNames }, "Squad page approach failed, falling back to full roster");
    }

    // Strategy 3: Fallback — full team roster page
    for (const teamName of teamNames) {
      const team = resolveTeam(teamName);
      if (!team) {
        log.warn({ teamName }, "Team not found in Cricbuzz mapping — skipping");
        continue;
      }

      log.info({ teamName, slug: team.slug, id: team.id }, "Fetching team roster from Cricbuzz");

      // Step 1: Get player list from team page
      const $ = await fetchPage(`/cricket-team/${team.slug}/${team.id}/players`);
      const playerLinks = parseTeamPlayersPage($).slice(0, MAX_PLAYERS_PER_TEAM);

      if (playerLinks.length === 0) {
        log.warn({ teamName }, "No players found on Cricbuzz team page");
        continue;
      }

      log.info({ teamName, count: playerLinks.length }, "Found players on Cricbuzz team page");

      // Step 2: Fetch individual profiles with stats
      const teamPlayers = await fetchProfilesBatched(playerLinks, teamName, tournamentName);
      allPlayers.push(...teamPlayers);

      log.info({ teamName, fetched: teamPlayers.length }, "Player profiles fetched from Cricbuzz");
    }

    const durationMs = Date.now() - start;
    log.info({ teams: teamNames, totalPlayers: allPlayers.length, durationMs, method: "roster" }, "Cricbuzz fetchPlayers complete (roster)");

    return {
      data: allPlayers,
      source: "cricbuzz",
      fetchedAt: new Date().toISOString(),
      durationMs,
    };
  }

  /**
   * Try to fetch playing XI from the match scorecard.
   * Resolves Cricbuzz match ID via series match list, then scrapes the scorecard.
   */
  private async fetchPlayersFromScorecard(
    teamNames: string[],
    tournamentName: string,
    startTime: Date
  ): Promise<import("./cricbuzz-client").ScorecardPlayer[]> {
    try {
      let series = resolveSeries(tournamentName);

      // If series not in cache, try populating cache from schedule pages first
      if (!series) {
        log.info({ tournamentName }, "Series not cached — fetching schedule pages to populate cache");
        for (const category of ["international", "league"] as const) {
          try {
            const $ = await fetchPage(`/cricket-schedule/series/${category}`);
            parseSchedulePage($, category); // This calls cacheSeriesMapping internally
          } catch {
            // Ignore schedule fetch errors
          }
        }
        series = resolveSeries(tournamentName);
      }

      if (!series) {
        log.debug({ tournamentName }, "Tournament not resolved to Cricbuzz series for scorecard lookup");
        return [];
      }

      const teamHome = teamNames[0] ?? "";
      const teamAway = teamNames[1] ?? "";
      const cricbuzzMatchId = await resolveCricbuzzMatchId(
        series.id, series.slug, teamHome, teamAway, startTime
      );
      if (!cricbuzzMatchId) return [];

      return await fetchScorecardPlayers(cricbuzzMatchId);
    } catch (err) {
      log.warn({ error: err instanceof Error ? err.message : String(err) }, "Scorecard player fetch failed");
      return [];
    }
  }

  /**
   * Enrich scorecard players by fetching their individual profile pages for full stats.
   * Only fetches profiles for the playing XI (typically 22 players total).
   */
  private async enrichScorecardPlayers(
    scorecardPlayers: import("./cricbuzz-client").ScorecardPlayer[],
    tournamentName: string
  ): Promise<AIPlayer[]> {
    // Convert scorecard player IDs to profile links by looking up team pages
    // But since we have the player IDs, we can construct profile URLs directly
    // Cricbuzz profile URL: /profiles/{id}/{slug}
    const playerLinks: Array<CricbuzzPlayerLink & { teamName: string }> = scorecardPlayers.map(sp => ({
      profileId: String(sp.id),
      slug: sp.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      name: sp.name,
      teamName: sp.teamName,
    }));

    const results: AIPlayer[] = [];
    for (let i = 0; i < playerLinks.length; i += CONCURRENCY) {
      const batch = playerLinks.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.allSettled(
        batch.map(async (link) => {
          try {
            const $ = await fetchPage(`/profiles/${link.profileId}/${link.slug}`);
            const profile = parsePlayerProfilePage($);
            return mapCricbuzzPlayerToAIPlayer(profile, link.teamName, tournamentName, link.profileId);
          } catch (err) {
            log.warn(
              { profileId: link.profileId, name: link.name, error: err instanceof Error ? err.message : String(err) },
              "Failed to fetch scorecard player profile"
            );
            // Return a basic player from scorecard data
            const sp = scorecardPlayers.find(s => String(s.id) === link.profileId)!;
            return {
              id: `cb-${link.profileId}`,
              name: sp.name,
              team: sp.teamName,
              role: sp.isKeeper ? "wicket_keeper" as const : "all_rounder" as const,
              nationality: sp.teamName,
              battingStyle: null,
              bowlingStyle: null,
              credits: null,
              battingAvg: null,
              bowlingAvg: null,
              strikeRate: null,
              economyRate: null,
              bowlingStrikeRate: null,
              matchesPlayed: null,
              recentForm: null,
              sentimentScore: null,
              injuryStatus: null,
              formNote: null,
              tournamentName,
              sourceUrl: null,
            } satisfies AIPlayer;
          }
        })
      );
      for (const result of batchResults) {
        if (result.status === "fulfilled" && result.value) {
          results.push(result.value);
        }
      }
    }
    return results;
  }

  /**
   * Fetch announced tournament squad via Playwright-based scraping.
   * Resolves the Cricbuzz series, then scrapes the /squads page for each team.
   */
  private async fetchPlayersFromSquadPage(
    teamNames: string[],
    tournamentName: string
  ): Promise<Array<import("./cricbuzz-client").SquadPlayer & { teamName: string }>> {
    try {
      let series = resolveSeries(tournamentName);

      // If series not in cache, try populating from schedule pages
      if (!series) {
        log.info({ tournamentName }, "Series not cached — fetching schedule pages for squad lookup");
        for (const category of ["international", "league"] as const) {
          try {
            const $ = await fetchPage(`/cricket-schedule/series/${category}`);
            parseSchedulePage($, category);
          } catch { /* ignore */ }
        }
        series = resolveSeries(tournamentName);
      }

      if (!series) {
        log.warn({ tournamentName }, "Cannot resolve series for squad page scraping");
        return [];
      }

      const allSquadPlayers: Array<import("./cricbuzz-client").SquadPlayer & { teamName: string }> = [];

      for (const teamName of teamNames) {
        try {
          const players = await fetchSeriesSquadPlayers(series.id, series.slug, teamName);
          if (players.length > 0) {
            log.info({ teamName, playerCount: players.length, seriesId: series.id }, "Got squad players via Playwright");
            allSquadPlayers.push(...players.map(p => ({ ...p, teamName })));
          } else {
            log.warn({ teamName, seriesId: series.id }, "No squad players found for team");
          }
        } catch (err) {
          log.warn(
            { teamName, error: err instanceof Error ? err.message : String(err) },
            "Failed to fetch squad for team via Playwright"
          );
        }
      }

      return allSquadPlayers;
    } catch (err) {
      log.warn({ error: err instanceof Error ? err.message : String(err) }, "Squad page fetch failed");
      return [];
    }
  }

  /**
   * Enrich squad page players by fetching their individual Cricbuzz profile pages.
   * Converts SquadPlayer[] to AIPlayer[] with full stats.
   */
  private async enrichSquadPagePlayers(
    squadPlayers: Array<import("./cricbuzz-client").SquadPlayer & { teamName: string }>,
    tournamentName: string
  ): Promise<AIPlayer[]> {
    const playerLinks: Array<CricbuzzPlayerLink & { teamName: string; squadRole: string; isCaptain: boolean; isKeeper: boolean }> =
      squadPlayers.map(sp => ({
        profileId: sp.id,
        slug: sp.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
        name: sp.name,
        teamName: sp.teamName,
        squadRole: sp.role,
        isCaptain: sp.isCaptain,
        isKeeper: sp.isKeeper,
      }));

    const results: AIPlayer[] = [];
    for (let i = 0; i < playerLinks.length; i += CONCURRENCY) {
      const batch = playerLinks.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.allSettled(
        batch.map(async (link) => {
          try {
            const $ = await fetchPage(`/profiles/${link.profileId}/${link.slug}`);
            const profile = parsePlayerProfilePage($);
            return mapCricbuzzPlayerToAIPlayer(profile, link.teamName, tournamentName, link.profileId);
          } catch (err) {
            log.warn(
              { profileId: link.profileId, name: link.name, error: err instanceof Error ? err.message : String(err) },
              "Failed to fetch squad player profile — using basic info"
            );
            // Return a basic player from squad data when profile fetch fails
            return {
              id: `cb-${link.profileId}`,
              name: link.name,
              team: link.teamName,
              role: mapSquadRole(link.squadRole, link.isKeeper),
              nationality: link.teamName,
              battingStyle: null,
              bowlingStyle: null,
              credits: null,
              battingAvg: null,
              bowlingAvg: null,
              strikeRate: null,
              economyRate: null,
              bowlingStrikeRate: null,
              matchesPlayed: null,
              recentForm: null,
              sentimentScore: null,
              injuryStatus: null,
              formNote: null,
              tournamentName,
              sourceUrl: null,
            } satisfies AIPlayer;
          }
        })
      );
      for (const result of batchResults) {
        if (result.status === "fulfilled" && result.value) {
          results.push(result.value);
        }
      }
    }

    log.info({ total: results.length, fromSquad: squadPlayers.length }, "Enriched squad page players");
    return results;
  }

  async fetchSinglePlayer(
    sport: Sport,
    playerName: string,
    teamName: string,
    tournamentName: string
  ): Promise<ProviderResult<AIPlayer | null>> {
    const start = Date.now();

    // Try to find the player by searching the team page first
    const team = resolveTeam(teamName);
    if (!team) {
      throw new Error(`Team "${teamName}" not found in Cricbuzz mapping`);
    }

    const $ = await fetchPage(`/cricket-team/${team.slug}/${team.id}/players`);
    const playerLinks = parseTeamPlayersPage($);

    // Fuzzy match player name
    const normalizedSearch = playerName.toLowerCase().replace(/[^a-z\s]/g, "");
    const matchedLink = playerLinks.find((link) => {
      const normalizedName = link.name.toLowerCase().replace(/[^a-z\s]/g, "");
      return (
        normalizedName === normalizedSearch ||
        normalizedName.includes(normalizedSearch) ||
        normalizedSearch.includes(normalizedName)
      );
    });

    if (!matchedLink) {
      log.warn({ playerName, teamName }, "Player not found on Cricbuzz team page");
      return {
        data: null,
        source: "cricbuzz",
        fetchedAt: new Date().toISOString(),
        durationMs: Date.now() - start,
      };
    }

    const profile$ = await fetchPage(`/profiles/${matchedLink.profileId}/${matchedLink.slug}`);
    const profile = parsePlayerProfilePage(profile$);
    const player = mapCricbuzzPlayerToAIPlayer(profile, teamName, tournamentName, matchedLink.profileId);

    return {
      data: player,
      source: "cricbuzz",
      fetchedAt: new Date().toISOString(),
      durationMs: Date.now() - start,
    };
  }
}
