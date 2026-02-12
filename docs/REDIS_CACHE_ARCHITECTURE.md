# Redis Cache Architecture for Serverless Deployment

## v3.0 — Smart Refresh Architecture (Current)

> **Redis is no longer the primary data store.** PostgreSQL is now the source of truth for all sports data. Redis serves three focused roles: hot cache, distributed lock, and rate limiting.
>
> For full details, see [`SMART_REFRESH_ARCHITECTURE.md`](./SMART_REFRESH_ARCHITECTURE.md).

### Redis's Three Roles in v3.0

#### 1. Hot Cache (5-minute TTL)

Caches fully-formed API responses to avoid repeated PostgreSQL queries within short windows.

```typescript
// Key format
`sports:hot:{sport}:{endpoint}:{params_hash}`

// TTL: 5 minutes (300 seconds)
await redis.setex(key, 300, JSON.stringify(response));
```

#### 2. Distributed Refresh Lock (30-second TTL)

Prevents multiple containers from triggering the same Gemini API refresh simultaneously. Same pattern as v2.0 but scoped to individual entities (matches, tournaments) instead of entire sports.

```typescript
// Key format
`sports:refresh-lock:{entity_type}:{entity_id}`

// Example: lock refresh for a specific match
`sports:refresh-lock:match:ipl_2026_match_15`

// TTL: 30 seconds, NX (only if not exists)
const acquired = await redis.set(lockKey, "1", "EX", 30, "NX");
```

#### 3. Rate Limiting

Per-user rate limiting to prevent abuse.

```typescript
// Key format
`sports:rate:{user_id}:{endpoint}`

// TTL: 1 minute
// Limit: 30 requests per minute per endpoint
```

### v3.0 Architecture Flow

```
User Request
    ↓
Redis Hot Cache (5min TTL) ──→ [HIT] → Return immediately (~5-10ms)
    ↓ [MISS]
PostgreSQL (source of truth)
    ↓
  [FRESH?] ──→ YES → Return from PG → Write to Redis hot cache → Return (~30-50ms)
    ↓ NO (stale)
Return existing PG data immediately (stale-while-revalidate)
    ↓ [background]
Acquire Redis refresh lock
    ↓
Call Gemini API → Upsert into PostgreSQL → Invalidate Redis hot cache
    ↓
Next request gets fresh data
```

### v3.0 Redis Key Reference

```bash
# Hot cache keys (5min TTL)
KEYS sports:hot:*

# Refresh lock keys (30s TTL)
KEYS sports:refresh-lock:*

# Rate limit keys (1min TTL)
KEYS sports:rate:*

# Check specific hot cache entry
GET sports:hot:cricket:dashboard:abc123
TTL sports:hot:cricket:dashboard:abc123

# Check if a refresh is in progress
GET sports:refresh-lock:match:ipl_2026_match_15

# Clear all hot cache (force PG reads)
redis-cli --scan --pattern "sports:hot:*" | xargs redis-cli DEL
```

### v3.0 Cost & Performance

| Metric | v2.0 (Redis Primary) | v3.0 (PG Primary + Redis Hot Cache) |
|--------|---------------------|--------------------------------------|
| Redis memory | ~8MB (full 24hr data) | ~10MB peak (more keys, shorter lived) |
| Redis TTL | 24 hours | 5 minutes |
| Gemini API calls/day | 4 max (1/sport) | Varies by match activity (typically fewer) |
| Cache miss latency | 3-5s (Gemini call) | 30-50ms (PG query) or 3-5s (cold start only) |
| Cache hit latency | 5-20ms | 5-10ms |
| Data durability | Lost on Redis restart | Survives everything (PG is source of truth) |
| Historical queries | Impossible | Full query support via PG |

---

## v2.0 — Redis as Primary Store (Legacy)

> **Note:** This section documents the v2.0 architecture for historical reference. The active architecture is v3.0 above. See [`SMART_REFRESH_ARCHITECTURE.md`](./SMART_REFRESH_ARCHITECTURE.md) for the full v3.0 specification.

### Problem Fixed: In-Memory → Redis Cache

The original implementation used in-memory caching which would **NOT work** in serverless/container environments.

### What Was Wrong (v1.0 — In-Memory):
```typescript
// BAD for serverless
const cache = new Map<string, CacheEntry>();
```

**Issues:**
1. **Lost on container restart** - Every cold start = cache reset
2. **Not shared** - Each container instance has its own separate cache
3. **Wasted API calls** - Multiple containers would all call Gemini API separately
4. **Expensive** - In serverless, you could have 10+ containers, each calling Gemini API independently

### v2.0 Solution: Redis-Based Persistent Cache

```typescript
// GOOD for serverless
const redis = new Redis(process.env.REDIS_URL);
await redis.setex(key, CACHE_TTL_SECONDS, JSON.stringify(data));
```

**Key Improvements:**
1. **Persistent Across Restarts** — Cache survives container restarts, 24-hour TTL managed by Redis
2. **Shared Across All Containers** — One fetch benefits all containers
3. **Distributed Lock** — Prevents multiple containers from fetching simultaneously
4. **Graceful Fallback** — Falls back to direct Gemini API call if Redis fails

### v2.0 Architecture Flow

**First Request (Cache Miss):**
```
User Request → Container 1
             ↓
Container 1 checks Redis → Empty
             ↓
Container 1 acquires lock in Redis
             ↓
Container 1 calls Gemini API
             ↓
Container 1 stores result in Redis (24hr TTL)
             ↓
Container 1 returns data to user
```

**Subsequent Requests (Cache Hit):**
```
User Request → Container 2
             ↓
Container 2 checks Redis → Found!
             ↓
Container 2 returns cached data (no Gemini call)
             ↓
Takes <10ms instead of 3-5 seconds
```

**Concurrent Requests (Race Condition Handled):**
```
User A Request → Container 1
User B Request → Container 2 (same time)
                      ↓
Container 1 checks Redis → Empty → Acquires lock
Container 2 checks Redis → Empty → Tries lock → BLOCKED
                      ↓
Container 1 fetches from Gemini
Container 2 waits 1 second, retries Redis → Found!
                      ↓
Both return same data, only 1 API call made
```

### v2.0 Cost & Performance

**Gemini API Costs Saved:**
- **Before (v1.0)**: ~100-500 calls/day (depending on traffic & containers)
- **After (v2.0)**: 4 calls/day maximum (1 per sport)
- **Savings**: 96-99% reduction in API costs

**Response Time:**
- **Before (no cache)**: 3-5 seconds per request
- **After (Redis hit)**: 5-20ms per request

### v2.0 Redis CLI Commands (Legacy)

```bash
# These key patterns are from v2.0. For v3.0 keys, see the section above.

# Check all cache keys
KEYS sports:*

# Get cached data
GET sports:dashboard:cricket

# Check TTL (time to live)
TTL sports:dashboard:cricket

# Manual clear cache
DEL sports:dashboard:cricket

# Check lock status
GET sports:lock:cricket
```

---

## Production Deployment

### GCP Serverless Options:
1. **Cloud Run** (recommended) + **Memorystore for Redis**
2. **Cloud Functions** + **Memorystore for Redis**
3. **GKE Autopilot** + **Memorystore for Redis**

### Redis Configuration:
```bash
# Development (local)
REDIS_URL=redis://localhost:6379

# Production (GCP Memorystore)
REDIS_URL=redis://10.x.x.x:6379
# or with password:
REDIS_URL=redis://:password@10.x.x.x:6379
```

### Memorystore Setup:
```bash
# Create Redis instance in GCP
gcloud redis instances create draftcrick-cache \
  --size=1 \
  --region=asia-south1 \
  --redis-version=redis_7_0 \
  --tier=basic

# Get connection details
gcloud redis instances describe draftcrick-cache \
  --region=asia-south1
```

---

## Monitoring & Debugging

### v3.0 Cache Status Endpoint

```typescript
// Query the cacheStatus endpoint
const status = await trpc.sports.cacheStatus.query();

// Returns:
{
  "cricket": {
    "fresh": true,
    "fetchedAt": "2026-02-12T10:30:00Z",
    "matchCount": 45,
    "tournamentCount": 8,
    "source": "postgresql",          // NEW: shows data source
    "hotCacheHit": true,             // NEW: whether served from Redis
    "lastRefreshDuration": 2340,     // NEW: ms for last Gemini refresh
    "nextRefreshAfter": "2026-02-12T10:35:00Z"  // NEW: when data goes stale
  },
  "football": null  // Not loaded yet
}
```

### Testing

**Test Hot Cache Hit (v3.0):**
```bash
# First request (PG miss → Gemini fetch → PG write → Redis write)
time curl http://localhost:3001/trpc/sports.dashboard?input=%7B%22sport%22%3A%22cricket%22%7D
# Takes 3-5 seconds (cold start)

# Second request (Redis hot cache hit)
time curl http://localhost:3001/trpc/sports.dashboard?input=%7B%22sport%22%3A%22cricket%22%7D
# Takes <10ms

# After 5 minutes (Redis expired, PG hit — still fresh)
time curl http://localhost:3001/trpc/sports.dashboard?input=%7B%22sport%22%3A%22cricket%22%7D
# Takes ~30-50ms (PG query, re-populates Redis)
```

**Test Distributed Lock:**
```bash
# Clear hot cache
redis-cli --scan --pattern "sports:hot:*" | xargs redis-cli DEL

# Make 5 simultaneous requests
for i in {1..5}; do
  curl http://localhost:3001/trpc/sports.dashboard?input=%7B%22sport%22%3A%22cricket%22%7D &
done

# Only 1 Gemini API call in logs (lock prevents duplicates)
```

---

## Summary

### Architecture Evolution:
- v1.0: In-memory `Map()` cache (bad for serverless)
- v2.0: Redis as primary 24hr data store (good for serverless, but ephemeral)
- **v3.0: PostgreSQL source of truth + Redis hot cache (durable + fast)**

### v3.0 Key Features:
1. **Durable** — Data persists in PostgreSQL, survives any restart
2. **Smart** — Per-match refresh intervals based on match phase
3. **Fast** — Redis hot cache for sub-10ms responses
4. **Locked** — Distributed locks prevent duplicate Gemini calls
5. **Observable** — Full audit trail in `data_refresh_log` table
6. **Resilient** — Works without Redis (falls back to PG), works without Gemini (serves stale PG data)

### Production Ready:
- Works with GCP Cloud Run + Memorystore + Cloud SQL
- Handles high concurrency with distributed locks
- Minimal Gemini API costs via smart refresh intervals
- Full monitoring via PostgreSQL queries and Redis key inspection

---

**Updated:** February 12, 2026
**Version:** 3.0 (PostgreSQL source of truth + Redis hot cache)
**Status:** Production-ready for serverless deployment
