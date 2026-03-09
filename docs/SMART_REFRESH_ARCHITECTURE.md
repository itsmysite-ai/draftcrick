# Smart Refresh Architecture

> **Last Updated:** February 12, 2026
> **Status:** Implemented (Phase 2.75)
> **Key Files:** `packages/api/src/services/sports-data.ts`, `packages/api/src/services/gemini-sports.ts`, `packages/api/src/services/sports-cache.ts`, `packages/api/src/routers/sports.ts`

---

## Overview

The Smart Refresh Architecture is the data pipeline that keeps DraftPlay's sports data fresh. It uses a 3-tier caching strategy with write-through persistence:

```
Client Request
     │
     ▼
┌─────────────────────┐
│  Redis Hot Cache     │  ← 5 min TTL, fastest reads
│  (sports-cache.ts)   │
└──────────┬──────────┘
           │ miss
           ▼
┌─────────────────────┐
│  PostgreSQL          │  ← Source of truth, persists across deploys
│  (sports-data.ts)    │
└──────────┬──────────┘
           │ stale (>2h)
           ▼
┌─────────────────────┐
│  Gemini API          │  ← Real-time data via Google Search grounding
│  (gemini-sports.ts)  │
└─────────────────────┘
```

### Design Principles

1. **Stale-while-revalidate** — Return existing PG data immediately, refresh in background
2. **Best-effort enrichment** — Player rosters and standings are fetched after core data; failures don't block the dashboard
3. **Distributed locking** — Redis-based lock prevents concurrent refreshes across serverless instances
4. **Audit logging** — Every refresh is logged to `data_refresh_log` with timing, trigger, and result

---

## Data Flow: `executeRefresh(sport, trigger)`

This is the core orchestration function in `sports-data.ts`. It runs when data is stale or on cold start.

```
executeRefresh(sport, trigger)
  │
  ├── 1. acquireRefreshLock()           [Redis distributed lock]
  │       └── Skip if lock held by another process
  │
  ├── 2. Insert data_refresh_log        [Audit: status = "in_progress"]
  │
  ├── 3. fetchSportsData(sport)         [Gemini Call #1]
  │       └── Returns: AITournament[] + AIMatch[]
  │       └── Prompt: tournaments + matches for next 3 days
  │       └── Uses: Google Search grounding for real-time data
  │
  ├── 4. upsertTournaments()            [PG write — stable external IDs]
  │       └── Dedup by: normalized tournament name + sport
  │       └── Conflict: UPDATE on (external_id, sport)
  │
  ├── 5. upsertMatches()                [PG write — stable external IDs]
  │       └── Dedup by: sorted teams + date
  │       └── Links to tournament via FK lookup
  │       └── Sets matchPhase + nextRefreshAfter per match
  │
  ├── 6. fetchPlayerRosters(sport, tournamentNames)   [Gemini Call #2+]
  │       └── Batches: 3 tournaments per Gemini call
  │       └── Returns: AIPlayer[] with credits, batting/bowling avg
  │       └── Best-effort: failure logged, refresh continues
  │
  ├── 7. upsertPlayers()                [PG write — stable external IDs]
  │       └── Dedup by: normalized name + nationality
  │       └── Stats stored as JSONB: { credits, average, bowlingAverage }
  │
  ├── 7.5 linkPlayersToMatches()        [PG write — junction table]
  │       └── For each match: find players by team name (fuzzy, strips "Men"/"Women")
  │       └── Bulk insert into playerMatchScores with onConflictDoNothing
  │       └── Best-effort: failure logged, refresh continues
  │
  ├── 8. fetchTournamentStandings(sport, tournamentNames)  [Gemini Call #3+]
  │       └── Batches: 3 tournaments per Gemini call
  │       └── Returns: Map<tournamentName, AITeamStanding[]>
  │       └── Best-effort: failure logged, refresh continues
  │
  ├── 9. updateTournamentStandings()    [PG write — JSONB on tournaments]
  │       └── Updates tournaments.standings column
  │       └── Matched by: tournament name + sport
  │
  ├── 10. Update data_refresh_log       [Audit: status = "success"/"failed"]
  │
  └── 11. releaseRefreshLock()          [Always runs, even on error]
```

---

## Gemini API Calls

Each refresh triggers multiple Gemini API calls. All use `gemini-2.5-flash` with `googleSearch` grounding.

| Call | Function | Input | Output | Batch Size |
|------|----------|-------|--------|------------|
| #1 | `fetchSportsData()` | Sport config | Tournaments + Matches | 1 call (all tournaments) |
| #2+ | `fetchPlayerRosters()` | Tournament names | Player rosters with stats | 3 tournaments/call |
| #3+ | `fetchTournamentStandings()` | Tournament names | Points tables (W/L/NRR) | 3 tournaments/call |

### Prompt/Parse Pattern

All three follow the same pattern:
1. **Prompt** with `[SECTION_START]...[SECTION_END]` delimiters and pipe-separated fields
2. **Parse** with regex: extract section, match lines, split on ` | `, validate types
3. **Batch** large inputs into groups of 3 to stay within token limits

### Token Budget

- Tournaments + matches: ~1 call (up to 6 tournaments hinted)
- Players: ~2-3 calls (3 tournaments each, 15-25 players per team)
- Standings: ~2-3 calls (3 tournaments each, 8-10 teams per tournament)
- **Total per refresh:** ~5-7 Gemini API calls

---

## Database Schema

### Tournaments Table (relevant columns)

| Column | Type | Purpose |
|--------|------|---------|
| `external_id` | text | Stable ID: normalized tournament name |
| `name` | text | Display name from Gemini |
| `sport` | text | Sport key (cricket, football, etc.) |
| `standings` | jsonb | `AITeamStanding[]` — points table data |
| `last_refreshed_at` | timestamptz | When last refreshed |
| `refresh_source` | text | "gemini", "manual", "seed" |

### Matches Table (relevant columns)

| Column | Type | Purpose |
|--------|------|---------|
| `external_id` | text | Stable ID: sorted teams + date |
| `match_phase` | text | "pre_match", "live", "post_match" |
| `next_refresh_after` | timestamptz | When this match can next be refreshed |
| `tournament_id` | uuid | FK to tournaments |

### Players Table (relevant columns)

| Column | Type | Purpose |
|--------|------|---------|
| `external_id` | text | Stable ID: normalized name + nationality |
| `stats` | jsonb | `{ credits, average, bowlingAverage }` |
| `role` | text | batsman, bowler, all_rounder, wicket_keeper |

### Data Refresh Log

| Column | Type | Purpose |
|--------|------|---------|
| `entity_type` | text | "dashboard", "tournament", "match" |
| `trigger` | text | "user_request", "cold_start", "manual" |
| `status` | text | "in_progress", "success", "failed" |
| `duration_ms` | int | How long the refresh took |
| `records_upserted` | int | Number of rows written |

---

## Refresh Triggers

| Trigger | When | Behavior |
|---------|------|----------|
| `cold_start` | No PG data exists for sport | **Blocking** — client waits for Gemini response |
| `user_request` | PG data is stale (>2h old) | **Non-blocking** — return stale data, refresh in background |
| `manual` | Admin hits `sports.refresh` endpoint | **Blocking** — clears hot cache, waits for fresh data |

---

## tRPC Endpoints

| Endpoint | Auth | Description |
|----------|------|-------------|
| `sports.dashboard` | Public | Full dashboard (tournaments + matches) via smart refresh |
| `sports.tournaments` | Public | Active tournaments only |
| `sports.todayMatches` | Public | Today's matches only |
| `sports.liveMatches` | Public | Currently live matches only |
| `sports.standings` | Public | Points table for a specific tournament (reads JSONB) |
| `sports.cacheStatus` | Public | Monitoring: freshness, counts, cache hit status |
| `sports.refresh` | Admin | Force refresh: clear cache + immediate Gemini fetch |

---

## Staleness & Refresh Windows

- **Dashboard-level:** Stale after 2 hours (any tournament's `last_refreshed_at`)
- **Hot cache:** 5 minute TTL in Redis
- **Match-level:** Phase-based refresh windows (see `calculateNextRefreshAfter()` in shared package):
  - Pre-match (>24h out): refresh every 6h
  - Pre-match (<24h): refresh every 2h
  - Live: refresh every 5min
  - Post-match: refresh every 1h, then stop after 24h

---

## Error Handling

- **Gemini API down:** Return cached PG data (possibly stale). Log warning.
- **No API key:** Return empty data arrays. Log warning.
- **Player roster fetch fails:** Dashboard still returns tournaments + matches. Players are best-effort.
- **Standings fetch fails:** Dashboard still returns everything else. Standings are best-effort.
- **Redis down:** Fall through to PG directly. Hot cache is a performance optimization, not required.
- **Lock contention:** Second concurrent refresh is skipped (returns `{ refreshed: false }`).

---

## Stable External IDs

To avoid duplicate rows across refreshes, each entity type uses a deterministic external ID:

| Entity | ID Formula | Example |
|--------|-----------|---------|
| Tournament | `normalize(name)` | `ipl_2026` |
| Match | `sort(teamA, teamB) + date` | `chennai_super_kings_vs_mumbai_indians_feb122026` |
| Player | `normalize(name) + nationality` | `virat_kohli_india` |

`normalize()` = lowercase, replace non-alphanumeric with `_`, trim leading/trailing `_`.
