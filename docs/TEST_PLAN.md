# DraftPlay Cricket E2E Test Plan

> **Scope:** Cricket only | **Method:** Playwright + Ralph Loop (screenshot QA) | **Pattern:** Hybrid (API seed + browser verify)

---

## Data Safety Rules

### NEVER touch (production/admin-seeded data)
- `test@test.com` account and all its associated data
- Tournaments imported via admin portal (IPL 2026, etc.)
- Players populated from admin portal
- Matches imported from admin portal
- Any data created through the admin web UI

### Test-created data (disposable, use unique emails)
- Test user accounts: `ravi-{timestamp}@draftplay.test`, `priya-{timestamp}@draftplay.test`
- Leagues created by test users
- Teams created by test users
- Contests created by test users
- Wallet deposits for test users

### Resettable simulation data (clean up after test run)
- `playerMatchScores` rows inserted for score simulation
- Match `phase` changes (reset back to original phase after tests)
- Contest `status` changes driven by match lifecycle simulation
- Settlement/prize distribution for test contests

### How tests use real data
- Tests READ real matches, tournaments, players — never modify them
- The active IPL match in draft mode is used as the fixture for team building, contests, drafts
- Player IDs from the real player pool are used for team creation
- Tournament IDs are read from the DB to create leagues

---

## Architecture

```
tests/
├── e2e/
│   ├── helpers/
│   │   ├── api-auth.ts          # Firebase emulator + tRPC helpers (KEEP)
│   │   ├── hybrid-seed.ts       # API seeding + browser login (KEEP)
│   │   ├── tamagui.ts           # Tamagui force-click helpers (KEEP)
│   │   ├── screenshot.ts        # Screenshot path utility (KEEP)
│   │   └── test-data.json       # Match/player IDs for active match (UPDATE)
│   └── cricket-story/           # NEW — single story-driven test suite
│       ├── 01-auth.spec.ts
│       ├── 02-onboarding.spec.ts
│       ├── 03-home-explore.spec.ts
│       ├── 04-league-create.spec.ts
│       ├── 05-league-join.spec.ts
│       ├── 06-team-builder.spec.ts
│       ├── 07-contest-lifecycle.spec.ts
│       ├── 08-draft-room.spec.ts
│       ├── 09-auction-room.spec.ts
│       ├── 10-match-live.spec.ts
│       ├── 11-scoring-engine.spec.ts
│       ├── 12-settlement.spec.ts
│       ├── 13-guru-ai.spec.ts
│       ├── 14-profile-settings.spec.ts
│       └── screenshots/
└── unit/
    └── scoring-math.test.ts     # NEW — pure scoring calculation tests
```

**Files to DELETE** (old scattered tests):
- `tests/e2e/admin/` (entire folder)
- `tests/e2e/auction/`
- `tests/e2e/auth/` (except `auth-helpers.ts` — move to helpers)
- `tests/e2e/cache/`
- `tests/e2e/contest/`
- `tests/e2e/draft/`
- `tests/e2e/functional/` (entire folder — replaced by cricket-story)
- `tests/e2e/geo/`
- `tests/e2e/league/`
- `tests/e2e/live/`
- `tests/e2e/navigation/`
- `tests/e2e/notifications/`
- `tests/e2e/onboarding/`
- `tests/e2e/sports/`
- `tests/e2e/team/`
- `tests/e2e/tournament/`
- `tests/e2e/wallet/`
- `tests/e2e/api/` (entire folder)
- `tests/unit/ai-engine.test.ts`
- `tests/unit/notifications.test.ts`
- `tests/unit/provider-chain.test.ts`
- `tests/unit/providers-integration.test.ts`
- `tests/unit/test-ralph-loop-ids.ts`

**Files to KEEP**:
- `tests/e2e/helpers/api-auth.ts`
- `tests/e2e/helpers/hybrid-seed.ts`
- `tests/e2e/helpers/tamagui.ts`
- `tests/e2e/helpers/screenshot.ts`
- `tests/e2e/helpers/test-data.json`
- `tests/e2e/helpers/auth-setup.ts`
- `tests/e2e/helpers/auth-login.ts`
- `tests/e2e/helpers/set-admin-role.ts`
- `tests/e2e/auth/auth-helpers.ts` (move to `tests/e2e/helpers/auth-helpers.ts`)
- `tests/unit/scoring.test.ts` (keep + expand)

---

## Prerequisites

```bash
# Terminal 1: Firebase Auth Emulator
npx firebase emulators:start --only auth --project demo-draftplay

# Terminal 2: API Server (with emulator tokens)
FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 pnpm --filter @draftplay/api dev

# Terminal 3: Expo Web
pnpm --filter @draftplay/mobile start --web

# Terminal 4: Run tests
pnpm test:e2e:cricket
```

---

## The Story

A new user discovers DraftPlay, signs up, sets up their cricket profile, creates a league with friends, builds teams, goes through a full draft, watches a live match, and checks their final scores. Every step is screenshot-verified via the Ralph Loop.

### Characters

| Character | Email | Role |
|-----------|-------|------|
| **Ravi** (protagonist) | `ravi-{ts}@draftplay.test` | League owner, team creator |
| **Priya** (friend) | `priya-{ts}@draftplay.test` | League member, draft opponent |
| **Ghost** (edge case) | `ghost-{ts}@draftplay.test` | Never completes onboarding |

---

## Chapter 1: Authentication (`01-auth.spec.ts`)

> Ravi discovers DraftPlay and creates an account

### Tests

| # | Test | Action | Screenshot | Assertions |
|---|------|--------|------------|------------|
| 1.1 | **Unauthenticated redirect** | Visit `/` with no session | `01-unauth-redirect.png` | URL contains `/auth/login` |
| 1.2 | **Login screen renders** | Visit `/auth/login` | `01-login-screen.png` | `email-input`, `password-input`, `submit-button` visible |
| 1.3 | **Register screen renders** | Visit `/auth/register` | `01-register-screen.png` | `username-input`, `email-input`, `password-input`, `age-confirm-checkbox`, `terms-accept-checkbox`, `submit-button` visible |
| 1.4 | **Weak password error** | Register with password "123" | `01-register-weak-pw.png` | `auth-error` visible, URL still `/auth/register` |
| 1.5 | **Duplicate email error** | Register with existing email | `01-register-dupe.png` | `auth-error` visible |
| 1.6 | **Checkboxes required** | Fill form but don't check boxes | `01-register-no-checkboxes.png` | Submit button disabled or error shown |
| 1.7 | **Ravi registers successfully** | Register with valid credentials + check both boxes | `01-register-success.png` | URL leaves `/auth/register`, redirects to onboarding or tabs |
| 1.8 | **Ravi logs out** | Clear session, visit `/` | `01-logout-redirect.png` | URL contains `/auth/login` |
| 1.9 | **Ravi logs back in** | Login with registered credentials | `01-login-success.png` | URL leaves `/auth/login` |
| 1.10 | **Wrong password error** | Login with wrong password | `01-login-wrong-pw.png` | `auth-error` visible |

### Ralph Loop Checkpoints
- [ ] All screenshots captured and visually correct
- [ ] Error messages are user-friendly (not raw Firebase errors)
- [ ] Login/register forms have proper input labels
- [ ] Password visibility toggle works
- [ ] No console errors in browser

---

## Chapter 2: Onboarding (`02-onboarding.spec.ts`)

> Ravi sets up his cricket profile and location

### Tests

| # | Test | Action | Screenshot | Assertions |
|---|------|--------|------------|------------|
| 2.1 | **Onboarding screen loads** | Navigate to `/auth/onboarding` | `02-onboarding-sport.png` | `onboarding-screen` visible, `sport-pill-cricket` visible |
| 2.2 | **Select cricket** | Click `sport-pill-cricket` | `02-sport-selected.png` | Cricket pill is highlighted/active |
| 2.3 | **Next → location step** | Click `onboarding-next-btn` | `02-location-step.png` | Country picker visible, `onboarding-age-checkbox` visible |
| 2.4 | **Select India + state** | Pick India → pick Maharashtra | `02-india-maharashtra.png` | State picker visible, Maharashtra selected |
| 2.5 | **Check compliance boxes** | Check age + terms checkboxes | `02-compliance-checked.png` | Both checkboxes checked, `onboarding-complete-btn` enabled |
| 2.6 | **Complete onboarding** | Click complete button | `02-onboarding-done.png` | Redirects to `/(tabs)`, home screen loads |
| 2.7 | **Ghost doesn't complete** | Register Ghost, visit `/`, don't complete onboarding | `02-ghost-blocked.png` | Ghost stays on onboarding, can't access tabs |
| 2.8 | **US user flow** | Create user, pick United States | `02-us-user.png` | No state picker required (only India requires state) |

### Ralph Loop Checkpoints
- [ ] Cricket sport pill has clear selected state
- [ ] Country pills scroll properly
- [ ] India state picker shows all 28 states + 8 UTs
- [ ] Checkboxes are clear and accessible
- [ ] Terms/Privacy links open correct legal screens

---

## Chapter 3: Home Screen Exploration (`03-home-explore.spec.ts`)

> Ravi explores the home screen, sees matches, navigates around

### Tests

| # | Test | Action | Screenshot | Assertions |
|---|------|--------|------------|------------|
| 3.1 | **Home screen loads** | Login as Ravi, navigate to tabs | `03-home-screen.png` | `home-screen` visible, DraftPlay logo in header |
| 3.2 | **Stats row shows 0s** | Check stats row | `03-stats-zero.png` | Shows 0 Teams, 0 Leagues, balance |
| 3.3 | **Progressive onboarding: create league CTA** | New user sees "How It Works" | `03-how-it-works.png` | `how-it-works-card` visible (since 0 teams & 0 leagues) |
| 3.4 | **Upcoming matches listed** | Check matches section | `03-upcoming-matches.png` | At least 1 match card visible with team names |
| 3.5 | **Featured match card** | Check featured match | `03-featured-match.png` | `featured-match-card` visible with CTA buttons |
| 3.6 | **Navigate to match detail** | Click on a match | `03-match-detail.png` | `match-detail-screen` visible, team names shown |
| 3.7 | **Match detail: FDR badges** | Check FDR on match detail | `03-match-fdr.png` | `fdr-badge-team-a` and/or `fdr-badge-team-b` visible |
| 3.8 | **Tab navigation works** | Click each tab | `03-tab-contests.png`, `03-tab-live.png`, `03-tab-social.png`, `03-tab-profile.png` | Each tab loads its screen |
| 3.9 | **Contests tab empty state** | Visit contests tab (no teams yet) | `03-contests-empty.png` | Empty state message or sign-in prompt |
| 3.10 | **Live tab** | Visit live tab | `03-live-tab.png` | `live-screen` visible, shows live matches or empty state |
| 3.11 | **Social tab empty** | Visit social/leagues tab | `03-social-empty.png` | Empty state with create/join league buttons |

### Ralph Loop Checkpoints
- [ ] Home screen doesn't crash with no data
- [ ] All 5 tabs render without errors
- [ ] Match cards show correct team names, venue, format
- [ ] Featured match CTA buttons work
- [ ] Quick action cards navigate correctly

---

## Chapter 4: League Creation (`04-league-create.spec.ts`)

> Ravi creates three different leagues to test all formats

### Tests

| # | Test | Action | Screenshot | Assertions |
|---|------|--------|------------|------------|
| 4.1 | **Navigate to create league** | Click create league from social tab | `04-create-league-screen.png` | `create-league-screen` visible, `league-name-input` visible |
| 4.2 | **AI name suggestion** | Click `suggest-name-btn` | `04-name-suggestion.png` | League name input gets populated |
| 4.3 | **Create DRAFT league** | Fill name "Ravi's Draft XI", format=draft, tournament=IPL 2026 | `04-draft-league-created.png` | Redirects to league detail, `league-detail-screen` visible |
| 4.4 | **League detail shows invite code** | Check league detail | `04-invite-code.png` | `league-invite-code` visible, code is non-empty |
| 4.5 | **Create AUCTION league** | Create second league with format=auction | `04-auction-league.png` | League created, different ID |
| 4.6 | **Create SALARY CAP league** | Create third league with format=salary_cap | `04-salary-league.png` | League created |
| 4.7 | **Social tab shows 3 leagues** | Navigate to social tab | `04-social-3-leagues.png` | 3 league cards visible |
| 4.8 | **Home stats updated** | Check home screen stats row | `04-home-stats.png` | Shows "3 Leagues" |
| 4.9 | **League shows correct format badge** | Check each league card | `04-format-badges.png` | DRAFT, AUCTION, SALARY CAP badges on respective cards |

### Ralph Loop Checkpoints
- [ ] League name input accepts special characters
- [ ] Tournament picker shows IPL 2026
- [ ] Format selector clearly shows all 4 options
- [ ] Invite code is copyable
- [ ] Max members defaults are sensible

---

## Chapter 5: League Join (`05-league-join.spec.ts`)

> Priya joins Ravi's draft league using the invite code

### Tests

| # | Test | Action | Screenshot | Assertions |
|---|------|--------|------------|------------|
| 5.1 | **Priya registers** | API: create Priya account + sync | — | Token obtained |
| 5.2 | **Priya completes onboarding** | API: save preferences (cricket, India) | — | Preferences saved |
| 5.3 | **Priya joins via invite code** | API: `league.join` with Ravi's invite code | — | 200 response |
| 5.4 | **League shows 2 members** | Browser: Ravi views league detail | `05-2-members.png` | 2 member cards visible |
| 5.5 | **Priya sees league in social tab** | Browser: Priya logs in, checks social tab | `05-priya-social.png` | League card visible with "member" role badge |
| 5.6 | **Invalid invite code error** | API: try joining with "INVALID123" | — | Error response (NOT_FOUND or BAD_REQUEST) |
| 5.7 | **Duplicate join error** | API: Priya tries joining same league again | — | Error response (CONFLICT or similar) |

### Ralph Loop Checkpoints
- [ ] Member list shows both Ravi (owner) and Priya (member)
- [ ] Role badges are correct (owner vs member)
- [ ] Invite code works exactly once per user

---

## Chapter 6: Team Builder (`06-team-builder.spec.ts`)

> Ravi and Priya build teams for the active match using salary cap

### Setup: Use the active IPL match that has draft mode enabled and players populated.

### Tests

| # | Test | Action | Screenshot | Assertions |
|---|------|--------|------------|------------|
| 6.1 | **Navigate to team builder** | From match detail, click "Create Team" | `06-team-builder.png` | `team-builder-screen` visible |
| 6.2 | **Budget starts at 100** | Check budget display | `06-budget-100.png` | Budget shows 100.0 credits |
| 6.3 | **Player list loads** | Check available players | `06-players-loaded.png` | Players listed with role, team, credits |
| 6.4 | **Role filter tabs work** | Click WK, BAT, AR, BOWL tabs | `06-role-filter-wk.png`, `06-role-filter-bat.png` | Player list filters correctly |
| 6.5 | **Select 11 players** | Pick: 1 WK, 4 BAT, 2 AR, 4 BOWL | `06-11-selected.png` | 11/11 shown, budget ≤ 100 |
| 6.6 | **Max per team enforced** | Try picking 8th player from same team | `06-max-team-error.png` | Error or disabled state after 7 from same team |
| 6.7 | **Overseas limit enforced** | Try picking 5th overseas player | `06-overseas-limit.png` | Error or disabled state after 4 overseas |
| 6.8 | **Continue to captain selection** | Click `team-continue-btn` | `06-captain-select.png` | Captain/VC selection screen visible |
| 6.9 | **Select captain (2x)** | Pick captain | `06-captain-picked.png` | Captain badge visible, 2x multiplier shown |
| 6.10 | **Select vice-captain (1.5x)** | Pick vice-captain | `06-vc-picked.png` | VC badge visible, 1.5x multiplier shown |
| 6.11 | **Team name auto-generated** | Check team name field | `06-team-name.png` | Non-empty themed team name |
| 6.12 | **Create team (Ravi)** | Click `create-team-btn` | `06-team-created.png` | Success, redirected to team/contest detail |
| 6.13 | **Create team (Priya via API)** | API: `team.create` with valid 11 | — | 200 response, team ID |
| 6.14 | **Invalid team: 10 players** | API: try creating team with 10 players | — | BAD_REQUEST error |
| 6.15 | **Invalid team: no WK** | API: try team with 0 wicket-keepers | — | BAD_REQUEST error |
| 6.16 | **Invalid team: over budget** | API: try team costing 105 credits | — | BAD_REQUEST error |
| 6.17 | **Team detail screen** | Navigate to created team | `06-team-detail.png` | `team-detail-screen` visible, 11 players listed by role |

### Ralph Loop Checkpoints
- [ ] Budget decreases as players are selected
- [ ] Player credit costs are visible and accurate (7.0-10.0 range)
- [ ] Role counters update in real-time (e.g., "BAT 2/6")
- [ ] Captain/VC selection is mutually exclusive
- [ ] Team name is creative and cricket-themed

---

## Chapter 7: Contest Lifecycle (`07-contest-lifecycle.spec.ts`)

> Ravi creates a contest, Priya joins, wallet balances update

### Tests

| # | Test | Action | Screenshot | Assertions |
|---|------|--------|------------|------------|
| 7.1 | **Fund wallets** | API: deposit 1000 for both users | — | Balance ≥ 1000 |
| 7.2 | **Create contest** | API: `contest.create` for active match, entry=50, max=100 | — | Contest ID returned |
| 7.3 | **Contest detail screen** | Browser: Ravi navigates to contest | `07-contest-detail.png` | `contest-detail-screen`, `contest-status-badge` shows "open" |
| 7.4 | **Prize pool correct** | Check prize pool display | `07-prize-pool.png` | Shows expected prize amount |
| 7.5 | **Ravi joins contest** | API: join with Ravi's team | — | 200 response |
| 7.6 | **Wallet deducted 50** | API: check Ravi's balance | — | Balance = 950 |
| 7.7 | **Spots: 1/100** | Browser: check spots display | `07-spots-1.png` | "1/100" visible |
| 7.8 | **Priya joins contest** | API: join with Priya's team | — | 200 response, Priya balance = 950 |
| 7.9 | **Spots: 2/100** | Browser: refresh contest | `07-spots-2.png` | "2/100" visible |
| 7.10 | **Leaderboard shows 2 entries** | Check leaderboard section | `07-leaderboard-2.png` | 2 entries visible |
| 7.11 | **Contests tab shows contest** | Navigate to Contests tab, filter "open" | `07-contests-tab.png` | Contest card visible with match info |
| 7.12 | **Share/challenge button** | Check share options on contest detail | `07-share-btn.png` | `share-challenge-btn` or `copy-link-btn` visible |

### Ralph Loop Checkpoints
- [ ] Entry fee is clearly shown before joining
- [ ] Wallet deduction happens atomically
- [ ] Prize distribution breakdown is visible
- [ ] Leaderboard updates in real-time after join
- [ ] Contest card on Contests tab shows match name + status

---

## Chapter 8: Draft Room (`08-draft-room.spec.ts`)

> Ravi and Priya do a full snake draft in the draft league

### Tests

| # | Test | Action | Screenshot | Assertions |
|---|------|--------|------------|------------|
| 8.1 | **Setup draft league with 2 members** | API: create league + Priya joins | — | League with 2 members |
| 8.2 | **Start draft from league** | API: `league.startDraft` (snake_draft) | — | Room ID returned |
| 8.3 | **Draft room renders (waiting)** | Browser: Ravi navigates to `/draft/{roomId}` | `08-draft-waiting.png` | `draft-room-screen` visible, `draft-turn-status` shows "waiting" |
| 8.4 | **Start draft (owner)** | Browser: Ravi clicks `draft-start-btn` | `08-draft-started.png` | Round info shows "Round 1", turn status updates |
| 8.5 | **Available players listed** | Check player list in draft room | `08-available-players.png` | `draft-available-count` shows player count |
| 8.6 | **Countdown timer visible** | Check timer during active turn | `08-countdown.png` | `draft-countdown` visible with seconds |
| 8.7 | **Ravi makes pick (Round 1, Pick 1)** | API: `draft.makePick` (top batsman) | `08-pick-1.png` | Pick log shows entry with player name |
| 8.8 | **Turn switches to Priya** | Check turn status | `08-turn-priya.png` | Turn status shows "waiting for pick" |
| 8.9 | **Priya makes pick (Round 1, Pick 2)** | API: `draft.makePick` | — | Pick successful |
| 8.10 | **Snake draft: Round 2 reverses order** | Drive picks to Round 2 | `08-round-2.png` | Priya picks first in Round 2 (snake reversal) |
| 8.11 | **Role filter in draft** | Click BAT/BOWL/AR/WK filters | `08-draft-filter-bowl.png` | Player list filters by role |
| 8.12 | **Drive 22 picks (11 per team)** | API: alternate picks for full draft | — | All 22 picks made |
| 8.13 | **Draft completes** | Check draft state | `08-draft-complete.png` | Status shows "completed" |
| 8.14 | **Pick log shows all picks** | Check pick log | `08-full-pick-log.png` | 22 entries with player names + drafter names |
| 8.15 | **Picks counter: 22/22** | Check picks counter | — | `draft-picks-counter` shows "22/22" |

### Ralph Loop Checkpoints
- [ ] Snake draft order is correct (R1: A→B, R2: B→A, R3: A→B...)
- [ ] Pick timer counts down properly
- [ ] Picked players disappear from available list
- [ ] Pick log scrolls and shows chronological history
- [ ] Role filters correctly limit options during draft

---

## Chapter 9: Auction Room (`09-auction-room.spec.ts`)

> Ravi and Priya do a full auction in the auction league

### Tests

| # | Test | Action | Screenshot | Assertions |
|---|------|--------|------------|------------|
| 9.1 | **Setup auction league** | API: create auction league + Priya joins | — | League with 2 members |
| 9.2 | **Start auction** | API: `league.startDraft` (auction type) | — | Room ID returned |
| 9.3 | **Auction room renders** | Browser: navigate to `/auction/{roomId}` | `09-auction-room.png` | `auction-room-screen` visible |
| 9.4 | **Budget shows 100** | Check budget display | `09-budget-100.png` | `auction-my-budget` shows 100 |
| 9.5 | **First player nominated** | Check current player | `09-first-player.png` | `auction-current-player` visible with name |
| 9.6 | **Bid buttons work** | Click `auction-bid-next` | `09-bid-placed.png` | `auction-highest-bid` updates |
| 9.7 | **Counter-bid** | Other user places higher bid via API | `09-counter-bid.png` | Highest bid updates |
| 9.8 | **Player sold** | Let timer expire after bid | `09-player-sold.png` | `auction-sold-count` increments |
| 9.9 | **Budget decreases** | Check buyer's budget | `09-budget-decreased.png` | Budget reduced by winning bid |
| 9.10 | **Sold players list** | Check sold list tab | `09-sold-list.png` | `auction-sold-list` shows sold player |
| 9.11 | **Run full auction** | API: drive all nominations + bids | `09-auction-complete.png` | Auction completes, both teams filled |

### Ralph Loop Checkpoints
- [ ] Bid increments are correct (+1, +2, +5 buttons)
- [ ] Budget constraint prevents overbidding
- [ ] Countdown timer works for bids
- [ ] Sold player transitions to sold list
- [ ] Nomination prompt appears correctly

---

## Chapter 10: Match Simulation — Live Phases (`10-match-live.spec.ts`)

> Simulate match progression: pre_match → live → post_match → completed

### Setup: Use the active match with draft mode. Drive state transitions via API or direct DB updates.

### Tests

| # | Test | Action | Screenshot | Assertions |
|---|------|--------|------------|------------|
| 10.1 | **Pre-match state** | Set match phase to `pre_match` | `10-pre-match.png` | Match shows as upcoming, draft enabled |
| 10.2 | **Lock contests on live** | Trigger `live` phase transition | — | All contests for this match status → "locked" |
| 10.3 | **Live match screen** | Browser: check Live tab | `10-live-screen.png` | Match card visible on live tab with score info |
| 10.4 | **Match detail during live** | Navigate to match detail | `10-match-live-detail.png` | Status shows "LIVE", team scores visible |
| 10.5 | **Contest locked badge** | Check contest detail | `10-contest-locked.png` | Status badge shows "locked" or "live" |
| 10.6 | **Simulate innings 1 scores** | Insert playerMatchScores for batting team | — | Scores inserted in DB |
| 10.7 | **Simulate innings 2 scores** | Insert playerMatchScores for bowling team | — | Scores inserted |
| 10.8 | **Fantasy points calculated** | Check player fantasy points | — | Points match scoring rules |
| 10.9 | **Post-match transition** | Trigger `post_match` phase | — | Contests → "settling" |
| 10.10 | **Match completed** | Trigger `completed` phase | `10-match-completed.png` | Match shows result |

### Ralph Loop Checkpoints
- [ ] Phase transitions happen atomically
- [ ] Contest locking prevents new joins
- [ ] Live scores update on screen
- [ ] No data loss during transitions

---

## Chapter 11: Scoring Engine (`11-scoring-engine.spec.ts`)

> Unit-style tests run via API/DB to verify every scoring rule

### Cricket Scoring Rules to Test

#### Batting Points

| Rule | Input | Expected Points |
|------|-------|----------------|
| Runs | 45 runs | 45 pts |
| Boundary bonus | 6 fours | +6 pts |
| Six bonus | 3 sixes | +6 pts |
| Half-century | 50 runs | +20 bonus |
| Century | 100 runs | +50 bonus |
| Duck | 0 runs (batsman, played ≥1 ball) | -5 pts |
| **Batting total** | 73 runs, 8 fours, 2 sixes, 50+ bonus | 73 + 8 + 4 + 20 = **105 pts** |

#### Bowling Points

| Rule | Input | Expected Points |
|------|-------|----------------|
| Wicket | 3 wickets | 75 pts (25 each) |
| Maiden | 2 maidens | 30 pts (15 each) |
| 3-wicket bonus | 3 wickets | +15 pts |
| 4-wicket bonus | 4 wickets | +25 pts |
| 5-wicket haul | 5 wickets | +30 pts |
| **Bowling total** | 4 wickets, 1 maiden, 4-wkt bonus | 100 + 15 + 25 = **140 pts** |

#### Fielding Points

| Rule | Input | Expected Points |
|------|-------|----------------|
| Catch | 2 catches | 20 pts (10 each) |
| Stumping | 1 stumping | 15 pts |
| Direct run-out | 1 direct run out | 15 pts |
| Indirect run-out | 1 indirect run out | 10 pts |

#### Multipliers

| Rule | Input | Expected |
|------|-------|----------|
| Captain (2x) | Player scores 50 pts, is captain | 100 pts |
| Vice-captain (1.5x) | Player scores 50 pts, is VC | 75 pts |
| Non-captain | Player scores 50 pts, normal | 50 pts |

### Tests

| # | Test | Method | Assertions |
|---|------|--------|------------|
| 11.1 | **Batting: runs only** | Insert: 30 runs, 0 fours, 0 sixes | fantasyPoints = 30 |
| 11.2 | **Batting: with boundaries** | Insert: 45 runs, 6 fours, 2 sixes | 45 + 6 + 4 = 55 |
| 11.3 | **Batting: half-century bonus** | Insert: 50 runs, 5 fours, 1 six | 50 + 5 + 2 + 20 = 77 |
| 11.4 | **Batting: century bonus** | Insert: 100 runs, 12 fours, 4 sixes | 100 + 12 + 8 + 50 = 170 |
| 11.5 | **Batting: duck penalty** | Insert: 0 runs, faced 5 balls | -5 |
| 11.6 | **Bowling: basic wickets** | Insert: 2 wickets | 50 |
| 11.7 | **Bowling: 3-wicket bonus** | Insert: 3 wickets | 75 + 15 = 90 |
| 11.8 | **Bowling: 4-wicket bonus** | Insert: 4 wickets | 100 + 25 = 125 |
| 11.9 | **Bowling: 5-wicket haul** | Insert: 5 wickets | 125 + 30 = 155 |
| 11.10 | **Bowling: maidens** | Insert: 0 wickets, 3 maidens | 45 |
| 11.11 | **Fielding: catches** | Insert: 3 catches | 30 |
| 11.12 | **Fielding: stumpings** | Insert: 2 stumpings | 30 |
| 11.13 | **Fielding: run-outs (direct)** | Insert: 1 direct run-out | 15 |
| 11.14 | **Fielding: run-outs (indirect)** | Insert: 1 indirect run-out | 10 |
| 11.15 | **All-rounder combo** | 30 runs + 2 wickets + 1 catch | 30 + 50 + 10 = 90 |
| 11.16 | **Captain 2x multiplier** | 50 base pts, is captain | 100 |
| 11.17 | **Vice-captain 1.5x** | 50 base pts, is VC | 75 |
| 11.18 | **Player of match bonus** | 60 base pts + POTM | 60 + 25 = 85 |
| 11.19 | **Full innings simulation** | Top batsman: 82(51), 9×4, 3×6, captain | Calculate full score |
| 11.20 | **Full innings simulation** | Top bowler: 4-0-28-3, 1 maiden, VC | Calculate full score |

### Test Technique
```typescript
// Each test inserts a playerMatchScore row, triggers point calculation,
// and asserts the resulting fantasyPoints match the expected value.
// Uses the SCORING_RULES from rule-engine.ts for expected values.
```

### Ralph Loop Checkpoints
- [ ] Every scoring rule produces correct points
- [ ] Multipliers applied after base calculation, not before
- [ ] Bonus thresholds (50/100 runs, 3/4/5 wickets) trigger correctly
- [ ] Duck penalty only applies to batsmen/all-rounders who faced balls
- [ ] Points are never negative (except duck which can make total negative)

---

## Chapter 12: Settlement (`12-settlement.spec.ts`)

> After match completion, verify contest ranking + prize distribution

### Tests

| # | Test | Action | Screenshot | Assertions |
|---|------|--------|------------|------------|
| 12.1 | **Contests transition to settling** | Trigger post_match | — | Contest status = "settling" |
| 12.2 | **Team points aggregated** | Check each team's totalPoints | — | Sum of player fantasy points (with captain/VC multipliers) |
| 12.3 | **Teams ranked by points** | Check ranking order | — | Higher points = lower rank number |
| 12.4 | **Tied teams: same rank** | If two teams have same points | — | Both get same rank |
| 12.5 | **Prize distributed to winner** | Check wallet balance of rank 1 | — | Balance increased by 1st place prize |
| 12.6 | **Runner-up prize** | Check rank 2 prize | — | Correct prize amount |
| 12.7 | **Contest settled** | Status → "settled" | `12-contest-settled.png` | `contest-status-badge` shows "settled" |
| 12.8 | **Leaderboard final** | Browser: check contest leaderboard | `12-final-leaderboard.png` | Shows final ranks + points + prize amounts |
| 12.9 | **User result card** | Check user's own result | `12-user-result.png` | `user-result-card` shows rank, points, prize |
| 12.10 | **Wallet transaction: prize** | Check wallet for prize transaction | `12-wallet-prize.png` | Transaction history shows prize credit |
| 12.11 | **Contests tab: settled filter** | Filter by "settled" | `12-contests-settled.png` | Contest appears under settled filter |

### Ralph Loop Checkpoints
- [ ] Prize math is exact (no rounding errors lose/gain money)
- [ ] All prize money distributed equals total pool
- [ ] Settled contests are read-only (no more joins/swaps)
- [ ] Wallet balance is atomically consistent

---

## Chapter 13: Guru AI (`13-guru-ai.spec.ts`)

> Ravi asks the AI guru for cricket advice

### Tests

| # | Test | Action | Screenshot | Assertions |
|---|------|--------|------------|------------|
| 13.1 | **Guru screen loads** | Navigate to `/guru` | `13-guru-screen.png` | `guru-input` and `guru-send-btn` visible |
| 13.2 | **Suggestion pills shown** | Check suggestion pills | `13-suggestions.png` | At least 1 `suggestion-*` pill visible |
| 13.3 | **Send a message** | Type "Who should I captain for the IPL match?" and send | `13-guru-response.png` | Response appears in `guru-messages` |
| 13.4 | **Click suggestion pill** | Click a suggestion pill | `13-suggestion-click.png` | Message sent, response received |

### Ralph Loop Checkpoints
- [ ] Guru responds within 10 seconds
- [ ] Response is cricket-relevant
- [ ] Chat history persists during session
- [ ] Send button disabled while AI is responding

---

## Chapter 14: Profile & Settings (`14-profile-settings.spec.ts`)

> Ravi checks profile, changes settings, and manages account

### Tests

| # | Test | Action | Screenshot | Assertions |
|---|------|--------|------------|------------|
| 14.1 | **Profile screen loads** | Navigate to Profile tab | `14-profile.png` | `profile-screen` visible, `profile-username` shows Ravi's name |
| 14.2 | **Theme toggle** | Toggle dark/light mode | `14-dark-mode.png`, `14-light-mode.png` | Theme changes visually |
| 14.3 | **Subscription tier visible** | Check subscription card | `14-subscription.png` | `subscription-card` visible, shows current tier |
| 14.4 | **Sports settings** | Navigate to sports settings | `14-sports-settings.png` | `sports-settings-screen` visible, cricket selected |
| 14.5 | **Location settings** | Navigate to location settings | `14-location-settings.png` | `location-settings-screen` visible, India/Maharashtra shown |
| 14.6 | **Sign out works** | Click `sign-out-btn` | `14-signed-out.png` | Redirected to `/auth/login` |

### Ralph Loop Checkpoints
- [ ] Theme persists across app restart
- [ ] Profile shows correct user info
- [ ] Settings changes save properly
- [ ] Sign out clears all auth state

---

## Credits Engine Tests (in `scoring-math.test.ts`)

### Credit Calculation (7.0 - 10.0 range)

| # | Test | Player Profile | Expected Range |
|---|------|---------------|---------------|
| C.1 | **Top batsman** | Avg 55, SR 150, 100 matches | 9.5 - 10.0 |
| C.2 | **Average batsman** | Avg 30, SR 120, 30 matches | 7.5 - 8.5 |
| C.3 | **Rookie batsman** | Avg 20, SR 100, 5 matches | 7.0 - 7.5 |
| C.4 | **Top bowler** | Bowl avg 18, Econ 6.5, 80 matches | 9.0 - 10.0 |
| C.5 | **Average bowler** | Bowl avg 30, Econ 8.5, 25 matches | 7.5 - 8.5 |
| C.6 | **Elite all-rounder** | Bat avg 40, Bowl avg 25, 60 matches | 9.0 - 10.0 |
| C.7 | **Injured player (doubtful)** | Top stats, injury=doubtful | 0.85x of healthy credit |
| C.8 | **Injured player (injured)** | Top stats, injury=injured | 0.70x of healthy credit |

---

## Team Solver Tests (in `scoring-math.test.ts`)

| # | Test | Preferences | Assertions |
|---|------|------------|------------|
| S.1 | **Balanced team** | playStyle=balanced | Mix of all roles, budget ~95-100 |
| S.2 | **Batting heavy** | playStyle=batting_heavy | ≥5 batsmen, batsmen have higher projections |
| S.3 | **Bowling heavy** | playStyle=bowling_heavy | ≥4 bowlers |
| S.4 | **Safe captain** | captainStyle=safe_captain | Captain = highest projected player |
| S.5 | **Differential captain** | captainStyle=differential | Captain = 3rd-5th ranked player |
| S.6 | **Stars budget** | budgetStrategy=stars | More premium (9.0+) players |
| S.7 | **Value budget** | budgetStrategy=value | More budget (≤7.0) players |
| S.8 | **11 players always** | Any preferences | Exactly 11 players |
| S.9 | **Budget ≤ 100** | Any preferences | Total credits ≤ 100.0 |
| S.10 | **All roles filled** | Any preferences | ≥1 WK, ≥1 BAT, ≥1 AR, ≥1 BOWL |

---

## Ralph Loop QA Process

After all tests pass, go through each screenshot systematically:

### QA Checklist per Screenshot

1. **Visual correctness** — Does it look right? Correct layout, spacing, colors?
2. **Content accuracy** — Are labels, numbers, names correct?
3. **Responsiveness** — Does it look good at 390x844 (iPhone 14)?
4. **Dark/light mode** — Does it work in both themes?
5. **Empty states** — Are empty states handled gracefully?
6. **Error states** — Are errors user-friendly?
7. **Loading states** — No flash of unstyled content?
8. **Accessibility** — Are buttons tappable, text readable?

### Bug Fix Loop

```
For each screenshot:
  1. Review screenshot
  2. If bug found:
     a. Identify the component/screen
     b. Fix the code
     c. Re-run test for that chapter
     d. Re-take screenshot
     e. Review again
  3. If screenshot looks good:
     a. Move to next screenshot
```

---

## Run Scripts

```json
{
  "test:e2e:cricket": "playwright test tests/e2e/cricket-story/ --project=mobile --workers=1",
  "test:e2e:cricket:chapter": "playwright test tests/e2e/cricket-story/$CHAPTER --project=mobile --workers=1",
  "test:unit:scoring": "npx tsx tests/unit/scoring-math.test.ts",
  "test:cricket:full": "npx tsx tests/unit/scoring-math.test.ts && playwright test tests/e2e/cricket-story/ --project=mobile --workers=1"
}
```

---

## Screenshot Inventory (Expected: ~80 screenshots)

| Chapter | Count | Prefix |
|---------|-------|--------|
| 01 Auth | 10 | `01-*` |
| 02 Onboarding | 8 | `02-*` |
| 03 Home | 11 | `03-*` |
| 04 League Create | 9 | `04-*` |
| 05 League Join | 2 | `05-*` |
| 06 Team Builder | 14 | `06-*` |
| 07 Contest | 9 | `07-*` |
| 08 Draft | 10 | `08-*` |
| 09 Auction | 8 | `09-*` |
| 10 Match Live | 5 | `10-*` |
| 11 Scoring | 0 (API only) | — |
| 12 Settlement | 6 | `12-*` |
| 13 Guru | 4 | `13-*` |
| 14 Profile | 6 | `14-*` |
| **Total** | **~102** | |

---

## Execution Order

1. Run `test:unit:scoring` first (fast, no browser needed)
2. Start emulator + API + Expo web
3. Run `test:e2e:cricket` (chapters 01-14 in order, serial mode)
4. Review all screenshots in `tests/e2e/cricket-story/screenshots/`
5. Fix bugs found → re-run affected chapters → re-review
6. Repeat until all screenshots pass QA
