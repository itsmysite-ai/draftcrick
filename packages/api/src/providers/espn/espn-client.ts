/**
 * ESPN public API HTTP client.
 * Handles retries, timeouts, response validation, and courtesy delays.
 * ESPN endpoints are undocumented — Zod validation catches format changes.
 */

import type { ZodSchema } from "zod";
import { getLogger } from "../../lib/logger";

const log = getLogger("espn-client");

const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 500;
const MIN_REQUEST_GAP_MS = 200;

const USER_AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
];

let lastRequestTime = 0;

function getRandomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]!;
}

async function courtesyDelay(): Promise<void> {
  const elapsed = Date.now() - lastRequestTime;
  if (elapsed < MIN_REQUEST_GAP_MS) {
    await new Promise((r) => setTimeout(r, MIN_REQUEST_GAP_MS - elapsed));
  }
}

/**
 * Fetch from ESPN with retry, timeout, and Zod validation.
 * Throws on all failures (caller handles fallback).
 */
export async function espnFetch<T>(url: string, schema: ZodSchema<T>): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await courtesyDelay();

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

      lastRequestTime = Date.now();
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": getRandomUA(),
          Accept: "application/json",
        },
      });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`ESPN HTTP ${response.status}: ${response.statusText}`);
      }

      const raw = await response.json();
      const parsed = schema.parse(raw);

      log.debug({ url, attempt, status: response.status }, "ESPN fetch success");
      return parsed;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      log.warn(
        { url, attempt, error: lastError.message },
        `ESPN fetch attempt ${attempt}/${MAX_RETRIES} failed`
      );

      if (attempt < MAX_RETRIES) {
        const delay = RETRY_BASE_MS * Math.pow(2, attempt - 1);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  throw lastError ?? new Error("ESPN fetch failed after all retries");
}

// ---------------------------------------------------------------------------
// ESPN endpoint URL builders
// ---------------------------------------------------------------------------

const ESPN_BASE = "https://site.api.espn.com";

export const ESPN_URLS = {
  cricketScoreboard: () =>
    `${ESPN_BASE}/apis/personalized/v2/scoreboard/header?sport=cricket&region=in&lang=en`,

  f1Scoreboard: () =>
    `${ESPN_BASE}/apis/site/v2/sports/racing/f1/scoreboard`,

  footballScoreboard: (league = "eng.1") =>
    `${ESPN_BASE}/apis/site/v2/sports/soccer/${league}/scoreboard`,
} as const;
