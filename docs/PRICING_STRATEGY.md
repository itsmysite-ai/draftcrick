# DraftPlay Pricing Strategy & Cost Analysis

> **Date:** March 14, 2026 (v2 — Airline Model, No Free Tier)
> **Status:** DRAFT — for discussion before implementation
> **Markets:** India (primary), US (secondary)
> **Infra:** GCP (Cloud Run, Cloud SQL, Memorystore Redis, Vertex AI Gemini) + Cloudflare CDN
> **Philosophy:** Everyone pays. No free riders. Inspired by airline revenue management.

---

## Table of Contents

1. [The Airline Model — Why It Works for DraftPlay](#1-the-airline-model)
2. [Tier Overview (No Free Tier)](#2-tier-overview)
3. [Infrastructure Cost Breakdown](#3-infrastructure-cost-breakdown)
4. [Per-User Cost Analysis](#4-per-user-cost-analysis)
5. [Day Pass Economics](#5-day-pass-economics)
6. [Recommended Pricing](#6-recommended-pricing)
7. [Revenue Projections](#7-revenue-projections)
8. [Implementation Notes](#8-implementation-notes)

---

## 1. The Airline Model — Why It Works for DraftPlay

### How Airlines Think About Pricing

Airlines don't give away free seats. Every seat has a cost, and the goal is to **fill every seat at the highest price each passenger is willing to pay**. This is called **yield management** — and it's the most profitable pricing model in the services industry.

### Airline ↔ DraftPlay Mapping

| Airline Concept | DraftPlay Equivalent |
|----------------|---------------------|
| **Economy (basic fare)** | **Basic** — you're in the door, bare minimum tools |
| **Premium Economy** | **Pro** — more legroom, better food = more AI, more teams |
| **Business / First Class** | **Elite** — full service, priority everything |
| **Day-of upgrade at gate** | **Day Pass** — upgrade to Elite for today's match |
| **Baggage fees & seat selection** | **Add-on packs** (future: extra Guru questions, extra teams) |
| **Early bird fare** | **Yearly subscription** — commit early, pay less per day |
| **Last-minute walk-up fare** | **Day Pass** — premium per-day price for flexibility |
| **Frequent flyer miles** | **Pop Coins** — loyalty rewards, earned daily |
| **Priority boarding** | **Priority Guru** — Elite gets faster AI responses |
| **Lounge access** | **Elite-exclusive features** (Team Solver, confidence intervals) |
| **Fare classes (Y/B/M/H)** | **Basic/Pro/Elite** — same app, different experience |

### 10 Lessons from Airlines Applied to DraftPlay

**1. No free seats — everyone pays.**
Airlines don't fly passengers for free. Even Spirit/Indigo's cheapest fare covers the seat cost. Our Basic tier is the "ultra-low-cost economy" — cheap enough that anyone can afford it, expensive enough that we never lose money on a user.

**2. Base fare covers cost; ancillaries drive profit.**
Airlines make 20-50% of revenue from ancillaries (bags, food, upgrades). Our Basic tier covers infrastructure cost. Pro/Elite/Day Pass are where profit lives.

**3. Price discrimination is not evil — it's smart.**
Same aircraft, same route, 10 different prices. A passenger who books 3 months early pays ₹3,000. Day-of walk-up pays ₹12,000. Same seat. DraftPlay: yearly subscriber pays ₹2.70/day. Day Pass buyer pays ₹49/day. Same features. Both are happy because they value flexibility differently.

**4. Scarcity and urgency drive purchases.**
"Only 3 seats left at this price!" → "India vs Pakistan tonight — unlock Elite features with Day Pass before toss!" Time-pressure on Day Pass drives impulse buys on big match days.

**5. Unbundle ruthlessly, then let users re-bundle.**
Basic = bare metal. No AI projections, no captain picks, no solver. Want projected points? Go Pro. Want the AI to build your team? Go Elite. Each upgrade feels like a clear, tangible unlock — just like choosing extra legroom or priority boarding.

**6. Dynamic pricing on high-demand days (future).**
Airlines charge 3-5x more for holiday flights. For DraftPlay, future opportunity: Day Pass at ₹49 normally, but ₹69 for IPL Final / India vs Pakistan / T20 World Cup knockout. Higher willingness to pay = higher price. (Not for v1, but architecturally supported.)

**7. Loyalty programs retain and upsell.**
Frequent flyer programs are the #1 retention tool in airlines. Pop Coins serve this purpose — daily drip rewards commitment, and coins can be spent on Day Passes or one-time feature unlocks (future). Elite members earn 10x the coins.

**8. Make the upgrade path feel like a deal.**
Airlines show "Upgrade to Business for just ₹2,000 more!" at check-in. DraftPlay: when a Basic user hits a Pro feature gate, show "Upgrade to Pro for just ₹1.64/day — that's less than a chai!" The annual price divided by 365 always looks tiny.

**9. Annual = checked-in; Day Pass = walk-up.**
Yearly subscribers are like passengers who booked in advance — locked in, predictable revenue, lower cost-to-serve. Day Pass buyers are walk-ups — unpredictable, but they pay a premium for flexibility. Both are good revenue. The mix matters.

**10. Never let a seat fly empty.**
An empty seat on a plane = $0 revenue. A user who bounces because there's no free tier = $0 revenue. The answer isn't free — it's **making Basic so cheap it's a no-brainer**. ₹199/year = ₹0.55/day = literally less than a toffee. The barrier is "do you have a phone?" not "can you afford this?"

---

## 2. Tier Overview

### The 4-Tier Model: Basic / Pro / Elite / Day Pass

| Tier | Airline Equivalent | Billing | Target User |
|------|-------------------|---------|-------------|
| **Basic** | Economy (ultra-low-cost) | Yearly subscription | Casual fans, budget-conscious, "just let me play" |
| **Pro** | Premium Economy | Yearly subscription | Regular players, weekend warriors, want an edge |
| **Elite** | Business / First Class | Yearly subscription | Power users, multi-league grinders, AI maximalists |
| **Day Pass** | Day-of upgrade at gate | Per-day purchase | Match-day warriors who want Elite for the big game |

### Feature Matrix

| Feature | Basic | Pro | Elite | Day Pass |
|---------|-------|-----|-------|----------|
| **Teams per match** | 1 | 3 | 5 | 5 |
| **Guru questions/day** | 5 | 25 | 100 | 100 |
| **Max leagues** | 3 | 10 | 50 | 50 |
| **FDR level** | Basic (overall only) | Full (bat/bowl split) | Full + Historical trends | Full + Historical |
| **Projected points** | ✗ | ✓ | ✓ | ✓ |
| **Confidence intervals** | ✗ | ✗ | ✓ | ✓ |
| **Rate My Team** | ✗ | 10/day | 50/day | 50/day |
| **Captain & VC picks** | ✗ | ✓ | ✓ | ✓ |
| **Differentials** | ✗ | ✓ | ✓ | ✓ |
| **Playing XI prediction** | ✗ | ✓ | ✓ | ✓ |
| **Player compare** | ✗ | 5/day | 25/day | 25/day |
| **Team Solver (AI auto-pick)** | ✗ | ✗ | 20/day | 20/day |
| **Player stats** | Basic (avg, matches) | Full (SR, economy, form) | Full + advanced | Full + advanced |
| **Value tracker** | ✗ | ✓ | ✓ | ✓ |
| **Points breakdown** | ✓ | ✓ | ✓ | ✓ |
| **Stat top fives** | ✓ | ✓ | ✓ | ✓ |
| **Pitch & weather** | ✓ | ✓ | ✓ | ✓ |
| **Head-to-head** | ✓ | ✓ | ✓ | ✓ |
| **Ad-free** | ✗ (ads shown) | ✓ | ✓ | ✓ |
| **Priority Guru** | ✗ | ✗ | ✓ | ✓ |
| **Daily Pop Coins** | 10 | 50 | 200 | 200 |

> **Basic = Economy seat.** You're on the plane. You can play fantasy cricket. But you don't get the AI tools, projections, or captain picks. You get the core game.
>
> **Pro = Premium Economy.** Noticeably better. AI projections, captain picks, 3 teams, player compare. This is the "sweet spot" tier — most users should land here.
>
> **Elite = First Class.** Everything. Team Solver auto-builds optimal teams. 100 Guru questions. Confidence intervals. Priority AI. For the obsessed.
>
> **Day Pass = Gate upgrade.** Full Elite features for 24 hours. Perfect for the user who just wants the best tools for tonight's IPL match.

---

## 3. Infrastructure Cost Breakdown

> Infrastructure section unchanged from v1 — these are GCP costs, independent of pricing model.

### 3A. GCP Cloud Run (API Servers × 2 regions)

| Resource | Price | Free Tier (per month) |
|----------|-------|-----------------------|
| vCPU-second | $0.000024 | 180,000 vCPU-sec |
| GiB-second (memory) | $0.0000025 | 360,000 GiB-sec |
| Requests | $0.40 / million | 2 million |

**Estimated monthly cost per region (right-sized for stage):**

| Stage | Config | Est. Monthly/Region |
|-------|--------|---------------------|
| Beta (500 users) | min 0, max 2 instances, 1 vCPU / 512 MiB | ~$15–25 |
| Growth (5K users) | min 1, max 4 instances, 1 vCPU / 1 GiB | ~$60–100 |
| Scale (50K users) | min 2, max 10 instances, 2 vCPU / 2 GiB | ~$300–500 |

**× 2 regions = double the above.**

### 3B. GCP Cloud SQL for PostgreSQL (× 2 regions)

| Instance | vCPU | RAM | Monthly (us-central1) | Monthly (asia-south1) |
|----------|------|-----|----------------------|----------------------|
| db-f1-micro | shared | 0.6 GB | ~$8 | ~$8 |
| db-g1-small | shared | 1.7 GB | ~$26 | ~$26 |
| db-custom-2-4096 | 2 | 4 GB | ~$75 | ~$70 |
| db-custom-4-8192 | 4 | 8 GB | ~$150 | ~$140 |

**Additional costs:**
- SSD storage: $0.17/GB/month
- Automated backups: $0.08/GB/month
- HA (failover replica): ~doubles vCPU/RAM cost
- Static IP: ~$0.01/hour (~$7/month) if idle

**Recommended per stage:**

| Stage | Instance | Storage | HA | Monthly/Region |
|-------|----------|---------|----|----|
| Beta (500) | db-g1-small | 10 GB SSD | No | ~$28 |
| Growth (5K) | db-custom-2-4096 | 50 GB SSD | Yes | ~$160 |
| Scale (50K) | db-custom-4-8192 | 200 GB SSD | Yes | ~$340 |

### 3C. GCP Memorystore for Redis (× 2 regions)

| Tier | Capacity | $/GB/hour | Monthly |
|------|----------|-----------|---------|
| Basic | 1 GB | ~$0.049 | ~$35 |
| Basic | 5 GB | ~$0.049 | ~$176 |
| Standard (HA) | 1 GB | ~$0.078 | ~$56 |
| Standard (HA) | 5 GB | ~$0.078 | ~$281 |

**Recommended:**

| Stage | Tier | Capacity | Monthly/Region |
|-------|------|----------|---------------|
| Beta (500) | Basic | 1 GB | ~$35 |
| Growth (5K) | Standard | 1 GB | ~$56 |
| Scale (50K) | Standard | 5 GB | ~$281 |

### 3D. Vertex AI — Gemini (AI Engine costs)

| Model | Input $/1M tokens | Output $/1M tokens |
|-------|-------------------|-------------------|
| **Gemini 2.0 Flash** (primary) | $0.15 | $0.60 |
| **Gemini 2.5 Flash** (premium) | $0.30 | $2.50 |
| Gemini 2.0 Flash (batch) | $0.075 | $0.30 |

**Average token usage per AI call (estimated):**

| Feature | Avg Input Tokens | Avg Output Tokens | Cost/Call (2.0 Flash) |
|---------|-----------------|-------------------|----------------------|
| Guru chat question | ~1,500 | ~500 | $0.000525 |
| FDR calculation | ~3,000 | ~1,000 | $0.001050 |
| Projected points | ~2,000 | ~800 | $0.000780 |
| Rate My Team | ~2,500 | ~1,500 | $0.001275 |
| Captain/VC picks | ~2,000 | ~600 | $0.000660 |
| Playing XI prediction | ~2,000 | ~400 | $0.000540 |
| Team Solver | ~4,000 | ~2,000 | $0.001800 |
| Player compare | ~2,000 | ~800 | $0.000780 |
| Differentials | ~2,000 | ~600 | $0.000660 |

> **Key insight:** AI costs per call are tiny ($0.0005–$0.002). Even 100 calls/day = $0.05–$0.20/day max.

### 3E. Cloudflare (CDN + Frontend)

| Plan | Monthly | Features |
|------|---------|----------|
| **Free** | $0 | Global CDN, DDoS protection, SSL, 100K Workers requests/day |
| **Pro** | $20 | WAF, image optimization, 20 page rules, faster cache |

**Recommendation:** Free plan for beta, Pro ($20/mo) from growth stage onward.

### 3F. GCP Networking (Egress)

| Destination | $/GB |
|-------------|------|
| Egress to internet (0-1 TB/mo) | $0.12 |
| Egress to internet (1-10 TB/mo) | $0.11 |
| Cross-region (within GCP) | $0.01 |
| Ingress | Free |

**Estimated egress:**

| Stage | Monthly Egress | Cost |
|-------|---------------|------|
| Beta (500) | ~5 GB | ~$0.60 |
| Growth (5K) | ~50 GB | ~$6 |
| Scale (50K) | ~500 GB | ~$60 |

### 3G. Cloud Logging & Monitoring

| Service | Cost | Free Tier |
|---------|------|-----------|
| Cloud Logging | $0.50/GiB | 50 GiB/month free |
| Cloud Monitoring | $0.258/MiB (metrics) | 150 MiB/month free |

### 3H. Other

- Artifact Registry: $0.10/GB/month (0.5 GB free) → ~$0.50/month
- Firebase Auth: Free for <50K MAU. Phone SMS in India: ~$0.01–0.03/SMS

---

## 4. Per-User Cost Analysis

### Usage Profiles (Revised for Paid-Only Model)

Since all users are paying, even Basic users are more engaged than a "free tier lurker."

| Metric | Basic (Light) | Pro (Medium) | Elite (Heavy) |
|--------|--------------|-------------|--------------|
| **Sessions/day** | 2–3 | 4–6 | 8–15 |
| **API requests/day** | 30–60 | 100–180 | 250–500 |
| **AI calls/day** | 2–5 (Guru only) | 12–25 | 40–100 |
| **DB reads/day** | 25–50 | 80–150 | 200–400 |
| **DB writes/day** | 3–8 | 12–25 | 30–80 |
| **Redis hits/day** | 15–40 | 60–120 | 180–350 |
| **Data transfer/day** | ~1 MB | ~3 MB | ~8 MB |
| **Active days/month** | 12–18 | 18–25 | 25–30 |

### Monthly Per-User Cost Breakdown

#### Basic User (Economy — ~15 active days/month)

| Component | Calculation | Monthly Cost |
|-----------|-------------|-------------|
| Cloud Run compute | ~500 req × 15 days × 50ms = 375 vCPU-sec | $0.009 |
| Cloud SQL (amortized) | ~$0.06/user at 500+ users | $0.06 |
| Redis (amortized) | ~1 KB/user | $0.010 |
| AI (Gemini 2.0 Flash) | 3 calls/day × 15 days × $0.0006/call | $0.027 |
| Egress | ~1 MB × 15 = 15 MB | $0.002 |
| Logging/monitoring | Negligible | $0.00 |
| **TOTAL** | | **~$0.11/month** |
| **TOTAL/year** | | **~$1.30/year** |

#### Pro User (Premium Economy — ~22 active days/month)

| Component | Calculation | Monthly Cost |
|-----------|-------------|-------------|
| Cloud Run compute | ~1800 req × 22 days × 60ms = 2376 vCPU-sec | $0.057 |
| Cloud SQL (amortized) | ~$0.12/user | $0.12 |
| Redis (amortized) | ~3 KB/user | $0.018 |
| AI (Gemini 2.0 Flash) | 18 calls/day × 22 days × $0.0008/call | $0.317 |
| Egress | ~3 MB × 22 = 66 MB | $0.008 |
| Logging | Negligible | $0.00 |
| **TOTAL** | | **~$0.52/month** |
| **TOTAL/year** | | **~$6.24/year** |

#### Elite User (First Class — ~28 active days/month)

| Component | Calculation | Monthly Cost |
|-----------|-------------|-------------|
| Cloud Run compute | ~3500 req × 28 days × 80ms = 7840 vCPU-sec | $0.19 |
| Cloud SQL (amortized) | ~$0.20/user | $0.20 |
| Redis (amortized) | ~5 KB/user | $0.028 |
| AI (Gemini 2.0 Flash) | 70 calls/day × 28 days × $0.0010/call | $1.96 |
| Egress | ~8 MB × 28 = 224 MB | $0.027 |
| Logging | Negligible | $0.00 |
| **TOTAL** | | **~$2.41/month** |
| **TOTAL/year (raw)** | | **~$28.90/year** |
| **TOTAL/year (with caching)** | ~60% AI reduction | **~$15.00/year** |

### Fixed Infrastructure Costs (2 regions combined)

| Stage | Cloud Run | Cloud SQL | Redis | CF | Networking | Other | Total Fixed/mo |
|-------|-----------|-----------|-------|----|------------|-------|---------------|
| Beta (500) | $50 | $56 | $70 | $0 | $1 | $5 | **~$182/mo** |
| Growth (5K) | $200 | $320 | $112 | $20 | $12 | $15 | **~$679/mo** |
| Scale (50K) | $1,000 | $680 | $562 | $20 | $120 | $40 | **~$2,422/mo** |

### Total Cost Per User (Fixed + Variable, blended across tiers)

| Stage | Fixed/User/mo | Variable/User/mo (avg) | Total/User/mo | Total/User/year |
|-------|--------------|----------------------|---------------|----------------|
| Beta (500) | $0.36 | $0.35 | **$0.71** | **$8.52** |
| Growth (5K) | $0.14 | $0.35 | **$0.49** | **$5.88** |
| Scale (50K) | $0.05 | $0.35 | **$0.40** | **$4.80** |

### Cost Summary (the airline P&L view)

| Tier | Our Cost/Year (with caching) | Airline Analogy |
|------|------------------------------|-----------------|
| **Basic** | **~$1.30** | Economy seat: covers fuel + airport fee |
| **Pro** | **~$6.24** | Premium Economy: covers cost + small margin |
| **Elite** | **~$15.00** | First Class: covers cost, ancillaries drive profit |
| **Day Pass** | **~$0.09–$0.21** | Gate upgrade: almost pure margin |

---

## 5. Day Pass Economics

### What does one day of Elite usage cost us?

| Component | Typical Day | Worst-Case Day |
|-----------|-------------|----------------|
| Cloud Run | $0.007 | $0.012 |
| Cloud SQL | $0.007 | $0.010 |
| Redis | $0.001 | $0.002 |
| **AI** | **$0.070** | **$0.188** |
| Egress | $0.001 | $0.003 |
| Fixed infra amortized | $0.002 | $0.002 |
| **TOTAL** | **~$0.088** | **~$0.217** |

**Worst-case scenario** (user maxes every limit):

| Feature | Max Usage | Cost |
|---------|-----------|------|
| 100 Guru questions | 100 × $0.000525 | $0.053 |
| 50 Rate My Team | 50 × $0.001275 | $0.064 |
| 20 Team Solver | 20 × $0.001800 | $0.036 |
| 25 Player compares | 25 × $0.000780 | $0.020 |
| Other AI features | ~20 calls | $0.015 |
| **Total worst-case** | | **$0.217** |

### Airline Analogy: The Day-Of Upgrade

| Metric | Airline Upgrade | DraftPlay Day Pass |
|--------|----------------|--------------------|
| **Marginal cost to provider** | ~$50 (meal, lounge, service) | ~$0.09–$0.21 |
| **Price charged** | $200–$500 | ₹49 (~$0.59) |
| **Margin** | 75–90% | **65–85%** |
| **Why they buy** | "I deserve it for this long flight" | "India vs Pakistan tonight, I need the best tools" |
| **Conversion trigger** | Gate agent asks at check-in | Feature gate when tapping locked feature |

> **Day Pass is the highest-margin product in the lineup** — just like gate upgrades are for airlines.

---

## 6. Recommended Pricing

### The Fare Card

#### India Market (INR)

| Tier | Yearly Price | Per Day | Our Cost/Year | Margin | Airline Equivalent |
|------|-------------|---------|--------------|--------|-------------------|
| **Basic** | **₹199/year** | ₹0.55/day | ~₹108 ($1.30) | **46%** | Economy (IndiGo) |
| **Pro** | **₹799/year** | ₹2.19/day | ~₹520 ($6.24) | **35%** | Premium Economy |
| **Elite** | **₹2,499/year** | ₹6.85/day | ~₹1,250 ($15) | **50%** | Business Class |
| **Day Pass** | **₹49/day** | ₹49/day | ~₹17 ($0.21) | **65%** | Gate upgrade |

#### US Market (USD)

| Tier | Yearly Price | Per Day | Our Cost/Year | Margin | Airline Equivalent |
|------|-------------|---------|--------------|--------|-------------------|
| **Basic** | **$4.99/year** | $0.014/day | ~$1.30 | **74%** | Basic Economy |
| **Pro** | **$14.99/year** | $0.041/day | ~$6.24 | **58%** | Premium Economy |
| **Elite** | **$39.99/year** | $0.110/day | ~$15.00 | **63%** | Business Class |
| **Day Pass** | **$1.99/day** | $1.99/day | ~$0.21 | **89%** | Gate upgrade |

### Why These Numbers Work

**Basic at ₹199/year (₹0.55/day):**
- Cheaper than one cup of chai
- Psychologically "free-ish" — removes friction while still qualifying users
- Covers our cost with 46% margin
- In India, ₹199 is the "auto-approve" price — no one deliberates on ₹199/year
- Filters out bots and non-serious users (a free tier attracts junk signups)
- Benchmark: Cricbuzz Plus is ₹399/year — we're half that for the base tier

**Pro at ₹799/year (₹2.19/day):**
- "Two chai per day" mental model
- Unlocks all the AI features that make DraftPlay special
- This is the "sweet spot" — expect 40-50% of paying users here
- Benchmark: below Hotstar (₹899) and Spotify (₹1,189)

**Elite at ₹2,499/year (₹6.85/day):**
- "One auto ride per day" mental model
- For the obsessed — Team Solver alone is worth it for serious players
- 50% margin with caching optimizations
- Benchmark: below YouTube Premium (₹1,290) + Hotstar (₹899) combined

**Day Pass at ₹49/day:**
- Impulse-buy territory — less than a vada pav meal
- 65% margin even at worst-case usage
- Break-even vs Elite yearly: 51 Day Passes (a user would need to buy Day Pass for 51 matches before yearly becomes cheaper)
- Targets IPL match nights, India vs Pakistan, T20 WC knockouts

### The Fare Classes (Detailed View)

Like airlines publish fare rules, here's what each class gets:

```
┌─────────────────────────────────────────────────────────┐
│  BASIC (₹199/yr)          "Economy"                     │
│  ─────────────────────────────────────────────────────── │
│  ✓ 1 team per match       ✓ Basic FDR                   │
│  ✓ 5 Guru questions/day   ✓ 3 leagues                   │
│  ✓ Basic player stats     ✓ Pitch & weather              │
│  ✓ Head-to-head           ✓ Points breakdown             │
│  ✓ 10 Pop Coins/day       ✗ Ads shown                    │
│  ✗ No projected points    ✗ No captain picks              │
│  ✗ No Rate My Team        ✗ No player compare             │
│  ✗ No Team Solver         ✗ No differentials              │
├─────────────────────────────────────────────────────────┤
│  PRO (₹799/yr)            "Premium Economy"             │
│  ─────────────────────────────────────────────────────── │
│  Everything in Basic PLUS:                               │
│  ✓ 3 teams per match      ✓ Full FDR (bat/bowl)         │
│  ✓ 25 Guru questions/day  ✓ 10 leagues                  │
│  ✓ Projected points       ✓ Captain & VC picks           │
│  ✓ Rate My Team (10/day)  ✓ Playing XI prediction        │
│  ✓ Player compare (5/day) ✓ Differentials                │
│  ✓ Full player stats      ✓ Value tracker                │
│  ✓ Ad-free                ✓ 50 Pop Coins/day             │
│  ✗ No Team Solver         ✗ No confidence intervals       │
│  ✗ No priority Guru                                      │
├─────────────────────────────────────────────────────────┤
│  ELITE (₹2,499/yr)        "Business Class"              │
│  ─────────────────────────────────────────────────────── │
│  Everything in Pro PLUS:                                 │
│  ✓ 5 teams per match      ✓ FDR + historical trends     │
│  ✓ 100 Guru questions/day ✓ 50 leagues                  │
│  ✓ Team Solver (20/day)   ✓ Confidence intervals        │
│  ✓ Rate My Team (50/day)  ✓ Priority Guru responses     │
│  ✓ Player compare (25/day)✓ 200 Pop Coins/day           │
│  ✓ Early access to new features                          │
├─────────────────────────────────────────────────────────┤
│  DAY PASS (₹49/day)       "Gate Upgrade"                │
│  ─────────────────────────────────────────────────────── │
│  Full Elite features for 24 hours from purchase.         │
│  Stacks on top of your base tier.                        │
│  Available to Basic and Pro subscribers.                  │
└─────────────────────────────────────────────────────────┘
```

### Pricing Summary

| | India (INR) | US (USD) |
|---|---|---|
| **Basic Yearly** | ₹199/year | $4.99/year |
| **Pro Yearly** | ₹799/year | $14.99/year |
| **Elite Yearly** | ₹2,499/year | $39.99/year |
| **Day Pass** | ₹49/day | $1.99/day |

---

## 6B. Full Business Cost Analysis (Beyond Infrastructure)

Infrastructure is only ~30-40% of total business cost. Here's everything else:

### Firebase Costs

| Service | Pricing | Our Usage | Monthly Cost |
|---------|---------|-----------|-------------|
| **Firebase Auth** | Free <50K MAU | Auth for all users | **$0** (under 50K) |
| Firebase Auth (50K-100K MAU) | $0.0055/MAU above 50K | At 50K+ users | ~$0–$275/mo |
| **Phone SMS (India)** | ~₹0.50–1.50/SMS (~$0.01–0.02) | OTP on register + login | ~$5–50/mo |
| **Phone SMS (US)** | ~$0.01/SMS (10K free/mo) | Lower volume | ~$0–10/mo |
| **FCM (Push Notifications)** | Free | Unlimited | **$0** |
| Firebase Remote Config | Free | Feature flags | **$0** |
| Firebase Analytics | Free | Event tracking | **$0** |
| Firebase Crashlytics | Free | Crash reporting | **$0** |

**Firebase total at scale (50K users): ~$50–335/month**

### Payment Processing Fees (Revenue Leakage)

This is the **biggest hidden cost** — payment processors take a cut of every transaction.

| Gateway | Fee Structure | Example (₹799 Pro) | Example ($14.99 Pro) |
|---------|-------------|--------------------|--------------------|
| **Razorpay (India)** | 2% + ₹3/txn | ₹18.98 (2.4%) | — |
| **Stripe (US)** | 2.9% + $0.30/txn | — | $0.73 (4.9%) |
| **Apple App Store** | 15% (Small Business <$1M) | ₹119.85 (15%) | $2.25 (15%) |
| **Google Play Store** | 15% (first $1M/yr) | ₹119.85 (15%) | $2.25 (15%) |

> **Critical decision:** If subscriptions go through App Store/Play Store, Apple/Google take **15%** off the top. For ₹2,499 Elite, that's ₹375 gone per user per year.
>
> **Recommendation:** Process payments via Razorpay/Stripe directly (web checkout), NOT through App Store IAP. Apple's rules allow "reader apps" and "consumption apps" to link to web checkout. This saves 12-13% per transaction.

**Payment fee impact at scale (50K users, India-heavy, via Razorpay/Stripe):**

| Tier | Users | Revenue | Razorpay/Stripe Fee | Net After Fees |
|------|-------|---------|--------------------|-|
| Basic (₹199) | 22,500 | ₹44,77,500 | ~₹1,54,125 (3.4%) | ₹43,23,375 |
| Pro (₹799) | 17,500 | ₹1,39,82,500 | ~₹3,43,770 (2.5%) | ₹1,36,38,730 |
| Elite (₹2,499) | 7,500 | ₹1,87,42,500 | ~₹4,12,350 (2.2%) | ₹1,83,30,150 |
| Day Pass (₹49) | 50K txns | ₹24,50,000 | ~₹1,99,000 (8.1%)* | ₹22,51,000 |
| **Total** | | **₹3,96,52,500** | **~₹11,09,245 (~2.8%)** | **₹3,85,43,255** |

*Day Pass has higher % because the ₹3 fixed fee is a larger share of ₹49.

### Platform/Tax Costs

| Tax/Fee | Rate | Applies To | Annual Cost (at 50K users) |
|---------|------|-----------|---------------------------|
| **GST (India)** | 18% on digital services | All INR revenue | ~₹60,80,000 ($73K) collected from users, remitted to govt |
| **US Sales Tax** | 0-10% (varies by state) | US revenue | ~$0–5K (depends on nexus) |
| **TDS on Razorpay** | 1% (Section 194-O) | Razorpay payouts | ~₹3,97,000 ($4.8K) — claimable as credit |
| **Income Tax** | 25-30% | Net profit | Variable |

> **GST note:** GST is collected FROM the user (₹199 + 18% GST = ₹235 shown at checkout, or ₹199 inclusive). We remit to government. This is NOT our cost — but it affects the **sticker price** the user sees. Current prices in the doc are **GST-inclusive** (simpler UX).

### Operational Costs

| Item | Monthly Cost | Annual Cost | Notes |
|------|-------------|-------------|-------|
| **Domain (draftplay.ai)** | — | ~$80–100 | .ai TLD renewal |
| **Email service (transactional)** | ~$20–50 | ~$240–600 | SendGrid/Resend for receipts, welcome emails |
| **SMS beyond Firebase free** | ~$10–100 | ~$120–1,200 | OTPs, match reminders (India SMS is cheap) |
| **Error monitoring (Sentry)** | $0–26 | $0–312 | Free tier → Team plan |
| **GitHub (team)** | $4/user/mo | ~$192 | 4 devs × $4 |
| **CI/CD (GitHub Actions)** | ~$0–50 | ~$0–600 | Free tier covers most; larger builds cost more |
| **Vercel / Web hosting** | $0–20 | $0–240 | Free tier for admin panel, or Cloudflare Pages |
| **Analytics (PostHog/Mixpanel)** | $0–50 | $0–600 | Free tiers generous; paid at scale |
| **Customer support tool** | $0–50 | $0–600 | Crisp/Intercom free tier → paid |
| **Legal/compliance** | ~$100–500 | ~$1,200–6,000 | Privacy policy, T&C, PROGA compliance |
| **Cricket data API** | $0–200 | $0–2,400 | If using CricAPI/SportMonks (currently Gemini?) |
| **Accounting/bookkeeping** | ~$50–200 | ~$600–2,400 | CA fees for GST filing, ITR |
| **Miscellaneous** | ~$50 | ~$600 | Unforeseen costs buffer |

**Total ops at beta: ~$200–400/month**
**Total ops at scale: ~$500–1,500/month**

### Team/Developer Costs

| Role | Monthly Cost (India) | Notes |
|------|---------------------|-------|
| Solo founder (you) | ₹0 (sweat equity) | No salary initially |
| Freelance mobile dev | ₹50K–1.5L/mo | If needed |
| Freelance backend dev | ₹50K–1.5L/mo | If needed |
| Part-time designer | ₹20K–50K/mo | UI/UX, marketing assets |
| **Phase 1 (solo)** | **₹0** | Just you + Claude |
| **Phase 2 (small team)** | **₹1–3L/mo** | 1-2 freelancers |
| **Phase 3 (growth team)** | **₹5–10L/mo** | 3-5 people |

### Marketing & User Acquisition

| Channel | CAC (India) | CAC (US) | Notes |
|---------|------------|---------|-------|
| **Organic (SEO, ASO)** | ₹0–10 | $0–2 | Blog, app store optimization |
| **Social media (organic)** | ₹0–5 | $0–1 | Twitter/X, Instagram cricket content |
| **Google Ads** | ₹30–80 | $3–8 | Search + app install campaigns |
| **Facebook/Instagram Ads** | ₹20–60 | $2–6 | Targeted cricket fans |
| **Influencer (micro)** | ₹10–30 | $2–5 | Cricket YouTubers, Twitter accounts |
| **Referral program** | ₹20–40 | $2–4 | "Invite friend, get 1 month free" |

**Target blended CAC:** ₹25–50/user India, $3–5/user US

**Marketing budget by stage:**

| Stage | Monthly Budget | Users Acquired/Mo | Blended CAC |
|-------|---------------|-------------------|-------------|
| Beta (organic only) | ₹0 | ~50 | ₹0 |
| Growth | ₹50K–1L | ~500–1K | ₹50–100 |
| Scale | ₹5L–10L | ~5K–10K | ₹50–100 |

### Full Cost Summary (All-In)

| Cost Category | Beta (500 users) | Growth (5K) | Scale (50K) |
|--------------|-----------------|-------------|-------------|
| **GCP Infrastructure** | $182/mo | $679/mo | $2,422/mo |
| **Firebase** | $5/mo | $30/mo | $200/mo |
| **AI (Gemini)** | ~$20/mo | ~$200/mo | ~$1,500/mo |
| **Payment processing** | ~$8/mo | ~$80/mo | ~$925/mo |
| **Ops (domain, email, tools)** | ~$100/mo | ~$300/mo | ~$800/mo |
| **Team** | ₹0 | ₹1L/mo (~$120) | ₹5L/mo (~$600) |
| **Marketing** | ₹0 | ₹75K/mo (~$90) | ₹7.5L/mo (~$900) |
| **Legal/compliance** | ~$50/mo | ~$100/mo | ~$300/mo |
| **TOTAL** | **~$365/mo** | **~$1,599/mo** | **~$7,647/mo** |
| **TOTAL/year** | **~$4,380** | **~$19,188** | **~$91,764** |

### Revised Revenue vs. Total Cost

| Stage | Annual Revenue | Annual Total Cost | Net Profit | Margin |
|-------|---------------|-------------------|------------|--------|
| Beta (500) | ~$3,815 | ~$4,380 | **-$565** (small loss) | -15% |
| Growth (5K) | ~$48,978 | ~$19,188 | **$29,790** | **61%** |
| Scale (50K) | ~$530,000 | ~$91,764 | **$438,236** | **83%** |

> **Takeaway:** Beta will be a slight loss (expected — you're investing in product). Growth hits 61% margin. At scale, the business prints money at 83% margin because infrastructure costs are sublinear while revenue scales linearly.

---

## 7. Revenue Projections

### Key Assumption: No Free Tier Changes the Math Dramatically

With a paid-only model, every user generates revenue from day 1. The "conversion rate" question changes from "how many free users convert to paid?" to "which paid tier do users choose?"

### Expected Tier Distribution (Paid-Only Model)

Based on airline class distribution (~70-75% economy, 15-20% premium, 5-10% business):

| Tier | Beta (500) | Growth (5K) | Scale (50K) |
|------|-----------|-------------|-------------|
| Basic | 55% (275) | 50% (2,500) | 45% (22,500) |
| Pro | 30% (150) | 32% (1,600) | 35% (17,500) |
| Elite | 10% (50) | 13% (650) | 15% (7,500) |
| Day Pass only* | 5% (25) | 5% (250) | 5% (2,500) |

*Day Pass users also hold a base tier — this row counts users who primarily buy Day Passes rather than upgrading.

### Beta Phase (500 users, mostly India)

| Segment | Users | Annual Revenue (INR) | Annual Revenue (USD) |
|---------|-------|---------------------|---------------------|
| Basic | 275 | ₹54,725 | $657 |
| Pro | 150 | ₹1,19,850 | $1,438 |
| Elite | 50 | ₹1,24,950 | $1,500 |
| Day Pass | 25 users × 15 passes | ₹18,375 | $221 |
| **Total Revenue** | | **₹3,17,900** | **$3,815** |
| **Infrastructure** | | | **$2,184/yr** |
| **Net** | | | **$1,631/yr profit** |

> **vs. Free-tier model:** The old model projected ~$166/year net at beta. The paid-only model projects **$1,631/year** — 10x better. Because 275 Basic users at ₹199 each = ₹54,725 that was previously ₹0.

### Growth Phase (5,000 users — 80% India, 20% US)

| Segment | India Users | India Revenue | US Users | US Revenue |
|---------|------------|---------------|----------|------------|
| Basic | 2,000 | ₹3,98,000 | 500 | $2,495 |
| Pro | 1,280 | ₹10,22,720 | 320 | $4,797 |
| Elite | 520 | ₹12,99,480 | 130 | $5,199 |
| Day Pass | 200 × 20 | ₹1,96,000 | 50 × 15 | $1,493 |

| | India | US | Total |
|---|---|---|---|
| **Revenue** | ₹29,16,200 (~$35K) | $13,984 | **$48,978/yr** |
| **Infrastructure** | | | **$8,148/yr** |
| **Net** | | | **$40,830/yr** |

> **vs. Free-tier model:** Old model = ~$24,450/yr. Paid-only = **$40,830/yr** — 67% more revenue with the same user count, because Basic users contribute ₹199 each instead of ₹0.

### Scale Phase (50,000 users — 80% India, 20% US)

| Segment | India Users | India Revenue | US Users | US Revenue |
|---------|------------|---------------|----------|------------|
| Basic | 18,000 | ₹35,82,000 | 4,500 | $22,455 |
| Pro | 14,000 | ₹1,11,86,000 | 3,500 | $52,465 |
| Elite | 6,000 | ₹1,49,94,000 | 1,500 | $59,985 |
| Day Pass | 2,000 × 20 | ₹19,60,000 | 500 × 15 | $14,925 |

| | India | US | Total |
|---|---|---|---|
| **Revenue** | ₹3,17,22,000 (~$381K) | $149,830 | **~$530K/yr** |
| **Infrastructure** | | | **~$29K/yr** |
| **Net** | | | **~$501K/yr** |

> **vs. Free-tier model:** Old model = ~$371K/yr. Paid-only = **~$501K/yr** — $130K more per year at 50K users, entirely from Basic tier users who previously paid nothing.

### Revenue Per User Comparison

| Model | Revenue/User/Year (blended) | Cost/User/Year | Net/User |
|-------|---------------------------|----------------|----------|
| **Free-tier model** | ~$8.00 | ~$4.80 | ~$3.20 |
| **Paid-only model** | ~$10.60 | ~$4.80 | **~$5.80** |

> **81% more net revenue per user** with the paid-only model.

---

## 8. Implementation Notes

### Changes to Codebase

1. **Rename `SubscriptionTier` type**: `"free"` → `"basic"`, remove free tier entirely.
   ```typescript
   export type SubscriptionTier = "basic" | "pro" | "elite";
   // "day_pass" is NOT a tier — it's a time-limited overlay
   ```

2. **New pricing fields** (replace `priceMonthly` / `priceInPaise`):
   ```typescript
   interface TierConfig {
     id: SubscriptionTier;
     name: string;
     priceYearlyINR: number;      // 199, 799, 2499
     priceYearlyPaise: number;    // 19900, 79900, 249900
     priceYearlyUSD: number;      // 4.99, 14.99, 39.99
     priceYearlyUSDCents: number; // 499, 1499, 3999
     features: TierFeatures;
     displayFeatures: string[];
   }
   ```

3. **Day Pass model** (separate from tiers):
   ```typescript
   // In users table or separate day_passes table
   dayPassExpiresAt: Date | null;  // null = no active day pass
   dayPassPurchaseCount: number;   // for smart upsell tracking

   // Day Pass pricing (in constants)
   DAY_PASS_INR: 4900,      // ₹49 in paise
   DAY_PASS_USD_CENTS: 199,  // $1.99 in cents
   ```

4. **Effective tier resolution** (the airline "class of service" check):
   ```typescript
   function getEffectiveTier(user: User): SubscriptionTier {
     // Day Pass = temporary Elite override
     if (user.dayPassExpiresAt && user.dayPassExpiresAt > new Date()) {
       return "elite";
     }
     return user.subscriptionTier; // "basic" | "pro" | "elite"
   }
   ```

5. **Auth gate change**: Currently, unauthenticated users go to `/auth/login`. After login, they MUST choose a tier before accessing the app. New flow:
   ```
   No auth → /auth/login → /auth/register → /subscribe/choose-plan → /(tabs)
   ```

6. **Smart upsell triggers** (airline "upgrade at gate" moments):
   - Basic user hits a Pro feature → "Upgrade to Pro — ₹2.19/day"
   - Pro user hits an Elite feature → "Upgrade to Elite — ₹6.85/day" OR "Day Pass for today — ₹49"
   - After 10 Day Pass purchases → "You'd save ₹X with Elite yearly!"
   - At subscription renewal → show usage stats: "You used Team Solver 47 times this month — Elite is the right tier for you"

7. **Payment integration**:
   - **India:** Razorpay — yearly auto-renewing subscriptions + one-time Day Pass
   - **US:** Stripe — yearly subscriptions + one-time Day Pass (also support Google Play / App Store IAP)
   - **Trial:** Consider 7-day free trial of Pro for new Basic signups (airline "try Premium Economy" offer)

### AI Cost Optimization Strategies

1. **Shared cache**: FDR, projections, playing XI, captain picks are per-match, not per-user. Redis cache with 4hr TTL during match day.
2. **Batch API**: Gemini batch (50% cheaper) for pre-match cron jobs (FDR, projections).
3. **Prompt optimization**: Keep prompts under 2K tokens with structured context injection.
4. **Model routing**: Gemini 2.0 Flash for everything. Reserve 2.5 Flash only if quality demands it.
5. **Response caching**: Cache Guru responses by match + question-type. 10 users asking "Captain for MI vs CSK?" get the same cached answer.

### Cost Monitoring

Set up GCP billing alerts:
- Alert at $100/month (beta)
- Alert at $500/month (growth)
- Per-user cost dashboard: track AI spend per tier per month

### Future Airline-Inspired Features (Post-Launch)

| Feature | Airline Parallel | Implementation |
|---------|-----------------|----------------|
| **Dynamic Day Pass pricing** | Holiday surge pricing | ₹49 normal, ₹69 for ICC events, ₹29 for dead rubbers |
| **Add-on packs** | Extra baggage fees | "+10 Guru questions for ₹19", "+2 teams for ₹29" |
| **Pop Coin redemptions** | Miles redemption | Spend 500 coins for a Day Pass (earned over 25 days at Elite) |
| **Referral upgrades** | "Bring a friend, get upgraded" | Refer 3 friends → 1 month free Pro upgrade |
| **Season Pass** | Season ticket | IPL Season Pass: Elite for IPL duration only (₹499) |
| **Bundle pricing** | Flight + hotel packages | DraftPlay + Hotstar bundle (partnership) |

---

## Appendix A: GCP Pricing Sources (March 2026)

| Service | Key Price Points |
|---------|-----------------|
| Cloud Run | $0.000024/vCPU-sec, $0.0000025/GiB-sec, $0.40/M requests |
| Cloud SQL (db-custom-2-4096) | ~$75/mo (us-central1), SSD $0.17/GB/mo |
| Memorystore Redis Basic 1GB | ~$35/mo |
| Memorystore Redis Standard 1GB | ~$56/mo |
| Gemini 2.0 Flash | $0.15/M input tokens, $0.60/M output tokens |
| Gemini 2.5 Flash | $0.30/M input tokens, $2.50/M output tokens |
| Cloudflare Pro | $20/mo |
| GCP Egress | $0.12/GB (0-1TB) |
| Cloud Logging | $0.50/GiB (50 GiB free) |
| Artifact Registry | $0.10/GB (0.5 GB free) |

## Appendix B: Competitor Reference

### Fantasy & Sports Apps

| App | Market | Model | Price |
|-----|--------|-------|-------|
| Dream11 | India | Free-to-play (contest entry fees, 15–20% rake) | No subscription |
| FanDuel | US | Free + DFS entry fees | No subscription |
| DraftKings | US | Free + DFS entry fees | No subscription |
| ESPN Fantasy+ | US | Yearly subscription | $10.99/mo or $109.99/year |
| Yahoo Fantasy+ | US | Season subscription | $9.99/mo or $49.99/season |
| Sleeper+ | US | Yearly | $49.99/year |
| Fantasy Football Hub | UK | Monthly + Day Pass | £4.99/mo or **£2.99 match-day pass** |
| Fantasy Football Scout | UK | Annual + Weekly Pass | £39/year or **£1.50/week** |

### Indian Digital Subscription Benchmarks

| App | Monthly | Annual | Effective Monthly |
|-----|---------|--------|-------------------|
| Cricbuzz Plus | ₹49 | ₹399 | ₹33 |
| Disney+ Hotstar | ₹149 | ₹899 | ₹75 |
| Spotify India | ₹119 | ₹1,189 | ₹99 |
| YouTube Premium | ₹149 | ₹1,290 | ₹107 |
| Amazon Prime | — | ₹1,499 | ₹125 |
| Netflix (Mobile) | ₹149 | — | ₹149 |

### Day Pass Precedents

| Source | Market | Price |
|--------|--------|-------|
| Fantasy Football Hub | UK | £2.99/match day |
| Fantasy Football Scout | UK | £1.50/week |
| Yahoo Fantasy (historical) | US | $1.99/week |
| Indian Telegram tip groups | India | ₹49–99/match |
| Indian fantasy helper apps | India | ₹29–99/match |

### Airline Pricing Benchmarks (for reference)

| Class | India Domestic (avg) | Markup over Economy | DraftPlay Equivalent |
|-------|---------------------|--------------------|--------------------|
| Economy | ₹3,000–5,000 | 1x (base) | Basic (₹199/yr) |
| Premium Economy | ₹6,000–10,000 | 1.5–2x | Pro (₹799/yr = 4x Basic) |
| Business | ₹15,000–30,000 | 4–6x | Elite (₹2,499/yr = 12.5x Basic) |
| Day-of upgrade | ₹2,000–5,000 one-time | N/A | Day Pass (₹49 one-time) |

> The airline multipliers (economy → business = 4-6x) align well with our Basic → Elite ratio of 12.5x. In airlines, the jump is justified by tangible luxury. In DraftPlay, the jump is justified by tangible competitive advantage (AI tools that genuinely help you win).

## Appendix C: Day Pass UX Flow

1. User on Basic/Pro tier taps an Elite-only feature (e.g., Team Solver)
2. Gate screen shows: **"Unlock Elite for today — ₹49 Day Pass"**
3. Also shows: **"Or go Elite yearly — ₹2,499/year (saves ₹X vs Day Passes)"**
4. User taps Day Pass → Razorpay/Stripe one-time payment
5. On success: `dayPassExpiresAt = now + 24 hours`
6. All Elite features unlocked for 24 hours
7. Badge in header: "⚡ Day Pass — 18h remaining"
8. Push notification 1 hour before expiry: "Your Day Pass expires in 1 hour!"
9. After expiry: revert to base tier, show "Enjoyed Elite? Go yearly and save!"
10. After 10th Day Pass: "You've spent ₹490 on Day Passes — Elite is ₹2,499/year. Upgrade now and save!"

## Appendix D: Onboarding Flow (No Free Tier)

Since every user must pick a paid tier, the onboarding UX is critical:

```
1. Welcome screen → "DraftPlay — AI-powered fantasy cricket"
2. Show 3 tiers side-by-side (airline boarding pass design)
   - Basic highlighted as "Most Popular" (reduces choice paralysis)
   - Pro highlighted as "Best Value"
   - Elite highlighted as "For Pros"
3. User selects tier → payment screen (Razorpay/Stripe)
4. Optional: "Try Pro free for 7 days" button (converts well)
5. Payment success → straight to app
6. Day 6 of trial: "Your Pro trial ends tomorrow — keep Pro or switch to Basic?"
```

**Key UX principle:** The tier selection screen should feel like booking a flight — clear comparison, obvious differences, no confusion about what you're getting.
