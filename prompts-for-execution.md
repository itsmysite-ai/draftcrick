# DraftPlay — Claude Code Prompt Runbook

> **Every prompt you need to execute, in order, to build DraftPlay.**
> Copy-paste each prompt into Claude Code. Review the output. Move to the next.
> **Last Updated:** March 3, 2026
> **Strategy:** Launch Roadmap (L1→L6) — ship a sticky product in ~9 weeks, defer advanced features with "Coming Soon" UI screens.

---

## Before You Start

**You do NOT need to run the explore command again** — you already ran it. But you DO need:

1. ✅ `CLAUDE.md` created in repo root (already done — includes logging guide reference)
2. ✅ `/docs/` folder with plan docs + `LOGGING_GUIDE.md` (already done)
3. ✅ GitHub issues #1-21 created for Phase 2.75 (already done — skip Prompt 0B and Prompt 1)
4. ⬜ `/screenshots/` folder created: `mkdir screenshots`
5. ⬜ `.claude/commands/` folder created (optional but recommended)
6. ⬜ Playwright installed: `npx playwright install`

---

## How to Use This Runbook

- **Run prompts in order** — later prompts depend on earlier ones
- **Prompts marked 🔀 PARALLEL** can run simultaneously in separate terminal tabs
- **Review each PR** before moving to the next prompt
- **After merging**, start the next prompt
- **If a prompt fails**, tell Claude Code what went wrong and it'll fix it (Ralph Loop)
- **Structured logging is already set up** — see `/docs/LOGGING_GUIDE.md`. All prompts reference it. Use `getLogger("module")` on backend, `createLogger("Component")` on frontend. Never use raw `console.log`.

---

## Your GitHub Issues → Prompt Mapping

You already created issues #1-21 for Phase 2.75. Here's which prompt implements which issue:

| Issue # | Title | Prompt # | Launch Phase | Status |
|---------|-------|----------|-------------|--------|
| #1 | Home Screen — Real Data Integration | PROMPT 4 | L1 | ✅ Done |
| #2 | Tournament Display & Filtering | PROMPT 5 | L1 | ✅ Done |
| #3 | Tournament Mode Database Schema (19 tables) | PROMPT 2 | L1 | ✅ Done |
| #4 | Geo-Location & Regional Compliance Foundation | PROMPTS 6-9 | L1 | ✅ Done |
| #5 | Authentication Testing (7 test cases) | PROMPT 10 | L1 | ⬜ |
| #6 | Team Builder Testing (8 test cases) | PROMPT 11 | L1 | ⬜ |
| #7 | Contest System Testing (7 test cases) | PROMPT 12 | L1 | ⬜ |
| #8 | Draft Room Testing (7 test cases) | PROMPT 13 | L1 | ⬜ |
| #9 | Auction Room Testing (6 test cases) | PROMPT 13 | L1 | ⬜ |
| #10 | Wallet Testing (5 test cases) | PROMPT 14 | L1 | ⬜ |
| #11 | Live Scoring Testing (5 test cases) | PROMPT 14 | L1 | ⬜ |
| #12 | Caching & Performance Testing (5 test cases) | PROMPT 15 | L1 | ⬜ |
| #13 | Geo-Location Testing (14 test cases) | PROMPT 16 | L1 | ⬜ |
| #14 | Fix all P0 bugs from testing | PROMPT 18 | L1 | ⬜ |
| #15 | Fix all P1 bugs from testing | PROMPT 19 | L1 | ⬜ |
| #16 | Tournament Details Screen UI | PROMPT 5 (included) | L1 | ✅ Done |
| #17 | Draft Eligibility Checks in UI | PROMPT 20 | L1 | ⬜ |
| #18 | Admin endpoint — toggleDraft | PROMPT 20 | L1 | ⬜ |
| #19 | Final verification — all features | PROMPT 21 | L1 | ⬜ |
| #20 | Migrate Match Center to draftplay.ai | PROMPT 21 | L1 | ⬜ |
| #21 | Migrate Team Builder to draftplay.ai | PROMPT 22 | L1 | ⬜ |

**New issues will be created by PROMPTs 22, 31, 36 for L2-L5 features.**

**Skip Prompt 0B** (labels — already created) and **Prompt 1** (issues — already created).
**Start with Prompt 0A** (Playwright setup), then **Prompt 2** (schema).

---

## Launch Roadmap Quick Reference

```
L1: Finish Phase 2.75  →  Prompts 0A-21   (testing + polish)
L2: AI Engine           →  Prompts 22-28   (FDR, projections, Guru, Rate My Team)
L3: Push Notifications  →  Prompts 29-30   (FCM, 5 core types)
L4: Tournament Mode     →  Prompts 31-35   (season leagues, chips, awards)
L5: Predictions         →  Prompts 36-37   (11 types, AI questions)
L6: Coming Soon + Launch→  Prompts 38-44   (15 screens, polish, beta prep)
Post-Launch             →  Prompts 45-58   (replace Coming Soon with real features)
```

---

## PHASE 2.75 — WEEK 1: Real Data + Tournament Schema + Geo Foundation

### Step 0: Setup (Run Once)

```
PROMPT 0A: Project Setup
────────────────────────
Create the following in the project root:
1. A /screenshots/ folder (add to .gitignore except for PR-linked ones)
2. A /tests/e2e/ folder with subfolders: auth, team-builder, contests, 
   draft, auction, wallet, live, cache, geo, scoring
3. A .claude/commands/ folder

Then install Playwright as a dev dependency and set up a basic 
playwright.config.ts configured for:
- Mobile viewport (iPhone 14: 390x844)  
- Web viewport (Chrome: 1280x720)
- Base URL from .env (default: http://localhost:3000)
- Screenshots on failure: on
- Test directory: /tests/e2e/

Run npx playwright install to get browser binaries.
Commit as: chore: add Playwright test infrastructure
```

```
PROMPT 0B: GitHub Labels & Milestones
─────────────────────────────────────
Create GitHub labels:
- phase:2.75, phase:3, phase:4, phase:5, phase:6, phase:7, phase:8 (blue shades)
- type:feature, type:test, type:bugfix, type:schema, type:ui (green shades)
- priority:P0, priority:P1, priority:P2 (red/orange/yellow)
- area:data, area:tournament, area:geo, area:ai, area:social, area:ui, 
  area:wallet, area:draft, area:auth, area:cache (purple shades)

Create milestones:
- Phase 2.75 Week 1 (due Feb 16)
- Phase 2.75 Week 2 (due Feb 23)
- Phase 2.75 Week 3 (due Mar 2)
```

### Step 1: Create GitHub Issues from Plan

```
PROMPT 1: Create All Phase 2.75 Week 1 Issues
──────────────────────────────────────────────
Read /docs/NEW_PLAN.md, specifically Phase 2.75 Week 1 
(sections 1A, 1B, 1C, and 1D).

For each task, create a GitHub issue with:
- Title: [Phase 2.75] Task name
- Body: Full implementation spec from the plan (include description, 
  expected behavior, relevant code paths)
- Labels: phase:2.75 + appropriate type and area labels
- Milestone: Phase 2.75 Week 1
- Acceptance criteria as a checkbox list
- Estimated time from the plan doc
- Dependencies (which issues must be done first)

Create them in dependency order. The sections are:

1A. Home Screen — Real Data Integration (5 tasks)
1B. Tournament Display & Filtering (5 tasks)  
1C. Tournament Mode Database Schema - 19 tables (5 tasks)
1D. Geo-Location & Regional Compliance Foundation (10 tasks)

That's ~25 issues total. Do NOT start coding — just create the issues.
List all created issue numbers when done.
```

### Step 2: Database Schema (Do This First — Everything Depends on It)

```
PROMPT 2: Tournament Mode Schema — 19 Drizzle Tables  [→ closes #3]
────────────────────────────────────────────────────
Read /docs/NEW_PLAN.md section 1C "Tournament Mode Database Schema" 
which has full SQL CREATE TABLE statements for 19 tables.

Implement ALL 19 tables as Drizzle schema files:

1. tournament_leagues
2. tournament_team_submissions
3. tournament_trades
4. player_locks
5. player_statuses
6. chip_usage
7. advance_team_queue
8. playoff_brackets
9. commissioner_actions
10. prediction_questions
11. prediction_answers
12. prediction_standings
13. h2h_matchups
14. league_awards
15. custom_tournaments
16. fixture_difficulty
17. player_projections
18. player_ownership
19. guru_conversations

Also add draft_enabled and tournament_id columns to the existing 
matches table.

For each table:
- Create a Drizzle schema file in the appropriate schema directory
- Use proper relations, indexes, and constraints
- Match the column types from the SQL in the plan exactly

After writing all schema files:
- Run npx drizzle-kit generate to create the migration
- Run the migration against the dev database
- Verify all 19 tables exist by querying: SELECT tablename FROM pg_tables WHERE schemaname = 'public'
- Take a screenshot or paste the output showing all tables

Create branch: feature/phase-2.75-tournament-schema
Commit: feat(phase-2.75): add 19 tournament mode Drizzle schema tables
Create PR referencing the relevant GitHub issue.
Include the DB verification output in the PR description.
```

```
PROMPT 3: Seed Data
───────────────────
Read /docs/NEW_PLAN.md — seed tasks in section 1C.

1. Seed World Cup 2026 as a draft-enabled tournament in the database
2. Seed initial player_statuses for all existing players (set to 'available')
3. Create tRPC router stubs for the new entities:
   - tournament.list, tournament.getById, tournament.getStandings
   - prediction.getQuestions, prediction.submitAnswer
   - h2h.getMatchup, h2h.getStandings
   - commissioner.getActions

Don't implement full logic — just create the router files with empty 
procedures that return placeholder data. The real logic comes in Phase 4.

After seeding:
- Query the database to confirm World Cup 2026 exists
- Query player_statuses to confirm entries exist
- Curl each tRPC stub endpoint to confirm it responds

Branch: feature/phase-2.75-seed-data
Commit: feat(phase-2.75): seed tournament data + create tRPC router stubs
```

### Step 3: Home Screen Real Data (🔀 PARALLEL — Can Run Alongside Step 4) ✅ DONE

> **Completed:** Feb 12, 2026 on branch `feature/phase-2.75-smart-refresh`
> **What was built beyond the prompt:**
> - Smart Refresh Architecture (3-tier: Redis hot cache → PostgreSQL → Gemini API)
> - Write-through PG persistence with stable external IDs and dedup
> - Player roster fetching via Gemini (batched 3 tournaments/call) with credits + batting/bowling avg
> - Distributed refresh locking + audit logging (`data_refresh_log` table)
> - See `/docs/SMART_REFRESH_ARCHITECTURE.md` for full architecture spec

```
PROMPT 4: Home Screen — Connect Real Data  [→ closes #1]  ✅ DONE
─────────────────────────────────────────
Read /docs/NEW_PLAN.md section 1A "Home Screen — Real Data Integration".

Implement all 5 tasks:
1. Replace static data on the home screen with trpc.sports.dashboard.useQuery()
2. Add EggLoadingSpinner component while data is fetching
3. Add empty state message when no matches are available
4. Add user-friendly error handling when API fails (retry button)
5. Verify Redis cache hit/miss — the logger should already show cache
   status via the structured logger (see /docs/LOGGING_GUIDE.md, module: sports-cache)

Use draftplay.ai design system components (see /docs/UI_GUIDE.md).

Self-verify:
- Run the app and take screenshots of: loading state, data loaded,
  empty state, error state
- Save to /screenshots/home-loading.png, /screenshots/home-data.png,
  /screenshots/home-empty.png, /screenshots/home-error.png
- Check that the Redis cache is being hit (check logs for cache hit/miss)

Branch: feature/phase-2.75-home-real-data
Commit: feat(phase-2.75): connect home screen to real sports data API
```

### Step 4: Tournament Display (🔀 PARALLEL — Can Run Alongside Step 3) ✅ DONE

> **Completed:** Feb 12, 2026 on branch `feature/phase-2.75-smart-refresh`
> **What was built beyond the prompt:**
> - Tournament standings (points tables) fetched via Gemini + Google Search grounding
> - Standings stored as JSONB on `tournaments.standings` column
> - `trpc.sports.standings` public endpoint reads standings from PG
> - Standings tab renders full points table: #, Team, P, W, L, PTS, NRR with group headers
> - Stats tab enhanced with batting avg + bowling avg alongside credits
> - See `/docs/SMART_REFRESH_ARCHITECTURE.md` for how standings fit into the refresh pipeline

```
PROMPT 5: Tournament Display & Filtering  [→ closes #2, #16]  ✅ DONE
────────────────────────────────────────
Read /docs/NEW_PLAN.md section 1B "Tournament Display & Filtering".

Implement all 5 tasks:
1. Create a TournamentCard component using draftplay.ai design system
   (see /docs/UI_GUIDE.md for component patterns)
2. Add tournament list to the home screen showing active tournaments
   (IPL, World Cup, BBL, etc.)
3. Add tournament filtering — tap a tournament to filter matches by it
4. Create /tournament/[id].tsx screen showing: matches, standings,
   stats leaders for that tournament
5. Add top performers and standings table to tournament details

Self-verify:
- Take screenshot of tournament list on home: /screenshots/tournament-list.png
- Take screenshot of tournament filtering active: /screenshots/tournament-filter.png
- Take screenshot of tournament details screen: /screenshots/tournament-details.png
- Verify data is coming from real API (not mocked)

Branch: feature/phase-2.75-tournament-display
Commit: feat(phase-2.75): tournament display, filtering, and details screen
```

### Step 5: Geo-Location Foundation (Run After Schema is Merged)

```
PROMPT 6: Geo-Location — Server-Side (IP + Middleware)  [→ partially closes #4]
─────────────────────────────────────────────────────
Read /docs/GEO_IMPLEMENTATION_GUIDE.md sections 3.1 (Layer 1: IP) 
and the middleware section. Also read /docs/LOGGING_GUIDE.md for 
how to add structured logging to new backend modules.

Implement:
1. MaxMind GeoLite2 integration:
   - Download GeoLite2-City database 
   - Create resolveGeoIP(ipAddress) service that returns {country, state, city}
   - Set up weekly update cron job for the GeoIP database
   
2. Hono geo middleware:
   - Extract IP from x-forwarded-for header (handle Cloud Run proxy chain)
   - Call resolveGeoIP() to get country/state
   - Attach {ipCountry, ipState} to the Hono context
   - Log the resolution for debugging

3. Database changes:
   - Add declared_country, declared_state, declared_at columns to users table
   - Create location_checks table (schema from the geo implementation guide)
   - Run migration

Self-verify:
- Write a unit test for resolveGeoIP with a known Indian IP → expect country=IN
- Write a unit test for resolveGeoIP with a known US IP → expect country=US
- Curl the API with X-Forwarded-For set to an Indian IP, verify geo context is set
- Verify the location_checks table exists in the database

Branch: feature/phase-2.75-geoip
Commit: feat(phase-2.75): MaxMind GeoIP integration + Hono geo middleware
```

```
PROMPT 7: Geo-Location — Client-Side (GPS + Declaration)  [→ partially closes #4]
────────────────────────────────────────────────────────
Read /docs/GEO_IMPLEMENTATION_GUIDE.md sections 3.1 (Layer 2: GPS, 
Layer 3: Declaration).

Implement:
1. Expo Location service:
   - getDeviceLocation() with permission flow (ask, handle denied, 
     fall back to coarse location)
   - Reverse geocode coordinates to country/state
   - Call on app launch and before paid actions
   
2. User declaration onboarding step:
   - Country/state selector (auto-filled from IP and GPS results)
   - Legal confirmation checkbox: "I confirm I am located in [country/state]"
   - Store in users.declared_country and users.declared_state
   - Show this step during onboarding for new users

Self-verify:
- Take screenshot of the onboarding declaration screen: 
  /screenshots/onboarding-country-picker.png
- Test the GPS permission flow (grant → location resolved)
- Test GPS permission denied → falls back to IP-based location
- Verify declared_country is saved to the users table

Branch: feature/phase-2.75-geo-client
Commit: feat(phase-2.75): Expo Location service + user declaration onboarding
```

```
PROMPT 8: Geo Resolution Engine + Feature Gates  [→ partially closes #4]
───────────────────────────────────────────────
Read /docs/GEO_IMPLEMENTATION_GUIDE.md sections 3.2 (Resolution Engine) 
and 3.3 (Feature Gates). Use structured logging per /docs/LOGGING_GUIDE.md
(module: "geo" for all geo services).

Implement:
1. resolveUserZone(ipGeo, deviceGeo, declaration) function:
   - Combines all 3 layers (IP, GPS, declaration)
   - Returns a RegulatoryZone: india_free_only, india_real_money, 
     international_permitted, international_blocked, unknown
   - If layers disagree (VPN suspicion), flag mismatch
   - If can't determine → return 'unknown' (most restrictive)

2. getFeatureAccess(zone) function:
   - india_free_only: no wallet, no paid contests, no prizes, 
     no deposits/withdrawals
   - india_real_money: full features + KYC + 30% TDS + 28% GST
   - international_permitted: full features + KYC
   - international_blocked: free-play only
   - unknown: free-play only

3. geo.resolveLocation tRPC endpoint:
   - Called on session start
   - Combines all 3 geo layers
   - Logs the check to location_checks table
   - Returns the zone + feature access object to the client

4. Client-side feature gating:
   - Read zone from geo.resolveLocation on app startup
   - Hide wallet/prizes/paid contests when zone is restricted
   - Show appropriate messaging for restricted zones

5. PROGA_ACTIVE feature flag:
   - Create a server-side flag (env var or config table)
   - When true: all Indian users → india_free_only zone
   - When false: check state-level bans

Self-verify:
- Unit test resolveUserZone with 5 scenarios:
  a) Indian IP + Indian GPS + declared India → india_free_only (PROGA active)
  b) US IP + US GPS + declared US → international_permitted
  c) UAE IP + UAE GPS + declared UAE → international_blocked
  d) US IP (VPN) + Indian GPS → flag mismatch, use GPS → india_free_only
  e) Unknown everything → unknown zone
- Unit test getFeatureAccess for each zone
- Take screenshots showing:
  - Full features visible for US user: /screenshots/features-us-full.png
  - Wallet/prizes hidden for Indian user: /screenshots/features-india-restricted.png

Branch: feature/phase-2.75-geo-engine
Commit: feat(phase-2.75): geo resolution engine + feature gates + PROGA flag
```

```
PROMPT 9: Gemini API Region Routing  [→ closes #4]
───────────────────────────────────
Read /docs/GEO_IMPLEMENTATION_GUIDE.md section 4 (Gemini API Regional Routing).

Implement:
1. createGeminiClient(userCountry) function:
   - India → asia-south1 (Mumbai)
   - Southeast Asia → asia-southeast1 (Singapore)
   - US/Canada → us-central1 (Iowa)
   - Europe → europe-west1 (Belgium)
   - Default → asia-south1

2. createGeminiClientGlobal() for background/batch jobs

3. Update ALL existing Gemini API calls in the codebase to use 
   createGeminiClient(userCountry) instead of hardcoded regions.
   Search for any direct GoogleGenAI instantiation and replace it.

Self-verify:
- Unit test: Indian user → asia-south1
- Unit test: US user → us-central1
- Unit test: UK user → europe-west1
- Unit test: Global client → 'global' location
- Grep the codebase for any remaining hardcoded Gemini region strings

Branch: feature/phase-2.75-gemini-routing
Commit: feat(phase-2.75): Gemini API region-routing per user country
```

---

## PHASE 2.75 — WEEK 2: Testing

### Step 6: Generate All Test Cases from Plan

```
PROMPT 10: Generate Auth Tests (7 test cases)  [→ closes #5]
────────────────────────────────────────────
Read /docs/NEW_PLAN.md Phase 2.75 Week 2, section A "Authentication".

Create Playwright E2E tests in tests/e2e/auth/auth.spec.ts for:
1. Email signup with valid credentials
2. Google OAuth sign-in flow
3. Apple sign-in flow
4. Phone OTP verification
5. Password reset flow
6. Token refresh (session stays alive)
7. Logout clears session

Use test fixtures for auth state. Mock external providers where needed.
Mark tests that require real OAuth credentials as test.skip() with TODO.

Run all tests. Fix failures. Report results.

Branch: test/phase-2.75-auth-tests
Commit: test(phase-2.75): auth E2E tests (7 cases)
```

```
PROMPT 11: Generate Team Builder Tests (9 test cases)  [→ closes #6]
────────────────────────────────────────────────────
Read /docs/NEW_PLAN.md Phase 2.75 Week 2, section B "Team Builder".

Create Playwright E2E tests in tests/e2e/team-builder/team-builder.spec.ts:
1. Player browse with pagination
2. Player search by name
3. Player filter by role (batsman/bowler/all-rounder/keeper)
4. Player stats accuracy (match plan's expected values)
5. Budget enforcement (can't exceed salary cap)
6. Role constraints (min/max per role)
7. Captain selection
8. Vice-captain selection
9. Save team and verify it persists

Run all tests. Fix failures. Take screenshots of key states.

Branch: test/phase-2.75-team-builder-tests
Commit: test(phase-2.75): team builder E2E tests (9 cases)
```

```
PROMPT 12: Generate Contest + Draft + Auction Tests (20 test cases)  [→ closes #7, #8, #9]
─────────────────────────────────────────────────────────────────
Read /docs/NEW_PLAN.md Phase 2.75 Week 2, sections C, D, E.

Create Playwright E2E tests for:

tests/e2e/contests/contests.spec.ts (7 cases):
1. Browse available contests
2. Join a free contest
3. Join a paid contest (balance check)
4. Balance validation (reject if insufficient)
5. Contest details screen
6. Leaderboard display
7. Contest settlement

tests/e2e/draft/draft.spec.ts (7 cases):
1. Create draft room
2. Join draft room
3. Start draft
4. Make a pick
5. Timer expiry → auto-pick
6. WebSocket sync between users
7. Draft completion

tests/e2e/auction/auction.spec.ts (6 cases):
1. Create auction room
2. Place bid
3. Counter-bid
4. Timer countdown
5. Budget tracking
6. Auction completion

Run all tests. Fix failures. Report results.
Mark WebSocket tests as test.skip() if WebSocket test server isn't set up.

Branch: test/phase-2.75-contest-draft-auction-tests
Commit: test(phase-2.75): contest, draft, and auction E2E tests (20 cases)
```

```
PROMPT 13: Generate Wallet + Live Scoring + Cache Tests (15 test cases)  [→ closes #10, #11, #12]
─────────────────────────────────────────────────────────────────────
Read /docs/NEW_PLAN.md Phase 2.75 Week 2, sections F, G, H.

Create Playwright E2E tests for:

tests/e2e/wallet/wallet.spec.ts (5 cases):
1. Balance display shows correct amount
2. Deposit flow (mock Razorpay)
3. Transaction history displays correctly
4. Withdrawal request flow
5. Bonus credits applied correctly

tests/e2e/live/live-scoring.spec.ts (5 cases):
1. WebSocket connection established
2. Live score updates received
3. Fantasy points calculated correctly
4. Live leaderboard updates
5. Match completion triggers final scoring

tests/e2e/cache/cache.spec.ts (5 cases):
1. Redis cache hit returns cached data
2. Cache miss fetches from API
3. 24hr TTL expiration works
4. Distributed locking prevents race conditions
5. API response times under 500ms (cached)

Run all tests. Fix failures. Report results.

Branch: test/phase-2.75-wallet-live-cache-tests
Commit: test(phase-2.75): wallet, live scoring, and cache E2E tests (15 cases)
```

```
PROMPT 14: Generate Geo-Location Tests (14 test cases)  [→ closes #13]
────────────────────────────────────────────────────
Read /docs/NEW_PLAN.md Phase 2.75 Week 2, section I "Geo-Location & 
Feature Gates Testing" and /docs/GEO_IMPLEMENTATION_GUIDE.md.

Create Playwright E2E tests in tests/e2e/geo/geo.spec.ts (14 cases):
1. IP geolocation resolves India correctly
2. IP geolocation resolves US correctly
3. IP geolocation resolves UK correctly
4. GPS resolution returns country/state
5. GPS permission denied → falls back to IP
6. User declaration saved to database
7. User declaration auto-filled from IP/GPS
8. Zone resolution: PROGA active + Indian user → india_free_only
9. Zone resolution: US user → international_permitted
10. Zone resolution: UAE user → international_blocked
11. Zone resolution: banned state (AP/TG) → india_free_only
12. Feature gates: wallet/prizes hidden in free-only zone
13. VPN detection: IP says US, GPS says India → mismatch flagged
14. Location check logged to location_checks table

Mock the GeoIP service to simulate different countries.
Mock Expo Location to simulate GPS responses.

Run all tests. Fix failures. Report results.

Branch: test/phase-2.75-geo-tests
Commit: test(phase-2.75): geo-location E2E tests (14 cases)
```

```
PROMPT 15: Generate Scoring Tests (8 test cases)
───────────────────────────────────────────────
Read /docs/NEW_PLAN.md Phase 2.75 Week 2, scoring-related test cases.

Create tests in tests/e2e/scoring/scoring.spec.ts (8 cases):
1. Run scored (per-run points)
2. Boundary bonus (4s and 6s)
3. Milestone bonus (50, 100)
4. Wicket points by bowler type
5. Economy rate bonus/penalty
6. Strike rate bonus/penalty
7. Captain gets 2x points
8. Vice-captain gets 1.5x points

These can be unit tests against the scoring.ts engine rather than 
full E2E tests. Use known match data and verify point calculations.

Run all tests. Fix failures. Report results.

Branch: test/phase-2.75-scoring-tests
Commit: test(phase-2.75): scoring engine tests (8 cases)
```

### Step 7: Full Suite Verification

```
PROMPT 16: Run Full Test Suite + Report  [→ updates #5-#13]
──────────────────────────────────────
Run the complete Playwright test suite:

npx playwright test

Generate a report showing:
- Total tests: X
- Passing: X
- Failing: X
- Skipped: X

For each failing test, briefly explain why it's failing and whether 
it's a test bug or an app bug.

Save the HTML report.
Create a summary markdown file at /screenshots/phase-2.75-test-report.md
```

---

## PHASE 2.75 — WEEK 3: Bug Fixes + Polish

```
PROMPT 17: Fix P0 Bugs  [→ closes #14]
─────────────────────
Review all failing tests from the test report.

Fix ALL P0 bugs (tests that fail due to app bugs, not test setup):
1. For each failing test, determine: is this a test bug or app bug?
2. Fix app bugs first
3. Fix test bugs second
4. Re-run the full suite after each fix
5. Loop until all P0 tests pass

For each fix, commit separately with: fix(phase-2.75): description

Do NOT create a PR yet — batch all P0 fixes into one PR.

Branch: fix/phase-2.75-p0-bugs
```

```
PROMPT 18: Tournament Details Screen UI  [→ closes #15, #16]
──────────────────────────────────────
Read /docs/NEW_PLAN.md Week 3 task: "Create tournament details screen UI"
and /docs/UI_GUIDE.md for design system.

Create a polished tournament details screen at /tournament/[id].tsx:
- Tournament header (name, dates, format, teams)
- Tab navigation: Matches | Standings | Stats
- Matches tab: list of matches with scores, sorted by date
- Standings tab: team standings table (W/L/NRR/Points)
- Stats tab: top run scorers, top wicket takers, best economy

Use draftplay.ai design system components throughout.

Self-verify:
- Take screenshots of all 3 tabs
- Verify real data loads from API
- Check loading states work
- Check empty state for stats tab

Branch: feature/phase-2.75-tournament-details-ui
Commit: feat(phase-2.75): tournament details screen with tabs
```

```
PROMPT 19: Admin Toggle + Draft Eligibility  [→ closes #17, #18]
──────────────────────────────────────────
Read /docs/NEW_PLAN.md Week 3 tasks for admin and draft eligibility.

1. Create admin.tournaments.toggleDraft tRPC endpoint
   - Sets draft_enabled=true/false on a tournament
   - Only accessible by admin role
   
2. Add draft eligibility checks to the UI:
   - On the tournament details screen, show "Draft Enabled" badge 
     if draft_enabled=true
   - On match pages, show draft options only if the tournament is 
     draft-enabled

Self-verify:
- Curl the admin endpoint to toggle draft on World Cup 2026
- Query the database to confirm the flag changed
- Take screenshot showing the Draft Enabled badge

Branch: feature/phase-2.75-admin-draft-toggle
Commit: feat(phase-2.75): admin draft toggle + draft eligibility UI
```

```
PROMPT 20: Screen Migrations (Match Center + Team Builder)  [→ closes #20, #21]
─────────────────────────────────────────────────────────
Read /docs/UI_GUIDE.md for design system patterns.

Migrate 2 screens to draftplay.ai design system:
1. Match Center screen — replace old components with draftplay.ai equivalents
2. Team Builder screen — replace old components with draftplay.ai equivalents

For each screen:
- Replace all old style objects with Tamagui tokens
- Use draftplay.ai components (TournamentCard, etc.)
- Ensure all text uses the design system typography
- Test dark mode compatibility

Self-verify:
- Take before/after screenshots of each screen
- /screenshots/match-center-before.png → /screenshots/match-center-after.png
- /screenshots/team-builder-before.png → /screenshots/team-builder-after.png
- Verify no visual regressions on other screens

Branch: feature/phase-2.75-screen-migrations
Commit: feat(phase-2.75): migrate Match Center + Team Builder to draftplay.ai
```

### Step 8: Phase 2.75 Sign-Off

```
PROMPT 21: Phase 2.75 Verification  [→ closes #19]
──────────────────────────────────
Read /docs/NEW_PLAN.md Phase 2.75 Success Criteria section.

For EACH criterion, verify it passes:

- [ ] Home screen shows real data from Gemini API
- [ ] Tournaments displayed with filtering
- [ ] World Cup 2026 whitelisted for draft
- [ ] All 19 tournament schema tables created + migrated
- [ ] 65+ Playwright tests written and passing
- [ ] All P0 bugs fixed
- [ ] P1 bugs fixed or documented
- [ ] Match Center migrated to draftplay.ai
- [ ] Team Builder migrated to draftplay.ai
- [ ] Geo-detection: IP + GPS + declaration all resolving correctly
- [ ] Feature gates: paid features hidden for restricted zones
- [ ] Gemini API routing to nearest region
- [ ] Location audit trail logging

For each criterion:
1. Run the relevant test or query
2. Take a screenshot or paste output as proof
3. Mark PASS ✅ or FAIL ❌

Save full report to /screenshots/phase-2.75-signoff.md
If anything fails, fix it and re-verify.
```

---

## L2: AI ENGINE — Phase 3 Core (Weeks 16-18)

> **These are the killer differentiators. No competitor has AI-powered fantasy cricket advice.**
> Only implementing the CORE features (FDR, Projections, Guru, Rate My Team).
> Comparison, Ownership, Previews, Transfer Planner are deferred to post-launch.

### Step 9: Create Launch AI Issues

```
PROMPT 22: Create Phase 3 Core GitHub Issues
─────────────────────────────────────────────
Read /docs/NEW_PLAN.md Phase 3 sections 3.1-3.4 ONLY (FDR, Projected
Points, Guru Chat, Rate My Team).

Create GitHub issues for the CORE AI features only:
- FDR System (fixture difficulty ratings)
- AI Projected Points Engine
- Cricket Guru Chat
- Rate My Team

Do NOT create issues for: Player Comparison, Ownership Stats,
Match Previews, or Transfer Planner — these are post-launch.

Label: phase:3, area:ai, priority:P0
Milestone: Create "L2: AI Engine" milestone

List all created issue numbers when done.
```

### Step 10: FDR + Projected Points

```
PROMPT 23: Fixture Difficulty Rating (FDR) System
────────────────────────────────────────────────
Read /docs/NEW_PLAN.md section 3.1 "Fixture Difficulty Rating System".

Implement the FDR engine:
1. Gemini API prompt that analyzes opponent strength, venue, recent form,
   head-to-head, conditions → returns 1-5 difficulty rating
2. Batting and bowling difficulty breakdown
3. Store results in fixture_difficulty table (created in Phase 2.75)
4. Cache FDR results in Redis (24hr TTL)
5. Create tRPC endpoint: fdr.getByTeam, fdr.getByMatch
6. Create FDR visualization component (color-coded 1-5 scale,
   green=easy, red=hard)
7. FDR matrix view (team × upcoming matches grid)

Self-verify:
- Generate FDR for 3 upcoming IPL matches
- Verify the Gemini prompt returns consistent 1-5 ratings
- Screenshot the FDR visualization
- Screenshot the FDR matrix view
- Verify Redis cache is being used

Branch: feature/phase-3-fdr-system
Commit: feat(phase-3): fixture difficulty rating system with Gemini AI
```

```
PROMPT 24: AI Projected Points Engine
────────────────────────────────────
Read /docs/NEW_PLAN.md section 3.2 "AI Projected Points Engine".

Implement the projection engine:
1. Gemini prompt that analyzes: player recent form, venue stats,
   opponent weakness, match conditions → returns projected fantasy points
2. Confidence interval (high/medium/low)
3. Breakdown: batting/bowling/fielding/bonus projections
4. Captain rank and differential score
5. Store in player_projections table
6. Cache in Redis (refresh before each match)
7. Create tRPC endpoint: projections.getByMatch, projections.getByPlayer
8. Create projection UI component showing projected points + breakdown
9. Sort players by projected points on team selection screen

Self-verify:
- Generate projections for all players in an upcoming match
- Verify projections are reasonable (top batsman 40-80 pts, bowler 30-60)
- Screenshot the projection UI on the player selection screen
- Verify captain rank ordering makes sense
- Verify Redis caching works

Branch: feature/phase-3-projected-points
Commit: feat(phase-3): AI projected points engine with Gemini
```

### Step 11: Guru Chat + Rate My Team

```
PROMPT 25: Cricket Guru AI Chat
──────────────────────────────
Read /docs/NEW_PLAN.md section 3.3 "Cricket Guru Chat Interface".

Implement:
1. Chat UI screen with message bubbles (user + AI)
2. Input field with send button + suggested questions
3. Gemini-powered responses with cricket fantasy context
4. System prompt that includes: current match data, player stats,
   FDR ratings, user's team composition
5. Store conversations in guru_conversations table
6. Pre-built quick questions: "Who should I captain?",
   "Best differential pick?", "Analyze my team"
7. Rate-limit to prevent abuse (10 messages per hour)
8. Floating action button (🥚 egg icon) accessible from all screens

Self-verify:
- Take screenshot of empty chat screen
- Ask "Who should I captain for MI vs CSK?" and screenshot response
- Ask "Best differential pick this week?" and screenshot response
- Verify conversation is saved to database
- Test rate limiting

Branch: feature/phase-3-cricket-guru
Commit: feat(phase-3): Cricket Guru AI chat with Gemini
```

```
PROMPT 26: Rate My Team
──────────────────────
Read /docs/NEW_PLAN.md section 3.4 "Rate My Team".

Implement:
1. Analyze user's selected team against projections + FDR
2. Return overall score (0-100) with grade (A+ to F)
3. Strengths list (good picks)
4. Weaknesses list (risky picks, better alternatives)
5. Specific suggestions: "Consider X instead of Y because..."
6. Captain/VC recommendation if current choice is suboptimal
7. UI card showing the rating with expandable details
8. Accessible from Guru chat ("Rate my team") AND as standalone screen

Self-verify:
- Create a test team with known good/bad picks
- Verify the rating reflects the quality
- Screenshot the rating card with A+ team
- Screenshot the rating card with C- team (bad picks)
- Verify suggestions make sense

Branch: feature/phase-3-rate-my-team
Commit: feat(phase-3): Rate My Team with AI analysis
```

### Step 12: AI Engine Tests + Verification

```
PROMPT 27: Phase 3 Core Tests
─────────────────────────────
Create Playwright E2E tests for the CORE Phase 3 features:
- FDR displays correctly (5 tests)
- Projections show on player cards (5 tests)
- Guru chat responds with relevant cricket advice (3 tests)
- Rate My Team returns reasonable scores (3 tests)

Run all tests. Fix failures. Report results.

Branch: test/phase-3-core-tests
Commit: test(phase-3): core AI feature E2E tests (16 cases)
```

```
PROMPT 28: Phase 3 Core Verification
────────────────────────────────────
Verify each criterion with proof:
- [ ] FDR generates 1-5 ratings for all fixtures
- [ ] Projected points calculated with confidence intervals
- [ ] Guru chat provides contextual fantasy cricket advice
- [ ] Rate My Team scores correlate with team quality
- [ ] All AI features use region-routed Gemini API
- [ ] All AI responses cached in Redis

Save report to /screenshots/phase-3-core-signoff.md
```

---

## L3: PUSH NOTIFICATIONS (Week 19)

> **Without notifications, users forget the app exists. This is the #1 retention lever.**

### Step 13: FCM + Core Notifications

```
PROMPT 29: Push Notifications — FCM Setup + Core Types
─────────────────────────────────────────────────────
Read /docs/NEW_PLAN.md Phase 5 section 5.4 "Push Notifications (FCM)".

Implement CORE notification types only (the ones needed for launch):

1. FCM setup:
   - Configure Firebase Cloud Messaging in the Expo app
   - Create notification service on backend (packages/api/src/services/notifications.ts)
   - Device token registration tRPC endpoint
   - Use getLogger("notifications") for structured logging

2. Core notification types (launch-critical):
   - "Match starts in 1 hour — set your team!" (deadline reminder)
   - "Team lock in 30 minutes!" (urgent deadline)
   - "Match completed! You scored X pts — Rank #Y" (score update)
   - "Your player [name] marked doubtful" (status alert)
   - "You moved up 5 spots in the leaderboard!" (rank change)

3. Notification preferences:
   - Per-category toggle (deadlines, scores, alerts)
   - Quiet hours setting
   - Notification preferences screen in Settings

4. Notification inbox screen:
   - List of recent notifications with read/unread state
   - Tap to navigate to relevant screen

Self-verify:
- Send a test notification to a real device
- Screenshot notification on device lock screen
- Screenshot notification inbox screen
- Screenshot notification preferences screen
- Verify notifications log correctly with structured logger

Branch: feature/launch-push-notifications
Commit: feat(launch): push notifications with FCM — 5 core types + preferences
```

```
PROMPT 30: Notification Tests
─────────────────────────────
Create tests for push notification system:
- Device token registration works (2 tests)
- Notification sent on match deadline (2 tests)
- Notification preferences respected (2 tests)
- Notification inbox displays correctly (2 tests)

Run all tests. Fix failures. Report.

Branch: test/launch-notifications-tests
Commit: test(launch): push notification E2E tests (8 cases)
```

---

## L4: TOURNAMENT MODE CORE (Weeks 20-21)

> **Season-long leagues make users come back every match day for 2 months.**
> Only implementing CORE tournament features. Trading, waivers, playoffs,
> commissioner tools are deferred to post-launch with Coming Soon screens.

### Step 14: Create Tournament Mode Core Issues

```
PROMPT 31: Create Tournament Mode Core GitHub Issues
───────────────────────────────────────────────────
Read /docs/NEW_PLAN.md Phase 4 sections 4.1, 4.2, 4.9, and 4.15 ONLY.

Create GitHub issues for LAUNCH-CRITICAL tournament features:
- Tournament League Creation & Joining (4.1)
- Per-Match Team Submission System (4.2)
- Chips / Power-Ups System (4.9)
- Weekly/Match Awards (4.15)

Do NOT create issues for: Advance Queue, Player Locking, Inter-Team
Trading, FAAB Waivers, Player Status, Playoffs, Commissioner Tools,
Captain Change, Opponent Visibility, Custom Tournaments, H2H Mode,
Geo-Verification for Paid Actions — these are post-launch.

Label: phase:4, priority:P0
Milestone: Create "L4: Tournament Mode Core" milestone

List all created issue numbers when done.
```

### Step 15: Season-Long Leagues + Team Submission

```
PROMPT 32: Season-Long League Core
─────────────────────────────────
Read /docs/NEW_PLAN.md Phase 4, sections 4.1 and 4.2.

Implement:
1. Create/join a season-long tournament league:
   - Link league to a tournament (IPL, World Cup)
   - Mode selection: salary_cap, draft, or auction
   - Choose template: Casual / Competitive / Pro
   - Get invite code to share

2. Per-match team submission:
   - Current squad carried from previous match
   - Make changes (counts as trades from free_trades allowance)
   - Select Captain / Vice-Captain
   - Submit before deadline
   - Auto-carry: if user doesn't modify, last team auto-submits

3. Points accumulation across full tournament:
   - Season standings with live rank updates
   - Match-by-match points breakdown
   - Total points leaderboard

Self-verify:
- Create a tournament league for IPL
- Submit a team for match 1
- Skip match 2 → verify auto-carry works
- Submit different team for match 3
- Verify cumulative points and standings
- Screenshot league creation flow
- Screenshot team submission screen
- Screenshot standings table

Branch: feature/launch-tournament-core
Commit: feat(launch): season-long tournament league core + per-match team submission
```

### Step 16: Chips + Awards

```
PROMPT 33: Chip System (Wildcard, Triple Captain, Bench Boost, etc.)
──────────────────────────────────────────────────────────────────
Read /docs/NEW_PLAN.md Phase 4 section 4.9 "Chips / Power-Ups System".

Implement:
1. Chip types: wildcard, triple_captain, bench_boost, free_hit,
   power_play, death_over_specialist
2. Chip usage limits from league config
3. Activate chip before team lock
4. Apply chip effects to scoring:
   - Triple Captain: 3x captain points
   - Bench Boost: bench players score too
   - Wildcard: unlimited transfers for one match
   - Free Hit: zero-cost transfer for one match
5. Track usage in chip_usage table
6. Show chips remaining in UI
7. Chip activation confirmation dialog

Self-verify:
- Activate Triple Captain → verify 3x points
- Activate Bench Boost → verify bench scores count
- Try to use same chip twice → verify blocked
- Screenshot chip selection UI
- Screenshot chip active indicator on team screen

Branch: feature/launch-chips
Commit: feat(launch): fantasy chip system with 6 chip types
```

```
PROMPT 34: Weekly/Match Awards
──────────────────────────────
Read /docs/NEW_PLAN.md Phase 4 section 4.15 "Weekly/Match Awards".

Implement:
1. Auto-calculated awards after each match completes:
   - Manager of the Match (highest fantasy points)
   - Best Captain Pick (highest captain points)
   - Biggest Differential (highest pts from <10% owned player)
   - Most Improved (biggest rank jump)
   - Orange Cap (running tournament top scorer)
   - Purple Cap (running tournament top wicket-taker)
2. Awards stored in league_awards table
3. Awards display on league detail screen (trophy room)
4. Push notification: "You won Manager of the Match!"

Self-verify:
- Simulate match completion → verify awards calculated
- Screenshot awards display on league detail
- Verify push notification sent for award
- Screenshot trophy room

Branch: feature/launch-awards
Commit: feat(launch): match awards system with 6 award types + notifications
```

### Step 17: Tournament Mode Tests

```
PROMPT 35: Tournament Mode Core Tests + Verification
───────────────────────────────────────────────────
Create tests + verify:
- Season-long league lifecycle (create → join → submit → score → standings) (5 tests)
- Auto-carry team works (2 tests)
- All 6 chips work correctly with scoring modifiers (6 tests)
- Awards auto-calculated after match (3 tests)
- Award notifications sent (2 tests)

Run full test suite. Fix failures. Report.

Branch: test/launch-tournament-tests
Commit: test(launch): tournament mode core E2E tests (18 cases)
```

---

## L5: PREDICTIONS + AWARDS (Week 22)

> **Low-friction daily engagement. Users who don't have time for a full team can still
> play predictions in 30 seconds.**

### Step 18: Prediction System

```
PROMPT 36: Prediction Leagues — 11 Question Types
────────────────────────────────────────────────
Read /docs/NEW_PLAN.md Phase 5 section 5.1 "Prediction Question Engine".

Implement the prediction system:

1. 11 prediction question types:
   - match_winner, victory_margin, top_scorer, top_wicket_taker,
     century_scored, first_innings_total, player_performance,
     sixes_count, custom_yes_no, custom_range, custom_multi_choice

2. AI-generated questions:
   - Before each match, Gemini generates 5-8 contextual prediction questions
   - Uses: pitch data, player form, historical matchups
   - Questions stored in prediction_questions table

3. User submission:
   - Card-based swipeable UI for answering predictions
   - Must submit before match start deadline
   - 2nd innings predictions available at innings break

4. Auto-grading:
   - When match completes, resolve all questions automatically
   - Points: base points per question type + exact prediction bonus
   - Store answers in prediction_answers table

5. Prediction leaderboard:
   - Cumulative points, accuracy %, current streak, best streak
   - Stored in prediction_standings table
   - Rank change indicators

Self-verify:
- Generate AI questions for an upcoming match → screenshot
- Submit predictions for all question types → screenshot
- Resolve a match → verify auto-grading works
- Screenshot prediction leaderboard with streaks
- Verify push notification: "You got 5/8 predictions right!"

Branch: feature/launch-predictions
Commit: feat(launch): prediction league system — 11 types + AI questions + leaderboard
```

### Step 19: Prediction Tests

```
PROMPT 37: Prediction System Tests
──────────────────────────────────
Create tests for predictions:
- AI generates questions for a match (2 tests)
- All 11 question types render correctly (3 tests)
- User can submit predictions before deadline (2 tests)
- Auto-grading resolves correctly (3 tests)
- Leaderboard ranks correctly (2 tests)
- Prediction streaks tracked (2 tests)

Run all tests. Fix failures. Report.

Branch: test/launch-prediction-tests
Commit: test(launch): prediction system E2E tests (14 cases)
```

---

## L6: COMING SOON SCREENS + LAUNCH PREP (Week 23)

> **Show users what's coming. Every deferred feature gets a beautiful "Coming Soon"
> screen so users know the app is growing and have a reason to come back for updates.**

### Step 20: Coming Soon Component + Screens

```
PROMPT 38: Coming Soon Component
───────────────────────────────
Create a reusable ComingSoon component using draftplay.ai design system
(see /docs/UI_GUIDE.md).

The component should:
1. Display the feature name as a heading
2. Show a brief 1-2 sentence description of what's coming
3. Display the EggLoadingSpinner (from @draftplay/ui) in a
   "hatching" state to symbolize the feature being built
4. Show a "Coming Soon" badge using draftplay.ai Badge component
5. Optional: "Notify Me" button that registers interest
   (store in a simple notify_interest table or analytics event)
6. Match the draftplay.ai design system aesthetic (DM Sans/DM Mono,
   retro-modern, clean layout)

Component API:
```tsx
<ComingSoon
  title="Player Comparison"
  description="Compare 2-4 players side-by-side with AI-powered insights and radar charts."
  icon="compare" // optional icon identifier
  notifyEnabled={true} // show "Notify Me" button
/>
```

Self-verify:
- Screenshot the component with different feature names
- Verify it uses draftplay.ai typography and colors
- Verify dark mode compatibility

Branch: feature/launch-coming-soon-component
Commit: feat(launch): reusable ComingSoon component with draftplay.ai design
```

```
PROMPT 39: Coming Soon Screens — Phase 3 Deferred Features
─────────────────────────────────────────────────────────
Create Coming Soon screens for all deferred Phase 3 features.
Use the ComingSoon component created in PROMPT 38.

Create the following screens/routes:

1. /compare → "Player Comparison Tool"
   Description: "Compare 2-4 players side-by-side with stats, form trends,
   AI verdicts, and radar charts. Find the best pick for any match."

2. /ownership → "Ownership Stats & Template Team"
   Description: "See what % of managers own each player. View the most
   popular team and find hidden differential picks."

3. /match/[id]/preview → "AI Match Previews"
   Description: "AI-generated pre-match analysis with pitch reports,
   key battles, fantasy tips, and predicted XIs. Published 12 hours
   before every match."

4. /planner → "Transfer Planner"
   Description: "Plan your transfers across the next 5-10 matches.
   AI suggests the optimal transfer path based on fixtures and projections."

Each screen should:
- Use the ComingSoon component
- Have proper navigation (back button, tab integration)
- Be accessible from the relevant navigation point (e.g., Guru tab)
- Include "Notify Me" button

Self-verify:
- Screenshot each Coming Soon screen
- Verify navigation to/from each screen works
- Verify all 4 screens render correctly

Branch: feature/launch-coming-soon-phase3
Commit: feat(launch): Coming Soon screens for deferred Phase 3 features
```

```
PROMPT 40: Coming Soon Screens — Phase 4 Deferred Features
─────────────────────────────────────────────────────────
Create Coming Soon screens for all deferred Phase 4 features.

1. /league/[id]/trades → "Inter-Team Trading"
   Description: "Propose player-for-player trades with league members.
   Accept, reject, or counter. Commissioner can veto unfair trades."

2. /league/[id]/waivers → "FAAB Waiver System"
   Description: "Blind-bid on unclaimed players using your Free Agent
   Acquisition Budget. Highest bid wins. Manage your budget wisely
   across the entire tournament."

3. /league/[id]/playoffs → "Playoff Brackets"
   Description: "IPL-style, semi-final, or custom playoff formats.
   Top teams battle head-to-head in knockout rounds to crown the champion."

4. /league/[id]/commissioner → "Commissioner Tools"
   Description: "Full league management dashboard. Assign points, grant
   trades, veto deals, send announcements, and manage members."

5. /custom-tournament → "Custom Tournament Builder"
   Description: "Cherry-pick matches from any tournament to create your
   own custom competition. Perfect for 'India matches only' or
   'T20s only' leagues."

6. /league/[id]/h2h → "Head-to-Head Mode"
   Description: "Face a different league member every match. Win = 3 pts,
   draw = 1 pt. Separate H2H standings alongside cumulative points."

Self-verify:
- Screenshot each Coming Soon screen
- Verify navigation works from league detail screen
- Verify all 6 screens render correctly

Branch: feature/launch-coming-soon-phase4
Commit: feat(launch): Coming Soon screens for deferred Phase 4 features
```

```
PROMPT 41: Coming Soon Screens — Phase 5-8 Deferred Features
───────────────────────────────────────────────────────────
Create Coming Soon screens for deferred social and future features.

1. /league/[id]/chat → "League Chat"
   Description: "Real-time league chat for banter, trash talk, and strategy
   discussion. Share player cards, react with emojis, and get system
   alerts for trades and awards."

2. /challenges → "1v1 Challenges"
   Description: "Challenge any player to a head-to-head match contest.
   Both set teams, match plays, winner takes bragging rights."

3. /referrals → "Invite Friends"
   Description: "Share your referral code with friends. Both of you earn
   bonus credits when they join. Track your invites and rewards."

4. /web → "DraftPlay Web" (accessible from Settings/More)
   Description: "Full DraftPlay experience on desktop. Larger charts,
   drag-and-drop transfers, and expanded analytics. Coming to web browsers."

5. /guru/voice → "Voice Commands"
   Description: "Talk to Guru with your voice. 'Captain Virat Kohli',
   'Add Bumrah to my team', 'Who should I pick?' — hands-free
   fantasy cricket management."

Self-verify:
- Screenshot each Coming Soon screen
- Verify navigation works
- Verify all 5 screens render correctly

Branch: feature/launch-coming-soon-social
Commit: feat(launch): Coming Soon screens for social + future features
```

### Step 21: Launch Prep + Final Polish

```
PROMPT 42: Launch Polish + Basic Security
────────────────────────────────────────
Prepare the app for beta launch:

1. Security basics:
   - Rate limiting on all public tRPC endpoints
   - Input validation on all user-submitted data
   - Verify no SQL injection or XSS vulnerabilities in new code
   - Ensure auth middleware covers all protected routes

2. Performance check:
   - Verify Redis cache is working across all AI features
   - Check API response times (target: <300ms cached, <3s uncached)
   - Verify EggLoadingSpinner shows for all async operations

3. Error handling:
   - All screens have error states with retry buttons
   - Network errors show user-friendly messages
   - AI feature failures fallback gracefully (show cached data or "try again")

4. App polish:
   - Verify all Coming Soon screens are accessible from navigation
   - Verify notification preferences screen works
   - Test full user journey: signup → build team → join league →
     submit team → see scores → check awards → ask Guru

Self-verify:
- Run full Playwright test suite: npx playwright test
- Take screenshots of key user journey moments
- Verify 0 P0 bugs remaining
- Save launch readiness report to /screenshots/launch-readiness.md

Branch: feature/launch-polish
Commit: feat(launch): launch polish — security, performance, error handling
```

```
PROMPT 43: Beta Launch Prep
─────────────────────────
1. App store preparation:
   - Take 6-8 app store screenshots (home, team builder, Guru chat,
     predictions, tournament league, Coming Soon teaser)
   - Write app description and keywords
   - Set up TestFlight (iOS) and Internal Testing (Android)

2. Beta invite system:
   - Create invite codes (limit: 500)
   - Invite code entry screen on first launch
   - Track invite code usage

3. Monitoring:
   - Set up error tracking (Sentry or similar)
   - Set up uptime monitoring
   - Create alerts for: API errors >1%, response time >5s,
     crash rate >0.5%

4. Landing page:
   - Simple "Join the Beta" page with email capture
   - Feature highlights: AI Guru, Projected Points, Season Leagues

Branch: feature/launch-beta-prep
Commit: feat(launch): beta launch preparation — store assets, invites, monitoring
```

### Step 22: Full Regression + Launch Signoff

```
PROMPT 44: Full Regression Test + Launch Signoff
───────────────────────────────────────────────
Run the COMPLETE test suite across ALL launch features.

npx playwright test

Generate a comprehensive report:
- Phase 2.75 tests: X passing
- AI Engine tests: X passing
- Notification tests: X passing
- Tournament Mode tests: X passing
- Prediction tests: X passing
- Total: X passing, X failing, X skipped

For each launch feature, verify:
- [ ] Auth flows work (signup, login, logout)
- [ ] Home screen shows real data
- [ ] AI projected points display on player cards
- [ ] FDR ratings show on fixture calendar
- [ ] Guru chat responds with relevant advice
- [ ] Rate My Team returns grade + suggestions
- [ ] Push notifications delivered for all 5 core types
- [ ] Tournament league can be created and joined
- [ ] Per-match team submission works
- [ ] Auto-carry works when user doesn't update team
- [ ] All 6 chips activate and affect scoring
- [ ] Match awards auto-calculated and notified
- [ ] All 11 prediction types work end-to-end
- [ ] All 15 Coming Soon screens accessible and rendering
- [ ] Geo-detection works (IP + GPS + declaration)
- [ ] Feature gates hide paid features in restricted zones

Save to /screenshots/launch-signoff.md

THIS IS THE GO/NO-GO FOR BETA LAUNCH. 🚀
```

---

## POST-LAUNCH PROMPTS (Run After Beta Launch, Based on User Demand)

> **These prompts implement the features shown as "Coming Soon" during launch.**
> **Run them in order of user demand — check analytics and feedback to prioritize.**

### Post-Launch Wave 1: Complete Phase 3 + Basic Social

```
PROMPT 45: Player Comparison Tool (Replaces Coming Soon)
───────────────────────────────────────────────────────
Read /docs/NEW_PLAN.md section 3.5 "Player Comparison Tool".

Implement the full feature and replace the Coming Soon screen at /compare:
1. Select 2-4 players to compare side-by-side
2. Stats comparison table (batting avg, strike rate, economy, etc.)
3. Projected points comparison for upcoming match
4. Form trend chart (last 5 matches)
5. Venue-specific stats
6. AI verdict: "Player A is the better pick because..."
7. Share comparison as image
8. Remove the ComingSoon component, wire up real UI

Branch: feature/post-launch-player-comparison
Commit: feat(post-launch): player comparison tool — replaces Coming Soon
```

```
PROMPT 46: Ownership Stats + Template Team (Replaces Coming Soon)
───────────────────────────────────────────────────────────────
Read /docs/NEW_PLAN.md section 3.6 "Ownership Stats & Template Team".

Replace Coming Soon at /ownership with full feature:
1. Ownership % per player across all user teams
2. Captain %, vice-captain % stats
3. Template team: AI-generated "most popular team" + "contrarian team"
4. Ownership bars on player selection screen
5. Transfer trends (rising/falling)

Branch: feature/post-launch-ownership
Commit: feat(post-launch): ownership stats + template team — replaces Coming Soon
```

```
PROMPT 47: AI Match Previews (Replaces Coming Soon)
──────────────────────────────────────────────────
Read /docs/NEW_PLAN.md section 3.7 "AI-Generated Match Previews".

Replace Coming Soon at /match/[id]/preview with full feature:
1. Gemini generates pre-match analysis for each match
2. Pitch report, weather, team news, key battles, fantasy tips
3. Auto-generate 6-12 hours before match start
4. "Key Fantasy Picks" section with player cards
5. Personalized section for users with teams

Branch: feature/post-launch-match-previews
Commit: feat(post-launch): AI match previews — replaces Coming Soon
```

```
PROMPT 48: Transfer Planner (Replaces Coming Soon)
─────────────────────────────────────────────────
Read /docs/NEW_PLAN.md section 3.8 "Transfer Planner".

Replace Coming Soon at /planner with full feature:
1. Upcoming fixtures for next 3-5 matches
2. AI transfer suggestions based on FDR + projections
3. Transfer impact analysis (points gained/lost estimate)
4. Wildcard timing recommendation
5. Multiple plan comparison

Branch: feature/post-launch-transfer-planner
Commit: feat(post-launch): transfer planner — replaces Coming Soon
```

```
PROMPT 49: League Chat (Replaces Coming Soon)
────────────────────────────────────────────
Read /docs/NEW_PLAN.md Phase 5 section 5.3 "League Chat".

Replace Coming Soon at /league/[id]/chat with full feature:
1. Firestore real-time messaging
2. @mentions, emoji reactions
3. System messages (trades, awards, scores)
4. Shareable player/team/match cards in chat
5. Commissioner pinned announcements

Branch: feature/post-launch-league-chat
Commit: feat(post-launch): league chat — replaces Coming Soon
```

### Post-Launch Wave 2: Advanced Tournament Features

```
PROMPT 50: Inter-Team Trading (Replaces Coming Soon)
──────────────────────────────────────────────────
Read /docs/NEW_PLAN.md Phase 4 sections 4.4, 4.5, 4.6.

Replace Coming Soon at /league/[id]/trades with full features:
1. Drop/Add trades with free trade tracking
2. Inter-team trade proposals (propose, accept, reject, counter)
3. Commissioner veto with 24h window
4. Player locks on dropped players
5. FAAB waiver system (blind bidding for free agents)
6. Trade board UI showing all pending/recent trades

Branch: feature/post-launch-trading
Commit: feat(post-launch): full trading system — replaces Coming Soon
```

```
PROMPT 51: Playoffs + Commissioner (Replaces Coming Soon)
───────────────────────────────────────────────────────
Read /docs/NEW_PLAN.md Phase 4 sections 4.8, 4.10.

Replace Coming Soon screens with full features:
1. Playoff bracket generation (IPL-style, semi-final, custom)
2. Bracket visualization UI
3. Commissioner dashboard with all management tools
4. Action logging in commissioner_actions table

Branch: feature/post-launch-playoffs-commissioner
Commit: feat(post-launch): playoffs + commissioner tools — replaces Coming Soon
```

```
PROMPT 52: H2H Mode + Custom Tournaments (Replaces Coming Soon)
─────────────────────────────────────────────────────────────
Read /docs/NEW_PLAN.md Phase 4 sections 4.13, 4.14.

Replace Coming Soon screens with full features:
1. H2H scheduling (round-robin) + result resolution
2. H2H standings table
3. Custom tournament builder (cherry-pick matches)
4. Match selection UI with filters

Branch: feature/post-launch-h2h-custom
Commit: feat(post-launch): H2H mode + custom tournaments — replaces Coming Soon
```

### Post-Launch Wave 3: Social + Growth + Scale

```
PROMPT 53: 1v1 Challenges + Referrals (Replaces Coming Soon)
──────────────────────────────────────────────────────────
Replace Coming Soon screens at /challenges and /referrals:
1. Challenge system: create, accept, resolve
2. Referral code generation + tracking
3. Referral reward distribution (bonus credits)
4. Deep linking for referral codes

Branch: feature/post-launch-challenges-referrals
Commit: feat(post-launch): 1v1 challenges + referral system — replaces Coming Soon
```

```
PROMPT 54: Geo-Verification for Paid Actions
───────────────────────────────────────────
Read /docs/GEO_IMPLEMENTATION_GUIDE.md section on verifyForPaidAction.

Implement when real-money features are enabled:
1. geo.verifyForPaidAction (GPS-required)
2. Integrate into contest join + wallet deposit flows
3. Periodic session re-check (30 min)
4. India KYC + TDS/GST if zone = india_real_money

Branch: feature/post-launch-geo-paid-actions
Commit: feat(post-launch): geo-verification for paid actions
```

```
PROMPT 55: Web App (Replaces Coming Soon)
────────────────────────────────────────
Read /docs/NEW_PLAN.md Phase 6.

Build web (Next.js) versions of all mobile screens:
- Responsive layouts for desktop/tablet
- Web-optimized tools (larger charts, drag-and-drop)
- SEO for public content
- Marketing landing pages

Branch: feature/post-launch-web
Commit: feat(post-launch): web app with full parity — replaces Coming Soon
```

```
PROMPT 56: Admin Dashboard
─────────────────────────
Read /docs/NEW_PLAN.md Phase 6 admin section.

Build admin dashboard (separate Next.js app):
- Tournament, user, league management
- Geo-compliance dashboard
- Financial reports
- System health monitoring

Branch: feature/post-launch-admin
Commit: feat(post-launch): admin dashboard
```

```
PROMPT 57: Voice Commands (Replaces Coming Soon — If User Demand)
───────────────────────────────────────────────────────────────
Read /docs/NEW_PLAN.md Phase 8 section 8.1.

Replace Coming Soon at /guru/voice:
- GCP Speech-to-Text for voice input
- Voice responses from Guru
- "Captain Virat Kohli", "Add Bumrah", "Show my team"

Branch: feature/post-launch-voice
Commit: feat(post-launch): voice commands for Guru — replaces Coming Soon
```

```
PROMPT 58: Performance + Security Hardening (Pre-Public Launch)
────────────────────────────────────────────────────────────
Before opening to public (beyond beta):
1. VPN detection heuristics
2. Full security audit
3. Load testing (1000+ concurrent rooms)
4. Database optimization
5. Redis cache tuning
6. PROGA ruling response (toggle flag based on Supreme Court)

Branch: feature/post-launch-hardening
Commit: feat(post-launch): security + performance hardening for public launch
```

---

## TOTAL PROMPT COUNT (Updated for Launch Roadmap)

| Launch Phase | Prompts | Focus | Tests |
|-------------|---------|-------|-------|
| **Setup** | 0A-0B | Labels + infrastructure | — |
| **L1: Finish 2.75** | 1-21 | Testing, bugs, polish | 65+ tests |
| **L2: AI Engine** | 22-28 | FDR, projections, Guru, Rate My Team | 16 tests |
| **L3: Push Notifications** | 29-30 | FCM, 5 core types, preferences | 8 tests |
| **L4: Tournament Mode** | 31-35 | Season leagues, chips, awards | 18 tests |
| **L5: Predictions** | 36-37 | 11 types, AI questions, leaderboard | 14 tests |
| **L6: Coming Soon + Launch** | 38-44 | 15 Coming Soon screens, polish, beta prep | Full regression |
| **Post-Launch Wave 1** | 45-49 | Comparison, ownership, previews, planner, chat | — |
| **Post-Launch Wave 2** | 50-52 | Trading, playoffs, commissioner, H2H | — |
| **Post-Launch Wave 3** | 53-58 | Challenges, referrals, geo-paid, web, admin, voice | — |
| **TOTAL** | **58 prompts** | | **120+ tests** |

### Launch Timeline

| Week | What | Prompts |
|------|------|---------|
| Weeks 14-15 | Finish Phase 2.75 testing + polish | 10-21 |
| Weeks 16-18 | AI Engine (FDR, projections, Guru, Rate My Team) | 22-28 |
| Week 19 | Push Notifications | 29-30 |
| Weeks 20-21 | Tournament Mode Core (leagues, chips, awards) | 31-35 |
| Week 22 | Predictions | 36-37 |
| Week 23 | Coming Soon screens + launch polish | 38-43 |
| **Week 24** | **Launch signoff + BETA LAUNCH** | **44** |

**Target Beta Launch:** May 12, 2026 (~9 weeks from March 3)
**Your active time per prompt:** ~10-20 minutes (review PR, check screenshots, merge).