# Smart Refresh Architecture — Sports Data Persistence

> **Version:** 1.0
> **Created:** February 12, 2026
> **Status:** Approved — ready for implementation
> **Related docs:** [`REDIS_CACHE_ARCHITECTURE.md`](./REDIS_CACHE_ARCHITECTURE.md), [`NEW_PLAN.md`](./NEW_PLAN.md)

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Architecture Overview](#architecture-overview)
3. [Database Schema](#database-schema)
4. [Smart Refresh Intervals](#smart-refresh-intervals)
5. [First-User-Triggers-Refresh Pattern](#first-user-triggers-refresh-pattern)
6. [Redis's New Role](#rediss-new-role)
7. [Service Layer Design](#service-layer-design)
8. [Request Flow](#request-flow)
9. [Edge Cases](#edge-cases)
10. [Migration Strategy](#migration-strategy)
11. [Monitoring & Observability](#monitoring--observability)

---

## Problem Statement

### Why Ephemeral Redis-Only Caching Is Insufficient

The v2.0 architecture (see `REDIS_CACHE_ARCHITECTURE.md`) stores all sports data exclusively in Redis with a 24-hour TTL. This creates several problems as DraftCrick grows:

| Problem | Impact |
|---------|--------|
| **Data loss on TTL expiry** | Every 24 hours, all cached data evaporates. The next user triggers a full Gemini API refetch — slow and expensive. |
| **No historical record** | We can't query "what did the data look like yesterday?" There's no audit trail. |
| **Uniform refresh is wasteful** | A match 3 days away doesn't need the same refresh frequency as a live match. 24hr TTL is both too stale for live matches and too frequent for idle ones. |
| **No stable IDs** | Gemini returns data with generated IDs that change on each call. Without persistence, we can't maintain stable foreign keys to matches/tournaments. |
| **Redis cost at scale** | Storing full JSON blobs for every sport's entire dataset is expensive in Redis. PostgreSQL is 10-50x cheaper per GB. |
| **Fragile to Redis restarts** | If Memorystore restarts or has a maintenance window, all data is gone. |

### What We Need

- **PostgreSQL as source of truth** — durable, queryable, supports relationships
- **Smart per-match refresh intervals** — live matches refresh every 5 min, idle matches every 12 hours
- **Stable IDs** — matches and tournaments get persistent UUIDs on first insert
- **Redis as a thin hot cache** — 5-minute TTL for frequently accessed data, not the primary store
- **No cron jobs** — first user request triggers a refresh if data is stale

---

## Architecture Overview

### Before (v2.0): Redis as Primary Store

```
User Request → Redis (24hr TTL) → [miss] → Gemini API → Redis
                                → [hit]  → Return cached data
```

### After (v3.0): PostgreSQL Source of Truth + Redis Hot Cache

```
User Request
    ↓
Redis Hot Cache (5min TTL)
    ↓ [miss]
PostgreSQL (source of truth)
    ↓ [stale? check refresh interval]
    ↓ [fresh] → Return from PG → Populate Redis → Return to user
    ↓ [stale] → Acquire Redis lock → Call Gemini API → Write to PG → Populate Redis → Return to user
```

### Full Architecture Diagram

```
┌──────────────┐
│   User App   │
│  (React Native) │
└──────┬───────┘
       │ tRPC request
       ▼
┌──────────────┐
│  sports.ts   │  ← tRPC router
│   (router)   │
└──────┬───────┘
       │
       ▼
┌──────────────────┐
│  sports-cache.ts │  ← Thin hot-cache layer
│  (Redis 5min)    │
└──────┬───────────┘
       │ [miss]
       ▼
┌──────────────────┐
│  sports-data.ts  │  ← NEW: Write-through service
│  (PostgreSQL)    │
│                  │
│  • Check staleness│
│  • Upsert data   │
│  • Log refreshes │
└──────┬───────────┘
       │ [stale]
       ▼
┌──────────────────┐
│  gemini-sports.ts│  ← Gemini API client
│  (AI fetch)      │
└──────────────────┘

Side stores:
┌──────────────────┐
│  data_refresh_log│  ← Audit trail of all refreshes
│  (PostgreSQL)    │
└──────────────────┘

┌──────────────────┐
│  Redis           │
│  • Hot cache     │  ← 5min TTL response cache
│  • Refresh lock  │  ← Distributed lock (30s)
│  • Rate limiter  │  ← Per-user rate limiting
└──────────────────┘
```

---

## Database Schema

### New Table: `tournaments`

Persists tournament data from Gemini API with stable IDs.

```sql
CREATE TABLE tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT NOT NULL,           -- Gemini's tournament identifier (e.g., "ipl_2026")
  name TEXT NOT NULL,                  -- "Indian Premier League 2026"
  short_name TEXT,                     -- "IPL 2026"
  sport TEXT NOT NULL DEFAULT 'cricket',
  format TEXT,                         -- "T20", "ODI", "Test"
  status TEXT NOT NULL DEFAULT 'upcoming'
    CHECK (status IN ('upcoming', 'active', 'completed', 'cancelled')),
  start_date DATE,
  end_date DATE,
  country TEXT,                        -- Host country

  -- Metadata from Gemini
  teams JSONB,                         -- [{name, shortName, logo}]
  venue_info JSONB,                    -- [{name, city, country}]

  -- Refresh tracking
  last_refreshed_at TIMESTAMPTZ,
  refresh_source TEXT,                 -- 'gemini', 'manual', 'seed'

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(external_id, sport)
);

CREATE INDEX idx_tournaments_sport_status ON tournaments(sport, status);
CREATE INDEX idx_tournaments_external_id ON tournaments(external_id);
```

### New Table: `data_refresh_log`

Audit trail for every data refresh operation.

```sql
CREATE TABLE data_refresh_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,           -- 'tournament', 'match', 'dashboard'
  entity_id TEXT,                      -- Match ID, tournament ID, or NULL for dashboard
  sport TEXT NOT NULL DEFAULT 'cricket',

  -- Refresh details
  trigger TEXT NOT NULL                -- 'user_request', 'cold_start', 'manual'
    CHECK (trigger IN ('user_request', 'cold_start', 'manual')),
  triggered_by_user_id UUID,           -- Which user's request triggered it

  -- Timing
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,

  -- Result
  status TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'success', 'failed', 'skipped')),
  error_message TEXT,

  -- Data stats
  records_upserted INTEGER DEFAULT 0,
  records_unchanged INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_refresh_log_entity ON data_refresh_log(entity_type, entity_id);
CREATE INDEX idx_refresh_log_sport_status ON data_refresh_log(sport, status);
CREATE INDEX idx_refresh_log_created ON data_refresh_log(created_at);
```

### Modified Table: `matches` (ALTER)

Add refresh metadata columns to existing matches table.

```sql
ALTER TABLE matches ADD COLUMN IF NOT EXISTS
  tournament_id UUID REFERENCES tournaments(id);

ALTER TABLE matches ADD COLUMN IF NOT EXISTS
  external_id TEXT;                     -- Gemini's match identifier

ALTER TABLE matches ADD COLUMN IF NOT EXISTS
  match_phase TEXT DEFAULT 'idle'
    CHECK (match_phase IN ('idle', 'pre_match', 'live', 'post_match', 'completed'));

ALTER TABLE matches ADD COLUMN IF NOT EXISTS
  last_refreshed_at TIMESTAMPTZ;

ALTER TABLE matches ADD COLUMN IF NOT EXISTS
  next_refresh_after TIMESTAMPTZ;       -- Computed: last_refreshed_at + interval for phase

ALTER TABLE matches ADD COLUMN IF NOT EXISTS
  refresh_count INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_matches_tournament ON matches(tournament_id);
CREATE INDEX IF NOT EXISTS idx_matches_external_id ON matches(external_id);
CREATE INDEX IF NOT EXISTS idx_matches_phase ON matches(match_phase);
CREATE INDEX IF NOT EXISTS idx_matches_next_refresh ON matches(next_refresh_after);
```

---

## Smart Refresh Intervals

Each match has a **phase** that determines how frequently its data should be refreshed when requested:

| Match Phase | Refresh Interval | Rationale |
|-------------|-----------------|-----------|
| `idle` | 12 hours | Match is far away (>48h). Minimal changes expected. |
| `pre_match` | 2 hours | Match within 48h. Squad announcements, pitch reports, weather updates. |
| `live` | 5 minutes | Match in progress. Score, wickets, overs change constantly. |
| `post_match` | 30 minutes | Match ended <6h ago. Final stats, player of the match, post-match analysis. |
| `completed` | Never (manual only) | Match fully settled. Data frozen. Only refreshed via admin action. |

### Phase Transition Logic

```typescript
function determineMatchPhase(match: Match): MatchPhase {
  const now = new Date();
  const matchStart = new Date(match.start_time);
  const matchEnd = match.end_time ? new Date(match.end_time) : null;
  const hoursUntilStart = (matchStart.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (match.status === 'completed' || match.status === 'cancelled') {
    return 'completed';
  }
  if (matchEnd && now > matchEnd) {
    const hoursSinceEnd = (now.getTime() - matchEnd.getTime()) / (1000 * 60 * 60);
    return hoursSinceEnd < 6 ? 'post_match' : 'completed';
  }
  if (match.status === 'live' || match.status === 'in_progress') {
    return 'live';
  }
  if (hoursUntilStart <= 48) {
    return 'pre_match';
  }
  return 'idle';
}
```

### Refresh Interval Map

```typescript
const REFRESH_INTERVALS: Record<MatchPhase, number | null> = {
  idle:        12 * 60 * 60 * 1000,  // 12 hours
  pre_match:   2 * 60 * 60 * 1000,   // 2 hours
  live:        5 * 60 * 1000,         // 5 minutes
  post_match:  30 * 60 * 1000,        // 30 minutes
  completed:   null,                   // Never auto-refresh
};
```

---

## First-User-Triggers-Refresh Pattern

There are **no cron jobs**. Refreshes are triggered lazily by user requests:

1. User requests sports data (dashboard, match details, etc.)
2. System checks PostgreSQL for the requested data
3. If data exists and `next_refresh_after > NOW()` → return cached PG data
4. If data is stale or missing → acquire Redis lock → call Gemini → upsert PG → return fresh data
5. Other concurrent users requesting the same data while refresh is in-flight get the existing (slightly stale) PG data — they don't wait

### Why No Cron?

| Approach | Pros | Cons |
|----------|------|------|
| **Cron** | Always fresh | Wastes API calls on data nobody is viewing. Costs money 24/7. Complex infrastructure. |
| **User-triggered** | Only refreshes data users actually want. Zero cost when nobody is active. Simpler infra. | First user after staleness window sees slightly slower response. |

For a fantasy cricket app where traffic is highly bursty (match days vs off days), user-triggered refresh is dramatically more cost-effective.

### Stale-While-Revalidate

When a refresh is triggered, the user **does not wait** for the Gemini API call to complete if we have existing data:

```
1. User requests data
2. PG has data but it's stale
3. Return existing PG data immediately (stale but fast)
4. Trigger background refresh (async)
5. Next request gets fresh data
```

Exception: **cold start** (no data in PG at all) — user must wait for the first Gemini fetch.

---

## Redis's New Role

Redis transitions from **primary data store** to **three focused roles**:

### 1. Hot Cache (5-minute TTL)

Caches the fully-formed API response JSON to avoid repeated PG queries for the same data within a short window.

```typescript
// Key format
`sports:hot:{sport}:{endpoint}:{params_hash}`

// Example
`sports:hot:cricket:dashboard:abc123`

// TTL: 5 minutes (300 seconds)
```

### 2. Distributed Refresh Lock (30-second TTL)

Prevents multiple containers from triggering the same Gemini API refresh simultaneously.

```typescript
// Key format
`sports:refresh-lock:{entity_type}:{entity_id}`

// Example
`sports:refresh-lock:match:ipl_2026_match_15`

// TTL: 30 seconds
// Set with NX (only if not exists)
```

### 3. Rate Limiting

Per-user rate limiting to prevent abuse.

```typescript
// Key format
`sports:rate:{user_id}:{endpoint}`

// Example
`sports:rate:user_123:dashboard`

// TTL: 1 minute
// Limit: 30 requests per minute per endpoint
```

### Redis Memory Comparison

| Metric | v2.0 (Primary Store) | v3.0 (Hot Cache) |
|--------|---------------------|-------------------|
| TTL | 24 hours | 5 minutes |
| Data size per sport | ~500KB-2MB | ~500KB-2MB |
| Max keys | 4 (1 per sport) | ~50 (varies by active endpoints) |
| Peak memory | ~8MB | ~10MB (more keys, shorter lived) |
| Eviction risk | High (24hr data) | Low (5min, self-evicting) |

---

## Service Layer Design

### `sports-data.ts` — NEW: Write-Through PostgreSQL Service

This is the core new service. It sits between the router and Gemini, managing PostgreSQL persistence.

```typescript
// packages/api/src/services/sports-data.ts

interface SportsDataService {
  // Read operations (check PG, trigger refresh if stale)
  getDashboard(sport: string): Promise<DashboardData>;
  getTournament(tournamentId: string): Promise<TournamentData>;
  getMatch(matchId: string): Promise<MatchData>;

  // Write operations (called after Gemini fetch)
  upsertTournaments(sport: string, tournaments: GeminiTournament[]): Promise<Tournament[]>;
  upsertMatches(tournamentId: string, matches: GeminiMatch[]): Promise<Match[]>;

  // Refresh operations
  shouldRefresh(entityType: string, entityId: string): Promise<boolean>;
  executeRefresh(entityType: string, entityId: string, userId?: string): Promise<RefreshResult>;
  logRefresh(log: RefreshLogEntry): Promise<void>;
}
```

**Key responsibilities:**
- Check staleness against `next_refresh_after`
- Upsert Gemini data into PG with stable ID matching (by `external_id`)
- Compute `next_refresh_after` based on match phase
- Log all refresh operations to `data_refresh_log`

### `sports-cache.ts` — MODIFIED: Thin Hot-Cache Layer

Reduced from primary data store to a simple Redis read-through cache.

```typescript
// packages/api/src/services/sports-cache.ts (modified)

interface SportsCacheService {
  // Hot cache read/write
  getFromHotCache<T>(key: string): Promise<T | null>;
  setHotCache<T>(key: string, data: T, ttlSeconds?: number): Promise<void>;
  invalidateHotCache(pattern: string): Promise<void>;

  // Distributed lock for refresh
  acquireRefreshLock(entityKey: string): Promise<boolean>;
  releaseRefreshLock(entityKey: string): Promise<void>;

  // Rate limiting
  checkRateLimit(userId: string, endpoint: string): Promise<boolean>;
}
```

### `sports.ts` — MODIFIED: tRPC Router

Updated to use the new service stack:

```typescript
// Simplified flow in router
sports.dashboard = publicProcedure
  .input(z.object({ sport: z.string() }))
  .query(async ({ input }) => {
    // 1. Check Redis hot cache
    const cached = await sportsCache.getFromHotCache(`dashboard:${input.sport}`);
    if (cached) return cached;

    // 2. Get from PostgreSQL (triggers refresh if stale)
    const data = await sportsData.getDashboard(input.sport);

    // 3. Populate hot cache
    await sportsCache.setHotCache(`dashboard:${input.sport}`, data, 300);

    return data;
  });
```

---

## Request Flow

### Scenario 1: Hot Cache Hit (fastest — <10ms)

```
User → sports.dashboard("cricket")
  → Redis GET sports:hot:cricket:dashboard → HIT
  → Return cached response
  ✅ Total: ~5-10ms
```

### Scenario 2: Hot Cache Miss, PG Fresh (fast — <50ms)

```
User → sports.dashboard("cricket")
  → Redis GET → MISS
  → PostgreSQL query (tournaments + matches where sport=cricket)
  → Data found, next_refresh_after > NOW() → FRESH
  → Build response → SET Redis hot cache (5min TTL)
  → Return response
  ✅ Total: ~30-50ms
```

### Scenario 3: Hot Cache Miss, PG Stale (stale-while-revalidate — <50ms + background)

```
User → sports.dashboard("cricket")
  → Redis GET → MISS
  → PostgreSQL query → Data found but STALE (next_refresh_after < NOW())
  → Return existing data immediately (stale but fast)
  → [Background] Acquire Redis lock → Gemini API (3-5s) → Upsert PG → SET Redis → Log refresh
  ✅ User sees: ~30-50ms (stale data)
  ✅ Next user sees: fresh data
```

### Scenario 4: Cold Start (slowest — 3-5s, first-time only)

```
User → sports.dashboard("cricket")
  → Redis GET → MISS
  → PostgreSQL query → NO DATA
  → Acquire Redis lock → Call Gemini API (3-5s)
  → Upsert tournaments + matches into PG
  → SET Redis hot cache
  → Log refresh (trigger: cold_start)
  → Return response
  ⚠️ Total: ~3-5s (one-time cost)
```

### Scenario 5: Concurrent Requests During Refresh

```
User A → sports.dashboard("cricket") → PG stale → Acquires lock → Calls Gemini...
User B → sports.dashboard("cricket") → Redis MISS → PG stale → Lock EXISTS
  → Returns existing stale PG data (does NOT wait for User A's refresh)
User C → sports.dashboard("cricket") → Redis MISS → PG stale → Lock EXISTS
  → Returns existing stale PG data

[3 seconds later]
User A's Gemini call completes → Upserts PG → Sets Redis hot cache

User D → sports.dashboard("cricket") → Redis HIT (fresh from User A's refresh)
  → Returns fresh data in ~5ms
```

---

## Edge Cases

### Cold Start (No Data in PG)

**Trigger:** First-ever request for a sport, or after a database reset.

**Behavior:** User must wait for full Gemini API call (~3-5s). No stale-while-revalidate possible because there's nothing stale to return.

**Mitigation:** Seed initial data during deployment via `sports-data.ts` seed script.

### Race Conditions

**Scenario:** Two containers detect staleness simultaneously.

**Solution:** Redis distributed lock (`SET key NX EX 30`). Only one container fetches from Gemini. The other returns stale PG data.

**Lock failure:** If the lock holder crashes, the lock auto-expires in 30 seconds. Next request retries.

### Failed Refreshes

**Scenario:** Gemini API returns an error or times out.

**Behavior:**
1. Log failure to `data_refresh_log` with `status: 'failed'` and `error_message`
2. Release the Redis lock
3. Do NOT update PG data (keep existing data intact)
4. Do NOT update `next_refresh_after` (so the next request retries)
5. Return existing PG data to the user (graceful degradation)

**Retry strategy:** No automatic retries. The next user request will attempt a fresh Gemini call (natural retry via traffic).

### Stable ID Matching

**Problem:** Gemini generates different IDs for the same tournament/match across calls.

**Solution:** Match on `external_id` (a combination of Gemini's identifiers that we normalize):

```typescript
function normalizeExternalId(geminiData: GeminiTournament): string {
  // Create a stable identifier from Gemini's data
  return `${geminiData.name.toLowerCase().replace(/\s+/g, '_')}_${geminiData.year}`;
  // e.g., "indian_premier_league_2026"
}
```

**Upsert logic:**
```sql
INSERT INTO tournaments (external_id, name, ...)
VALUES ($1, $2, ...)
ON CONFLICT (external_id, sport)
DO UPDATE SET name = EXCLUDED.name, ... , updated_at = NOW();
```

### Redis Unavailable

**Scenario:** Redis is down or unreachable.

**Behavior:**
1. Skip hot cache check — go directly to PostgreSQL
2. Skip distributed lock — accept possible duplicate Gemini calls (rare, acceptable)
3. Skip hot cache write — data still persisted in PG
4. Log Redis failure for alerting

**Key principle:** PostgreSQL is the source of truth. The system works without Redis, just slower.

### Match Phase Transitions

**Scenario:** A match transitions from `pre_match` to `live`.

**Behavior:** Phase is recomputed on every request based on current time and match status. No background process needed.

```
Request at 14:55 (match starts at 15:00) → phase = pre_match → interval = 2h
Request at 15:01 (match started) → phase = live → interval = 5min
```

---

## Migration Strategy

### Phase 1: Schema Creation (Day 1)

1. Create `tournaments` table via Drizzle migration
2. Create `data_refresh_log` table via Drizzle migration
3. Add columns to `matches` table via ALTER migration
4. Run migrations against dev database
5. Verify tables with `SELECT * FROM pg_tables`

### Phase 2: Service Layer (Day 1-2)

1. Create `sports-data.ts` with PostgreSQL read/write logic
2. Refactor `sports-cache.ts` to thin hot-cache (keep backward-compatible API temporarily)
3. Update `sports.ts` router to use new service stack
4. Add shared types for match phases, refresh intervals

### Phase 3: Data Migration (Day 2)

1. Trigger initial data load by calling the dashboard endpoint
2. Verify tournaments and matches populated in PG
3. Verify `data_refresh_log` has entries
4. Verify stable IDs are consistent across multiple Gemini calls

### Phase 4: Cleanup (Day 3)

1. Remove old 24hr Redis cache code paths
2. Update cache status endpoint to show new architecture
3. Update E2E tests for new response shapes (if any)
4. Monitor for a day before removing fallback paths

### Rollback Plan

If issues arise:
1. `sports-cache.ts` retains the old 24hr cache path behind a feature flag
2. Set `SMART_REFRESH_ENABLED=false` in env to revert to v2.0 behavior
3. PostgreSQL tables remain (no data loss) — just not read from

---

## Monitoring & Observability

### Key Metrics to Track

| Metric | Source | Alert Threshold |
|--------|--------|----------------|
| Refresh duration (p50, p95) | `data_refresh_log.duration_ms` | p95 > 10s |
| Failed refresh rate | `data_refresh_log.status = 'failed'` | > 3 consecutive failures |
| Hot cache hit rate | Redis `GET` hit/miss ratio | < 50% (indicates TTL too short) |
| PG query latency | Application metrics | p95 > 100ms |
| Lock contention | Redis lock acquisition failures | > 10/min |
| Gemini API calls/day | `data_refresh_log` count | > 100 (regression to old behavior) |

### Useful Queries

```sql
-- Recent refresh activity
SELECT entity_type, entity_id, status, duration_ms, created_at
FROM data_refresh_log
ORDER BY created_at DESC
LIMIT 20;

-- Failed refreshes in last hour
SELECT * FROM data_refresh_log
WHERE status = 'failed' AND created_at > NOW() - INTERVAL '1 hour';

-- Average refresh duration by entity type
SELECT entity_type,
       AVG(duration_ms) as avg_ms,
       COUNT(*) as total_refreshes
FROM data_refresh_log
WHERE status = 'success' AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY entity_type;

-- Matches due for refresh
SELECT id, external_id, match_phase, last_refreshed_at, next_refresh_after
FROM matches
WHERE next_refresh_after < NOW() AND match_phase != 'completed'
ORDER BY next_refresh_after ASC;

-- Tournament data freshness
SELECT id, name, status, last_refreshed_at,
       NOW() - last_refreshed_at as age
FROM tournaments
ORDER BY last_refreshed_at DESC;
```

### Redis Keys to Monitor

```bash
# Hot cache keys
KEYS sports:hot:*

# Active refresh locks
KEYS sports:refresh-lock:*

# Rate limit counters
KEYS sports:rate:*

# Check if a specific refresh is locked
GET sports:refresh-lock:match:ipl_2026_match_15
```

---

## Summary

| Aspect | v2.0 (Old) | v3.0 (Smart Refresh) |
|--------|-----------|---------------------|
| **Source of truth** | Redis (ephemeral) | PostgreSQL (durable) |
| **Cache layer** | Redis (24hr TTL) | Redis hot cache (5min TTL) |
| **Refresh trigger** | TTL expiry (passive) | User request + staleness check (active) |
| **Refresh frequency** | Uniform 24hr | Per-match phase (5min to 12hr) |
| **ID stability** | None (regenerated each call) | Stable UUIDs via external_id matching |
| **Historical data** | None | Full audit trail in data_refresh_log |
| **Cold start cost** | 3-5s (every 24hr) | 3-5s (one-time, then never) |
| **Steady-state latency** | 5-20ms (Redis hit) | 5-10ms (Redis hit) or 30-50ms (PG hit) |
| **Gemini API calls/day** | 4 (1 per sport) | Varies by traffic + match activity. Typically fewer. |
| **Cost** | Higher Redis memory | Lower Redis memory + PG storage (cheaper) |
| **Resilience** | Lost on Redis restart | Survives everything except PG failure |

---

**Updated:** February 12, 2026
**Version:** 1.0
**Status:** Ready for implementation in Phase 2.75A
