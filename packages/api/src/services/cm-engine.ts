/**
 * Cricket Manager — 120-ball simulation engine
 *
 * Pure functions only. No DB, no I/O. Given a member's entry plus aggregated
 * per-player stats for a round, produces batting/bowling totals and NRR.
 *
 * Spec: /docs/CRICKET_MANAGER_DRAFT.md §2, §7
 */

export type PlayerRole =
  | "batsman"
  | "bowler"
  | "all_rounder"
  | "wicket_keeper";

export type TossChoice = "bat_first" | "bowl_first";

/**
 * Aggregated stats for a single player across all matches in a round window.
 * Sum of runs, balls, overs, conceded across multiple real matches.
 */
export interface AggregatedPlayerStats {
  playerId: string;
  role: PlayerRole;
  // Batting (sum across matches)
  runs: number;
  ballsFaced: number;
  dismissed: boolean; // true if out in ANY of the matches played
  matchesBatted: number;
  // Bowling (sum across matches)
  overs: number; // decimal overs (e.g., 8.0 = 8 overs, 4.3 = 4 overs 3 balls)
  runsConceded: number;
  wickets: number;
  matchesBowled: number;
}

export interface EntryInput {
  players: Array<{ playerId: string }>;
  battingOrder: Array<{ position: number; playerId: string }>;
  bowlingPriority: Array<{ priority: number; playerId: string }>;
}

export interface RoundConfig {
  ballLimit: number; // default 120
  maxOversPerBowler: number; // default 4
  /**
   * Phantom-fill economy rate (runs per over). When `simulateBowling` is called
   * with `applyPhantomFill = true` (i.e. `bat_first` toss) and the real bowling
   * innings ends with unused balls remaining *and* fewer than 10 wickets, the
   * unused balls are filled with notional runs at this ER. Closes the
   * short-bowling asymmetry where the NRR denominator is fixed at 20 overs but
   * the numerator gets to stay small. Usually set to the round's own average
   * bowling ER, computed from real match data at settlement.
   */
  phantomFillER?: number;
}

export interface BattingSimResult {
  total: number;
  ballsUsed: number;
  wickets: number;
  allOut: boolean;
  /** True when the batting innings stopped because the chase target was reached. */
  chaseComplete: boolean;
  details: Array<{
    position: number;
    playerId: string;
    runs: number;
    ballsFaced: number;
    dismissed: boolean;
    status: "full" | "partial" | "didnt_bat";
  }>;
}

export interface BowlingSimResult {
  total: number;
  ballsBowled: number;
  wickets: number;
  /** True when the short-bowling gap was closed with phantom runs (bat_first only). */
  phantomApplied: boolean;
  /** Runs added by phantom fill (0 when phantomApplied is false). */
  phantomRuns: number;
  /** Balls added by phantom fill (0 when phantomApplied is false). */
  phantomBalls: number;
  details: Array<{
    priority: number;
    playerId: string;
    cappedOvers: number;
    ballsUsed: number;
    runsConceded: number;
    wickets: number;
  }>;
}

export interface SimulationResult {
  batting: BattingSimResult;
  bowling: BowlingSimResult;
  nrr: number; // 4 decimal places recommended
  battingSr: number; // strike rate for tie-breaker
  win: boolean; // batting > bowling
}

const OVERS_PER_INNINGS = 20;
const BALLS_PER_OVER = 6;

/**
 * Convert a decimal-overs value (e.g., 4.3 = 4 overs 3 balls) to total balls.
 * Note: cricket notation — 4.3 means 4 full overs + 3 balls = 27 balls, NOT 4.3 × 6 = 25.8.
 */
export function oversToBalls(overs: number): number {
  const full = Math.floor(overs);
  const partial = Math.round((overs - full) * 10); // 0-5
  return full * BALLS_PER_OVER + partial;
}

export function ballsToOvers(balls: number): number {
  const full = Math.floor(balls / BALLS_PER_OVER);
  const partial = balls % BALLS_PER_OVER;
  return full + partial / 10;
}

/**
 * Run the batting simulation under the 120-ball limit.
 * Processes batters in batting order; each contributes runs until their real
 * balls faced are exhausted, the 120-ball budget is exhausted, or 10 wickets fall.
 *
 * When a chase `target` is provided (bowl-first scenario), the innings also
 * stops the moment cumulative runs reach the target — the last batter's
 * contribution is SR-scaled down to exactly hit the target. This is what makes
 * bowl-first vs bat-first produce meaningfully different NRRs.
 */
export function simulateBatting(
  entry: EntryInput,
  statsByPlayerId: Map<string, AggregatedPlayerStats>,
  config: RoundConfig,
  target?: number
): BattingSimResult {
  const ballLimit = config.ballLimit;
  const order = [...entry.battingOrder].sort((a, b) => a.position - b.position);
  const hasTarget = target != null && target > 0;

  let total = 0;
  let ballsUsed = 0;
  let wickets = 0;
  let chaseComplete = false;
  const details: BattingSimResult["details"] = [];

  for (const slot of order) {
    const stats = statsByPlayerId.get(slot.playerId);

    if (!stats || (stats.ballsFaced === 0 && stats.runs === 0)) {
      details.push({
        position: slot.position,
        playerId: slot.playerId,
        runs: 0,
        ballsFaced: 0,
        dismissed: false,
        status: "didnt_bat",
      });
      continue;
    }

    // Stop conditions: budget exhausted, all out, or chase already complete.
    if (ballsUsed >= ballLimit || wickets >= 10 || chaseComplete) {
      details.push({
        position: slot.position,
        playerId: slot.playerId,
        runs: 0,
        ballsFaced: 0,
        dismissed: false,
        status: "didnt_bat",
      });
      continue;
    }

    const remaining = ballLimit - ballsUsed;
    let contribRuns = stats.runs;
    let contribBalls = stats.ballsFaced;
    let status: "full" | "partial" = "full";
    let stoppedByChase = false;

    // Ball-budget partial — SR-scale runs to fit the remaining balls
    if (contribBalls > remaining) {
      const sr = contribBalls > 0 ? contribRuns / contribBalls : 0;
      contribBalls = remaining;
      contribRuns = Math.round(sr * contribBalls);
      status = "partial";
    }

    // Chase partial — if this batter's contribution would meet/exceed the
    // target, SR-scale them down to land exactly at the target.
    if (hasTarget && total + contribRuns >= target) {
      const runsNeeded = target - total;
      const sr = stats.ballsFaced > 0 ? stats.runs / stats.ballsFaced : 0;
      const ballsNeeded = sr > 0 ? Math.ceil(runsNeeded / sr) : contribBalls;
      contribRuns = runsNeeded;
      contribBalls = Math.min(contribBalls, ballsNeeded);
      status = "partial";
      stoppedByChase = true;
    }

    total += contribRuns;
    ballsUsed += contribBalls;

    // Dismissal: only count the wicket if the batter used their full real innings.
    // Chase-stopped batters are "not out" by definition.
    const dismissedThisSlot =
      stats.dismissed && status === "full" && !stoppedByChase;
    if (dismissedThisSlot) wickets += 1;

    details.push({
      position: slot.position,
      playerId: slot.playerId,
      runs: contribRuns,
      ballsFaced: contribBalls,
      dismissed: dismissedThisSlot,
      status,
    });

    if (stoppedByChase) chaseComplete = true;
  }

  return {
    total,
    ballsUsed,
    wickets,
    allOut: wickets >= 10,
    chaseComplete,
    details,
  };
}

/**
 * Run the bowling simulation. Bowlers bowl in priority order; each is capped at
 * maxOversPerBowler (default 4). Conceded runs are scaled proportionally to the
 * capped share of their real overs.
 *
 * "Lethality rule": if cumulative bowling wickets hit 10, bowling stops — the
 * remaining balls in the 120-ball budget don't count against the bowling total.
 * (§2.3 in the spec)
 *
 * Phantom-fill (opt-in via `applyPhantomFill`): when the real bowling innings
 * ends *without* taking 10 wickets and with unused balls remaining, the gap is
 * filled with notional runs at `config.phantomFillER` runs per over. This
 * closes the short-bowling asymmetry — a user can no longer harvest NRR by
 * stacking ghost bowlers whose 0-over "spells" leave the denominator at 20 ov
 * while contributing 0 real runs conceded. Only applied in `bat_first` toss;
 * `bowl_first` uses actual-overs denominators and needs no phantom fill.
 */
export function simulateBowling(
  entry: EntryInput,
  statsByPlayerId: Map<string, AggregatedPlayerStats>,
  config: RoundConfig,
  applyPhantomFill: boolean = false
): BowlingSimResult {
  const ballLimit = config.ballLimit;
  const maxBallsPerBowler = config.maxOversPerBowler * BALLS_PER_OVER;

  const priority = [...entry.bowlingPriority].sort(
    (a, b) => a.priority - b.priority
  );

  let total = 0;
  let ballsBowled = 0;
  let wickets = 0;
  const details: BowlingSimResult["details"] = [];

  for (const slot of priority) {
    const stats = statsByPlayerId.get(slot.playerId);
    if (!stats) continue;

    if (ballsBowled >= ballLimit || wickets >= 10) {
      details.push({
        priority: slot.priority,
        playerId: slot.playerId,
        cappedOvers: 0,
        ballsUsed: 0,
        runsConceded: 0,
        wickets: 0,
      });
      continue;
    }

    const realBalls = oversToBalls(stats.overs);
    if (realBalls === 0) continue;

    const remainingBudget = ballLimit - ballsBowled;
    const cappedBalls = Math.min(realBalls, maxBallsPerBowler, remainingBudget);

    const share = cappedBalls / realBalls;
    const conceded = Math.round(stats.runsConceded * share);
    const wicketsTaken = Math.round(stats.wickets * share);

    total += conceded;
    ballsBowled += cappedBalls;
    wickets = Math.min(10, wickets + wicketsTaken);

    details.push({
      priority: slot.priority,
      playerId: slot.playerId,
      cappedOvers: ballsToOvers(cappedBalls),
      ballsUsed: cappedBalls,
      runsConceded: conceded,
      wickets: wicketsTaken,
    });
  }

  // Phantom-fill: close the short-bowling gap with notional runs at the
  // configured ER. Only applies when the innings didn't end by lethality
  // (10 wickets) — a legitimate bowling-out should still be rewarded.
  let phantomApplied = false;
  let phantomRuns = 0;
  let phantomBalls = 0;
  if (
    applyPhantomFill &&
    ballsBowled < ballLimit &&
    wickets < 10 &&
    config.phantomFillER !== undefined &&
    config.phantomFillER > 0
  ) {
    phantomBalls = ballLimit - ballsBowled;
    const phantomOvers = phantomBalls / BALLS_PER_OVER;
    phantomRuns = Math.round(phantomOvers * config.phantomFillER);
    total += phantomRuns;
    ballsBowled = ballLimit;
    phantomApplied = true;
  }

  return {
    total,
    ballsBowled,
    wickets,
    phantomApplied,
    phantomRuns,
    phantomBalls,
    details,
  };
}

/**
 * Compute NRR using ICC rules.
 *
 * By default both innings divide by the full 20-over allocation (bat_first
 * mode). When `bowl_first` toss is used, the denominators become "actual
 * overs" for whichever side used a rate-based boost:
 *  - Batting: if the chase completed, actual batting overs; otherwise 20
 *    (failed-chase penalty matching ICC's "all out = full allocation" rule).
 *  - Bowling: always actual bowling overs in `bowl_first` (no phantom fill).
 *
 * Getting all out is naturally penalized via a lower run total, not a
 * denominator change — the denominator defaults to 20 in bat_first.
 */
export function computeNrr(
  battingTotal: number,
  bowlingTotal: number,
  battingOvers: number = OVERS_PER_INNINGS,
  bowlingOvers: number = OVERS_PER_INNINGS
): number {
  const batRate = battingOvers > 0 ? battingTotal / battingOvers : 0;
  const bowlRate = bowlingOvers > 0 ? bowlingTotal / bowlingOvers : 0;
  return batRate - bowlRate;
}

/**
 * Full simulation pipeline. Takes a member's entry and the aggregated player
 * stats for the round, returns a settled result with NRR.
 *
 * Toss semantics (updated — see Appendix A in docs/CRICKET_MANAGER_DRAFT.md):
 *
 *  - **bat_first** (safe baseline): batters bat the full 120 balls (or until
 *    10 wickets), bowlers bowl the full 120 balls. If real bowling ends early
 *    without a bowling-out, phantom-fill closes the gap at the round's
 *    average ER so ghost-bowler picks can't harvest NRR. Both denominators
 *    stay at 20 overs.
 *
 *  - **bowl_first** (risk play): bowlers bowl first at their natural pace (no
 *    phantom fill), then batters chase `bowlingTotal + 1`. The NRR denominators
 *    become *actual overs* — fast chases get a real rate boost, short bowling
 *    spells get a proportional punishment. A failed chase falls back to a
 *    20-over batting denominator (ICC's all-out rule), so `bowl_first` is a
 *    genuine risk/reward lever.
 */
export function simulateEntry(
  entry: EntryInput,
  statsByPlayerId: Map<string, AggregatedPlayerStats>,
  config: RoundConfig = { ballLimit: 120, maxOversPerBowler: 4 },
  toss: TossChoice = "bat_first"
): SimulationResult {
  let batting: BattingSimResult;
  let bowling: BowlingSimResult;
  let nrr: number;

  if (toss === "bowl_first") {
    // Risk play: real bowling innings (no phantom fill) then chase.
    // Rate-based denominators reward fast chases and punish short bowling.
    bowling = simulateBowling(entry, statsByPlayerId, config, false);
    batting = simulateBatting(
      entry,
      statsByPlayerId,
      config,
      bowling.total + 1
    );
    const battingOvers = batting.chaseComplete
      ? batting.ballsUsed / BALLS_PER_OVER
      : OVERS_PER_INNINGS; // failed chase → ICC full-allocation penalty
    const bowlingOvers =
      bowling.ballsBowled > 0
        ? bowling.ballsBowled / BALLS_PER_OVER
        : OVERS_PER_INNINGS;
    nrr = computeNrr(batting.total, bowling.total, battingOvers, bowlingOvers);
  } else {
    // Safe baseline: freeroll batting + phantom-filled bowling, 20 / 20
    // denominators as originally specced.
    bowling = simulateBowling(entry, statsByPlayerId, config, true);
    batting = simulateBatting(entry, statsByPlayerId, config);
    nrr = computeNrr(batting.total, bowling.total);
  }

  const battingSr =
    batting.ballsUsed > 0 ? (batting.total / batting.ballsUsed) * 100 : 0;

  return {
    batting,
    bowling,
    nrr: Number(nrr.toFixed(4)),
    battingSr: Number(battingSr.toFixed(4)),
    win: batting.total > bowling.total,
  };
}

/**
 * Build aggregated stats from a flat list of per-player-per-match raw scores.
 * Sums across multiple matches in the round window.
 */
export interface RawMatchScore {
  playerId: string;
  role: PlayerRole;
  runs: number;
  ballsFaced: number;
  // Whether the player was dismissed in this specific match
  isDismissed: boolean;
  overs: number; // decimal overs
  runsConceded: number;
  wickets: number;
}

export function aggregatePlayerStats(
  scores: RawMatchScore[]
): Map<string, AggregatedPlayerStats> {
  const byId = new Map<string, AggregatedPlayerStats>();

  for (const s of scores) {
    const existing = byId.get(s.playerId);
    if (!existing) {
      byId.set(s.playerId, {
        playerId: s.playerId,
        role: s.role,
        runs: s.runs,
        ballsFaced: s.ballsFaced,
        dismissed: s.isDismissed,
        matchesBatted: s.ballsFaced > 0 || s.runs > 0 ? 1 : 0,
        overs: s.overs,
        runsConceded: s.runsConceded,
        wickets: s.wickets,
        matchesBowled: s.overs > 0 ? 1 : 0,
      });
      continue;
    }
    existing.runs += s.runs;
    existing.ballsFaced += s.ballsFaced;
    existing.dismissed = existing.dismissed || s.isDismissed;
    existing.matchesBatted += s.ballsFaced > 0 || s.runs > 0 ? 1 : 0;
    existing.overs = addOvers(existing.overs, s.overs);
    existing.runsConceded += s.runsConceded;
    existing.wickets += s.wickets;
    existing.matchesBowled += s.overs > 0 ? 1 : 0;
  }

  return byId;
}

/**
 * Add two decimal-overs values respecting cricket notation (6 balls = 1 over).
 * Example: 3.4 + 2.3 = 6.1 (not 5.7)
 */
export function addOvers(a: number, b: number): number {
  const totalBalls = oversToBalls(a) + oversToBalls(b);
  return ballsToOvers(totalBalls);
}
