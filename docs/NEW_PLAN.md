# DraftCrick — Revised Development Plan (v2 — Final)

> **Last Updated:** February 10, 2026  
> **Architecture:** GCP-native serverless, Redis-cached, Gemini-powered  
> **Positioning:** The smartest season-long fantasy cricket platform — CricBattle depth + AI-powered analytics

---

## Quick Status Overview

| Phase | Status | Completion | Duration | Notes |
|-------|--------|------------|----------|-------|
| **Phase 0: Foundation** | ✅ Complete | 100% | Weeks 1-3 | Monorepo, GCP infra, database, auth |
| **Phase 1: Core Fantasy** | ✅ Complete | 100% | Weeks 4-7 | Salary cap, live scoring, wallet MVP |
| **Phase 2: Draft & Leagues** | ✅ Complete | 100% | Weeks 8-11 | Draft rooms, auction, 200+ rules |
| **Phase 2.5: UI Redesign** | 🔄 In Progress | 27% | Ongoing | tami·draft design system |
| **Phase 2.75: Data, Tournaments & Testing** | 🔄 In Progress | 35% | Weeks 12-14 | Real data + tournament mode schema + testing |
| **Phase 3: AI & Analytics Engine** | ⏳ Planned | 40% backend | Weeks 15-19 | Projected points, Guru, comparison, FDR |
| **Phase 4: Tournament Mode & League Depth** | ⏳ Planned | 0% | Weeks 20-24 | Season-long leagues, trades, playoffs, chips |
| **Phase 5: Predictions & Social** | ⏳ Planned | 0% | Weeks 25-28 | Prediction leagues, H2H, chat, notifications |
| **Phase 6: Web, Admin & Corporate** | ⏳ Planned | 0% | Weeks 29-32 | Web parity, admin dashboard, fixture ticker |
| **Phase 7: Polish, Testing & Launch** | ⏳ Planned | 0% | Weeks 33-36 | Performance, security, beta launch |
| **Phase 8: Voice & Post-Launch** | ⏳ Planned | 0% | Post-launch | Voice commands, AI newsletter, dynamic pricing |

---

## Phase 0: Foundation & Infrastructure ✅ COMPLETE

*(No changes — fully delivered)*

**Delivered:** Turborepo monorepo (pnpm, 9 packages), GCP Cloud SQL PostgreSQL, Redis/Memorystore, CI/CD pipeline, Expo SDK 52 mobile app, Next.js 15 web app, Hono + tRPC API, Drizzle ORM + migrations, Firebase Auth (partial), Tamagui design system foundation, local dev environment documented.

---

## Phase 1: Core Fantasy — Salary Cap Mode ✅ COMPLETE

*(No changes — fully delivered)*

**Delivered:** Gemini API integration for cricket data, Redis cache (24hr TTL, serverless-compatible, distributed locking), match listing + sports dashboard, player database (60+ IPL 2026 players seeded), credit-based team builder, contest creation/joining, live scoring schema, points calculation engine (`scoring.ts`), leaderboard structure, wallet MVP (transaction schema, balance tracking).

---

## Phase 2: Draft, Auction & League Management ✅ COMPLETE

*(No changes — fully delivered)*

**Delivered:** Draft room schema + state machine engine, auction room with bidding, WebSocket foundation (draft + live score), trading schema + validation, league management with 200+ rules, league templates (Casual/Competitive/Pro), JSONB rule storage.

---

## Phase 2.5: tami·draft Design System 🔄 IN PROGRESS

*(Continuing as-is — remaining screens migrate alongside future phases)*

**Status:** 27% complete (4 of 15+ screens migrated)  
**Delivered:** 8 custom components (InitialsAvatar, HappinessMeter, FilterPill, SegmentTab, ModeToggle, StatLabel, EggLoadingSpinner, HatchModal), 4 screens migrated (Dashboard, Profile, Social, Contests), design system docs.  
**Remaining:** 11 screens — migrated as each phase touches those screens.

---

## Phase 2.75: Data Integration, Tournament Schema & Testing 🔄 IN PROGRESS

**Status:** ~35% Complete
**Duration:** 3 weeks (Feb 10 – Mar 2, 2026)
**Goal:** Connect real data, lay the database foundation for tournament mode, and thoroughly test all existing features.

### Why This Phase is Critical

Before building new features, we need: real data flowing to the UI, the database schema extended to support tournament-long leagues (Phase 4 depends on this), and all Phase 0-2 features verified working.

---

### Completed So Far

| Deliverable | Status | Details |
|------------|--------|---------|
| Smart Refresh Architecture | ✅ Done | 3-tier cache: Redis hot cache (5min) → PostgreSQL → Gemini API. Distributed locking, audit logging. See `/docs/SMART_REFRESH_ARCHITECTURE.md` |
| PostgreSQL Persistence | ✅ Done | Write-through upserts for tournaments, matches, players. Stable external IDs for deduplication. |
| Player Roster Fetch | ✅ Done | Gemini fetches full squad rosters (name, role, credits, batting/bowling avg) batched 3 tournaments/call. Stored as JSONB stats on players table. |
| Tournament Standings Fetch | ✅ Done | Gemini fetches points tables (W/L/T/NR/Pts/NRR) batched 3 tournaments/call. Stored as JSONB on tournaments.standings column. |
| Home Screen — Real Data | ✅ Done | Dashboard wired to `trpc.sports.dashboard`, loading/empty/error states, pull-to-refresh |
| Tournament Card Component | ✅ Done | `TournamentCard` tami·draft component with badge, date range, match count |
| Tournament Details Screen | ✅ Done | `/tournament/[id].tsx` with 3 tabs: matches, standings, stats |
| Standings Tab | ✅ Done | Real points table from `trpc.sports.standings` — columns: #, Team, P, W, L, PTS, NRR. Group headers when applicable. |
| Stats Tab Enhancement | ✅ Done | Top 5 per role with credits + batting avg + bowling avg |
| Tournament Schema (19 tables) | ✅ Done | All tables created via Drizzle + migrations |
| `sports.standings` endpoint | ✅ Done | Public tRPC query reads JSONB standings from PG |

---

### Week 1 (Feb 10-16): Real Data + Tournament Schema

#### 1A. Home Screen — Real Data Integration ✅ COMPLETE

| Task | Description | Time | Status |
|------|-------------|------|--------|
| Connect `sports.dashboard` API | Replace static data with `trpc.sports.dashboard.useQuery()` | 2-3h | ✅ |
| Loading states | EggLoadingSpinner while fetching | 1h | ✅ |
| Empty states | Message when no matches available | 1h | ✅ |
| Error handling | User-friendly errors if API fails | 1h | ✅ |
| Cache behavior verification | Verify 24hr Redis cache hit/miss | 2h | ✅ |

#### 1B. Tournament Display & Filtering ✅ COMPLETE

| Task | Description | Time | Status |
|------|-------------|------|--------|
| Tournament card component | New tami·draft component for tournament display | 3h | ✅ |
| Tournament list on home | Show active tournaments (IPL, World Cup, BBL, etc.) | 2h | ✅ |
| Tournament filtering | Filter matches by selected tournament | 2h | ✅ |
| Tournament details screen | `/tournament/[id].tsx` — matches, standings, stats leaders | 3h | ✅ |
| Tournament stats | Top performers, standings table | 2h | ✅ |

#### 1C. Tournament Mode Database Schema (Foundation for Phase 4)

This is the critical schema work that enables season-long leagues later. Build the tables now, wire the features in Phase 4.

**New Tables (18 tables + 2 ALTER):**

```sql
-- ============================================================
-- 1. TOURNAMENT LEAGUES (season-long)
-- ============================================================
CREATE TABLE tournament_leagues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID REFERENCES leagues(id),
  tournament_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('salary_cap', 'draft', 'auction')),
  status TEXT NOT NULL DEFAULT 'setup' CHECK (status IN ('setup', 'active', 'playoffs', 'completed')),
  
  -- Trade rules
  total_trades_allowed INTEGER DEFAULT 30,
  free_trades INTEGER DEFAULT 30,
  penalty_per_extra_trade DECIMAL(10,2) DEFAULT 0,
  trade_reset_before_playoffs BOOLEAN DEFAULT false,
  playoff_trades_allowed INTEGER DEFAULT 10,
  
  -- Lock rules
  team_lock_minutes_before_match INTEGER DEFAULT 0,
  player_drop_lock_hours INTEGER DEFAULT 24,
  captain_lock_time TEXT DEFAULT 'match_start' CHECK (captain_lock_time IN ('match_start', 'innings_break', '1hr_after_start')),
  opponent_team_visibility TEXT DEFAULT 'after_match_start' CHECK (opponent_team_visibility IN ('always', 'after_match_start', 'after_30min')),
  
  -- Playoff config
  playoff_format TEXT CHECK (playoff_format IN ('none', 'ipl_style', 'semi_final', 'custom')),
  playoff_teams INTEGER DEFAULT 4,
  exclude_playoff_matches BOOLEAN DEFAULT false,
  
  -- Chips config
  chips_enabled BOOLEAN DEFAULT true,
  wildcards_per_tournament INTEGER DEFAULT 2,
  triple_captain_count INTEGER DEFAULT 1,
  bench_boost_count INTEGER DEFAULT 1,
  free_hit_count INTEGER DEFAULT 1,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. PER-MATCH TEAM SNAPSHOTS
-- ============================================================
CREATE TABLE tournament_team_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_league_id UUID REFERENCES tournament_leagues(id),
  user_id UUID REFERENCES users(id),
  match_id TEXT NOT NULL,
  
  squad JSONB NOT NULL,        -- [{playerId, role, isCaptain, isViceCaptain}]
  playing_xi JSONB NOT NULL,   -- [{playerId, role}]
  
  chip_used TEXT CHECK (chip_used IN (NULL, 'wildcard', 'triple_captain', 'bench_boost', 'free_hit', 'power_play', 'death_over_specialist')),
  
  total_points DECIMAL(10,2) DEFAULT 0,
  captain_points DECIMAL(10,2) DEFAULT 0,
  
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  is_auto_submitted BOOLEAN DEFAULT false,
  
  UNIQUE(tournament_league_id, user_id, match_id)
);

-- ============================================================
-- 3. TRADE TRACKING
-- ============================================================
CREATE TABLE tournament_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_league_id UUID REFERENCES tournament_leagues(id),
  user_id UUID REFERENCES users(id),
  
  trade_type TEXT NOT NULL CHECK (trade_type IN ('drop_add', 'inter_team', 'waiver_claim')),
  
  player_out_id TEXT,
  player_in_id TEXT,
  
  proposed_to_user_id UUID REFERENCES users(id),
  players_offered JSONB,
  players_requested JSONB,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'vetoed', 'expired')),
  vetoed_by UUID REFERENCES users(id),
  veto_reason TEXT,
  
  is_free_trade BOOLEAN DEFAULT true,
  penalty_points DECIMAL(10,2) DEFAULT 0,
  
  executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. PLAYER LOCKS
-- ============================================================
CREATE TABLE player_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_league_id UUID REFERENCES tournament_leagues(id),
  player_id TEXT NOT NULL,
  locked_by_user_id UUID REFERENCES users(id),
  locked_at TIMESTAMPTZ DEFAULT NOW(),
  unlocks_at TIMESTAMPTZ NOT NULL,
  reason TEXT CHECK (reason IN ('dropped', 'new_entrant', 'waiver')),
  
  UNIQUE(tournament_league_id, player_id)
);

-- ============================================================
-- 5. PLAYER STATUSES
-- ============================================================
CREATE TABLE player_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id TEXT NOT NULL,
  tournament_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('available', 'injured', 'out_of_tournament', 'unavailable_next_match', 'doubtful')),
  status_note TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT DEFAULT 'system',
  
  UNIQUE(player_id, tournament_id)
);

-- ============================================================
-- 6. CHIPS USAGE
-- ============================================================
CREATE TABLE chip_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_league_id UUID REFERENCES tournament_leagues(id),
  user_id UUID REFERENCES users(id),
  chip_type TEXT NOT NULL CHECK (chip_type IN ('wildcard', 'triple_captain', 'bench_boost', 'free_hit', 'power_play', 'death_over_specialist')),
  match_id TEXT NOT NULL,
  activated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tournament_league_id, user_id, chip_type, match_id)
);

-- ============================================================
-- 7. ADVANCE TEAM QUEUE
-- ============================================================
CREATE TABLE advance_team_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_league_id UUID REFERENCES tournament_leagues(id),
  user_id UUID REFERENCES users(id),
  match_id TEXT NOT NULL,
  squad JSONB NOT NULL,
  playing_xi JSONB NOT NULL,
  captain_id TEXT NOT NULL,
  vice_captain_id TEXT NOT NULL,
  queued_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tournament_league_id, user_id, match_id)
);

-- ============================================================
-- 8. PLAYOFF BRACKETS
-- ============================================================
CREATE TABLE playoff_brackets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_league_id UUID REFERENCES tournament_leagues(id),
  round TEXT NOT NULL,
  match_id TEXT,
  team_a_user_id UUID REFERENCES users(id),
  team_b_user_id UUID REFERENCES users(id),
  winner_user_id UUID REFERENCES users(id),
  team_a_points DECIMAL(10,2),
  team_b_points DECIMAL(10,2),
  status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'live', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 9. COMMISSIONER ACTIONS LOG
-- ============================================================
CREATE TABLE commissioner_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID REFERENCES leagues(id),
  commissioner_id UUID REFERENCES users(id),
  action_type TEXT NOT NULL CHECK (action_type IN (
    'assign_points', 'grant_trades', 'edit_team', 'veto_trade',
    'change_rule', 'kick_member', 'ban_member', 'send_announcement',
    'set_entry_fee', 'set_prizes'
  )),
  target_user_id UUID REFERENCES users(id),
  details JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 10. PREDICTION QUESTIONS
-- ============================================================
CREATE TABLE prediction_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id TEXT NOT NULL,
  tournament_id TEXT NOT NULL,
  
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL CHECK (question_type IN (
    'match_winner', 'victory_margin', 'top_scorer', 'top_wicket_taker',
    'century_scored', 'first_innings_total', 'player_performance',
    'sixes_count', 'custom_yes_no', 'custom_range', 'custom_multi_choice'
  )),
  
  options JSONB NOT NULL,
  correct_answer TEXT,
  difficulty TEXT DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  points_value INTEGER DEFAULT 10,
  bonus_for_exact BOOLEAN DEFAULT false,
  
  deadline_type TEXT DEFAULT 'match_start' CHECK (deadline_type IN ('match_start', 'innings_break', 'custom')),
  custom_deadline TIMESTAMPTZ,
  
  generated_by TEXT DEFAULT 'admin' CHECK (generated_by IN ('admin', 'ai', 'system')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 11. PREDICTION ANSWERS
-- ============================================================
CREATE TABLE prediction_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID REFERENCES prediction_questions(id),
  user_id UUID REFERENCES users(id),
  league_id UUID REFERENCES leagues(id),
  
  answer TEXT NOT NULL,
  is_correct BOOLEAN,
  points_awarded INTEGER DEFAULT 0,
  
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(question_id, user_id, league_id)
);

-- ============================================================
-- 12. PREDICTION STANDINGS
-- ============================================================
CREATE TABLE prediction_standings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID REFERENCES leagues(id),
  user_id UUID REFERENCES users(id),
  tournament_id TEXT NOT NULL,
  
  total_points INTEGER DEFAULT 0,
  correct_predictions INTEGER DEFAULT 0,
  total_predictions INTEGER DEFAULT 0,
  accuracy_pct DECIMAL(5,2) DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  best_streak INTEGER DEFAULT 0,
  
  UNIQUE(league_id, user_id, tournament_id)
);

-- ============================================================
-- 13. H2H MATCHUPS
-- ============================================================
CREATE TABLE h2h_matchups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID REFERENCES leagues(id),
  match_id TEXT NOT NULL,
  round_number INTEGER NOT NULL,
  
  home_user_id UUID REFERENCES users(id),
  away_user_id UUID REFERENCES users(id),
  home_points DECIMAL(10,2),
  away_points DECIMAL(10,2),
  winner_user_id UUID REFERENCES users(id),
  is_draw BOOLEAN DEFAULT false,
  
  home_league_points INTEGER DEFAULT 0,
  away_league_points INTEGER DEFAULT 0,
  
  status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'live', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 14. LEAGUE AWARDS
-- ============================================================
CREATE TABLE league_awards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID REFERENCES leagues(id),
  match_id TEXT,
  round_number INTEGER,
  
  award_type TEXT NOT NULL CHECK (award_type IN (
    'manager_of_match', 'highest_scorer', 'worst_transfer',
    'best_captain', 'biggest_differential', 'most_improved',
    'orange_cap', 'purple_cap'
  )),
  user_id UUID REFERENCES users(id),
  details JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 15. CUSTOM TOURNAMENTS
-- ============================================================
CREATE TABLE custom_tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT,
  
  source_tournament_ids TEXT[],
  selected_match_ids TEXT[] NOT NULL,
  h2h_rounds JSONB,
  
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 16. FIXTURE DIFFICULTY RATINGS (AI-generated, cached)
-- ============================================================
CREATE TABLE fixture_difficulty (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id TEXT NOT NULL,
  team_id TEXT NOT NULL,
  
  overall_fdr INTEGER NOT NULL CHECK (overall_fdr BETWEEN 1 AND 5),
  batting_fdr INTEGER NOT NULL CHECK (batting_fdr BETWEEN 1 AND 5),
  bowling_fdr INTEGER NOT NULL CHECK (bowling_fdr BETWEEN 1 AND 5),
  
  factors JSONB NOT NULL,
  
  generated_by TEXT DEFAULT 'ai',
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(match_id, team_id)
);

-- ============================================================
-- 17. AI PROJECTED POINTS
-- ============================================================
CREATE TABLE player_projections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id TEXT NOT NULL,
  match_id TEXT NOT NULL,
  
  projected_points DECIMAL(10,2) NOT NULL,
  confidence_low DECIMAL(10,2),
  confidence_high DECIMAL(10,2),
  
  breakdown JSONB NOT NULL,
  factors JSONB NOT NULL,
  
  captain_rank INTEGER,
  differential_score DECIMAL(5,2),
  
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, match_id)
);

-- ============================================================
-- 18. PLAYER OWNERSHIP STATS
-- ============================================================
CREATE TABLE player_ownership (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id TEXT NOT NULL,
  match_id TEXT NOT NULL,
  
  overall_ownership_pct DECIMAL(5,2) DEFAULT 0,
  captain_pct DECIMAL(5,2) DEFAULT 0,
  vice_captain_pct DECIMAL(5,2) DEFAULT 0,
  effective_ownership DECIMAL(5,2) DEFAULT 0,
  transfer_in_count INTEGER DEFAULT 0,
  transfer_out_count INTEGER DEFAULT 0,
  net_transfers INTEGER DEFAULT 0,
  
  current_price DECIMAL(10,2),
  price_change DECIMAL(10,2) DEFAULT 0,
  
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, match_id)
);

-- ============================================================
-- 19. GURU CONVERSATIONS (Phase 3, created here for completeness)
-- ============================================================
CREATE TABLE guru_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  messages JSONB NOT NULL DEFAULT '[]',
  context_snapshot JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ALTER EXISTING TABLES
-- ============================================================
ALTER TABLE matches ADD COLUMN IF NOT EXISTS draft_enabled BOOLEAN DEFAULT false;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS tournament_id TEXT;
```

**Drizzle Schema Files to Create:**
- `packages/db/src/schema/tournament-leagues.ts`
- `packages/db/src/schema/tournament-teams.ts`
- `packages/db/src/schema/trades.ts` (extend existing)
- `packages/db/src/schema/player-locks.ts`
- `packages/db/src/schema/player-statuses.ts`
- `packages/db/src/schema/chips.ts`
- `packages/db/src/schema/predictions.ts`
- `packages/db/src/schema/h2h.ts`
- `packages/db/src/schema/awards.ts`
- `packages/db/src/schema/custom-tournaments.ts`
- `packages/db/src/schema/analytics.ts` (FDR, projections, ownership)
- `packages/db/src/schema/commissioner.ts`
- `packages/db/src/schema/guru.ts`

| Task | Time |
|------|------|
| Write all Drizzle schema files (19 tables) | 6-8h |
| Generate and run migrations | 2h |
| Seed World Cup 2026 as draft-enabled | 1h |
| Seed initial player statuses | 1h |
| Create tRPC router stubs for new entities | 3h |

#### 1D. Geo-Location & Regional Compliance Foundation

> **Reference:** [DraftCrick-Geo-Location-Implementation.md](./DraftCrick-Geo-Location-Implementation.md)

Build the geo-detection infrastructure now so every future feature can query a user's regulatory zone. India's PROGA 2025 bans all real-money gaming nationwide (Supreme Court ruling pending). We build a dual-mode architecture: `PROGA_ACTIVE` flag toggles the entire app between free-to-play and real-money.

**Detection Layers:** IP geolocation (server-side, automatic) + Device GPS (client-side, Expo Location) + User self-declaration (onboarding).

| Task | Description | Time |
|------|-------------|------|
| MaxMind GeoLite2 integration | Download DB, write `resolveGeoIP()` service, weekly update cron | 4h |
| Hono geo middleware | Extract IP from `x-forwarded-for`, resolve country/state, attach to context | 2h |
| Expo Location service | `getDeviceLocation()` with permission flow, reverse geocode, fallback to coarse | 4h |
| User declaration onboarding step | Country/state selector (auto-filled from IP/GPS), legal confirmation checkbox | 3h |
| `location_checks` table + user columns | `ALTER users` for declared_country/state, `CREATE TABLE location_checks` for audit trail | 2h |
| Geo resolution engine | `resolveUserZone()` — combines 3 layers → returns `RegulatoryZone` | 3h |
| Feature gate service | `getFeatureAccess(zone)` — returns what each zone can/cannot do | 2h |
| `geo.resolveLocation` tRPC endpoint | Called on session start, logs check, returns features | 2h |
| Client-side feature gating | Hide wallet/prizes/paid contests when zone = `india_free_only` or `international_blocked` | 3h |
| Gemini region-routing client | `createGeminiClient(userCountry)` routes to nearest Vertex AI region (Mumbai/Iowa/Belgium) | 2h |

**Geo-Location Drizzle Schema Files:**
- `packages/db/src/schema/location-checks.ts`
- `packages/api/src/services/geo-resolver.ts`
- `packages/api/src/services/feature-gates.ts`
- `packages/api/src/middleware/geo-middleware.ts`
- `apps/mobile/src/services/location.ts`

---

### Week 2 (Feb 17-23): Comprehensive Testing

#### Testing Matrix (All Phases 0-2)

**A. Authentication Testing**

| Test Case | Status |
|-----------|--------|
| Sign up with email (validation, errors) | ⬜ |
| Sign in with Google OAuth | ⬜ |
| Sign in with Apple | ⬜ |
| Phone OTP sign in | ⬜ |
| Password reset | ⬜ |
| Token refresh / session persistence | ⬜ |
| Logout + cleanup | ⬜ |

**B. Team Builder Testing**

| Test Case | Status |
|-----------|--------|
| Browse players (search, filter, sort) | ⬜ |
| Player stats accuracy | ⬜ |
| Add player within budget | ⬜ |
| Prevent over-budget selection | ⬜ |
| Role constraints (min/max batsmen, bowlers, AR, WK) | ⬜ |
| Captain selection (2× multiplier) | ⬜ |
| Vice-captain selection (1.5× multiplier) | ⬜ |
| Save team + edit saved team | ⬜ |

**C. Contest System Testing**

| Test Case | Status |
|-----------|--------|
| Browse/filter/sort contests | ⬜ |
| Join free contest | ⬜ |
| Join paid contest (wallet deduction) | ⬜ |
| Insufficient balance prevention | ⬜ |
| Contest details (prize breakdown, rules) | ⬜ |
| Contest leaderboard (real-time) | ⬜ |
| Contest settlement + prize distribution | ⬜ |

**D. Draft Room Testing**

| Test Case | Status |
|-----------|--------|
| Create draft room | ⬜ |
| Join draft room (invite/code) | ⬜ |
| Start draft | ⬜ |
| Make pick (snake draft turn-based) | ⬜ |
| Pick timer expiry → auto-pick | ⬜ |
| WebSocket sync across clients | ⬜ |
| Complete draft → team finalization | ⬜ |

**E. Auction Room Testing**

| Test Case | Status |
|-----------|--------|
| Create auction room | ⬜ |
| Place bid | ⬜ |
| Counter-bid + bid increments | ⬜ |
| Bid timer ("Going once...") | ⬜ |
| Budget exhaustion tracking | ⬜ |
| Auction completion + finalization | ⬜ |

**F. Wallet Testing**

| Test Case | Status |
|-----------|--------|
| View balance | ⬜ |
| Add money (Razorpay) | ⬜ |
| Transaction history / ledger accuracy | ⬜ |
| Withdraw money | ⬜ |
| Bonus credits tracking | ⬜ |

**G. Live Scoring Testing**

| Test Case | Status |
|-----------|--------|
| WebSocket connection establishment | ⬜ |
| Live score refresh | ⬜ |
| Fantasy points calculation accuracy | ⬜ |
| Live leaderboard rank changes | ⬜ |
| Match completion + final score lock | ⬜ |

**H. Caching & Performance**

| Test Case | Status |
|-----------|--------|
| Redis cache hit (cached data served) | ⬜ |
| Redis cache miss (Gemini API called) | ⬜ |
| Cache expiration (24hr TTL) | ⬜ |
| Concurrent requests (distributed locking) | ⬜ |
| API response times (<100ms cached, <3s uncached) | ⬜ |

**Total: 51 test cases across 8 areas**

**I. Geo-Location & Feature Gates Testing**

| Test Case | Status |
|-----------|--------|
| IP geolocation resolves India correctly | ⬜ |
| IP geolocation resolves US/UK correctly | ⬜ |
| GPS location resolves Indian state correctly | ⬜ |
| GPS permission denied → falls back to coarse/IP | ⬜ |
| User declaration saved + auto-filled from IP/GPS | ⬜ |
| Zone resolution: India + PROGA active → `india_free_only` | ⬜ |
| Zone resolution: banned state (AP/TG) → `india_free_only` | ⬜ |
| Zone resolution: international permitted → full features | ⬜ |
| Zone resolution: blocked country (UAE/PK) → no paid features | ⬜ |
| Feature gates: wallet/prizes hidden in free-only zone | ⬜ |
| IP vs GPS mismatch flagged (VPN detection) | ⬜ |
| Location check logged to `location_checks` table | ⬜ |
| Gemini client routes to `asia-south1` for Indian users | ⬜ |
| Gemini client routes to `us-central1` for US users | ⬜ |

**Updated Total: 65 test cases across 9 areas**

---

### Week 3 (Feb 24 – Mar 2): Bug Fixes + Polish

| Task | Time |
|------|------|
| Fix all P0 bugs discovered | As needed |
| Fix all P1 bugs discovered | As needed |
| Document P2 bugs with fix plan | 2h |
| Create tournament details screen UI | 4h |
| Add draft eligibility checks to UI | 2h |
| Admin endpoint: `admin.tournaments.toggleDraft` | 2h |
| Final verification: all features work with real data | 4h |
| Migrate Match Center screen to tami·draft | 6h |
| Migrate Team Builder screen to tami·draft | 6h |

### Phase 2.75 Success Criteria

- [x] Home screen shows real data from Gemini API
- [x] Tournaments displayed with filtering
- [x] Smart refresh architecture: Redis → PG → Gemini pipeline (see `/docs/SMART_REFRESH_ARCHITECTURE.md`)
- [x] Player rosters fetched via Gemini with batting/bowling averages
- [x] Tournament standings (points tables) fetched via Gemini and displayed
- [x] All 19 new database tables created and migrated (+ `location_checks` table)
- [ ] World Cup 2026 whitelisted for draft
- [ ] All authentication flows tested and working
- [ ] All team builder features tested and working
- [ ] All contest features tested and working
- [ ] All draft/auction features tested and working
- [ ] Wallet features tested and working
- [ ] Redis cache tested (hit, miss, expiration, locking)
- [ ] Zero P0 bugs remaining
- [ ] Match Center and Team Builder screens migrated to tami·draft
- [ ] **Geo-detection: IP + GPS + declaration all resolving correctly**
- [ ] **Feature gates: paid features hidden for `india_free_only` and `international_blocked` zones**
- [ ] **Gemini API routing to nearest region based on user country**
- [ ] **Location audit trail logging to `location_checks` table**

---

## Phase 3: AI & Analytics Engine ⏳

**Status:** Planned (40% backend complete)  
**Duration:** 5 weeks (Weeks 15-19)  
**Goal:** Build the AI-powered analytics layer that differentiates DraftCrick from every competitor.

### Already Complete (from Phase 1)
- ✅ Gemini API integration (`services/gemini-sports.ts`)
- ✅ Cricket data fetching (tournaments, matches, players)
- ✅ Redis caching layer (`services/sports-cache.ts`, serverless-compatible)
- ✅ MCP architecture standardized

---

### Week 15-16: Projected Points Engine + FDR (THE KILLER FEATURE)

#### 3.1 Fixture Difficulty Rating (FDR) System

**What:** Every match gets a 1-5 difficulty rating per team, calculated by AI.

**Factors for AI calculation:**
- ICC team ranking / recent form
- Head-to-head record between teams
- Venue history (batting avg, bowling avg at ground)
- Pitch type (batting-friendly / bowling-friendly / balanced)
- Day/night match factor
- Weather forecast
- Tournament stage importance

**Implementation:**

```typescript
// packages/api/src/services/fdr-engine.ts

interface FDRInput {
  matchId: string;
  teamId: string;
  oppositionId: string;
  venue: string;
  format: 'T20' | 'ODI' | 'Test';
}

interface FDROutput {
  overallFdr: 1 | 2 | 3 | 4 | 5; // 1=easiest, 5=hardest
  battingFdr: 1 | 2 | 3 | 4 | 5;
  bowlingFdr: 1 | 2 | 3 | 4 | 5;
  factors: {
    oppositionRank: number;
    venueHistory: { battingAvg: number; bowlingAvg: number };
    pitchType: string;
    dayNight: boolean;
    weather: string;
    h2hRecord: { wins: number; losses: number };
  };
}
```

**MCP Data Flow:**
```
Gemini API ← MCP Context: {
  team_rankings,
  venue_stats (last 20 matches at ground),
  h2h_history,
  pitch_report,
  weather_forecast
} → Generate FDR → Cache in fixture_difficulty table (24hr TTL)
```

**tRPC Endpoints:**
- `analytics.getFDR({ matchId })` — FDR for both teams in a match
- `analytics.getFixtureTicker({ tournamentId })` — full tournament FDR calendar
- `analytics.getTeamFixtures({ teamId, tournamentId })` — FDR timeline for one team

**UI: Fixture Ticker Component**
```
Tournament Fixture Ticker:
┌──────┬──────┬──────┬──────┬──────┬──────┐
│ M1   │ M2   │ M3   │ M4   │ M5   │ M6   │
│ 🟢1  │ 🟡3  │ 🔴5  │ 🟢2  │ 🟡3  │ 🟢1  │
│vs AFG│vs AUS│vs IND│vs BAN│vs ENG│vs ZIM│
└──────┴──────┴──────┴──────┴──────┴──────┘
Green=easy  Yellow=medium  Red=hard
```

| Task | Time |
|------|------|
| FDR engine service with Gemini integration | 6h |
| FDR tRPC router (getFDR, getFixtureTicker, getTeamFixtures) | 4h |
| Fixture Ticker UI component | 6h |
| FDR badge component (color-coded 1-5) | 2h |
| Cache FDR in `fixture_difficulty` table | 2h |
| Batch FDR generation for entire tournament | 3h |

---

#### 3.2 AI Projected Points Engine

**What:** For every player in every upcoming match, AI generates predicted fantasy points with confidence interval.

**Projection Factors:**
- Recent form (last 5/10 innings)
- Career stats at this venue
- Performance vs this specific opposition
- Current batting position / bowling role
- Pitch and weather conditions
- Match importance (group stage vs knockout)
- Day/night factor
- Team batting order likelihood

**Implementation:**

```typescript
// packages/api/src/services/projection-engine.ts

interface ProjectionInput {
  playerId: string;
  matchId: string;
  playerRole: 'BAT' | 'BOWL' | 'AR' | 'WK';
}

interface ProjectionOutput {
  projectedPoints: number;
  confidenceLow: number;
  confidenceHigh: number;
  breakdown: {
    battingPts: number;
    bowlingPts: number;
    fieldingPts: number;
    bonusPts: number;
  };
  factors: {
    form: number;        // 0-100 form score
    venue: number;       // venue favorability 0-100
    opposition: number;  // opposition difficulty 0-100
    pitch: number;       // pitch suitability 0-100
    position: number;    // batting position impact
    importance: number;  // match significance
  };
  captainRank: number;          // 1 = best captain option
  differentialScore: number;    // high projected + low ownership
}
```

**MCP Data Flow:**
```
Gemini API ← MCP Context: {
  player_career_stats,
  player_recent_form (last 10 innings),
  player_vs_opposition_history,
  player_at_venue_history,
  pitch_report,
  weather,
  team_lineup_probability,
  match_context (stage, importance)
} → Generate projections for all players → Cache in player_projections table
```

**tRPC Endpoints:**
- `analytics.getProjections({ matchId })` — all player projections for a match
- `analytics.getPlayerProjection({ playerId, matchId })` — single player detail
- `analytics.getCaptainRankings({ matchId })` — ranked captain picks
- `analytics.getDifferentials({ matchId, maxOwnershipPct })` — low-owned high-upside players
- `analytics.batchGenerateProjections({ tournamentId })` — generate for all upcoming matches

**UI Integration:**
- "Projected Pts" column in player browser (sortable)
- Captain picker screen with ranked list
- Differential picks section on match detail
- Confidence bar (low–projected–high) on player card

| Task | Time |
|------|------|
| Projection engine service with Gemini prompt engineering | 8h |
| Prompt iteration + accuracy testing against historical data | 6h |
| Projection tRPC router (all endpoints) | 5h |
| Player browser: add projected points column | 3h |
| Captain rankings UI screen | 4h |
| Differentials section on match detail | 3h |
| Confidence interval visualization component | 2h |
| Batch generation job (cron-like, runs 6h before each match) | 3h |

---

### Week 17: Cricket Guru AI Chat + Rate My Team

#### 3.3 Cricket Guru Chat Interface

**What:** Full conversational AI assistant powered by Gemini with MCP context about the user's teams, leagues, and cricket data.

**Guru Capabilities:**
1. Answer any cricket/fantasy question
2. Rate My Team (see 3.4)
3. Transfer suggestions
4. Captain recommendations
5. Player comparisons
6. Rule explanations
7. Match previews
8. Chip/power-up advice
9. Fixture analysis
10. Injury impact analysis

**Implementation:**

```typescript
// packages/api/src/services/guru-chat.ts

interface GuruMessage {
  role: 'user' | 'guru';
  content: string;
  attachments?: {
    type: 'team' | 'player' | 'match' | 'league';
    data: any;
  }[];
  timestamp: Date;
}

interface GuruContext {
  userId: string;
  activeTeams: TeamData[];
  activeLeagues: LeagueData[];
  upcomingMatches: MatchData[];
  playerProjections: ProjectionData[];
  fixtureDifficulty: FDRData[];
  tradeHistory: TradeData[];
  chipsRemaining: ChipData[];
}
```

**MCP Context Injection:**
Every Guru conversation includes the user's full context so the AI can give personalized advice:
- User's current teams across all leagues
- Remaining trades and budget
- Upcoming fixtures with FDR
- Player projections
- League standings
- Chip availability

**Chat UI:**
- Floating action button (🥚 egg icon) on all screens
- Full-screen chat with message history
- Quick action chips at bottom: "Rate My Team", "Captain Pick", "Transfer Help", "Compare Players"
- Typing indicator
- Structured responses (team cards, player comparison tables, charts embedded in chat)
- Voice input button (placeholder for Phase 8)

| Task | Time |
|------|------|
| Guru chat service with Gemini + MCP context builder | 8h |
| Guru tRPC router (sendMessage, getHistory, clearHistory) | 4h |
| Chat UI: message list, input, quick actions | 8h |
| Floating action button (all screens) | 2h |
| Structured response renderers (team cards, tables, charts) | 6h |
| Guru conversation database + persistence | 2h |
| Prompt engineering for all 10 capability areas | 6h |

---

#### 3.4 Rate My Team

**What:** User submits their team → AI analyzes and rates it → returns grade + suggestions.

**Rating Output:**

```typescript
interface TeamRating {
  overallGrade: 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F';
  overallScore: number; // 0-100
  
  categoryScores: {
    batting: { score: number; grade: string; comment: string };
    bowling: { score: number; grade: string; comment: string };
    allRounders: { score: number; grade: string; comment: string };
    captainChoice: { score: number; grade: string; comment: string };
    fixtureAlignment: { score: number; grade: string; comment: string };
    budgetEfficiency: { score: number; grade: string; comment: string };
    differentialPotential: { score: number; grade: string; comment: string };
  };
  
  weakSpots: string[]; // "Your bowling is weak for upcoming fixtures"
  
  suggestedTransfers: {
    playerOut: PlayerData;
    playerIn: PlayerData;
    projectedPointGain: number;
    reason: string;
  }[];
  
  comparisonToTop: {
    topPlayersYouDontHave: PlayerData[]; // "73% of top teams have Bumrah"
    uniquePicksYouHave: PlayerData[]; // good differentials
  };
}
```

**tRPC Endpoint:** `guru.rateMyTeam({ teamId, matchId? })` — if matchId provided, rates for that specific match; otherwise rates for next match.

**UI:** Accessible via Guru chat ("Rate my team") and as standalone screen with visual grade card, radar chart of category scores, and swipeable transfer suggestions.

| Task | Time |
|------|------|
| Rate My Team service (analysis logic + Gemini prompt) | 6h |
| Rating result UI (grade card, radar chart, suggestions) | 6h |
| Integration with Guru chat | 2h |
| Standalone "Rate My Team" screen | 3h |
| Top team comparison data pipeline | 3h |

---

### Week 18: Player Comparison Tool + Ownership Stats

#### 3.5 Player Comparison Tool

**What:** Compare 2-3 players side-by-side across all stats, with visual radar charts and AI-generated insight summary.

**Comparison Data Points:**
- Fantasy points: last match, last 5, last 10, season, career
- Batting: average, strike rate, boundary %, dot ball %, position
- Bowling: economy, average, dot ball %, wickets per match
- Fielding: catches, stumpings, run-outs
- Form curve (last 10 innings trend line)
- Venue-specific stats
- Opposition-specific stats
- Price/value (points per credit spent)
- Projected points for upcoming match
- Ownership %

**Visual Elements:**
- Radar chart (6 axes: batting, bowling, fielding, form, fixture, value)
- Form trend line graph
- Head-to-head stat bars (green = better player for that stat)
- AI insight paragraph: "Kohli has better form but Williamson has an easier fixture. For this match, Williamson is the better pick because..."

**Implementation:**

```typescript
// packages/api/src/services/player-comparison.ts

interface ComparisonInput {
  playerIds: string[]; // 2-3 players
  matchId?: string; // optional: compare for specific match context
  timeframe?: 'last_5' | 'last_10' | 'season' | 'career';
}

interface ComparisonOutput {
  players: PlayerComparisonData[];
  radarData: RadarChartData;
  formTrends: FormTrendData[];
  verdict: string; // AI-generated comparison summary
  recommendation: {
    bestOverall: string; // playerId
    bestForThisMatch: string; // playerId (if matchId provided)
    bestValue: string; // playerId
    reason: string;
  };
}
```

**tRPC Endpoint:** `analytics.comparePlayers({ playerIds, matchId?, timeframe? })`

**UI:**
- Accessible from player browser (long-press → "Compare")
- Accessible from Guru chat ("Compare Kohli and Williamson")
- Standalone comparison screen with player search
- Sharable comparison cards

| Task | Time |
|------|------|
| Player comparison service + data aggregation | 5h |
| Comparison tRPC router | 3h |
| Radar chart component (recharts or d3) | 4h |
| Form trend line chart | 3h |
| Comparison screen UI (side-by-side layout) | 6h |
| AI verdict generation (Gemini prompt) | 2h |
| Long-press compare from player browser | 2h |
| Integration with Guru chat | 2h |

---

#### 3.6 Ownership Stats & Template Team

**What:** Track what % of users own each player, who's the most popular captain, and identify differential picks.

**Implementation:**

```typescript
// packages/api/src/services/ownership-tracker.ts

// Runs periodically (every hour before match deadline, every 15 min in last 2 hours)
async function calculateOwnership(matchId: string) {
  // Count ownership across all leagues for this match
  // Calculate captain %, vice-captain %
  // Calculate effective ownership (ownership × captaincy multiplier)
  // Identify differentials (high projected, low owned)
  // Calculate net transfers (in - out since last calculation)
  // Store in player_ownership table
}
```

**tRPC Endpoints:**
- `analytics.getOwnership({ matchId })` — all players ownership for a match
- `analytics.getTemplateTeam({ matchId })` — most commonly selected XI
- `analytics.getDifferentials({ matchId })` — high projected, low owned
- `analytics.getTransferTrends({ playerId })` — transfer in/out over time

**UI:**
- Ownership % badge on player cards
- "Most Owned" tab in player browser
- "Template Team" view (shows most popular XI)
- Differential picks section with ownership bars

| Task | Time |
|------|------|
| Ownership calculation service | 4h |
| Scheduled ownership recalculation job | 2h |
| Ownership tRPC router | 3h |
| Template team generation | 2h |
| Ownership badges on player cards | 2h |
| Template Team view screen | 3h |
| Differential picks section | 3h |

---

### Week 19: AI Content Generation + Transfer Planner

#### 3.7 AI-Generated Match Previews

**What:** Gemini generates rich match preview articles for every upcoming match, personalized if the user has a team.

**Content Includes:**
- Match context and importance
- Team form and recent results
- Key player battles
- Pitch and weather analysis
- Fantasy tips (who to captain, who to avoid)
- Predicted playing XIs
- Historical head-to-head data
- Personalized section: "For YOUR team, consider..."

**Implementation:**

```typescript
// packages/api/src/services/match-preview.ts

interface MatchPreview {
  matchId: string;
  title: string; // "IND vs PAK: Semi-Final Showdown"
  sections: {
    matchContext: string;
    teamForm: { teamA: string; teamB: string };
    keyBattles: { title: string; description: string }[];
    pitchWeather: string;
    fantasyTips: {
      mustHave: PlayerData[];
      differential: PlayerData[];
      avoid: PlayerData[];
      captainPick: PlayerData;
    };
    predictedXIs: { teamA: PlayerData[]; teamB: PlayerData[] };
    h2hHistory: string;
  };
  generatedAt: Date;
  personalizedTips?: string; // only if user has a team
}
```

**tRPC Endpoints:**
- `content.getMatchPreview({ matchId, userId? })` — preview with optional personalization
- `content.listPreviews({ tournamentId })` — all available previews

**Generation Schedule:** Auto-generate 12 hours before each match, cache heavily.

| Task | Time |
|------|------|
| Match preview generation service + Gemini prompts | 6h |
| Preview tRPC router | 2h |
| Match preview UI screen (article layout) | 5h |
| Personalization layer (user's team context) | 3h |
| Auto-generation scheduler | 2h |
| Preview cards on home screen | 2h |

---

#### 3.8 Transfer Planner

**What:** Visual tool for planning transfers across multiple upcoming matches in a tournament league.

**Features:**
- See your current team projected across next 5-10 matches
- Drag-and-drop transfers on future match slots
- Budget tracking as you plan
- Trade count tracking (remaining trades shown)
- "What if" scenarios (save multiple draft plans)
- AI suggestion: "Optimal transfer path with 8 trades remaining"

**Implementation:**

```typescript
// packages/api/src/services/transfer-planner.ts

interface TransferPlan {
  id: string;
  name: string; // "Plan A - Aggressive", "Plan B - Safe"
  tournamentLeagueId: string;
  userId: string;
  
  currentTeam: PlayerData[];
  plannedTransfers: {
    matchId: string;
    matchNumber: number;
    transfersIn: PlayerData[];
    transfersOut: PlayerData[];
    projectedTeamPoints: number;
    tradesUsed: number;
    budgetAfter: number;
  }[];
  
  totalProjectedPoints: number;
  totalTradesUsed: number;
  remainingTrades: number;
}
```

**tRPC Endpoints:**
- `planner.createPlan({ tournamentLeagueId, name })` — create new plan
- `planner.addTransfer({ planId, matchId, playerIn, playerOut })` — add transfer to plan
- `planner.getAISuggestion({ tournamentLeagueId, tradesRemaining })` — AI-optimized plan
- `planner.listPlans({ tournamentLeagueId })` — all saved plans
- `planner.deletePlan({ planId })` — delete plan

**UI:**
- Horizontal scrollable match timeline
- Team grid below showing lineup per match
- Transfer indicators (green = in, red = out)
- Running totals bar (projected points, trades used, budget)
- "Ask Guru" button for AI-suggested plan
- Ability to activate a plan (execute transfers)

| Task | Time |
|------|------|
| Transfer planner service | 5h |
| AI-optimized plan generation (Gemini) | 4h |
| Planner tRPC router | 3h |
| Transfer planner UI (timeline + team grid) | 8h |
| Plan comparison view | 3h |
| Integration with Guru chat | 2h |

---

### Phase 3 Success Criteria

- [ ] FDR calculated for all matches in active tournaments
- [ ] Projected points generated for every player in every upcoming match
- [ ] Cricket Guru can answer 50+ common question types
- [ ] Rate My Team returns actionable analysis with grade
- [ ] Player comparison works for 2-3 players with radar chart
- [ ] Ownership stats updating hourly before match deadlines
- [ ] Match previews auto-generated 12h before each match
- [ ] Transfer planner functional with AI suggestions
- [ ] All analytics screens migrated to tami·draft design system

---

## Phase 4: Tournament Mode & Advanced League Management ⏳

**Status:** Planned  
**Duration:** 5 weeks (Weeks 20-24)  
**Goal:** Build the season-long tournament experience that makes DraftCrick a CricBattle competitor, not a Dream11 clone.

**Dependencies:** Phase 2.75 schema must be complete. Phase 3 projections/FDR feed into team management decisions.

---

### Week 20-21: Tournament Mode Core

#### 4.1 Tournament League Creation & Joining

**What:** Users can create season-long leagues tied to a full tournament, choosing format (salary cap, draft, or auction) and configuring 200+ rules.

**League Creation Flow:**
```
Choose Tournament (e.g., IPL 2026)
  → Choose Format: Salary Cap / Draft / Auction
    → Choose Template: Casual / Competitive / Pro / Custom
      → Customize Rules (expandable sections):
        ├── Team Rules (squad size, role limits, budget)
        ├── Scoring Rules (runs, wickets, catches, etc.)
        ├── Trade Rules (total trades, lock period, free trades)
        ├── Lock Rules (team lock time, captain lock, visibility)
        ├── Playoff Rules (format, teams qualifying, trade reset)
        ├── Chips (which chips enabled, how many of each)
        └── Advanced (H2H scheduling, custom scoring bonuses)
      → Set Entry Fee & Prizes (optional)
        → Create League → Get Invite Code
```

**tRPC Endpoints:**
- `tournamentLeague.create({ tournamentId, format, template, rules })` — create league
- `tournamentLeague.join({ leagueId, code })` — join with invite code
- `tournamentLeague.getDetails({ leagueId })` — full league info
- `tournamentLeague.updateRules({ leagueId, rules })` — commissioner updates rules
- `tournamentLeague.getStandings({ leagueId })` — cumulative standings
- `tournamentLeague.getMatchHistory({ leagueId, userId })` — all match results for a user

| Task | Time |
|------|------|
| Tournament league creation service | 6h |
| Rule template system (Casual/Competitive/Pro/Custom) | 4h |
| League creation flow UI (multi-step form) | 8h |
| Join league flow (code entry + browse) | 3h |
| League detail screen with standings | 5h |
| Match history per user within league | 3h |

---

#### 4.2 Per-Match Team Submission System

**What:** In tournament mode, users submit their team for each match. Team carries over but can be modified within trade limits.

**Team Submission Flow:**
```
Upcoming Match Card → "Set Team"
  → Current Squad (carried from last match)
    → Make changes (counts as trades)
    → Select Captain / Vice-Captain
    → Activate Chip (optional)
    → Submit Before Deadline
```

**Key Logic:**
- Auto-carry: if user doesn't modify, last match team auto-submits at deadline
- Trade tracking: every player swap increments trade counter
- Lock enforcement: team cannot be modified after `lock_minutes_before_match`
- Captain lock: separate deadline based on `captain_lock_time` rule
- Advance queue: if user set future team via advance queue, use that

**tRPC Endpoints:**
- `tournamentTeam.getCurrentSquad({ tournamentLeagueId, matchId })` — current team for match
- `tournamentTeam.submitTeam({ tournamentLeagueId, matchId, squad, playingXI, captain, viceCaptain, chip? })` — submit
- `tournamentTeam.getTradesRemaining({ tournamentLeagueId })` — how many trades left
- `tournamentTeam.autoSubmitPending()` — cron job: auto-submit unchanged teams at deadline

| Task | Time |
|------|------|
| Team submission service with trade counting | 6h |
| Team carry-over logic (from previous match) | 3h |
| Lock enforcement (team lock, captain lock) | 3h |
| Auto-submit system (cron job at each match deadline) | 3h |
| Team submission UI (modify + captain + chip) | 6h |
| Trade counter display with remaining count | 2h |

---

#### 4.3 Advance Team Queue

**What:** Set your team for the next 3-5 matches in advance.

**Flow:**
```
My Team → "Set Future Teams"
  → Match 2: [Copy current / Modify] → Save
  → Match 3: [Copy current / Modify] → Save  
  → Match 4: [Copy current / Modify] → Save
  → "Ask Guru to suggest" → AI fills all slots
```

**Logic:**
- Each advance submission is a "draft" that auto-submits at the match deadline
- User can override any time before deadline
- AI can pre-fill based on fixture analysis and projections

| Task | Time |
|------|------|
| Advance queue service | 3h |
| Queue tRPC router | 2h |
| "Set Future Teams" UI with match cards | 5h |
| AI auto-fill via Guru integration | 3h |
| Auto-submit from queue at match deadline | 2h |

---

### Week 22: Advanced Trade & Waiver System

#### 4.4 Player Locking System

**What:** When a player is dropped from a team, they are locked for a configurable period (default 24h). Prevents cycling players to block opponents.

**Rules:**
- Player dropped → locked for `player_drop_lock_hours` (default 24h)
- Exception: if player was on team for less than `player_drop_lock_hours`, no lock (anti-abuse)
- New entrants to tournament squad → locked for 24h (equal chance claim window)
- Lock duration configurable per league (0, 12, 24, 48 hours)
- Locked players shown with 🔒 icon and unlock countdown

**tRPC Endpoints:**
- `trades.dropPlayer({ tournamentLeagueId, playerId })` — drop with lock
- `trades.getLockedPlayers({ tournamentLeagueId })` — all currently locked players
- `trades.isPlayerLocked({ tournamentLeagueId, playerId })` — check lock status

| Task | Time |
|------|------|
| Player locking service with configurable duration | 4h |
| Lock enforcement in trade flow | 2h |
| Lock expiration cron job | 2h |
| Locked player UI indicator (🔒 + countdown) | 2h |

---

#### 4.5 Inter-Team Trading

**What:** League members can propose player-for-player trades with each other.

**Flow:**
```
Trade Board → "Propose Trade"
  → Select player(s) you're offering
  → Select league member to trade with
  → Select player(s) you want from them
  → Submit proposal → Opponent gets notification
  → Opponent: Accept / Reject / Counter
  → Commissioner: can Veto any accepted trade (within 24h)
  → If accepted + not vetoed: trade executes
```

**Rules:**
- Both sides must end up with valid teams (role constraints met)
- Trade deadline configurable (e.g., no trades in last 2 weeks of tournament)
- Trade proposals expire after 48h if no response
- Commissioner veto window: 24h after acceptance
- All trades logged in `commissioner_actions` for transparency

**tRPC Endpoints:**
- `trades.proposeInterTeam({ tournamentLeagueId, toUserId, playersOffered, playersRequested })` — propose
- `trades.respondToProposal({ tradeId, action: 'accept' | 'reject' | 'counter' })` — respond
- `trades.vetoTrade({ tradeId, reason })` — commissioner veto
- `trades.getTradeBoard({ tournamentLeagueId })` — all active/recent trades
- `trades.getUserTradeHistory({ tournamentLeagueId, userId })` — user's trade history

| Task | Time |
|------|------|
| Inter-team trade service (propose, accept, reject, counter, veto) | 6h |
| Trade validation (role constraints, budget, deadline) | 3h |
| Trade tRPC router | 4h |
| Trade proposal UI (select players, select opponent) | 6h |
| Trade board UI (all pending/recent trades) | 4h |
| Trade notification system | 2h |
| Commissioner veto UI | 2h |

---

#### 4.6 FAAB Waiver System

**What:** Free Agent Acquisition Budget — blind bidding for unclaimed/dropped players.

**How It Works:**
- Each team gets a FAAB budget (e.g., ₹100 virtual) at tournament start
- When a player becomes available (dropped from a team, or new to squad), they go on waivers
- All managers submit blind bids (₹0 to remaining budget)
- Highest bid wins the player at the end of waiver period (24-48h)
- Ties broken by: reverse league standing (worst team wins)
- Budget doesn't replenish — must be managed across entire tournament

**tRPC Endpoints:**
- `waivers.getAvailablePlayers({ tournamentLeagueId })` — players on waivers
- `waivers.placeBid({ tournamentLeagueId, playerId, amount, dropPlayerId })` — submit bid
- `waivers.processWaivers()` — cron: resolve bids, award players
- `waivers.getFAABRemaining({ tournamentLeagueId, userId })` — remaining budget

| Task | Time |
|------|------|
| FAAB waiver service (bid, resolve, award) | 5h |
| Waiver resolution cron job | 3h |
| Waiver tRPC router | 3h |
| Waiver bidding UI | 5h |
| FAAB budget tracker UI | 2h |

---

#### 4.7 Player Status System

**What:** Visual indicators for player availability.

| Status | Icon | Color | Meaning |
|--------|------|-------|---------|
| Available | ✅ | Green | Fit and likely to play |
| Injured | 🤕 | Blue | Injured but may return |
| Out of Tournament | ❌ | Red | Won't play again this tournament |
| Doubtful | ⚠️ | Yellow | Fitness concern, may not play next match |
| Unavailable | 🚫 | Orange | Rested/dropped for next match |

**Data Source:** AI monitors news feeds via MCP, admin can manually update, system auto-updates when squad announcements are made.

**tRPC Endpoints:**
- `playerStatus.getAll({ tournamentId })` — all player statuses
- `playerStatus.update({ playerId, tournamentId, status, note })` — admin/AI update
- `playerStatus.getAlerts({ userId })` — "Players in your team with status changes"

| Task | Time |
|------|------|
| Player status service + AI monitoring | 4h |
| Status update tRPC router | 2h |
| Status badge component for player cards | 2h |
| Status alert system (your player's status changed) | 3h |

---

### Week 23: Playoffs, Chips & Commissioner Tools

#### 4.8 Playoff/Knockout System

**What:** Configurable playoff formats within fantasy leagues.

**Supported Formats:**

**IPL-Style (4 teams):**
```
1st vs 2nd → Qualifier 1 → Winner → FINAL
3rd vs 4th → Eliminator → Winner ↗
                           ↘ Qualifier 2 (Loser of Q1 vs Winner of Elim) → Winner ↗
```

**World Cup Semi-Final (4 teams):**
```
1st vs 4th → Semi 1 → Winner → FINAL
2nd vs 3rd → Semi 2 → Winner ↗
```

**Custom (N teams):** Commissioner defines bracket manually, assigns matches to each round.

**Implementation:**
- League transitions from "active" to "playoffs" status
- Bracket auto-generated from standings at phase transition
- Each bracket round maps to a real cricket match
- Fantasy points from that match determine H2H winner
- Optional: trade reset at playoff start

**tRPC Endpoints:**
- `playoffs.generateBracket({ tournamentLeagueId, format })` — create bracket from standings
- `playoffs.getBracket({ tournamentLeagueId })` — get current bracket
- `playoffs.assignMatch({ bracketRoundId, matchId })` — tie bracket round to real match
- `playoffs.resolveRound({ bracketRoundId })` — resolve after match completion

| Task | Time |
|------|------|
| Playoff bracket generation service | 5h |
| Bracket resolution logic | 3h |
| Playoff tRPC router | 3h |
| Bracket visualization UI (tournament tree) | 6h |
| League phase transition (active → playoffs) | 2h |
| Trade reset at playoff start | 1h |

---

#### 4.9 Chips / Power-Ups System

**What:** Strategic power-ups users can activate once per tournament (or as configured).

| Chip | Effect | Default Count |
|------|--------|--------------|
| **Wildcard** | Unlimited transfers for this match (no trade cost) | 2 per tournament |
| **Triple Captain** | Captain gets 3× points instead of 2× | 1 |
| **Bench Boost** | All 15 squad players score (not just playing XI) | 1 |
| **Free Hit** | Make any team for this match only; reverts to previous team next match | 1 |
| **Power Play** | All batsmen in your team get 1.5× batting points | 1 |
| **Death Over Specialist** | Bowlers get 2× points for wickets in overs 16-20 (T20) / 40-50 (ODI) | 1 |

**Rules:**
- Only one chip per match
- Cannot be activated after team lock deadline
- Chip activation is visible to league (after match start, per visibility rules)
- Commissioner can configure which chips are enabled and how many

**tRPC Endpoints:**
- `chips.getAvailable({ tournamentLeagueId })` — available chips for user
- `chips.activate({ tournamentLeagueId, matchId, chipType })` — activate
- `chips.deactivate({ tournamentLeagueId, matchId })` — cancel before deadline
- `chips.getUsageHistory({ tournamentLeagueId })` — all chip usage in league

**AI/Guru Integration:**
- "When should I use my Triple Captain?" → AI analyzes remaining fixtures, FDR, and projections
- "Is this a good Wildcard week?" → AI assesses how many optimal transfers exist

| Task | Time |
|------|------|
| Chip activation service with validation | 4h |
| Chip scoring modifiers (integrated into scoring engine) | 4h |
| Free Hit revert logic | 3h |
| Chip tRPC router | 3h |
| Chip activation UI (chip drawer on team submission screen) | 4h |
| Chip advisor in Guru | 3h |

---

#### 4.10 Commissioner / League Manager Tools

**What:** Comprehensive tools for league managers to administer their leagues.

**Commissioner Dashboard:**
```
Commissioner Panel
├── Member Management
│   ├── View all members
│   ├── Kick member (with reason)
│   ├── Ban member
│   └── Invite new members
├── Team Management
│   ├── Edit team on behalf of inactive member
│   ├── Grant extra trades to specific member
│   └── Assign bonus/penalty points
├── Trade Management
│   ├── Pending inter-team trades (approve/veto)
│   ├── Veto history
│   └── Trade deadline settings
├── Rule Management
│   ├── Modify any rule mid-season
│   ├── Rule change requires notification to all members
│   └── Rule change history
├── Announcements
│   ├── Send announcement to all members
│   └── Pin announcement
├── Finances
│   ├── Set/modify entry fee
│   ├── Configure prize distribution
│   └── View payment status
└── League Settings
    ├── League name, description, image
    ├── League visibility (public/private)
    └── Season schedule
```

**tRPC Endpoints:**
- `commissioner.kickMember({ leagueId, userId, reason })` — remove member
- `commissioner.editTeamForMember({ leagueId, userId, squad })` — edit inactive member's team
- `commissioner.grantTrades({ leagueId, userId, count })` — give extra trades
- `commissioner.assignPoints({ leagueId, userId, points, reason })` — bonus/penalty
- `commissioner.vetoTrade({ tradeId, reason })` — veto inter-team trade
- `commissioner.changeRule({ leagueId, rule, newValue })` — modify rule
- `commissioner.sendAnnouncement({ leagueId, message, pinned })` — announce
- `commissioner.getActionLog({ leagueId })` — all commissioner actions

**AI Commissioner Assistant:**
- "3 members haven't set teams for tomorrow — send reminder?"
- "This trade looks lopsided — Player A (projected 60pts) for Player B (projected 25pts). Veto recommended."
- Auto-set teams for inactive members using AI optimal picks

| Task | Time |
|------|------|
| Commissioner service (all actions) | 6h |
| Commissioner action logging | 2h |
| Commissioner tRPC router | 4h |
| Commissioner dashboard UI | 8h |
| AI commissioner assistant integration | 4h |
| Member management screens | 4h |
| Announcement system | 2h |

---

#### 4.11 2nd Innings Captain Change

**What:** Allow captain swap during innings break.

**Implementation:**
- `captain_lock_time` rule: `match_start` | `innings_break` | `1hr_after_start`
- If `innings_break`: captain can be changed until 2nd innings starts
- WebSocket event triggers "Captain Change Window Open" notification
- Quick-swap UI: one-tap captain change during break

| Task | Time |
|------|------|
| Captain lock logic per rule setting | 2h |
| Captain swap WebSocket event | 2h |
| Quick captain swap UI (bottom sheet) | 3h |
| Captain change notification | 1h |

---

#### 4.12 Opponent Team Visibility

**What:** Configurable when other teams become visible.

**Options:**
- `always` — teams visible anytime
- `after_match_start` — teams revealed when match begins (default)
- `after_30min` — teams revealed 30 min after match start

**Implementation:** Filter API responses based on rule + match status.

| Task | Time |
|------|------|
| Visibility filter in team retrieval API | 2h |
| UI enforcement (blur/hide opponent teams) | 2h |
| Rule configuration in league settings | 1h |

---

#### 4.13 Custom Tournament Builder

**What:** Users create custom tournaments by cherry-picking matches.

**Flow:**
```
"Create Custom Tournament"
  → Name & Description
  → Select Source Tournament(s) (e.g., "World Cup 2026")
  → Browse Matches → Select/deselect matches
    → Filter: by team, format (T20/ODI/Test), date range
    → "AI: Pick only India matches" (Guru integration)
  → Assign H2H Rounds (optional, for H2H leagues)
    → Drag matches into Round 1, Round 2, etc.
  → Create → Get Tournament ID → Create Leagues within it
```

**tRPC Endpoints:**
- `customTournament.create({ name, description, sourceTournamentIds, selectedMatchIds, h2hRounds? })` — create
- `customTournament.update({ id, selectedMatchIds, h2hRounds? })` — modify before activation
- `customTournament.activate({ id })` — lock in matches, allow league creation
- `customTournament.list({ userId })` — user's custom tournaments

| Task | Time |
|------|------|
| Custom tournament service | 4h |
| Custom tournament tRPC router | 3h |
| Match selection UI (filterable calendar) | 6h |
| H2H round assignment UI (drag-and-drop) | 4h |
| Guru integration ("pick only T20 matches") | 2h |

---

### Week 24: H2H Mode + Weekly Awards + Integration Testing

#### 4.14 Head-to-Head League Mode

**What:** Instead of (or alongside) cumulative points, league members are paired each match for H2H battles.

**H2H Scheduling:**
- System auto-generates H2H schedule at tournament start
- Each match, every user faces one opponent
- Winner of H2H (more fantasy points that match) gets 3 league points, draw = 1 each, loss = 0
- Separate H2H standings table alongside cumulative points
- Can be used for playoff seeding

**tRPC Endpoints:**
- `h2h.generateSchedule({ leagueId })` — create matchup schedule
- `h2h.getMatchup({ leagueId, matchId, userId })` — who user faces this match
- `h2h.getStandings({ leagueId })` — H2H league table (W/D/L/Pts)
- `h2h.getHistory({ leagueId, userAId, userBId })` — rivalry head-to-head record

| Task | Time |
|------|------|
| H2H scheduling algorithm (round-robin) | 4h |
| H2H result resolution after each match | 3h |
| H2H tRPC router | 3h |
| H2H standings table UI | 3h |
| H2H matchup card (who you face this match) | 2h |
| Rivalry tracker (head-to-head record) | 2h |

---

#### 4.15 Weekly/Match Awards

**What:** Auto-generated awards after each match to boost engagement.

| Award | Criteria |
|-------|----------|
| Manager of the Match | Highest fantasy points in league |
| Best Captain Pick | Highest captain points |
| Worst Transfer | Transfer that lost the most projected points |
| Biggest Differential | Highest points from a player owned by <10% |
| Most Improved | Biggest rank jump from last match |
| Orange Cap | Running tournament top scorer |
| Purple Cap | Running tournament top wicket-taker |

**Implementation:**
- Auto-calculated after each match completes
- Awards stored in `league_awards` table
- Push notification: "🏆 You won Manager of the Match!"
- Awards trophy room on league detail screen

| Task | Time |
|------|------|
| Award calculation service | 4h |
| Award tRPC router | 2h |
| Award notification system | 2h |
| Awards display on league detail screen | 3h |
| Trophy room / awards history UI | 3h |

---

#### Phase 4 Integration Testing (End of Week 24)

| Test Area | Cases |
|-----------|-------|
| Tournament league create/join/manage | 10 |
| Team submission + trade counting + locking | 15 |
| Advance team queue + auto-submit | 5 |
| Inter-team trading (propose/accept/reject/veto) | 10 |
| FAAB waiver bidding + resolution | 8 |
| Player status updates + alerts | 5 |
| Playoff bracket generation + resolution | 8 |
| All 6 chips activation + scoring impact | 12 |
| Commissioner all actions | 10 |
| Captain lock times (match start, innings break, 1hr) | 5 |
| Opponent visibility rules | 3 |
| Custom tournament creation + activation | 5 |
| H2H scheduling + resolution + standings | 8 |
| Weekly awards calculation + notification | 5 |
| **Geo: paid action verification** | **6** |
| **Total** | **115 test cases** |

**Geo-Verification for Paid Actions (New in Phase 4):**

| Test Case | Status |
|-----------|--------|
| `verifyForPaidAction` requires GPS coordinates | ⬜ |
| Paid contest join blocked in `india_free_only` zone | ⬜ |
| Wallet deposit blocked in `india_free_only` zone | ⬜ |
| Low confidence (GPS denied) blocks paid action with helpful error | ⬜ |
| IP/GPS mismatch flags but allows if GPS is in permitted zone | ⬜ |
| Periodic re-check during active session (every 30 min) | ⬜ |

| Task | Description | Time |
|------|-------------|------|
| `geo.verifyForPaidAction` tRPC endpoint | GPS-required verification before any paid action | 3h |
| Integrate geo-check into contest join flow | Call `verifyForPaidAction` before wallet deduction | 2h |
| Integrate geo-check into wallet deposit flow | Block deposits in restricted zones | 1h |
| Periodic session re-check (30 min interval) | Background timer re-verifies zone during active play | 2h |
| India KYC + TDS integration (if zone = `india_real_money`) | 30% TDS on winnings > ₹100, 28% GST on entry | 4h |

### Phase 4 Success Criteria

- [ ] Tournament-long leagues work end-to-end (create → play entire tournament → winner)
- [ ] Trade system handles all scenarios (drop/add, inter-team, FAAB, locking)
- [ ] All 6 chips work correctly with scoring modifiers
- [ ] Playoff brackets generate and resolve properly for all formats
- [ ] Commissioner can perform all management actions
- [ ] H2H mode generates schedule and resolves correctly
- [ ] Awards auto-calculated after each match
- [ ] Custom tournament builder functional
- [ ] Advance team queue + auto-submit working
- [ ] All 115 test cases pass
- [ ] **Paid actions geo-verified with GPS before wallet transactions**
- [ ] **KYC + TDS/GST enforced for `india_real_money` zone**

---

## Phase 5: Predictions & Social ⏳

**Status:** Planned  
**Duration:** 4 weeks (Weeks 25-28)  
**Goal:** Build the prediction league system and social/engagement features.

---

### Week 25-26: Prediction League System

#### 5.1 Prediction Question Engine

**Question Types:**

| Type | Example | Scoring |
|------|---------|---------|
| `match_winner` | "Who will win? IND / PAK / Draw" | 10 pts |
| `victory_margin` | "Victory margin: 1-20 runs / 21-50 / 50+ / by wickets" | 15 pts (exact: 25) |
| `top_scorer` | "Who will be top scorer? Kohli / Rohit / Babar / Other" | 20 pts |
| `top_wicket_taker` | "Top wicket-taker? Bumrah / Shaheen / Starc / Other" | 20 pts |
| `century_scored` | "Will a century be scored? Yes / No" | 10 pts |
| `first_innings_total` | "First innings total: <150 / 150-200 / 200-250 / 250+" | 15 pts |
| `player_performance` | "Will Kohli score 50+? Yes / No" | 15 pts |
| `sixes_count` | "Total sixes in match: <10 / 10-15 / 15-20 / 20+" | 15 pts |
| `custom_yes_no` | Admin-created yes/no question | Configurable |
| `custom_range` | Admin-created range question | Configurable |
| `custom_multi_choice` | Admin-created multi-choice | Configurable |

**AI Question Generation:**
- Before each match, Gemini generates 5-8 contextual prediction questions
- Uses: pitch data, player form, historical matchups, weather
- Admin can review/edit AI questions before publishing
- Some questions available at innings break (2nd innings predictions)

**tRPC Endpoints:**
- `predictions.getQuestions({ matchId, leagueId })` — questions for a match
- `predictions.submitAnswer({ questionId, answer })` — submit prediction
- `predictions.resolveMatch({ matchId })` — resolve all questions after match
- `predictions.getStandings({ leagueId, tournamentId })` — prediction leaderboard
- `predictions.generateQuestions({ matchId })` — AI-generate questions
- `predictions.createCustomQuestion({ matchId, question, options, points })` — admin create

| Task | Time |
|------|------|
| Prediction question service | 5h |
| AI question generation (Gemini prompts) | 4h |
| Question resolution service (auto-resolve from match data) | 4h |
| Prediction tRPC router | 4h |
| Prediction question UI (card-based, swipeable) | 6h |
| Prediction leaderboard UI | 3h |
| Admin question management UI | 4h |
| 2nd innings prediction (questions available at innings break) | 3h |
| Prediction streaks tracking | 2h |

#### 5.2 Prediction League Standings

**Features:** Cumulative points across tournament, accuracy %, current streak and best streak, leaderboard with rank changes, filter by question type, H2H prediction battles.

| Task | Time |
|------|------|
| Standings calculation service | 3h |
| Standings tRPC router | 2h |
| Standings UI with rank change indicators | 4h |
| Streak tracking and badges | 2h |

---

### Week 27: League Chat & Notifications

#### 5.3 League Chat (Firestore Real-Time)

**What:** In-league group chat for banter, trash talk, and discussion.

**Features:** Real-time messaging (Firestore), @mentions, system messages (trade alerts, award notifications, score updates), commissioner announcements (pinned), AI moderation (flag toxic content), emoji reactions, share player/team/match cards in chat.

**Implementation:**

```typescript
// Firestore collection: leagues/{leagueId}/messages
interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  content: string;
  type: 'user' | 'system' | 'announcement' | 'trade_alert' | 'award';
  mentions: string[]; // userIds
  reactions: { [emoji: string]: string[] }; // emoji → userIds
  attachments?: {
    type: 'player' | 'team' | 'match' | 'trade';
    data: any;
  };
  isPinned: boolean;
  createdAt: Timestamp;
}
```

| Task | Time |
|------|------|
| Firestore chat setup + security rules | 3h |
| Chat service (send, react, pin, moderate) | 4h |
| System message triggers (trades, awards, scores) | 3h |
| Chat UI (message list, input, reactions, mentions) | 8h |
| AI moderation integration | 2h |
| Shareable cards in chat (player/team/match) | 3h |

#### 5.4 Push Notifications (FCM)

**Notification Types:**

| Category | Notifications |
|----------|--------------|
| **Deadlines** | "Team lock in 1h for IND vs PAK", "Set your team before 7:30 PM" |
| **Scores** | "Your team scored 142 pts! Rank #3 in league", "Match completed — you moved up 5 spots!" |
| **Trades** | "Trade proposal from Amit: his Bumrah for your Starc", "Your trade was accepted" |
| **Status** | "⚠️ Kohli marked doubtful for next match — consider trading", "🔓 Rohit Sharma unlocked — available to pick" |
| **Awards** | "🏆 You won Manager of the Match!", "You're on a 5-match prediction streak!" |
| **Social** | "Amit mentioned you in league chat", "New announcement from commissioner" |
| **AI** | "Guru tip: This is the best week to use Triple Captain", "Price alert: Bumrah about to rise" |
| **Waivers** | "Waiver period ending in 2h — your bid on Archer is highest", "You won Jasprit Bumrah on waivers!" |

**Notification Preferences:** Per-category toggle, quiet hours, match-day frequency control.

| Task | Time |
|------|------|
| FCM setup + configuration | 3h |
| Notification service (send, batch, schedule) | 5h |
| All notification triggers (integrate with every system) | 6h |
| Notification preferences screen | 3h |
| Notification history / inbox screen | 3h |

#### 5.5 Email Notifications (Resend)

| Email Type | Frequency |
|------------|-----------|
| Weekly digest (AI-written, personalized) | Weekly |
| Match day reminder | Match day |
| Trade proposal | On event |
| League invitation | On event |
| Tournament starting | 1 day before |
| Season wrap-up report | End of tournament |

**AI Personalization:** Gemini writes each weekly digest customized to user's teams, performance, and upcoming matches.

| Task | Time |
|------|------|
| Resend integration | 2h |
| Email templates (HTML) | 4h |
| AI-written weekly digest (Gemini personalization) | 4h |
| Email trigger system | 3h |
| Email preference management | 2h |

---

### Week 28: Engagement Features

#### 5.6 1v1 Challenges

**What:** Challenge any user to a quick match contest. Flow: Challenge → opponent accepts → both set teams → match plays → winner declared.

| Task | Time |
|------|------|
| Challenge service (create, accept, resolve) | 4h |
| Challenge tRPC router | 2h |
| Challenge UI (challenge card, opponent search) | 4h |
| Challenge notifications | 1h |

#### 5.7 Referral System

**What:** Invite friends → both get bonus credits.

| Task | Time |
|------|------|
| Referral code generation + tracking | 3h |
| Referral reward service | 2h |
| Referral UI (share link, track invites) | 3h |
| Deep linking for referral codes | 2h |

#### 5.8 Activity Feed

**What:** Social feed showing league activity — trades made, awards won, teams submitted, predictions, rank changes, milestones.

| Task | Time |
|------|------|
| Activity feed service | 3h |
| Feed tRPC router | 2h |
| Feed UI (timeline layout) | 4h |

### Phase 5 Success Criteria

- [ ] Prediction league functional with 11 question types
- [ ] AI generates 5-8 contextual questions per match
- [ ] Prediction questions auto-resolve after match
- [ ] 2nd innings prediction questions work at innings break
- [ ] League chat with real-time messaging
- [ ] Push notifications delivered for all categories with 80%+ delivery
- [ ] Weekly AI-personalized email digest working
- [ ] 1v1 challenges functional
- [ ] Referral system tracking invites and granting rewards

---

## Phase 6: Web, Admin & Corporate ⏳

**Status:** Planned  
**Duration:** 4 weeks (Weeks 29-32)  
**Goal:** Web parity, admin dashboard, and analytics suite.

### Week 29-30: Web App (Full Parity)

All mobile features on web + web-optimized tools: Fixture Ticker (full-width), Transfer Planner (drag-and-drop desktop), Player Comparison (larger charts), Draft/Auction Rooms (larger player pool), Commissioner Dashboard (easier on desktop), Analytics Suite (full-screen charts). Shared via Tamagui cross-platform components.

| Task | Time |
|------|------|
| Web layout shell (sidebar, header, responsive) | 8h |
| Port all screens to web (shared components) | 20h |
| Web-optimized fixture ticker (full-width) | 6h |
| Web-optimized transfer planner (drag-and-drop) | 6h |
| Web-optimized comparison tool | 4h |
| Web-optimized draft/auction rooms | 6h |

#### Marketing Landing Pages

Homepage, How It Works, Pricing, About, Corporate. Full SEO (meta tags, structured data, sitemap).

| Task | Time |
|------|------|
| All landing pages (5 pages) | 14h |
| SEO optimization | 4h |

### Week 31-32: Admin Dashboard (Separate Next.js App)

```
Admin Dashboard
├── Tournament Management (create, edit, toggle draft, schedules, bulk import, status mgmt)
├── User Management (search, ban/suspend, wallet adjustments, support tickets)
├── League Management (view all, resolve disputes, override results)
├── Content Management (review AI previews, manage prediction questions, announcements)
├── Analytics (DAU/MAU/retention, revenue, engagement, AI metrics, system health) — PostHog
├── Financial (transaction ledger, prize queue, withdrawal approvals, revenue reports)
└── System (feature flags, cache management, rate limits, error logs)
```

| Task | Time |
|------|------|
| Admin app setup + auth | 4h |
| Tournament management screens | 8h |
| User management screens | 6h |
| League management screens | 4h |
| Content management (preview/question review) | 4h |
| Analytics dashboard (PostHog) | 6h |
| Financial screens | 6h |
| System management | 4h |

#### Ownership Stats Dashboard (Web)

Full-screen: ownership heatmap, transfer trends chart, template team view, price tracker, effective ownership.

| Task | Time |
|------|------|
| Ownership dashboard (all visualizations) | 16h |

### Phase 6 Success Criteria

- [ ] Web app full parity with mobile
- [ ] Web-optimized tools superior on desktop
- [ ] Marketing pages live with SEO
- [ ] Admin dashboard covers all management needs
- [ ] PostHog analytics tracking
- [ ] Ownership dashboard functional

---

## Phase 7: Polish, Testing & Launch ⏳

**Status:** Planned  
**Duration:** 4 weeks (Weeks 33-36)

### Week 33: Performance & Security

| Activity | Details | Time |
|----------|---------|------|
| Performance optimization | API response times, bundle size, images, lazy loading | 5 days |
| Database optimization | Indexes, Drizzle query tuning, connection pooling | 2 days |
| Redis cache tuning | TTLs per data type, memory limits | 1 day |
| Security audit | Auth, authorization, SQL injection, XSS | 3 days |
| Rate limiting | API limits, draft/auction abuse prevention | 1 day |
| WebSocket hardening | Connection limits, validation, reconnection | 1 day |
| **VPN detection heuristics** | **Flag IP/GPS country mismatch, known VPN IP ranges, datacenter IPs** | **4h** |
| **Geo-compliance stress testing** | **Test all zone transitions, edge cases (border states, roaming users)** | **4h** |

### Week 34: Testing & QA

| Activity | Details | Time |
|----------|---------|------|
| End-to-end testing | Full user journeys across all features | 3 days |
| Cross-platform QA | iOS, Android, Chrome, Safari, Firefox | 3 days |
| Load testing | 1000+ concurrent draft/auction rooms | 2 days |
| Accessibility audit | Screen reader, color contrast, font sizing | 2 days |
| AI accuracy testing | Backtest projections vs actual results | 2 days |
| Scoring engine verification | Cross-check fantasy points vs manual calculation | 1 day |

### Week 35: Legal, Compliance & Submission

| Activity | Details | Time |
|----------|---------|------|
| Legal review | ToS, Privacy Policy, Fantasy Sports compliance | 3 days |
| India compliance | State-by-state regulations, PROGA status check, AP/TG/AS/OD blocking verified | 2 days |
| **PROGA ruling response** | **If ruling has occurred: update `PROGA_ACTIVE` flag, adjust state ban list, test all feature gates** | **1 day** |
| **Geo-compliance admin dashboard** | **Location check logs, mismatch alerts, zone distribution, PROGA toggle, state ban list editor** | **1 day** |
| **India state-level fine-tuning** | **Verify state detection accuracy, handle contested states (TN, KA), GPS boundary edge cases** | **1 day** |
| Payment compliance | Razorpay KYC, TDS on winnings, GST | 2 days |
| App Store submission | iOS + Google Play | 2 days |
| Store preparation | Screenshots, descriptions, content rating | 1 day |

### Week 36: Beta Launch

| Activity | Details | Time |
|----------|---------|------|
| Beta user recruitment | Target 500 users across 50 leagues | Ongoing |
| Monitoring | Sentry error tracking, uptime monitoring, alerting | 2 days |
| Feedback collection | In-app feedback, Discord/Telegram beta channel | 1 day |
| Bug triage | P0: 24h, P1: 72h, P2: next sprint | Ongoing |
| Feature flag management | Gradual rollout | 1 day |
| Performance baseline | DAU, retention, engagement metrics | 2 days |

### Phase 7 Success Criteria

- [ ] API p95 < 200ms cached, < 3s uncached
- [ ] Zero critical security vulnerabilities
- [ ] 95%+ uptime during beta
- [ ] AI projection accuracy within 20% of actual points (average)
- [ ] App Store approved (iOS + Android)
- [ ] 500+ beta users across 50+ leagues
- [ ] Legal cleared for India + USA
- [ ] **Geo-compliance: VPN detection flags suspicious users**
- [ ] **Geo-compliance: PROGA flag set correctly per Supreme Court ruling**
- [ ] **Geo-compliance: admin dashboard shows zone distribution + mismatch alerts**
- [ ] **Geo-compliance: all paid actions verified by GPS in production**

---

## Phase 8: Voice, AI Content & Post-Launch ⏳

**Status:** Planned (post-launch enhancements)  
**Trigger:** After successful beta launch and user feedback

### 8.1 Voice Features (Build only if beta users request)

| Feature | Implementation |
|---------|----------------|
| Voice commands for Guru | GCP Speech-to-Text v2, `en-IN` (Indian English) |
| Voice responses from Guru | GCP Text-to-Speech, `en-IN-Wavenet-A` voice |
| Voice draft picks | "Pick Virat Kohli as captain" |
| Voice team building | "Hey Guru, build me a team for India vs Pakistan" |
| Voice rule explanation | "What does waiver wire mean?" → voice explanation |

Success: 90%+ Indian English accuracy, noisy environments, <5% battery for 30 min.

### 8.2 AI-Personalized Newsletter / Digest

Weekly email + in-app digest, fully written by Gemini per user: teams' performance summary, upcoming fixtures analysis, recommended transfers, chip advice, prediction picks, league standings, award highlights.

| Task | Time |
|------|------|
| Newsletter generation service (Gemini per user) | 6h |
| Newsletter template (HTML email + in-app card) | 4h |
| Batch generation scheduler (weekly) | 2h |

### 8.3 Dynamic Player Pricing (Feature Flag)

Prices rise/fall based on transfer volume. Max ±0.2 credits/day. Team value tracking. "Buy before price rise" alerts via Guru. Behind feature flag, enable per league.

| Task | Time |
|------|------|
| Price change calculation engine | 5h |
| Price change scheduler (daily) | 2h |
| Price change alerts | 2h |
| Team value tracking | 2h |
| Price history chart | 3h |

### 8.4 Sentiment-Based Differential Picks

AI monitors Twitter/Reddit cricket buzz via MCP. "Buzz Score" — high social buzz + low ownership = potential trap; low buzz + high projected = hidden gem.

| Task | Time |
|------|------|
| Social sentiment MCP integration | 6h |
| Buzz score calculation | 3h |
| Differential picks with sentiment overlay | 3h |

### 8.5 Cup Mode Within Leagues

Parallel knockout cup alongside H2H league. Random draw at tournament start. Each round maps to a real match. Losers eliminated. Continues until one winner.

| Task | Time |
|------|------|
| Cup draw generation service | 3h |
| Cup bracket integration with match schedule | 2h |
| Cup results resolution | 2h |
| Cup bracket UI | 4h |

### 8.6 Streak Rewards

| Streak Type | Reward |
|-------------|--------|
| Daily login (7 days) | Bonus credits |
| Prediction accuracy (5 correct in a row) | Badge + bonus |
| Team submission (10 matches without missing) | Badge |
| League champion (3 tournaments) | Hall of Fame |

| Task | Time |
|------|------|
| Streak tracking service | 3h |
| Reward distribution | 2h |
| Streak UI (progress bar, badges) | 3h |

### 8.7 Geo-Infrastructure Scaling (Trigger: US Users > 10%)

Add when international user base grows enough to justify the cost and complexity.

| Task | Description | Time |
|------|-------------|------|
| Cross-region PostgreSQL read replica (US) | Cloud SQL replica in `us-central1`, Drizzle read/write splitting | 4h |
| Edge caching layer (Cloudflare Workers KV) | Cache API responses at edge for sub-50ms global reads | 6h |
| Cloud Run multi-region deployment | Deploy API to `us-central1` alongside `asia-south1` with Cloud Load Balancing | 4h |
| Gemini API region auto-detection | Detect user region from Cloud Run instance location instead of IP | 2h |

---

## Architecture Summary

### Technology Stack

| Layer | Technology | Status |
|-------|-----------|--------|
| **Mobile** | Expo SDK 52, React Native, Expo Router | ✅ Working |
| **UI** | Tamagui + tami·draft design system | 🔄 27% migrated |
| **Web** | Next.js 15, App Router | ✅ Setup |
| **API** | Hono + tRPC | ✅ Working |
| **Database** | Drizzle ORM + PostgreSQL (Cloud SQL) | ✅ Working |
| **Cache** | Redis (ioredis, Memorystore) | ✅ Working |
| **AI** | Gemini API + MCP architecture | ✅ Working |
| **Auth** | Firebase Auth | ⚠️ Partial |
| **Real-time** | Socket.io (WebSocket) | ✅ Configured |
| **Chat** | Firestore (league chat) | ⏳ Phase 5 |
| **Push** | FCM (Firebase Cloud Messaging) | ⏳ Phase 5 |
| **Email** | Resend | ⏳ Phase 5 |
| **Analytics** | PostHog | ⏳ Phase 6 |
| **Payments** | Razorpay | ✅ Schema ready |
| **Voice** | GCP Speech-to-Text / Text-to-Speech | ⏳ Phase 8 |
| **Deployment** | GCP Cloud Run (serverless) | ✅ Ready |

### MCP Server Architecture

```
MCP Layer (packages/api/src/mcp/)
├── cricket-stats/       — Live scores, historical stats, player records
├── venue-pitch/         — Venue history, pitch reports, weather
├── news-injury/         — Team news, injury updates, squad changes
├── social-sentiment/    — Twitter/Reddit buzz (Phase 8)
└── betting-odds/        — Bookmaker odds for AI context (Phase 8)
```

### Data Flow

```
User Request → tRPC API → Redis Cache
                               ↓ (miss)
                         Gemini API ← MCP Context
                               ↓
                         Cache + Return

AI Features: Match + Player + Venue + Weather Data
  → MCP aggregation → Gemini API
  → FDR | Projections | Previews | Predictions | Rate My Team
  → Cache in DB + Redis → Serve to UI
```

### Database Schema Count

| Phase | New Tables | Cumulative |
|-------|-----------|------------|
| Phase 0-2 (Complete) | ~15 | 15 |
| Phase 2.75 | 19 | 34 |
| Phase 3 | 1 (guru_conversations if not in 2.75) | 34-35 |
| Phase 4 | Uses 2.75 tables | 35 |
| Phase 5 | ~3 (chat via Firestore) | 38 |
| Phase 6 | 0 (admin uses existing) | 38 |

---

## Navigation Structure (Final — Mobile Bottom Tabs)

```
Tab 1: HOME
├── Active Tournaments (carousel) → Tournament Detail (matches, FDR ticker, standings)
├── Today's Matches (🔴 live / ⏰ upcoming / ✅ completed)
├── Quick Predictions (swipe cards)
├── AI Insights (match previews, tips)
└── News/Alerts (injury updates)

Tab 2: MY TEAMS
├── Tournament Leagues → Team Management
│   ├── Current Squad (with projected pts)
│   ├── Set Lineup (captain, XI, chip)
│   ├── Transfer Hub (browser, waivers, inter-team trades, planner)
│   ├── Advance Queue (next 3-5 matches)
│   ├── Chips / Power-Ups
│   └── Trade History
├── Daily Contests
├── Rate My Team
└── Create/Join League

Tab 3: GURU (AI Hub)
├── Chat Interface + Quick Actions
│   ├── "Rate My Team"
│   ├── "Best Captain Pick"
│   ├── "Transfer Suggestions"
│   ├── "Compare Players"
│   ├── "Fixture Analysis"
│   ├── "Chip Advisor"
│   └── "Explain Rule"
├── Player Comparison Tool
├── Projected Points Browser
├── Fixture Difficulty Calendar
└── Ownership & Template Team

Tab 4: LEAGUES
├── My Leagues → Detail
│   ├── Standings (cumulative + H2H)
│   ├── Playoff Bracket
│   ├── Cup Draw
│   ├── Weekly Awards / Trophy Room
│   ├── League Chat
│   ├── Trade Board
│   ├── Prediction Standings
│   └── League History
│   └── Commissioner Tools (if manager)
│       ├── Rule Editor
│       ├── Member Management
│       ├── Trade Veto Queue
│       ├── Announcements
│       └── Prize Setup
├── Draft / Auction Rooms
├── Join / Create League
└── Custom Tournament Builder

Tab 5: MORE
├── Profile (stats, achievements, history)
├── Wallet (balance, deposit, withdraw, history)
├── Notifications (inbox + preferences)
├── Settings (theme, language, data usage)
├── Referrals (invite friends, track rewards)
├── Help & Tutorials
└── Feedback
```

---

## Timeline Summary

| Phase | Weeks | Dates (Est.) | Key Deliverables |
|-------|-------|-------------|-----------------|
| 2.75 | 12-14 | Feb 10 – Mar 2 | Real data, 19 new tables, 51 test cases |
| 3 | 15-19 | Mar 3 – Apr 6 | FDR, projections, Guru, comparison, previews, planner |
| 4 | 20-24 | Apr 7 – May 11 | Tournament mode, trades, playoffs, chips, commissioner, H2H, awards |
| 5 | 25-28 | May 12 – Jun 8 | Predictions (11 types), chat, notifications, social |
| 6 | 29-32 | Jun 9 – Jul 6 | Web parity, admin, analytics dashboard |
| 7 | 33-36 | Jul 7 – Aug 3 | Polish, security, testing, beta launch |
| 8 | 37+ | Aug 2026+ | Voice, newsletter, dynamic pricing, cup mode, streaks |

**Target Beta Launch:** Early August 2026  
**Target IPL 2027 Readiness:** March 2027

---

## Risk Register

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Redis cache failures | ✅ Mitigated | Graceful fallback to direct Gemini API |
| Serverless cold starts | ✅ Mitigated | Redis cache prevents repeated API calls |
| AI projection inaccuracy | ⚠️ Active | Backtest against historical data, iterate prompts |
| Tournament mode complexity | ⚠️ Active | Build schema early (2.75), features incremental |
| **PROGA upheld — India real-money dead** | **⚠️ Active** | **Dual-mode architecture: free-to-play India + paid international. Single flag toggle** |
| **PROGA struck down — state-level patchwork** | **⚠️ Active** | **State ban list already coded (AP/TG/AS/OD). GPS verification for paid actions** |
| **Geo-detection accuracy (VPN, wrong state)** | **⚠️ Active** | **3-layer defense (IP+GPS+declaration). GPS required for paid actions. Mismatch flagging** |
| India real-money regulations | ⚠️ Active | Dual model: free India + paid global (adjustable per PROGA ruling) |
| Gemini API rate limits | ⚠️ Monitor | Batch generation + aggressive caching |
| WebSocket scalability (1000+ rooms) | ⚠️ Active | Cloud Run auto-scaling, connection pooling |
| Firestore costs (league chat) | ⚠️ Monitor | Message batching, archive old messages |
| Voice accuracy (Indian English) | ⚠️ Risk | Phase 8, only if user demand exists |
| Schema migration (19 new tables + geo) | ⚠️ Active | Drizzle migrations, thorough testing in 2.75 |
| UI migration velocity (11 screens) | ⚠️ Active | Migrate alongside feature phases, not standalone |

---

## Resources & Documentation

### Developer Docs
- [Local Setup Guide](./docs/LOCAL_SETUP.md)
- [Redis Cache Architecture](./docs/REDIS_CACHE_ARCHITECTURE.md)
- [UI Design System Guide](./TAMI_DRAFT_UI_GUIDE.md)
- [Screen Migration Checklist](./SCREEN_MIGRATION_CHECKLIST.md)

### Code Structure
- tRPC routers: `/packages/api/src/routers/`
- Services: `/packages/api/src/services/`
- Database schema: `/packages/db/src/schema/`
- MCP servers: `/packages/api/src/mcp/`
- UI components: `/packages/ui/src/components/`
- Theme: `/packages/ui/src/theme/`

---

**This plan is a living document. Update as we learn and adapt.**

**Status Last Updated:** February 10, 2026, 10:00 AM EST