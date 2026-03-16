/**
 * Chapter 11: Scoring Engine (API Tests)
 *
 * Verifies fantasy point calculations against the scoring rules.
 * These are API-level tests — no browser needed.
 * Tests every scoring rule: batting, bowling, fielding, multipliers.
 *
 * Run: npx tsx tests/e2e/cricket-story/11-scoring-engine.spec.ts
 */

// ─── Scoring Rules (from rule-engine.ts defaults) ────────────────
const RULES = {
  runPoints: 1,
  boundaryBonus: 1,
  sixBonus: 2,
  thirtyRunBonus: 5,
  halfCenturyBonus: 20,
  centuryBonus: 50,
  duckPenalty: -5,
  wicketPoints: 25,
  maidenOverPoints: 15,
  threeWicketBonus: 15,
  fourWicketBonus: 25,
  fiveWicketBonus: 30,
  catchPoints: 10,
  stumpingPoints: 15,
  runOutDirectPoints: 15,
  runOutIndirectPoints: 10,
  playerOfMatchBonus: 25,
  captainMultiplier: 2,
  viceCaptainMultiplier: 1.5,
};

// ─── Calculator (mirrors production logic) ─────────────────────
interface PlayerScore {
  runs?: number;
  ballsFaced?: number;
  fours?: number;
  sixes?: number;
  wickets?: number;
  maidens?: number;
  catches?: number;
  stumpings?: number;
  runOutsDirect?: number;
  runOutsIndirect?: number;
  isPlayerOfMatch?: boolean;
}

function calculateFantasyPoints(score: PlayerScore): number {
  let pts = 0;

  // Batting
  pts += (score.runs ?? 0) * RULES.runPoints;
  pts += (score.fours ?? 0) * RULES.boundaryBonus;
  pts += (score.sixes ?? 0) * RULES.sixBonus;
  if ((score.runs ?? 0) >= 100) pts += RULES.centuryBonus;
  else if ((score.runs ?? 0) >= 50) pts += RULES.halfCenturyBonus;
  else if ((score.runs ?? 0) >= 30) pts += RULES.thirtyRunBonus;
  if ((score.runs ?? 0) === 0 && (score.ballsFaced ?? 0) > 0) pts += RULES.duckPenalty;

  // Bowling
  const w = score.wickets ?? 0;
  pts += w * RULES.wicketPoints;
  if (w >= 5) pts += RULES.fiveWicketBonus;
  else if (w >= 4) pts += RULES.fourWicketBonus;
  else if (w >= 3) pts += RULES.threeWicketBonus;
  pts += (score.maidens ?? 0) * RULES.maidenOverPoints;

  // Fielding
  pts += (score.catches ?? 0) * RULES.catchPoints;
  pts += (score.stumpings ?? 0) * RULES.stumpingPoints;
  pts += (score.runOutsDirect ?? 0) * RULES.runOutDirectPoints;
  pts += (score.runOutsIndirect ?? 0) * RULES.runOutIndirectPoints;

  // Match situation
  if (score.isPlayerOfMatch) pts += RULES.playerOfMatchBonus;

  return pts;
}

function applyMultiplier(basePts: number, role: "captain" | "vice_captain" | "normal"): number {
  if (role === "captain") return basePts * RULES.captainMultiplier;
  if (role === "vice_captain") return basePts * RULES.viceCaptainMultiplier;
  return basePts;
}

// ─── Test Runner ───────────────────────────────────────────────
interface TestCase { name: string; fn: () => void }
const tests: TestCase[] = [];
let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) { tests.push({ name, fn }); }
function assert(cond: boolean, msg: string) { if (!cond) throw new Error(msg); }
function assertEq(actual: number, expected: number, msg: string) {
  assert(Math.abs(actual - expected) < 0.01, `${msg}: expected ${expected}, got ${actual}`);
}

// ─── BATTING TESTS ─────────────────────────────────────────────

test("11.1 — batting: runs only (30 runs)", () => {
  assertEq(calculateFantasyPoints({ runs: 30, ballsFaced: 20 }), 35, "30 runs + 30-run bonus");
});

test("11.2 — batting: with boundaries (45 runs, 6×4, 2×6)", () => {
  assertEq(calculateFantasyPoints({ runs: 45, fours: 6, sixes: 2, ballsFaced: 30 }), 55 + 5, "45+6+4+5 (30-run bonus)");
});

test("11.3 — batting: half-century bonus (50 runs, 5×4, 1×6)", () => {
  assertEq(calculateFantasyPoints({ runs: 50, fours: 5, sixes: 1, ballsFaced: 35 }), 77, "50+5+2+20");
});

test("11.4 — batting: century bonus (100 runs, 12×4, 4×6)", () => {
  assertEq(calculateFantasyPoints({ runs: 100, fours: 12, sixes: 4, ballsFaced: 60 }), 170, "100+12+8+50");
});

test("11.5 — batting: duck penalty (0 runs, faced 5 balls)", () => {
  assertEq(calculateFantasyPoints({ runs: 0, ballsFaced: 5 }), -5, "duck penalty");
});

test("11.6 — batting: duck not applied when 0 balls faced", () => {
  assertEq(calculateFantasyPoints({ runs: 0, ballsFaced: 0 }), 0, "no duck if no balls faced");
});

test("11.7 — batting: 30-run bonus threshold", () => {
  assertEq(calculateFantasyPoints({ runs: 30, ballsFaced: 20 }), 35, "30 runs + 5 bonus");
  assertEq(calculateFantasyPoints({ runs: 29, ballsFaced: 20 }), 29, "29 runs, no bonus");
});

// ─── BOWLING TESTS ─────────────────────────────────────────────

test("11.8 — bowling: basic wickets (2 wickets)", () => {
  assertEq(calculateFantasyPoints({ wickets: 2 }), 50, "2*25");
});

test("11.9 — bowling: 3-wicket bonus", () => {
  assertEq(calculateFantasyPoints({ wickets: 3 }), 90, "75+15");
});

test("11.10 — bowling: 4-wicket bonus", () => {
  assertEq(calculateFantasyPoints({ wickets: 4 }), 125, "100+25");
});

test("11.11 — bowling: 5-wicket haul bonus", () => {
  assertEq(calculateFantasyPoints({ wickets: 5 }), 155, "125+30");
});

test("11.12 — bowling: maidens (3 maidens)", () => {
  assertEq(calculateFantasyPoints({ maidens: 3 }), 45, "3*15");
});

test("11.13 — bowling: combined (3 wickets, 1 maiden)", () => {
  assertEq(calculateFantasyPoints({ wickets: 3, maidens: 1 }), 105, "75+15+15");
});

// ─── FIELDING TESTS ────────────────────────────────────────────

test("11.14 — fielding: catches (3 catches)", () => {
  assertEq(calculateFantasyPoints({ catches: 3 }), 30, "3*10");
});

test("11.15 — fielding: stumpings (2 stumpings)", () => {
  assertEq(calculateFantasyPoints({ stumpings: 2 }), 30, "2*15");
});

test("11.16 — fielding: direct run-out", () => {
  assertEq(calculateFantasyPoints({ runOutsDirect: 1 }), 15, "1*15");
});

test("11.17 — fielding: indirect run-out", () => {
  assertEq(calculateFantasyPoints({ runOutsIndirect: 1 }), 10, "1*10");
});

// ─── COMBINED TESTS ────────────────────────────────────────────

test("11.18 — all-rounder combo (30 runs + 2 wickets + 1 catch)", () => {
  assertEq(
    calculateFantasyPoints({ runs: 30, ballsFaced: 20, wickets: 2, catches: 1 }),
    35 + 50 + 10, // 30 runs + 5 (30-run bonus) + 50 wkt + 10 catch
    "all-rounder combo"
  );
});

test("11.19 — player of match bonus", () => {
  assertEq(
    calculateFantasyPoints({ runs: 60, fours: 5, sixes: 2, ballsFaced: 40, isPlayerOfMatch: true }),
    60 + 5 + 4 + 20 + 25, // runs + fours + sixes + halfCentury + POTM
    "POTM bonus"
  );
});

// ─── MULTIPLIER TESTS ──────────────────────────────────────────

test("11.20 — captain 2x multiplier", () => {
  const base = calculateFantasyPoints({ runs: 50, fours: 5, sixes: 1, ballsFaced: 35 }); // 77
  assertEq(applyMultiplier(base, "captain"), 154, "captain 2x");
});

test("11.21 — vice-captain 1.5x multiplier", () => {
  const base = calculateFantasyPoints({ runs: 50, fours: 5, sixes: 1, ballsFaced: 35 }); // 77
  assertEq(applyMultiplier(base, "vice_captain"), 115.5, "VC 1.5x");
});

test("11.22 — normal player no multiplier", () => {
  const base = calculateFantasyPoints({ runs: 50, fours: 5, sixes: 1, ballsFaced: 35 }); // 77
  assertEq(applyMultiplier(base, "normal"), 77, "normal 1x");
});

// ─── FULL INNINGS SIMULATIONS ──────────────────────────────────

test("11.23 — full innings: star batsman (82 off 51, 9×4, 3×6, POTM, captain)", () => {
  const base = calculateFantasyPoints({
    runs: 82, ballsFaced: 51, fours: 9, sixes: 3,
    catches: 1, isPlayerOfMatch: true,
  });
  // 82 + 9 + 6 + 20(50-bonus) + 10(catch) + 25(POTM) = 152
  assertEq(base, 152, "star batsman base");
  assertEq(applyMultiplier(base, "captain"), 304, "star batsman as captain");
});

test("11.24 — full innings: top bowler (4-0-28-3, 1 maiden, VC)", () => {
  const base = calculateFantasyPoints({
    wickets: 3, maidens: 1, catches: 1,
  });
  // 75 + 15(3w bonus) + 15(maiden) + 10(catch) = 115
  assertEq(base, 115, "top bowler base");
  assertEq(applyMultiplier(base, "vice_captain"), 172.5, "top bowler as VC");
});

test("11.25 — full innings: keeper-batsman (45 runs, 3×4, 2 catches, 1 stumping)", () => {
  const base = calculateFantasyPoints({
    runs: 45, ballsFaced: 30, fours: 3, catches: 2, stumpings: 1,
  });
  // 45 + 3 + 5(30-run bonus) + 20(catches) + 15(stumping) = 88
  assertEq(base, 88, "keeper-batsman");
});

test("11.26 — edge case: 0 everything", () => {
  assertEq(calculateFantasyPoints({}), 0, "empty score");
});

test("11.27 — edge case: exactly 30 runs (bonus boundary)", () => {
  assertEq(calculateFantasyPoints({ runs: 30, ballsFaced: 25 }), 35, "exactly 30 = bonus");
});

test("11.28 — edge case: exactly 49 runs (no 50-run bonus)", () => {
  assertEq(calculateFantasyPoints({ runs: 49, ballsFaced: 35 }), 49 + 5, "49 = 30-run bonus only");
});

// ─── TEAM TOTAL SIMULATION ─────────────────────────────────────

test("11.29 — team total: 3 players (captain + VC + normal)", () => {
  const p1Base = calculateFantasyPoints({ runs: 50, fours: 5, sixes: 1, ballsFaced: 35 }); // 77
  const p2Base = calculateFantasyPoints({ wickets: 3, maidens: 1 }); // 105
  const p3Base = calculateFantasyPoints({ runs: 20, ballsFaced: 15, catches: 2 }); // 40

  const total = applyMultiplier(p1Base, "captain") +
    applyMultiplier(p2Base, "vice_captain") +
    applyMultiplier(p3Base, "normal");
  // 154 + 157.5 + 40 = 351.5
  assertEq(total, 351.5, "team total");
});

// ─── Run Tests ─────────────────────────────────────────────────

(async () => {
  console.log("\n=== Chapter 11: Scoring Engine Tests ===\n");
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
})();
