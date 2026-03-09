# CLAUDE.md (Claude Code reads this automatically)

## Project: DraftPlay
Fantasy cricket platform — React Native (Expo), Hono + tRPC API, 
Drizzle ORM + PostgreSQL, Redis, Gemini AI.

## Key Documentation
- `/docs/NEW_PLAN.md` — Full development plan (Phase 0-8)
- `/docs/GEO_IMPLEMENTATION_GUIDE.md` — Geo-location & regional compliance spec
- `/docs/UI_GUIDE.md` — draftplay.ai design system guide
- `/docs/REDIS_CACHE_ARCHITECTURE.md` — Cache architecture
- `/docs/SMART_REFRESH_ARCHITECTURE.md` — Smart refresh pipeline (Redis → PG → Gemini)
- `/docs/LOGGING_GUIDE.md` — Structured logging & distributed tracing guide
- `/docs/LOCAL_SETUP.md` — Local dev environment setup

## Project Structure
- `apps/` — App targets (mobile Expo, web)
- `packages/` — Shared packages (api, db, ui)
- `components/` — Shared React Native components
- `pages/` — Screen/page components
- `services/` — Business logic & API services
- `ref/` — Reference materials
- `archive/` — Archived/deprecated code
- `App.tsx` — Root app entry point
- `constants.ts` — App-wide constants
- `.env` / `.env.local` — Environment variables

## Conventions
- Use tRPC for all API endpoints
- Use Drizzle ORM for all database queries
- Use Tamagui + draftplay.ai design system for UI (see /docs/UI_GUIDE.md)
- Use Redis for caching (24hr TTL default, see /docs/REDIS_CACHE_ARCHITECTURE.md)
- Use structured logging with Pino (backend) and the shared logger service (frontend) — see `/docs/LOGGING_GUIDE.md`
- All new backend modules must use `getLogger("module-name")`, never raw `console.log`
- All new frontend components must use `createLogger("ComponentName")`, never raw `console.log`
- All tRPC clients must use the tracing batch link to propagate correlation IDs
- All new features need Playwright E2E tests
- Branch naming: `feature/phase-X.Y-description`
- Commit messages: `feat(phase-2.75): description`

## E2E Testing Infrastructure
- **Framework:** Playwright, targeting Expo web at `localhost:8081`
- **Test location:** `tests/e2e/<feature>/<feature>.spec.ts`
- **Config:** `playwright.config.ts` — loads `.env.test` → `.env.local` → `.env`
- **Shared helpers:** `tests/e2e/helpers/tamagui.ts` — `forceClickTab()`, `forceClickText()`, `forceClickByTestId()` (required for Tamagui components that don't respond to normal `.click()`)
- **Auth helpers:** `tests/e2e/auth/auth-helpers.ts` — `clearEmulatorAccounts()`, `createTestAccount()`, `fillAuthForm()`, `submitAuthForm()`
- **Firebase Auth Emulator:** `firebase.json` defines auth emulator on port 9099. Start with `npx firebase emulators:start --only auth --project demo-draftplay`
- **Env for tests:** `.env.test` sets `EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST=localhost:9099`

### Writing Tests for New Features
1. Add `testID` props to new UI elements (renders as `data-testid` on web)
2. Create `tests/e2e/<feature>/<feature>.spec.ts` and optional `-helpers.ts`
3. Import shared helpers from `tests/e2e/helpers/tamagui.ts`
4. Use `forceClickByTestId()` instead of `.click()` for Tamagui pressables
5. Save screenshots to `/screenshots/<issue>-<description>.png`

### Test Scripts
| Script | What it does |
|--------|-------------|
| `pnpm test:e2e` | All E2E tests |
| `pnpm test:e2e:auth` | Auth tests only (emulator must be running) |
| `pnpm test:e2e:no-auth` | All E2E tests except auth |
| `pnpm test:emulator` | Starts Firebase emulator → runs auth tests → kills emulator |
| `pnpm test:regression` | **Run before every merge.** Type-check + non-auth E2E + auth E2E (with auto-emulator) |

### When to Run What
- **Per feature:** Run the relevant feature's tests only (e.g., `pnpm test:e2e:auth` for auth changes)
- **Major feature batch / pre-deployment:** Run `pnpm test:regression` — full type-check + all E2E suites with auto-emulator. Prints pass/fail summary.

## Self-Verification Rules (THE RALPH LOOP)
These rules apply to EVERY task. Never skip them.

1. **Always self-verify your work.** After writing code, run it. After 
   creating a UI, render it. After writing a test, execute it. Never 
   submit work you haven't verified actually works.

2. **Take screenshots as proof.** When implementing UI features, use 
   Playwright to take a screenshot of the result and save it to 
   `/screenshots/[issue-number]-[description].png`. This lets me 
   quickly review visual output without running the app myself.

3. **Loop until it works.** If a test fails, fix the code and re-run. 
   If a screenshot shows the wrong output, fix and re-screenshot. 
   Keep iterating until the task is ACTUALLY COMPLETE — not just 
   "code written." A task is done when:
   - All tests pass
   - Screenshots show correct visual output (for UI tasks)
   - No TypeScript errors (`npx tsc --noEmit` passes)
   - No lint errors
   
4. **Verify against the acceptance criteria.** Every GitHub issue has 
   a checklist. Go through each item and confirm it works. If an item 
   fails, fix it before moving on.

5. **For API/backend tasks:** Hit the endpoint with a real request 
   (use curl or a test script) and include the response in your PR 
   description as proof it works.

6. **For database tasks:** Run a query against the dev database and 
   show the table exists with the correct columns. Include the 
   output in the PR description.

7. **Screenshot naming convention:**
   - `screenshots/118-geoip-india-detection.png`
   - `screenshots/118-geoip-us-detection.png`  
   - `screenshots/121-onboarding-country-picker.png`
   - `screenshots/121-onboarding-blocked-state-warning.png`

## Launch Roadmap (Prioritized for User Release)
All phase details in /docs/NEW_PLAN.md. Execution prompts in /prompts-for-execution.md.

| # | Launch Phase | Status | Key Deliverables |
|---|-------------|--------|-----------------|
| — | Phase 0-2: Foundation + Core + Draft | ✅ COMPLETE | Expo, tRPC, Drizzle, Redis, Gemini, team builder, draft, auction, leagues |
| — | Phase 2.5: draftplay.ai Design System | 🔄 IN PROGRESS (27%) | Tamagui migration, 11 screens remaining |
| **L1** | **Finish Phase 2.75** | **🎯 CURRENT** | **Testing (65 cases), bug fixes, UI migrations** |
| L1.5 | Subscription Monetization | ⏳ NEXT | Freemium tiers (Free/Pro/Elite), Razorpay billing, feature gates, paywall UI |
| L2 | AI Engine (Phase 3 Core) | ⏳ PLANNED | FDR, projected points, Guru chat, Rate My Team (tier-gated) |
| L3 | Push Notifications | ⏳ PLANNED | FCM, 5 core notification types, preferences |
| L4 | Tournament Mode Core | ⏳ PLANNED | Season-long leagues, per-match teams, chips, match awards |
| L5 | Predictions | ⏳ PLANNED | 11 prediction types, AI questions, leaderboard |
| L6 | Coming Soon + Launch Prep | ⏳ PLANNED | 15 Coming Soon screens for deferred features, polish, beta prep |
| 🚀 | **BETA LAUNCH** | **Target: May 19** | **500 beta users** |
| — | Post-Launch Waves 1-3 | ⏳ DEFERRED | Replace Coming Soon screens with real features based on user demand |

## Current Focus: L1 — Finish Phase 2.75
- Testing: 65 test cases across 9 areas (auth, team builder, contests, draft, auction, wallet, live, cache, geo)
- Bug fixes: P0 and P1 from test results
- UI migrations: Match Center + Team Builder to draftplay.ai
- Prompts: 10-21 in /prompts-for-execution.md

## Architecture Decisions Already Made
- **Geo-compliance:** 3-layer detection (IP + GPS + declaration) → feature gates per regulatory zone
- **India PROGA 2025:** `PROGA_ACTIVE` flag — currently true (all India = free-to-play). Toggle when Supreme Court rules.
- **Gemini API routing:** Region-specific Vertex AI endpoints (asia-south1 for India, us-central1 for US, global for batch jobs)
- **Database:** Single Cloud SQL instance in asia-south1 (Mumbai). Cross-region replica only when US users > 10%.
- **Redis:** Single Memorystore in asia-south1. No geo-distribution needed.
- **UI:** Tamagui + draftplay.ai design system. All new screens must use design system components.
- **Caching:** Redis with 24hr default TTL. Graceful fallback to direct Gemini API on cache miss.
- **Auth:** Firebase Auth client SDK initialized in `apps/mobile/lib/firebase.ts`. Token injected into tRPC via `setTRPCToken()` in `apps/mobile/lib/trpc.ts`. Auth state managed by `AuthProvider`. Root `app/index.tsx` auth-gates: no user → `/auth/login`, authenticated → `/(tabs)`.

## What NOT to Do
- Do NOT create separate CSS/JS files — keep everything in single files for components
- Do NOT use localStorage in any web artifacts
- Do NOT hardcode Indian states or country lists — use the regulation engine from /docs/GEO_IMPLEMENTATION_GUIDE.md
- Do NOT call Gemini API without going through the region-routing client
- Do NOT skip the Ralph Loop self-verification steps
- Do NOT use `console.log` in production code — use the structured logger (see /docs/LOGGING_GUIDE.md)
- Do NOT log PII, payment credentials, exact geo-coordinates, or raw AI responses
- Do NOT add `logging.basicConfig()` or create new Pino root instances — use `getLogger()` / `createLogger()`