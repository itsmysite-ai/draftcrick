/**
 * Provider chain orchestrator.
 * Tries providers in priority order with automatic fallback.
 * Cricbuzz → ESPN → Gemini for cricket, ESPN → Jolpica → Gemini for F1.
 */

import type { Sport, AITeamStanding, AIPlayer } from "@draftplay/shared";
import type { DataProvider, DataSourceType, ProviderResult } from "./types";
import { ESPNProvider } from "./espn";
import { JolpicaProvider } from "./jolpica";
import { GeminiProvider } from "./gemini";
import { CricbuzzProvider } from "./cricbuzz";
import { getLogger } from "../lib/logger";

const log = getLogger("provider-chain");

// Singleton provider instances
const espn = new ESPNProvider();
const jolpica = new JolpicaProvider();
const gemini = new GeminiProvider();
const cricbuzz = new CricbuzzProvider();

/**
 * Priority chains per sport.
 * Cricbuzz first for cricket (all data), ESPN fallback, Gemini last resort.
 * ESPN first for F1, Jolpica for standings/players, Gemini fallback.
 */
const PROVIDER_CHAINS: Record<string, DataProvider[]> = {
  cricket: [cricbuzz, espn, gemini],
  f1: [espn, jolpica, gemini],
  // Football ESPN mapper not yet implemented — Gemini only for now
  football: [gemini],
  kabaddi: [gemini],
  basketball: [gemini],
};

type DataSourcePreference = "auto" | DataSourceType;

/**
 * Get the provider chain for a sport, filtered by admin preference.
 * - "auto": full chain with Gemini fallback (ESPN → Jolpica → Gemini)
 * - "espn": ESPN only, NO Gemini fallback
 * - "jolpica": Jolpica only, NO Gemini fallback
 * - "gemini": Gemini only
 */
function getChain(sport: Sport, preference: DataSourcePreference = "auto"): DataProvider[] {
  const chain = PROVIDER_CHAINS[sport] ?? [gemini];

  if (preference === "auto") return chain;

  // Specific source selected — use ONLY that source, no fallback
  const preferred = chain.find((p) => p.source === preference);
  if (preferred) return [preferred];

  // Source not in chain for this sport — return it directly if known
  if (preference === "gemini") return [gemini];
  if (preference === "cricbuzz") return [cricbuzz];

  // Unknown preference — fall back to full chain
  log.warn({ sport, preference }, "Unknown preference — using auto chain");
  return chain;
}

/**
 * Execute an operation against the provider chain with fallback.
 * Tries each provider in order. On failure, logs and tries next.
 */
async function executeWithFallback<T>(
  sport: Sport,
  operationName: string,
  preference: DataSourcePreference,
  execute: (provider: DataProvider) => Promise<ProviderResult<T>>
): Promise<ProviderResult<T>> {
  const chain = getChain(sport, preference);
  const errors: Array<{ source: DataSourceType; error: string }> = [];

  for (const provider of chain) {
    if (!provider.supportedSports.includes(sport)) {
      continue;
    }

    try {
      const result = await execute(provider);
      if (errors.length > 0) {
        log.info(
          { sport, operation: operationName, source: provider.source, failedSources: errors },
          `${operationName} succeeded after fallback`
        );
      }
      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      errors.push({ source: provider.source, error: errorMsg });
      log.warn(
        { sport, operation: operationName, source: provider.source, error: errorMsg },
        `Provider ${provider.source} failed for ${operationName} — trying next`
      );
    }
  }

  const errorSummary = errors.map((e) => `${e.source}: ${e.error}`).join("; ");
  throw new Error(`All providers failed for ${operationName} (${sport}): ${errorSummary}`);
}

// ---------------------------------------------------------------------------
// Public API — drop-in replacements for direct Gemini calls
// ---------------------------------------------------------------------------

export async function fetchDashboardWithFallback(
  sport: Sport,
  activeTournaments?: string[],
  preference: DataSourcePreference = "auto",
  seriesHints?: Array<{ name: string; externalId: string }>
) {
  return executeWithFallback(sport, "fetchDashboard", preference, (provider) =>
    provider.fetchDashboard(sport, activeTournaments, seriesHints)
  );
}

export async function discoverTournamentsWithFallback(
  sport: Sport,
  preference: DataSourcePreference = "auto"
) {
  return executeWithFallback(sport, "discoverTournaments", preference, (provider) =>
    provider.discoverTournaments(sport)
  );
}

export async function fetchStandingsWithFallback(
  sport: Sport,
  tournamentNames: string[],
  preference: DataSourcePreference = "auto"
) {
  return executeWithFallback(sport, "fetchStandings", preference, (provider) =>
    provider.fetchStandings(sport, tournamentNames)
  );
}

export async function fetchMatchStatusWithFallback(
  sport: Sport,
  teamHome: string,
  teamAway: string,
  tournament: string,
  format: string,
  startTime: Date | string,
  currentScore?: string,
  preference: DataSourcePreference = "auto"
) {
  return executeWithFallback(sport, "fetchMatchStatus", preference, (provider) => {
    if (!provider.fetchMatchStatus) {
      throw new Error(`${provider.source} does not support fetchMatchStatus`);
    }
    return provider.fetchMatchStatus(sport, teamHome, teamAway, tournament, format, startTime, currentScore);
  });
}

// ---------------------------------------------------------------------------
// F1 supplementary: Jolpica always provides standings/players for F1
// regardless of admin preference (ESPN can't provide these).
// Non-blocking — callers should catch errors.
// ---------------------------------------------------------------------------

export async function fetchF1StandingsFromJolpica(
  tournamentNames: string[]
): Promise<ProviderResult<Map<string, AITeamStanding[]>>> {
  return jolpica.fetchStandings("f1" as Sport, tournamentNames);
}

export async function fetchF1PlayersFromJolpica(
  teamNames: string[],
  tournamentName: string
): Promise<ProviderResult<AIPlayer[]>> {
  return jolpica.fetchPlayers!("f1" as Sport, teamNames, tournamentName);
}

export async function fetchSinglePlayerWithFallback(
  sport: Sport,
  playerName: string,
  teamName: string,
  tournamentName: string,
  preference: DataSourcePreference = "auto"
) {
  return executeWithFallback(sport, "fetchSinglePlayer", preference, (provider) => {
    if (!provider.fetchSinglePlayer) {
      throw new Error(`${provider.source} does not support fetchSinglePlayer`);
    }
    return provider.fetchSinglePlayer(sport, playerName, teamName, tournamentName);
  });
}

export async function fetchPlayersWithFallback(
  sport: Sport,
  teamNames: string[],
  tournamentName: string,
  existingPlayerNames?: string[],
  preference: DataSourcePreference = "auto",
  matchContext?: { startTime: Date; format?: string },
  tournamentExternalId?: string
) {
  return executeWithFallback(sport, "fetchPlayers", preference, (provider) => {
    if (!provider.fetchPlayers) {
      throw new Error(`${provider.source} does not support fetchPlayers`);
    }
    return provider.fetchPlayers(sport, teamNames, tournamentName, existingPlayerNames, matchContext, tournamentExternalId);
  });
}
