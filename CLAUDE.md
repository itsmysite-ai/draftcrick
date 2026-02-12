# CLAUDE.md (Claude Code reads this automatically)

## Project: DraftCrick
Fantasy cricket platform — React Native (Expo), Hono + tRPC API, 
Drizzle ORM + PostgreSQL, Redis, Gemini AI.

## Key Documentation
- `/docs/NEW_PLAN.md` — Full development plan (Phase 0-8)
- `/docs/GEO_IMPLEMENTATION_GUIDE.md` — Geo-location & regional compliance spec
- `/docs/UI_GUIDE.md` — tami·draft design system guide
- `/docs/REDIS_CACHE_ARCHITECTURE.md` — Cache architecture
- `/docs/SMART_REFRESH_ARCHITECTURE.md` — Sports data persistence & smart refresh architecture
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
- Use Tamagui + tami·draft design system for UI (see /docs/UI_GUIDE.md)
- Use PostgreSQL as source of truth for sports data + Redis hot cache (5min TTL). See /docs/SMART_REFRESH_ARCHITECTURE.md and /docs/REDIS_CACHE_ARCHITECTURE.md
- Use structured logging with Pino (backend) and the shared logger service (frontend) — see `/docs/LOGGING_GUIDE.md`
- All new backend modules must use `getLogger("module-name")`, never raw `console.log`
- All new frontend components must use `createLogger("ComponentName")`, never raw `console.log`
- All tRPC clients must use the tracing batch link to propagate correlation IDs
- All new features need Playwright E2E tests
- Branch naming: `feature/phase-X.Y-description`
- Commit messages: `feat(phase-2.75): description`

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

## Phase Status Overview
All phase details in /docs/NEW_PLAN.md. Geo-compliance in /docs/GEO_IMPLEMENTATION_GUIDE.md.

| Phase | Name | Status | Key Deliverables |
|-------|------|--------|-----------------|
| 0 | Foundation & Infrastructure | ✅ COMPLETE | Expo, Hono+tRPC, Drizzle+PG, Redis, Gemini API |
| 1 | Core Fantasy — Salary Cap | ✅ COMPLETE | Team builder, contests, scoring, wallet |
| 2 | Draft, Auction & Leagues | ✅ COMPLETE | Draft rooms, auction, league management, 200+ rules |
| 2.5 | tami·draft Design System | 🔄 IN PROGRESS (27%) | Tamagui migration, 11 screens to migrate |
| **2.75** | **Data Integration, Schema & Testing** | **🎯 CURRENT** | **Real data, 19 new tables, geo-location foundation, 65 test cases** |
| 3 | AI & Analytics Engine | ⏳ NEXT | FDR, projections, Guru chat, comparison tool, match previews |
| 4 | Tournament Mode & Advanced Leagues | ⏳ PLANNED | Season-long leagues, trades, playoffs, chips, commissioner, H2H, geo-verification for paid actions |
| 5 | Predictions & Social | ⏳ PLANNED | 11 prediction types, league chat, notifications, referrals |
| 6 | Web, Admin & Corporate | ⏳ PLANNED | Web parity, admin dashboard, ownership stats |
| 7 | Polish, Testing & Launch | ⏳ PLANNED | Security, VPN detection, geo-compliance audit, PROGA ruling response, beta launch |
| 8 | Voice, AI Content & Post-Launch | ⏳ FUTURE | Voice commands, AI newsletter, dynamic pricing, cup mode, geo-infrastructure scaling |

## Current Focus: Phase 2.75 (Weeks 12-14)
- Week 1: Real data integration + tournament schema (19 tables) + geo-location foundation
- Week 2: Comprehensive testing (65 test cases across 9 areas)
- Week 3: Bug fixes + polish + screen migrations

## Architecture Decisions Already Made
- **Geo-compliance:** 3-layer detection (IP + GPS + declaration) → feature gates per regulatory zone
- **India PROGA 2025:** `PROGA_ACTIVE` flag — currently true (all India = free-to-play). Toggle when Supreme Court rules.
- **Gemini API routing:** Region-specific Vertex AI endpoints (asia-south1 for India, us-central1 for US, global for batch jobs)
- **Database:** Single Cloud SQL instance in asia-south1 (Mumbai). Cross-region replica only when US users > 10%.
- **Redis:** Single Memorystore in asia-south1. No geo-distribution needed.
- **UI:** Tamagui + tami·draft design system. All new screens must use design system components.
- **Sports Data:** PostgreSQL source of truth + Redis hot cache (5min TTL). Smart per-match refresh intervals (idle=12h, pre_match=2h, live=5min). First-user-triggers-refresh (no cron). See `/docs/SMART_REFRESH_ARCHITECTURE.md`.
- **Caching:** Redis hot cache with 5min TTL (upgraded from 24hr primary store). Graceful fallback to PostgreSQL on cache miss.

## What NOT to Do
- Do NOT create separate CSS/JS files — keep everything in single files for components
- Do NOT use localStorage in any web artifacts
- Do NOT hardcode Indian states or country lists — use the regulation engine from /docs/GEO_IMPLEMENTATION_GUIDE.md
- Do NOT call Gemini API without going through the region-routing client
- Do NOT skip the Ralph Loop self-verification steps
- Do NOT use `console.log` in production code — use the structured logger (see /docs/LOGGING_GUIDE.md)
- Do NOT log PII, payment credentials, exact geo-coordinates, or raw AI responses
- Do NOT add `logging.basicConfig()` or create new Pino root instances — use `getLogger()` / `createLogger()`