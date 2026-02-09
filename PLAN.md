# DraftCrick — The Next-Gen Fantasy Cricket Platform

> *"Powerful for experts, effortless for everyone."*

A modern, AI-native, GCP-powered fantasy sports platform that delivers every feature CrickBattle offers — wrapped in a world-class, universally accessible experience across Web, iOS, and Android.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [CrickBattle Analysis & Competitive Gap](#2-crickbattle-analysis--competitive-gap)
3. [Technology Stack (GCP-Native)](#3-technology-stack-gcp-native)
4. [Architecture Overview](#4-architecture-overview)
5. [Feature Breakdown (Complete)](#5-feature-breakdown-complete)
6. [AI & MCP Integration](#6-ai--mcp-integration)
7. [UX/UI Design System](#7-uxui-design-system)
8. [Comfort Mode — Universal Accessibility](#8-comfort-mode--universal-accessibility)
9. [Project Structure (Monorepo)](#9-project-structure-monorepo)
10. [Database Schema](#10-database-schema)
11. [Implementation Roadmap](#11-implementation-roadmap)
12. [Third-Party APIs & Services](#12-third-party-apis--services)
13. [GCP Infrastructure & Cost Estimates](#13-gcp-infrastructure--cost-estimates)
14. [How to Start (Step-by-Step)](#14-how-to-start-step-by-step)
15. [Key Differentiators vs CrickBattle](#15-key-differentiators-vs-crickbattle)
16. [Monetization & Pricing Strategy](#16-monetization--pricing-strategy)
17. [Risk Mitigation & Failsafes](#17-risk-mitigation--failsafes)
18. [References](#18-references)

---

## 1. Executive Summary

**Problem:** CrickBattle pioneered series-long fantasy cricket with 1.5M+ users, 200+ customizable rules, and four league formats (Salary Cap, Draft, Auction, Prediction). But its mobile UX is widely criticized, the UI is dated, onboarding is non-existent, accessibility is poor, and servers crash during peak IPL traffic.

**Solution:** DraftCrick takes every CrickBattle feature and rebuilds it from scratch with:
- **GCP-native serverless architecture** that auto-scales during IPL finals
- **AI-powered Cricket Guru** (Gemini/Vertex AI) that helps users build teams and understand rules
- **MCP (Model Context Protocol)** for standardized data aggregation from multiple sports APIs
- **Comfort Mode** — an inclusive, simplified interface with voice navigation, large touch targets, and jargon-free language (not just for the elderly — for anyone who prefers simplicity)
- **Mobile-first design** that makes the app experience *better* than the web

**Target Markets:** India (primary), USA, UK, Australia, Middle East

---

## 2. CrickBattle Analysis & Competitive Gap

### What CrickBattle Does Well
- Four fantasy formats on one platform (Salary Cap, Draft, Auction, Prediction)
- 200+ customizable league rules — deepest customization in the market
- Series-long fantasy (not just daily) — unique differentiator
- Corporate fantasy leagues (200+ enterprise clients)
- Auction hosting service (500+ auctions, white-label)
- Multi-sport: Cricket, Football, Kabaddi

### Where CrickBattle Falls Short (Our Opportunities)

| Pain Point | Evidence | DraftCrick Solution |
|-----------|----------|-------------------|
| **Poor mobile app** | 3.0/5 App Store rating; users say "very bad and irritating" | Native mobile-first app with Expo + Tamagui |
| **No onboarding** | New users are dropped into a complex dashboard | Voice-guided 3-tap onboarding wizard |
| **Visual clutter** | Dense tabs, nested menus, overwhelming information | Progressive disclosure + preset templates |
| **Server crashes** | "Site is down to optimize performance" during IPL | GCP Cloud Run auto-scaling + Memorystore caching |
| **30-second score delay** | Competitors offer faster updates | 5-10 second WebSocket updates via Pub/Sub |
| **APK sideloading** | Android app not on Play Store | Full Play Store + App Store distribution |
| **No accessibility** | Small text, poor contrast, jargon-heavy | WCAG AAA compliance + Comfort Mode |
| **No AI assistance** | Users must research players manually | AI Cricket Guru for team picks, rule explanations |
| **No voice interface** | Zero voice support | Full voice navigation (GCP Speech APIs) |
| **Inconsistent support** | Reviews split on customer service quality | 24/7 AI Help Desk + in-app ticketing |

---

## 3. Technology Stack (GCP-Native)

Every infrastructure component runs on Google Cloud Platform. Application-layer libraries are best-in-class open-source tools.

### Frontend — Mobile (Primary Platform)

| Layer | Technology | Why |
|-------|-----------|-----|
| **Framework** | **React Native + Expo SDK 52** | Cross-platform (iOS + Android + Web), OTA updates, Expo Router for file-based navigation |
| **UI Library** | **Tamagui** | Universal design system with compile-time optimizations, built-in accessibility, shared across mobile + web |
| **Styling** | **NativeWind (Tailwind CSS)** | Utility-first styling, rapid prototyping, consistent spacing/colors |
| **State Management** | **Zustand + TanStack Query v5** | Zustand for client state; TanStack Query for server state with caching, optimistic updates, real-time sync |
| **Real-time Client** | **Socket.io client** | Live scoring, live drafts, live chat |
| **Animations** | **React Native Reanimated 3 + Moti** | 60fps native thread animations — card flips, score transitions, draft picks, confetti |
| **Charts** | **Victory Native** | Animated, interactive charts for player stats and league standings |
| **Forms** | **React Hook Form + Zod** | Type-safe validation, minimal re-renders, shared schemas with backend |
| **Navigation** | **Expo Router v3** | File-based routing, deep links, universal links |

### Frontend — Web

| Layer | Technology | Why |
|-------|-----------|-----|
| **Framework** | **Next.js 15 (App Router)** | SSR/SSG for SEO (landing pages, player profiles), React Server Components |
| **UI Library** | **Tamagui** (shared with mobile) | Same design tokens and components — true code sharing |
| **Hosting** | **Firebase Hosting** | GCP-native, global CDN, automatic SSL, deploy previews |

### Backend — API & Services

| Layer | Technology | Why |
|-------|-----------|-----|
| **Runtime** | **Node.js 22 (LTS)** | TypeScript everywhere, massive ecosystem |
| **Framework** | **Hono** | Ultra-fast, TypeScript-first, runs perfectly on Cloud Run containers |
| **API Protocol** | **tRPC v11** | End-to-end type safety from backend to all frontends, zero codegen |
| **ORM** | **Drizzle ORM** | Type-safe SQL, lightweight, excellent migrations, works great with Cloud SQL |
| **Auth** | **Firebase Auth** | Google-managed; Google, Apple, phone OTP, email/password, anonymous auth; stateless JWTs verified via firebase-admin |
| **Background Jobs** | **BullMQ** (Redis-backed) | Score calculations, contest settlements, notification dispatch |
| **Email** | **React Email + Resend** | Beautiful transactional emails with React-based templates |

### Backend — GCP Infrastructure

| Component | GCP Service | Purpose |
|-----------|------------|---------|
| **Compute (API)** | **Google Cloud Run** | Containerized Hono API server; auto-scales to zero, handles IPL spikes |
| **Compute (Jobs)** | **Google Cloud Functions (2nd gen)** | Event-driven tasks: score updates, settlement triggers, notification sends |
| **Database (Relational)** | **Google Cloud SQL (PostgreSQL 17)** | Users, leagues, contests, transactions — ACID, JSONB, full-text search |
| **Database (Real-time)** | **Google Firestore** | Live scores, chat messages, activity feeds — real-time listeners on client |
| **Cache** | **Google Cloud Memorystore (Redis 7)** | Leaderboard caching, session store, rate limiting, BullMQ backing store |
| **Real-time Messaging** | **Google Cloud Pub/Sub** | Scalable event bus: score events → multiple consumers (WebSocket, notifications, settlement) |
| **WebSocket Server** | **Cloud Run (always-on)** | Socket.io server for live drafts, live scoring, chat; connected to Pub/Sub |
| **Storage** | **Google Cloud Storage** | Player images, team logos, user avatars, static assets |
| **CDN** | **Cloud CDN** (via Firebase Hosting) | Global edge caching for web assets and API responses |
| **Push Notifications** | **Firebase Cloud Messaging (FCM)** | Push notifications to iOS and Android |
| **SMS/OTP** | **Firebase Authentication** (phone auth) | Phone number OTP verification |
| **Secrets** | **Google Secret Manager** | API keys, database credentials, payment gateway secrets |
| **Monitoring** | **Google Cloud Monitoring + Logging** | Infrastructure metrics, alerts, log aggregation |
| **Error Tracking** | **Google Cloud Error Reporting + Sentry** | Application-level error tracking with stack traces |
| **CI/CD** | **Google Cloud Build + GitHub Actions** | Automated testing, building, deploying to Cloud Run/Firebase |
| **Container Registry** | **Google Artifact Registry** | Docker image storage for Cloud Run deployments |

### AI & Intelligence Layer (GCP)

| Component | GCP Service | Purpose |
|-----------|------------|---------|
| **LLM (General)** | **Gemini API (via Vertex AI)** | Cricket Guru chatbot, rule explanations, team suggestions |
| **Custom ML Models** | **Vertex AI (AutoML / Custom Training)** | Player performance predictions, optimal team composition |
| **Speech-to-Text** | **Google Cloud Speech-to-Text v2** | Voice commands: "Hey Guru, who should I captain?" |
| **Text-to-Speech** | **Google Cloud Text-to-Speech** | Voice-guided navigation and rule explanations |
| **Data Aggregation** | **MCP (Model Context Protocol)** | Standardized connections to CricAPI, SportRadar, news feeds |
| **Search** | **Vertex AI Search** | Player search, rule search, help center search |
| **Recommendations** | **Vertex AI Recommendations** | Personalized contest suggestions, player recommendations |

---

## 4. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │  Mobile App   │  │   Web App    │  │ Admin Panel   │              │
│  │ (Expo/RN)    │  │ (Next.js 15) │  │ (Next.js)    │              │
│  │ iOS+Android  │  │ Firebase Host│  │ Firebase Host│              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
│         │ tRPC + Socket.io │                  │                      │
└─────────┼──────────────────┼──────────────────┼──────────────────────┘
          │                  │                  │
┌─────────┼──────────────────┼──────────────────┼──────────────────────┐
│         ▼                  ▼                  ▼   GCP                │
│  ┌─────────────────────────────────────────────────┐                │
│  │              Google Cloud Run                    │                │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐      │                │
│  │  │ Hono API │  │ Socket.io│  │ BullMQ   │      │                │
│  │  │ + tRPC   │  │ Server   │  │ Workers  │      │                │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘      │                │
│  └───────┼──────────────┼──────────────┼────────────┘                │
│          │              │              │                              │
│  ┌───────▼──────────────▼──────────────▼────────────┐                │
│  │              Google Cloud Pub/Sub                 │                │
│  │  (Event bus: score.updated, contest.settled, etc) │                │
│  └───────┬──────────────┬──────────────┬────────────┘                │
│          │              │              │                              │
│  ┌───────▼───────┐ ┌───▼────────┐ ┌───▼──────────┐                  │
│  │ Cloud SQL     │ │ Firestore  │ │ Memorystore  │                  │
│  │ (PostgreSQL)  │ │ (Real-time)│ │ (Redis)      │                  │
│  │ Users,Leagues │ │ Live Score │ │ Leaderboards │                  │
│  │ Contests,Txns │ │ Chat, Feed │ │ Sessions     │                  │
│  └───────────────┘ └────────────┘ └──────────────┘                  │
│                                                                      │
│  ┌──────────────────────────────────────────────┐                    │
│  │              AI / ML LAYER                    │                    │
│  │  ┌──────────┐  ┌──────────┐  ┌────────────┐ │                    │
│  │  │ Gemini   │  │ Vertex AI│  │ Speech APIs│ │                    │
│  │  │ API      │  │ (Custom) │  │ STT / TTS  │ │                    │
│  │  │ Guru Bot │  │ Predict  │  │ Voice Nav  │ │                    │
│  │  └──────────┘  └──────────┘  └────────────┘ │                    │
│  └──────────────────────────────────────────────┘                    │
│                                                                      │
│  ┌──────────────────────────────────────────────┐                    │
│  │              MCP DATA LAYER                   │                    │
│  │  ┌──────────┐  ┌──────────┐  ┌────────────┐ │                    │
│  │  │ CricAPI  │  │ Sports   │  │ News       │ │                    │
│  │  │ Server   │  │ Radar    │  │ Aggregator │ │                    │
│  │  │ (MCP)    │  │ (MCP)    │  │ (MCP)      │ │                    │
│  │  └──────────┘  └──────────┘  └────────────┘ │                    │
│  └──────────────────────────────────────────────┘                    │
└──────────────────────────────────────────────────────────────────────┘
```

### Data Flow: Live Match Scoring
```
CricAPI/SportRadar → MCP Server (Cloud Run)
    → Cloud Pub/Sub (topic: match.ball-bowled)
        → Cloud Function: calculate fantasy points → write Cloud SQL
        → Cloud Function: update Firestore (live score doc)
        → Socket.io Server: broadcast to connected clients
        → Cloud Function: check milestones → FCM push notifications
        → Cloud Function: update Memorystore leaderboard cache
```

### Data Flow: Live Draft Room
```
User picks player → Socket.io → Cloud Run (draft-engine)
    → validate pick → write Cloud SQL (draft_picks)
    → broadcast to room via Socket.io
    → update Firestore (draft room state)
    → Pub/Sub → Cloud Function: send push to next picker
```

---

## 5. Feature Breakdown (Complete)

### 5.1 Authentication & Onboarding

| Feature | CrickBattle | DraftCrick |
|---------|------------|------------|
| Sign up | Email/password only | **Google Sign-In, Apple Sign-In, Phone OTP, Email/Password — all via Firebase Auth** |
| Onboarding | None — dropped into dashboard | **Voice-guided 3-tap wizard**: pick favorite team → choose format → join free contest |
| KYC | Basic | **Aadhaar/PAN via DigiLocker** (India), ID verification via Jumio (US/EU) |
| Profile | Minimal | **Rich profiles**: win rate, badges, favorite players, league history, head-to-head record |
| Age Verification | Self-declared | **Verified**: tied to KYC, geo-fenced restricted states |

### 5.2 Fantasy League Formats

#### A. Salary Cap Fantasy
- Pick players within a credit budget (e.g., ₹100 credits)
- Dynamic player pricing based on form + fixtures + ownership %
- **Improvements:** AI-powered "Auto Pick" fills remaining slots optimally, drag-to-swap UI, "Why this player?" AI explanations, ownership % heat map

#### B. Draft Fantasy (Snake Draft)
- Turn-by-turn player selection; each player unique to one team in the league
- **Improvements:** Live draft room with **voice chat** (GCP Speech), animated pick reveal cards with team colors, suspense countdown timer, post-draft AI grade ("A+ draft — strong bowling attack"), draft recap video-style summary

#### C. Auction Fantasy
- Users bid on players with a virtual budget in real-time auction rooms
- Auctioneer flow: nominate → bid → "Going once... going twice... Sold!"
- **Improvements:** **Live audio rooms** (WebRTC via Cloud Run), bid paddle animations, budget tracker bar, "Smart Bid" AI suggestions, white-label auction hosting for corporates

#### D. Prediction Leagues
- Predict match winner, margin, top scorer, top bowler, toss result
- No team building — casual and accessible to anyone
- **Improvements:** **Swipe-based predictions** (swipe right = Team A wins, left = Team B), streak bonuses (5 correct in a row = 2x points), shareable prediction cards for WhatsApp/Instagram stories

### 5.3 Sports Coverage

| Sport | Priority | Tournaments |
|-------|---------|-------------|
| **Cricket** | P0 — Launch | IPL, ICC World Cup, T20 World Cup, BBL, PSL, CPL, The Hundred, bilateral series |
| **Football** | P1 — Phase 2 | EPL, La Liga, ISL, FIFA World Cup, Champions League |
| **Kabaddi** | P2 — Phase 3 | Pro Kabaddi League |
| **Basketball** | P2 — Phase 3 | NBA |

### 5.4 League Management (200+ Rules, Made Simple)

CrickBattle's 200+ rules are powerful but overwhelming. DraftCrick uses **tiered complexity**:

**Quick Create — 3 taps for casual users:**
```
Step 1: Pick format   → [Salary Cap] [Draft] [Auction] [Predict]
Step 2: Pick template → [Casual] [Competitive] [Pro]
Step 3: Invite friends → Share link → Done
```

**Custom Mode — for power users who want full control:**

All 200+ rules organized into collapsible categories:

| Category | Example Rules |
|----------|--------------|
| **Team Composition** | Min/max per role, overseas player limit, uncapped player slots |
| **Scoring** | 50+ variables: runs, wickets, catches, stumpings, run-outs, economy rate bonuses, strike rate bonuses, milestone bonuses (50s, 100s, 5-wicket hauls) |
| **Boosters** | Captain (2x), Vice-captain (1.5x), Power Player (3x for one match), Super Sub (auto-swap bench player) |
| **Transfers & Trading** | Trade window open/close, waiver wire priority, top-X premium player protection, max trades per week |
| **Playoffs** | Top N qualify, knockout bracket vs round-robin, home advantage rules |
| **Salary Dynamics** | Player price changes per match/series, inflation/deflation rules |
| **Auto-management** | Auto-swap injured players, auto-captain if captain benched |
| **Scoring Modifiers** | Home/away multipliers, powerplay bonus, death overs bonus |

**Every rule includes:**
- Clear label + one-line plain-English description
- Sensible default value (from template)
- Tap-to-expand detailed explanation
- "Reset to default" button
- In Comfort Mode: voice explanation on tap

### 5.5 Live Match Experience

| Feature | Implementation |
|---------|---------------|
| **Live Scoring** | Pub/Sub → Socket.io; updates every **5-10 seconds** (3-6x faster than CrickBattle) |
| **Ball-by-Ball Feed** | Animated ball-by-ball with run/wicket/dot indicators and wagon wheel |
| **Fantasy Points Ticker** | Real-time points overlay on live scorecard — see points accumulate per ball |
| **Player Performance Cards** | Tap any player in your team to see their live stats + projected final points |
| **Mini Scorecard** | Persistent, collapsible bottom sheet: your team's live total, rank, and percentile |
| **Match Timeline** | Horizontal visual timeline: wickets (red dots), milestones (gold), powerplay markers |
| **Playing XI Alert** | Push notification when playing XI is announced (30 min before toss) |
| **Toss Update** | Real-time toss result with impact analysis ("CSK bats first — historically +12% for batsmen picks") |

### 5.6 Player Research & Insights

| Feature | Details |
|---------|---------|
| **Player Cards** | Photo, role badge, team, recent form summary, upcoming fixture, ownership % in your contest |
| **Form Graph** | Last 10 matches animated line chart (fantasy points trend) |
| **Matchup Data** | Player vs. specific team/bowler/venue historical stats |
| **AI Projections** | Vertex AI predicted fantasy points with confidence interval |
| **News Feed** | MCP-aggregated cricket news: injury updates, pitch reports, weather, team news |
| **Comparison Tool** | Side-by-side player comparison (stats, price, form, AI projection) |
| **"Why Pick?"** | AI-generated one-liner explaining why a player is a good/bad pick for this match |

### 5.7 Social & Community

| Feature | Details |
|---------|---------|
| **League Chat** | Real-time per-league group chat (text, GIFs, emoji reactions, reply threads) — Firestore-backed |
| **1v1 Challenge** | Challenge any friend to a head-to-head contest with one tap |
| **Trash Talk Cards** | Pre-designed banter cards (shareable to WhatsApp, Instagram Stories, X) |
| **Leaderboards** | Global, friends-only, league, weekly, monthly, season, all-time |
| **Activity Feed** | See friends' contest joins, wins, predictions, milestones |
| **Referral System** | Invite friends → both earn bonus credits; tiered rewards (5 invites = Silver, 20 = Gold) |
| **Invite Family** | Simplified invite flow with Comfort Mode pre-enabled for invitees who opt in |

### 5.8 Wallet & Payments

| Feature | Details |
|---------|---------|
| **Digital Wallet** | In-app balance; separate cash balance and bonus balance |
| **Deposits (India)** | UPI (GPay, PhonePe), Debit/Credit cards, Net banking — via **Razorpay** |
| **Deposits (Global)** | Cards, Apple Pay, Google Pay — via **Stripe** |
| **Withdrawals** | Bank transfer (IMPS/NEFT), UPI, PayPal |
| **Transaction History** | Full ledger with date filters, category filters, CSV export |
| **Bonus Credits** | Sign-up bonus, referral bonus, daily login streak, first-deposit match |
| **Tax Compliance** | Auto TDS deduction (India, Section 194BA), 1099 reporting (US) |
| **Fraud Detection** | GCP-native anomaly detection on transaction patterns |

### 5.9 Notifications & Engagement

| Feature | Details |
|---------|---------|
| **Smart Push (FCM)** | Match reminders (1h, 15m before), team lock deadlines, score milestones, contest results |
| **In-App Alerts** | Injury replacements needed, friend activity, contest filling up |
| **Daily Digest Email** | Morning email: today's matches, your active leagues, player news, AI picks of the day |
| **Streak Rewards** | 3-day streak: 10 bonus credits; 7-day: 50; 30-day: 500 |
| **Re-engagement** | Gentle nudge if inactive for 3+ days (not spammy — max 1/week) |

### 5.10 Admin & Corporate

| Feature | Details |
|---------|---------|
| **Admin Dashboard** | Next.js admin panel: user management, contest management, finance dashboard, content management |
| **Corporate Leagues** | White-label league creation for companies; custom branding, private player pools |
| **Auction Hosting** | Full managed auction service (like CrickBattle's 500+ auctions); embeddable widget for third-party sites |
| **Content Management** | Blog, promotional banners, announcement system, push notification composer |
| **Analytics** | PostHog + GCP Monitoring: user acquisition funnels, retention cohorts, revenue metrics, contest fill rates |
| **Moderation** | AI-assisted chat moderation (Gemini), user reporting system, automated ban triggers |

---

## 6. AI & MCP Integration

### 6.1 Cricket Guru — AI Assistant

An always-available AI assistant powered by Gemini (via Vertex AI) that lives in a floating action button across the app.

**Capabilities:**
| Interaction | Example | Implementation |
|------------|---------|----------------|
| **Team Building** | "Build me a team for IND vs AUS under ₹80" | Gemini + player stats context via MCP → returns optimized 11 |
| **Player Advice** | "Should I pick Virat or Rohit for tomorrow?" | Gemini + recent form data + venue stats → reasoned comparison |
| **Rule Explanation** | "What does waiver wire mean?" | Gemini + rules knowledge base → plain-English explanation |
| **Match Preview** | "Give me a preview of CSK vs MI" | Gemini + MCP news feed + head-to-head stats → preview card |
| **Voice Interaction** | "Hey Guru, who should I captain?" | GCP Speech-to-Text → Gemini → GCP Text-to-Speech → spoken answer |
| **Onboarding Help** | "I'm new, how do I start?" | Guided walkthrough with contextual tips |

**Architecture:**
```
User message (text or voice)
  → GCP Speech-to-Text (if voice)
  → Vertex AI / Gemini API
      ← MCP Context: player stats, match data, league rules, user's team
  → Response (text + optional card UI)
  → GCP Text-to-Speech (if Comfort Mode / voice)
```

### 6.2 MCP (Model Context Protocol) Data Layer

MCP servers act as standardized connectors between external data sources and DraftCrick's AI/backend systems.

| MCP Server | Data Source | What It Provides |
|-----------|------------|-----------------|
| **Cricket Data MCP** | CricAPI / SportRadar | Live scores, ball-by-ball, player stats, fixtures, playing XI |
| **News MCP** | ESPN Cricinfo, Cricbuzz RSS, Google News | Injury updates, pitch reports, team news, expert opinions |
| **Weather MCP** | OpenWeatherMap | Match-day weather (impacts player selection strategy) |
| **Historical Stats MCP** | Internal DB + StatsGuru | Head-to-head records, venue records, format-specific stats |

**MCP servers run as lightweight Cloud Run services**, exposing standardized tool/resource interfaces that the Gemini-powered Cricket Guru can call.

### 6.3 AI-Powered Features (Beyond the Chatbot)

| Feature | AI Service | Details |
|---------|-----------|---------|
| **Smart Auto-Pick** | Vertex AI | One-tap team builder using ML-optimized player selection |
| **Price Predictor** | Vertex AI AutoML | Predict next-match player price movements for salary cap |
| **Contest Recommender** | Vertex AI Recommendations | "Contests you might like" based on play history + preferences |
| **Churn Prediction** | Vertex AI AutoML | Identify at-risk users → trigger re-engagement campaigns |
| **Chat Moderation** | Gemini API | Auto-flag toxic messages in league chat |
| **Matchup Insights** | Gemini API | Auto-generated "Player X averages 45 at this venue vs. left-arm pace" |

---

## 7. UX/UI Design System

### Design System Name: "CrickUI"

### Visual Identity

| Element | Specification |
|---------|--------------|
| **Color — Primary** | Deep Navy `#0A1628` (backgrounds, depth) |
| **Color — Accent** | Electric Green `#00F5A0` (CTAs, live indicators, wins) |
| **Color — Secondary** | Golden Amber `#FFB800` (captain badge, premium, streaks) |
| **Color — Danger** | Coral Red `#FF4D4F` (wickets, errors, losses) |
| **Color — Surface** | Warm White `#F8F9FA` (cards in light mode) / Charcoal `#1A2332` (dark mode cards) |
| **Dark Mode** | **Default** (better for sports viewing at night); light mode toggle available |
| **Typography** | **Inter** (UI body) + **Space Grotesk** (headings, scores) — clean, modern, sporty |
| **Iconography** | Custom cricket-themed icon set: bat, ball, stumps, helmet, gloves, trophy |
| **Border Radius** | 12px (cards), 8px (buttons), 24px (chips/badges) — rounded but not bubbly |
| **Spacing** | 4px base grid; consistent 8/12/16/24/32px spacing scale |
| **Motion** | Spring-based animations (Reanimated 3): `damping: 15, stiffness: 150` |

### Core UX Patterns

1. **Bottom Tab Navigation** — 5 tabs: Home, My Contests, Live, Social, Profile
2. **Bottom Sheets** — All secondary actions surface as bottom sheets (team selection, filters, rule editing, wallet)
3. **Swipe Gestures** — Swipe between matches, swipe to predict, swipe to compare players
4. **Skeleton Loading** — Never show blank screens; always display content-shaped skeleton placeholders
5. **Haptic Feedback** — Subtle vibration on: team lock, contest join, points scored, draft pick
6. **Micro-interactions** — Confetti burst on wins, spring bounce on button press, smooth card flip for draft picks
7. **Persistent Context Bar** — Always shows: current league name, active match, and "time until lock"
8. **Smart Empty States** — Every empty screen has an illustration + one-tap action ("No contests yet → Join one now")

### Glassmorphism & Premium Feel

- Frosted glass effect on overlays and bottom sheets (`backdrop-filter: blur(20px)`)
- Subtle card elevation with layered shadows for depth hierarchy
- Gradient accents on live match cards (navy → green pulse animation)
- Particle effects on milestone achievements (100 points, first win, etc.)

### Key Screen Wireframes

```
┌──────────────────────────────┐     ┌──────────────────────────────┐
│  Home Screen                  │     │  Team Builder                 │
│  ────────────────────────── │     │  ────────────────────────── │
│  [Avatar] Hi, Rahul   [🔔]  │     │  IND vs AUS • Salary Cap     │
│                               │     │  Budget: ₹23.5 remaining     │
│  ┌─ LIVE NOW ──────────────┐ │     │  ▓▓▓▓▓▓▓▓░░░░ 8/11 picked   │
│  │ 🔴 IND 186/4 • 15.2 ov │ │     │                               │
│  │ Your Points: 147  #3    │ │     │  [WK]  [BAT]  [AR]  [BOWL]  │
│  │ ▓▓▓▓▓▓▓░░░ Top 5%      │ │     │                               │
│  └─────────────────────────┘ │     │  ┌─────────────────────────┐ │
│                               │     │  │ Virat Kohli    ₹10.5   │ │
│  Upcoming Matches             │     │  │ BAT • IND  Form: ████░ │ │
│  ┌──────┐ ┌──────┐ ┌──────┐ │     │  │ AI: 48 pts  Own: 78%   │ │
│  │CSK v │ │MI v  │ │RCB v │ │     │  │ [+ Add]  [Compare]     │ │
│  │ DC   │ │ KKR  │ │ SRH  │ │     │  └─────────────────────────┘ │
│  │2h 30m│ │ TMR  │ │ TMR  │ │     │  ┌─────────────────────────┐ │
│  └──────┘ └──────┘ └──────┘ │     │  │ Rohit Sharma   ₹10.0   │ │
│                               │     │  │ BAT • IND  Form: ███░░ │ │
│  Quick Actions                │     │  │ AI: 42 pts  Own: 65%   │ │
│  [🎯 Join Contest]           │     │  │ [+ Add]  [Compare]     │ │
│  [✏️ Create League]          │     │  └─────────────────────────┘ │
│  [🔮 Predict]                │     │                               │
│  [🎙️ Draft Room]            │     │  ┌─────────────────────────┐ │
│                               │     │  │ 🤖 Cricket Guru         │ │
│  [🏏 Guru]  floating button  │     │  │ "Auto-pick remaining 3" │ │
│                               │     │  └─────────────────────────┘ │
│  ─────────────────────────── │     │                               │
│  🏠  🏆  🔴  💬  👤         │     │  [ Submit Team → ₹49 entry ] │
│  Home Contest Live Chat Me    │     └──────────────────────────────┘
└──────────────────────────────┘
```

---

## 8. Comfort Mode — Universal Accessibility

> **Marketing name: "Comfort Mode"** — not "elderly mode." It's for *anyone* who prefers a simpler, calmer, more guided experience. Parents, grandparents, casual fans, first-time users, or anyone who doesn't want to be overwhelmed.

### Tagline Ideas
- *"Cricket made simple."*
- *"Your game, your pace."*
- *"All the fun, none of the clutter."*

### Activation
- **Onboarding choice:** "How do you want to play?" → `[Full Experience]` / `[Comfort Mode]`
- **Anytime toggle:** Settings → Comfort Mode ON/OFF
- **Invite link variant:** When sharing with family, option to "Send Comfort Mode invite" — invitee lands in Comfort Mode by default

### What Changes in Comfort Mode

| Standard Mode | Comfort Mode |
|--------------|-------------|
| 5 bottom tabs | **3 bottom tabs**: Home, My Team, Help |
| 14pt body text | **18pt minimum** body text |
| WCAG AA contrast | **WCAG AAA contrast** (7:1 ratio) |
| Standard touch targets (44px) | **48x48px minimum** touch targets with extra spacing |
| Technical terms ("H2H", "Draft", "TPB") | **Plain English** ("One-on-One", "Pick Players", "Top Batting Points") |
| Complex dashboard with stats | **Simplified cards** showing only: next match, your team, your rank |
| No voice guidance | **Full voice navigation**: "Tap the green button to join a contest" |
| AI Guru via text | **AI Guru via voice** (auto-enabled): "Hey Guru, pick my team" |
| All 200+ rules visible | **Only essential settings** visible; rest hidden with "Show more" |
| Animation-heavy | **Reduced motion** (respects `prefers-reduced-motion`) |
| Fantasy jargon | **Contextual tooltips** on every term (tap to hear explanation) |

### Accessibility Standards (All Modes)

| Standard | Implementation |
|----------|---------------|
| **WCAG 2.2 AA** (minimum, all modes) | All text, buttons, interactive elements pass contrast and sizing requirements |
| **WCAG 2.2 AAA** (Comfort Mode) | Enhanced contrast (7:1), larger text, more spacing |
| **VoiceOver (iOS)** | Full screen reader support with meaningful labels on all elements |
| **TalkBack (Android)** | Full screen reader support |
| **Dynamic Type** | Respects system font size preferences (iOS + Android) |
| **Color-blind safe** | No information conveyed by color alone; patterns/icons as secondary indicators |
| **Reduced motion** | All animations respect system preference; static alternatives provided |
| **Keyboard navigation** (web) | Full tab-order, focus rings, skip-to-content links |

---

## 9. Project Structure (Monorepo)

```
draftcrick/
├── apps/
│   ├── mobile/                          # React Native + Expo app
│   │   ├── app/                         # Expo Router (file-based routing)
│   │   │   ├── (tabs)/                  # Bottom tab navigator
│   │   │   │   ├── index.tsx                   # Home screen
│   │   │   │   ├── contests.tsx                # My contests
│   │   │   │   ├── live.tsx                    # Live matches
│   │   │   │   ├── social.tsx                  # Social feed
│   │   │   │   └── profile.tsx                 # User profile
│   │   │   ├── (comfort-tabs)/          # Comfort Mode tab navigator (3 tabs)
│   │   │   │   ├── index.tsx                   # Simplified home
│   │   │   │   ├── my-team.tsx                 # My team (simplified)
│   │   │   │   └── help.tsx                    # Help & Guru
│   │   │   ├── contest/
│   │   │   │   ├── [id].tsx                    # Contest detail
│   │   │   │   ├── create.tsx                  # Create contest
│   │   │   │   └── join.tsx                    # Join contest
│   │   │   ├── draft/
│   │   │   │   ├── [id].tsx                    # Live draft room
│   │   │   │   └── auction/[id].tsx            # Auction room
│   │   │   ├── match/
│   │   │   │   ├── [id].tsx                    # Match center
│   │   │   │   └── scorecard.tsx               # Full scorecard
│   │   │   ├── team/
│   │   │   │   ├── create.tsx                  # Team builder
│   │   │   │   └── [id].tsx                    # Team view
│   │   │   ├── player/
│   │   │   │   └── [id].tsx                    # Player profile & stats
│   │   │   ├── guru/
│   │   │   │   └── index.tsx                   # Cricket Guru full-screen chat
│   │   │   ├── wallet/
│   │   │   │   ├── index.tsx                   # Wallet home
│   │   │   │   └── transactions.tsx            # Transaction history
│   │   │   ├── predict/
│   │   │   │   └── [matchId].tsx               # Swipe prediction screen
│   │   │   ├── auth/
│   │   │   │   ├── login.tsx
│   │   │   │   ├── register.tsx
│   │   │   │   └── onboarding.tsx              # 3-step guided onboarding
│   │   │   └── _layout.tsx                     # Root layout (mode-aware)
│   │   ├── components/                  # Mobile-specific components
│   │   ├── hooks/                       # Mobile-specific hooks
│   │   │   ├── useComfortMode.ts               # Comfort Mode state
│   │   │   ├── useVoiceCommand.ts              # GCP Speech integration
│   │   │   └── useLiveScore.ts                 # Socket.io live score hook
│   │   ├── providers/
│   │   │   ├── ComfortModeProvider.tsx         # Context for Comfort Mode
│   │   │   └── AuthProvider.tsx
│   │   ├── app.json
│   │   └── package.json
│   │
│   ├── web/                             # Next.js 15 web app
│   │   ├── app/
│   │   │   ├── (marketing)/             # Landing pages (SSG) — SEO optimized
│   │   │   │   ├── page.tsx                    # Homepage
│   │   │   │   ├── features/page.tsx           # Features showcase
│   │   │   │   ├── comfort-mode/page.tsx       # Comfort Mode landing page
│   │   │   │   └── pricing/page.tsx            # Pricing/contests info
│   │   │   ├── (app)/                   # Authenticated app pages
│   │   │   │   ├── dashboard/page.tsx
│   │   │   │   ├── contest/[id]/page.tsx
│   │   │   │   ├── draft/[id]/page.tsx
│   │   │   │   └── ...
│   │   │   └── layout.tsx
│   │   ├── components/
│   │   └── package.json
│   │
│   └── admin/                           # Admin dashboard (Next.js)
│       ├── app/
│       │   ├── dashboard/page.tsx              # Overview metrics
│       │   ├── users/page.tsx                  # User management
│       │   ├── contests/page.tsx               # Contest management
│       │   ├── finance/page.tsx                # Revenue, withdrawals, TDS
│       │   ├── content/page.tsx                # Blog, banners, promos
│       │   └── moderation/page.tsx             # Flagged content, reports
│       └── package.json
│
├── packages/
│   ├── api/                             # tRPC API server (Hono on Cloud Run)
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
│   │   │   │   ├── social.ts
│   │   │   │   ├── prediction.ts
│   │   │   │   └── guru.ts                    # AI Cricket Guru endpoints
│   │   │   ├── services/
│   │   │   │   ├── scoring.ts                 # Fantasy points calculation engine
│   │   │   │   ├── live-data.ts               # Cricket data feed ingestion (MCP)
│   │   │   │   ├── draft-engine.ts            # Draft/auction state machine
│   │   │   │   ├── matchmaking.ts             # Contest auto-fill algorithm
│   │   │   │   ├── settlement.ts              # Prize distribution logic
│   │   │   │   ├── guru-ai.ts                 # Gemini/Vertex AI integration
│   │   │   │   └── voice.ts                   # GCP Speech-to-Text / Text-to-Speech
│   │   │   ├── jobs/                    # BullMQ background jobs
│   │   │   │   ├── score-updater.ts           # Fetch + calculate live scores
│   │   │   │   ├── settle-contest.ts          # Settle completed contests
│   │   │   │   ├── notifications.ts           # Dispatch push/email/SMS
│   │   │   │   └── data-sync.ts               # Sync MCP data to DB
│   │   │   ├── ws/                      # Socket.io event handlers
│   │   │   │   ├── live-score.ts              # Real-time score broadcasting
│   │   │   │   ├── draft-room.ts              # Draft/auction room events
│   │   │   │   └── chat.ts                    # League chat events
│   │   │   ├── mcp/                     # MCP server implementations
│   │   │   │   ├── cricket-data.ts            # CricAPI/SportRadar MCP
│   │   │   │   ├── news-feed.ts               # News aggregation MCP
│   │   │   │   └── weather.ts                 # Weather data MCP
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts
│   │   │   │   ├── rate-limit.ts
│   │   │   │   ├── logger.ts
│   │   │   │   └── comfort-mode.ts            # Response simplification for Comfort Mode
│   │   │   ├── trpc.ts
│   │   │   ├── pubsub.ts                     # Cloud Pub/Sub client
│   │   │   └── index.ts                      # Hono server entry point
│   │   ├── Dockerfile                   # For Cloud Run deployment
│   │   └── package.json
│   │
│   ├── db/                              # Drizzle ORM schemas + migrations
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
│   │   │   │   ├── predictions.ts
│   │   │   │   ├── draft-rooms.ts
│   │   │   │   ├── social.ts
│   │   │   │   ├── notifications.ts
│   │   │   │   └── index.ts
│   │   │   ├── migrations/
│   │   │   └── index.ts                      # Cloud SQL client export
│   │   ├── drizzle.config.ts
│   │   └── package.json
│   │
│   ├── ui/                              # Shared UI components (Tamagui)
│   │   ├── src/
│   │   │   ├── primitives/              # Button, Input, Card, Badge, Avatar, etc.
│   │   │   ├── cricket/                # PlayerCard, ScoreCard, MatchCard, BallIndicator
│   │   │   ├── contest/               # ContestCard, LeagueCard, PrizeBreakdown
│   │   │   ├── comfort/               # Comfort Mode component variants
│   │   │   │   ├── ComfortButton.tsx
│   │   │   │   ├── ComfortCard.tsx
│   │   │   │   └── ComfortNav.tsx
│   │   │   ├── guru/                  # GuruChat, GuruBubble, GuruSuggestion
│   │   │   ├── layout/               # Header, BottomSheet, TabBar, FAB
│   │   │   └── theme/                # Colors, fonts, spacing, Tamagui tokens
│   │   │       ├── tokens.ts
│   │   │       ├── themes.ts                 # light, dark, comfort-light, comfort-dark
│   │   │       └── animations.ts             # Spring configs, enter/exit animations
│   │   └── package.json
│   │
│   ├── shared/                          # Shared types, utils, constants
│   │   ├── src/
│   │   │   ├── types/                   # TypeScript types (User, Match, Contest, etc.)
│   │   │   ├── constants/              # Scoring rules, sport configs, league templates
│   │   │   │   ├── scoring-rules.ts
│   │   │   │   ├── league-templates.ts       # Casual, Competitive, Pro presets
│   │   │   │   └── comfort-labels.ts         # Jargon → plain English mapping
│   │   │   ├── utils/                  # Date, currency, formatting helpers
│   │   │   └── validators/            # Zod schemas (shared frontend + backend validation)
│   │   └── package.json
│   │
│   └── config/                          # Shared configs
│       ├── eslint/
│       ├── typescript/
│       └── tailwind/
│
├── infra/                               # GCP Infrastructure-as-Code
│   ├── terraform/                       # Terraform configs for GCP resources
│   │   ├── main.tf                     # Cloud Run, Cloud SQL, Memorystore, Pub/Sub
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   ├── cloud-run.tf                # API + WebSocket service definitions
│   │   ├── cloud-sql.tf                # PostgreSQL instance
│   │   ├── memorystore.tf              # Redis instance
│   │   ├── pubsub.tf                   # Topics and subscriptions
│   │   ├── firebase.tf                 # Firebase project config
│   │   ├── vertex-ai.tf               # Vertex AI endpoints
│   │   ├── secrets.tf                  # Secret Manager
│   │   ├── iam.tf                      # Service accounts and permissions
│   │   └── monitoring.tf              # Alerts and dashboards
│   └── cloudbuild/
│       ├── api.yaml                    # Cloud Build config for API
│       ├── web.yaml                    # Cloud Build config for web
│       └── admin.yaml                  # Cloud Build config for admin
│
├── turbo.json                           # Turborepo pipeline config
├── package.json                         # Root workspace
├── pnpm-workspace.yaml                  # pnpm workspaces
├── .github/
│   └── workflows/
│       ├── ci.yml                      # Lint, type-check, test on every PR
│       ├── deploy-api.yml              # Deploy API to Cloud Run
│       ├── deploy-web.yml              # Deploy web to Firebase Hosting
│       ├── deploy-admin.yml            # Deploy admin to Firebase Hosting
│       └── eas-build.yml              # EAS Build for iOS/Android
├── .gitignore
├── .env.example
├── PLAN.md                              # This document
└── README.md
```

---

## 10. Database Schema

### Cloud SQL (PostgreSQL 17) — Relational Data

```sql
-- ==================== USERS & AUTH ====================

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firebase_uid    TEXT UNIQUE NOT NULL,  -- Firebase Auth UID
    email           TEXT UNIQUE,
    phone           TEXT UNIQUE,
    username        TEXT UNIQUE NOT NULL,
    display_name    TEXT NOT NULL,
    avatar_url      TEXT,
    role            TEXT NOT NULL DEFAULT 'user',  -- user, admin, moderator
    kyc_status      TEXT NOT NULL DEFAULT 'pending', -- pending, verified, rejected
    preferred_lang  TEXT NOT NULL DEFAULT 'en',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_profiles (
    user_id         UUID PRIMARY KEY REFERENCES users(id),
    favorite_team   TEXT,
    bio             TEXT,
    win_count       INT NOT NULL DEFAULT 0,
    contest_count   INT NOT NULL DEFAULT 0,
    prediction_streak INT NOT NULL DEFAULT 0,
    badges          JSONB NOT NULL DEFAULT '[]',
    referral_code   TEXT UNIQUE NOT NULL,
    referred_by     UUID REFERENCES users(id),
    login_streak    INT NOT NULL DEFAULT 0,
    last_login_date DATE
);

CREATE TABLE wallets (
    user_id         UUID PRIMARY KEY REFERENCES users(id),
    cash_balance    DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    bonus_balance   DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    total_deposited DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    total_withdrawn DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    total_winnings  DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE transactions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    type            TEXT NOT NULL, -- deposit, withdrawal, entry_fee, winnings, bonus, refund, tds
    amount          DECIMAL(12,2) NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending', -- pending, completed, failed, reversed
    contest_id      UUID REFERENCES contests(id),
    gateway         TEXT, -- razorpay, stripe
    gateway_ref     TEXT,
    metadata        JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==================== CRICKET DATA ====================

CREATE TABLE matches (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id     TEXT UNIQUE NOT NULL,  -- from CricAPI/SportRadar
    sport           TEXT NOT NULL DEFAULT 'cricket',
    format          TEXT NOT NULL, -- t20, odi, test
    tournament      TEXT NOT NULL, -- IPL 2026, T20 World Cup, etc.
    team_home       TEXT NOT NULL,
    team_away       TEXT NOT NULL,
    venue           TEXT NOT NULL,
    city            TEXT,
    start_time      TIMESTAMPTZ NOT NULL,
    status          TEXT NOT NULL DEFAULT 'upcoming', -- upcoming, live, completed, abandoned
    toss_winner     TEXT,
    toss_decision   TEXT, -- bat, bowl
    playing_xi_home JSONB,
    playing_xi_away JSONB,
    result          TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_matches_start_time ON matches(start_time);

CREATE TABLE players (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id     TEXT UNIQUE NOT NULL,
    name            TEXT NOT NULL,
    team            TEXT NOT NULL,
    role            TEXT NOT NULL, -- batsman, bowler, all_rounder, wicket_keeper
    photo_url       TEXT,
    nationality     TEXT,
    batting_style   TEXT,
    bowling_style   TEXT,
    stats           JSONB NOT NULL DEFAULT '{}', -- career stats aggregated
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE player_match_scores (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id       UUID NOT NULL REFERENCES players(id),
    match_id        UUID NOT NULL REFERENCES matches(id),
    runs            INT NOT NULL DEFAULT 0,
    balls_faced     INT NOT NULL DEFAULT 0,
    fours           INT NOT NULL DEFAULT 0,
    sixes           INT NOT NULL DEFAULT 0,
    wickets         INT NOT NULL DEFAULT 0,
    overs_bowled    DECIMAL(4,1) NOT NULL DEFAULT 0,
    runs_conceded   INT NOT NULL DEFAULT 0,
    maidens         INT NOT NULL DEFAULT 0,
    catches         INT NOT NULL DEFAULT 0,
    stumpings       INT NOT NULL DEFAULT 0,
    run_outs        INT NOT NULL DEFAULT 0,
    fantasy_points  DECIMAL(8,2) NOT NULL DEFAULT 0,
    is_playing      BOOLEAN NOT NULL DEFAULT false,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(player_id, match_id)
);
CREATE INDEX idx_pms_match ON player_match_scores(match_id);

-- ==================== FANTASY CONTESTS ====================

CREATE TABLE leagues (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    owner_id        UUID NOT NULL REFERENCES users(id),
    format          TEXT NOT NULL, -- salary_cap, draft, auction, prediction
    sport           TEXT NOT NULL DEFAULT 'cricket',
    tournament      TEXT NOT NULL,
    season          TEXT,
    is_private      BOOLEAN NOT NULL DEFAULT true,
    invite_code     TEXT UNIQUE,
    max_members     INT NOT NULL DEFAULT 10,
    rules           JSONB NOT NULL DEFAULT '{}', -- full rule configuration
    template        TEXT NOT NULL DEFAULT 'casual', -- casual, competitive, pro, custom
    status          TEXT NOT NULL DEFAULT 'active', -- active, completed, archived
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE league_members (
    league_id       UUID NOT NULL REFERENCES leagues(id),
    user_id         UUID NOT NULL REFERENCES users(id),
    role            TEXT NOT NULL DEFAULT 'member', -- owner, admin, member
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (league_id, user_id)
);

CREATE TABLE contests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id       UUID REFERENCES leagues(id),
    match_id        UUID NOT NULL REFERENCES matches(id),
    name            TEXT NOT NULL,
    entry_fee       DECIMAL(10,2) NOT NULL DEFAULT 0,
    prize_pool      DECIMAL(12,2) NOT NULL DEFAULT 0,
    max_entries     INT NOT NULL,
    current_entries INT NOT NULL DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'open', -- open, locked, live, settling, settled, cancelled
    prize_distribution JSONB NOT NULL, -- [{rank: 1, amount: 500}, {rank: 2, amount: 200}, ...]
    contest_type    TEXT NOT NULL DEFAULT 'public', -- public, private, h2h
    is_guaranteed   BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_contests_match ON contests(match_id);
CREATE INDEX idx_contests_status ON contests(status);

CREATE TABLE fantasy_teams (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    contest_id      UUID NOT NULL REFERENCES contests(id),
    players         JSONB NOT NULL, -- [{player_id, role, is_playing}]
    captain_id      UUID NOT NULL REFERENCES players(id),
    vice_captain_id UUID NOT NULL REFERENCES players(id),
    total_points    DECIMAL(8,2) NOT NULL DEFAULT 0,
    rank            INT,
    credits_used    DECIMAL(6,1),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, contest_id)
);

-- ==================== DRAFT & AUCTION ====================

CREATE TABLE draft_rooms (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id       UUID NOT NULL REFERENCES leagues(id),
    type            TEXT NOT NULL, -- snake_draft, auction
    status          TEXT NOT NULL DEFAULT 'waiting', -- waiting, in_progress, completed
    current_turn    INT NOT NULL DEFAULT 0,
    current_round   INT NOT NULL DEFAULT 1,
    pick_order      JSONB NOT NULL, -- [user_id, user_id, ...]
    time_per_pick   INT NOT NULL DEFAULT 60, -- seconds
    current_pick_deadline TIMESTAMPTZ,
    settings        JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE draft_picks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id         UUID NOT NULL REFERENCES draft_rooms(id),
    user_id         UUID NOT NULL REFERENCES users(id),
    player_id       UUID NOT NULL REFERENCES players(id),
    pick_number     INT NOT NULL,
    round           INT NOT NULL,
    bid_amount      DECIMAL(10,2), -- for auction drafts
    picked_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE trades (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id       UUID NOT NULL REFERENCES leagues(id),
    from_user_id    UUID NOT NULL REFERENCES users(id),
    to_user_id      UUID NOT NULL REFERENCES users(id),
    players_offered JSONB NOT NULL, -- [player_id, ...]
    players_requested JSONB NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending', -- pending, accepted, rejected, expired
    expires_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==================== PREDICTIONS ====================

CREATE TABLE predictions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    match_id        UUID NOT NULL REFERENCES matches(id),
    prediction_type TEXT NOT NULL, -- winner, margin, top_scorer, top_bowler, toss
    prediction_value TEXT NOT NULL,
    is_correct      BOOLEAN,
    points_earned   INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, match_id, prediction_type)
);

-- ==================== SOCIAL ====================

CREATE TABLE referrals (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id     UUID NOT NULL REFERENCES users(id),
    referee_id      UUID NOT NULL REFERENCES users(id),
    bonus_amount    DECIMAL(10,2) NOT NULL DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'pending', -- pending, credited
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Notifications stored in Cloud SQL for durability
CREATE TABLE notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    type            TEXT NOT NULL, -- match_reminder, score_milestone, contest_result, social, system
    title           TEXT NOT NULL,
    body            TEXT NOT NULL,
    data            JSONB,
    is_read         BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
```

### Firestore — Real-time Data

```
Firestore Collections:
├── live_scores/
│   └── {matchId}/
│       ├── score: { runs, wickets, overs, currentBatsmen, currentBowler, ... }
│       ├── ball_by_ball: [ { over, ball, runs, wicket, batsman, bowler } ]
│       └── fantasy_points: { {playerId}: points, ... }
│
├── draft_rooms/
│   └── {roomId}/
│       ├── state: { currentTurn, currentRound, deadline, ... }
│       ├── picks: [ { userId, playerId, pickNumber, round, bidAmount } ]
│       └── chat: [ { userId, message, timestamp } ]
│
├── league_chat/
│   └── {leagueId}/
│       └── messages/
│           └── {messageId}: { userId, content, type, reactions, timestamp }
│
├── activity_feed/
│   └── {userId}/
│       └── items/
│           └── {itemId}: { type, actorId, data, timestamp }
│
└── user_presence/
    └── {userId}: { online, lastSeen, currentScreen }
```

---

## 11. Implementation Roadmap

### Phase 0: Foundation & Infrastructure (Weeks 1-3)

| Task | Details | Owner |
|------|---------|-------|
| Initialize Turborepo monorepo | pnpm workspaces, shared TypeScript/ESLint configs | DevOps |
| Provision GCP infrastructure | Terraform: Cloud Run, Cloud SQL, Memorystore, Pub/Sub, Firebase | DevOps |
| Set up CI/CD | Cloud Build + GitHub Actions: lint → test → build → deploy | DevOps |
| Initialize Expo mobile app | Expo SDK 52, Expo Router, Tamagui setup, NativeWind | Frontend |
| Initialize Next.js web app | Next.js 15, Tamagui, Firebase Hosting | Frontend |
| Set up Hono API on Cloud Run | Hono + tRPC, Dockerized, deployed to Cloud Run | Backend |
| Set up Drizzle + Cloud SQL | Schema design, initial migration, connection pooling | Backend |
| Set up Firestore | Real-time collections for live scores, chat | Backend |
| Set up Memorystore (Redis) | BullMQ connection, leaderboard cache, sessions | Backend |
| Implement auth (Firebase Auth) | Email, Google, Apple, Phone OTP; firebase-admin on API server, Firebase JS SDK on clients | Backend |
| Design system foundation | Tamagui tokens, themes (light, dark, comfort-light, comfort-dark), base components | Design/FE |
| Set up Sentry + GCP Monitoring | Error tracking, performance monitoring, alerting | DevOps |

**Exit criteria:** User can sign up, log in, and see a styled home screen on mobile + web. API is deployed on Cloud Run. Database is migrated.

### Phase 1: Core Fantasy — Salary Cap Mode (Weeks 4-7)

| Task | Details |
|------|---------|
| MCP Cricket Data integration | Build MCP server on Cloud Run; ingest fixtures, players, live scores from CricAPI |
| Match listing screen | Upcoming, live, completed tabs; match cards with countdown timers |
| Player database & cards | Player list with search/filter; player detail with stats, form graph (Victory Native) |
| Team builder (salary cap) | Pick 11 players within budget; role filters; drag-to-swap; AI auto-pick via Guru |
| Contest creation & joining | Create public/private contests; entry fee; prize pool; join flow |
| Live scoring engine | Pub/Sub event pipeline: MCP → score calculation → Firestore → Socket.io → client |
| Fantasy points calculation | Configurable scoring rules engine; real-time recalculation per ball |
| Leaderboard & rankings | Redis-cached sorted sets; live rank updates; global + contest + league leaderboards |
| Contest settlement | BullMQ job: calculate final ranks → distribute prizes → update wallets |
| Wallet MVP | Deposits (Razorpay UPI + Stripe cards), withdrawals, transaction history |

**Exit criteria:** User can browse matches, build a team, join a contest, see live scoring, and win/lose money.

### Phase 2: Draft, Auction & League Management (Weeks 8-11)

| Task | Details |
|------|---------|
| Draft room (snake draft) | Real-time WebSocket room; pick timer; animated card reveals; turn indicators |
| Auction room | Bid/counter-bid flow; "Going once" countdown; budget tracker; bid history |
| Voice chat in draft/auction | WebRTC audio via Cloud Run; mute/unmute; speaker indicators |
| Player trading system | Propose trade → notify → accept/reject; waiver wire; top-X protection |
| League management dashboard | Member management, rule editing, standings, schedule |
| 200+ rule customization | Template-based (Casual/Competitive/Pro) + Custom mode with collapsible categories |
| League templates | Pre-configured rule sets; one-tap league creation; shareable template links |

**Exit criteria:** Full draft and auction experience works in real-time. Leagues can be customized with all 200+ rules via templates or custom mode.

### Phase 3: AI, Voice & Comfort Mode (Weeks 12-15)

| Task | Details |
|------|---------|
| Cricket Guru — Text chat | Gemini API integration; team suggestions, rule explanations, match previews |
| Cricket Guru — Voice | GCP Speech-to-Text + Text-to-Speech; "Hey Guru" wake phrase on supported devices |
| MCP context enrichment | Connect Guru to: player stats MCP, news MCP, weather MCP, user's team context |
| AI Auto-Pick | Vertex AI model: input = match + available players → output = optimal 11 |
| AI Player Projections | Vertex AI: predicted fantasy points per player per match |
| Comfort Mode — UI | 3-tab nav, 18pt text, AAA contrast, 48px targets, simplified cards |
| Comfort Mode — Voice nav | Voice-guided navigation: "Tap the green button to join" |
| Comfort Mode — Plain English | Jargon mapping system: H2H → "One-on-One", Draft → "Pick Players" |
| Comfort Mode — Onboarding | Voice-guided 3-step setup wizard for new Comfort Mode users |

**Exit criteria:** Cricket Guru answers questions via text and voice. Comfort Mode provides a fully simplified, voice-guided experience. AI suggestions are accurate and helpful.

### Phase 4: Social, Predictions & Engagement (Weeks 16-18)

| Task | Details |
|------|---------|
| Prediction leagues | Swipe-based predictions UI; streak tracking; results cards |
| League chat | Firestore-backed real-time chat; GIFs, reactions, reply threads |
| 1v1 challenges | Challenge a friend → auto-create H2H contest → notification |
| Activity feed | Firestore activity items: wins, joins, predictions, milestones |
| Trash talk cards | Pre-designed shareable cards; deep links to app |
| Push notifications (FCM) | Match reminders, team lock, score milestones, social activity |
| Email notifications (Resend) | Daily digest, weekly recap, contest results |
| Referral system | Unique referral codes; tiered rewards (Silver/Gold/Platinum) |
| Streak rewards | Daily login tracking; bonus credits at 3/7/14/30 day streaks |

**Exit criteria:** Full social experience. Predictions work with swipe UI. Notifications are timely and relevant.

### Phase 5: Web, Admin & Corporate (Weeks 19-21)

| Task | Details |
|------|---------|
| Web app (full parity) | All mobile features on web via shared Tamagui components |
| Marketing/landing pages | SSG pages: homepage, features, Comfort Mode showcase, download links |
| SEO optimization | Player profile pages, match pages indexed by Google |
| Admin dashboard | User management, contest management, finance (revenue, TDS), content management |
| Corporate league portal | White-label league creation; custom branding; bulk user invites |
| Auction hosting service | Managed auction events; embeddable widget; white-label options |
| Blog/CMS | Markdown-based blog for cricket content; promotional banners |
| Analytics integration | PostHog: funnels, retention cohorts, feature flags, A/B tests |

**Exit criteria:** Web app has full feature parity. Admin can manage all aspects. Corporate clients can create branded leagues.

### Phase 6: Polish, Testing & Launch (Weeks 22-25)

| Task | Details |
|------|---------|
| Performance optimization | Lazy loading, image optimization (Cloud CDN), bundle analysis, memory profiling |
| Accessibility audit | WCAG 2.2 AA (all modes) + AAA (Comfort Mode); test with screen readers |
| Security audit | OWASP top 10 review, pen testing, SQL injection prevention, XSS prevention |
| Load testing | Simulate IPL final traffic: 100K concurrent users; Cloud Run auto-scaling validation |
| Comfort Mode user testing | Test with 20+ users across ages 18-70; iterate based on feedback |
| Cross-platform QA | iOS (iPhone 12-16), Android (Pixel, Samsung), Web (Chrome, Safari, Firefox) |
| Legal & compliance | Terms of service, privacy policy, fantasy sports regulations (India/US) |
| App Store submission | iOS App Store + Google Play Store; app screenshots, descriptions |
| Beta launch | Invite-only beta with 500-1000 users; feedback collection; bug fixes |

**Exit criteria:** App is stable, performant, accessible, and legally compliant. Beta users are satisfied.

### Phase 7: Growth & Expansion (Post-Launch)

| Task | Timeline |
|------|----------|
| Football support (FutBattle equivalent) | Month 2-3 |
| Kabaddi (PKL) | Month 4 |
| Basketball (NBA) | Month 5 |
| Internationalization (Hindi, Tamil, Telugu, Bengali) | Month 3-4 |
| White-label SaaS for corporates | Month 4-6 |
| Advanced AI: ML-based contest recommendations | Month 3-4 |
| Live video auction rooms (WebRTC) | Month 5-6 |
| In-app mini-games (predict-the-ball, boundary catch) | Month 6+ |

---

## 12. Third-Party APIs & Services

| Service | Provider | Purpose | GCP? |
|---------|----------|---------|------|
| **Cricket Data** | CricAPI / SportRadar | Live scores, player stats, fixtures, playing XI | External (via MCP) |
| **Auth** | Firebase Auth (Google-managed) | Google, Apple, Phone OTP, email/password; stateless JWTs | GCP |
| **Payments (India)** | Razorpay | UPI, debit/credit cards, net banking | External |
| **Payments (Global)** | Stripe | Cards, Apple Pay, Google Pay, ACH | External |
| **KYC (India)** | Digio / HyperVerge | Aadhaar, PAN verification via DigiLocker | External |
| **KYC (Global)** | Jumio | ID verification, liveness check | External |
| **Voice Chat** | LiveKit (self-hosted on Cloud Run) | Draft room voice audio | Runs on GCP |
| **Push Notifications** | Firebase Cloud Messaging (FCM) | Mobile push (iOS + Android) | GCP |
| **Email** | Resend + React Email | Transactional emails (receipts, digests, OTP) | External |
| **SMS (India)** | MSG91 | OTP, transactional SMS | External |
| **AI / LLM** | Vertex AI / Gemini API | Cricket Guru chatbot, predictions | GCP |
| **Speech** | GCP Speech-to-Text / Text-to-Speech | Voice commands, voice navigation | GCP |
| **Storage** | Google Cloud Storage | Player images, team logos, user avatars | GCP |
| **CDN** | Cloud CDN (via Firebase Hosting) | Global edge caching | GCP |
| **Error Tracking** | Sentry | Application error tracking + session replay | External |
| **Analytics** | PostHog (self-hosted or cloud) | Product analytics, feature flags, A/B testing | External (can self-host on GCP) |
| **Weather** | OpenWeatherMap | Match-day weather for AI insights | External (via MCP) |

---

## 13. GCP Infrastructure & Cost Estimates

### GCP Services (Monthly, Post-Launch)

| Service | Tier / Config | Estimated Monthly Cost |
|---------|--------------|----------------------|
| **Cloud Run (API)** | 2 vCPU, 1GB RAM, min 1 / max 100 instances | $50-150 |
| **Cloud Run (WebSocket)** | 2 vCPU, 1GB RAM, always-on, min 2 instances | $80-200 |
| **Cloud Run (MCP servers)** | 1 vCPU, 512MB, scale to zero | $10-30 |
| **Cloud SQL (PostgreSQL)** | db-custom-2-4096, 50GB SSD, HA | $100-180 |
| **Memorystore (Redis)** | Basic tier, 1GB | $35-50 |
| **Firestore** | Pay-per-use (reads/writes/deletes) | $20-80 |
| **Cloud Pub/Sub** | Pay-per-message | $5-20 |
| **Cloud Storage** | Standard, 50GB | $1-5 |
| **Cloud CDN** | Per-GB egress | $5-20 |
| **Firebase Hosting** | Spark → Blaze (pay-as-you-go) | $0-25 |
| **Firebase Cloud Messaging** | Free tier (generous) | $0 |
| **Vertex AI / Gemini API** | Pay-per-token | $30-100 |
| **GCP Speech APIs** | Pay-per-minute | $10-40 |
| **Cloud Build** | 120 min/day free, then $0.003/min | $0-15 |
| **Artifact Registry** | 500MB free, then $0.10/GB | $0-5 |
| **Secret Manager** | 6 secret versions free | $0-1 |
| **Cloud Monitoring** | First 150MB logs free | $0-20 |
| **Google Cloud Armor** | DDoS protection (recommended) | $5-25 |
| **─────────────** | **─────────────** | **─────────────** |
| **TOTAL (estimated)** | Scales with traffic | **$350-950/mo** |

### Scaling Projections

| Users | Cloud Run Instances | Cloud SQL | Redis | Est. Monthly |
|-------|-------------------|-----------|-------|-------------|
| 0-10K (beta) | 1-5 | 2 vCPU | 1GB | $350-500 |
| 10K-100K | 5-20 | 4 vCPU, read replica | 3GB | $800-1,500 |
| 100K-500K | 20-50 | 8 vCPU, HA + read replicas | 5GB | $2,000-4,000 |
| 500K-1M | 50-100 | 16 vCPU, multi-region | 10GB | $5,000-10,000 |
| 1M+ (IPL peak) | 100+ (auto-scale) | 32 vCPU, multi-region HA | 25GB | $10,000-25,000 |

### Cost Optimization Strategies
- **Cloud Run min instances = 0** for non-critical services (scale to zero when idle)
- **Cloud SQL**: Use connection pooling (PgBouncer sidecar) to reduce instance needs
- **Firestore**: Careful query design to minimize reads (batch, cache, denormalize)
- **Memorystore**: Cache aggressively (leaderboards, player cards, match lists)
- **Committed Use Discounts**: 1-year commit on Cloud SQL for 25% savings
- **Pub/Sub**: Batch messages where possible; use push subscriptions to Cloud Run

---

## 14. How to Start (Step-by-Step)

### Week 1, Day 1: Project Bootstrap

```bash
# 1. Create monorepo
pnpm dlx create-turbo@latest draftcrick --package-manager pnpm
cd draftcrick

# 2. Create workspace structure
mkdir -p apps/mobile apps/web apps/admin
mkdir -p packages/api/src packages/db/src packages/ui/src packages/shared/src
mkdir -p infra/terraform infra/cloudbuild

# 3. Initialize Expo mobile app
cd apps/mobile
pnpm dlx create-expo-app@latest . --template tabs
pnpm add tamagui @tamagui/config nativewind
pnpm add react-native-reanimated moti
pnpm add @tanstack/react-query zustand
pnpm add socket.io-client
pnpm add react-hook-form zod @hookform/resolvers
pnpm add expo-haptics expo-av

# 4. Initialize Next.js web app
cd ../web
pnpm dlx create-next-app@latest . --typescript --tailwind --app --src-dir
pnpm add tamagui @tamagui/next-plugin

# 5. Set up API package
cd ../../packages/api
pnpm add hono @hono/node-server
pnpm add @trpc/server @trpc/client
pnpm add drizzle-orm postgres
pnpm add socket.io bullmq ioredis
pnpm add firebase-admin
pnpm add @google-cloud/pubsub @google-cloud/speech @google-cloud/text-to-speech
pnpm add -D tsx typescript @types/node

# 6. Set up DB package
cd ../db
pnpm add drizzle-orm postgres
pnpm add -D drizzle-kit typescript
```

### Week 1, Day 2-3: GCP Infrastructure

```bash
# 1. Create GCP project
gcloud projects create draftcrick-prod --name="DraftCrick"
gcloud config set project draftcrick-prod

# 2. Enable required APIs
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  redis.googleapis.com \
  pubsub.googleapis.com \
  firestore.googleapis.com \
  firebase.googleapis.com \
  speech.googleapis.com \
  texttospeech.googleapis.com \
  aiplatform.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  monitoring.googleapis.com

# 3. Create Cloud SQL instance
gcloud sql instances create draftcrick-db \
  --database-version=POSTGRES_17 \
  --tier=db-custom-2-4096 \
  --region=asia-south1 \
  --storage-type=SSD \
  --storage-size=50GB

# 4. Create Memorystore (Redis)
gcloud redis instances create draftcrick-cache \
  --size=1 \
  --region=asia-south1 \
  --redis-version=redis_7_0

# 5. Create Pub/Sub topics
gcloud pubsub topics create match-events
gcloud pubsub topics create score-updates
gcloud pubsub topics create contest-events
gcloud pubsub topics create notification-events

# 6. Initialize Firebase
firebase init firestore hosting

# 7. Create Artifact Registry repo
gcloud artifacts repositories create draftcrick \
  --repository-format=docker \
  --location=asia-south1
```

### Week 1, Day 4-5: First Feature — "See a Match"

Build the simplest vertical slice to prove the architecture works:

1. **MCP Server**: Fetch upcoming cricket matches from CricAPI → expose via MCP tool
2. **API Route**: tRPC `match.list` router → query Cloud SQL → return matches
3. **Background Job**: Cloud Function triggered by Cloud Scheduler → calls MCP → upserts matches to Cloud SQL
4. **Mobile Screen**: Home screen → TanStack Query calls `match.list` → renders match cards with Tamagui
5. **Deploy**: Push API to Cloud Run, web to Firebase Hosting, verify E2E flow

**This proves:** Monorepo builds → API deploys to Cloud Run → DB works → MCP fetches data → Client renders it.

### Week 2: Auth + Team Builder

1. Integrate Firebase Auth (email + Google Sign-In)
2. Build player list screen with search/filter
3. Build team builder with salary cap + drag-to-swap
4. First contest creation flow

### Week 3: Live Scoring Pipeline

1. MCP server polling live scores every 5 seconds
2. Pub/Sub pipeline: MCP → Cloud Function → Firestore + Cloud SQL
3. Socket.io broadcasting to connected clients
4. Fantasy points calculation engine
5. Mobile live score screen with real-time updates

---

## 15. Key Differentiators vs CrickBattle

| Area | CrickBattle | DraftCrick |
|------|------------|------------|
| **Mobile App** | Poor UX (3.0/5), APK sideload | Native app, App Store + Play Store, mobile-first design |
| **Onboarding** | None — dropped into complex dashboard | Voice-guided 3-tap wizard + Comfort Mode for beginners |
| **AI Assistant** | None | **Cricket Guru** (Gemini): team picks, rule explanations, voice interaction |
| **Voice Interface** | None | Full voice navigation + voice commands (GCP Speech) |
| **Accessibility** | Small text, poor contrast, jargon | **WCAG AAA Comfort Mode**, large text, plain English, voice guidance |
| **Draft Room** | Basic, no voice | Voice chat, animated picks, suspense timer, post-draft AI grade |
| **Auction Room** | Basic | Live audio, bid paddle animations, AI bid suggestions |
| **Predictions** | Form-based, tedious | **Swipe-based** (Tinder UX), streaks, shareable cards |
| **League Rules** | 200+ rules, overwhelming dump | **Templates** (Casual/Competitive/Pro) + progressive disclosure Custom mode |
| **Live Scoring** | 30-second delay | **5-10 second** updates via Pub/Sub + Socket.io |
| **Design** | Dated, cluttered | Modern glassmorphism, dark-first, spring animations, haptics |
| **Infrastructure** | Crashes during IPL peaks | **GCP Cloud Run auto-scaling** — handles any traffic spike |
| **Data Intelligence** | Manual research | **MCP-powered** data aggregation + AI projections |
| **Social** | Basic chat | Rich chat, trash talk cards, activity feed, referral tiers |
| **Corporate** | Basic offering | Full white-label, embeddable auction widget, branded experiences |
| **Multi-generational** | Tech-savvy users only | **Comfort Mode**: grandparents can play with grandchildren |

---

## 16. Monetization & Pricing Strategy

### Critical Regulatory Context (August 2025)

India passed **The Promotion and Regulation of Online Gaming Act, 2025** on August 22, 2025, which **completely bans all real-money online games** — including fantasy sports with entry fees — regardless of skill vs. chance classification. Penalties: up to 3 years imprisonment + Rs 1 crore fine. Dream11, My11Circle, MPL, and others have pivoted to free-to-play. The Supreme Court is hearing consolidated challenges (as of Feb 2026), so this *may* be reversed.

**DraftCrick must operate a dual-model approach:** free-to-play for India, real-money for global markets.

### Model A: India (Free-to-Play, Legally Compliant)

#### Revenue Streams

| Revenue Stream | Pricing | Est. Revenue/User/Month |
|---|---|---|
| **Freemium Subscription ("Guru Pro")** | Rs 99/mo or Rs 799/year | Rs 50-80 (blended) |
| **Brand-Sponsored Contests** | Free entry, brands fund prizes (Swiggy/Tata Neu/Amazon model) | Rs 10-30 (ad revenue share) |
| **In-App Purchases** | Cosmetics, premium player cards, team skins: Rs 29-499 | Rs 15-40 |
| **Ad Revenue** | Rewarded video ads, banner ads between screens | Rs 5-15 |
| **Corporate/White-Label** | Rs 2-10 lakh per company per season | High margin, low volume |

#### Subscription Tiers

| Tier | Price | What You Get |
|---|---|---|
| **Free** | Rs 0 | Basic fantasy, 3 contests/day, ads, basic Cricket Guru |
| **Guru Pro** | **Rs 99/month** or **Rs 799/year** | Unlimited contests, AI player projections, advanced stats, ad-free, Comfort Mode voice features, priority support |
| **Guru Elite** | **Rs 299/month** or **Rs 2,499/year** | Everything in Pro + exclusive draft rooms, early access to features, custom league templates, white-label auction hosting (1/month), VIP leaderboards |

#### Sponsored Contest Examples

| Sponsor | Contest | Prize |
|---|---|---|
| Swiggy | "IPL Mega League" | Rs 500 food vouchers to top 100 |
| Amazon | "World Cup Challenge" | Echo Dot devices, Prime memberships |
| Cred | "Weekly H2H Championship" | Cred coins, cashback vouchers |
| PhonePe | "Predict & Win" | Rs 100-500 cashback |

### Model B: Global Markets (Real-Money Contests)

Real-money fantasy is legal in **USA (most states), UK, Australia, UAE, Canada, South Africa**.

#### Contest Pricing (USD)

| Contest Type | Entry Fee | Max Entries | Prize Pool | Commission (Rake) |
|---|---|---|---|---|
| **Free Practice** | $0 | Unlimited | Small prizes / tokens | $0 (acquisition) |
| **Micro Stakes** | $0.25 - $1 | 100-1,000 | $20-800 | 15% |
| **Low Stakes** | $1 - $5 | 50-500 | $40-2,000 | 12-15% |
| **Mid Stakes** | $5 - $25 | 20-200 | $80-4,000 | 10-12% |
| **High Stakes** | $25 - $100 | 10-50 | $200-4,000 | 8-10% |
| **Premium H2H** | $50 - $500 | 2 | $90-900 | 8-10% |
| **Mega GPP** | $5 - $50 | 1,000-10,000 | $5,000-100,000 | 12-15% |

#### Commission Structure

| Contest Size | DraftCrick Rake | Industry Benchmark |
|---|---|---|
| H2H (2 players) | **10%** | Dream11: 10-17%, DraftKings: 10% |
| Small (3-10 players) | **12%** | Dream11: 12-17%, FanDuel: 10-12% |
| Medium (10-100 players) | **12-15%** | Dream11: 15-25%, DraftKings: 12-14% |
| Large (100+ / Mega) | **15%** | Dream11: 16-28%, DraftKings: 12-15% |
| **Blended average** | **~12%** | India avg: 20%, US avg: 10% |

**Positioning:** *"85-90% of every dollar goes to the prize pool"* — undercut Dream11's 15-25% rake and market it as a feature.

### Wallet & Transaction Pricing (Global Markets)

| Action | Fee |
|---|---|
| **Deposit** | Free (absorb 2-3% gateway fees) |
| **Withdrawal** | Free first 2/month; $1 / Rs 50 after |
| **Minimum deposit** | $5 / Rs 100 |
| **Minimum withdrawal** | $10 / Rs 200 |
| **Sign-up bonus** | $5 / Rs 100 (bonus balance, 3x play-through before withdrawal) |
| **First deposit match** | 100% up to $20 / Rs 500 |
| **Referral bonus** | $3 / Rs 50 to both referrer and referee |

### Revenue Projections

| Users | India Revenue/month | Global Revenue/month | **Total** |
|---|---|---|---|
| **10K** (beta) | Rs 3-5 lakh (~$4-6K) | $5-10K | **~$9-16K/mo** |
| **100K** | Rs 30-60 lakh (~$36-72K) | $50-100K | **~$86-172K/mo** |
| **500K** | Rs 1.5-3 crore (~$180-360K) | $200-400K | **~$380-760K/mo** |
| **1M** | Rs 3-6 crore (~$360-720K) | $400-800K | **~$760K-1.5M/mo** |

### Pricing by Market

| Market | Primary Model | Entry Range | Commission | Est. ARPU |
|---|---|---|---|---|
| **India** | Freemium + Ads + Sponsors | Rs 0 (free) | N/A | **Rs 50-120/month** |
| **USA/UK/AU** | Real-money contests | $0.25 - $500 | 10-15% | **$30-80/month** |
| **UAE/Middle East** | Real-money (check local law) | $1 - $100 | 10-12% | **$20-50/month** |
| **Rest of World** | Freemium hybrid | Mixed | 10-12% | **$5-20/month** |

### Strategic Notes

1. **Launch global real-money markets first** (USA, UK, AU, UAE) — that's where the revenue is and it's legal
2. **Launch India as free-to-play from day one** — monetize via Guru Pro subscriptions + sponsors + ads
3. **Monitor Supreme Court case** — if ban is overturned, infrastructure is ready to enable real-money in India instantly
4. **Corporate leagues are ban-proof** — companies pay for the platform, not gambling; target 200+ enterprise clients like CrickBattle
5. **Guru Pro subscription is the moat** — no other fantasy app has an AI assistant; price aggressively at Rs 99/mo
6. **Keep rake at 10-12%** in global markets — lower than competitors, market it as a differentiator

---

## 17. Risk Mitigation & Failsafes

### Technical Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| **Cloud Run cold starts during IPL** | Slow first response | Set `min-instances: 2` for API + WebSocket; use startup probes |
| **Cloud SQL connection limits** | DB bottleneck at scale | PgBouncer sidecar on Cloud Run; connection pooling; read replicas |
| **Firestore read costs explode** | Unexpected bills | Aggressive client-side caching; TanStack Query stale times; denormalize data |
| **Cricket data API goes down** | No live scores | Dual MCP providers (CricAPI + SportRadar); fallback + alerting |
| **Memorystore failure** | Leaderboards stale | Cloud SQL as fallback for leaderboard queries; Redis HA in production tier |
| **WebSocket scaling** | Connection limits | Cloud Run with session affinity; horizontal scaling; Pub/Sub for inter-instance messaging |

### Business Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| **India real-money ban (Aug 2025)** | Cannot charge entry fees in India | Dual-model: free-to-play India + real-money global; Guru Pro subscription; brand-sponsored contests; monitor Supreme Court challenge |
| **Payment gateway issues** | Users can't deposit/withdraw | Dual gateway (Razorpay + Stripe); manual fallback process |
| **Data breach** | User trust destroyed | Encryption at rest (Cloud SQL), in transit (TLS), Secret Manager for keys, security audits |
| **Low adoption of Comfort Mode** | Wasted development effort | Phase it — MVP Comfort Mode in Phase 3, iterate based on usage data |
| **AI hallucinations in Guru** | Bad team advice | Ground Guru responses in real data via MCP; always show data sources; disclaimer on predictions |

### Operational Failsafes

| Scenario | Automated Response |
|----------|-------------------|
| API error rate > 5% | Cloud Monitoring alert → PagerDuty → on-call engineer |
| Cloud SQL CPU > 80% for 10 min | Auto-scale read replicas; alert team |
| Contest settlement fails | BullMQ retry (3x); dead-letter queue; admin notification; manual settlement dashboard |
| Payment webhook missed | Idempotent processing; webhook retry queue; daily reconciliation job |
| Match data feed stops | Alert after 30s silence; switch to backup provider; banner in app: "Scores delayed" |

---

## 18. References

1. CricBattle Official Website — https://www.cricbattle.com/
2. CricBattle iOS App Store — https://apps.apple.com/us/app/cricbattle-fantasy-sports/id1154839276
3. CricBattle CEO Blog (Common Queries) — https://www.cricbattle.com/Blog/CEO-Message-Some-common-user-queries-of-IP-L?id=844
4. Google Cloud Run Documentation — https://cloud.google.com/run/docs
5. Google Vertex AI Documentation — https://cloud.google.com/vertex-ai/docs
6. MCP (Model Context Protocol) Specification — https://modelcontextprotocol.io/
7. Expo Documentation — https://docs.expo.dev/
8. Tamagui Documentation — https://tamagui.dev/
9. tRPC Documentation — https://trpc.io/
10. Drizzle ORM Documentation — https://orm.drizzle.team/
11. WCAG 2.2 Guidelines — https://www.w3.org/TR/WCAG22/

---

*This is the single source of truth for the DraftCrick project. All architectural decisions, feature specs, and implementation details live here. Update this document as the project evolves.*
