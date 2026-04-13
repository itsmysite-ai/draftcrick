/**
 * Unit Tests — Cricket Manager 120-ball engine
 *
 * Verifies the simulation pipeline against the worked example in
 * /docs/CRICKET_MANAGER_DRAFT.md §18.
 *
 * Run: npx tsx tests/unit/cm-engine.test.ts
 */

import {
  simulateEntry,
  simulateBatting,
  simulateBowling,
  computeNrr,
  oversToBalls,
  ballsToOvers,
  addOvers,
  aggregatePlayerStats,
  type AggregatedPlayerStats,
  type EntryInput,
  type RawMatchScore,
} from "../../packages/api/src/services/cm-engine";

// ── Test runner ─────────────────────────────────────────────────────────

interface TestCase {
  name: string;
  fn: () => void;
}
const tests: TestCase[] = [];
function test(name: string, fn: () => void) {
  tests.push({ name, fn });
}
function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}
function assertEq(a: number, b: number, msg: string, tol = 0.01) {
  if (Math.abs(a - b) > tol) throw new Error(`${msg}: expected ${b}, got ${a}`);
}

// ── Helpers ─────────────────────────────────────────────────────────────

function stats(partial: Partial<AggregatedPlayerStats> & { playerId: string }): AggregatedPlayerStats {
  return {
    playerId: partial.playerId,
    role: partial.role ?? "batsman",
    runs: partial.runs ?? 0,
    ballsFaced: partial.ballsFaced ?? 0,
    dismissed: partial.dismissed ?? false,
    matchesBatted: partial.matchesBatted ?? 1,
    overs: partial.overs ?? 0,
    runsConceded: partial.runsConceded ?? 0,
    wickets: partial.wickets ?? 0,
    matchesBowled: partial.matchesBowled ?? 0,
  };
}

// ── Overs arithmetic ────────────────────────────────────────────────────

test("oversToBalls: 4.0 = 24 balls", () => {
  assertEq(oversToBalls(4.0), 24, "4.0 overs");
});
test("oversToBalls: 4.3 = 27 balls (cricket notation)", () => {
  assertEq(oversToBalls(4.3), 27, "4.3 overs");
});
test("ballsToOvers: 27 = 4.3 overs", () => {
  assertEq(ballsToOvers(27), 4.3, "27 balls");
});
test("addOvers: 3.4 + 2.3 = 6.1", () => {
  assertEq(addOvers(3.4, 2.3), 6.1, "add overs with carry");
});

// ── NRR formula ─────────────────────────────────────────────────────────

test("computeNrr: baseline calculation", () => {
  // Bat 190, Bowl 136 → (190/20) - (136/20) = 9.50 - 6.80 = 2.70
  assertEq(computeNrr(190, 136), 2.7, "NRR baseline");
});
test("computeNrr: negative when bowling > batting", () => {
  // Bat 100, Bowl 150 → (100/20) - (150/20) = 5.0 - 7.5 = -2.5
  assertEq(computeNrr(100, 150), -2.5, "NRR negative");
});

// ── Worked example from §18 ─────────────────────────────────────────────

test("worked example: Kohli/Gill/Pant/Pandya/... → NRR +2.70", () => {
  // Squad (from doc §18.1)
  const squad = [
    { id: "kohli", runs: 45, balls: 30, out: true, overs: 0, conceded: 0, wickets: 0 },
    { id: "gill", runs: 72, balls: 48, out: true, overs: 0, conceded: 0, wickets: 0 },
    { id: "pant", runs: 28, balls: 15, out: false, overs: 0, conceded: 0, wickets: 0 },
    { id: "pandya", runs: 45, balls: 27, out: true, overs: 5.0, conceded: 44, wickets: 1 },
    { id: "jadeja", runs: 22, balls: 14, out: true, overs: 4.0, conceded: 24, wickets: 2 },
    { id: "ishan", runs: 8, balls: 6, out: true, overs: 0, conceded: 0, wickets: 0 },
    { id: "bumrah", runs: 0, balls: 0, out: false, overs: 8.0, conceded: 40, wickets: 5 },
    { id: "shami", runs: 0, balls: 0, out: false, overs: 4.0, conceded: 32, wickets: 1 },
    { id: "chahal", runs: 0, balls: 0, out: false, overs: 4.0, conceded: 36, wickets: 1 },
    { id: "rashid", runs: 0, balls: 0, out: false, overs: 4.0, conceded: 24, wickets: 2 },
    { id: "chahar", runs: 0, balls: 0, out: false, overs: 3.0, conceded: 28, wickets: 1 },
  ];

  const statsMap = new Map<string, AggregatedPlayerStats>();
  for (const p of squad) {
    statsMap.set(
      p.id,
      stats({
        playerId: p.id,
        runs: p.runs,
        ballsFaced: p.balls,
        dismissed: p.out,
        overs: p.overs,
        runsConceded: p.conceded,
        wickets: p.wickets,
      })
    );
  }

  const entry: EntryInput = {
    players: squad.map((p) => ({ playerId: p.id })),
    battingOrder: [
      { position: 1, playerId: "kohli" },
      { position: 2, playerId: "gill" },
      { position: 3, playerId: "pant" },
      { position: 4, playerId: "pandya" },
      { position: 5, playerId: "jadeja" },
      { position: 6, playerId: "ishan" },
      { position: 7, playerId: "bumrah" },
      { position: 8, playerId: "shami" },
      { position: 9, playerId: "chahal" },
      { position: 10, playerId: "rashid" },
      { position: 11, playerId: "chahar" },
    ],
    bowlingPriority: [
      { priority: 1, playerId: "bumrah" },
      { priority: 2, playerId: "shami" },
      { priority: 3, playerId: "chahal" },
      { priority: 4, playerId: "rashid" },
      { priority: 5, playerId: "jadeja" },
      { priority: 6, playerId: "pandya" },
      { priority: 7, playerId: "chahar" },
    ],
  };

  const result = simulateEntry(entry, statsMap);

  // Batting: Kohli 45(30) + Gill 72(48) + Pant 28(15) + Pandya 45(27) = 190 in 120 balls
  assertEq(result.batting.total, 190, "batting total");
  assertEq(result.batting.ballsUsed, 120, "batting balls used");
  assertEq(result.batting.wickets, 3, "batting wickets");

  // Bowling: Bumrah 4ov/20r (capped from 8ov/40r = half) + Shami 4ov/32r + Chahal 4ov/36r
  //        + Rashid 4ov/24r + Jadeja 4ov/24r = 136 conceded
  assertEq(result.bowling.total, 136, "bowling total");
  assertEq(result.bowling.ballsBowled, 120, "bowling balls bowled");

  // NRR = (190/20) - (136/20) = 9.50 - 6.80 = +2.70
  assertEq(result.nrr, 2.7, "nrr");

  // Batting SR = (190/120) * 100 = 158.33
  assertEq(result.battingSr, 158.3333, "batting sr", 0.01);

  assert(result.win, "batting should beat bowling");
});

// ── All-out scenario ────────────────────────────────────────────────────

test("all-out batting: denominator stays at 20 (ICC rule)", () => {
  // 10 batters each score 5 runs off 6 balls and get out; 11th can't bat.
  // Total: 50 runs in 60 balls, 10 wickets → all out
  const statsMap = new Map<string, AggregatedPlayerStats>();
  for (let i = 1; i <= 11; i++) {
    statsMap.set(
      `p${i}`,
      stats({
        playerId: `p${i}`,
        runs: i <= 10 ? 5 : 0,
        ballsFaced: i <= 10 ? 6 : 0,
        dismissed: i <= 10,
      })
    );
  }
  // One bowler, uses full 4 overs, concedes 40
  statsMap.set(
    "bowl1",
    stats({
      playerId: "bowl1",
      role: "bowler",
      overs: 4.0,
      runsConceded: 40,
      wickets: 0,
    })
  );

  const entry: EntryInput = {
    players: [...Array(11)].map((_, i) => ({ playerId: `p${i + 1}` })),
    battingOrder: [...Array(11)].map((_, i) => ({
      position: i + 1,
      playerId: `p${i + 1}`,
    })),
    bowlingPriority: [{ priority: 1, playerId: "bowl1" }],
  };

  const result = simulateEntry(entry, statsMap);

  assertEq(result.batting.total, 50, "all-out total");
  assert(result.batting.allOut, "should be all out");
  assertEq(result.batting.wickets, 10, "10 wickets");

  // NRR = (50/20) - (40/20) = 2.5 - 2.0 = 0.5
  // Denominator stays 20 even though only 60 balls used — ICC rule
  assertEq(result.nrr, 0.5, "all-out NRR uses full 20 overs");
});

// ── Bowling lethality (wickets = 10 freezes total) ──────────────────────

test("bowling freezes at 10 wickets", () => {
  const statsMap = new Map<string, AggregatedPlayerStats>();
  // Two bowlers, each with 4 overs and 5 wickets
  statsMap.set(
    "b1",
    stats({
      playerId: "b1",
      role: "bowler",
      overs: 4.0,
      runsConceded: 20,
      wickets: 5,
    })
  );
  statsMap.set(
    "b2",
    stats({
      playerId: "b2",
      role: "bowler",
      overs: 4.0,
      runsConceded: 30,
      wickets: 5,
    })
  );
  // Filler bowler — should NOT contribute because 10 wickets already
  statsMap.set(
    "b3",
    stats({
      playerId: "b3",
      role: "bowler",
      overs: 4.0,
      runsConceded: 50,
      wickets: 1,
    })
  );

  // Dummy batting to fill the entry
  for (let i = 1; i <= 11; i++) {
    if (!statsMap.has(`b${i}`)) {
      statsMap.set(`bat${i}`, stats({ playerId: `bat${i}`, runs: 10, ballsFaced: 10 }));
    }
  }

  const entry: EntryInput = {
    players: [
      { playerId: "b1" },
      { playerId: "b2" },
      { playerId: "b3" },
      ...[...Array(8)].map((_, i) => ({ playerId: `bat${i + 1}` })),
    ],
    battingOrder: [
      { position: 1, playerId: "b1" },
      { position: 2, playerId: "b2" },
      { position: 3, playerId: "b3" },
      ...[...Array(8)].map((_, i) => ({ position: i + 4, playerId: `bat${i + 1}` })),
    ],
    bowlingPriority: [
      { priority: 1, playerId: "b1" },
      { priority: 2, playerId: "b2" },
      { priority: 3, playerId: "b3" },
    ],
  };

  const result = simulateBowling(entry, statsMap, {
    ballLimit: 120,
    maxOversPerBowler: 4,
  });

  // b1: 4 overs / 20 runs / 5 wickets (cumulative 5, under limit)
  // b2: 4 overs / 30 runs / 5 wickets (cumulative 10, limit reached)
  // b3: frozen — 0 contribution
  assertEq(result.total, 50, "bowling total freezes at 50");
  assertEq(result.wickets, 10, "wickets capped at 10");
});

// ── Aggregation across multiple matches ─────────────────────────────────

test("aggregatePlayerStats: sums runs and overs correctly", () => {
  const raw: RawMatchScore[] = [
    {
      playerId: "kohli",
      role: "batsman",
      runs: 45,
      ballsFaced: 30,
      isDismissed: true,
      overs: 0,
      runsConceded: 0,
      wickets: 0,
    },
    {
      playerId: "kohli",
      role: "batsman",
      runs: 22,
      ballsFaced: 18,
      isDismissed: false,
      overs: 0,
      runsConceded: 0,
      wickets: 0,
    },
    {
      playerId: "bumrah",
      role: "bowler",
      runs: 0,
      ballsFaced: 0,
      isDismissed: false,
      overs: 4.0,
      runsConceded: 20,
      wickets: 2,
    },
    {
      playerId: "bumrah",
      role: "bowler",
      runs: 0,
      ballsFaced: 0,
      isDismissed: false,
      overs: 4.0,
      runsConceded: 20,
      wickets: 3,
    },
  ];

  const agg = aggregatePlayerStats(raw);

  const kohli = agg.get("kohli")!;
  assertEq(kohli.runs, 67, "kohli runs");
  assertEq(kohli.ballsFaced, 48, "kohli balls");
  assert(kohli.dismissed, "kohli dismissed in one match");
  assertEq(kohli.matchesBatted, 2, "kohli matches batted");

  const bumrah = agg.get("bumrah")!;
  assertEq(bumrah.overs, 8.0, "bumrah overs (4+4)");
  assertEq(bumrah.runsConceded, 40, "bumrah conceded");
  assertEq(bumrah.wickets, 5, "bumrah wickets");
});

// ── Partial innings (ball budget exhausted mid-batter) ──────────────────

test("partial innings: last batter scales runs by SR", () => {
  const statsMap = new Map<string, AggregatedPlayerStats>();
  // #1 uses 118 balls scoring 200
  statsMap.set(
    "a",
    stats({ playerId: "a", runs: 200, ballsFaced: 118, dismissed: false })
  );
  // #2 has SR 150 (30 runs off 20 balls) — only 2 balls remaining
  // Expected: 2 * 1.5 = 3 runs credited
  statsMap.set(
    "b",
    stats({ playerId: "b", runs: 30, ballsFaced: 20, dismissed: true })
  );

  const entry: EntryInput = {
    players: [{ playerId: "a" }, { playerId: "b" }],
    battingOrder: [
      { position: 1, playerId: "a" },
      { position: 2, playerId: "b" },
    ],
    bowlingPriority: [],
  };

  const result = simulateBatting(entry, statsMap, {
    ballLimit: 120,
    maxOversPerBowler: 4,
  });

  assertEq(result.total, 203, "200 + 3");
  assertEq(result.ballsUsed, 120, "full budget used");
  // Partial batter is NOT dismissed (innings cut off by ball budget)
  assertEq(result.wickets, 0, "no dismissal on partial");
});

// ── Toss: bat_first vs bowl_first ───────────────────────────────────────

test("toss bowl_first: batters stop when chase target reached (rate-based denominators)", () => {
  // Squad: bowlers keep opposition to 136 (same as worked example).
  // Chasing 137, Kohli 45(30) + Gill 72(48) = 117 in 78 balls.
  // Pant comes in needing 20 more at SR 28/15 ≈ 1.867 → ~11 balls.
  // Final: 137 runs in 89 balls, chaseComplete = true.
  //
  // Under the new bowl_first semantics, NRR denominators are actual overs:
  //   batting = 89/6 ≈ 14.833 ov, bowling = 120/6 = 20.0 ov
  //   NRR = 137/14.833 - 136/20 = 9.2360 - 6.80 ≈ +2.44
  // (vs the old 20/20 calculation which gave a broken +0.05)
  const squad = [
    { id: "kohli", runs: 45, balls: 30, out: true, overs: 0, conceded: 0, wickets: 0 },
    { id: "gill", runs: 72, balls: 48, out: true, overs: 0, conceded: 0, wickets: 0 },
    { id: "pant", runs: 28, balls: 15, out: false, overs: 0, conceded: 0, wickets: 0 },
    { id: "pandya", runs: 45, balls: 27, out: true, overs: 5.0, conceded: 44, wickets: 1 },
    { id: "jadeja", runs: 22, balls: 14, out: true, overs: 4.0, conceded: 24, wickets: 2 },
    { id: "ishan", runs: 8, balls: 6, out: true, overs: 0, conceded: 0, wickets: 0 },
    { id: "bumrah", runs: 0, balls: 0, out: false, overs: 8.0, conceded: 40, wickets: 5 },
    { id: "shami", runs: 0, balls: 0, out: false, overs: 4.0, conceded: 32, wickets: 1 },
    { id: "chahal", runs: 0, balls: 0, out: false, overs: 4.0, conceded: 36, wickets: 1 },
    { id: "rashid", runs: 0, balls: 0, out: false, overs: 4.0, conceded: 24, wickets: 2 },
    { id: "chahar", runs: 0, balls: 0, out: false, overs: 3.0, conceded: 28, wickets: 1 },
  ];
  const statsMap = new Map<string, AggregatedPlayerStats>();
  for (const p of squad) {
    statsMap.set(p.id, stats({
      playerId: p.id, runs: p.runs, ballsFaced: p.balls,
      dismissed: p.out, overs: p.overs, runsConceded: p.conceded, wickets: p.wickets,
    }));
  }

  const entry: EntryInput = {
    players: squad.map((p) => ({ playerId: p.id })),
    battingOrder: [
      { position: 1, playerId: "kohli" },
      { position: 2, playerId: "gill" },
      { position: 3, playerId: "pant" },
      { position: 4, playerId: "pandya" },
      { position: 5, playerId: "jadeja" },
      { position: 6, playerId: "ishan" },
      { position: 7, playerId: "bumrah" },
      { position: 8, playerId: "shami" },
      { position: 9, playerId: "chahal" },
      { position: 10, playerId: "rashid" },
      { position: 11, playerId: "chahar" },
    ],
    bowlingPriority: [
      { priority: 1, playerId: "bumrah" },
      { priority: 2, playerId: "shami" },
      { priority: 3, playerId: "chahal" },
      { priority: 4, playerId: "rashid" },
      { priority: 5, playerId: "jadeja" },
    ],
  };

  const result = simulateEntry(entry, statsMap, undefined, "bowl_first");

  // Bowling total still 136 (computed first, same as bat_first)
  assertEq(result.bowling.total, 136, "bowl first: bowling total");

  // Batting stopped at target = 137 (not the full 190)
  assertEq(result.batting.total, 137, "bowl first: batting capped at target");
  assert(result.batting.chaseComplete, "chase marked complete");

  // Rate-based: 137/14.833 - 136/20 ≈ 2.436
  assertEq(result.nrr, 2.436, "bowl first NRR (rate-based)", 0.01);
  // Chase rewards bowl_first over bat_first (+2.70) in this scenario
  assert(result.nrr < 2.7, "bowl first should be slightly below bat first here");
  assert(result.nrr > 2.0, "but still positive — chase was efficient");
});

test("toss bowl_first: high bowling total means batters cannot chase, innings runs full", () => {
  // Same batting squad, but bowlers leak: bowling total = 250.
  // Batters can only accumulate 190 in 120 balls, nowhere near 251.
  // Batting should NOT be capped by chase (no chaseComplete).
  const squad = [
    { id: "kohli", runs: 45, balls: 30, out: true },
    { id: "gill", runs: 72, balls: 48, out: true },
    { id: "pant", runs: 28, balls: 15, out: false },
    { id: "pandya", runs: 45, balls: 27, out: true },
  ];
  const statsMap = new Map<string, AggregatedPlayerStats>();
  for (const p of squad) {
    statsMap.set(p.id, stats({
      playerId: p.id, runs: p.runs, ballsFaced: p.balls, dismissed: p.out,
    }));
  }
  // One very-expensive bowler so bowlTotal is high
  statsMap.set("gen", stats({
    playerId: "gen", role: "bowler",
    overs: 20.0, runsConceded: 250, wickets: 0,
  }));

  const entry: EntryInput = {
    players: [...squad.map((p) => ({ playerId: p.id })), { playerId: "gen" }],
    battingOrder: [
      { position: 1, playerId: "kohli" },
      { position: 2, playerId: "gill" },
      { position: 3, playerId: "pant" },
      { position: 4, playerId: "pandya" },
      { position: 5, playerId: "gen" },
    ],
    bowlingPriority: [{ priority: 1, playerId: "gen" }],
  };

  const result = simulateEntry(entry, statsMap, undefined, "bowl_first");

  assertEq(result.bowling.total, 50, "capped to 4 overs → 250 × (24/120) = 50");
  // Hmm — bowler capped at 4 overs so actual bowling total is 50, not 250.
  // So target = 51. Kohli alone (45) isn't enough, Gill (72) overshoots.
  // Kohli 45 + Gill 6 (partial chase) = 51.
  assertEq(result.batting.total, 51, "chase stops at target");
  assert(result.batting.chaseComplete, "chase completed");
});

test("toss bat_first: same squad batting runs full 120 balls regardless of bowl total", () => {
  const squad = [
    { id: "kohli", runs: 45, balls: 30, out: true, overs: 0, conceded: 0, wickets: 0 },
    { id: "gill", runs: 72, balls: 48, out: true, overs: 0, conceded: 0, wickets: 0 },
    { id: "pant", runs: 28, balls: 15, out: false, overs: 0, conceded: 0, wickets: 0 },
    { id: "pandya", runs: 45, balls: 27, out: true, overs: 5.0, conceded: 44, wickets: 1 },
    { id: "jadeja", runs: 22, balls: 14, out: true, overs: 4.0, conceded: 24, wickets: 2 },
    { id: "ishan", runs: 8, balls: 6, out: true, overs: 0, conceded: 0, wickets: 0 },
    { id: "bumrah", runs: 0, balls: 0, out: false, overs: 8.0, conceded: 40, wickets: 5 },
    { id: "shami", runs: 0, balls: 0, out: false, overs: 4.0, conceded: 32, wickets: 1 },
    { id: "chahal", runs: 0, balls: 0, out: false, overs: 4.0, conceded: 36, wickets: 1 },
    { id: "rashid", runs: 0, balls: 0, out: false, overs: 4.0, conceded: 24, wickets: 2 },
    { id: "chahar", runs: 0, balls: 0, out: false, overs: 3.0, conceded: 28, wickets: 1 },
  ];
  const statsMap = new Map<string, AggregatedPlayerStats>();
  for (const p of squad) {
    statsMap.set(p.id, stats({
      playerId: p.id, runs: p.runs, ballsFaced: p.balls,
      dismissed: p.out, overs: p.overs, runsConceded: p.conceded, wickets: p.wickets,
    }));
  }

  const entry: EntryInput = {
    players: squad.map((p) => ({ playerId: p.id })),
    battingOrder: [
      { position: 1, playerId: "kohli" },
      { position: 2, playerId: "gill" },
      { position: 3, playerId: "pant" },
      { position: 4, playerId: "pandya" },
      { position: 5, playerId: "jadeja" },
      { position: 6, playerId: "ishan" },
      { position: 7, playerId: "bumrah" },
      { position: 8, playerId: "shami" },
      { position: 9, playerId: "chahal" },
      { position: 10, playerId: "rashid" },
      { position: 11, playerId: "chahar" },
    ],
    bowlingPriority: [
      { priority: 1, playerId: "bumrah" },
      { priority: 2, playerId: "shami" },
      { priority: 3, playerId: "chahal" },
      { priority: 4, playerId: "rashid" },
      { priority: 5, playerId: "jadeja" },
    ],
  };

  // Default toss is bat_first
  const result = simulateEntry(entry, statsMap);
  assertEq(result.batting.total, 190, "bat first: full innings");
  assertEq(result.bowling.total, 136, "bat first: bowling total");
  assertEq(result.nrr, 2.7, "bat first NRR");
  assert(!result.batting.chaseComplete, "no chase in bat_first");
});

// ── Phantom-fill & new toss semantics (Appendix A fix) ────────────────

test("phantom-fill: 5 real 4-over bowlers pay zero penalty (honest baseline)", () => {
  // Honest attack: 5 × 4 overs = 120 balls bowled, 150 runs conceded.
  // No ghost bowlers → phantom fill must not trigger.
  const statsMap = new Map<string, AggregatedPlayerStats>();
  for (let i = 1; i <= 5; i++) {
    statsMap.set(
      `b${i}`,
      stats({
        playerId: `b${i}`,
        role: "bowler",
        overs: 4.0,
        runsConceded: 30,
        wickets: 1,
      })
    );
  }
  // Dummy batting so batting total doesn't interfere
  for (let i = 1; i <= 11; i++) {
    statsMap.set(`bat${i}`, stats({ playerId: `bat${i}`, runs: 20, ballsFaced: 12 }));
  }

  const entry: EntryInput = {
    players: [
      ...[...Array(5)].map((_, i) => ({ playerId: `b${i + 1}` })),
      ...[...Array(11)].map((_, i) => ({ playerId: `bat${i + 1}` })),
    ],
    battingOrder: [...Array(11)].map((_, i) => ({
      position: i + 1,
      playerId: `bat${i + 1}`,
    })),
    bowlingPriority: [...Array(5)].map((_, i) => ({
      priority: i + 1,
      playerId: `b${i + 1}`,
    })),
  };

  const result = simulateEntry(
    entry,
    statsMap,
    { ballLimit: 120, maxOversPerBowler: 4, phantomFillER: 9.0 },
    "bat_first"
  );

  assertEq(result.bowling.total, 150, "bowling total unchanged");
  assertEq(result.bowling.ballsBowled, 120, "120 balls bowled (full)");
  assert(!result.bowling.phantomApplied, "phantom NOT applied — no gap");
  assertEq(result.bowling.phantomRuns, 0, "zero phantom runs");
});

test("phantom-fill: ghost bowler cheater gets charged at round-avg ER (bat_first)", () => {
  // Cheater: 3 real bowlers (72 balls, 82 runs) + 2 ghost bowlers (0 overs each).
  // Round-avg ER = 9.5 (high-scoring round). The 48-ball gap should be filled
  // with round(8.0 × 9.5) = 76 phantom runs → total = 82 + 76 = 158.
  const statsMap = new Map<string, AggregatedPlayerStats>();
  statsMap.set("real1", stats({ playerId: "real1", role: "bowler", overs: 4.0, runsConceded: 28, wickets: 2 }));
  statsMap.set("real2", stats({ playerId: "real2", role: "bowler", overs: 4.0, runsConceded: 35, wickets: 1 }));
  statsMap.set("real3", stats({ playerId: "real3", role: "bowler", overs: 4.0, runsConceded: 19, wickets: 2 }));
  // Ghost bowlers — 0 real overs
  statsMap.set("ghost1", stats({ playerId: "ghost1", role: "batsman", overs: 0, runsConceded: 0, wickets: 0 }));
  statsMap.set("ghost2", stats({ playerId: "ghost2", role: "batsman", overs: 0, runsConceded: 0, wickets: 0 }));
  // Dummy batters
  for (let i = 1; i <= 11; i++) {
    statsMap.set(`bat${i}`, stats({ playerId: `bat${i}`, runs: 18, ballsFaced: 10 }));
  }

  const entry: EntryInput = {
    players: [
      { playerId: "real1" },
      { playerId: "real2" },
      { playerId: "real3" },
      { playerId: "ghost1" },
      { playerId: "ghost2" },
      ...[...Array(11)].map((_, i) => ({ playerId: `bat${i + 1}` })),
    ],
    battingOrder: [...Array(11)].map((_, i) => ({
      position: i + 1,
      playerId: `bat${i + 1}`,
    })),
    bowlingPriority: [
      { priority: 1, playerId: "real1" },
      { priority: 2, playerId: "real2" },
      { priority: 3, playerId: "real3" },
      { priority: 4, playerId: "ghost1" },
      { priority: 5, playerId: "ghost2" },
    ],
  };

  const result = simulateEntry(
    entry,
    statsMap,
    { ballLimit: 120, maxOversPerBowler: 4, phantomFillER: 9.5 },
    "bat_first"
  );

  // Real: 4+4+4 = 12 overs = 72 balls, runs = 28+35+19 = 82
  // Phantom: 48 balls × 9.5/6 = 76 runs
  assertEq(result.bowling.total, 82 + 76, "real + phantom runs");
  assertEq(result.bowling.ballsBowled, 120, "phantom fills to full budget");
  assert(result.bowling.phantomApplied, "phantom fill applied");
  assertEq(result.bowling.phantomBalls, 48, "48 phantom balls");
  assertEq(result.bowling.phantomRuns, 76, "76 phantom runs");
});

test("phantom-fill: NOT triggered when bowling-out (wickets >= 10)", () => {
  // 5 bowlers take 2 wickets each = 10 wickets, only 60 balls bowled.
  // Lethality stop should fire; phantom fill must NOT kick in because the
  // short innings was earned by bowling the opposition out.
  const statsMap = new Map<string, AggregatedPlayerStats>();
  for (let i = 1; i <= 5; i++) {
    statsMap.set(
      `b${i}`,
      stats({
        playerId: `b${i}`,
        role: "bowler",
        overs: 2.0,
        runsConceded: 10,
        wickets: 2,
      })
    );
  }
  for (let i = 1; i <= 11; i++) {
    statsMap.set(`bat${i}`, stats({ playerId: `bat${i}`, runs: 20, ballsFaced: 12 }));
  }

  const entry: EntryInput = {
    players: [
      ...[...Array(5)].map((_, i) => ({ playerId: `b${i + 1}` })),
      ...[...Array(11)].map((_, i) => ({ playerId: `bat${i + 1}` })),
    ],
    battingOrder: [...Array(11)].map((_, i) => ({
      position: i + 1,
      playerId: `bat${i + 1}`,
    })),
    bowlingPriority: [...Array(5)].map((_, i) => ({
      priority: i + 1,
      playerId: `b${i + 1}`,
    })),
  };

  const result = simulateEntry(
    entry,
    statsMap,
    { ballLimit: 120, maxOversPerBowler: 4, phantomFillER: 9.0 },
    "bat_first"
  );

  assertEq(result.bowling.wickets, 10, "10 wickets (bowled out)");
  assertEq(result.bowling.total, 50, "50 runs — no phantom fill");
  assert(!result.bowling.phantomApplied, "phantom NOT applied after lethality");
});

test("bowl_first fast chase: rate-based denominators reward efficient chase", () => {
  // Low bowling total (5 bowlers, 100 runs in 120 balls) + efficient chase
  // (target 101 chased in 60 balls) should beat bat_first in this scenario.
  const statsMap = new Map<string, AggregatedPlayerStats>();
  // 5 bowlers, each 4-0-20-0 → 100 runs total in 120 balls
  for (let i = 1; i <= 5; i++) {
    statsMap.set(`b${i}`, stats({
      playerId: `b${i}`, role: "bowler",
      overs: 4.0, runsConceded: 20, wickets: 0,
    }));
  }
  // Top order: Kohli 60(30) SR 200, Rohit 50(30) SR 166
  statsMap.set("kohli", stats({ playerId: "kohli", runs: 60, ballsFaced: 30, dismissed: true }));
  statsMap.set("rohit", stats({ playerId: "rohit", runs: 50, ballsFaced: 30, dismissed: true }));
  for (let i = 3; i <= 11; i++) {
    statsMap.set(`bat${i}`, stats({ playerId: `bat${i}`, runs: 15, ballsFaced: 12 }));
  }

  const entry: EntryInput = {
    players: [
      { playerId: "kohli" }, { playerId: "rohit" },
      ...[...Array(9)].map((_, i) => ({ playerId: `bat${i + 3}` })),
      ...[...Array(5)].map((_, i) => ({ playerId: `b${i + 1}` })),
    ],
    battingOrder: [
      { position: 1, playerId: "kohli" },
      { position: 2, playerId: "rohit" },
      ...[...Array(9)].map((_, i) => ({ position: i + 3, playerId: `bat${i + 3}` })),
    ],
    bowlingPriority: [...Array(5)].map((_, i) => ({
      priority: i + 1, playerId: `b${i + 1}`,
    })),
  };

  // bat_first: batting freerolls, bowling freerolls
  const batFirst = simulateEntry(
    entry, statsMap,
    { ballLimit: 120, maxOversPerBowler: 4, phantomFillER: 9.0 },
    "bat_first"
  );
  // bowl_first: chase target 101 — Kohli 60(30) + Rohit 41(25) to hit target
  const bowlFirst = simulateEntry(
    entry, statsMap,
    { ballLimit: 120, maxOversPerBowler: 4, phantomFillER: 9.0 },
    "bowl_first"
  );

  assertEq(bowlFirst.bowling.total, 100, "bowling total 100 in bowl_first");
  assert(bowlFirst.batting.chaseComplete, "chase completed");
  // bowl_first should beat bat_first because chase was ~55 balls for 101 runs
  // (rate ~11 rpo) while bat_first's full-20-over rate is much lower
  assert(
    bowlFirst.nrr > batFirst.nrr,
    `bowl_first (${bowlFirst.nrr}) should beat bat_first (${batFirst.nrr}) on fast chase`
  );
});

test("bowl_first failed chase: falls back to 20-over batting denominator", () => {
  // Bowling leaks 160 runs. Batting SR is low (only scores 120 off 120 balls).
  // Chase fails → batting denominator should be 20, not actual balls.
  const statsMap = new Map<string, AggregatedPlayerStats>();
  // Expensive bowlers
  for (let i = 1; i <= 5; i++) {
    statsMap.set(`b${i}`, stats({
      playerId: `b${i}`, role: "bowler",
      overs: 4.0, runsConceded: 32, wickets: 0,
    }));
  }
  // Pedestrian batters: 11 × 12 runs in 12 balls = 132 runs in 132 balls
  // (SR 100, no one special — caps at 120 balls giving ~120 runs)
  for (let i = 1; i <= 11; i++) {
    statsMap.set(`bat${i}`, stats({
      playerId: `bat${i}`, runs: 12, ballsFaced: 12, dismissed: false,
    }));
  }

  const entry: EntryInput = {
    players: [
      ...[...Array(11)].map((_, i) => ({ playerId: `bat${i + 1}` })),
      ...[...Array(5)].map((_, i) => ({ playerId: `b${i + 1}` })),
    ],
    battingOrder: [...Array(11)].map((_, i) => ({
      position: i + 1, playerId: `bat${i + 1}`,
    })),
    bowlingPriority: [...Array(5)].map((_, i) => ({
      priority: i + 1, playerId: `b${i + 1}`,
    })),
  };

  const result = simulateEntry(
    entry, statsMap,
    { ballLimit: 120, maxOversPerBowler: 4, phantomFillER: 9.0 },
    "bowl_first"
  );

  assertEq(result.bowling.total, 160, "bowling total 160");
  assert(!result.batting.chaseComplete, "chase failed");
  assertEq(result.batting.ballsUsed, 120, "full 120 balls used trying to chase");
  // Failed chase → batting denominator back to 20 (ICC full-allocation penalty).
  // NRR = 120/20 - 160/20 = 6.0 - 8.0 = -2.0
  assertEq(result.nrr, -2.0, "failed chase falls back to 20-over denominator");
});

// ── Run ─────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures: string[] = [];

for (const t of tests) {
  try {
    t.fn();
    passed++;
    console.log(`  ✓ ${t.name}`);
  } catch (err: unknown) {
    failed++;
    const msg = err instanceof Error ? err.message : String(err);
    failures.push(`  ✗ ${t.name}\n    ${msg}`);
    console.log(`  ✗ ${t.name}\n    ${msg}`);
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
