# DraftCrick — Geo-Location & Regional Compliance Implementation Guide

> **Last Updated:** February 10, 2026  
> **Status:** Implementation Document  
> **Depends On:** Phase 2.75 (Infrastructure), Phase 7 (Compliance)  
> **Architecture:** GCP-native, multi-region capable

---

## 1. Executive Summary

DraftCrick must handle three geo-location concerns:

1. **Regulatory compliance** — India's PROGA 2025 bans all real-money online gaming nationwide (Supreme Court hearing Jan 21, 2026 — ruling pending). Even if PROGA is struck down, individual states (Andhra Pradesh, Telangana, Assam, Odisha, Sikkim, Nagaland) maintain their own bans. International markets have separate rules.
2. **API routing** — Gemini API requests should route to the nearest Vertex AI region for lowest latency and optional data residency.
3. **Infrastructure geo-distribution** — Whether PostgreSQL and Redis need multi-region instances or if a single-region setup with edge caching suffices.

**Our recommended architecture:** Single primary region (`asia-south1` Mumbai) for database + Redis, with Vertex AI Gemini calls routed to the nearest region per user, and a robust client-side + server-side geo-detection system that gates features by regulatory zone.

---

## 2. Regulatory Landscape (as of February 2026)

### 2.1 India — Current State

**PROGA 2025 (Promotion and Regulation of Online Gaming Act):**
- Passed by Parliament on August 21, 2025; received Presidential assent August 22, 2025
- Bans ALL real-money online gaming nationwide — no distinction between skill and chance
- Penalties: up to 3 years imprisonment, fines up to ₹1 crore
- **NOT YET FORMALLY NOTIFIED** — but banks/payment gateways already withdrew services
- Supreme Court hearing scheduled for January 21, 2026 (three-judge bench, CJI Surya Kant)
- Constitutional challenge pending — industry argues it overrides state jurisdiction (Entry 34, State List)
- **Outcome unknown at time of writing** — ruling could strike down, uphold, or modify PROGA

**Pre-PROGA State-Level Bans (still enforced independently):**

| State | Status | Details |
|-------|--------|---------|
| **Andhra Pradesh** | ❌ Complete ban | AP Gaming Act 1974 (amended 2017) — all online games with stakes |
| **Telangana** | ❌ Complete ban | Telangana Gaming Act 1974 (amended 2017) |
| **Assam** | ❌ Complete ban | Assam Game and Betting Act |
| **Odisha** | ❌ Complete ban | Odisha Prevention of Gambling Act |
| **Sikkim** | ⚠️ License required | Online Gaming (Regulation) Act 2008 — license mandatory |
| **Nagaland** | ⚠️ License required | Nagaland Prohibition of Gambling and Promotion of Online Gaming Act 2016 |
| **Tamil Nadu** | ⚠️ Contested | Prohibition of Online Gambling Act 2022 — courts struck it down, revised version contested |
| **Karnataka** | ⚠️ Contested | 2023 amendments struck down by HC, status fluid |
| **Goa** | ✅ Licensed gambling permitted | Physical casinos legal, online regulation evolving |
| **All other states** | ✅ Legal (pre-PROGA) | Fantasy sports recognized as game of skill |

### 2.2 International Markets

| Region | Status | Notes |
|--------|--------|-------|
| **USA** | ✅ Mostly legal | State-by-state; legal in most states, some restrictions (Iowa, Montana, Washington, etc.) |
| **UK** | ✅ Legal | Regulated by Gambling Commission; requires license for paid contests |
| **Australia** | ⚠️ Restricted | Interactive Gambling Act — daily fantasy legal in some states, banned in others |
| **UAE/Gulf** | ❌ Banned | All gambling/betting prohibited |
| **Canada** | ✅ Legal | Criminal Code exempts games of skill |
| **EU** | ⚠️ Varies | Country-by-country regulation |
| **Pakistan** | ❌ Banned | Prevention of Gambling Act |

### 2.3 Our Strategy: Dual-Mode Architecture

Given PROGA's uncertain future, we build for **three scenarios**:

| Scenario | India Mode | International Mode |
|----------|-----------|-------------------|
| **PROGA upheld** | Free-to-play only (no wallet, no entry fees, no prizes) | Full real-money where legal |
| **PROGA struck down** | Real-money in permitted states; blocked in AP/TG/AS/OD/SK/NL | Full real-money where legal |
| **PROGA modified** (regulated licensing) | Apply for license, real-money with restrictions | Full real-money where legal |

---

## 3. Geo-Detection Architecture

### 3.1 Detection Layers (Defense in Depth)

We use **three layers** of geo-detection — no single method is relied upon alone.

```
Layer 1: IP Geolocation (Server-Side — Automatic)
  ↓ provides initial region estimate
Layer 2: Device Location (Client-Side — Permission Required)  
  ↓ provides precise coordinates
Layer 3: User Self-Declaration (Onboarding — Mandatory)
  ↓ legal compliance record
  
  → All three feed into: GeoContext → RegulationEngine → Feature Gates
```

#### Layer 1: IP Geolocation (Server-Side)

**How:** Every API request carries the client IP. We resolve it to country/state using a GeoIP database.

**Implementation:**

```typescript
// packages/api/src/middleware/geo-detection.ts

import { Hono } from 'hono';
import maxmind, { CityResponse } from 'maxmind';

// Use MaxMind GeoLite2 (free) or GeoIP2 (paid, more accurate)
// Updated weekly via cron job
const DB_PATH = '/data/GeoLite2-City.mmdb';

let lookup: maxmind.Reader<CityResponse>;

export async function initGeoIP() {
  lookup = await maxmind.open<CityResponse>(DB_PATH);
}

export interface GeoIPResult {
  country: string;          // 'IN', 'US', 'GB'
  countryName: string;      // 'India', 'United States'
  state?: string;           // 'Telangana', 'California'
  stateCode?: string;       // 'TG', 'CA'
  city?: string;            // 'Hyderabad'
  latitude?: number;
  longitude?: number;
  accuracy?: number;        // km radius
  source: 'ip';
}

export function resolveGeoIP(ip: string): GeoIPResult | null {
  const result = lookup.get(ip);
  if (!result) return null;
  
  return {
    country: result.country?.iso_code ?? 'UNKNOWN',
    countryName: result.country?.names?.en ?? 'Unknown',
    state: result.subdivisions?.[0]?.names?.en,
    stateCode: result.subdivisions?.[0]?.iso_code,
    city: result.city?.names?.en,
    latitude: result.location?.latitude,
    longitude: result.location?.longitude,
    accuracy: result.location?.accuracy_radius,
    source: 'ip',
  };
}
```

**Hono Middleware:**

```typescript
// packages/api/src/middleware/geo-middleware.ts

import { createMiddleware } from 'hono/factory';

export const geoMiddleware = createMiddleware(async (c, next) => {
  // GCP Cloud Run sets x-forwarded-for; also check cf-connecting-ip if behind Cloudflare
  const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
    || c.req.header('cf-connecting-ip')
    || '0.0.0.0';
  
  const geo = resolveGeoIP(ip);
  
  c.set('geoIP', geo);
  c.set('userCountry', geo?.country ?? 'UNKNOWN');
  c.set('userState', geo?.stateCode ?? 'UNKNOWN');
  
  await next();
});
```

**GeoIP Database Updates:**

```bash
# Cron job: weekly update of MaxMind database
# Store in GCS bucket, download to Cloud Run instance at startup
0 3 * * 3 /scripts/update-geoip.sh
```

**Limitations:** IP geolocation is ~95% accurate at country level, ~70-80% at state level in India. VPN users will have wrong IPs. This is why we need Layer 2 and 3.

---

#### Layer 2: Device GPS Location (Client-Side)

**How:** Request device location permission on mobile (Expo Location API). Falls back to coarse location if precise is denied.

**Implementation:**

```typescript
// apps/mobile/src/services/location.ts

import * as Location from 'expo-location';

export interface DeviceLocation {
  latitude: number;
  longitude: number;
  accuracy: number;     // meters
  country?: string;
  state?: string;
  stateCode?: string;
  city?: string;
  source: 'gps' | 'network' | 'coarse';
}

export async function getDeviceLocation(): Promise<DeviceLocation | null> {
  // Request permission
  const { status } = await Location.requestForegroundPermissionsAsync();
  
  if (status !== 'granted') {
    // Try coarse location (doesn't need explicit permission on some devices)
    return getCoarseLocation();
  }
  
  // Get precise location
  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced, // ~100m, saves battery
  });
  
  // Reverse geocode to get country/state
  const [address] = await Location.reverseGeocodeAsync({
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
  });
  
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracy: location.coords.accuracy ?? 100,
    country: address?.isoCountryCode ?? undefined,
    state: address?.region ?? undefined,
    stateCode: mapStateToCode(address?.isoCountryCode, address?.region),
    city: address?.city ?? undefined,
    source: 'gps',
  };
}

async function getCoarseLocation(): Promise<DeviceLocation | null> {
  try {
    const location = await Location.getLastKnownPositionAsync();
    if (!location) return null;
    
    const [address] = await Location.reverseGeocodeAsync({
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    });
    
    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy ?? 5000,
      country: address?.isoCountryCode ?? undefined,
      state: address?.region ?? undefined,
      stateCode: mapStateToCode(address?.isoCountryCode, address?.region),
      city: address?.city ?? undefined,
      source: 'coarse',
    };
  } catch {
    return null;
  }
}
```

**When to check:**
- On app launch (every session)
- Before joining any paid contest
- Before wallet deposit/withdrawal
- Before activating any real-money feature
- Periodically during active sessions (every 30 min) — to catch users who travel across state lines

---

#### Layer 3: User Self-Declaration (Onboarding)

**How:** During registration, the user must declare their primary state/country. This serves as the legal record of user intent.

**Onboarding Flow:**

```
Step 1: Welcome to DraftCrick!
Step 2: "Where are you located?"
  → Country dropdown (auto-selected from IP)
  → If India: State dropdown (auto-selected from IP/GPS)
  → If not India: Country selection only
Step 3: Confirm selection
  → "I confirm I am located in [State], [Country] and I am 
     eligible to participate in fantasy sports under local laws."
  → Checkbox: "I understand that I must update my location 
     if I move to a different state or country."
Step 4: Continue to app (features gated by declared location)
```

**Database Schema:**

```sql
-- Add to existing users table
ALTER TABLE users ADD COLUMN declared_country TEXT NOT NULL DEFAULT 'IN';
ALTER TABLE users ADD COLUMN declared_state TEXT;
ALTER TABLE users ADD COLUMN declared_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN location_verified BOOLEAN DEFAULT false;

-- Location verification log (audit trail)
CREATE TABLE location_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  
  -- What we detected
  ip_country TEXT,
  ip_state TEXT,
  ip_address INET,
  gps_country TEXT,
  gps_state TEXT,
  gps_latitude DECIMAL(10, 7),
  gps_longitude DECIMAL(10, 7),
  gps_accuracy DECIMAL(10, 2),
  
  -- User's declaration
  declared_country TEXT,
  declared_state TEXT,
  
  -- Resolution
  resolved_country TEXT NOT NULL,
  resolved_state TEXT,
  resolved_zone TEXT NOT NULL, -- 'india_permitted', 'india_banned', 'international', 'unknown'
  
  -- Flags
  mismatch_detected BOOLEAN DEFAULT false,
  mismatch_type TEXT, -- 'ip_vs_gps', 'ip_vs_declaration', 'gps_vs_declaration', 'vpn_suspected'
  
  check_trigger TEXT NOT NULL, -- 'session_start', 'paid_action', 'periodic', 'manual'
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_location_checks_user ON location_checks(user_id, created_at DESC);
```

---

### 3.2 Resolution Engine: Combining All Three Layers

```typescript
// packages/api/src/services/geo-resolver.ts

export type RegulatoryZone = 
  | 'india_free_only'        // PROGA active OR banned state → free-to-play only
  | 'india_real_money'       // India, permitted state, PROGA struck down
  | 'international_permitted' // Countries where real-money fantasy is legal
  | 'international_blocked'   // Countries where all fantasy is banned (UAE, Pakistan)
  | 'unknown';               // Cannot determine → default to most restrictive

interface GeoResolution {
  zone: RegulatoryZone;
  country: string;
  state?: string;
  confidence: 'high' | 'medium' | 'low';
  sources: ('ip' | 'gps' | 'declaration')[];
  warnings: string[];
}

// Feature flags (updated based on PROGA ruling)
const PROGA_ACTIVE = true; // Toggle when Supreme Court rules

const INDIA_BANNED_STATES = ['AP', 'TG', 'AS', 'OD'];
const INDIA_LICENSE_REQUIRED_STATES = ['SK', 'NL'];
const INDIA_CONTESTED_STATES = ['TN', 'KA'];
const INTERNATIONAL_BANNED_COUNTRIES = ['PK', 'AE', 'QA', 'KW', 'BH', 'OM', 'SA'];

export function resolveUserZone(
  ipGeo: GeoIPResult | null,
  deviceGeo: DeviceLocation | null,
  declaration: { country: string; state?: string } | null,
): GeoResolution {
  const sources: GeoResolution['sources'] = [];
  const warnings: string[] = [];
  
  // Collect available signals
  if (ipGeo) sources.push('ip');
  if (deviceGeo) sources.push('gps');
  if (declaration) sources.push('declaration');
  
  // No data at all → unknown (most restrictive)
  if (sources.length === 0) {
    return { zone: 'unknown', country: 'UNKNOWN', confidence: 'low', sources, warnings: ['No geo data'] };
  }
  
  // Determine country (priority: GPS > Declaration > IP)
  const country = deviceGeo?.country ?? declaration?.country ?? ipGeo?.country ?? 'UNKNOWN';
  const state = deviceGeo?.stateCode ?? declaration?.state ?? ipGeo?.stateCode;
  
  // Check for mismatches (potential VPN or fraud)
  if (ipGeo && deviceGeo && ipGeo.country !== deviceGeo.country) {
    warnings.push('IP country does not match GPS country — possible VPN');
  }
  if (declaration && deviceGeo && declaration.country !== deviceGeo.country) {
    warnings.push('Declaration does not match GPS — user may have moved');
  }
  
  // Confidence scoring
  const confidence: GeoResolution['confidence'] = 
    sources.length >= 2 && warnings.length === 0 ? 'high' :
    sources.length >= 1 && warnings.length <= 1 ? 'medium' : 'low';
  
  // Route to zone
  let zone: RegulatoryZone;
  
  if (INTERNATIONAL_BANNED_COUNTRIES.includes(country)) {
    zone = 'international_blocked';
  } else if (country === 'IN') {
    if (PROGA_ACTIVE) {
      // PROGA active: all of India is free-to-play only
      zone = 'india_free_only';
    } else {
      // PROGA struck down: check state-level bans
      if (state && [...INDIA_BANNED_STATES, ...INDIA_LICENSE_REQUIRED_STATES].includes(state)) {
        zone = 'india_free_only';
      } else {
        zone = 'india_real_money';
      }
    }
  } else if (country !== 'UNKNOWN') {
    zone = 'international_permitted';
  } else {
    zone = 'unknown';
  }
  
  return { zone, country, state, confidence, sources, warnings };
}
```

---

### 3.3 Feature Gates

Based on the resolved `RegulatoryZone`, the API gates features:

```typescript
// packages/api/src/services/feature-gates.ts

export interface FeatureAccess {
  canJoinPaidContest: boolean;
  canDeposit: boolean;
  canWithdraw: boolean;
  canWinPrizes: boolean;
  canPlayFree: boolean;
  canUsePredictions: boolean;
  canTrade: boolean;              // inter-team trades
  showWallet: boolean;
  showPrizePool: boolean;
  requiresKYC: boolean;
  taxDeductionRequired: boolean;  // India: 30% TDS on winnings > ₹100
  gstApplicable: boolean;        // India: 28% GST on entry amount
  maxDepositPerDay?: number;     // responsible gaming limits
  warningMessage?: string;
}

export function getFeatureAccess(zone: RegulatoryZone): FeatureAccess {
  switch (zone) {
    case 'india_free_only':
      return {
        canJoinPaidContest: false,
        canDeposit: false,
        canWithdraw: false,
        canWinPrizes: false,
        canPlayFree: true,
        canUsePredictions: true,
        canTrade: true,
        showWallet: false,
        showPrizePool: false,
        requiresKYC: false,
        taxDeductionRequired: false,
        gstApplicable: false,
        warningMessage: 'Real-money contests are not available in your region. Enjoy free-to-play mode!',
      };
      
    case 'india_real_money':
      return {
        canJoinPaidContest: true,
        canDeposit: true,
        canWithdraw: true,
        canWinPrizes: true,
        canPlayFree: true,
        canUsePredictions: true,
        canTrade: true,
        showWallet: true,
        showPrizePool: true,
        requiresKYC: true,        // Mandatory KYC for real-money in India
        taxDeductionRequired: true, // 30% TDS on net winnings > ₹100
        gstApplicable: true,       // 28% GST on entry amount
        maxDepositPerDay: 50000,   // ₹50,000 responsible gaming limit
      };
      
    case 'international_permitted':
      return {
        canJoinPaidContest: true,
        canDeposit: true,
        canWithdraw: true,
        canWinPrizes: true,
        canPlayFree: true,
        canUsePredictions: true,
        canTrade: true,
        showWallet: true,
        showPrizePool: true,
        requiresKYC: true,
        taxDeductionRequired: false, // varies by country; user's responsibility
        gstApplicable: false,
      };
      
    case 'international_blocked':
      return {
        canJoinPaidContest: false,
        canDeposit: false,
        canWithdraw: false,
        canWinPrizes: false,
        canPlayFree: true,         // allow free-play even in blocked countries
        canUsePredictions: true,
        canTrade: true,
        showWallet: false,
        showPrizePool: false,
        requiresKYC: false,
        taxDeductionRequired: false,
        gstApplicable: false,
        warningMessage: 'Fantasy sports with real money is not available in your country.',
      };
      
    case 'unknown':
    default:
      return {
        canJoinPaidContest: false,
        canDeposit: false,
        canWithdraw: false,
        canWinPrizes: false,
        canPlayFree: true,
        canUsePredictions: true,
        canTrade: true,
        showWallet: false,
        showPrizePool: false,
        requiresKYC: false,
        taxDeductionRequired: false,
        gstApplicable: false,
        warningMessage: 'We could not determine your location. Some features may be restricted.',
      };
  }
}
```

**tRPC Integration:**

```typescript
// packages/api/src/routers/geo.ts

export const geoRouter = router({
  // Called on every session start
  resolveLocation: protectedProcedure
    .input(z.object({
      deviceCountry: z.string().optional(),
      deviceState: z.string().optional(),
      latitude: z.number().optional(),
      longitude: z.number().optional(),
      accuracy: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const ipGeo = ctx.geoIP;
      
      const deviceGeo: DeviceLocation | null = input.latitude ? {
        latitude: input.latitude,
        longitude: input.longitude!,
        accuracy: input.accuracy ?? 5000,
        country: input.deviceCountry,
        stateCode: input.deviceState,
        source: 'gps',
      } : null;
      
      const declaration = ctx.user.declared_country ? {
        country: ctx.user.declared_country,
        state: ctx.user.declared_state,
      } : null;
      
      const resolution = resolveUserZone(ipGeo, deviceGeo, declaration);
      const features = getFeatureAccess(resolution.zone);
      
      // Log the check
      await logLocationCheck(ctx.db, {
        userId: ctx.user.id,
        ipGeo,
        deviceGeo,
        declaration,
        resolution,
        trigger: 'session_start',
      });
      
      return { resolution, features };
    }),
    
  // Called before any paid action
  verifyForPaidAction: protectedProcedure
    .input(z.object({
      latitude: z.number(),
      longitude: z.number(),
      accuracy: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Must have GPS for paid actions
      const resolution = resolveUserZone(
        ctx.geoIP,
        { ...input, source: 'gps' } as DeviceLocation,
        { country: ctx.user.declared_country, state: ctx.user.declared_state },
      );
      
      if (!getFeatureAccess(resolution.zone).canJoinPaidContest) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Real-money contests are not available in your current location.',
        });
      }
      
      if (resolution.confidence === 'low') {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Unable to verify your location. Please enable GPS and try again.',
        });
      }
      
      await logLocationCheck(ctx.db, {
        userId: ctx.user.id,
        resolution,
        trigger: 'paid_action',
      });
      
      return { allowed: true, zone: resolution.zone };
    }),
    
  // User updates their declared location
  updateDeclaration: protectedProcedure
    .input(z.object({
      country: z.string().length(2),
      state: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.update(users).set({
        declared_country: input.country,
        declared_state: input.state,
        declared_at: new Date(),
      }).where(eq(users.id, ctx.user.id));
      
      return { success: true };
    }),
});
```

---

## 4. Gemini API — Regional Routing

### 4.1 The Problem

DraftCrick makes Gemini API calls for: FDR calculations, projected points, Guru chat, match previews, prediction questions, Rate My Team, player comparisons, and transfer planner suggestions.

These requests should route to the nearest Vertex AI region for:
- **Lower latency** — Mumbai users shouldn't hit US endpoints
- **Data residency** (optional) — if regulations require data to stay in-country
- **Cost optimization** — avoid unnecessary cross-region traffic

### 4.2 Vertex AI Gemini Regions (Relevant to Us)

| Region | Location | Code | Use Case |
|--------|----------|------|----------|
| **asia-south1** | Mumbai, India | `asia-south1` | Primary — Indian users |
| **asia-south2** | Delhi, India | `asia-south2` | Backup — Indian users |
| **asia-southeast1** | Singapore | `asia-southeast1` | SEA users, India fallback |
| **us-central1** | Iowa, USA | `us-central1` | US users |
| **us-east4** | Virginia, USA | `us-east4` | US East Coast |
| **europe-west1** | Belgium | `europe-west1` | EU users |
| **global** | Auto-routed | `global` | Highest availability, no data residency |

### 4.3 Recommended Approach: Region-Aware Gemini Client

```typescript
// packages/api/src/services/gemini-client.ts

import { GoogleGenAI } from '@google/genai';

// Map user regions to nearest Vertex AI endpoint
const REGION_MAP: Record<string, string> = {
  // India → Mumbai
  'IN': 'asia-south1',
  // South/Southeast Asia → Singapore
  'BD': 'asia-southeast1', 'LK': 'asia-southeast1', 'NP': 'asia-southeast1',
  'SG': 'asia-southeast1', 'MY': 'asia-southeast1', 'TH': 'asia-southeast1',
  'ID': 'asia-southeast1', 'PH': 'asia-southeast1', 'VN': 'asia-southeast1',
  // East Asia → Tokyo
  'JP': 'asia-northeast1', 'KR': 'asia-northeast3',
  // Australia → Sydney
  'AU': 'australia-southeast1',
  // Americas → US Central
  'US': 'us-central1', 'CA': 'northamerica-northeast1',
  'MX': 'us-central1', 'BR': 'us-central1',
  // Europe → Belgium
  'GB': 'europe-west1', 'DE': 'europe-west1', 'FR': 'europe-west1',
  'NL': 'europe-west1', 'IT': 'europe-west1', 'ES': 'europe-west1',
  // Middle East → Mumbai (closest)
  'AE': 'asia-south1', 'SA': 'asia-south1', 'QA': 'asia-south1',
};

const DEFAULT_REGION = 'asia-south1'; // Mumbai as default (most users are Indian)

export function getGeminiRegion(userCountry: string): string {
  return REGION_MAP[userCountry] ?? DEFAULT_REGION;
}

// Create a region-specific Gemini client
export function createGeminiClient(userCountry: string) {
  const region = getGeminiRegion(userCountry);
  
  return new GoogleGenAI({
    vertexai: true,
    project: process.env.GCP_PROJECT_ID!,
    location: region,
  });
}

// For batch/cron jobs (not user-facing), use global endpoint for best availability
export function createGeminiClientGlobal() {
  return new GoogleGenAI({
    vertexai: true,
    project: process.env.GCP_PROJECT_ID!,
    location: 'global', // Auto-routed by Google for highest availability
  });
}
```

**Usage in Services:**

```typescript
// packages/api/src/services/projection-engine.ts

export async function generateProjections(matchId: string, userCountry: string) {
  // User-facing: route to nearest region
  const client = createGeminiClient(userCountry);
  const model = client.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
  
  // ... generate projections
}

// packages/api/src/jobs/batch-projections.ts

export async function batchGenerateAllProjections(tournamentId: string) {
  // Background job: use global endpoint for best availability
  const client = createGeminiClientGlobal();
  const model = client.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
  
  // ... batch generate for all matches
}
```

### 4.4 Cost Comparison

| Approach | Latency (India) | Latency (US) | Data Residency | Cost |
|----------|-----------------|--------------|----------------|------|
| **Global endpoint only** | ~200-500ms | ~100-200ms | ❌ No control | Lowest |
| **Region-specific (recommended)** | ~50-150ms | ~100-200ms | ✅ Configurable | Low |
| **Multi-region with fallback** | ~50-150ms | ~100-200ms | ✅ Yes | Medium |

**Recommendation:** Use region-specific routing (`asia-south1` for India, `us-central1` for US) for user-facing requests, and `global` for background batch jobs. This gives us the best latency for our primary Indian user base without additional cost.

---

## 5. Infrastructure: Do We Need Geo-Distributed Database & Cache?

### 5.1 PostgreSQL (Cloud SQL) — Single Region with Cross-Region Read Replica

**Short answer: Start with single region. Add cross-region read replica when you need it.**

**Current Architecture (Recommended for Launch):**

```
┌─────────────────────────────────────┐
│        asia-south1 (Mumbai)          │
│                                      │
│  ┌──────────────────────────────┐   │
│  │ Cloud SQL PostgreSQL          │   │
│  │ Primary (HA-enabled)          │   │
│  │ - Writes + reads              │   │
│  │ - Auto-failover to standby   │   │
│  │   within same region          │   │
│  └──────────────────────────────┘   │
│                                      │
│  ┌──────────────────────────────┐   │
│  │ Redis / Memorystore           │   │
│  │ Primary (HA-enabled)          │   │
│  │ - Session cache               │   │
│  │ - API response cache          │   │
│  │ - Rate limiting               │   │
│  └──────────────────────────────┘   │
│                                      │
│  ┌──────────────────────────────┐   │
│  │ Cloud Run API                 │   │
│  │ - All tRPC endpoints          │   │
│  │ - Gemini calls routed by user │   │
│  └──────────────────────────────┘   │
└─────────────────────────────────────┘
```

**Why single-region is fine for launch:**

| Factor | Analysis |
|--------|----------|
| **Primary user base** | 90%+ Indian users → Mumbai is optimal |
| **Data size** | Small at launch (< 1GB) — replication overhead not justified |
| **Write patterns** | All writes go to primary anyway (read replicas are read-only) |
| **Latency** | Mumbai → US users add ~200ms — acceptable for non-real-time features |
| **Cost** | Single instance ≈ $50-100/mo. Cross-region replica doubles this |
| **Complexity** | Single connection string, no read/write splitting code needed |

**Cloud SQL Configuration:**

```yaml
# terraform/cloud-sql.tf (simplified)
resource "google_sql_database_instance" "primary" {
  name             = "draftcrick-db"
  region           = "asia-south1"
  database_version = "POSTGRES_16"
  
  settings {
    tier              = "db-custom-2-7680"  # 2 vCPU, 7.5 GB RAM
    availability_type = "REGIONAL"           # HA: auto-failover within region
    
    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = true
      start_time                     = "02:00"  # IST 7:30 AM
      transaction_log_retention_days = 7
      
      backup_retention_settings {
        retained_backups = 14
      }
    }
    
    ip_configuration {
      ipv4_enabled    = false         # Private IP only
      private_network = google_compute_network.vpc.id
    }
    
    maintenance_window {
      day  = 3  # Wednesday
      hour = 3  # 3 AM UTC = 8:30 AM IST
    }
  }
}
```

### 5.2 When to Add Cross-Region Read Replica

**Add a US read replica when:**
- US user base exceeds 10% of total users
- API response times for US users exceed 500ms for read-heavy endpoints
- You need US data residency for compliance

**Implementation (future):**

```yaml
# terraform/cloud-sql-replica.tf (add when needed)
resource "google_sql_database_instance" "us_replica" {
  name                 = "draftcrick-db-us-replica"
  region               = "us-central1"
  database_version     = "POSTGRES_16"
  master_instance_name = google_sql_database_instance.primary.name
  
  replica_configuration {
    failover_target = false  # Not auto-failover; manual DR only
  }
  
  settings {
    tier              = "db-custom-2-7680"
    availability_type = "ZONAL"  # Save cost on replica
  }
}
```

**Drizzle read/write splitting (add when replica exists):**

```typescript
// packages/db/src/client.ts

import { drizzle } from 'drizzle-orm/node-postgres';

// Primary: all writes + reads for Indian users
export const dbPrimary = drizzle(primaryPool);

// Replica: reads only, for US users  
export const dbReplicaUS = drizzle(usReplicaPool);

// Smart router: pick DB based on user region and operation type
export function getDB(userCountry: string, operation: 'read' | 'write') {
  if (operation === 'write') return dbPrimary; // Writes always go to primary
  if (userCountry === 'US' && dbReplicaUS) return dbReplicaUS;
  return dbPrimary;
}
```

### 5.3 Redis / Memorystore — Single Region (No Geo-Distribution Needed)

**Short answer: No, you do not need geo-distributed Redis.**

**Why:**
- Redis is used for caching, not persistence — cache misses just hit the DB
- DraftCrick's Redis stores: API response cache (24hr TTL), rate limiting counters, session tokens, distributed locks
- All of these are acceptable to serve from a single region
- A cache miss for a US user adds ~200ms (Mumbai round-trip) and then caches locally in Cloud Run's in-memory cache
- Memorystore doesn't support cross-region replication natively

**If latency becomes an issue (future):**
Instead of geo-distributing Redis, add **Cloud Run edge caching** or a **Cloudflare Workers KV** layer:

```
US User → Cloudflare Edge (US) → Cache Hit? → Return
                                    ↓ Miss
                              Cloud Run (Mumbai) → Redis → Return + Cache at Edge
```

This gives sub-50ms responses globally for cached data without the operational complexity of multi-region Redis.

**Memorystore Configuration:**

```yaml
# terraform/redis.tf
resource "google_redis_instance" "cache" {
  name           = "draftcrick-cache"
  tier           = "STANDARD_HA"      # HA with auto-failover within region
  memory_size_gb = 1
  region         = "asia-south1"
  
  redis_version = "REDIS_7_2"
  
  auth_enabled            = true
  transit_encryption_mode = "SERVER_AUTHENTICATION"
}
```

---

## 6. Implementation Timeline

| Task | Phase | Time | Priority |
|------|-------|------|----------|
| MaxMind GeoIP integration + middleware | 2.75 | 4h | P0 |
| Expo Location service + permission flow | 2.75 | 4h | P0 |
| User declaration onboarding step | 2.75 | 3h | P0 |
| `location_checks` table + audit logging | 2.75 | 2h | P0 |
| Regulation engine + feature gates | 2.75 | 4h | P0 |
| Gemini region-routing client | 2.75 | 2h | P1 |
| `geo.resolveLocation` tRPC endpoint | 2.75 | 2h | P0 |
| `geo.verifyForPaidAction` tRPC endpoint | 4 | 3h | P0 (when wallet goes live) |
| Client-side feature gating (hide wallet/prizes) | 2.75 | 3h | P0 |
| VPN detection heuristics | 7 | 4h | P1 |
| Cross-region PG read replica (US) | Post-launch | 4h | P2 |
| Edge caching layer (Cloudflare) | Post-launch | 6h | P2 |
| India state-level compliance (post-PROGA ruling) | 7 | 8h | P0 (if PROGA struck down) |

---

## 7. Decision Summary

| Question | Answer | Rationale |
|----------|--------|-----------|
| **How do we detect user region?** | 3 layers: IP + GPS + self-declaration | Defense in depth; IP is automatic, GPS is accurate, declaration is the legal record |
| **Do we ask the user their region?** | Yes, during onboarding (auto-filled from IP/GPS) | Required for legal compliance; user explicitly confirms eligibility |
| **How do we route Gemini API?** | Region-specific Vertex AI endpoint based on user's country | Lower latency for Indian users (Mumbai), US users (Iowa); global for batch jobs |
| **Do we need geo-distributed PostgreSQL?** | Not now. Single HA instance in Mumbai. Add US replica when US users > 10% | 90%+ Indian users; single region is simpler, cheaper, and sufficient at launch |
| **Do we need geo-distributed Redis?** | No. Single HA instance in Mumbai. Add edge caching later if needed | Redis is for caching — misses are acceptable; Memorystore doesn't support cross-region |
| **What happens if PROGA is upheld?** | India = free-to-play only; international = full features. Toggle `PROGA_ACTIVE` flag | Architecture supports both modes; single flag toggles entire feature set |
| **What happens if PROGA is struck down?** | Re-enable state-level checks; block AP/TG/AS/OD; real-money in other states | State ban list already in code; just flip the flag |
| **What about VPN users?** | Flag IP/GPS mismatch; require GPS for paid actions; block if confidence is 'low' | Can't block all VPNs, but GPS requirement for paid actions prevents circumvention |

---

## 8. Monitoring & Compliance Dashboards

### Admin Dashboard (Phase 6)

```
Geo Compliance Panel
├── Location Check Logs (searchable by user, date, zone)
├── Mismatch Alerts (IP ≠ GPS, potential VPN users)
├── Zone Distribution (pie chart: india_free / india_paid / international / blocked)
├── Blocked Action Attempts (users trying paid actions from banned zones)
├── PROGA Toggle (admin can flip PROGA_ACTIVE flag)
├── State Ban List Editor (add/remove states from ban list)
└── Gemini API Region Stats (requests per region, latency p50/p95/p99)
```

---

**This document should be reviewed and updated after the Indian Supreme Court PROGA ruling (expected January–March 2026). The feature gate configuration and state ban list should be treated as living configuration, not hardcoded constants.**