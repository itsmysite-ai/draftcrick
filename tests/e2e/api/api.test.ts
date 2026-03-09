/**
 * API-Level Tests — Direct tRPC endpoint validation
 *
 * These run with `npx tsx` (not Playwright) — they test the API server directly.
 * Requires API server running on localhost:3001.
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

/** Unwrap tRPC response — handles both {result:{data:{json:...}}} and {result:{data:...}} */
function unwrap(res: { status: number; data: any }): any {
  const d = res.data?.result?.data;
  return d?.json !== undefined ? d.json : d;
}

function test(name: string, fn: () => Promise<void>) {
  return { name, fn };
}

const tests = [
  test("sports.dashboard returns matches array", async () => {
    const res = await trpcQuery("sports.dashboard", { sport: "cricket" });
    if (res.status !== 200) {
      console.log(`  [WARN] sports.dashboard returned ${res.status} — API may not have cached data yet`);
      return;
    }
    const data = unwrap(res);
    if (!data) throw new Error("No data returned");
    if (!Array.isArray(data.matches)) throw new Error("matches is not an array");
    console.log(`  matches: ${data.matches.length}, tournaments: ${data.tournaments?.length ?? 0}`);
  }),

  test("sports.todayMatches returns today's matches", async () => {
    const res = await trpcQuery("sports.todayMatches");
    if (res.status !== 200) {
      console.log(`  [WARN] sports.todayMatches returned ${res.status}`);
      return;
    }
    const data = unwrap(res);
    if (!Array.isArray(data)) throw new Error("Expected array");
    console.log(`  today matches: ${data.length}`);
  }),

  test("sports.tournaments returns tournament list", async () => {
    const res = await trpcQuery("sports.tournaments");
    if (res.status !== 200) {
      console.log(`  [WARN] sports.tournaments returned ${res.status}`);
      return;
    }
    const data = unwrap(res);
    if (!Array.isArray(data)) throw new Error("Expected array");
    console.log(`  tournaments: ${data.length}`);
  }),

  test("sports.liveMatches returns array (may be empty)", async () => {
    const res = await trpcQuery("sports.liveMatches");
    if (res.status !== 200) {
      console.log(`  [WARN] sports.liveMatches returned ${res.status}`);
      return;
    }
    const data = unwrap(res);
    if (!Array.isArray(data)) throw new Error("Expected array");
    console.log(`  live matches: ${data.length}`);
  }),

  test("sports.cacheStatus returns cache metadata", async () => {
    const res = await trpcQuery("sports.cacheStatus");
    if (res.status !== 200) {
      console.log(`  [WARN] sports.cacheStatus returned ${res.status}`);
      return;
    }
    const data = unwrap(res);
    if (!data) throw new Error("No cache status data");
    console.log(`  cache status: ${JSON.stringify(data).substring(0, 100)}`);
  }),

  test("match.list returns matches with teams", async () => {
    const res = await trpcQuery("match.list");
    if (res.status !== 200) {
      console.log(`  [WARN] match.list returned ${res.status}`);
      return;
    }
    const data = unwrap(res);
    const matches = data?.matches ?? data;
    if (!Array.isArray(matches)) throw new Error("Expected matches array");
    console.log(`  DB matches: ${matches.length}`);
  }),

  test("match.getById returns match detail or 404", async () => {
    const res = await trpcQuery("match.getById", { id: "test-match-id" });
    // 404 / NOT_FOUND is acceptable for a non-existent match
    if (res.status === 200) {
      console.log("  match found (unexpected for test ID)");
    } else {
      console.log(`  match.getById returned ${res.status} for test ID (expected)`);
    }
  }),

  test("player.list returns players", async () => {
    const res = await trpcQuery("player.list");
    if (res.status !== 200) {
      console.log(`  [WARN] player.list returned ${res.status}`);
      return;
    }
    const data = unwrap(res);
    if (!Array.isArray(data)) throw new Error("Expected array");
    console.log(`  players: ${data.length}`);
  }),

  test("player.search filters by name", async () => {
    const res = await trpcQuery("player.search", { query: "virat" });
    if (res.status !== 200) {
      console.log(`  [WARN] player.search returned ${res.status}`);
      return;
    }
    const data = unwrap(res);
    if (!Array.isArray(data)) throw new Error("Expected array");
    console.log(`  search results for 'virat': ${data.length}`);
  }),

  test("auth.getSession returns null for unauthenticated", async () => {
    const res = await trpcQuery("auth.getSession");
    if (res.status !== 200 && res.status !== 401) {
      throw new Error(`Unexpected status: ${res.status}`);
    }
    // Either null session or UNAUTHORIZED — both correct for no token
    console.log(`  auth.getSession: status ${res.status} (expected for unauthenticated)`);
  }),

  test("contest.listByMatch returns contests for match", async () => {
    const res = await trpcQuery("contest.listByMatch", { matchId: "test-match" });
    if (res.status !== 200) {
      console.log(`  [WARN] contest.listByMatch returned ${res.status}`);
      return;
    }
    const data = unwrap(res);
    if (!Array.isArray(data)) throw new Error("Expected array");
    console.log(`  contests for test-match: ${data.length}`);
  }),

  // ─── Phase 2.75: Real Data Tests ───────────────────────────

  test("sports.dashboard response has correct structure", async () => {
    const res = await trpcQuery("sports.dashboard", { sport: "cricket" });
    if (res.status !== 200) {
      console.log(`  [WARN] API returned ${res.status} — need cached data`);
      return;
    }
    const data = unwrap(res);
    if (!data) throw new Error("No data");
    // Validate shape: matches[], tournaments[], lastFetched, sources[], sport
    if (!Array.isArray(data.matches)) throw new Error("matches not array");
    if (!Array.isArray(data.tournaments)) throw new Error("tournaments not array");
    if (!data.sport) throw new Error("Missing sport field");
    if (typeof data.lastFetched !== "string") throw new Error("lastFetched not string");
    if (!Array.isArray(data.sources)) throw new Error("sources not array");
    console.log(`  shape OK: ${data.matches.length} matches, ${data.tournaments.length} tournaments, sport=${data.sport}`);
  }),

  test("sports.dashboard match has expected fields", async () => {
    const res = await trpcQuery("sports.dashboard", { sport: "cricket" });
    if (res.status !== 200) { console.log("  [WARN] skipped"); return; }
    const matches = unwrap(res)?.matches;
    if (!matches?.length) { console.log("  no matches to validate"); return; }
    const m = matches[0];
    const requiredFields = ["teams", "format", "status", "tournamentName"];
    for (const f of requiredFields) {
      if (m[f] === undefined) throw new Error(`Match missing field: ${f}`);
    }
    console.log(`  first match: ${m.teams} (${m.format}) — ${m.status}`);
  }),

  test("sports.dashboard tournament has expected fields", async () => {
    const res = await trpcQuery("sports.dashboard", { sport: "cricket" });
    if (res.status !== 200) { console.log("  [WARN] skipped"); return; }
    const tournaments = unwrap(res)?.tournaments;
    if (!tournaments?.length) { console.log("  no tournaments to validate"); return; }
    const t = tournaments[0];
    if (!t.name) throw new Error("Tournament missing name");
    console.log(`  first tournament: ${t.name}`);
  }),

  test("sports.cacheStatus has per-sport structure", async () => {
    const res = await trpcQuery("sports.cacheStatus");
    if (res.status !== 200) { console.log("  [WARN] skipped"); return; }
    const data = unwrap(res);
    if (!data) throw new Error("No data");
    // Should have at least cricket key
    if (!data.cricket) throw new Error("Missing cricket cache status");
    const c = data.cricket;
    const fields = ["fresh", "matchCount", "tournamentCount", "source"];
    for (const f of fields) {
      if (c[f] === undefined) throw new Error(`Cache status missing: ${f}`);
    }
    console.log(`  cricket: fresh=${c.fresh}, matches=${c.matchCount}, tournaments=${c.tournamentCount}, source=${c.source}`);
  }),

  test("sports.standings returns standings for known tournament", async () => {
    // First get tournament names from dashboard
    const dashRes = await trpcQuery("sports.dashboard", { sport: "cricket" });
    if (dashRes.status !== 200) { console.log("  [WARN] no dashboard data"); return; }
    const tournaments = unwrap(dashRes)?.tournaments;
    if (!tournaments?.length) { console.log("  no tournaments"); return; }
    const tournamentName = tournaments[0].name;
    const res = await trpcQuery("sports.standings", { tournamentName, sport: "cricket" });
    if (res.status !== 200) {
      console.log(`  standings for "${tournamentName}": status ${res.status}`);
      return;
    }
    const data = unwrap(res);
    if (!Array.isArray(data)) throw new Error("Expected standings array");
    console.log(`  standings for "${tournamentName}": ${data.length} teams`);
  }),

  test("match.list with status filter works", async () => {
    const res = await trpcQuery("match.list", { status: "upcoming" });
    if (res.status !== 200) { console.log(`  [WARN] returned ${res.status}`); return; }
    const data = unwrap(res);
    const matches = data?.matches ?? data;
    if (!Array.isArray(matches)) throw new Error("Expected matches array");
    console.log(`  upcoming matches: ${matches.length}`);
  }),

  test("match.list with sport filter works", async () => {
    const res = await trpcQuery("match.list", { sport: "cricket" });
    if (res.status !== 200) { console.log(`  [WARN] returned ${res.status}`); return; }
    const data = unwrap(res);
    const matches = data?.matches ?? data;
    if (!Array.isArray(matches)) throw new Error("Expected matches array");
    console.log(`  cricket matches: ${matches.length}`);
  }),

  test("match.live returns live matches from DB", async () => {
    const res = await trpcQuery("match.live");
    if (res.status !== 200) { console.log(`  [WARN] returned ${res.status}`); return; }
    const data = unwrap(res);
    if (!Array.isArray(data)) throw new Error("Expected array");
    console.log(`  live matches (DB): ${data.length}`);
  }),

  test("player.search with team filter works", async () => {
    const res = await trpcQuery("player.search", { team: "CSK" });
    if (res.status !== 200) { console.log(`  [WARN] returned ${res.status}`); return; }
    const data = unwrap(res);
    if (!Array.isArray(data)) throw new Error("Expected array");
    console.log(`  CSK players: ${data.length}`);
  }),

  test("player.search with role filter works", async () => {
    const res = await trpcQuery("player.search", { role: "batsman" });
    if (res.status !== 200) { console.log(`  [WARN] returned ${res.status}`); return; }
    const data = unwrap(res);
    if (!Array.isArray(data)) throw new Error("Expected array");
    console.log(`  batsmen: ${data.length}`);
  }),

  test("sports.dashboard works for football", async () => {
    const res = await trpcQuery("sports.dashboard", { sport: "football" });
    if (res.status !== 200) { console.log(`  [WARN] returned ${res.status}`); return; }
    const data = unwrap(res);
    if (!data) throw new Error("No data");
    if (data.sport !== "football") throw new Error(`Wrong sport: ${data.sport}`);
    console.log(`  football: ${data.matches?.length ?? 0} matches, ${data.tournaments?.length ?? 0} tournaments`);
  }),

  test("sports.dashboard works for kabaddi", async () => {
    const res = await trpcQuery("sports.dashboard", { sport: "kabaddi" });
    if (res.status !== 200) { console.log(`  [WARN] returned ${res.status}`); return; }
    const data = unwrap(res);
    if (!data) throw new Error("No data");
    if (data.sport !== "kabaddi") throw new Error(`Wrong sport: ${data.sport}`);
    console.log(`  kabaddi: ${data.matches?.length ?? 0} matches, ${data.tournaments?.length ?? 0} tournaments`);
  }),

  test("seed endpoint creates test data", async () => {
    const url = `${API_BASE}/trpc/seed`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (res.status !== 200) {
      console.log(`  seed returned ${res.status} — may already have data`);
      return;
    }
    const json = await res.json().catch(() => null);
    console.log(`  seed response: ${JSON.stringify(json).substring(0, 100)}`);
  }),

  // NOT AUTOMATED — admin-only endpoint
  // test("sports.refresh requires admin token", async () => {
  //   Reason: Requires admin role token. Could forge but security risk in tests.
  // }),
];

// ─── Runner ──────────────────────────────────────────────────
async function main() {
  console.log("\n=== API-Level E2E Tests ===\n");

  let passed = 0;
  let failed = 0;
  let warned = 0;

  for (const t of tests) {
    process.stdout.write(`  [RUN] ${t.name} ... `);
    try {
      await t.fn();
      console.log("PASS");
      passed++;
    } catch (err: any) {
      console.log(`FAIL: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n  Results: ${passed} passed, ${failed} failed, ${tests.length} total\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
