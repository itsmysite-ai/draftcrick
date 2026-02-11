# DraftCrick — Claude Code Prompt Runbook

> **Every prompt you need to execute, in order, to build DraftCrick.**  
> Copy-paste each prompt into Claude Code. Review the output. Move to the next.  
> **Last Updated:** February 11, 2026

---

## Before You Start

**You do NOT need to run the explore command again** — you already ran it. But you DO need:

1. ✅ `CLAUDE.md` created in repo root (copy from the workflow doc)
2. ✅ `/docs/` folder with your plan docs (already done — visible in your screenshot)
3. ⬜ `/screenshots/` folder created: `mkdir screenshots`
4. ⬜ `.claude/commands/` folder created (optional but recommended)
5. ⬜ Playwright installed: `npx playwright install`

---

## How to Use This Runbook

- **Run prompts in order** — later prompts depend on earlier ones
- **Prompts marked 🔀 PARALLEL** can run simultaneously in separate terminal tabs
- **Review each PR** before moving to the next prompt
- **After merging**, start the next prompt
- **If a prompt fails**, tell Claude Code what went wrong and it'll fix it (Ralph Loop)
- You also uploaded a Telescribe logging doc — that's your reference architecture for structured logging. When you get to Phases 6-7, use it as a model for DraftCrick's own logging/tracing system.

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
PROMPT 2: Tournament Mode Schema — 19 Drizzle Tables
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

### Step 3: Home Screen Real Data (🔀 PARALLEL — Can Run Alongside Step 4)

```
PROMPT 4: Home Screen — Connect Real Data
─────────────────────────────────────────
Read /docs/NEW_PLAN.md section 1A "Home Screen — Real Data Integration".

Implement all 5 tasks:
1. Replace static data on the home screen with trpc.sports.dashboard.useQuery()
2. Add EggLoadingSpinner component while data is fetching
3. Add empty state message when no matches are available
4. Add user-friendly error handling when API fails (retry button)
5. Verify Redis cache hit/miss — add console.debug logs showing cache status

Use tami·draft design system components (see /docs/UI_GUIDE.md).

Self-verify:
- Run the app and take screenshots of: loading state, data loaded, 
  empty state, error state
- Save to /screenshots/home-loading.png, /screenshots/home-data.png,
  /screenshots/home-empty.png, /screenshots/home-error.png
- Check that the Redis cache is being hit (check logs for cache hit/miss)

Branch: feature/phase-2.75-home-real-data
Commit: feat(phase-2.75): connect home screen to real sports data API
```

### Step 4: Tournament Display (🔀 PARALLEL — Can Run Alongside Step 3)

```
PROMPT 5: Tournament Display & Filtering
────────────────────────────────────────
Read /docs/NEW_PLAN.md section 1B "Tournament Display & Filtering".

Implement all 5 tasks:
1. Create a TournamentCard component using tami·draft design system
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
PROMPT 6: Geo-Location — Server-Side (IP + Middleware)
─────────────────────────────────────────────────────
Read /docs/GEO_IMPLEMENTATION_GUIDE.md sections 3.1 (Layer 1: IP) 
and the middleware section.

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
PROMPT 7: Geo-Location — Client-Side (GPS + Declaration)
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
PROMPT 8: Geo Resolution Engine + Feature Gates
───────────────────────────────────────────────
Read /docs/GEO_IMPLEMENTATION_GUIDE.md sections 3.2 (Resolution Engine) 
and 3.3 (Feature Gates).

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
PROMPT 9: Gemini API Region Routing
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
PROMPT 10: Generate Auth Tests (7 test cases)
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
PROMPT 11: Generate Team Builder Tests (9 test cases)
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
PROMPT 12: Generate Contest + Draft + Auction Tests (20 test cases)
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
PROMPT 13: Generate Wallet + Live Scoring + Cache Tests (15 test cases)
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
PROMPT 14: Generate Geo-Location Tests (14 test cases)
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
PROMPT 16: Run Full Test Suite + Report
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
PROMPT 17: Fix P0 Bugs
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
PROMPT 18: Tournament Details Screen UI
──────────────────────────────────────
Read /docs/NEW_PLAN.md Week 3 task: "Create tournament details screen UI"
and /docs/UI_GUIDE.md for design system.

Create a polished tournament details screen at /tournament/[id].tsx:
- Tournament header (name, dates, format, teams)
- Tab navigation: Matches | Standings | Stats
- Matches tab: list of matches with scores, sorted by date
- Standings tab: team standings table (W/L/NRR/Points)
- Stats tab: top run scorers, top wicket takers, best economy

Use tami·draft design system components throughout.

Self-verify:
- Take screenshots of all 3 tabs
- Verify real data loads from API
- Check loading states work
- Check empty state for stats tab

Branch: feature/phase-2.75-tournament-details-ui
Commit: feat(phase-2.75): tournament details screen with tabs
```

```
PROMPT 19: Admin Toggle + Draft Eligibility
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
PROMPT 20: Screen Migrations (Match Center + Team Builder)
─────────────────────────────────────────────────────────
Read /docs/UI_GUIDE.md for design system patterns.

Migrate 2 screens to tami·draft design system:
1. Match Center screen — replace old components with tami·draft equivalents
2. Team Builder screen — replace old components with tami·draft equivalents

For each screen:
- Replace all old style objects with Tamagui tokens
- Use tami·draft components (TournamentCard, etc.)
- Ensure all text uses the design system typography
- Test dark mode compatibility

Self-verify:
- Take before/after screenshots of each screen
- /screenshots/match-center-before.png → /screenshots/match-center-after.png
- /screenshots/team-builder-before.png → /screenshots/team-builder-after.png
- Verify no visual regressions on other screens

Branch: feature/phase-2.75-screen-migrations
Commit: feat(phase-2.75): migrate Match Center + Team Builder to tami·draft
```

### Step 8: Phase 2.75 Sign-Off

```
PROMPT 21: Phase 2.75 Verification
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
- [ ] Match Center migrated to tami·draft
- [ ] Team Builder migrated to tami·draft
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

## PHASE 3: AI & ANALYTICS ENGINE (Weeks 15-19)

### Week 15-16: FDR + Projected Points

```
PROMPT 22: Create Phase 3 GitHub Issues
──────────────────────────────────────
Read /docs/NEW_PLAN.md Phase 3 section in full.

Create GitHub issues for ALL Phase 3 tasks organized by week:
- Week 15-16: FDR System + Projected Points Engine
- Week 17: Cricket Guru Chat + Rate My Team
- Week 18: Player Comparison + Ownership Stats
- Week 19: AI Match Previews + Transfer Planner

Label: phase:3, area:ai
Milestone: Create Phase 3 Week 15-16, 17, 18, 19 milestones

List all created issue numbers when done.
```

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

### Week 17: Guru + Rate My Team

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

Self-verify:
- Create a test team with known good/bad picks
- Verify the rating reflects the quality
- Screenshot the rating card with A+ team
- Screenshot the rating card with C- team (bad picks)
- Verify suggestions make sense

Branch: feature/phase-3-rate-my-team
Commit: feat(phase-3): Rate My Team with AI analysis
```

### Week 18: Comparison + Ownership

```
PROMPT 27: Player Comparison Tool
────────────────────────────────
Read /docs/NEW_PLAN.md section 3.5 "Player Comparison Tool".

Implement:
1. Select 2-4 players to compare side-by-side
2. Stats comparison table (batting avg, strike rate, economy, etc.)
3. Projected points comparison for upcoming match
4. Form trend chart (last 5 matches)
5. Venue-specific stats
6. AI verdict: "Player A is the better pick because..."
7. Share comparison as image (for social media)

Self-verify:
- Compare Virat Kohli vs Rohit Sharma → screenshot
- Compare 3 all-rounders → screenshot
- Verify AI verdict makes sense
- Test the share image generation

Branch: feature/phase-3-player-comparison
Commit: feat(phase-3): player comparison tool with AI verdicts
```

```
PROMPT 28: Ownership Stats + Template Team
─────────────────────────────────────────
Read /docs/NEW_PLAN.md section 3.6 "Ownership Stats & Template Team".

Implement:
1. Calculate ownership % per player across all user teams
2. Captain %, vice-captain % stats
3. Effective ownership calculation
4. Transfer trends (rising/falling)
5. Store in player_ownership table
6. Template team: AI-generated "most popular team" + "contrarian team"
7. UI showing ownership bars on player selection screen

Self-verify:
- Generate ownership stats for an active match
- Screenshot ownership bars on player list
- Screenshot template team suggestion
- Verify percentages add up correctly

Branch: feature/phase-3-ownership-stats
Commit: feat(phase-3): ownership stats + AI template teams
```

### Week 19: Match Previews + Transfer Planner

```
PROMPT 29: AI Match Previews
───────────────────────────
Read /docs/NEW_PLAN.md section 3.7 "AI-Generated Match Previews".

Implement:
1. Gemini generates a pre-match analysis article for each match
2. Includes: pitch report, weather, team news, key battles, 
   fantasy picks, captain picks, differential picks
3. Store in a match_previews table or cache
4. Generate automatically 6 hours before match start
5. Match preview screen with formatted article
6. "Key Fantasy Picks" section with player cards

Self-verify:
- Generate a preview for an upcoming match
- Screenshot the preview article
- Verify it includes all required sections
- Check that fantasy picks link to player cards

Branch: feature/phase-3-match-previews
Commit: feat(phase-3): AI-generated match preview articles
```

```
PROMPT 30: Transfer Planner
──────────────────────────
Read /docs/NEW_PLAN.md section 3.8 "Transfer Planner".

Implement:
1. Show upcoming fixtures for the next 3-5 matches
2. Suggest transfers based on FDR + projections
3. "Bank transfer" vs "Use now" recommendation
4. Transfer impact analysis: points gained/lost estimate
5. Wildcard planner: best week to play wildcard
6. UI with transfer suggestions and reasoning

Self-verify:
- Screenshot transfer suggestions for current GW
- Verify suggestions reference FDR and projections
- Test wildcard timing recommendation

Branch: feature/phase-3-transfer-planner
Commit: feat(phase-3): transfer planner with AI suggestions
```

```
PROMPT 31: Phase 3 Tests
───────────────────────
Read /docs/NEW_PLAN.md Phase 3 Success Criteria.

Create Playwright E2E tests for all Phase 3 features:
- FDR displays correctly (5 tests)
- Projections show on player cards (5 tests)
- Guru chat responds with relevant cricket advice (3 tests)
- Rate My Team returns reasonable scores (3 tests)
- Player comparison works for 2-4 players (3 tests)
- Ownership stats display correctly (3 tests)
- Match previews generate and display (3 tests)
- Transfer planner shows suggestions (3 tests)

Run all tests. Fix failures. Report results.

Branch: test/phase-3-tests
Commit: test(phase-3): comprehensive AI feature E2E tests (28 cases)
```

```
PROMPT 32: Phase 3 Verification
──────────────────────────────
Read /docs/NEW_PLAN.md Phase 3 Success Criteria.

Verify each criterion with proof:
- [ ] FDR generates 1-5 ratings for all fixtures
- [ ] Projected points calculated with confidence intervals
- [ ] Guru chat provides contextual fantasy cricket advice
- [ ] Rate My Team scores correlate with team quality
- [ ] Player comparison works for 2-4 players
- [ ] Ownership stats update and display correctly
- [ ] Match previews auto-generate before matches
- [ ] Transfer planner makes data-driven suggestions
- [ ] All AI features use region-routed Gemini API
- [ ] All AI responses cached in Redis

Save report to /screenshots/phase-3-signoff.md
```

---

## PHASE 4: TOURNAMENT MODE + LEAGUES (Weeks 20-24)

```
PROMPT 33: Create Phase 4 GitHub Issues
──────────────────────────────────────
Read /docs/NEW_PLAN.md Phase 4 section in full (it's the longest phase).

Create GitHub issues for all tasks:
- Week 20-21: Tournament Mode Core (season-long leagues, team 
  submissions, auto-carry, chip system)
- Week 22: Trading System (drop/add, inter-team, waivers, locks)
- Week 23: Playoffs + Commissioner (bracket generation, commissioner 
  tools, veto, announcements)
- Week 24: Advanced Leagues + Integration Testing + Geo-Verification 
  for Paid Actions

Label: phase:4
Create milestones for each week.
List all created issue numbers.
```

```
PROMPT 34: Season-Long League Core
─────────────────────────────────
Read /docs/NEW_PLAN.md Phase 4, Week 20-21 "Tournament Mode Core".

Implement:
1. Create/join a season-long tournament league
2. Link league to a tournament (IPL, World Cup)
3. Mode selection: salary_cap, draft, or auction
4. Per-match team submissions using tournament_team_submissions
5. Auto-carry team from previous match if not updated
6. Points accumulation across the full tournament
7. Season standings with live rank updates
8. Match-by-match points breakdown

Self-verify:
- Create a tournament league for IPL
- Submit a team for match 1
- Skip match 2 → verify auto-carry works
- Submit different team for match 3
- Verify cumulative points and standings

Branch: feature/phase-4-tournament-core
Commit: feat(phase-4): season-long tournament league core
```

```
PROMPT 35: Chip System (Wildcard, Triple Captain, Bench Boost, etc.)
──────────────────────────────────────────────────────────────────
Read /docs/NEW_PLAN.md Phase 4, chip system section.

Implement:
1. Chip types: wildcard, triple_captain, bench_boost, free_hit, 
   power_play, death_over_specialist
2. Chip usage limits from league config (chips_config JSONB)
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

Branch: feature/phase-4-chips
Commit: feat(phase-4): fantasy chip system with 6 chip types
```

```
PROMPT 36: Trading System
────────────────────────
Read /docs/NEW_PLAN.md Phase 4, Week 22 "Trading System".

Implement:
1. Drop/Add trades: drop a player, pick up another
2. Free trades vs penalty trades (from league config)
3. Inter-team trades: propose trade, accept/reject
4. Waiver claims: claim a dropped player with priority
5. Player locks: dropped players locked for N hours
6. Trade deadline enforcement
7. Trade history in tournament_trades table
8. Trade notifications

Self-verify:
- Execute a drop/add trade → verify it's logged
- Exceed free trades → verify penalty applied
- Propose inter-team trade → accept → verify swap
- Drop a player → verify lock period
- Try to trade after deadline → verify blocked

Branch: feature/phase-4-trading
Commit: feat(phase-4): trading system with drop/add, inter-team, waivers
```

```
PROMPT 37: Playoffs + Commissioner Tools
───────────────────────────────────────
Read /docs/NEW_PLAN.md Phase 4, Week 23.

Implement:
1. Playoff bracket generation (IPL-style, semi-final, custom)
2. Bracket visualization UI
3. Commissioner tools:
   - Assign bonus/penalty points
   - Grant extra trades
   - Edit a user's team (emergency)
   - Veto a trade
   - Kick/ban a user
   - Post league announcements
4. All actions logged in commissioner_actions table
5. Commissioner dashboard screen

Self-verify:
- Generate IPL-style playoff bracket
- Screenshot bracket visualization
- Use each commissioner tool → verify logged
- Screenshot commissioner dashboard

Branch: feature/phase-4-playoffs-commissioner
Commit: feat(phase-4): playoff brackets + commissioner tools
```

```
PROMPT 38: Geo-Verification for Paid Actions
───────────────────────────────────────────
Read /docs/GEO_IMPLEMENTATION_GUIDE.md section on verifyForPaidAction 
and /docs/NEW_PLAN.md Phase 4 geo-verification tasks.

Implement:
1. geo.verifyForPaidAction tRPC endpoint:
   - REQUIRES GPS coordinates (not just IP)
   - Blocks if zone doesn't allow paid actions
   - Returns error with explanation if blocked
   
2. Integrate into contest join flow:
   - Call verifyForPaidAction before any wallet deduction
   - Show location verification dialog
   
3. Integrate into wallet deposit flow:
   - Verify location before accepting deposit
   
4. Periodic re-check (every 30 minutes during active session)

5. India-specific:
   - KYC verification required for india_real_money zone
   - 30% TDS on winnings > ₹100
   - 28% GST on contest entry fees

Self-verify:
- Test paid contest join with US location → allowed
- Test paid contest join with India location (PROGA active) → blocked
- Test periodic re-check fires every 30 min
- Screenshot the location verification dialog
- Screenshot the "blocked" message for restricted zones

Branch: feature/phase-4-geo-paid-actions
Commit: feat(phase-4): geo-verification for all paid actions + KYC/TDS
```

```
PROMPT 39: Phase 4 Tests + Verification
──────────────────────────────────────
Read /docs/NEW_PLAN.md Phase 4 success criteria and testing section.

Create tests + verify:
- Season-long league lifecycle (create → submit → score → standings)
- All 6 chips work correctly
- Trading: drop/add, inter-team, waivers, locks
- Playoffs bracket generation + advancement
- Commissioner tools logged correctly
- Geo-verification blocks paid actions in restricted zones
- GPS required for paid actions

Run full test suite. Fix failures. Report.
Save signoff to /screenshots/phase-4-signoff.md
```

---

## PHASE 5: PREDICTIONS & SOCIAL (Weeks 25-28)

```
PROMPT 40: Create Phase 5 GitHub Issues
──────────────────────────────────────
Read /docs/NEW_PLAN.md Phase 5 in full.
Create all GitHub issues. Label: phase:5.
```

```
PROMPT 41: Prediction Leagues
───────────────────────────
Read /docs/NEW_PLAN.md Phase 5, prediction system.

Implement the 11 prediction types:
1. Match winner
2. Victory margin
3. Top scorer (match)
4. Top wicket taker
5. First ball dismissal
6. Total sixes
7. Highest opening partnership
8. Player of the match
9. Score in first 6 overs
10. Score in last 5 overs
11. Method of victory

Include:
- AI-generated prediction questions per match
- User submission before match start
- Auto-grading when match completes
- Prediction leaderboard per tournament
- Points: exact prediction bonus, close guess partial points

Branch: feature/phase-5-predictions
```

```
PROMPT 42: H2H Matchups
──────────────────────
Read /docs/NEW_PLAN.md Phase 5, H2H section.

Implement head-to-head system:
- Random pairings per match week
- 3 points for win, 1 for draw, 0 for loss
- H2H standings table
- Match result display (your score vs opponent score)
- Season-long H2H champion

Branch: feature/phase-5-h2h
```

```
PROMPT 43: Social Features (Chat + Notifications + Referrals)
───────────────────────────────────────────────────────────
Read /docs/NEW_PLAN.md Phase 5, social features.

Implement:
1. League chat (Firestore-backed)
2. Push notifications (FCM):
   - Match starting soon
   - Team lock deadline
   - Trade proposed
   - Match completed + points update
3. Referral system with bonus credits
4. Share team/results to social media

Branch: feature/phase-5-social
```

```
PROMPT 44: Phase 5 Tests + Verification
──────────────────────────────────────
Tests + signoff for Phase 5.
Save to /screenshots/phase-5-signoff.md
```

---

## PHASE 6: WEB, ADMIN & CORPORATE (Weeks 29-32)

```
PROMPT 45: Create Phase 6 GitHub Issues
──────────────────────────────────────
Read /docs/NEW_PLAN.md Phase 6 in full.
Create all GitHub issues. Label: phase:6.
```

```
PROMPT 46: Web Parity
───────────────────
Read /docs/NEW_PLAN.md Phase 6, web platform section.

Implement web (Next.js) versions of all mobile screens:
- Responsive layouts for desktop and tablet
- Same tRPC endpoints, different UI components
- SEO-optimized pages for public content (tournaments, previews)

Branch: feature/phase-6-web
```

```
PROMPT 47: Admin Dashboard
─────────────────────────
Read /docs/NEW_PLAN.md Phase 6, admin section.

Implement admin dashboard:
- User management (search, ban, view activity)
- Tournament management (create, toggle draft, edit)
- Contest management (approve, settle, cancel)
- Geo-compliance dashboard (location checks, mismatch alerts, 
  zone distribution, PROGA toggle, state ban list editor)
- Financial reports (deposits, withdrawals, GST/TDS collected)
- System health (API response times, cache hit rates)

Branch: feature/phase-6-admin
```

```
PROMPT 48: Phase 6 Tests + Verification
──────────────────────────────────────
Tests + signoff for Phase 6.
Save to /screenshots/phase-6-signoff.md
```

---

## PHASE 7: POLISH, TESTING & LAUNCH (Weeks 33-36)

```
PROMPT 49: Create Phase 7 GitHub Issues
──────────────────────────────────────
Read /docs/NEW_PLAN.md Phase 7 in full.
Create all GitHub issues. Label: phase:7.
```

```
PROMPT 50: Security + VPN Detection
──────────────────────────────────
Read /docs/NEW_PLAN.md Phase 7, security section and 
/docs/GEO_IMPLEMENTATION_GUIDE.md VPN detection section.

Implement:
1. VPN detection heuristics (IP/GPS mismatch, known VPN IPs, 
   datacenter IPs)
2. Security audit: SQL injection, XSS, CSRF, auth bypass
3. Rate limiting on all public endpoints
4. Input validation on all user-submitted data

Branch: feature/phase-7-security
```

```
PROMPT 51: Performance Optimization
──────────────────────────────────
Read /docs/NEW_PLAN.md Phase 7, performance section.

Implement:
1. Database query optimization (explain analyze slow queries)
2. Redis cache optimization (pre-warming, cascade invalidation)
3. Bundle size optimization (lazy loading, code splitting)
4. Image optimization (compression, lazy loading)
5. WebSocket connection pooling

Target: all API responses under 300ms (cached), under 1s (uncached)

Branch: feature/phase-7-performance
```

```
PROMPT 52: PROGA Ruling Response + Geo-Compliance Final
─────────────────────────────────────────────────────
Read /docs/GEO_IMPLEMENTATION_GUIDE.md sections on PROGA scenarios.

Prepare for all 3 PROGA outcomes:
1. PROGA upheld → verify india_free_only works correctly
2. PROGA struck down → test state-level ban list 
   (AP, TG, AS, OD blocked; others allowed)
3. PROGA modified → licensing pathway (placeholder)

Implement:
- Admin UI to toggle PROGA_ACTIVE flag
- Admin UI to edit state ban list
- Geo-compliance stress testing (zone transitions, edge cases)

Branch: feature/phase-7-proga-compliance
```

```
PROMPT 53: Beta Launch Prep
─────────────────────────
Read /docs/NEW_PLAN.md Phase 7, launch section.

1. Set up production Cloud Run deployment
2. Configure production Cloud SQL + Memorystore
3. Set up monitoring (error tracking, uptime checks)
4. Create production .env with all secrets
5. App store screenshots and metadata
6. Privacy policy and terms of service pages
7. Beta invite system (limited access codes)

Branch: feature/phase-7-launch-prep
```

```
PROMPT 54: Phase 7 Full Regression + Signoff
───────────────────────────────────────────
Run the COMPLETE test suite across all phases.

npx playwright test

Generate final report.
Fix any regressions.
Save to /screenshots/phase-7-launch-signoff.md

This is the go/no-go for beta launch.
```

---

## PHASE 8: VOICE, AI CONTENT & POST-LAUNCH (Post-Launch)

```
PROMPT 55: Create Phase 8 GitHub Issues
──────────────────────────────────────
Read /docs/NEW_PLAN.md Phase 8 in full.
Create all GitHub issues. Label: phase:8.
```

```
PROMPT 56: Voice Commands (if user demand)
─────────────────────────────────────────
Voice input for team management:
"Captain Virat Kohli", "Add Bumrah", "Show my team"
Using GCP Speech-to-Text.

Branch: feature/phase-8-voice
```

```
PROMPT 57: AI Newsletter + Dynamic Pricing
─────────────────────────────────────────
1. Weekly AI-generated newsletter per user (personalized picks, 
   transfer tips, league updates)
2. Dynamic player pricing based on ownership + performance
3. Cup mode (tournament-within-tournament)

Branch: feature/phase-8-ai-content
```

```
PROMPT 58: Geo-Infrastructure Scaling (If US Users > 10%)
───────────────────────────────────────────────────────
Read /docs/GEO_IMPLEMENTATION_GUIDE.md section 5 infrastructure scaling.

Only if needed:
1. Cross-region PostgreSQL read replica (us-central1)
2. Edge caching layer (Cloudflare Workers KV)
3. Cloud Run multi-region deployment
4. Gemini API auto-region detection

Branch: feature/phase-8-geo-scaling
```

---

## TOTAL PROMPT COUNT

| Phase | Prompts | Issues Created | Tests |
|-------|---------|---------------|-------|
| Setup | 0A-0B | Labels + milestones | — |
| 2.75 Week 1 | 1-9 | ~25 | — |
| 2.75 Week 2 | 10-16 | — | 65+ tests |
| 2.75 Week 3 | 17-21 | — | Bug fixes |
| 3 | 22-32 | ~30 | 28+ tests |
| 4 | 33-39 | ~35 | 20+ tests |
| 5 | 40-44 | ~20 | 15+ tests |
| 6 | 45-48 | ~15 | 10+ tests |
| 7 | 49-54 | ~15 | Full regression |
| 8 | 55-58 | ~10 | — |
| **TOTAL** | **58 prompts** | **~150 issues** | **140+ tests** |

**Estimated calendar time:** 6-8 months at 2-3 prompts/day with review.  
**Your active time per prompt:** ~10-20 minutes (review PR, check screenshots, merge).