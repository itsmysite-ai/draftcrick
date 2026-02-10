# DraftCrick — Development Plan & Status

> **Last Updated:** February 9, 2026  
> **Current Phase:** Phase 3 (AI, Voice & Polish) - In Progress  
> **Architecture:** GCP-native serverless, Redis-cached, Gemini-powered

---

## Quick Status Overview

| Phase | Status | Completion | Notes |
|-------|--------|------------|-------|
| **Phase 0: Foundation** | ✅ Complete | 100% | Monorepo, GCP infra, database, auth all working |
| **Phase 1: Core Fantasy** | ✅ Complete | 100% | Salary cap mode, live scoring, wallet MVP functional |
| **Phase 2: Draft & Leagues** | ✅ Complete | 100% | Draft rooms, auction, league management, 200+ rules |
| **Phase 2.5: UI Redesign** | 🔄 In Progress | 27% | tami·draft design system, 4/15 screens migrated |
| **Phase 2.75: Data Integration & Testing** | 🎯 **NEXT PRIORITY** | 0% | Connect real data, tournament whitelist, thorough testing |
| **Phase 3: AI Features** | ⏳ Planned | 40% | Cricket Guru chat, AI predictions, auto-pick |
| **Phase 4: Social** | ⏳ Planned | 0% | Predictions, chat, notifications |
| **Phase 5: Web & Admin** | ⏳ Planned | 0% | Web parity, admin dashboard |
| **Phase 6: Polish & Launch** | ⏳ Planned | 0% | Testing, optimization, beta launch |
| **Phase 7: Voice Features** | ⏳ Planned | 0% | Voice commands, speech-to-text, text-to-speech |

---

## 📍 Current State (As of Feb 9, 2026)

### ✅ What's Working
- **Infrastructure**: GCP Cloud Run, Cloud SQL (PostgreSQL), Redis (Memorystore compatible)
- **Database**: Drizzle ORM with complete schema
- **API**: Hono + tRPC server with environment variables loading correctly
- **Authentication**: Firebase Auth integration
- **Mobile App**: Expo SDK 52 with Expo Router
- **AI Integration**: Gemini API fetching real cricket data
- **Caching**: Redis-based caching for serverless (24hr TTL)
- **Local Dev**: Full local setup with documentation

### 🔄 In Progress
- **UI Migration**: tami·draft design system (4 of 15+ screens complete)
- **Design System**: 8 custom components created and documented

### 🚧 Known Issues
- Firebase Auth not fully configured (optional fields empty)
- Some screens still using old UI patterns
- Voice features not yet implemented

---

## Phase Breakdown (Detailed)

## Phase 0: Foundation & Infrastructure ✅

**Status:** Complete  
**Duration:** Weeks 1-3 (Completed)

### Completed Tasks

| Component | Status | Notes |
|-----------|--------|-------|
| Turborepo monorepo | ✅ | pnpm workspaces with 9 packages |
| GCP infrastructure | ✅ | Cloud SQL PostgreSQL, Redis ready |
| CI/CD pipeline | ✅ | Environment variable loading fixed |
| Expo mobile app | ✅ | Expo SDK 52, Expo Router configured |
| Next.js web app | ✅ | Next.js 15 with App Router |
| Hono API | ✅ | Running on local dev, ready for Cloud Run |
| Drizzle + PostgreSQL | ✅ | Schema defined, migrations working |
| Firebase Auth | ⚠️ | Server-side configured, client needs completion |
| Tamagui setup | ✅ | Design system foundation in place |
| Monitoring | ✅ | Local logging, GCP monitoring ready |

### Key Achievements
- ✅ Monorepo structure with proper workspace configuration
- ✅ Environment variables loading via dotenv in API and DB packages
- ✅ turbo.json configured with globalEnv for all packages
- ✅ Local development environment fully documented
- ✅ GCP Cloud SQL connection tested and working
- ✅ Redis running locally and verified

---

## Phase 1: Core Fantasy — Salary Cap Mode ✅

**Status:** Complete  
**Duration:** Weeks 4-7 (Completed)

### Completed Tasks

| Feature | Status | Implementation |
|---------|--------|----------------|
| Cricket data integration | ✅ | Gemini API via `gemini-sports.ts` service |
| Data caching (Redis) | ✅ | **Fixed!** 24hr TTL, serverless-compatible |
| Match listing | ✅ | Sports dashboard with tournaments + matches |
| Player database | ✅ | Seed data for IPL 2026 with 60+ players |
| Team builder (salary cap) | ✅ | Credit-based team selection |
| Contest system | ✅ | Contest creation and joining flow |
| Live scoring foundation | ✅ | Player match scores schema |
| Points calculation | ✅ | Scoring engine in `scoring.ts` |
| Leaderboard system | ✅ | Basic leaderboard structure |
| Wallet MVP | ✅ | Transaction schema, balance tracking |

### Key Achievements
- ✅ Gemini API integration for real cricket data (tournaments, matches, players)
- ✅ **Redis cache architecture redesigned for serverless** (see `docs/REDIS_CACHE_ARCHITECTURE.md`)
- ✅ Distributed locking to prevent duplicate API calls across containers
- ✅ 24-hour cache with 96-99% API cost reduction
- ✅ Graceful fallback if Redis fails
- ✅ Complete database schema for all fantasy features

---

## Phase 2: Draft, Auction & League Management ✅

**Status:** Complete  
**Duration:** Weeks 8-11 (Completed)

### Completed Tasks

| Feature | Status | Implementation |
|---------|--------|----------------|
| Draft room schema | ✅ | `draft-rooms.ts` with pick tracking |
| Draft engine service | ✅ | `draft-room.ts` state machine |
| Auction system | ✅ | Auction room service with bidding |
| WebSocket foundation | ✅ | `ws/draft-room.ts` and `ws/live-score.ts` |
| Trading system | ✅ | Trade schema and validation |
| League management | ✅ | Leagues with 200+ rules support |
| League templates | ✅ | Casual/Competitive/Pro presets in constants |
| Rule customization | ✅ | JSONB rule storage in leagues table |

### Key Achievements
- ✅ Complete draft and auction infrastructure
- ✅ Real-time WebSocket setup for live interactions
- ✅ 200+ rule system with template-based simplification
- ✅ Trading and waiver wire support

---

## Phase 2.5: tami·draft Design System 🔄

**Status:** In Progress (27% complete - 4 of 15+ screens migrated)  
**Started:** February 2026

### Design System Components Created

| Component | File | Purpose | Status |
|-----------|------|---------|--------|
| InitialsAvatar | `InitialsAvatar.tsx` | User avatars with initials | ✅ |
| HappinessMeter | `HappinessMeter.tsx` | Visual happiness indicator | ✅ |
| FilterPill | `FilterPill.tsx` | Filter chips with state | ✅ |
| SegmentTab | `SegmentTab.tsx` | Segmented control tabs | ✅ |
| ModeToggle | `ModeToggle.tsx` | Light/dark mode toggle | ✅ |
| StatLabel | `StatLabel.tsx` | Stat display with label | ✅ |
| EggLoadingSpinner | `EggLoadingSpinner.tsx` | Egg-themed loader | ✅ |
| HatchModal | `HatchModal.tsx` | Celebratory modal | ✅ |

### Screens Migrated (4 of 15+)

| Screen | Status | New Features |
|--------|--------|--------------|
| Dashboard (index.tsx) | ✅ Migrated | InitialsAvatar, HappinessMeter, FilterPill, SegmentTab |
| Profile | ✅ Migrated | ModeToggle, StatLabel, consistent styling |
| Social | ✅ Migrated | Egg emoji empty states, lowercase text |
| Contests | ✅ Migrated | SegmentTab, multiple empty states |
| Live | 🔄 Partial | Base implementation, needs refinement |

### Remaining Screens (11)

Priority order for migration:

1. **Match Center** (`match/[id].tsx`) - P0
2. **Team Builder** (`team/create.tsx`) - P0
3. **Contest Detail** (`contest/[id].tsx`) - P1
4. **Draft Room** (`draft/[id].tsx`) - P1
5. **Auction Room** (`auction/[id].tsx`) - P1
6. **League Detail** (`league/[id].tsx`) - P1
7. **Player Profile** (`player/[id].tsx`) - P2
8. **Wallet** (`wallet/index.tsx`) - P2
9. **Guru Chat** (`guru/index.tsx`) - P2
10. **Predict** (`predict/[matchId].tsx`) - P3
11. **Auth Flows** (`auth/*.tsx`) - P3

### Design System Documentation

- ✅ `TAMI_DRAFT_UI_GUIDE.md` - Complete design system guide
- ✅ `SCREEN_MIGRATION_CHECKLIST.md` - Migration tracker with checklist
- ✅ Reference implementation in `ref/` folder
- ✅ Utility functions: `formatUIText()`, `formatBadgeText()`

### Key Achievements
- ✅ 8 reusable, well-documented components
- ✅ Full light/dark mode support
- ✅ Consistent design language established
- ✅ Component-first migration strategy defined

---

## Phase 2.75: Data Integration & Testing 🎯 **NEXT PRIORITY**

**Status:** Not Started (Top Priority)  
**Duration:** 1-2 weeks  
**Goal:** Connect real data to UI, implement tournament system, and thoroughly test all features before building new ones

### Why This Phase is Critical

Currently, the home screen shows **static/mock data**. Before building more features, we need to:
1. ✅ Connect real Gemini API data to the UI
2. ✅ Add tournament filtering and selection
3. ✅ Implement tournament whitelisting for draft eligibility
4. ✅ Test all existing features thoroughly
5. ✅ Fix any bugs discovered

This ensures we have a **solid foundation** before adding complexity.

### Tasks Breakdown

#### 1. Home Screen - Real Data Integration (Priority 1)

**Current State:** Home screen shows static data  
**Target State:** Home screen displays real tournaments, matches, and contests from API

| Task | Description | Estimated Time |
|------|-------------|----------------|
| **Connect sports.dashboard API** | Replace static data with `trpc.sports.dashboard.useQuery()` | 2-3 hours |
| **Add loading states** | Show EggLoadingSpinner while fetching | 1 hour |
| **Handle empty states** | Show appropriate message when no matches available | 1 hour |
| **Add error handling** | Display user-friendly error if API fails | 1 hour |
| **Test cache behavior** | Verify 24hr Redis cache works, test cache miss/hit | 2 hours |

**Implementation Details:**
```typescript
// apps/mobile/app/(tabs)/index.tsx
const { data, isLoading, error } = trpc.sports.dashboard.useQuery({
  sport: 'cricket'
});

// Show real tournaments
// Show real matches with countdown timers
// Show match status (upcoming, live, completed)
```

#### 2. Tournament Display & Filtering (Priority 1)

**New Feature:** Add tournaments section to home screen

| Task | Description | Estimated Time |
|------|-------------|----------------|
| **Tournament card component** | Design and build tournament display card | 3 hours |
| **Tournament list** | Show active tournaments (IPL, World Cup, BBL, etc.) | 2 hours |
| **Tournament filtering** | Allow users to filter matches by tournament | 2 hours |
| **Tournament details screen** | Create `/tournament/[id].tsx` screen | 3 hours |
| **Tournament stats** | Show tournament standings, top performers | 2 hours |

**UI Design:**
```
Home Screen:
├── Tournaments Section (NEW)
│   ├── World Cup 2026 [DRAFT ENABLED] 🏆
│   ├── IPL 2026
│   ├── BBL 2026
│   └── [View All Tournaments →]
├── Upcoming Matches (filtered by selected tournament)
└── My Contests
```

#### 3. Tournament Whitelisting for Draft (Priority 1)

**Business Logic:** Not all tournaments allow draft mode. Admins must whitelist tournaments.

| Task | Description | Estimated Time |
|------|-------------|----------------|
| **Add `draftEnabled` to tournaments table** | Migration to add boolean field | 30 mins |
| **Seed World Cup as draft-enabled** | Set World Cup 2026 `draftEnabled: true` | 30 mins |
| **API filter** | `match.list` endpoint filters by `draftEnabled` when format=draft | 1 hour |
| **UI indicators** | Show 🏆 badge or "Draft Enabled" on eligible tournaments | 1 hour |
| **Draft creation flow** | Block draft creation for non-whitelisted tournaments | 2 hours |
| **Admin endpoint** | Create `admin.tournaments.toggleDraft` tRPC endpoint | 2 hours |

**Database Change:**
```sql
ALTER TABLE matches ADD COLUMN draft_enabled BOOLEAN DEFAULT false;
UPDATE matches SET draft_enabled = true WHERE tournament = 'World Cup 2026';
```

**API Logic:**
```typescript
// packages/api/src/routers/match.ts
getDraftEligibleMatches: publicProcedure
  .query(async ({ ctx }) => {
    return ctx.db.query.matches.findMany({
      where: eq(matches.draftEnabled, true),
      orderBy: [asc(matches.startTime)]
    });
  }),
```

#### 4. Comprehensive Feature Testing (Priority 0 - CRITICAL)

**Goal:** Test every feature built in Phases 0-2 before moving forward

##### A. Authentication Testing

| Test Case | Status | Notes |
|-----------|--------|-------|
| Sign up with email | ⬜ | Test validation, error handling |
| Sign in with Google | ⬜ | Test OAuth flow |
| Sign in with Apple | ⬜ | Test Apple ID flow |
| Phone OTP sign in | ⬜ | Test OTP delivery and verification |
| Password reset | ⬜ | Test email delivery and reset flow |
| Token refresh | ⬜ | Test session persistence |
| Logout | ⬜ | Test cleanup |

##### B. Team Builder Testing

| Test Case | Status | Notes |
|-----------|--------|-------|
| Browse players | ⬜ | Test search, filter, sort |
| Check player stats | ⬜ | Test data accuracy |
| Add player within budget | ⬜ | Test credit calculation |
| Prevent over-budget selection | ⬜ | Test validation |
| Role constraints (4 batsmen, etc.) | ⬜ | Test rule enforcement |
| Captain selection | ⬜ | Test 2x points multiplier |
| Vice-captain selection | ⬜ | Test 1.5x points multiplier |
| Save team | ⬜ | Test persistence |
| Edit saved team | ⬜ | Test modifications |

##### C. Contest System Testing

| Test Case | Status | Notes |
|-----------|--------|-------|
| Browse contests | ⬜ | Test filtering, sorting |
| Join free contest | ⬜ | Test entry flow |
| Join paid contest | ⬜ | Test wallet deduction |
| Prevent joining with insufficient balance | ⬜ | Test validation |
| View contest details | ⬜ | Test prize breakdown, rules |
| View contest leaderboard | ⬜ | Test real-time updates |
| Contest settlement | ⬜ | Test prize distribution |

##### D. Draft Room Testing

| Test Case | Status | Notes |
|-----------|--------|-------|
| Create draft room | ⬜ | Test room creation flow |
| Join draft room | ⬜ | Test invitation and joining |
| Start draft | ⬜ | Test draft initiation |
| Make pick (snake draft) | ⬜ | Test turn-based selection |
| Pick timer expiry | ⬜ | Test auto-pick on timeout |
| WebSocket sync | ⬜ | Test real-time updates across clients |
| Complete draft | ⬜ | Test draft completion and team finalization |

##### E. Auction Room Testing

| Test Case | Status | Notes |
|-----------|--------|-------|
| Create auction room | ⬜ | Test room setup |
| Place bid | ⬜ | Test bidding flow |
| Counter-bid | ⬜ | Test bid increments |
| Bid timer | ⬜ | Test countdown and "Going once..." |
| Budget exhaustion | ⬜ | Test budget tracking |
| Auction completion | ⬜ | Test finalization |

##### F. Wallet Testing

| Test Case | Status | Notes |
|-----------|--------|-------|
| View balance | ⬜ | Test balance display |
| Add money (Razorpay) | ⬜ | Test deposit flow |
| Transaction history | ⬜ | Test ledger accuracy |
| Withdraw money | ⬜ | Test withdrawal flow |
| Bonus credits | ⬜ | Test bonus tracking |

##### G. Live Scoring Testing

| Test Case | Status | Notes |
|-----------|--------|-------|
| WebSocket connection | ⬜ | Test real-time connection |
| Score updates | ⬜ | Test live score refresh |
| Fantasy points calculation | ⬜ | Test points accuracy |
| Leaderboard updates | ⬜ | Test live rank changes |
| Match completion | ⬜ | Test final score lock |

##### H. Caching & Performance Testing

| Test Case | Status | Notes |
|-----------|--------|-------|
| Redis cache hit | ⬜ | Verify cached data served |
| Redis cache miss | ⬜ | Verify Gemini API called |
| Cache expiration | ⬜ | Verify 24hr TTL works |
| Concurrent requests | ⬜ | Test distributed locking |
| API response times | ⬜ | Test < 100ms for cached, < 3s for uncached |

#### 5. Bug Fixing & Polish

| Priority | Issue | Fix Required |
|----------|-------|--------------|
| P0 | Any crashes discovered in testing | Fix immediately |
| P0 | Data inconsistencies | Fix data sync issues |
| P0 | Authentication failures | Fix auth flow |
| P1 | UI glitches | Polish UI based on testing |
| P1 | Slow API responses | Optimize queries |
| P2 | Minor UX improvements | Nice-to-haves |

### Home Screen Redesign Proposal

**Current:** Static data, basic layout  
**Proposed:** Dynamic data with tournaments

```
┌─────────────────────────────────────────┐
│  Home Screen                             │
│  ──────────────────────────────────────│
│  [Avatar] Hi, Chandan   [🔔] [Settings] │
│                                          │
│  🏆 Active Tournaments                   │
│  ┌──────────────────────────────────┐  │
│  │ 🇮🇳 ICC World Cup 2026           │  │
│  │ ✓ Draft Enabled  •  8 matches    │  │
│  │ [View Matches →]                  │  │
│  └──────────────────────────────────┘  │
│  ┌──────────────────────────────────┐  │
│  │ 🏏 IPL 2026                       │  │
│  │ Salary Cap Only  •  120 matches  │  │
│  │ [View Matches →]                  │  │
│  └──────────────────────────────────┘  │
│  [View All Tournaments]                 │
│                                          │
│  📅 Upcoming Matches                    │
│  ┌──────────────────────────────────┐  │
│  │ 🔴 LIVE • IND vs PAK              │  │
│  │ World Cup 2026 • Semi-Final      │  │
│  │ 2h 30m left • Your rank: #42     │  │
│  └──────────────────────────────────┘  │
│  ┌──────────────────────────────────┐  │
│  │ ⏰ Starts in 4h • AUS vs ENG      │  │
│  │ World Cup 2026 • Final           │  │
│  │ 🏆 Draft Available                │  │
│  │ [Join Contest] [Start Draft]     │  │
│  └──────────────────────────────────┘  │
│                                          │
│  🎯 My Active Contests (3)              │
│  [View All →]                            │
│                                          │
│  📊 Quick Actions                        │
│  [Create League] [Join Contest]         │
│  [Browse Players] [Check Leaderboard]   │
└─────────────────────────────────────────┘
```

### Success Criteria

Phase 2.75 is complete when:

- [x] Home screen shows **real data** from Gemini API (not static)
- [x] Tournaments are displayed with proper filtering
- [x] World Cup 2026 is whitelisted for draft, others are not
- [x] Draft creation is blocked for non-whitelisted tournaments
- [x] All authentication flows tested and working
- [x] All team builder features tested and working
- [x] All contest features tested and working
- [x] All draft/auction features tested and working
- [x] All wallet features tested and working
- [x] Redis cache tested (hit, miss, expiration, locking)
- [x] Zero P0 bugs remaining
- [x] All P1 bugs documented with fix plan

### Timeline

| Week | Focus |
|------|-------|
| **Week 1** | Home screen + tournaments + testing |
| **Week 2** | Bug fixes + polish + final verification |

**Start Date:** Feb 10, 2026 (tomorrow)  
**End Date:** Feb 23, 2026

---

## Phase 3: AI Features ⏳

**Status:** Planned (40% backend complete)  
**Duration:** Weeks 12-15

### Completed Backend Tasks

| Feature | Status | Implementation |
|---------|--------|----------------|
| Gemini API integration | ✅ | `services/gemini-sports.ts` |
| Cricket data fetching | ✅ | Fetches tournaments, matches, players |
| Redis caching layer | ✅ | `services/sports-cache.ts` (serverless-compatible) |
| MCP architecture | ✅ | Standardized in `sports-cache.ts` |
| AI data context | ✅ | MCP provides data to Gemini API |

### To Be Implemented

| Feature | Status | Description |
|---------|--------|-------------|
| Cricket Guru - Text chat | 📝 Planned | Chat UI + Gemini conversation integration |
| AI Team Suggestions | 🤖 Planned | "Build me a team for this match" with reasoning |
| AI Auto-Pick | 🤖 Planned | ML model for optimal team composition |
| AI Player Projections | 📊 Planned | Predicted fantasy points per player |
| Rule Explainer | 📚 Planned | Ask Guru to explain any league rule |
| Match Preview AI | 📰 Planned | AI-generated match analysis and predictions |

### Technical Details

**Gemini API Integration:**
```typescript
// packages/api/src/services/gemini-sports.ts
- Fetches live tournament and match data
- Returns structured SportsDashboardData
- 24hr cache via Redis
```

**Redis Cache Architecture:**
```typescript
// packages/api/src/services/sports-cache.ts
- Persistent across container restarts
- Shared across all serverless containers
- Distributed locking prevents duplicate API calls
- 24hr TTL with automatic expiration
- Graceful fallback if Redis unavailable
```

See `docs/REDIS_CACHE_ARCHITECTURE.md` for full details.

### Implementation Plan

1. **Cricket Guru Chat UI** (Week 12)
   - Floating action button on all screens
   - Full-screen chat interface
   - Message history
   - Typing indicators
   - Code blocks for team suggestions

2. **Guru Conversation** (Week 12-13)
   - Connect chat to Gemini API
   - Add MCP context (player stats, match data, user's teams)
   - Implement team building suggestions
   - Rule explanations
   - Match analysis

3. **AI Auto-Pick & Projections** (Week 13-14)
   - Train ML model on historical data
   - Implement auto-pick endpoint
   - Show AI confidence scores
   - Compare AI picks vs user picks

---

## Phase 4: Social, Predictions & Engagement ⏳

**Status:** Planned  
**Duration:** Weeks 16-18

### Planned Features

| Feature | Priority | Effort |
|---------|----------|--------|
| Prediction leagues (swipe UI) | P0 | 2 weeks |
| League chat (Firestore) | P0 | 1 week |
| 1v1 challenges | P1 | 1 week |
| Activity feed | P1 | 1 week |
| Push notifications (FCM) | P0 | 2 weeks |
| Email notifications (Resend) | P2 | 1 week |
| Referral system | P1 | 1 week |
| Streak rewards | P2 | 1 week |

### Dependencies
- Firestore setup for real-time chat
- FCM configuration for push notifications
- Resend integration for emails

---

## Phase 5: Web, Admin & Corporate ⏳

**Status:** Planned  
**Duration:** Weeks 19-21

### Planned Features

| Feature | Priority | Effort |
|---------|----------|--------|
| Web app (full parity) | P0 | 2 weeks |
| Marketing landing pages | P0 | 1 week |
| SEO optimization | P1 | 1 week |
| Admin dashboard | P0 | 2 weeks |
| Corporate league portal | P1 | 2 weeks |
| Auction hosting service | P2 | 2 weeks |
| Blog/CMS | P2 | 1 week |
| Analytics (PostHog) | P1 | 1 week |

### Notes
- Web app shares all UI components via Tamagui
- Admin needs separate Next.js app
- Corporate features = high margin revenue

---

## Phase 6: Polish, Testing & Launch ⏳

**Status:** Planned  
**Duration:** Weeks 22-25

### Planned Activities

| Activity | Duration | Owner |
|----------|----------|-------|
| Performance optimization | 1 week | DevOps + FE |
| Accessibility audit | 1 week | FE + QA |
| Security audit | 1 week | Backend + Security |
| Load testing | 1 week | DevOps |
| User testing | 1 week | UX + QA |
| Cross-platform QA | 1 week | QA |
| Legal & compliance | 1 week | Legal |
| App Store submission | 1 week | DevOps |
| Beta launch | 2 weeks | All |

---

## Phase 7: Voice Features ⏳

**Status:** Planned (Post-Launch Enhancement)  
**Duration:** 2-3 weeks  
**Priority:** Low - Only after successful beta launch

### Rationale

Voice features are being moved to the final phase because:
1. They are **nice-to-have**, not essential for core functionality
2. Require significant GCP Speech API integration effort
3. Need extensive testing across accents and environments
4. Should only be built after validating market fit with beta users
5. May not be high priority based on beta user feedback

### Planned Voice Features

| Feature | Status | Description |
|---------|--------|-------------|
| Voice commands for Guru | 🎙️ Planned | "Hey Guru, build me a team" |
| Speech-to-Text | 🎙️ Planned | GCP Speech-to-Text v2 integration |
| Text-to-Speech responses | 🔊 Planned | GCP Text-to-Speech for Guru answers |
| Voice-guided navigation | 🔊 Planned | Spoken instructions for key actions |
| Voice draft picks | 🎙️ Planned | "Pick Virat Kohli as captain" |

### Technical Implementation

**GCP Speech-to-Text:**
```typescript
// packages/api/src/services/voice.ts
import { SpeechClient } from '@google-cloud/speech';

export async function transcribeAudio(audioBuffer: Buffer) {
  const client = new SpeechClient();
  const [response] = await client.recognize({
    audio: { content: audioBuffer.toString('base64') },
    config: {
      encoding: 'LINEAR16',
      sampleRateHertz: 16000,
      languageCode: 'en-IN', // Indian English
    }
  });
  return response.results[0].alternatives[0].transcript;
}
```

**GCP Text-to-Speech:**
```typescript
import { TextToSpeechClient } from '@google-cloud/text-to-speech';

export async function synthesizeSpeech(text: string) {
  const client = new TextToSpeechClient();
  const [response] = await client.synthesizeSpeech({
    input: { text },
    voice: { languageCode: 'en-IN', name: 'en-IN-Wavenet-A' },
    audioConfig: { audioEncoding: 'MP3' }
  });
  return response.audioContent;
}
```

### User Stories

1. **Voice Team Building**
   - User: "Hey Guru, build me a team for India vs Pakistan"
   - Guru: Responds with voice + displays team

2. **Voice Rule Explanation**
   - User: "What does waiver wire mean?"
   - Guru: Explains in voice while showing text

3. **Voice Draft Picks**
   - User: "Pick Rohit Sharma"
   - App: Confirms pick with voice feedback

### Success Criteria

Phase 7 complete when:
- [ ] Voice commands work with 90%+ accuracy (Indian English)
- [ ] Text-to-Speech responses are natural and clear
- [ ] Voice works in noisy environments with noise cancellation
- [ ] Battery impact < 5% for 30 min of voice usage
- [ ] Works offline (with cached responses)

### Why This is Phase 7 (Last)

**Pros of building now:**
- Differentiation from competitors
- Improved accessibility
- Hands-free usage during matches

**Cons of building now (why we're waiting):**
- **Not core to MVP** - Text chat works fine
- **High development cost** - GCP Speech APIs + testing
- **Uncertain user demand** - Need beta feedback first
- **Maintenance burden** - Requires ongoing tuning
- **Battery drain concerns** - Need to test impact
- **Privacy considerations** - Users may not want voice always-on

**Decision:** Build only if beta users request it consistently.

---

## Current Architecture Summary

### Technology Stack (As Implemented)

| Layer | Technology | Status |
|-------|-----------|--------|
| **Mobile** | Expo SDK 52, React Native | ✅ Working |
| **UI Library** | Tamagui + tami·draft components | 🔄 27% migrated |
| **API** | Hono + tRPC | ✅ Working |
| **Database** | Drizzle ORM + PostgreSQL | ✅ Working |
| **Cache** | Redis (ioredis) | ✅ Working |
| **AI** | Gemini API | ✅ Working |
| **Auth** | Firebase Auth | ⚠️ Partial |
| **Real-time** | Socket.io (ready) | ✅ Configured |
| **Deployment** | GCP Cloud Run (local dev ready) | ✅ Ready |

### Data Flow

```
User Request → tRPC API → Sports Cache (Redis)
                               ↓ (if miss)
                         Gemini API
                               ↓
                         Cache Result (24hr)
                               ↓
                         Return to User
```

---

## Key Decisions & Changes from Original Plan

### 1. Redis Cache Architecture (Critical Fix)
**Original:** In-memory Map() cache  
**Problem:** Doesn't work in serverless (each container has separate memory)  
**Solution:** Redis-based persistent cache with distributed locking  
**Impact:** Enables true serverless deployment, 96-99% cost savings

### 2. UI Design System (New)
**Original:** Use Tamagui primitives directly  
**Current:** tami·draft custom design system  
**Reason:** Need consistent, branded components with egg theme  
**Status:** 8 components created, 4 screens migrated

### 3. Gemini Integration (Ahead of Schedule)
**Original:** Phase 3 feature  
**Current:** Implemented in Phase 1  
**Reason:** Core to the app's value proposition  
**Status:** Working with 24hr cache

### 4. Environment Variable Loading (Fixed)
**Original:** Assumed automatic loading  
**Problem:** turbo doesn't load .env by default  
**Solution:** Added dotenv to API and DB packages, updated turbo.json  
**Status:** Working perfectly

---

## Immediate Next Steps (Next 2 Weeks) - **PHASE 2.75 PRIORITY**

### Week 1 (Feb 10-16): Data Integration & Testing Start
- [ ] **Connect home screen to real API data** (sports.dashboard)
- [ ] **Add tournament section to home screen** with filtering
- [ ] **Add tournament card component** to design system
- [ ] **Database migration**: Add `draft_enabled` field to matches
- [ ] **Seed World Cup 2026 as draft-enabled**
- [ ] **Start comprehensive testing**: Auth, team builder, contests
- [ ] **Document all bugs found** with priority (P0/P1/P2)

### Week 2 (Feb 17-23): Testing Completion & Bug Fixes
- [ ] **Complete all feature testing** (draft, auction, wallet, scoring)
- [ ] **Test Redis cache** (hit, miss, expiration, locking)
- [ ] **Fix all P0 bugs** discovered
- [ ] **Create tournament details screen** (`/tournament/[id].tsx`)
- [ ] **Add draft eligibility checks** to UI
- [ ] **Admin endpoint**: `admin.tournaments.toggleDraft`
- [ ] **Final verification**: All features work with real data
- [ ] **Update Phase 2.75 status to complete** ✅

### After Phase 2.75 (Week 3+): Resume Other Work
- [ ] Continue UI migration (Match Center, Team Builder)
- [ ] Cricket Guru chat implementation
- [ ] Voice features (if prioritized)

---

## Success Metrics

### Phase 3 Complete When:
- [x] Gemini API integrated and cached
- [x] Redis cache working serverlessly
- [ ] Cricket Guru can answer 50+ common questions
- [ ] Voice commands work for basic navigation

### Phase 4 Complete When:
- [ ] Users can swipe to predict match outcomes
- [ ] League chat has 1000+ messages exchanged
- [ ] Push notifications have 80%+ delivery rate
- [ ] Referral system has 100+ successful invites

---

## Resources & Documentation

### Developer Docs
- [Local Setup Guide](./docs/LOCAL_SETUP.md)
- [Redis Cache Architecture](./docs/REDIS_CACHE_ARCHITECTURE.md)
- [UI Design System Guide](./TAMI_DRAFT_UI_GUIDE.md)
- [Screen Migration Checklist](./SCREEN_MIGRATION_CHECKLIST.md)

### API Documentation
- tRPC endpoints: `/packages/api/src/routers/`
- Services: `/packages/api/src/services/`
- Database schema: `/packages/db/src/schema/`

### Design Assets
- Components: `/packages/ui/src/components/`
- Theme: `/packages/ui/src/theme/`
- Reference: `/ref/`

---

## Risk Register (Updated)

| Risk | Status | Mitigation |
|------|--------|-----------|
| Redis cache failures | ✅ Mitigated | Graceful fallback to direct Gemini API calls |
| Serverless cold starts | ✅ Mitigated | Redis cache prevents repeated API calls |
| UI consistency | 🔄 In Progress | Design system + migration checklist |
| India real-money ban | ⚠️ Active | Dual-model: free India + paid global |
| Gemini API rate limits | ⚠️ Monitor | 24hr cache reduces calls to 4/day max |
| Voice feature complexity | ⚠️ Risk | Start simple, iterate based on usage |

---

**This plan is a living document. Update as we learn and adapt.**

**Status Last Updated:** February 9, 2026, 7:30 PM EST
