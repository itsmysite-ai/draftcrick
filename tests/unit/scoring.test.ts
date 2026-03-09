/**
 * Unit Tests — Scoring Engine
 *
 * Tests calculateFantasyPoints (shared) and calculateTeamPlayerPoints / calculateTeamTotalPoints (API service).
 * Pure functions — no network, no DB, no emulator needed.
 *
 * Run: npx tsx tests/unit/scoring.test.ts
 */

import { calculateFantasyPoints } from "../../packages/shared/src/utils/fantasy";
import {
  calculateTeamPlayerPoints,
  calculateTeamTotalPoints,
} from "../../packages/api/src/services/scoring";
import type { ScoringRules } from "../../packages/shared/src/types/contest";
import type { PlayerMatchScore } from "../../packages/shared/src/types/match";

// ── Test runner ────────────────────────────────────────────────

interface TestCase { name: string; fn: () => void }
const tests: TestCase[] = [];
function test(name: string, fn: () => void) { tests.push({ name, fn }); }
function assert(cond: boolean, msg: string) { if (!cond) throw new Error(msg); }
function assertEq(a: number, b: number, msg: string) {
  if (Math.abs(a - b) > 0.01) throw new Error(`${msg}: expected ${b}, got ${a}`);
}

// ── Default rules (matches the defaults in calculateFantasyPoints) ────

const defaultRules: ScoringRules = {
  runPoints: 1,
  boundaryBonus: 1,
  sixBonus: 2,
  halfCenturyBonus: 20,
  centuryBonus: 50,
  duckPenalty: -5,
  wicketPoints: 25,
  maidenOverPoints: 15,
  threeWicketBonus: 15,
  fiveWicketBonus: 30,
  catchPoints: 10,
  stumpingPoints: 15,
  runOutDirectPoints: 15,
};

// ── Score factory ──────────────────────────────────────────────

function makeScore(overrides: Partial<Omit<PlayerMatchScore, "id" | "playerId" | "matchId" | "fantasyPoints" | "isPlaying" | "updatedAt">> = {}) {
  return {
    runs: 0,
    ballsFaced: 0,
    fours: 0,
    sixes: 0,
    wickets: 0,
    oversBowled: 0,
    runsConceded: 0,
    maidens: 0,
    catches: 0,
    stumpings: 0,
    runOuts: 0,
    ...overrides,
  };
}

function makeFullScore(overrides: Partial<PlayerMatchScore> = {}): PlayerMatchScore {
  return {
    id: "score-1",
    playerId: "p1",
    matchId: "m1",
    fantasyPoints: 0,
    isPlaying: true,
    updatedAt: new Date(),
    runs: 0,
    ballsFaced: 0,
    fours: 0,
    sixes: 0,
    wickets: 0,
    oversBowled: 0,
    runsConceded: 0,
    maidens: 0,
    catches: 0,
    stumpings: 0,
    runOuts: 0,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════
// BATTING TESTS
// ═══════════════════════════════════════════════════════════════

test("batting: runs scored at 1pt each", () => {
  const pts = calculateFantasyPoints(makeScore({ runs: 45, ballsFaced: 30 }), defaultRules);
  // 45 runs * 1pt = 45
  assertEq(pts, 45, "runs");
});

test("batting: fours bonus (+1 each)", () => {
  const pts = calculateFantasyPoints(makeScore({ runs: 20, ballsFaced: 15, fours: 4 }), defaultRules);
  // 20 runs + 4 fours*1 = 24
  assertEq(pts, 24, "fours bonus");
});

test("batting: sixes bonus (+2 each)", () => {
  const pts = calculateFantasyPoints(makeScore({ runs: 30, ballsFaced: 20, sixes: 3 }), defaultRules);
  // 30 runs + 3 sixes*2 = 36
  assertEq(pts, 36, "sixes bonus");
});

test("batting: half-century bonus (+20)", () => {
  const pts = calculateFantasyPoints(makeScore({ runs: 55, ballsFaced: 40, fours: 5, sixes: 1 }), defaultRules);
  // 55 runs + 5*1 fours + 1*2 six + 20 half-century = 82
  assertEq(pts, 82, "half-century");
});

test("batting: century bonus (+50)", () => {
  const pts = calculateFantasyPoints(makeScore({ runs: 102, ballsFaced: 80, fours: 10, sixes: 3 }), defaultRules);
  // 102 runs + 10*1 fours + 3*2 sixes + 50 century = 168
  assertEq(pts, 168, "century");
});

test("batting: duck penalty (-5)", () => {
  const pts = calculateFantasyPoints(makeScore({ runs: 0, ballsFaced: 5 }), defaultRules);
  // 0 runs + -5 duck = -5
  assertEq(pts, -5, "duck");
});

test("batting: duck not applied when 0 balls faced", () => {
  const pts = calculateFantasyPoints(makeScore({ runs: 0, ballsFaced: 0 }), defaultRules);
  assertEq(pts, 0, "no duck when 0 balls");
});

// ═══════════════════════════════════════════════════════════════
// BOWLING TESTS
// ═══════════════════════════════════════════════════════════════

test("bowling: wickets at 25pt each", () => {
  const pts = calculateFantasyPoints(makeScore({ wickets: 2, oversBowled: 4, runsConceded: 30 }), defaultRules);
  // 2 * 25 = 50
  assertEq(pts, 50, "wickets");
});

test("bowling: 3-wicket bonus (+15)", () => {
  const pts = calculateFantasyPoints(makeScore({ wickets: 3, oversBowled: 4, runsConceded: 25 }), defaultRules);
  // 3*25 + 15 = 90
  assertEq(pts, 90, "3-wicket bonus");
});

test("bowling: 5-wicket bonus (+30, replaces 3-wicket)", () => {
  const pts = calculateFantasyPoints(makeScore({ wickets: 5, oversBowled: 10, runsConceded: 40 }), defaultRules);
  // 5*25 + 30 = 155
  assertEq(pts, 155, "5-wicket bonus");
});

test("bowling: maiden overs at 15pt each", () => {
  const pts = calculateFantasyPoints(makeScore({ maidens: 2, oversBowled: 4, runsConceded: 20 }), defaultRules);
  // 2*15 = 30
  assertEq(pts, 30, "maidens");
});

// ═══════════════════════════════════════════════════════════════
// FIELDING TESTS
// ═══════════════════════════════════════════════════════════════

test("fielding: catches at 10pt each", () => {
  const pts = calculateFantasyPoints(makeScore({ catches: 3 }), defaultRules);
  assertEq(pts, 30, "catches");
});

test("fielding: stumpings at 15pt each", () => {
  const pts = calculateFantasyPoints(makeScore({ stumpings: 1 }), defaultRules);
  assertEq(pts, 15, "stumpings");
});

test("fielding: run outs at 15pt each", () => {
  const pts = calculateFantasyPoints(makeScore({ runOuts: 2 }), defaultRules);
  assertEq(pts, 30, "run outs");
});

// ═══════════════════════════════════════════════════════════════
// CAPTAIN / VICE-CAPTAIN MULTIPLIER TESTS
// ═══════════════════════════════════════════════════════════════

test("captain gets 2x multiplier", () => {
  const score = makeFullScore({ runs: 50, ballsFaced: 35, fours: 5, sixes: 1 });
  // Base: 50 + 5 + 2 + 20 = 77
  const pts = calculateTeamPlayerPoints(score, defaultRules, true, false);
  assertEq(pts, 154, "captain 2x");
});

test("vice-captain gets 1.5x multiplier", () => {
  const score = makeFullScore({ runs: 50, ballsFaced: 35, fours: 5, sixes: 1 });
  const pts = calculateTeamPlayerPoints(score, defaultRules, false, true);
  assertEq(pts, 115.5, "vice-captain 1.5x");
});

// ═══════════════════════════════════════════════════════════════
// TEAM TOTAL TESTS
// ═══════════════════════════════════════════════════════════════

test("team total sums all players correctly", () => {
  const playerScores = new Map<string, PlayerMatchScore>();
  playerScores.set("p1", makeFullScore({ playerId: "p1", runs: 50, ballsFaced: 35, fours: 5, sixes: 1 }));
  playerScores.set("p2", makeFullScore({ playerId: "p2", wickets: 3, oversBowled: 4, runsConceded: 25 }));
  playerScores.set("p3", makeFullScore({ playerId: "p3", runs: 20, ballsFaced: 15, catches: 2 }));

  const teamPlayers = [{ playerId: "p1" }, { playerId: "p2" }, { playerId: "p3" }];
  const total = calculateTeamTotalPoints(playerScores, teamPlayers, "p1", "p2", defaultRules);

  // p1 (captain): (50 + 5 + 2 + 20) * 2 = 154
  // p2 (VC): (75 + 15) * 1.5 = 135
  // p3: 20 + 20 = 40
  // Total: 154 + 135 + 40 = 329
  assertEq(total, 329, "team total");
});

test("custom scoring rules override defaults", () => {
  const customRules: ScoringRules = {
    runPoints: 2,
    boundaryBonus: 2,
    sixBonus: 4,
    halfCenturyBonus: 30,
    wicketPoints: 30,
    catchPoints: 15,
  };
  const pts = calculateFantasyPoints(
    makeScore({ runs: 55, ballsFaced: 40, fours: 5, sixes: 2 }),
    customRules
  );
  // 55*2 + 5*2 + 2*4 + 30 = 110 + 10 + 8 + 30 = 158
  assertEq(pts, 158, "custom rules");
});

// ═══════════════════════════════════════════════════════════════
// RUNNER
// ═══════════════════════════════════════════════════════════════

async function main() {
  console.log("\n=== Unit Tests: Scoring Engine ===\n");
  let passed = 0;
  let failed = 0;

  for (const t of tests) {
    process.stdout.write(`  [RUN] ${t.name} ... `);
    try {
      t.fn();
      console.log("PASS");
      passed++;
    } catch (err: any) {
      console.log(`FAIL: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n  Results: ${passed} passed, ${failed} failed, ${tests.length} total\n`);
  if (failed > 0) process.exit(1);
}

main();
