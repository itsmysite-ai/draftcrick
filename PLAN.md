# DraftCrick - The Next-Gen Fantasy Cricket Platform

> A modern, blazing-fast fantasy cricket platform that takes everything CrickBattle offers and wraps it in a world-class user experience.

---

## 1. Vision & Philosophy

**Core Principle:** *"Powerful for experts, effortless for beginners."*

CrickBattle has 200+ rules, multiple league formats, and deep customization — but its mobile UX is widely criticized, the UI feels dated, and the complexity overwhelms new users. DraftCrick solves this by:

- **Progressive disclosure** — show simple defaults, reveal complexity only when needed
- **Mobile-first design** — the app experience should be *better* than the web, not worse
- **Real-time everything** — live scores, live drafts, live chat, instant updates
- **Zero-friction onboarding** — play your first contest in under 60 seconds

---

## 2. Technology Stack (Cutting Edge, 2026)

### Frontend — Mobile (Primary)

| Layer | Technology | Why |
|-------|-----------|-----|
| **Framework** | **React Native + Expo SDK 52** | Cross-platform (iOS + Android), single codebase, OTA updates, Expo Router for file-based navigation |
| **UI Library** | **Tamagui** | Universal design system, compile-time optimizations, beautiful animations, works on web + native |
| **State Management** | **Zustand + TanStack Query v5** | Zustand for local state (lightweight, no boilerplate), TanStack Query for server state (caching, real-time sync, optimistic updates) |
| **Real-time** | **Socket.io client** | Live scoring, live drafts, live chat |
| **Animations** | **React Native Reanimated 3 + Moti** | 60fps native animations for card flips, score transitions, draft picks |
| **Charts** | **Victory Native** | Beautiful, animated charts for player stats, league standings |
| **Forms** | **React Hook Form + Zod** | Type-safe validation, minimal re-renders |

### Frontend — Web

| Layer | Technology | Why |
|-------|-----------|-----|
| **Framework** | **Next.js 15 (App Router)** | SSR/SSG for SEO (landing pages, player profiles), React Server Components for performance |
| **UI Library** | **Tamagui** (shared with mobile) | Same design tokens and components across web + native |
| **Styling** | **Tamagui + CSS variables** | Dark/light theme, responsive, compile-time CSS extraction |

### Backend

| Layer | Technology | Why |
|-------|-----------|-----|
| **Runtime** | **Node.js 22 (LTS)** | JavaScript everywhere, massive ecosystem |
| **Framework** | **Hono** | Ultra-fast, edge-ready, TypeScript-first, middleware-based |
| **API Protocol** | **tRPC v11** | End-to-end type safety from backend to frontend, no API codegen needed |
| **Real-time** | **Socket.io** | Battle-tested WebSocket library for live scoring, live drafts, chat |
| **Database** | **PostgreSQL 17** (via Neon or Supabase) | ACID transactions, JSONB for flexible league rules, full-text search |
| **ORM** | **Drizzle ORM** | Type-safe, SQL-like syntax, excellent migrations, lightweight |
| **Cache** | **Redis (Upstash)** | Leaderboard caching, session store, rate limiting, pub/sub for real-time |
| **Auth** | **Better Auth** | Modern, self-hosted auth with OAuth, magic links, passkeys, 2FA |
| **Payments** | **Stripe** (global) + **Razorpay** (India) | Contest entry fees, withdrawals, wallet system |
| **Background Jobs** | **BullMQ** (Redis-backed) | Score calculations, notifications, league settlements |
| **Email** | **React Email + Resend** | Beautiful transactional emails, React-based templates |
| **Push Notifications** | **Expo Notifications + FCM/APNs** | Match reminders, draft alerts, score updates |

### Infrastructure & DevOps

| Layer | Technology | Why |
|-------|-----------|-----|
| **Monorepo** | **Turborepo** | Shared packages, parallel builds, remote caching |
| **Language** | **TypeScript 5.5+** everywhere | End-to-end type safety |
| **Hosting (API)** | **Railway** or **Fly.io** | Easy deployment, auto-scaling, edge regions (India + US) |
| **Hosting (Web)** | **Vercel** | Optimized for Next.js, edge functions, CDN |
| **CDN/Storage** | **Cloudflare R2** | Player images, team logos, zero egress fees |
| **CI/CD** | **GitHub Actions** | Automated testing, linting, deployment |
| **Monitoring** | **Sentry** | Error tracking, performance monitoring, session replay |
| **Analytics** | **PostHog** | Product analytics, feature flags, A/B testing |
| **Testing** | **Vitest + Playwright + Detox** | Unit, integration, E2E (web + mobile) |

---

## 3. Feature Breakdown (All CrickBattle Features + Improvements)

### 3.1 Authentication & Onboarding

| Feature | CrickBattle | DraftCrick (Improved) |
|---------|------------|----------------------|
| Sign up | Email/password | **Passkeys, Google, Apple, Phone OTP, Magic Link** |
| Onboarding | None | **Guided wizard**: pick favorite team → choose format → join first free contest in 3 taps |
| KYC | Basic | **Aadhaar/PAN via DigiLocker** (India), ID verification (US/EU) |
| Profile | Basic | **Rich profiles** with win rate, badges, favorite players, league history |

### 3.2 Fantasy League Formats

#### A. Salary Cap Fantasy
- Pick players within a budget (e.g., ₹100 credits)
- Each player has a dynamic price based on form + fixtures
- **DraftCrick improvement:** AI-powered team suggestions, "auto-fill" remaining slots, drag-to-swap UI

#### B. Draft Fantasy
- Snake draft / auction draft among league members
- Each player is unique to one team in the league
- **DraftCrick improvement:** Live draft room with **voice chat**, animated pick reveals, draft timer with suspense animations, post-draft grade

#### C. Auction Fantasy
- Users bid on players with a virtual budget
- Hosted auction rooms with auctioneer flow
- **DraftCrick improvement:** **Live video/audio auction rooms** (like Discord stages), bid paddle animations, "Going once... going twice..." countdown, white-label auction hosting

#### D. Prediction Leagues
- Predict match winner, margin of victory, top scorer, etc.
- No team building required — casual & accessible
- **DraftCrick improvement:** **Swipe-based predictions** (Tinder-style UX), streak bonuses, social sharing of predictions

### 3.3 Sports Coverage

| Sport | Priority |
|-------|---------|
| Cricket (IPL, World Cup, BBL, PSL, T20I, ODI, Tests) | **P0 — Launch** |
| Football (EPL, La Liga, FIFA) | P1 — Phase 2 |
| Kabaddi (PKL) | P2 — Phase 3 |
| Basketball (NBA) | P2 — Phase 3 |

### 3.4 League Management (200+ Rules, Simplified)

CrickBattle's 200+ rules overwhelm users. DraftCrick uses **preset templates** + **advanced mode**:

**Quick Create (3 taps):**
```
1. Pick format: Salary Cap | Draft | Auction | Prediction
2. Pick template: Casual | Competitive | Pro | Custom
3. Invite friends → Done
```

**Advanced Mode (for power users):**
- All 200+ customizable rules grouped into categories
- Team composition (min/max per role, overseas limit)
- Scoring (50+ variables: runs, wickets, catches, economy, strike rate bonuses)
- Boosters (10+ types: captain 2x, vice-captain 1.5x, power player, super sub)
- Trading rules (trade window, waiver wire, top-X protection)
- Playoffs (top N qualify, knockout vs round-robin)
- Salary adjustments per match/series
- Auto-swap for injured/benched players

**Each rule has:**
- Clear label + one-line description
- Default value (sensible preset)
- Tooltip with detailed explanation
- "Reset to default" option

### 3.5 Live Match Experience

| Feature | Implementation |
|---------|---------------|
| **Live Scoring** | WebSocket updates every 5–10 seconds (faster than CrickBattle's 30s) |
| **Ball-by-Ball Feed** | Animated ball-by-ball with run/wicket indicators |
| **Fantasy Points Ticker** | Real-time points calculation overlaid on live score |
| **Player Status** | Injury alerts, playing XI confirmations, toss updates |
| **Mini Scorecard** | Persistent bottom sheet showing your fantasy team's live points |
| **Match Timeline** | Visual timeline of key events (wickets, milestones, powerplay) |

### 3.6 Player Research & Insights

| Feature | Details |
|---------|---------|
| **Player Cards** | Photo, stats, recent form, upcoming fixtures, ownership % |
| **Form Graph** | Last 10 matches performance trend (animated line chart) |
| **Matchup Data** | Player vs specific team/bowler/venue stats |
| **AI Projections** | ML-predicted fantasy points for upcoming match |
| **News Feed** | Aggregated cricket news, injury updates, pitch reports |
| **Comparison Tool** | Side-by-side player comparison |

### 3.7 Social Features

| Feature | Details |
|---------|---------|
| **League Chat** | Real-time group chat per league (text, GIFs, reactions) |
| **1v1 Challenge** | Challenge friends to head-to-head contests |
| **Trash Talk** | Pre/post match banter cards (shareable to WhatsApp/Instagram) |
| **Leaderboards** | Global, friends, league, weekly, season |
| **Activity Feed** | See friends' contests, wins, predictions |
| **Referral System** | Invite friends → both earn bonus credits |

### 3.8 Wallet & Payments

| Feature | Details |
|---------|---------|
| **Digital Wallet** | In-app balance for contest entries |
| **Deposits** | UPI, cards, net banking (India) / Stripe (global) |
| **Withdrawals** | Bank transfer, UPI, PayPal |
| **Transaction History** | Full ledger with filters |
| **Bonus Credits** | Sign-up bonus, referral bonus, streak rewards |
| **Tax Compliance** | TDS deduction (India), 1099 (US) |

### 3.9 Notifications & Engagement

| Feature | Details |
|---------|---------|
| **Smart Push** | Match reminders, team lock deadlines, score milestones |
| **In-App Alerts** | Injury replacements, contest results, friend activity |
| **Daily Digest** | Email summary of upcoming matches, your leagues, player news |
| **Streak Rewards** | Daily login streak → bonus credits |

### 3.10 Admin & Corporate

| Feature | Details |
|---------|---------|
| **Admin Dashboard** | User management, contest management, finance, reports |
| **Corporate Leagues** | White-label league creation for companies |
| **Auction Hosting** | Managed auction events (like CrickBattle's 500+ auctions) |
| **Content Management** | Blog, banners, promotions |
| **Analytics** | User acquisition, retention, revenue, contest fill rates |

---

## 4. UI/UX Design Principles

### Design System: "CrickUI"

**Visual Identity:**
- **Color Palette:** Deep navy (#0A1628) + Electric green (#00F5A0) + Warm white (#F8F9FA)
- **Dark Mode:** Default (better for sports viewing), with light mode option
- **Typography:** Inter (UI) + Space Grotesk (headings) — clean, modern, sporty
- **Iconography:** Custom cricket-themed icon set (bat, ball, stumps, helmet)
- **Motion:** Spring-based animations for all interactions (Reanimated 3)

**UX Patterns:**
1. **Bottom Navigation** — Home, My Contests, Live, Social, Profile
2. **Bottom Sheets** — All secondary actions (team selection, filters, settings)
3. **Swipe Gestures** — Swipe between matches, swipe to predict, swipe to compare
4. **Skeleton Loading** — Never show blank screens, always show loading skeletons
5. **Haptic Feedback** — Subtle vibrations on key actions (team lock, contest join, points scored)
6. **Micro-interactions** — Confetti on wins, animated transitions between screens
7. **Accessibility** — VoiceOver/TalkBack support, dynamic font sizes, color-blind safe palette

**Key Screen Designs:**

```
┌─────────────────────────────┐
│  🏏 DraftCrick              │
│  ─────────────────────────  │
│                              │
│  [LIVE NOW]  IND vs AUS     │
│  ┌─────────────────────┐    │
│  │  🔴 LIVE  186/4      │    │
│  │  Your Points: 147    │    │
│  │  Rank: 3/1,240       │    │
│  │  ▓▓▓▓▓▓▓░░░ Top 5%  │    │
│  └─────────────────────┘    │
│                              │
│  UPCOMING MATCHES            │
│  ┌──────┐ ┌──────┐ ┌──────┐│
│  │CSK vs│ │MI vs │ │RCB vs││
│  │ DC   │ │ KKR  │ │ SRH  ││
│  │2h 30m│ │ TMR  │ │ TMR  ││
│  └──────┘ └──────┘ └──────┘│
│                              │
│  QUICK ACTIONS               │
│  [Join Contest] [Create]     │
│  [Predict]  [Draft Room]     │
│                              │
│  ────────────────────────── │
│  🏠  🏆  🔴  💬  👤        │
│  Home Contest Live Chat Me   │
└─────────────────────────────┘
```

---

## 5. Project Structure (Monorepo)

```
draftcrick/
├── apps/
│   ├── mobile/                 # React Native + Expo app
│   │   ├── app/                # Expo Router (file-based routing)
│   │   │   ├── (tabs)/         # Bottom tab navigator
│   │   │   │   ├── index.tsx          # Home screen
│   │   │   │   ├── contests.tsx       # My contests
│   │   │   │   ├── live.tsx           # Live matches
│   │   │   │   ├── social.tsx         # Social feed
│   │   │   │   └── profile.tsx        # User profile
│   │   │   ├── contest/
│   │   │   │   ├── [id].tsx           # Contest detail
│   │   │   │   ├── create.tsx         # Create contest
│   │   │   │   └── join.tsx           # Join contest
│   │   │   ├── draft/
│   │   │   │   ├── [id].tsx           # Live draft room
│   │   │   │   └── auction/[id].tsx   # Auction room
│   │   │   ├── match/
│   │   │   │   ├── [id].tsx           # Match center
│   │   │   │   └── scorecard.tsx      # Full scorecard
│   │   │   ├── team/
│   │   │   │   ├── create.tsx         # Team builder
│   │   │   │   └── [id].tsx           # Team view
│   │   │   ├── player/
│   │   │   │   └── [id].tsx           # Player profile
│   │   │   ├── wallet/
│   │   │   │   ├── index.tsx          # Wallet home
│   │   │   │   └── transactions.tsx   # Transaction history
│   │   │   ├── auth/
│   │   │   │   ├── login.tsx
│   │   │   │   ├── register.tsx
│   │   │   │   └── onboarding.tsx
│   │   │   └── _layout.tsx            # Root layout
│   │   ├── components/                # Mobile-specific components
│   │   ├── hooks/                     # Mobile-specific hooks
│   │   ├── app.json                   # Expo config
│   │   └── package.json
│   │
│   ├── web/                    # Next.js 15 web app
│   │   ├── app/                # App Router
│   │   │   ├── (marketing)/    # Landing pages (SSG)
│   │   │   ├── (app)/          # Authenticated app pages
│   │   │   ├── api/            # API routes (if needed)
│   │   │   └── layout.tsx
│   │   ├── components/         # Web-specific components
│   │   └── package.json
│   │
│   └── admin/                  # Admin dashboard (Next.js)
│       ├── app/
│       └── package.json
│
├── packages/
│   ├── api/                    # tRPC API server (Hono)
│   │   ├── src/
│   │   │   ├── routers/
│   │   │   │   ├── auth.ts
│   │   │   │   ├── contest.ts
│   │   │   │   ├── draft.ts
│   │   │   │   ├── league.ts
│   │   │   │   ├── match.ts
│   │   │   │   ├── player.ts
│   │   │   │   ├── team.ts
│   │   │   │   ├── wallet.ts
│   │   │   │   ├── notification.ts
│   │   │   │   └── social.ts
│   │   │   ├── services/
│   │   │   │   ├── scoring.ts         # Fantasy points calculation
│   │   │   │   ├── live-data.ts       # Cricket data feed ingestion
│   │   │   │   ├── draft-engine.ts    # Draft/auction logic
│   │   │   │   ├── matchmaking.ts     # Contest auto-fill
│   │   │   │   └── settlement.ts      # Prize distribution
│   │   │   ├── jobs/
│   │   │   │   ├── score-updater.ts   # BullMQ job: fetch live scores
│   │   │   │   ├── settle-contest.ts  # BullMQ job: settle completed contests
│   │   │   │   └── notifications.ts   # BullMQ job: push notifications
│   │   │   ├── ws/
│   │   │   │   ├── live-score.ts      # WebSocket: live scoring
│   │   │   │   ├── draft-room.ts      # WebSocket: draft/auction room
│   │   │   │   └── chat.ts           # WebSocket: league chat
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts
│   │   │   │   ├── rate-limit.ts
│   │   │   │   └── logger.ts
│   │   │   ├── trpc.ts               # tRPC init
│   │   │   └── index.ts              # Server entry
│   │   └── package.json
│   │
│   ├── db/                     # Drizzle ORM schemas + migrations
│   │   ├── src/
│   │   │   ├── schema/
│   │   │   │   ├── users.ts
│   │   │   │   ├── matches.ts
│   │   │   │   ├── players.ts
│   │   │   │   ├── contests.ts
│   │   │   │   ├── leagues.ts
│   │   │   │   ├── teams.ts
│   │   │   │   ├── scores.ts
│   │   │   │   ├── transactions.ts
│   │   │   │   ├── notifications.ts
│   │   │   │   └── index.ts
│   │   │   ├── migrations/
│   │   │   └── index.ts              # DB client export
│   │   ├── drizzle.config.ts
│   │   └── package.json
│   │
│   ├── ui/                     # Shared UI components (Tamagui)
│   │   ├── src/
│   │   │   ├── primitives/           # Button, Input, Card, Badge, etc.
│   │   │   ├── cricket/             # PlayerCard, ScoreCard, MatchCard, etc.
│   │   │   ├── contest/             # ContestCard, LeagueCard, etc.
│   │   │   ├── layout/              # Header, BottomSheet, TabBar, etc.
│   │   │   └── theme/               # Colors, fonts, spacing, tokens
│   │   └── package.json
│   │
│   ├── shared/                 # Shared types, utils, constants
│   │   ├── src/
│   │   │   ├── types/               # TypeScript types
│   │   │   ├── constants/           # Scoring rules, sport configs
│   │   │   ├── utils/               # Date, currency, formatting helpers
│   │   │   └── validators/          # Zod schemas (shared validation)
│   │   └── package.json
│   │
│   └── config/                 # Shared configs
│       ├── eslint/
│       ├── typescript/
│       └── tailwind/
│
├── turbo.json                  # Turborepo config
├── package.json                # Root workspace
├── pnpm-workspace.yaml         # pnpm workspaces
├── .github/
│   └── workflows/
│       ├── ci.yml              # Lint, type-check, test
│       ├── deploy-api.yml      # Deploy API to Railway/Fly
│       ├── deploy-web.yml      # Deploy web to Vercel
│       └── eas-build.yml       # EAS Build for mobile
├── .gitignore
├── .env.example
└── README.md
```

---

## 6. Database Schema (Key Tables)

```sql
-- Users & Auth
users (id, email, phone, username, display_name, avatar_url, role, kyc_status, created_at)
user_profiles (user_id, favorite_team, bio, win_count, contest_count, badge_ids)
wallets (user_id, balance, bonus_balance, total_deposited, total_withdrawn)
transactions (id, user_id, type, amount, status, contest_id, payment_gateway_ref)

-- Cricket Data
matches (id, sport, format, team_home, team_away, venue, start_time, status, live_data_jsonb)
players (id, name, team, role, photo_url, nationality, stats_jsonb)
player_match_scores (player_id, match_id, runs, wickets, catches, fantasy_points, ball_by_ball_jsonb)

-- Fantasy Contests
leagues (id, name, owner_id, format, sport, rules_jsonb, season, is_private, invite_code)
contests (id, league_id, match_id, entry_fee, prize_pool, max_entries, status, prize_distribution_jsonb)
fantasy_teams (id, user_id, contest_id, players_jsonb, captain_id, vc_id, total_points, rank)
draft_rooms (id, league_id, status, current_pick, pick_order_jsonb, time_per_pick)
draft_picks (id, room_id, user_id, player_id, pick_number, round)
trades (id, league_id, from_user, to_user, players_offered, players_requested, status)

-- Predictions
predictions (id, user_id, match_id, prediction_type, prediction_value, is_correct, points_earned)

-- Social
league_messages (id, league_id, user_id, content, type, created_at)
notifications (id, user_id, type, title, body, data_jsonb, is_read, created_at)
referrals (id, referrer_id, referee_id, bonus_awarded, created_at)
```

---

## 7. Implementation Phases

### Phase 0: Foundation (Week 1-2)
- [ ] Initialize Turborepo monorepo with pnpm
- [ ] Set up TypeScript configs, ESLint, Prettier
- [ ] Initialize Expo app with Expo Router
- [ ] Initialize Next.js web app
- [ ] Set up Hono API server with tRPC
- [ ] Set up Drizzle ORM + PostgreSQL schema
- [ ] Set up Tamagui design system with theme tokens
- [ ] Implement auth (Better Auth — email, Google, Apple, phone OTP)
- [ ] Set up CI/CD pipeline (GitHub Actions)

### Phase 1: Core Fantasy — Salary Cap (Week 3-5)
- [ ] Cricket data feed integration (API: CricAPI / SportRadar)
- [ ] Match listing & detail screens
- [ ] Player database & player cards
- [ ] Team builder (salary cap mode)
- [ ] Contest creation & joining
- [ ] Live scoring engine (WebSocket + BullMQ)
- [ ] Fantasy points calculation service
- [ ] Leaderboard & rankings
- [ ] Contest settlement & prize distribution
- [ ] Wallet: deposits & withdrawals (Stripe/Razorpay)

### Phase 2: Draft & Auction (Week 6-8)
- [ ] Draft room (real-time snake draft)
- [ ] Auction room (real-time bidding)
- [ ] Voice/audio in draft rooms (LiveKit or Agora)
- [ ] Player trading system
- [ ] Waiver wire
- [ ] League management dashboard
- [ ] Advanced rule customization (200+ rules via templates)

### Phase 3: Social & Engagement (Week 9-10)
- [ ] League chat (real-time messaging)
- [ ] 1v1 challenges
- [ ] Prediction leagues (swipe UI)
- [ ] Activity feed
- [ ] Push notifications (Expo + FCM/APNs)
- [ ] Referral system
- [ ] Streak rewards & daily bonus

### Phase 4: Web + Admin (Week 11-12)
- [ ] Next.js web app (shared components via Tamagui)
- [ ] Marketing/landing pages (SSG)
- [ ] Admin dashboard (user management, finance, content)
- [ ] Corporate league portal
- [ ] Blog/CMS integration

### Phase 5: Polish & Launch (Week 13-14)
- [ ] Performance optimization (lazy loading, image optimization, bundle splitting)
- [ ] Accessibility audit
- [ ] Security audit (OWASP, pen testing)
- [ ] Load testing (live match day simulation)
- [ ] App Store & Play Store submission
- [ ] Beta launch with invite-only users

### Phase 6: Expansion (Post-Launch)
- [ ] Football support (FutBattle equivalent)
- [ ] Kabaddi, Basketball
- [ ] AI team suggestions (ML model)
- [ ] White-label solution for corporates
- [ ] Internationalization (Hindi, Tamil, Telugu)

---

## 8. Third-Party APIs & Services

| Service | Provider | Purpose |
|---------|----------|---------|
| **Cricket Data** | [CricAPI](https://cricapi.com/) or [SportRadar](https://sportradar.com/) | Live scores, player stats, fixtures |
| **Auth** | Better Auth (self-hosted) | Authentication, sessions |
| **Payments (India)** | Razorpay | UPI, cards, net banking |
| **Payments (Global)** | Stripe | Cards, Apple Pay, Google Pay |
| **KYC (India)** | Digio / HyperVerge | Aadhaar, PAN verification |
| **Voice Chat** | LiveKit (open-source) | Draft room voice |
| **Push Notifications** | Expo + FCM/APNs | Mobile push |
| **Email** | Resend | Transactional emails |
| **SMS (India)** | MSG91 | OTP, notifications |
| **CDN/Storage** | Cloudflare R2 | Media storage |
| **Monitoring** | Sentry | Error tracking |
| **Analytics** | PostHog | Product analytics |

---

## 9. How to Start (Step-by-Step)

### Step 1: Bootstrap the Monorepo
```bash
# Create monorepo with Turborepo
pnpm dlx create-turbo@latest draftcrick --package-manager pnpm

# Add workspace packages
mkdir -p apps/mobile apps/web packages/api packages/db packages/ui packages/shared
```

### Step 2: Set Up the Mobile App
```bash
# Create Expo app
cd apps/mobile
pnpm dlx create-expo-app@latest . --template tabs

# Install key dependencies
pnpm add tamagui @tamagui/config react-native-reanimated
pnpm add @tanstack/react-query zustand
pnpm add socket.io-client
pnpm add react-hook-form zod @hookform/resolvers
```

### Step 3: Set Up the API
```bash
# Create API package
cd packages/api
pnpm add hono @trpc/server @trpc/client
pnpm add drizzle-orm postgres
pnpm add socket.io bullmq ioredis
pnpm add better-auth
```

### Step 4: Set Up the Database
```bash
# Create DB package
cd packages/db
pnpm add drizzle-orm postgres
pnpm add -D drizzle-kit
# Write schema files, then:
pnpm drizzle-kit generate
pnpm drizzle-kit migrate
```

### Step 5: Build Your First Feature
Start with the **Match List → Team Builder → Join Contest** flow:
1. Fetch matches from cricket API
2. Display match cards on home screen
3. Tap match → show available contests
4. Tap contest → team builder (pick 11 players within budget)
5. Submit team → join contest → see leaderboard

---

## 10. Key Differentiators vs CrickBattle

| Area | CrickBattle | DraftCrick |
|------|------------|------------|
| **Mobile App** | Poor UX, APK sideload | Native app, App Store/Play Store |
| **Onboarding** | None | 3-tap guided onboarding |
| **Draft Room** | Basic | Voice chat, animated picks, suspense timer |
| **Auction Room** | Basic | Live video/audio, bid animations |
| **Predictions** | Form-based | Swipe-based (Tinder UX) |
| **League Rules** | 200+ rules, overwhelming | Templates + progressive disclosure |
| **Live Scoring** | 30-second delay | 5-10 second updates |
| **Design** | Dated | Modern dark theme, spring animations |
| **Performance** | Crashes during IPL | Edge-deployed, auto-scaling |
| **Accessibility** | None | Full a11y support |
| **Social** | Basic chat | Rich chat, trash talk cards, activity feed |

---

## 11. Estimated Team & Cost

**Minimum Viable Team (for MVP in 14 weeks):**
- 2 Full-stack developers (React Native + Node.js)
- 1 UI/UX designer
- 1 Backend/DevOps engineer

**Infrastructure Cost (Monthly, Post-Launch):**
- PostgreSQL (Neon): $20-50/mo
- Redis (Upstash): $10-30/mo
- API hosting (Railway): $20-50/mo
- Web hosting (Vercel): $20/mo
- Cricket data API: $50-200/mo
- Sentry/PostHog: Free tier → $30/mo
- **Total: ~$150-400/mo** (scales with users)

---

*This document is the living blueprint for DraftCrick. Update it as decisions are made and features are built.*
