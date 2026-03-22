/**
 * Pricing Geo Service — IP-based country detection for subscription pricing.
 *
 * Pricing mode is stored in admin_config ("pricing_mode" key).
 * - "stub" (default): uses user's declared country from profile preferences
 * - "live": uses server-side IP geolocation to determine pricing currency
 *
 * This prevents users from self-declaring India to get cheaper INR pricing.
 * When the full geo system (MaxMind + GPS) is merged, this will delegate to it.
 */

import { getAdminConfig, setAdminConfig } from "./admin-config";
import { getLogger } from "../lib/logger";

const log = getLogger("pricing-geo");

// ---------------------------------------------------------------------------
// Pricing mode (admin toggle)
// ---------------------------------------------------------------------------

export type PricingMode = "stub" | "live";

/**
 * Get current pricing mode from admin config.
 * Default: "stub" (uses declared country).
 */
export async function getPricingMode(): Promise<PricingMode> {
  const mode = await getAdminConfig<string>("pricing_mode");
  return mode === "live" ? "live" : "stub";
}

/**
 * Set pricing mode. Admin only.
 */
export async function setPricingMode(
  mode: PricingMode,
  adminUserId: string
): Promise<void> {
  await setAdminConfig(
    "pricing_mode",
    mode,
    "Pricing geo mode: stub = declared country, live = IP-based detection",
    adminUserId
  );
  log.info({ mode, adminUserId }, "Pricing mode updated");
}

// ---------------------------------------------------------------------------
// IP-based country detection
// ---------------------------------------------------------------------------

interface GeoResult {
  countryCode: string | null;
  source: "ip" | "declared" | "fallback";
}

/**
 * Detect country from client IP using ip-api.com (free, no key required).
 * Returns ISO 3166-1 alpha-2 country code (e.g. "IN", "US").
 *
 * Rate limit: 45 req/min on free tier — sufficient for subscription page loads.
 * When MaxMind geo middleware is merged, this will be replaced.
 */
async function detectCountryFromIP(clientIP: string): Promise<string | null> {
  // Skip private/local IPs
  if (
    !clientIP ||
    clientIP === "127.0.0.1" ||
    clientIP === "::1" ||
    clientIP.startsWith("192.168.") ||
    clientIP.startsWith("10.") ||
    clientIP.startsWith("172.16.")
  ) {
    log.debug({ clientIP }, "Skipping geo lookup for private IP");
    return null;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(
      `http://ip-api.com/json/${clientIP}?fields=status,countryCode`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);

    if (!res.ok) {
      log.warn({ status: res.status, clientIP }, "IP geo API returned non-OK status");
      return null;
    }

    const data = (await res.json()) as { status: string; countryCode?: string };
    if (data.status === "success" && data.countryCode) {
      log.debug({ clientIP, countryCode: data.countryCode }, "IP geo lookup success");
      return data.countryCode;
    }

    log.debug({ clientIP, data }, "IP geo lookup returned non-success");
    return null;
  } catch (error) {
    log.warn({ clientIP, error: String(error) }, "IP geo lookup failed");
    return null;
  }
}

/**
 * Extract client IP from Hono request context.
 * Checks standard proxy headers in order of priority.
 * Accepts the Hono context's req.header() function.
 */
export function extractClientIP(headerFn: (name: string) => string | undefined): string | null {
  // Cloudflare
  const cfIP = headerFn("cf-connecting-ip");
  if (cfIP) return cfIP.trim();

  // Standard proxy header
  const xff = headerFn("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }

  // Fly.io
  const flyIP = headerFn("fly-client-ip");
  if (flyIP) return flyIP.trim();

  return null;
}

/**
 * Resolve the user's country for pricing purposes.
 *
 * - In "stub" mode: returns declared country from profile
 * - In "live" mode: uses IP-based detection, falls back to declared if IP lookup fails
 *
 * Returns { countryCode, source } so the client knows which method was used.
 */
export async function resolvePricingCountry(
  declaredCountry: string | null,
  clientIP: string | null
): Promise<GeoResult> {
  const mode = await getPricingMode();

  if (mode === "stub") {
    // Stub mode: trust the user's declaration
    const code = normalizeCountryCode(declaredCountry);
    return { countryCode: code, source: "declared" };
  }

  // Live mode: detect from IP
  if (clientIP) {
    const ipCountry = await detectCountryFromIP(clientIP);
    if (ipCountry) {
      // Log mismatch for fraud monitoring
      const declaredCode = normalizeCountryCode(declaredCountry);
      if (declaredCode && declaredCode !== ipCountry) {
        log.warn(
          { declaredCountry: declaredCode, ipCountry, clientIP: clientIP.slice(0, -3) + "xxx" },
          "Country mismatch: declared vs IP-detected"
        );
      }
      return { countryCode: ipCountry, source: "ip" };
    }
  }

  // Live mode but IP detection failed (private IP, API down, etc.)
  // Default to USD (international) pricing to prevent fraud — do NOT fall back
  // to declared country, as that's the exact vulnerability live mode prevents.
  log.info(
    { clientIP: clientIP ?? "none", declaredCountry },
    "IP detection unavailable in live mode — defaulting to international pricing"
  );
  return { countryCode: "US", source: "fallback" };
}

/**
 * Normalize various country formats to ISO 3166-1 alpha-2.
 */
function normalizeCountryCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const upper = raw.toUpperCase().trim();

  // Already a 2-letter code
  if (upper.length === 2) return upper;

  // Common full names
  const nameMap: Record<string, string> = {
    INDIA: "IN",
    "UNITED STATES": "US",
    "UNITED STATES OF AMERICA": "US",
    USA: "US",
    "UNITED KINGDOM": "GB",
    UK: "GB",
    AUSTRALIA: "AU",
    CANADA: "CA",
    PAKISTAN: "PK",
    BANGLADESH: "BD",
    "SRI LANKA": "LK",
    "NEW ZEALAND": "NZ",
    "SOUTH AFRICA": "ZA",
  };

  return nameMap[upper] ?? upper.slice(0, 2);
}
