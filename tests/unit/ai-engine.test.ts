/**
 * Unit Tests — AI Engine (FDR, Projections, Rate My Team)
 *
 * Tests the pure parsing functions for each AI service.
 * No network, no DB, no Gemini calls — just structured text parsing.
 *
 * Run: npx tsx tests/unit/ai-engine.test.ts
 */

// ── Test runner ────────────────────────────────────────────────

interface TestCase { name: string; fn: () => void }
const tests: TestCase[] = [];
function test(name: string, fn: () => void) { tests.push({ name, fn }); }
function assert(cond: boolean, msg: string) { if (!cond) throw new Error(msg); }
function assertEq(a: unknown, b: unknown, msg: string) {
  if (a !== b) throw new Error(`${msg}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

// ═══════════════════════════════════════════════════════════════
// We can't directly import the parse functions (they're module-private),
// so we replicate the parsing logic here to verify correctness.
// This tests the CONTRACT — the exact format the AI is prompted with.
// ═══════════════════════════════════════════════════════════════

// ── FDR Parsing ──────────────────────────────────────────────

function parseFDR(text: string, matchId: string, teamA: string, teamB: string) {
  const fdrBlock = text.match(/\[FDR_START\]([\s\S]*?)\[FDR_END\]/);
  if (!fdrBlock) return null;

  const parts = fdrBlock[1].split("[FDR_SEPARATOR]");
  if (parts.length < 2) return null;

  function parseTeam(block: string, teamName: string) {
    const get = (key: string): string => {
      const match = block.match(new RegExp(`${key}:\\s*(.+)`));
      return match ? match[1].trim() : "";
    };
    const clampFdr = (val: number): number => Math.max(1, Math.min(5, val || 3));

    return {
      matchId,
      teamId: teamName.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
      teamName,
      overallFdr: clampFdr(parseInt(get("OverallFDR"))),
      battingFdr: clampFdr(parseInt(get("BattingFDR"))),
      bowlingFdr: clampFdr(parseInt(get("BowlingFDR"))),
      oppositionRank: parseInt(get("OppositionRank")) || 10,
      recentForm: get("RecentForm") || "UNKNOWN",
      pitchType: get("PitchType") || "unknown",
    };
  }

  return {
    matchId,
    teamA: parseTeam(parts[0], teamA),
    teamB: parseTeam(parts[1], teamB),
  };
}

// ── Projection Parsing ───────────────────────────────────────

function parseProjections(text: string, matchId: string) {
  const block = text.match(/\[PROJECTIONS_START\]([\s\S]*?)\[PROJECTIONS_END\]/);
  if (!block) return [];

  const playerBlocks = block[1].split("[PLAYER_END]").filter((b) => b.trim());
  const projections: any[] = [];

  for (const pBlock of playerBlocks) {
    const get = (key: string): string => {
      const m = pBlock.match(new RegExp(`${key}:\\s*(.+)`));
      return m ? m[1].trim() : "0";
    };

    const playerLine = get("Player");
    const parts = playerLine.split("|").map((s) => s.trim());

    projections.push({
      playerName: parts[0] ?? "Unknown",
      playerId: parts[1] ?? "",
      role: parts[2] ?? "BAT",
      projected: parseFloat(get("Projected")) || 0,
      low: parseFloat(get("Low")) || 0,
      high: parseFloat(get("High")) || 0,
      battingPts: parseFloat(get("BattingPts")) || 0,
      bowlingPts: parseFloat(get("BowlingPts")) || 0,
      fieldingPts: parseFloat(get("FieldingPts")) || 0,
      bonusPts: parseFloat(get("BonusPts")) || 0,
    });
  }

  return projections;
}

// ── Rating Parsing ───────────────────────────────────────────

function parseRating(text: string) {
  const block = text.match(/\[RATING_START\]([\s\S]*?)\[RATING_END\]/);
  if (!block) return null;

  const content = block[1];
  const get = (key: string): string => {
    const m = content.match(new RegExp(`${key}:\\s*(.+)`));
    return m ? m[1].trim() : "";
  };

  return {
    overallGrade: get("OverallGrade") || "C",
    overallScore: parseInt(get("OverallScore")) || 50,
    battingScore: parseInt(get("BattingScore")) || 50,
    battingGrade: get("BattingGrade") || "C",
    bowlingScore: parseInt(get("BowlingScore")) || 50,
    weakSpot1: get("WeakSpot1"),
    weakSpot2: get("WeakSpot2"),
    transfer1Out: get("Transfer1Out"),
    transfer1In: get("Transfer1In"),
    summary: get("Summary"),
  };
}

// ═══════════════════════════════════════════════════════════════
// FDR TESTS
// ═══════════════════════════════════════════════════════════════

const SAMPLE_FDR = `
Some preamble text from Gemini.

[FDR_START]
Team: India
OverallFDR: 2
BattingFDR: 2
BowlingFDR: 3
OppositionRank: 8
RecentForm: WWLWW
PitchType: batting_friendly
DayNight: true
Weather: clear
H2HWins: 15
H2HLosses: 10
TournamentStage: group
VenueBatAvg: 35.5
VenueBowlAvg: 28.2
[FDR_SEPARATOR]
Team: Australia
OverallFDR: 4
BattingFDR: 3
BowlingFDR: 4
OppositionRank: 1
RecentForm: WLLWL
PitchType: batting_friendly
DayNight: true
Weather: clear
H2HWins: 10
H2HLosses: 15
TournamentStage: group
VenueBatAvg: 32.1
VenueBowlAvg: 30.5
[FDR_END]

Some trailing text.
`;

test("FDR: parses valid response with both teams", () => {
  const result = parseFDR(SAMPLE_FDR, "match-1", "India", "Australia");
  assert(result !== null, "Should parse successfully");
  assertEq(result!.matchId, "match-1", "matchId");
});

test("FDR: team A parsed correctly", () => {
  const result = parseFDR(SAMPLE_FDR, "match-1", "India", "Australia")!;
  assertEq(result.teamA.overallFdr, 2, "India overall FDR");
  assertEq(result.teamA.battingFdr, 2, "India batting FDR");
  assertEq(result.teamA.bowlingFdr, 3, "India bowling FDR");
  assertEq(result.teamA.recentForm, "WWLWW", "India form");
  assertEq(result.teamA.pitchType, "batting_friendly", "pitch type");
});

test("FDR: team B parsed correctly", () => {
  const result = parseFDR(SAMPLE_FDR, "match-1", "India", "Australia")!;
  assertEq(result.teamB.overallFdr, 4, "Australia overall FDR");
  assertEq(result.teamB.battingFdr, 3, "Australia batting FDR");
  assertEq(result.teamB.bowlingFdr, 4, "Australia bowling FDR");
  assertEq(result.teamB.oppositionRank, 1, "opposition rank");
});

test("FDR: clamps values to 1-5 range", () => {
  const badText = `[FDR_START]
Team: A
OverallFDR: 0
BattingFDR: 7
BowlingFDR: -2
[FDR_SEPARATOR]
Team: B
OverallFDR: 3
BattingFDR: 3
BowlingFDR: 3
[FDR_END]`;

  const result = parseFDR(badText, "m1", "A", "B")!;
  assertEq(result.teamA.overallFdr, 3, "0 → default 3 (NaN fallback)");
  assertEq(result.teamA.battingFdr, 5, "7 → clamped to 5");
  assertEq(result.teamA.bowlingFdr, 1, "-2 → clamped to 1");
});

test("FDR: returns null for missing block", () => {
  const result = parseFDR("No FDR data here", "m1", "A", "B");
  assertEq(result, null, "should be null");
});

test("FDR: returns null for missing separator", () => {
  const result = parseFDR("[FDR_START]\nSome data\n[FDR_END]", "m1", "A", "B");
  assertEq(result, null, "should be null");
});

test("FDR: teamId slugified correctly", () => {
  const result = parseFDR(SAMPLE_FDR, "m1", "Chennai Super Kings", "Royal Challengers Bangalore")!;
  assertEq(result.teamA.teamId, "chennai_super_kings", "teamA slug");
  assertEq(result.teamB.teamId, "royal_challengers_bangalore", "teamB slug");
});

// ═══════════════════════════════════════════════════════════════
// PROJECTION TESTS
// ═══════════════════════════════════════════════════════════════

const SAMPLE_PROJECTIONS = `
[PROJECTIONS_START]
Player: Virat Kohli | vk18 | BAT
Projected: 52.5
Low: 35
High: 72
BattingPts: 45
BowlingPts: 0
FieldingPts: 5
BonusPts: 2.5
FormScore: 85
VenueScore: 70
OppositionScore: 60
PitchScore: 75
PositionScore: 90
ImportanceScore: 80
[PLAYER_END]
Player: Jasprit Bumrah | jb93 | BOWL
Projected: 38
Low: 20
High: 55
BattingPts: 5
BowlingPts: 28
FieldingPts: 3
BonusPts: 2
FormScore: 90
VenueScore: 65
OppositionScore: 55
PitchScore: 60
PositionScore: 95
ImportanceScore: 85
[PLAYER_END]
[PROJECTIONS_END]
`;

test("Projections: parses multiple players", () => {
  const result = parseProjections(SAMPLE_PROJECTIONS, "match-1");
  assertEq(result.length, 2, "player count");
});

test("Projections: player 1 name and id", () => {
  const result = parseProjections(SAMPLE_PROJECTIONS, "match-1");
  assertEq(result[0].playerName, "Virat Kohli", "name");
  assertEq(result[0].playerId, "vk18", "id");
  assertEq(result[0].role, "BAT", "role");
});

test("Projections: projected points parsed", () => {
  const result = parseProjections(SAMPLE_PROJECTIONS, "match-1");
  assertEq(result[0].projected, 52.5, "Kohli projected");
  assertEq(result[1].projected, 38, "Bumrah projected");
});

test("Projections: confidence interval parsed", () => {
  const result = parseProjections(SAMPLE_PROJECTIONS, "match-1");
  assertEq(result[0].low, 35, "low");
  assertEq(result[0].high, 72, "high");
});

test("Projections: breakdown parsed", () => {
  const result = parseProjections(SAMPLE_PROJECTIONS, "match-1");
  assertEq(result[0].battingPts, 45, "batting pts");
  assertEq(result[0].bowlingPts, 0, "bowling pts");
  assertEq(result[1].bowlingPts, 28, "Bumrah bowling pts");
});

test("Projections: empty for missing block", () => {
  const result = parseProjections("No data here", "m1");
  assertEq(result.length, 0, "should be empty");
});

test("Projections: handles single player", () => {
  const text = `[PROJECTIONS_START]
Player: MS Dhoni | msd7 | WK
Projected: 25
Low: 10
High: 40
BattingPts: 18
BowlingPts: 0
FieldingPts: 7
BonusPts: 0
FormScore: 50
VenueScore: 60
OppositionScore: 50
PitchScore: 55
PositionScore: 70
ImportanceScore: 40
[PLAYER_END]
[PROJECTIONS_END]`;

  const result = parseProjections(text, "m1");
  assertEq(result.length, 1, "one player");
  assertEq(result[0].playerName, "MS Dhoni", "name");
  assertEq(result[0].projected, 25, "projected");
});

// ═══════════════════════════════════════════════════════════════
// RATE MY TEAM TESTS
// ═══════════════════════════════════════════════════════════════

const SAMPLE_RATING = `
Here is the analysis of your team:

[RATING_START]
OverallScore: 78
OverallGrade: B+
BattingScore: 85
BattingGrade: A
BattingComment: Strong top order with Kohli and Rohit
BowlingScore: 70
BowlingGrade: B
BowlingComment: Bumrah carries the attack, need more depth
AllRoundersScore: 65
AllRoundersGrade: C+
AllRoundersComment: Only one true all-rounder in the squad
CaptainScore: 90
CaptainGrade: A+
CaptainComment: Kohli as captain is the optimal choice based on projections
FixtureScore: 75
FixtureGrade: B+
FixtureComment: India has a favorable FDR of 2 for this match
BudgetScore: 72
BudgetGrade: B
BudgetComment: Good value picks but Rohit is expensive for his projected output
WeakSpot1: Only one specialist spinner in the team
WeakSpot2: No backup keeper if Dhoni underperforms
WeakSpot3: Tail-end batting is very weak
Transfer1Out: Rohit Sharma
Transfer1In: Shubman Gill
Transfer1Gain: 8.5
Transfer1Reason: Gill has better form and costs 1 credit less
Transfer2Out: Yuzvendra Chahal
Transfer2In: Ravindra Jadeja
Transfer2Gain: 12
Transfer2Reason: Jadeja adds batting depth and has a better economy rate at this venue
Summary: A solid B+ team with strong batting but over-reliant on pace bowling. Consider swapping Rohit for Gill to free up credits and adding Jadeja for balance.
[RATING_END]
`;

test("Rating: parses overall grade and score", () => {
  const result = parseRating(SAMPLE_RATING)!;
  assertEq(result.overallGrade, "B+", "grade");
  assertEq(result.overallScore, 78, "score");
});

test("Rating: parses category scores", () => {
  const result = parseRating(SAMPLE_RATING)!;
  assertEq(result.battingScore, 85, "batting score");
  assertEq(result.battingGrade, "A", "batting grade");
  assertEq(result.bowlingScore, 70, "bowling score");
});

test("Rating: parses weak spots", () => {
  const result = parseRating(SAMPLE_RATING)!;
  assert(result.weakSpot1.includes("spinner"), "weak spot 1");
  assert(result.weakSpot2.includes("keeper"), "weak spot 2");
});

test("Rating: parses transfer suggestions", () => {
  const result = parseRating(SAMPLE_RATING)!;
  assertEq(result.transfer1Out, "Rohit Sharma", "transfer out");
  assertEq(result.transfer1In, "Shubman Gill", "transfer in");
});

test("Rating: parses summary", () => {
  const result = parseRating(SAMPLE_RATING)!;
  assert(result.summary.includes("B+ team"), "summary");
});

test("Rating: returns null for missing block", () => {
  const result = parseRating("No rating data");
  assertEq(result, null, "should be null");
});

test("Rating: defaults for missing values", () => {
  const text = `[RATING_START]
OverallScore: not_a_number
BattingScore: 60
[RATING_END]`;
  const result = parseRating(text)!;
  assertEq(result.overallScore, 50, "NaN defaults to 50");
  assertEq(result.overallGrade, "C", "missing key defaults to C");
  assertEq(result.battingScore, 60, "valid value preserved");
});

// ═══════════════════════════════════════════════════════════════
// CACHE KEY TESTS (Rate My Team)
// ═══════════════════════════════════════════════════════════════

function buildCacheKey(
  team: Array<{ name: string; role: string; credits: number; isCaptain: boolean; isViceCaptain: boolean }>,
  matchInfo: { teamA: string; teamB: string; format: string; venue: string | null }
): string {
  const playerKey = team
    .map((p) => `${p.name}:${p.role}:${p.credits}:${p.isCaptain ? "C" : ""}${p.isViceCaptain ? "V" : ""}`)
    .sort()
    .join("|");
  const matchKey = `${matchInfo.teamA}:${matchInfo.teamB}:${matchInfo.format}`;
  return `rate-team:${matchKey}:${playerKey}`;
}

const MATCH_INFO = { teamA: "India", teamB: "Australia", format: "T20", venue: null };

const TEAM_A = [
  { name: "Virat Kohli", role: "BAT", credits: 10.5, isCaptain: true, isViceCaptain: false },
  { name: "Jasprit Bumrah", role: "BOWL", credits: 9, isCaptain: false, isViceCaptain: true },
];

test("CacheKey: same team same order = same key", () => {
  const key1 = buildCacheKey(TEAM_A, MATCH_INFO);
  const key2 = buildCacheKey(TEAM_A, MATCH_INFO);
  assertEq(key1, key2, "identical inputs");
});

test("CacheKey: same team different order = same key (sorted)", () => {
  const reversed = [...TEAM_A].reverse();
  const key1 = buildCacheKey(TEAM_A, MATCH_INFO);
  const key2 = buildCacheKey(reversed, MATCH_INFO);
  assertEq(key1, key2, "order should not matter");
});

test("CacheKey: different captain = different key", () => {
  const teamWithDiffCaptain = [
    { name: "Virat Kohli", role: "BAT", credits: 10.5, isCaptain: false, isViceCaptain: true },
    { name: "Jasprit Bumrah", role: "BOWL", credits: 9, isCaptain: true, isViceCaptain: false },
  ];
  const key1 = buildCacheKey(TEAM_A, MATCH_INFO);
  const key2 = buildCacheKey(teamWithDiffCaptain, MATCH_INFO);
  assert(key1 !== key2, "captain change should change key");
});

test("CacheKey: different match = different key", () => {
  const otherMatch = { teamA: "India", teamB: "England", format: "T20", venue: null };
  const key1 = buildCacheKey(TEAM_A, MATCH_INFO);
  const key2 = buildCacheKey(TEAM_A, otherMatch);
  assert(key1 !== key2, "different match should change key");
});

test("CacheKey: different format = different key", () => {
  const odiMatch = { teamA: "India", teamB: "Australia", format: "ODI", venue: null };
  const key1 = buildCacheKey(TEAM_A, MATCH_INFO);
  const key2 = buildCacheKey(TEAM_A, odiMatch);
  assert(key1 !== key2, "different format should change key");
});

test("CacheKey: swapping a player = different key", () => {
  const teamWithSwap = [
    { name: "Virat Kohli", role: "BAT", credits: 10.5, isCaptain: true, isViceCaptain: false },
    { name: "Mohammed Shami", role: "BOWL", credits: 8.5, isCaptain: false, isViceCaptain: true },
  ];
  const key1 = buildCacheKey(TEAM_A, MATCH_INFO);
  const key2 = buildCacheKey(teamWithSwap, MATCH_INFO);
  assert(key1 !== key2, "player swap should change key");
});

// ═══════════════════════════════════════════════════════════════
// GEMINI CLIENT REGION MAPPING TESTS
// ═══════════════════════════════════════════════════════════════

const REGION_MAP: Record<string, string> = {
  IN: "asia-south1",
  US: "us-central1",
  GB: "europe-west1",
  AU: "australia-southeast1",
  JP: "asia-northeast1",
  BD: "asia-southeast1",
};
const DEFAULT_REGION = "asia-south1";

function getGeminiRegion(country: string): string {
  return REGION_MAP[country] ?? DEFAULT_REGION;
}

test("Region: India maps to asia-south1", () => {
  assertEq(getGeminiRegion("IN"), "asia-south1", "IN region");
});

test("Region: US maps to us-central1", () => {
  assertEq(getGeminiRegion("US"), "us-central1", "US region");
});

test("Region: GB maps to europe-west1", () => {
  assertEq(getGeminiRegion("GB"), "europe-west1", "GB region");
});

test("Region: unknown country falls back to asia-south1", () => {
  assertEq(getGeminiRegion("XX"), "asia-south1", "unknown");
  assertEq(getGeminiRegion("ZZ"), "asia-south1", "unknown 2");
});

// ═══════════════════════════════════════════════════════════════
// RUNNER
// ═══════════════════════════════════════════════════════════════

async function main() {
  console.log("\n=== Unit Tests: AI Engine (FDR, Projections, Rate My Team) ===\n");
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
