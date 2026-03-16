/**
 * Jolpica F1 API client (Ergast API successor).
 * Rate limited: 4 req/sec burst, 500 req/hr sustained.
 * Base URL: https://api.jolpi.ca/ergast/f1
 */

import type { ZodSchema } from "zod";
import { getLogger } from "../../lib/logger";

const log = getLogger("jolpica-client");

const BASE_URL = "https://api.jolpi.ca/ergast/f1";
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 2;
const RETRY_BASE_MS = 1000;

// Token bucket rate limiter
const BURST_LIMIT = 4; // per second
const SUSTAINED_LIMIT = 500; // per hour
const BURST_WINDOW_MS = 1000;
const SUSTAINED_WINDOW_MS = 3600_000;

let burstTokens = BURST_LIMIT;
let sustainedTokens = SUSTAINED_LIMIT;
let lastBurstRefill = Date.now();
let lastSustainedRefill = Date.now();

function refillTokens(): void {
  const now = Date.now();

  // Refill burst tokens
  const burstElapsed = now - lastBurstRefill;
  if (burstElapsed >= BURST_WINDOW_MS) {
    burstTokens = BURST_LIMIT;
    lastBurstRefill = now;
  }

  // Refill sustained tokens
  const sustainedElapsed = now - lastSustainedRefill;
  if (sustainedElapsed >= SUSTAINED_WINDOW_MS) {
    sustainedTokens = SUSTAINED_LIMIT;
    lastSustainedRefill = now;
  }
}

async function waitForToken(): Promise<void> {
  refillTokens();

  if (burstTokens <= 0) {
    const waitMs = BURST_WINDOW_MS - (Date.now() - lastBurstRefill) + 50;
    log.debug({ waitMs }, "Jolpica burst rate limit — waiting");
    await new Promise((r) => setTimeout(r, waitMs));
    refillTokens();
  }

  if (sustainedTokens <= 0) {
    throw new Error("Jolpica hourly rate limit (500/hr) exhausted — try again later");
  }

  burstTokens--;
  sustainedTokens--;
}

/**
 * Fetch from Jolpica F1 API with rate limiting, retry, and Zod validation.
 */
export async function jolpicaFetch<T>(path: string, schema: ZodSchema<T>): Promise<T> {
  const url = `${BASE_URL}${path}`;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await waitForToken();

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      clearTimeout(timeout);

      if (response.status === 429) {
        log.warn({ url }, "Jolpica 429 rate limited");
        // Reset burst tokens and wait
        burstTokens = 0;
        const retryAfter = parseInt(response.headers.get("Retry-After") ?? "5", 10);
        await new Promise((r) => setTimeout(r, retryAfter * 1000));
        continue;
      }

      if (!response.ok) {
        throw new Error(`Jolpica HTTP ${response.status}: ${response.statusText}`);
      }

      const raw = await response.json();
      const parsed = schema.parse(raw);

      log.debug({ url, attempt }, "Jolpica fetch success");
      return parsed;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      log.warn(
        { url, attempt, error: lastError.message },
        `Jolpica fetch attempt ${attempt}/${MAX_RETRIES} failed`
      );

      if (attempt < MAX_RETRIES) {
        const delay = RETRY_BASE_MS * Math.pow(2, attempt - 1);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  throw lastError ?? new Error("Jolpica fetch failed after all retries");
}
