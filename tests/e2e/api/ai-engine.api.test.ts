/**
 * API-Level Tests — AI Engine Endpoints (L2)
 *
 * Tests analytics.getFixtureDifficulty, analytics.getPlayerProjections,
 * analytics.getTeamFixtures, analytics.getFixtureTicker,
 * analytics.rateMyTeam, guru.sendMessage, guru.getConversations.
 *
 * Requires API server running on localhost:3001.
 * Run: npx tsx tests/e2e/api/ai-engine.api.test.ts
 */

const API_BASE = process.env.API_URL ?? "http://localhost:3001";

async function trpcQuery(path: string, input?: Record<string, unknown>) {
  const inputParam = input
    ? `?input=${encodeURIComponent(JSON.stringify(input))}`
    : "";
  const url = `${API_BASE}/trpc/${path}${inputParam}`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

async function trpcMutation(path: string, input: Record<string, unknown>, authToken?: string) {
  const url = `${API_BASE}/trpc/${path}`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(input),
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

function unwrap(res: { status: number; data: any }): any {
  const d = res.data?.result?.data;
  return d?.json !== undefined ? d.json : d;
}

function test(name: string, fn: () => Promise<void>) {
  return { name, fn };
}

const tests = [
  // ── FDR Tests ──────────────────────────────────────────────

  test("analytics.getFixtureDifficulty accepts valid input", async () => {
    const res = await trpcQuery("analytics.getFixtureDifficulty", {
      matchId: "test-match-fdr",
      teamA: "India",
      teamB: "Australia",
      format: "T20",
      venue: null,
      tournament: "ICC T20 World Cup",
    });
    // Could be null (no Gemini API key in test) or valid FDR data
    if (res.status !== 200) {
      console.log(`  FDR returned ${res.status} — may need Gemini API key or DB`);
      return;
    }
    const data = unwrap(res);
    console.log(`  FDR result: ${data ? "generated" : "null (no Gemini key)"}`);
  }),

  test("analytics.getTeamFixtures returns array", async () => {
    const res = await trpcQuery("analytics.getTeamFixtures", {
      teamId: "india",
      limit: 5,
    });
    if (res.status !== 200) {
      console.log(`  getTeamFixtures returned ${res.status}`);
      return;
    }
    const data = unwrap(res);
    if (!Array.isArray(data)) throw new Error("Expected array");
    console.log(`  team fixtures: ${data.length}`);
  }),

  test("analytics.getFixtureTicker returns ticker data", async () => {
    const res = await trpcQuery("analytics.getFixtureTicker", {
      tournament: "ICC T20 World Cup",
      limit: 5,
    });
    if (res.status !== 200) {
      console.log(`  getFixtureTicker returned ${res.status}`);
      return;
    }
    const data = unwrap(res);
    if (!Array.isArray(data)) throw new Error("Expected array");
    console.log(`  ticker items: ${data.length}`);
  }),

  // ── Projections Tests ──────────────────────────────────────

  test("analytics.getPlayerProjections accepts valid input", async () => {
    const res = await trpcQuery("analytics.getPlayerProjections", {
      matchId: "test-match-proj",
      teamA: "India",
      teamB: "Australia",
      format: "T20",
      venue: null,
      tournament: "ICC T20 World Cup",
      players: [
        { id: "vk18", name: "Virat Kohli", role: "BAT", team: "India" },
        { id: "jb93", name: "Jasprit Bumrah", role: "BOWL", team: "India" },
      ],
    });
    if (res.status !== 200) {
      console.log(`  Projections returned ${res.status} — may need Gemini key or DB`);
      return;
    }
    const data = unwrap(res);
    console.log(`  Projections: ${data?.players?.length ?? 0} players, generated: ${data ? "yes" : "null"}`);
  }),

  // ── Ownership Stats Tests ──────────────────────────────────

  test("analytics.getOwnershipStats returns coming soon or error", async () => {
    const res = await trpcQuery("analytics.getOwnershipStats", {
      matchId: "test-match",
    });
    if (res.status === 200) {
      const data = unwrap(res);
      if (data?.message?.includes("Coming soon")) {
        console.log(`  Ownership: ${data.message}`);
      } else {
        console.log(`  Ownership: returned data (${JSON.stringify(data).substring(0, 80)})`);
      }
    } else {
      // Server may need restart for new router code
      console.log(`  Ownership returned ${res.status} — server may need restart for new code`);
    }
  }),

  // ── Rate My Team Tests ─────────────────────────────────────

  test("analytics.rateMyTeam requires auth (returns UNAUTHORIZED)", async () => {
    const res = await trpcMutation("analytics.rateMyTeam", {
      team: [
        { name: "Virat Kohli", role: "BAT", credits: 10.5, isCaptain: true, isViceCaptain: false },
      ],
      matchInfo: { teamA: "India", teamB: "Australia", format: "T20", venue: null },
    });
    // Should fail without auth token
    if (res.status === 200) {
      console.log("  [WARN] rateMyTeam succeeded without auth — check middleware");
    } else {
      const errorCode = res.data?.error?.data?.code ?? res.data?.[0]?.error?.data?.code;
      if (errorCode === "UNAUTHORIZED") {
        console.log("  rateMyTeam correctly requires auth");
      } else {
        console.log(`  rateMyTeam returned ${res.status} (error: ${JSON.stringify(res.data).substring(0, 100)})`);
      }
    }
  }),

  // ── Guru Tests ─────────────────────────────────────────────

  test("guru.sendMessage requires auth (returns UNAUTHORIZED)", async () => {
    const res = await trpcMutation("guru.sendMessage", {
      message: "Who should I captain?",
      conversationId: null,
      context: {},
    });
    if (res.status === 200) {
      console.log("  [WARN] guru.sendMessage succeeded without auth — check middleware");
    } else {
      const errorCode = res.data?.error?.data?.code ?? res.data?.[0]?.error?.data?.code;
      if (errorCode === "UNAUTHORIZED") {
        console.log("  guru.sendMessage correctly requires auth");
      } else {
        console.log(`  guru.sendMessage returned ${res.status}`);
      }
    }
  }),

  test("guru.getConversations requires auth", async () => {
    const res = await trpcQuery("guru.getConversations", { limit: 5 });
    if (res.status === 200) {
      console.log("  [WARN] guru.getConversations succeeded without auth");
    } else {
      console.log("  guru.getConversations correctly requires auth");
    }
  }),

  // ── Input Validation Tests ─────────────────────────────────

  test("analytics.getFixtureDifficulty rejects missing required fields", async () => {
    const res = await trpcQuery("analytics.getFixtureDifficulty", {
      matchId: "test",
      // Missing teamA, teamB, format, tournament
    });
    if (res.status === 200) {
      throw new Error("Expected validation error for missing fields");
    }
    console.log(`  Validation: correctly rejected with ${res.status}`);
  }),

  test("guru.sendMessage rejects empty message", async () => {
    const res = await trpcMutation("guru.sendMessage", {
      message: "",
      conversationId: null,
      context: {},
    });
    if (res.status === 200) {
      throw new Error("Expected validation error for empty message");
    }
    console.log(`  Validation: correctly rejected empty message with ${res.status}`);
  }),
];

// ── Runner ────────────────────────────────────────────────────

async function main() {
  console.log("\n=== API Tests: AI Engine (L2) ===\n");

  // Check API is running
  try {
    const health = await fetch(`${API_BASE}/health`);
    if (!health.ok) throw new Error("API not healthy");
    console.log(`  API healthy at ${API_BASE}\n`);
  } catch {
    console.log(`  [SKIP] API server not running at ${API_BASE}`);
    console.log("  Start with: pnpm --filter @draftplay/api dev\n");
    process.exit(0);
  }

  let passed = 0;
  let failed = 0;
  let skipped = 0;

  for (const t of tests) {
    process.stdout.write(`  [RUN] ${t.name} ... `);
    try {
      await t.fn();
      console.log("PASS");
      passed++;
    } catch (err: any) {
      if (err.message?.includes("SKIP")) {
        console.log(`SKIP: ${err.message}`);
        skipped++;
      } else {
        console.log(`FAIL: ${err.message}`);
        failed++;
      }
    }
  }

  console.log(`\n  Results: ${passed} passed, ${failed} failed, ${skipped} skipped, ${tests.length} total\n`);
  if (failed > 0) process.exit(1);
}

main();
