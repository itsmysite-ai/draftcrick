# Engagement Features Backlog

Features prioritized by joy-to-friction ratio. All designed for the salary-cap league format.
500 PC signup bonus is the baseline — these mechanics create reasons to spend and earn more.

---

## Priority 1: Mini-Predictions (Live Match Engagement)

**Status:** Implemented (Phase 3)

**Problem:** During live matches, users passively watch the leaderboard. No way to interact with league-mates or earn bonus points.

**Solution:** Community-driven prediction cards during live matches. League members create yes/no questions, vote on outcomes, and earn/lose **fantasy points** (not Pop Coins) based on results.

**How it works:**
1. **Create:** Any league member creates a question with two options (e.g., "Will Kohli hit a six this over?" — Yes / No)
2. **AI Assist:** Gemini rates difficulty (easy/medium/hard) and suggests contextual questions based on live match state
3. **Vote:** League members pick an option. Max 8 votes per user per match.
4. **Resolve ("Pub rules"):** After the deadline (end of over/innings/match), any member taps the winning option. No formal disputes — friends police themselves.
5. **Points:** Correct = +5/+10/+20 pts (easy/medium/hard). Wrong = -2/-5/-10 pts. Points add directly to fantasy team total.
6. **AI Roast:** On resolution, AI generates a one-liner trash talk about the result.
7. **Auto-Titles:** Streaks earn titles shown next to username — "prophet" (3+ correct), "on fire" (5+), "cursed" (3+ wrong), "ATM" (5+ wrong), "shark" (most pts earned)

**Constraints:**
- Max 3 predictions created per user per match
- Max 8 votes per user per match
- Max ±50 prediction points impact per match (prevents gaming)
- Only users with a team in the contest can participate

**DB tables:** `live_predictions`, `live_prediction_votes`, + `prediction_points` column on `fantasy_teams`

**Files:**
- Schema: `packages/db/src/schema/predictions.ts`
- Service: `packages/api/src/services/live-predictions.ts`
- Router: `packages/api/src/routers/prediction.ts` (endpoints: `liveCreate`, `liveVote`, `liveResolve`, `liveList`, `liveSuggest`)
- UI: `apps/mobile/components/LivePredictionFeed.tsx`
- Score integration: `packages/api/src/jobs/score-updater.ts` (includes prediction points in total)

---

## Priority 2: Rival System (Recurring H2H)

**Status:** Backlog

**Problem:** H2H duels are one-off. No continuity between matches.

**Solution:** Let users set a rival — auto-matched across every match in a tournament.

**How it works:**
- From profile or H2H result screen: "Set as Rival" button
- Once set, system auto-creates an H2H contest for every match both users have teams in
- Running tally visible on profile: "You lead Rahul 4-2 in IPL 2026"
- Push notification: "Your rival just built their team for tonight's match — will you?"
- End-of-tournament: rival trophy + summary card (shareable)

**Key decisions:**
- Stake: configurable per rivalry (free, or fixed PC amount per match)
- Limit: 1 rival per tournament? Or allow multiple?
- Opt-out: either player can end rivalry at any time

**DB changes:** `rivalries` table (user_a, user_b, tournament_id, score_a, score_b, stake, status)

---

## Priority 3: Achievement Badges (Passive Surprise Rewards)

**Status:** Backlog

**Problem:** No recognition for interesting plays or milestones. User sees rank, that's it.

**Solution:** Badges awarded automatically when certain conditions are met. Zero friction — user just gets surprised.

**Badge ideas:**

| Badge | Condition |
|-------|-----------|
| Centurion | Team scores 300+ total points in a single match |
| Differential King | Won a contest where your captain was picked by <5% of users |
| Iron Defence | Picked 3+ bowlers who each took 2+ wickets |
| All-rounder Whisperer | Your all-rounder scored 50+ pts 3 times in a tournament |
| Giant Killer | Beat someone 10+ levels above you in H2H |
| Streak Master | 7-day login streak |
| Perfect Captain | Captain scored highest in the match 3 times |
| Budget Builder | Won a contest using <90 credits (out of 100) |
| Clean Sweep | All 11 players scored positive points |
| Early Bird | Built team within 1 hour of match being available |

**Where badges appear:**
- Profile page (badge showcase)
- Next to username in leaderboards
- Contest result screen (if newly earned)
- Push notification: "You earned Centurion!"

**DB changes:** `badges` table (definition), `user_badges` table (user_id, badge_id, earned_at, match_id)

---

## Priority 4: Crate Drops (Post-Contest Rewards)

**Status:** Backlog

**Problem:** Losing a contest feels bad. No reward for participation. Users who lose 2-3 in a row churn.

**Solution:** Every settled contest gives the user a crate. Even last place gets something.

**Crate tiers:**

| Tier | When | Contents |
|------|------|----------|
| Common | Free contest participation | 5-20 PC + small chance of badge |
| Rare | Paid contest participation | 20-50 PC + chance of power-up chip |
| Epic | Top 50% finish | 50-100 PC + higher chip chance |
| Legendary | Contest win | 100+ PC + guaranteed chip + exclusive avatar item |

**UX:**
- After contest settles, "Open Crate" card appears on contest result page
- Tap to open — short satisfying animation (split-flap / reveal style matching app theme)
- Contents revealed with celebration effect for rare items
- Crate stays available for 24 hours if not opened immediately (nudge notification)

**Economics:** Crates recycle a portion of the PC pool back to users, keeping the economy flowing. Net PC outflow is controlled by tuning drop rates.

**DB changes:** `crates` table (user_id, contest_id, tier, contents, opened_at)

---

## Priority 5: Power-Up Chips (Strategic Depth)

**Status:** Backlog

**Problem:** Every match plays the same — pick 11, pick captain/VC, done. No strategic variety.

**Solution:** Limited-use chips that modify scoring or team rules for a single match.

**Chips for salary-cap format:**

| Chip | Effect | Availability |
|------|--------|-------------|
| Triple Captain | Captain gets 3x instead of 2x for one match | 1 free per tournament, then 200 PC |
| Second Chance | Swap 1 player after toss (before match starts) | 100 PC per use |
| Spy Glass | See opponent's captain in H2H before locking yours | 75 PC (H2H only) |
| 12th Man | Add a 12th player at 0.5x points | 150 PC per use |

**Constraints:**
- Max 1 chip per contest entry
- Chips earned from crate drops or purchased with PC
- Tournament chip limit: max 3 uses per tournament (prevents pay-to-win)

**DB changes:** `user_chips` table (user_id, chip_type, source, used_at, contest_id)

---

## Priority 6: Season XP & Levels (Progression System)

**Status:** Backlog (deferred — adds UI weight, feels grindy)

**Problem:** No sense of long-term progression beyond win/loss record.

**Solution:** XP earned passively from all actions. Levels unlock cosmetic rewards.

**XP sources:**
- Build a team: +20 XP
- Join a contest: +10 XP
- Win a contest: +100 XP
- Daily login: +5 XP
- Correct captain pick (highest scorer): +25 XP
- Complete a prediction: +5 XP
- Earn a badge: +50 XP

**Levels:** 1-50, with titles:
- 1-10: Gully Cricketer
- 11-20: Club Player
- 21-30: Domestic Pro
- 31-40: International Star
- 41-50: Legend

**Unlocks per level:** Avatar frames, team name prefixes, profile flair. All cosmetic.

**Season resets:** XP resets each tournament season. Keeps the grind fresh, prevents permanent advantages.

**DB changes:** `user_xp` table (user_id, season_id, total_xp, level), `xp_events` table for audit trail

---

## Priority 7: Weekly Challenges (Deferred)

**Status:** Backlog (deferred — feels like homework, adds obligation)

**Problem:** Users without active matches have no reason to open the app.

**Solution:** 3 rotating challenges per week with PC rewards.

**Example challenges:**
- "Pick at least 2 uncapped players this week" → 50 PC
- "Win an H2H duel" → 100 PC
- "Build a team in under 60 seconds" → badge
- "Use Guru AI to build a team" → 25 PC (feature discovery)
- Complete all 3 → bonus chest (random 50-200 PC)

**Why deferred:** Creates obligation rather than joy. Only implement if retention data shows mid-week drop-off.

---

## Not Applicable

### Trade Window
Requires player exclusivity (draft/auction format). In salary cap, everyone can pick the same players — nothing to trade. Revisit if/when draft leagues become primary format.
