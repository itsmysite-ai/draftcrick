# Cricket Manager — Full Implementation Design

> **Status:** Design Phase
> **Working Title:** Cricket Manager
> **Concept:** A no-budget, multi-member tactical contest. Members each pick 11 players from a multi-day match window, set their batting order and bowling priority, then watch a **live 120-ball internal match** unfold as real cricket happens. Each member's Batting Total races against their own Bowling Total — the resulting NRR is compared on a shared contest leaderboard. Highest NRR wins the prize pool.

---

## Table of Contents

1. [How It Works (End-to-End)](#1-how-it-works-end-to-end)
2. [The 120-Ball Engine](#2-the-120-ball-engine)
3. [Contest Structure (Multi-Member)](#3-contest-structure-multi-member)
4. [Round Structure (Multi-Match Window)](#4-round-structure-multi-match-window)
5. [The 3 Phases of a Round](#5-the-3-phases-of-a-round)
6. [Live Scoring & Progress](#6-live-scoring--progress)
7. [Leaderboard & NRR](#7-leaderboard--nrr)
8. [Data Requirements](#8-data-requirements)
9. [Database Schema](#9-database-schema)
10. [API Design (tRPC Routers)](#10-api-design-trpc-routers)
11. [UI Design](#11-ui-design)
12. [Data Pipeline Integration](#12-data-pipeline-integration)
13. [Integration with Existing Systems](#13-integration-with-existing-systems)
14. [Chips & Power-ups](#14-chips--power-ups)
15. [Round Variants](#15-round-variants)
16. [Edge Cases & Rules](#16-edge-cases--rules)
17. [Implementation Phases](#17-implementation-phases)

---

## 1. How It Works (End-to-End)

### The Two Layers

```
LAYER 1 — THE ENGINE (per member)
  Each member's 11 players run a "120-ball internal match":
  ┌─────────────────┐     vs     ┌─────────────────┐
  │  BATTING ORDER  │           │  BOWLING ORDER   │
  │  (your 11,      │           │  (your bowlers,  │
  │   positions 1-11)│           │   ranked by      │
  │                 │           │   priority)      │
  │  → Batting Total│           │  → Bowling Total │
  │    (runs scored)│           │    (runs conceded)│
  └─────────────────┘           └─────────────────┘
           │                            │
           └──────── NRR = (Bat/20) - (Bowl/20) ────┘

LAYER 2 — THE CONTEST (all members)
  Everyone's NRR is compared on the leaderboard:
  ┌────┬──────────────┬────────┬────────┬────────┐
  │ #  │ Member       │ NRR    │ Bat    │ Bowl   │
  ├────┼──────────────┼────────┼────────┼────────┤
  │ 1  │ CricketGuru  │ +3.85  │ 198    │ 121    │  ← Wins 500 PC
  │ 2  │ IPLBoss      │ +3.20  │ 195    │ 131    │  ← Wins 300 PC
  │ 3  │ You          │ +2.90  │ 201    │ 143    │  ← Wins 200 PC
  │ .. │ ...          │ ...    │ ...    │ ...    │
  │ 20 │ Newbie99     │ -2.10  │ 112    │ 154    │
  └────┴──────────────┴────────┴────────┴────────┘
```

### The Flow

```
1. CONTEST CREATED           A CM contest is created for a round (multi-day match window)
       │
2. MEMBERS JOIN              2-1000 members join, pay entry fee (Pop Coins)
       │
3. EACH MEMBER BUILDS        Pick 11 → Set batting order → Set bowling priority
   THEIR ENTRY               (independently, can't see others' picks)
       │
4. ENTRIES LOCK              30 min before first match in the window
       │
5. LIVE PHASE                Real matches play out over days.
   (multi-day)               Each member's batting total and bowling total update live.
                             Live leaderboard shows all members' NRRs shifting in real-time.
       │
6. SETTLEMENT                All matches done → final 120-ball simulation runs → NRR ranked
       │
7. PRIZES & REVEAL           Prize pool distributed. Everyone's squad + order revealed.
                             Study what winners did differently → learn → improve next round.
```

---

## 2. The 120-Ball Engine

This is the core scoring system. It runs **independently for each member's entry**, producing a Batting Total and Bowling Total from their chosen squad, order, and real-world match data.

### 2.1 The 120-Ball Batting Window

```
Input:  battingOrder[1..11] → each player's real-world stats from the round
Output: battingTotal (runs), ballsUsed, wicketsLost

Algorithm:
  battingTotal = 0
  ballsUsed = 0
  wicketsLost = 0
  
  FOR each batter in battingOrder (position 1 → 11):
    
    playerStats = getRealStats(batter.playerId)
    // playerStats.runs         = runs scored in real match(es)
    // playerStats.ballsFaced   = balls faced in real match(es)
    // playerStats.isDismissed  = whether they got out
    
    // Player didn't bat in real life (DNB) → contributes nothing, move on
    if playerStats.ballsFaced == 0 AND playerStats.runs == 0:
      continue
    
    remainingBalls = 120 - ballsUsed
    
    if playerStats.ballsFaced <= remainingBalls:
      // Player's full real innings fits within the 120-ball window
      battingTotal += playerStats.runs
      ballsUsed += playerStats.ballsFaced
      if playerStats.isDismissed:
        wicketsLost += 1
    else:
      // Player's innings is TRUNCATED — pro-rate their runs
      fraction = remainingBalls / playerStats.ballsFaced
      battingTotal += FLOOR(playerStats.runs * fraction)
      ballsUsed = 120
      BREAK    // ← 120 balls reached, stop
    
    if wicketsLost >= 10: BREAK    // ← All out, stop
    if ballsUsed >= 120: BREAK     // ← 20 overs done, stop
  
  RETURN { battingTotal, ballsUsed, wicketsLost }
```

**Key rule:** If Batter #1 faces 120 balls, Batters #2-11 score **zero**. This is why batting order is everything.

### 2.2 The 120-Ball Bowling Window

```
Input:  bowlingPriority[1..N] → ranked list of bowlers with real-world stats
Output: bowlingTotal (runs conceded), ballsBowled, wicketsTaken

Algorithm:
  bowlingTotal = 0
  ballsBowled = 0
  wicketsTaken = 0
  
  FOR each bowler in bowlingPriority (priority 1 → N):
    
    playerStats = getRealStats(bowler.playerId)
    // playerStats.oversBowled   = overs bowled in real match(es)
    // playerStats.runsConceded  = runs conceded in real match(es)
    // playerStats.wickets       = wickets taken in real match(es)
    
    realBallsBowled = oversToDeliveries(playerStats.oversBowled)
    
    // Bowler didn't bowl in real life → contributes nothing, move on
    if realBallsBowled == 0:
      continue
    
    // Cap at 4 overs (24 balls) per bowler — T20 rule
    cappedBalls = MIN(realBallsBowled, 24)
    remainingBalls = 120 - ballsBowled
    effectiveBalls = MIN(cappedBalls, remainingBalls)
    
    // Pro-rate stats based on balls used
    fraction = effectiveBalls / realBallsBowled
    conceded = FLOOR(playerStats.runsConceded * fraction)
    wickets = FLOOR(playerStats.wickets * fraction)
    
    bowlingTotal += conceded
    wicketsTaken += wickets
    ballsBowled += effectiveBalls
    
    if wicketsTaken >= 10: BREAK    // ← Bowled them out!
    if ballsBowled >= 120: BREAK    // ← 20 overs done
  
  RETURN { bowlingTotal, ballsBowled, wicketsTaken }
```

### 2.3 The Lethality Bonus

If the bowling order takes **10 wickets**, the Bowling Total **freezes at the moment of the 10th wicket** — it doesn't keep accumulating. This means:

- An aggressive bowling attack that bowls the "opposition" out for 95 in 14 overs → Bowling Total = 95 (not whatever they'd concede in 20)
- This rewards picking wicket-taking bowlers, not just economical ones
- Creates a distinct strategy: "wicket-hunting" vs "run-suppressing"

### 2.4 Victory Condition (Per Member)

```
WIN:  Batting Total > Bowling Total
LOSS: Batting Total < Bowling Total
TIE:  Batting Total == Bowling Total
```

A "win" doesn't mean you win the contest — it means your batting beat your bowling. Your **NRR** determines where you rank among all members.

### 2.5 All-Rounder Handling

A player who both bats and bowls contributes to **BOTH** sides of the simulation:

- Their batting stats (runs, balls faced) go into the Batting Window at their batting order position
- Their bowling stats (overs, runs conceded, wickets) go into the Bowling Window at their bowling priority position

This is the core strategic tension. Example:
- Hardik Pandya: 45(27) batting, 5.0 overs 44 conceded 1 wicket bowling
- **Batting contribution:** +45 runs (good)
- **Bowling contribution:** +44 runs conceded (bad)
- **Net impact:** roughly -1 — he's a wash. But his 27 balls used at a high SR might enable lower-order batters to face more balls.

The decision: is his batting value worth the bowling cost?

### 2.6 Multi-Match Aggregation

Since a round spans multiple real matches, a player's stats are **summed across all matches** they play in the window:

```typescript
function getPlayerRoundStats(playerId: string, roundMatchIds: string[]): PlayerStats {
  const scores = getAllMatchScores(playerId, roundMatchIds);
  return {
    runs: sum(scores, 'runs'),
    ballsFaced: sum(scores, 'ballsFaced'),
    isDismissed: scores.some(s => s.isDismissed),
    dismissals: scores.filter(s => s.isDismissed).length,
    wickets: sum(scores, 'wickets'),
    oversBowled: sum(scores, 'oversBowled'),
    runsConceded: sum(scores, 'runsConceded'),
  };
}
```

If Bumrah plays twice in the window (MI vs CSK and MI vs DC) and bowls 4+4 = 8 overs, he's capped at 4 overs (24 balls) in the bowling simulation. His stats are pro-rated from the 8-over aggregate.

---

## 3. Contest Structure (Multi-Member)

### 3.1 What Is a CM Contest?

A CM contest is a **group of members** competing on the same round. Everyone picks from the same player pool, builds their entry independently, and is ranked by NRR on a shared leaderboard.

Think of it like a golf tournament — everyone plays the same course (same player pool), but your score (NRR) depends entirely on your own strategy (squad, batting order, bowling priority). There's no direct interaction between members during the game.

### 3.2 Contest Types

| Type | Members | Entry Fee | Prize Pool | Created By |
|------|---------|-----------|------------|------------|
| **Mega League** | Up to 10,000 | Set by admin | Guaranteed pool (set by admin) | **Admin** (one per tournament — the flagship public league) |
| **Private** | 2-20 | Custom (or free) | Entry fees pooled | Any user (invite code) |
| **H2H** | Exactly 2 | Matched stakes | Winner takes all | User-initiated |
| **Free** | Up to 50 | 0 PC | Small PC prizes | System (casual/onboarding) |

The **Mega League** is the primary public contest: admin creates it, hand-composes rounds, defines prize pool, and users join it once to compete across the entire tournament. Private contests and H2H are user-initiated alternatives within the same round structure.

### 3.3 Prize Distribution

Default distribution (configurable per contest):

| Rank | % of Pool | Example (1000 PC pool) |
|------|-----------|----------------------|
| 1st | 50% | 500 PC |
| 2nd | 30% | 300 PC |
| 3rd | 20% | 200 PC |

For larger contests (50+ members):

| Rank | % of Pool |
|------|-----------|
| 1st | 30% |
| 2nd | 20% |
| 3rd | 15% |
| 4th-5th | 8% each |
| 6th-10th | 3.8% each |

### 3.4 Visibility Rules

| Phase | What Members Can See |
|-------|---------------------|
| **Building entries** | Nothing about other members' picks |
| **Live phase** | Other members' NRR, batting total, bowling total — but NOT their squad, batting order, or bowling priority |
| **After settlement** | Everything — full squad, batting order, bowling priority, per-player breakdown |

This creates:
- **During live:** Tension ("CricketGuru is ahead of me but I don't know why!")
- **After settlement:** Learning ("Oh, he put Pant at #1 — that's why his batting was higher")

### 3.5 Multiple Contests Per Round

A member can join **multiple contests** for the same round — but they submit the **same entry** across all contests. This prevents:
- Gaming by submitting different entries to hedge
- Complexity of managing multiple squads

One squad + one batting order + one bowling priority = one entry. That entry competes in every contest you've joined for that round.

> **Design decision:** This is simpler and fairer. You commit to one strategy, and it's judged across all your contests. Same as most fantasy platforms.

---

## 4. Round Structure (Admin-Curated Match Groupings)

### 4.1 What Is a Round?

A round is an **admin-curated group of real matches** that form a single CM contest window. All players from those matches form the available pool. Rounds are hand-composed by an admin when they create a Mega League — they are *not* auto-windowed by date.

```
Example: IPL 2026 Mega League (admin-composed)
├── Round 1 — "Opening Fixtures" (5 matches, one per team's first game)
│     ├── RCB vs SRH    (Mar 28)
│     ├── MI vs KKR     (Mar 29)
│     ├── RR vs CSK     (Mar 30)
│     ├── PBKS vs GT    (Mar 31)
│     └── LSG vs DC     (Apr 1)
├── Round 2 — "Second Fixtures" (5 matches)
│     ├── KKR vs SRH    (Apr 2)
│     ├── CSK vs PBKS   (Apr 3)
│     ├── DC vs MI      (Apr 4)
│     ├── GT vs RR      (Apr 4)
│     └── SRH vs LSG    (Apr 5)
├── Round 3 — "Third Fixtures" (5 matches)
│     ...
├── …
└── Final Round — "IPL Final" (1 match)

Player Pool per round: players from that round's matches only
Each member picks 11 from that pool, per round
```

The admin decides how matches group together — typical pattern is **"each team plays once per round"** (so Round 1 = each team's first match, Round 2 = each team's second, etc.), with knockouts/finals as single-match rounds. But admin is free to group however they want (by date window, by stage, etc.).

### 4.2 Round Configuration

| Field | Description | Set By |
|-------|-------------|--------|
| `name` | Display name ("Round 1 — Opening Fixtures") | Admin |
| `matchIds` | Array of match IDs hand-picked by admin | Admin |
| `roundNumber` | Sequence within the mega league (1, 2, 3, …) | Admin |
| `windowStart` | Earliest match start time | Derived from `matchIds` |
| `windowEnd` | Latest match estimated end | Derived from `matchIds` |
| `lockTime` | When entries freeze | Default: 30 min before first match (admin can override) |
| `ballLimit` | Balls for simulation | 120 |
| `minBowlers` | Min bowlers in squad | 5 |
| `maxOversPerBowler` | Bowling cap per bowler | 4 (24 balls) |

### 4.3 Mega League (Admin-Created Parent)

Rounds live inside a **Mega League** — a public, admin-created container that spans an entire tournament (e.g. "IPL 2026 Mega League"). The admin defines:

| Field | Description |
|-------|-------------|
| `name` | Display name ("IPL 2026 Mega League") |
| `tournamentId` | Tournament this league is tied to |
| `visibility` | `public` (open to all users) — default for admin-created leagues |
| `entryFee` | PC cost to join the mega league (one-time, covers all rounds) |
| `prizePool` | Total guaranteed prize pool for the league |
| `prizeDistribution` | How the pool splits across final season standings |
| `roundPrizeSplit` | Optional per-round sub-pool (e.g. 10% of pool awarded per round, 50% held for finals) |
| `maxMembers` | Cap on total members |
| `createdBy` | Admin user ID |

**Flow:**
1. Admin creates Mega League for a tournament
2. Admin composes Round 1 (picks matches, sets name, sets lock time)
3. Admin composes Round 2, Round 3, … Final Round
4. League opens for public joining. Users join once → automatically entered in every round
5. Each round runs through its own lifecycle (upcoming → open → locked → live → settled)
6. Season leaderboard = cumulative NRR across all settled rounds
7. At tournament end, prize pool distributes per `prizeDistribution`

> Admins can add/edit future rounds as the real tournament schedule firms up, but cannot modify a round once it has entered `locked` state.

### 4.4 Round Lifecycle

```
┌───────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ UPCOMING  │───▶│   OPEN   │───▶│  LOCKED  │───▶│   LIVE   │───▶│ SETTLED  │
│           │    │          │    │          │    │          │    │          │
│ Round     │    │ Members  │    │ Entries  │    │ Matches  │    │ Final    │
│ announced │    │ build    │    │ frozen   │    │ playing  │    │ NRR      │
│ contests  │    │ entries  │    │          │    │ live     │    │ ranked   │
│ created   │    │          │    │          │    │ updates  │    │ prizes   │
└───────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘

Triggers:
  UPCOMING → OPEN:     Player pool populated (squads announced)
  OPEN → LOCKED:       lockTime reached (30min before first match)
  LOCKED → LIVE:       First match starts
  LIVE → SETTLED:      ALL matches in window completed + scores finalized
```

---

## 5. The 3 Phases of a Round

### Phase 1: Squad Selection ("The Draft")

```
When: Round OPEN → lockTime
```

- Member sees ALL players from ALL matches in the round
- Select exactly **11 players**
- **Validation:**
  - Exactly 11 players
  - Min 5 bowlers (bowler or all-rounder)

> **No wicketkeeper requirement.** The simulation only scores batting runs and bowling figures — keeping (catches/stumpings/byes) isn't an input to either total, so a WK is functionally just a batter. No positional constraint on WKs.
- Stats shown: Recent Strike Rate, Average, Economy, Bowling SR
- **Why it's fun:** No budget → build your Dream XI. But every batter is a "ball resource" to manage.

### Phase 2: Batting & Bowling Strategy

```
When: Same as Phase 1 (tabs 2 & 3 of the entry builder)
```

**Batting Order (1-11):**
- Drag-and-drop to set positions 1 through 11
- High SR players at top = more runs before 120 balls run out
- Visual aid: Strike Rate next to each name
- Visual aid: "Ball Usage Cutoff" line — estimated position where 120 balls get exhausted

**Bowling Priority (ranked list):**
- Rank your bowlers from 1st to last
- Engine processes them sequentially — first bowler uses their real overs, then second, etc.
- Each bowler capped at 4 overs (24 balls) regardless of how much they bowled IRL
- Visual aid: Economy Rate and Bowling SR next to each name

### Phase 3: The Live Match

```
When: LOCKED → LIVE → SETTLED (plays out over days)
```

As real matches happen:
- **Batting Total** climbs when your batsmen score runs IRL
- **Bowling Total** climbs when your bowlers concede runs IRL
- **Live leaderboard** shows all members' NRRs shifting in real-time
- Members can see others' totals but NOT their squad or order
- The round settles when ALL matches in the window complete

---

## 6. Live Scoring & Progress

### 6.1 The Live Experience

This is what makes CM engaging. Members watch a multi-day race unfold:

```
┌──────────────────────────────────────────────────────┐
│  IPL WEEK 5 — LIVE                    12/20 members │
│──────────────────────────────────────────────────────│
│                                                      │
│  YOUR INTERNAL MATCH                                 │
│  BAT  ━━━━━━━━━━━━━━━━━━━▓▓▓░░░  178               │
│  BOWL ━━━━━━━━━━━━━━━░░░░░░░░░░  142               │
│  NRR: +1.80                      BATTING LEADS      │
│                                                      │
│  ─── CONTEST STANDINGS (LIVE) ────────────────────  │
│  #1  CricketGuru    NRR +3.20  ▲  Bat:195 Bowl:131 │
│  #2  IPLBoss        NRR +2.45  ▲  Bat:180 Bowl:131 │
│  #3  You            NRR +1.80  ▼  Bat:178 Bowl:142 │
│  #4  FantasyKing    NRR +1.20  ▲  Bat:165 Bowl:141 │
│  #5  DraftPro       NRR +0.40  ▼  Bat:152 Bowl:144 │
│  ...                                                │
│  3/7 matches done │ Next: RCB vs KKR in 4h         │
└──────────────────────────────────────────────────────┘
```

### 6.2 How Live Updates Work

Whenever `playerMatchScores` update (from Cricbuzz scraping), the system:

1. Finds all LIVE CM rounds containing that match
2. For each entry in those rounds that has players in the match
3. Re-runs the 120-ball simulation with latest aggregated stats
4. Updates the entry's live batting/bowling totals and NRR
5. Re-ranks all entries in each contest

```typescript
async function onPlayerScoreUpdate(matchId: string) {
  // Existing fantasy scoring...
  
  // CM live update
  const liveRounds = await getCMLiveRoundsForMatch(matchId);
  for (const round of liveRounds) {
    const entries = await getEntriesWithPlayersInMatch(round.id, matchId);
    for (const entry of entries) {
      const result = simulateEntry(entry, round.matchIds);
      await updateEntryLiveState(entry.id, result);
    }
    await rerankContests(round.id);
  }
}
```

### 6.3 Per-Player Live Status

Each member can drill into their entry to see per-player status:

```
─── YOUR BATTING SCORECARD ──────────────────────
#1 V Kohli      45 (28)    ✅ Done (MI vs CSK, Apr 10)
#2 S Gill       72 (48)    ✅ Done (GT vs RR, Apr 11)
#3 H Pandya     33*(18)    🔴 LIVE (MI vs DC, Apr 13)
#4 R Pant       28 (15)    ✅ Done (DC vs SRH, Apr 11)
#5 R Jadeja     —          ⏳ Upcoming (CSK vs RCB, Apr 14)
#6-11 ...       —          ⏳ Various
Balls used: 109/120

─── YOUR BOWLING FIGURES ───────────────────────
1st J Bumrah    4-0-24-3   ✅ Done (MI vs CSK + MI vs DC)
2nd M Shami     4-0-32-1   ✅ Done (GT vs RR)
3rd Y Chahal    2-0-18-1   🔴 LIVE (RR vs PBKS)
4th R Jadeja    —          ⏳ Upcoming (CSK vs RCB, Apr 14)
5th H Pandya    —          🔴 LIVE (MI vs DC) — bowling figures updating
Overs bowled: 14.0/20
```

### 6.4 Update Frequency

| Match State | CM Update Trigger |
|-------------|------------------|
| No matches live | No updates |
| Match live | Every Cricbuzz scorecard refresh (~2-3 min) |
| Match just completed | Immediate final recalculation |
| All matches completed | Full settlement run |

---

## 7. Leaderboard & NRR

### 7.1 NRR Formula

The exact formula used for ranking — mirrors real cricket ICC NRR:

```
NRR = (Batting Total / 20) - (Bowling Total / 20)
```

Both innings always use the full 20-over allocation as the denominator. Per real NRR rules, if a team is bowled out, the full quota of overs is still used — so getting all out is naturally penalized by scoring fewer runs over the same 20 overs, not by changing the denominator.

### 7.2 Tie-Breakers

| Priority | Criteria |
|----------|---------|
| 1st | NRR (higher wins) |
| 2nd | Team Batting Strike Rate: `(battingTotal / ballsUsed) × 100` |
| 3rd | Bowling Wickets Taken (more = better) |
| 4th | Entry submission time (earlier wins) |

### 7.3 Contest Leaderboard

Per-contest ranking of all members by NRR. Shows:
- Rank, username, NRR, batting total, bowling total
- Rank movement arrows (up/down since last update) during live phase

### 7.4 Season Leaderboard

Across a tournament (e.g., IPL 2026), cumulative stats:

| Metric | Calculation |
|--------|-------------|
| **Cumulative NRR** | Sum of NRR across all rounds (primary ranking) |
| **Wins** | Rounds where batting > bowling (first tie-breaker) |
| **Best NRR** | Highest single-round NRR |
| **Win Streak** | Consecutive rounds with NRR > 0 |
| **Rounds Played** | Total rounds entered |

---

## 8. Data Requirements

The engine needs these data points per player per match, all sourced from existing `playerMatchScores` table (populated by Cricbuzz scraping):

### 8.1 Batting Data

| Field | Source Column | Used For |
|-------|-------------|----------|
| `runs` | `playerMatchScores.runs` | Batting total |
| `ballsFaced` | `playerMatchScores.ballsFaced` | 120-ball limit tracking |
| `isDismissed` | Derived (runs > 0 or ballsFaced > 0 but innings ended) | Wicket counting for all-out rule |

### 8.2 Bowling Data

| Field | Source Column | Used For |
|-------|-------------|----------|
| `oversBowled` | `playerMatchScores.oversBowled` | 120-ball / 20-over limit |
| `runsConceded` | `playerMatchScores.runsConceded` | Bowling total |
| `wickets` | `playerMatchScores.wickets` | Lethality bonus (10-wicket rule) |

### 8.3 Player Metadata (for UI)

| Field | Source | Used For |
|-------|--------|----------|
| `name` | `players.name` | Display |
| `team` | `players.team` | Grouping / filtering |
| `role` | `players.role` | Validation (min bowlers) |
| `battingStyle` | `players.battingStyle` | Info display |
| `bowlingStyle` | `players.bowlingStyle` | Info display |
| `recentSR` | Derived from last 5 `playerMatchScores` | Batting order aid |
| `recentEcon` | Derived from last 5 `playerMatchScores` | Bowling priority aid |

**No new data sources needed.** Everything comes from existing tables populated by the Cricbuzz pipeline.

### 8.4 Test Case Players

High-efficiency players for testing the engine:

| Player | Role | Why They Test Well |
|--------|------|-------------------|
| Abhishek Sharma | Opener | **SR 190+** — faces few balls for big runs. At #1, leaves tons of balls for rest of order. |
| Sanju Samson | Top Order | **Aggressive SR** — tests the "ball-efficient scorer" advantage at top of order. |
| Jasprit Bumrah | Lead Bowler | **Elite Economy (6.2)** — at Priority 1, dominates the bowling window with low conceded runs. |
| Ravindra Jadeja | All-Rounder | Tests dual contribution — helps batting BUT hurts bowling conceded. Net positive or negative? |
| Rashid Khan | Bowler + Lower Order | Tests wicket-hunting strategy — high wickets, decent economy. Triggers lethality bonus. |

---

## 9. Database Schema

### 9.0 `cm_mega_leagues` — Admin-created parent container

```sql
CREATE TABLE cm_mega_leagues (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id       UUID NOT NULL REFERENCES tournaments(id),
  name                TEXT NOT NULL,                 -- "IPL 2026 Mega League"
  description         TEXT,
  visibility          TEXT NOT NULL DEFAULT 'public',
    -- public | private

  -- Economics
  entry_fee           INTEGER NOT NULL DEFAULT 0,    -- Pop Coins (one-time)
  prize_pool          INTEGER NOT NULL DEFAULT 0,    -- Total guaranteed
  prize_distribution  JSONB NOT NULL DEFAULT '[]',
    -- Final season standings split
  round_prize_split   JSONB NOT NULL DEFAULT '{}',
    -- Optional per-round sub-pool config
    -- { perRoundPct: 10, finalPct: 50 } → 10% of pool awarded per round, 50% held for finals

  -- Capacity
  max_members         INTEGER NOT NULL DEFAULT 10000,
  current_members     INTEGER NOT NULL DEFAULT 0,

  -- Status
  status              TEXT NOT NULL DEFAULT 'draft',
    -- draft | open | in_progress | settled | cancelled

  created_by          UUID NOT NULL REFERENCES users(id),   -- Admin
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cm_mega_leagues_tournament ON cm_mega_leagues(tournament_id);
CREATE INDEX idx_cm_mega_leagues_status ON cm_mega_leagues(status);
```

### 9.1 `cm_rounds` — A hand-composed group of matches

```sql
CREATE TABLE cm_rounds (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mega_league_id  UUID NOT NULL REFERENCES cm_mega_leagues(id) ON DELETE CASCADE,
  tournament_id   UUID NOT NULL REFERENCES tournaments(id),
  round_number    INTEGER NOT NULL,                 -- Sequence within mega league
  name            TEXT NOT NULL,                    -- "Round 1 — Opening Fixtures"
  status          TEXT NOT NULL DEFAULT 'upcoming',
    -- upcoming | open | locked | live | settled | void
  format          TEXT NOT NULL DEFAULT 'standard',
    -- standard | powerplay | death_overs | odi
  
  -- Match window
  match_ids       UUID[] NOT NULL DEFAULT '{}',     -- Matches in this round
  window_start    TIMESTAMPTZ NOT NULL,
  window_end      TIMESTAMPTZ NOT NULL,
  lock_time       TIMESTAMPTZ NOT NULL,             -- Entries freeze
  
  -- Player pool (populated when round opens)
  eligible_players JSONB NOT NULL DEFAULT '[]',
    -- [{playerId, name, team, role, battingStyle, bowlingStyle, recentSR, recentEcon}]
  
  -- Config
  ball_limit              INTEGER NOT NULL DEFAULT 120,
  min_bowlers             INTEGER NOT NULL DEFAULT 5,
  max_overs_per_bowler    INTEGER NOT NULL DEFAULT 4,

  
  -- Progress
  matches_completed INTEGER NOT NULL DEFAULT 0,
  matches_total     INTEGER NOT NULL DEFAULT 0,
  
  -- Stats (after settlement)
  total_entries   INTEGER NOT NULL DEFAULT 0,
  avg_nrr         DECIMAL(8,4),
  best_nrr        DECIMAL(8,4),
  
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cm_rounds_mega_league ON cm_rounds(mega_league_id);
CREATE INDEX idx_cm_rounds_tournament ON cm_rounds(tournament_id);
CREATE INDEX idx_cm_rounds_status ON cm_rounds(status);
CREATE UNIQUE INDEX idx_cm_rounds_number ON cm_rounds(mega_league_id, round_number);
```

### 9.2 `cm_contests` — A group of members competing on a round

```sql
CREATE TABLE cm_contests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id        UUID NOT NULL REFERENCES cm_rounds(id),
  league_id       UUID REFERENCES leagues(id),        -- NULL for public contests
  
  name            TEXT NOT NULL,                       -- "IPL Week 5 - Mega"
  contest_type    TEXT NOT NULL DEFAULT 'public',
    -- public | private | h2h | mega | free
  
  -- Economics
  entry_fee       INTEGER NOT NULL DEFAULT 0,          -- Pop Coins
  prize_pool      INTEGER NOT NULL DEFAULT 0,
  prize_distribution JSONB NOT NULL DEFAULT '[]',
    -- [{rank: 1, percent: 50}, {rank: 2, percent: 30}, {rank: 3, percent: 20}]
  is_guaranteed   BOOLEAN NOT NULL DEFAULT false,      -- Guaranteed prize pool?
  
  -- Capacity
  max_members     INTEGER NOT NULL DEFAULT 20,
  current_members INTEGER NOT NULL DEFAULT 0,
  
  -- Access
  invite_code     TEXT UNIQUE,                         -- For private contests
  
  -- Status follows the round status
  status          TEXT NOT NULL DEFAULT 'upcoming',
    -- upcoming | open | locked | live | settled
  
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cm_contests_round ON cm_contests(round_id);
CREATE INDEX idx_cm_contests_league ON cm_contests(league_id);
CREATE INDEX idx_cm_contests_status ON cm_contests(status);
CREATE INDEX idx_cm_contests_invite ON cm_contests(invite_code);
```

### 9.3 `cm_entries` — A member's squad + strategy + results

```sql
CREATE TABLE cm_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id        UUID NOT NULL REFERENCES cm_rounds(id),
  user_id         UUID NOT NULL REFERENCES users(id),
  
  -- Squad (11 players)
  players         JSONB NOT NULL,
    -- [{playerId, name, team, role}] — exactly 11
  
  -- Batting strategy (ordered 1-11)
  batting_order   JSONB NOT NULL,
    -- [{position: 1, playerId}, ..., {position: 11, playerId}]
  
  -- Bowling strategy (priority ranked)
  bowling_priority JSONB NOT NULL,
    -- [{priority: 1, playerId}, {priority: 2, playerId}, ...]

  -- Chip (optional)
  chip_used       TEXT,
  chip_target     TEXT,

  -- Simulation results (updated live, finalized on settlement)
  batting_total       INTEGER DEFAULT 0,
  batting_balls_used  INTEGER DEFAULT 0,
  batting_wickets     INTEGER DEFAULT 0,
  batting_details     JSONB,     -- Per-batter breakdown

  bowling_total         INTEGER DEFAULT 0,
  bowling_balls_bowled  INTEGER DEFAULT 0,
  bowling_wickets       INTEGER DEFAULT 0,
  bowling_details       JSONB,   -- Per-bowler breakdown

  nrr                 DECIMAL(8,4) DEFAULT 0,
  batting_sr          DECIMAL(8,4) DEFAULT 0,
  
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(round_id, user_id)   -- One entry per member per round
);

CREATE INDEX idx_cm_entries_round ON cm_entries(round_id);
CREATE INDEX idx_cm_entries_user ON cm_entries(user_id);
```

### 9.4 `cm_contest_members` — Links members to contests (many-to-many)

```sql
CREATE TABLE cm_contest_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id      UUID NOT NULL REFERENCES cm_contests(id),
  user_id         UUID NOT NULL REFERENCES users(id),
  entry_id        UUID NOT NULL REFERENCES cm_entries(id),  -- Same entry across contests
  
  -- Per-contest ranking
  rank            INTEGER,
  prize_won       INTEGER DEFAULT 0,       -- Pop Coins won in this contest
  
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(contest_id, user_id)
);

CREATE INDEX idx_cm_contest_members_contest ON cm_contest_members(contest_id);
CREATE INDEX idx_cm_contest_members_user ON cm_contest_members(user_id);
```

### 9.5 `cm_season_standings` — Cumulative per tournament

```sql
CREATE TABLE cm_season_standings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id),
  tournament_id       UUID NOT NULL REFERENCES tournaments(id),
  
  rounds_played       INTEGER NOT NULL DEFAULT 0,
  total_nrr           DECIMAL(10,4) NOT NULL DEFAULT 0,
  wins                INTEGER NOT NULL DEFAULT 0,
  losses              INTEGER NOT NULL DEFAULT 0,
  best_nrr            DECIMAL(8,4),
  worst_nrr           DECIMAL(8,4),
  avg_nrr             DECIMAL(8,4),
  current_win_streak  INTEGER NOT NULL DEFAULT 0,
  best_win_streak     INTEGER NOT NULL DEFAULT 0,
  rank                INTEGER,
  
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(user_id, tournament_id)
);

CREATE INDEX idx_cm_season_rank ON cm_season_standings(tournament_id, rank);
```

### 9.6 `cm_chips` — Power-up inventory

```sql
CREATE TABLE cm_chips (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id),
  tournament_id   UUID NOT NULL REFERENCES tournaments(id),
  chip_type       TEXT NOT NULL,
  is_used         BOOLEAN NOT NULL DEFAULT false,
  used_in_round   UUID REFERENCES cm_rounds(id),
  used_at         TIMESTAMPTZ,
  
  UNIQUE(user_id, tournament_id, chip_type)
);
```

### 9.7 Table Relationships

```
tournaments
  │
  ├── cm_mega_leagues (1:many — admin-created league parents)
  │     │
  │     ├── cm_mega_league_members (1:many — users who joined the league)
  │     │
  │     └── cm_rounds (1:many — admin-composed rounds)
  │           │
  │           ├── cm_contests (1:many — contest buckets inside each round; public/private/H2H)
  │           │     │
  │           │     └── cm_contest_members (1:many — members in each contest)
  │           │           │
  │           │           └── references cm_entries (member's shared entry for the round)
  │           │
  │           └── cm_entries (1:many — one entry per user per round)
  │                 │
  │                 └── uses playerMatchScores (existing) for simulation
  │
  ├── cm_season_standings (1:many — cumulative stats per user per mega league)
  │
  └── cm_chips (1:many — chip inventory per user)

matches (existing) ←── referenced by cm_rounds.match_ids[]
players (existing) ←── referenced by cm_entries.players[] JSONB
playerMatchScores (existing) ←── read during simulation (never written by CM)
users (existing) ←── referenced by cm_entries, cm_contest_members, cm_season_standings
leagues (existing) ←── optionally linked to cm_contests for private leagues
```

**Zero changes to existing tables.**

---

## 10. API Design (tRPC Routers)

### 10.1 Router: `cricketManager`

```typescript
// packages/api/src/routers/cricket-manager.ts

export const cricketManagerRouter = router({
  
  // ─── Rounds ─────────────────────────────────────────────
  
  getRounds: protectedProcedure
    .input(z.object({
      tournamentId: z.string().uuid(),
      status: z.enum(['upcoming', 'open', 'locked', 'live', 'settled']).optional(),
      limit: z.number().default(10),
    }))
    .query(),
  
  getRound: protectedProcedure
    .input(z.object({ roundId: z.string().uuid() }))
    .query(),
  
  getEligiblePlayers: protectedProcedure
    .input(z.object({ roundId: z.string().uuid() }))
    .query(),
  
  // ─── Contests ───────────────────────────────────────────
  
  getContests: protectedProcedure
    .input(z.object({
      roundId: z.string().uuid(),
      contestType: z.enum(['public', 'private', 'h2h', 'mega', 'free']).optional(),
    }))
    .query(),
  
  getContest: protectedProcedure
    .input(z.object({ contestId: z.string().uuid() }))
    .query(),
  
  createContest: protectedProcedure
    .input(z.object({
      roundId: z.string().uuid(),
      name: z.string(),
      contestType: z.enum(['private', 'h2h']),
      entryFee: z.number().min(0),
      maxMembers: z.number().min(2).max(20),
      leagueId: z.string().uuid().optional(),
    }))
    .mutation(),
  
  joinContest: protectedProcedure
    .input(z.object({
      contestId: z.string().uuid(),
      inviteCode: z.string().optional(),
    }))
    .mutation(),
  
  // ─── Entries ────────────────────────────────────────────
  
  submitEntry: protectedProcedure
    .input(z.object({
      roundId: z.string().uuid(),
      players: z.array(z.object({ playerId: z.string().uuid() })).length(11),
      battingOrder: z.array(z.object({
        position: z.number().min(1).max(11),
        playerId: z.string().uuid(),
      })).length(11),
      bowlingPriority: z.array(z.object({
        priority: z.number().min(1),
        playerId: z.string().uuid(),
      })).min(5),
      chipUsed: z.string().optional(),
      chipTarget: z.string().optional(),
    }))
    .mutation(),
  
  getMyEntry: protectedProcedure
    .input(z.object({ roundId: z.string().uuid() }))
    .query(),
  
  // ─── Live ───────────────────────────────────────────────
  
  getLiveState: protectedProcedure
    .input(z.object({ roundId: z.string().uuid() }))
    .query(),
    // Returns: batting/bowling totals, per-player status, matches progress
  
  // ─── Leaderboards ──────────────────────────────────────
  
  getContestLeaderboard: protectedProcedure
    .input(z.object({
      contestId: z.string().uuid(),
      limit: z.number().default(50),
      offset: z.number().default(0),
    }))
    .query(),
  
  getSeasonLeaderboard: protectedProcedure
    .input(z.object({
      tournamentId: z.string().uuid(),
      limit: z.number().default(50),
      offset: z.number().default(0),
    }))
    .query(),
  
  getMySeasonStats: protectedProcedure
    .input(z.object({ tournamentId: z.string().uuid() }))
    .query(),
  
  // ─── Chips ──────────────────────────────────────────────
  
  getMyChips: protectedProcedure
    .input(z.object({ tournamentId: z.string().uuid() }))
    .query(),
  
  // ─── Mega Leagues (public, browsable by users) ──────────

  listMegaLeagues: protectedProcedure
    .input(z.object({ tournamentId: z.string().uuid().optional() }))
    .query(),

  getMegaLeague: protectedProcedure
    .input(z.object({ megaLeagueId: z.string().uuid() }))
    .query(),

  joinMegaLeague: protectedProcedure
    .input(z.object({ megaLeagueId: z.string().uuid() }))
    .mutation(),  // Pays entry fee, auto-enters every round

  // ─── Admin ──────────────────────────────────────────────

  createMegaLeague: adminProcedure
    .input(z.object({
      tournamentId: z.string().uuid(),
      name: z.string(),
      description: z.string().optional(),
      entryFee: z.number().int().nonnegative(),
      prizePool: z.number().int().nonnegative(),
      prizeDistribution: z.array(z.object({ rank: z.number(), percent: z.number() })),
      roundPrizeSplit: z.object({
        perRoundPct: z.number().optional(),
        finalPct: z.number().optional(),
      }).optional(),
      maxMembers: z.number().int().positive().optional(),
    }))
    .mutation(),

  composeRound: adminProcedure
    .input(z.object({
      megaLeagueId: z.string().uuid(),
      roundNumber: z.number().int().positive(),
      name: z.string(),
      matchIds: z.array(z.string().uuid()).min(1),
      lockTime: z.date().optional(),
    }))
    .mutation(),

  updateRound: adminProcedure
    .input(z.object({
      roundId: z.string().uuid(),
      name: z.string().optional(),
      matchIds: z.array(z.string().uuid()).optional(),
      lockTime: z.date().optional(),
    }))
    .mutation(),  // Only allowed while round is 'upcoming'

  deleteRound: adminProcedure
    .input(z.object({ roundId: z.string().uuid() }))
    .mutation(),  // Only allowed while round is 'upcoming'

  publishMegaLeague: adminProcedure
    .input(z.object({ megaLeagueId: z.string().uuid() }))
    .mutation(),  // draft → open

  settleRound: adminProcedure
    .input(z.object({ roundId: z.string().uuid() }))
    .mutation(),
});
```

### 10.2 Entry Validation

```typescript
function validateEntry(input, round, playerPool) {
  // 1. Round must be 'open'
  assert(round.status === 'open', 'Round not open');
  
  // 2. Before lock time
  assert(new Date() < round.lockTime, 'Round is locked');
  
  // 3. Exactly 11 players, all in eligible pool
  assert(input.players.length === 11, 'Must select exactly 11');
  const eligible = new Set(round.eligiblePlayers.map(p => p.playerId));
  input.players.forEach(p => assert(eligible.has(p.playerId), 'Player not eligible'));
  
  // 4. No duplicates
  assert(new Set(input.players.map(p => p.playerId)).size === 11, 'No duplicates');
  
  // 5. Min 5 bowlers
  const bowlers = input.players.filter(p => canBowl(p, playerPool));
  assert(bowlers.length >= 5, 'Need at least 5 bowlers');

  // 6. Batting order = all 11, positions 1-11
  assert(input.battingOrder.length === 11, 'Batting order must have 11');
  const positions = new Set(input.battingOrder.map(b => b.position));
  assert(positions.size === 11, 'Positions 1-11 required');

  // 7. Bowling priority: all bowlers from squad ranked
  const bowlerIds = new Set(bowlers.map(b => b.playerId));
  input.bowlingPriority.forEach(b => assert(bowlerIds.has(b.playerId), 'Not a bowler'));

  // 8. Chip validation (if used)
  if (input.chipUsed) validateChip(input, round);
}
```

### 10.3 Join Contest Flow

```typescript
async function joinContest(userId, contestId, inviteCode?) {
  const contest = await getContest(contestId);
  const round = await getRound(contest.roundId);
  
  // Validations
  assert(contest.status === 'open' || contest.status === 'upcoming');
  assert(contest.currentMembers < contest.maxMembers, 'Contest full');
  if (contest.contestType === 'private') {
    assert(inviteCode === contest.inviteCode, 'Invalid invite code');
  }
  
  // Check user has an entry for this round (must build entry first or simultaneously)
  const entry = await getEntry(round.id, userId);
  assert(entry, 'Build your entry first');
  
  // Deduct entry fee
  if (contest.entryFee > 0) {
    await deductPopCoins(userId, contest.entryFee, {
      type: 'cm_contest_entry',
      contestId,
    });
  }
  
  // Add to contest
  await db.insert(cmContestMembers).values({
    contestId, userId, entryId: entry.id,
  });
  await db.update(cmContests).set({
    currentMembers: sql`current_members + 1`,
  }).where(eq(cmContests.id, contestId));
}
```

---

## 11. UI Design

### 11.1 Navigation

```
Cricket Manager tab (bottom nav or section)
├── Round Hub (home)
│   ├── Active live round (prominent)
│   ├── Open rounds (join contests / build entry)
│   ├── Recent results
│   └── Season standings mini
│
├── Entry Builder (3 tabs)
│   ├── Tab 1: Squad Selection
│   ├── Tab 2: Batting Order (drag & drop)
│   └── Tab 3: Bowling Priority (drag & drop)
│
├── Contest Browser
│   ├── Public contests for current round
│   ├── Create private contest
│   └── Join via invite code
│
├── Live Match View
│   ├── Dual progress bars (bat vs bowl)
│   ├── Per-player live scorecard
│   └── Contest standings (live leaderboard)
│
├── Round Results (after settlement)
│   ├── Your scorecard
│   ├── Contest leaderboard (final)
│   └── Reveal: other members' strategies
│
└── Season Dashboard
    ├── Season leaderboard
    ├── Your round history + NRR chart
    ├── Chip inventory
    └── Achievements
```

### 11.2 Squad Selection (Tab 1)

```
┌─────────────────────────────────────────────────────┐
│  BUILD YOUR XI              IPL Week 5 │ 7 matches │
│  ─── Squad ─── Batting ─── Bowling ───────────────│
│─────────────────────────────────────────────────────│
│  🔍 Search...                   Filter: All ▾      │
│  Selected: 8/11 │ Bowlers: 4/5 min                 │
│─────────────────────────────────────────────────────│
│  BATSMEN                                            │
│  ☑ V Kohli      RCB   SR: 142   Avg: 48            │
│  ☑ S Gill       GT    SR: 138   Avg: 42            │
│  ☑ A Sharma     SRH   SR: 190   Avg: 28            │
│  ☑ R Pant       DC    SR: 155   Avg: 35            │
│  ☐ KL Rahul     LSG   SR: 128   Avg: 42            │
│                                                     │
│  ALL-ROUNDERS                                       │
│  ☑ H Pandya     MI    SR: 148   Econ: 8.5          │
│  ☑ R Jadeja     CSK   SR: 125   Econ: 7.2          │
│                                                     │
│  BOWLERS                                            │
│  ☑ J Bumrah     MI    Econ: 6.2  BowlSR: 12       │
│  ☑ Y Chahal     RR    Econ: 7.8  BowlSR: 18       │
│  ☐ R Ashwin     PBKS  Econ: 6.8  BowlSR: 20       │
│                                                     │
│  ⚠ Need 3 more players and 1 more bowler            │
│                                     [Next →]        │
└─────────────────────────────────────────────────────┘
```

### 11.3 Batting Order (Tab 2)

```
┌─────────────────────────────────────────────────────┐
│  BATTING ORDER                                      │
│  ─── Squad ─── Batting ─── Bowling ───────────────│
│─────────────────────────────────────────────────────│
│  Drag to reorder. High SR at top = more runs.       │
│─────────────────────────────────────────────────────│
│  #1   ≡  A Sharma       SRH   SR: 190    ▲▼       │
│  #2   ≡  R Pant         DC    SR: 155    ▲▼       │
│  #3   ≡  H Pandya       MI    SR: 148    ▲▼       │
│  #4   ≡  V Kohli        RCB   SR: 142    ▲▼       │
│  #5   ≡  S Gill         GT    SR: 138    ▲▼       │
│  ─── ⚡ ~120 BALLS USED HERE ───────────────       │
│  #6   ≡  R Jadeja       CSK   SR: 125    ▲▼       │
│  #7   ≡  D Chahar       CSK   SR: 88     ▲▼       │
│  #8   ≡  J Bumrah       MI    SR: 85     ▲▼       │
│  #9   ≡  M Shami        GT    SR: 95     ▲▼       │
│  #10  ≡  Y Chahal       RR    SR: 62     ▲▼       │
│  #11  ≡  Rashid Khan    GT    SR: 70     ▲▼       │
│                                                     │
│  Players below the line may not bat.                │
│                                     [Next →]        │
└─────────────────────────────────────────────────────┘
```

### 11.4 Bowling Priority (Tab 3)

```
┌─────────────────────────────────────────────────────┐
│  BOWLING PRIORITY                                   │
│  ─── Squad ─── Batting ─── Bowling ───────────────│
│─────────────────────────────────────────────────────│
│  Rank bowlers by priority. Best economy at top.     │
│  Each bowler capped at 4 overs (24 balls).          │
│─────────────────────────────────────────────────────│
│  PRIORITY  BOWLER              ECON    BOWL SR      │
│  1st    ≡  J Bumrah           6.2     12      ▲▼   │
│  2nd    ≡  Rashid Khan        6.5     16      ▲▼   │
│  3rd    ≡  Y Chahal           7.5     18      ▲▼   │
│  4th    ≡  R Jadeja           7.2     22      ▲▼   │
│  5th    ≡  D Chahar           7.0     16      ▲▼   │
│  6th    ≡  H Pandya           8.5     24      ▲▼   │
│  7th    ≡  M Shami            7.8     14      ▲▼   │
│                                                     │
│  Non-bowlers (won't bowl):                          │
│  — A Sharma, R Pant, V Kohli, S Gill                │
│                                                     │
│                                     [Next →]        │
└─────────────────────────────────────────────────────┘
```

### 11.5 Contest Browser

```
┌─────────────────────────────────────────────────────┐
│  CONTESTS — IPL Week 5                              │
│─────────────────────────────────────────────────────│
│                                                     │
│  PUBLIC                                             │
│  ┌─────────────────────────────────────────────┐    │
│  │ Mega Contest      │ 20 PC │ 342/1000 joined │    │
│  │ Prize: 15,000 PC  │       │ [Join]          │    │
│  ├─────────────────────────────────────────────┤    │
│  │ Small Stakes      │ 10 PC │ 45/100 joined   │    │
│  │ Prize: 800 PC     │       │ [Join]          │    │
│  ├─────────────────────────────────────────────┤    │
│  │ Free Practice     │ Free  │ 28/50 joined    │    │
│  │ Prize: 100 PC     │       │ [Join]          │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  YOUR CONTESTS                                      │
│  ┌─────────────────────────────────────────────┐    │
│  │ Friends League     │ 50 PC │ 8/12 joined    │    │
│  │ Prize: 400 PC      │       │ Joined ✓       │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  [Create Private Contest]  [Join with Code]         │
└─────────────────────────────────────────────────────┘
```

---

## 12. Data Pipeline Integration

### 12.1 Admin-Create Mega League & Rounds

Rounds are **not auto-generated**. An admin composes the mega league and its rounds manually through the admin portal. The system then manages lifecycle transitions automatically.

```typescript
// Admin flow — called from admin portal

async function createMegaLeague(adminUserId: string, input: CreateMegaLeagueInput) {
  assertAdmin(adminUserId);

  const league = await db.insert(cmMegaLeagues).values({
    tournamentId: input.tournamentId,
    name: input.name,                        // "IPL 2026 Mega League"
    description: input.description,
    visibility: 'public',
    entryFee: input.entryFee,
    prizePool: input.prizePool,
    prizeDistribution: input.prizeDistribution,
    roundPrizeSplit: input.roundPrizeSplit,  // Optional per-round sub-pool config
    maxMembers: input.maxMembers ?? 10000,
    status: 'draft',
    createdBy: adminUserId,
  }).returning();

  return league;
}

async function composeRound(adminUserId: string, input: ComposeRoundInput) {
  assertAdmin(adminUserId);

  const league = await getMegaLeague(input.megaLeagueId);
  assert(league.status === 'draft' || league.status === 'open',
    'Cannot add rounds to an in-progress or settled league');

  // Admin picks which matches belong to this round
  const matches = await getMatchesByIds(input.matchIds);
  assert(matches.length === input.matchIds.length, 'Invalid match IDs');
  assert(matches.every(m => m.tournamentId === league.tournamentId),
    'All matches must belong to the league tournament');

  // Derive window from selected matches
  const windowStart = min(matches.map(m => m.startTime));
  const windowEnd   = max(matches.map(m => m.estimatedEndTime));
  const lockTime    = input.lockTime ?? subMinutes(windowStart, 30);

  const round = await db.insert(cmRounds).values({
    megaLeagueId: league.id,
    tournamentId: league.tournamentId,
    roundNumber: input.roundNumber,
    name: input.name,                        // "Round 1 — Opening Fixtures"
    matchIds: input.matchIds,
    windowStart,
    windowEnd,
    lockTime,
    matchesTotal: input.matchIds.length,
    status: 'upcoming',
  }).returning();

  return round;
}

async function publishMegaLeague(adminUserId: string, megaLeagueId: string) {
  assertAdmin(adminUserId);
  const league = await getMegaLeague(megaLeagueId);
  assert(league.status === 'draft', 'League already published');

  const rounds = await getRounds(megaLeagueId);
  assert(rounds.length >= 1, 'League must have at least one round');

  await db.update(cmMegaLeagues)
    .set({ status: 'open' })
    .where(eq(cmMegaLeagues.id, megaLeagueId));
}
```

**Lifecycle automation (system-managed, not admin):**
- When a round's `windowStart - 30min` is reached → `upcoming → open` (player pool populated from squads)
- When `lockTime` is reached → `open → locked`
- When first match starts → `locked → live`
- When all matches in `matchIds` are final → `live → settled` (triggers settlement, updates season standings)

**Editing rules:**
- Admin can add, edit, or delete `upcoming` rounds freely
- Once a round transitions to `locked`, its `matchIds` and config are immutable
- Admin cannot delete a mega league that has any round past `upcoming`

### 12.2 Live Score Hook

```typescript
// In existing score-updater job

async function onPlayerScoreUpdate(matchId: string) {
  // ... existing fantasy scoring ...
  
  // CM live update
  const liveRounds = await db.query.cmRounds.findMany({
    where: and(
      eq(cmRounds.status, 'live'),
      sql`${matchId} = ANY(${cmRounds.matchIds})`,
    ),
  });
  
  for (const round of liveRounds) {
    const entries = await getEntriesWithPlayersInMatch(round.id, matchId);
    for (const entry of entries) {
      const result = runSimulation(entry, round);
      await updateEntryLiveState(entry.id, result);
    }
    // Re-rank all contests for this round
    await rerankAllContests(round.id);
  }
}
```

### 12.3 Settlement

```typescript
async function settleRound(roundId: string) {
  const round = await getRound(roundId);
  
  // 1. Final simulation for all entries
  const entries = await getAllEntries(roundId);
  for (const entry of entries) {
    const result = runSimulation(entry, round);  // Final, with all match data
    await finalizeEntry(entry.id, result);
  }
  
  // 2. Settle each contest
  const contests = await getContests(roundId);
  for (const contest of contests) {
    // Rank members by NRR
    const members = await getContestMembers(contest.id);
    const ranked = rankByNRR(members);
    
    // Distribute prizes
    for (const member of ranked) {
      const prize = calculatePrize(member.rank, contest.prizeDistribution, contest.prizePool);
      if (prize > 0) {
        await creditPopCoins(member.userId, prize, {
          type: 'cm_contest_win', contestId: contest.id,
        });
        await updateMemberPrize(member.id, prize, member.rank);
      }
    }
    
    await db.update(cmContests).set({ status: 'settled' }).where(eq(cmContests.id, contest.id));
  }
  
  // 3. Update season standings
  for (const entry of entries) {
    await updateSeasonStandings(entry.userId, round.tournamentId, entry.nrr);
  }
  
  // 4. Mark round settled
  await db.update(cmRounds).set({
    status: 'settled', totalEntries: entries.length,
    avgNrr: average(entries, 'nrr'), bestNrr: max(entries, 'nrr'),
  }).where(eq(cmRounds.id, roundId));
  
  // 5. Push notifications
  for (const contest of contests) {
    await notifyContestResults(contest.id);
  }
}
```

---

## 13. Integration with Existing Systems

### 13.1 Where CM Sits in the App

```
DraftPlay App
├── Home
├── Classic Fantasy (salary cap, captain/VC)
├── Draft / Auction Leagues
├── Predictions
├── 🆕 Cricket Manager ←── Standalone mode
│     ├── Round Hub
│     ├── Contest Browser
│     ├── Entry Builder (3 tabs)
│     ├── Live Match View
│     ├── Results & Reveal
│     └── Season Dashboard
└── Profile / Wallet
```

### 13.2 League Format

Add `cricket_manager` to `LeagueFormat`:

```typescript
type LeagueFormat = 'salary_cap' | 'draft' | 'auction' | 'prediction' | 'cricket_manager';
```

Users can create leagues with `cricket_manager` format → private contests auto-created for each round.

### 13.3 Pop Coins Integration

| Action | Pop Coins |
|--------|-----------|
| Contest entry fee | -10 to -100 PC (varies) |
| Contest win | Based on prize distribution |
| Season Top 10 | +500 PC jackpot |
| Perfect Round (NRR > 5.0) | +100 bonus |
| 10-win streak | +200 bonus |

New transaction types:

```typescript
type TransactionType = ... | 'cm_contest_entry' | 'cm_contest_win' 
  | 'cm_season_reward' | 'cm_streak_bonus' | 'cm_achievement';
```

### 13.4 Subscription Tier Gating

| Feature | Basic | Pro | Elite |
|---------|-------|-----|-------|
| Play CM rounds | 1/week | Unlimited | Unlimited |
| Contest types | Free only | All | All |
| View leaderboard | Top 10 | Full | Full |
| Chips per tournament | 2 | 4 | All 5 |
| Post-round "What If" | No | Yes | Yes |
| AI batting order suggestion | No | No | Yes |

### 13.5 Predictions

Live predictions can overlay on CM rounds:
- "Will CricketGuru's NRR stay above +3.0?" — community prediction during live phase
- Prediction points tracked separately (don't affect NRR)

### 13.6 Push Notifications

| Trigger | Message |
|---------|---------|
| Round opens | "IPL Week 5 is open! Build your XI" |
| 1hr before lock | "Lock in 1 hour! Entry incomplete" |
| Live milestone | "Your batting just crossed 150!" |
| Rank change | "You moved up to #3 in Mega Contest!" |
| Settlement | "Week 5 results! You ranked #12 — earned 200 PC" |
| Streak | "5-round winning streak!" |

### 13.7 Awards

| Award | Trigger |
|-------|---------|
| Master Manager | NRR > 5.0 in a single round |
| Unbeaten | 10-round winning streak |
| Tactician | Top 10% in a contest |
| Bowling Masterclass | Bowling takes 10 wickets |
| Season Champion | #1 in season standings |

### 13.8 Guru AI

| Feature | Tier | Example |
|---------|------|---------|
| Rate My XI | Pro+ | "Strong batting, weak death bowling" |
| Order Suggestion | Elite | AI-optimized batting order |
| Bowling Priority Advice | Pro+ | "Open with Bumrah, save Rashid for middle overs" |

---

## 14. Chips & Power-ups

One of each per tournament. Once used, gone.

| Chip | Effect |
|------|--------|
| **Pinch Hitter** | Swap batting positions #1 and #11 |
| **Death Specialist** | Last 2 bowlers get 1.5x wicket value |
| **Extra Over** | One bowler can contribute 5 overs (30 balls) instead of 4 |
| **Night Watchman** | Insert guaranteed 15(20) at any batting position |
| **Super Sub** | Pick 12 players — swap one after all matches end, before settlement |

---

## 15. Round Variants

| Variant | Balls | Squad | Min Bowlers | Max/Bowler | For |
|---------|-------|-------|-------------|-----------|-----|
| **Standard** | 120 | 11 | 5 | 4 overs | T20 tournaments |
| **Powerplay** | 36 | 6 | 3 | 2 overs | Parallel mini-round |
| **Death Overs** | 30 | 5 | 3 | 2 overs | Parallel mini-round |
| **ODI Manager** | 300 | 11 | 5 | 10 overs | ODI tournaments |

---

## 16. Edge Cases & Rules

### Player Scenarios

| Scenario | Rule |
|----------|------|
| Player DNB (didn't bat) | 0 runs, 0 balls. Skipped, next batter faces. |
| Player didn't bowl IRL | 0 overs contributed. Next bowler fills in. |
| Player played 2 matches in window | Stats aggregated, bowler capped at 4 overs total. |
| Player retired hurt | Use actual stats. Not counted as dismissed. |
| Match abandoned | That player's stats = 0. Other matches still count. |
| ALL matches abandoned | Round voided. No NRR impact. |

### Simulation Scenarios

| Scenario | Rule |
|----------|------|
| All batters DNB | Batting total = 0. Heavy negative NRR. |
| All out (10 wickets) | Batting innings ends early. Denominator stays at 20 overs (real NRR rule) — fewer total runs = lower NRR. |
| Bowlers don't cover 120 balls | Remaining balls = 0 conceded (benefits user). |
| NRR tie | Batting SR tie-breaker. |

### Anti-Gaming

| Rule | Why |
|------|-----|
| Lock 30 min before first match | No real-time optimization |
| One entry per round (shared across contests) | No hedging with different entries |
| Chips declared at entry time | No retroactive optimization |
| Super Sub swap: 30 min after last match | Time-limited window |

---

## 17. Implementation Phases

### Phase 1: Core MVP

| Task | Files |
|------|-------|
| DB schema (cm_mega_leagues, cm_rounds, cm_contests, cm_entries, cm_contest_members) | `packages/db/src/schema/cricket-manager.ts` |
| 120-ball engine (batting + bowling + lethality) | `packages/api/src/services/cm-engine.ts` |
| Round manager (lifecycle transitions, settlement) | `packages/api/src/services/cm-round-manager.ts` |
| tRPC router (mega leagues, rounds, contests, entries, leaderboard) | `packages/api/src/routers/cricket-manager.ts` |
| Admin mega-league composer (create league, compose rounds, publish) | `apps/web/app/admin/cricket-manager/` |
| Contest creation + join + prize distribution | `packages/api/src/services/cm-contest.ts` |
| Entry builder UI (3 tabs) | `apps/mobile/app/cricket-manager/` |
| Contest browser UI | `apps/mobile/app/cricket-manager/contests/` |
| Round leaderboard UI | Reuse leaderboard components |
| Score-updater hook for live updates | `packages/api/src/jobs/score-updater.ts` |
| Engine unit tests | `tests/unit/cm-engine.test.ts` |

### Phase 2: Live Experience

| Task | Details |
|------|---------|
| Dual progress bar UI | Batting vs bowling race, real-time |
| Live contest leaderboard | Rank shifts as matches play out |
| Per-player live scorecard | "Kohli 45(28) DONE, Pandya 12*(6) LIVE" |
| Push notifications | Milestones, rank changes, results |

### Phase 3: Season & Social

| Task | Details |
|------|---------|
| Season standings + charts | Cumulative NRR, streaks |
| Private contests + invite codes | Friends compete |
| Post-round reveal | See winners' strategies |
| Chips (5 types) | Inventory + simulation integration |
| Pop Coins rewards | Entry fees, prizes, bonuses |
| Awards | CM-specific badges |

### Phase 4: Depth & Monetization

| Task | Details |
|------|---------|
| Subscription tier gating | Free/Pro/Elite feature gates |
| Guru AI integration | Rate XI, suggest batting order, suggest bowling priority |
| "What If" analysis | Post-round optimization |
| Round variants | Powerplay, Death Overs |
| H2H contests | Direct 1v1 duels |

---

## Appendix: Worked Example

### Setup

**Round:** IPL Week 4 (7 matches, 5 days)
**Contest:** Mega Contest (342 members, 20 PC entry, 15,000 PC pool)

**Member "You":**
- Squad: Kohli, Gill, Pant, Pandya(AR), Jadeja(AR), Ishan, Bumrah, Shami, Chahal, Rashid, Chahar

### Aggregated Real Stats

| Player | Runs | Balls | Dismissed | Overs | Conceded | Wickets |
|--------|------|-------|-----------|-------|----------|---------|
| Kohli | 45 | 30 | Yes | — | — | — |
| Gill | 72 | 48 | Yes | — | — | — |
| Pant | 28 | 15 | No | — | — | — |
| Pandya | 45 | 27 | Yes | 5.0 | 44 | 1 |
| Jadeja | 22 | 14 | Yes | 4.0 | 24 | 2 |
| Ishan | 8 | 6 | Yes | — | — | — |
| Bumrah | 0 | 0 | — | 8.0 | 40 | 5 |
| Shami | 0 | 0 | — | 4.0 | 32 | 1 |
| Chahal | 0 | 0 | — | 4.0 | 36 | 1 |
| Rashid | 0 | 0 | — | 4.0 | 24 | 2 |
| Chahar | 0 | 0 | — | 3.0 | 28 | 1 |

### Batting Simulation (Order: Kohli, Gill, Pant, Pandya, Jadeja, Ishan, ...)

| # | Player | Runs | Balls | Cumul. Balls | Status |
|---|--------|------|-------|-------------|--------|
| 1 | Kohli | 45 | 30 | 30 | FULL (out) |
| 2 | Gill | 72 | 48 | 78 | FULL (out) |
| 3 | Pant | 28 | 15 | 93 | FULL (not out) |
| 4 | Pandya | 45 | 27 | 120 | FULL (out) |
| 5+ | Jadeja... | — | — | 120 | DIDN'T BAT |

**Batting Total: 190, Balls: 120, Wickets: 3**

### Bowling Simulation (Priority: Bumrah, Shami, Chahal, Rashid, Jadeja, Pandya, Chahar)

| Pri | Bowler | Real Overs | Capped | Balls Used | Conceded | Wickets |
|-----|--------|-----------|--------|------------|----------|---------|
| 1 | Bumrah | 8.0 | 4.0 | 24 | 20 | 2 |
| 2 | Shami | 4.0 | 4.0 | 24 | 32 | 1 |
| 3 | Chahal | 4.0 | 4.0 | 24 | 36 | 1 |
| 4 | Rashid | 4.0 | 4.0 | 24 | 24 | 2 |
| 5 | Jadeja | 4.0 | 4.0 | 24 | 24 | 2 |
| 6 | Pandya | — | — | 0 | 0 | 0 |

**Bowling Total: 136, Balls: 120, Wickets: 8**

### Result

```
Batting Total: 190
Bowling Total: 136

NRR = (190/20) - (136/20) = 9.50 - 6.80 = +2.70
Batting SR = (190/120) × 100 = 158.33

Contest Rank: #5 of 342 → Won 150 PC
```

**Why #5?** Members ranked above you found better batting orders — they put Abhishek Sharma (SR: 190) at #1 instead of Kohli, freeing up more balls for the middle order. Same concept, different strategy, different result. That's Cricket Manager.

---

## Appendix A — Known Loopholes & Edge Cases (Revisit Later)

This appendix catalogs loopholes in the engine that remain under the current admin convention: **one match per player per round (N=1)**. Several of the original concerns (mega-player match-count concentration, binary dismissal flag, round-wide 4-over cap mismatch, linear bowling smoothing, wicket rounding at share<1) are naturally eliminated by the N=1 rule and are not included here. What follows is the residual list, ordered by severity.

### Loophole #1 — Dead bowler / DNB quota fraud (**✅ FIXED 2026-04-13**)

**Where:** [packages/api/src/services/cm-engine.ts:135](packages/api/src/services/cm-engine.ts#L135) and [:260](packages/api/src/services/cm-engine.ts#L260)

**Original mechanism:** Two engine behaviors colluded:
- Batters with `ballsFaced === 0 && runs === 0` were silently skipped (no slot cost).
- Bowlers with `realBalls === 0` were silently skipped (no priority cost).
- The "min 5 bowlers" rule checked the pick's role tag, not actual match participation.
- NRR divided by a fixed 20 overs regardless of how many balls were actually bowled.

**Original exploit:** Pick 3 real bowlers + 2 token "bowlers" from teams with deep attacks where the 7th/8th bowlers reliably don't bowl. The 2 tokens contribute zero runs conceded, but the bowling denominator stays at 20 overs — creating ~48 "free dot balls" worth of NRR. Measured swing: **+3.15 NRR** for zero effort.

#### The fix we shipped

We rejected a settlement-time validator (punitive, false positives on injuries, binary rejection) and fixed the underlying **asymmetry** instead. The root cause wasn't ghost bowlers — it was that short batting was naturally penalized (fewer runs against a fixed 20-over denominator) while short bowling was *rewarded* by the same denominator. Two complementary mechanisms now close both exits:

**1. Phantom-fill (`bat_first` only)** — when `simulateBowling` runs with `applyPhantomFill = true` and the real bowling innings ends with unused balls remaining *and* fewer than 10 wickets, the gap is filled with notional runs at the round's own average ER:

```ts
// packages/api/src/services/cm-engine.ts
if (
  applyPhantomFill &&
  ballsBowled < ballLimit &&
  wickets < 10 &&
  config.phantomFillER !== undefined &&
  config.phantomFillER > 0
) {
  const phantomBalls = ballLimit - ballsBowled;
  const phantomOvers = phantomBalls / BALLS_PER_OVER;
  const phantomRuns = Math.round(phantomOvers * config.phantomFillER);
  total += phantomRuns;
  ballsBowled = ballLimit;
  phantomApplied = true;
}
```

The `wickets < 10` guard preserves lethality — a legitimate bowling-out still gets full credit for the short innings. Phantom fill only closes gaps from *missing* bowling capacity.

**2. Round-average ER is computed from the round's own match data** — not a hardcoded constant. Added `computeRoundAvgER` in [packages/api/src/services/cm-service.ts](packages/api/src/services/cm-service.ts) which sums runs conceded and balls bowled across every real bowler in every match of the round. Self-calibrates to batting-paradise vs bowler-friendly conditions. Fallback of 8.5 ER only used when no real bowling data exists (e.g. before match 1 starts).

**3. `runEntrySimulation` threads `phantomFillER` into `RoundConfig`** — every sim call now computes the round's avg ER and passes it through. No hardcoded league constants anywhere.

#### Round 5 before vs after (using the user's own data)

| | Before fix | After fix |
|---|---|---|
| Real balls bowled | 65 | 65 |
| Real runs conceded | 82 | 82 |
| Phantom balls | 0 | 55 (9.1 overs) |
| Round avg ER | — | ~9.5 (high-scoring round) |
| Phantom runs | 0 | round(9.1 × 9.5) = **87** |
| Total bowling runs | 82 | **169** |
| Final NRR | **+6.65** | **+2.30** |

The fake cushion disappears. The user still wins on genuine batting (215 runs is real), but the ghost bowlers no longer contribute free "dot balls" to the denominator.

#### Why this is strictly better than a validator

| Concern | Validator approach | Phantom-fill approach |
|---|---|---|
| Injured bowler (1 real over) | Voids entire entry ❌ | Small penalty proportional to gap ✅ |
| Ghost bowler exploit | Rejects | Mathematically nullifies the edge ✅ |
| User experience | "Your entry was voided" | Normal settlement, just lower NRR ✅ |
| Detects partial shortness | Binary detection only | Linear penalty ✅ |
| False positive rate | High | Zero ✅ |

#### Regression tests added

In [tests/unit/cm-engine.test.ts](tests/unit/cm-engine.test.ts):
- `phantom-fill: 5 real 4-over bowlers pay zero penalty (honest baseline)` — ensures honest entries pay nothing
- `phantom-fill: ghost bowler cheater gets charged at round-avg ER (bat_first)` — reproduces the exploit with exact numbers
- `phantom-fill: NOT triggered when bowling-out (wickets >= 10)` — preserves lethality rule

---

### Loophole #2 — `bat_first` is strictly dominant (**✅ FIXED 2026-04-13**)

**Where:** [packages/api/src/services/cm-engine.ts:307-327](packages/api/src/services/cm-engine.ts#L307-L327)

**Original mechanism:** NRR = `batting/20 - bowling/20` with **both** divisors fixed at 20 overs. `bowl_first` capped the batting numerator (chase target) but left the denominator the same, guaranteeing a lower NRR. There was no scenario where `bowl_first` produced a strictly better NRR than `bat_first`.

#### The fix we shipped

Fixed in the same patch as #1 — the two loopholes shared a root cause (the 20/20 denominator model). `bowl_first` now uses **actual-overs denominators** (rate-based), while `bat_first` keeps the 20/20 baseline with phantom fill. This is ICC-aligned: the chasing side in real cricket is scored on actual overs faced, which is exactly what the user pointed out in the original NRR conversation.

```ts
// packages/api/src/services/cm-engine.ts — simulateEntry
if (toss === "bowl_first") {
  // Risk play: real bowling innings (no phantom fill) then chase.
  // Rate-based denominators reward fast chases and punish short bowling.
  bowling = simulateBowling(entry, statsByPlayerId, config, false);
  batting = simulateBatting(entry, statsByPlayerId, config, bowling.total + 1);
  const battingOvers = batting.chaseComplete
    ? batting.ballsUsed / BALLS_PER_OVER
    : OVERS_PER_INNINGS; // failed chase → ICC full-allocation penalty
  const bowlingOvers =
    bowling.ballsBowled > 0 ? bowling.ballsBowled / BALLS_PER_OVER : OVERS_PER_INNINGS;
  nrr = computeNrr(batting.total, bowling.total, battingOvers, bowlingOvers);
} else {
  // Safe baseline: freeroll batting + phantom-filled bowling, 20 / 20 denominators.
  bowling = simulateBowling(entry, statsByPlayerId, config, true);
  batting = simulateBatting(entry, statsByPlayerId, config);
  nrr = computeNrr(batting.total, bowling.total);
}
```

`computeNrr` now accepts optional `battingOvers` and `bowlingOvers` parameters that default to 20. A failed chase in `bowl_first` falls back to a 20-over batting denominator (ICC's all-out rule equivalent), so `bowl_first` becomes a genuine risk/reward lever: commit to a chase and get rate-based rewards, or fail the chase and eat the full-allocation penalty.

#### Two modes, two legitimate strategies

| Scenario | `bat_first` NRR | `bowl_first` NRR | Winner |
|---|---|---|---|
| Low bowling + efficient chase (100r bowled, 101-target chased fast) | moderate | **higher rate** | bowl_first |
| High bowling + long slow batting (worked example: 190 vs 136) | **+2.70** | +2.44 | bat_first |
| Failed chase (batting can't reach target) | safe baseline | **−2.00 penalty** | bat_first |

The toss mechanic now has real consequences. Neither mode strictly dominates — choice matters.

#### Regression tests added

- `bowl_first fast chase: rate-based denominators reward efficient chase` — proves bowl_first can beat bat_first
- `bowl_first failed chase: falls back to 20-over batting denominator` — proves the failed-chase penalty fires
- `toss bowl_first: batters stop when chase target reached (rate-based denominators)` — existing test updated: NRR now **+2.436** instead of the broken +0.05

---

### Loophole #3 — Chase-mode mid-round NRR preview is mathematically wrong (UX bug)

**Where:** [packages/api/src/services/cm-engine.ts:307-327](packages/api/src/services/cm-engine.ts#L307-L327)

**Mechanism:** `simulateEntry` runs `simulateBowling` first, then (for `bowl_first`) runs `simulateBatting` with `target = bowling.total + 1`. During a **live** round, `bowling.total` is a running partial that will change at settlement.

**Example:** Round 5 state — bowling total so far = 45 (4 of 5 matches done).

User A (bat_first) and User B (bowl_first) pick identical 11 players.

- **User A preview:** NRR = `205/20 - 45/20 = +8.00` ✅
- **User B preview:** chase target = 46, batters stop at Rohit's 16th run → `NRR = 46/20 - 45/20 = +0.05` ❌

User B panics seeing +0.05. But at settlement, final bowling total will be (say) 140, target becomes 141, and their real NRR is a totally different number. The preview has shown a **meaningless** value based on a target that won't exist at settlement.

**Fix options:**

1. **Skip chase during live preview:**
   ```ts
   const isLive = round.status === "live";
   const toss = isLive ? "bat_first" : entry.toss;
   ```
   With disclaimer: *"Live projection — toss applied at settlement."*
2. **Show both bounds:** Display both `bat_first` NRR and `bowl_first` NRR with a note.

**Severity:** Low for correctness (settlement math is fine). High for UX trust — users seeing preview jump from +0.05 to +X.XX at settlement will assume the engine is broken.

---

### Loophole #4 — Partial-status dismissal escape (cosmetic under N=1)

**Where:** [packages/api/src/services/cm-engine.ts:191-192](packages/api/src/services/cm-engine.ts#L191-L192)
```ts
const dismissedThisSlot = stats.dismissed && status === "full" && !stoppedByChase;
```

**Mechanism:** A real-life dismissal in a slot that got cut short by the 120-ball budget (`status: "partial"`) is silently discarded from the wicket count.

**Honest assessment under N=1:** After a partial slot, `ballsUsed === ballLimit` exactly, so every subsequent slot becomes `didnt_bat`. This means the fix **never changes `total`, never changes `ballsUsed`**, so it **never changes NRR or SR**. The only thing affected is the `wickets` number in the returned payload, which is a display field.

**Fix (1-line change):**
```ts
const dismissedThisSlot = stats.dismissed && !stoppedByChase;
```

**Why fix it anyway:**
- Prevents regression if N ever increases (the loophole reactivates with full force under multi-match rounds)
- Correctness for any future tiebreaker or display that reads `wickets`
- 1-line change, zero risk

**Severity under N=1:** Zero exploit value. Fix for code hygiene, not for balance.

---

### Loophole #5 — Budget-wall bowling rounding (corner case)

**Where:** [packages/api/src/services/cm-engine.ts:263-271](packages/api/src/services/cm-engine.ts#L263-L271)

**Mechanism:** When priorities 1–5 don't fully consume the 120-ball budget and a 6th+ bowler spills into the remainder, `share = remainingBudget / realBalls < 1` and `wicketsTaken = Math.round(stats.wickets × share)` can round a real wicket down to zero.

**Example:** Priorities 1–5 use 100 balls. Bowler #6 Jadeja 4-0-36-4 (24 real balls) spills into the remaining 20 balls.
- `share = 20/24 = 0.833`
- `wicketsTaken = round(4 × 0.833) = round(3.33) = 3`

One wicket vanished. If preserved, cumulative wickets would reach 10 → lethality stop triggers → bowling innings ends ~15 balls earlier → bowling total ~23 runs lower → NRR better by ~1.15.

**Trigger conditions (all must hold):**
1. Priority list has 6+ bowlers (most entries have exactly 5)
2. Priorities 1–5 don't fully use the 120-ball budget (requires short spells — rain, early finish)
3. A wicket-rich bowler sits in the spillover position

Combined probability: ~5–10% of entries.

**Fix options:**

1. **Fractional wicket tracking:**
   ```ts
   cumulativeFractionalWickets += stats.wickets * share;
   const wicketsTaken = Math.floor(cumulativeFractionalWickets) - previouslyCounted;
   ```
2. **Count real wickets against the 10-wicket gate** (conceded runs still scaled):
   ```ts
   wickets = Math.min(10, wickets + stats.wickets);
   ```

**Severity:** Low in typical cases, medium in corners. Not exploitable deterministically under N=1.

---

### Summary & status

| # | Loophole | NRR impact | Exploitable? | Status |
|---|---|---|---|---|
| 1 | Dead bowler / DNB quota fraud | +2 to +4 per round | **Yes, deterministically** | **✅ FIXED 2026-04-13** — phantom-fill at round-avg ER |
| 2 | `bat_first` dominance | +2 to +3 for informed users | No (dominant strategy) | **✅ FIXED 2026-04-13** — rate-based denominators for `bowl_first` |
| 3 | Chase preview mid-round | Zero (display only) | No | Open — UI label only |
| 4 | Partial dismissal escape | Zero under N=1 | No | Open — 1 line hygiene fix |
| 5 | Budget-wall rounding | +1 to +1.5 in ~5–10% of entries | Mild | Open — ~3 lines |

**The 2026-04-13 patch closed loopholes #1 and #2 together** via a single root-cause fix: the 20/20 NRR denominator model was the shared bug. `bat_first` now applies phantom-fill (computed from the round's own avg ER) to close the ghost-bowler exploit; `bowl_first` uses ICC-style rate-based denominators (actual overs for successful chases, 20-over fallback for failed chases) to revive the toss mechanic. Both fixes land in [packages/api/src/services/cm-engine.ts](packages/api/src/services/cm-engine.ts) and [packages/api/src/services/cm-service.ts](packages/api/src/services/cm-service.ts) with 5 new regression tests in [tests/unit/cm-engine.test.ts](tests/unit/cm-engine.test.ts). The 3 remaining loopholes (#3, #4, #5) are all low-impact and can ship post-launch.

**Dependency on N=1:** This analysis assumes admins always compose rounds so that each player appears in exactly one match. If that convention changes, re-read Appendix A in full — loopholes originally covered by N=1 (mega-player concentration, binary dismissal flag, 4-over cap mismatch) reactivate with severity scaling in N.

---

*This is the complete implementation spec for Cricket Manager. Hand to an AI developer and start with Phase 1 (Section 17).*
