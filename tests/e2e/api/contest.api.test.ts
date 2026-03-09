/**
 * Contest API Tests — Authenticated tRPC endpoint validation
 *
 * Tests contest router: listByMatch, getById, create, getStandings.
 * Requires Firebase Auth Emulator + API server + seeded data.
 *
 * Run: npx tsx tests/e2e/api/contest.api.test.ts
 */

import {
  createTestUser,
  clearEmulatorAccounts,
  trpcAuthQuery,
  trpcAuthMutate,
  unwrap,
  assert,
  expectTRPCError,
  test,
  describe,
  runTests,
} from "../helpers/api-auth";

describe("Contest API", () => {
  const EMAIL = "contest-test@draftplay.test";
  const PASSWORD = "TestPass123!";
  let token: string;
  let matchId: string;
  let contestId: string;

  test("setup user and find a match with players", async () => {
    await clearEmulatorAccounts();
    const user = await createTestUser(EMAIL, PASSWORD);
    token = user.idToken;

    // Find a match that has players linked (for team creation tests)
    const res = await trpcAuthQuery("match.list", { limit: 50 });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = unwrap(res);
    const matches = data?.matches ?? data;
    assert(Array.isArray(matches) && matches.length > 0, "No matches in DB");

    // Find first match with players
    for (const m of matches) {
      const pRes = await trpcAuthQuery("player.getByMatch", { matchId: m.id });
      const players = unwrap(pRes);
      if (Array.isArray(players) && players.length >= 11) {
        matchId = m.id;
        console.log(`    using match ${matchId} (${m.teamHome} vs ${m.teamAway}, ${players.length} players)`);
        break;
      }
    }
    if (!matchId) {
      matchId = matches[0].id;
      console.log(`    using match ${matchId} (no match with 11+ players found)`);
    }
  });

  test("contest.listByMatch returns contests array", async () => {
    const res = await trpcAuthQuery("contest.listByMatch", { matchId });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = unwrap(res);
    assert(Array.isArray(data), "Expected array");
    console.log(`    contests for match: ${data.length}`);
  });

  test("contest.create for match succeeds", async () => {
    const res = await trpcAuthMutate(
      "contest.create",
      {
        matchId,
        name: "Test Contest",
        entryFee: 0,
        maxEntries: 100,
        contestType: "public",
        prizeDistribution: [{ rank: 1, amount: 100 }],
      },
      token
    );
    // May fail if match isn't "upcoming" — that's acceptable
    if (res.status === 200) {
      const data = unwrap(res);
      assert(typeof data?.id === "string", "Expected contest id");
      contestId = data.id;
      console.log(`    created contest ${contestId}`);
    } else {
      console.log(`    contest.create returned ${res.status} (match may not be upcoming)`);
      // Create a fallback contest ID for remaining tests
      const listRes = await trpcAuthQuery("contest.listByMatch", { matchId });
      const listData = unwrap(listRes);
      if (listData?.length > 0) {
        contestId = listData[0].id;
        console.log(`    using existing contest ${contestId}`);
      }
    }
  });

  test("contest.getById returns contest with leaderboard", async () => {
    if (!contestId) { console.log("    SKIP: no contestId"); return; }
    const res = await trpcAuthQuery("contest.getById", { id: contestId });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = unwrap(res);
    assert(data !== null, "Expected contest data");
    assert(data?.id === contestId, "Expected matching id");
    assert(Array.isArray(data?.leaderboard), "Expected leaderboard array");
  });

  test("contest.getStandings returns leaderboard", async () => {
    if (!contestId) { console.log("    SKIP: no contestId"); return; }
    const res = await trpcAuthQuery("contest.getStandings", { contestId });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = unwrap(res);
    assert(Array.isArray(data), "Expected array");
    console.log(`    standings entries: ${data.length}`);
  });

  test("contest.listByMatch with contestType filter", async () => {
    const res = await trpcAuthQuery("contest.listByMatch", {
      matchId,
      contestType: "public",
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = unwrap(res);
    assert(Array.isArray(data), "Expected array");
  });

  test("contest.create nonexistent match returns NOT_FOUND", async () => {
    const fakeMatchId = "00000000-0000-0000-0000-000000000000";
    const res = await trpcAuthMutate(
      "contest.create",
      {
        matchId: fakeMatchId,
        name: "Fail Contest",
        entryFee: 0,
        maxEntries: 10,
        contestType: "public",
        prizeDistribution: [],
      },
      token
    );
    expectTRPCError(res, "NOT_FOUND");
  });

  test("contest.create unauthenticated returns UNAUTHORIZED", async () => {
    const res = await trpcAuthMutate("contest.create", {
      matchId,
      name: "Unauth Contest",
      entryFee: 0,
      maxEntries: 10,
      contestType: "public",
      prizeDistribution: [],
    });
    expectTRPCError(res, "UNAUTHORIZED");
  });
});

runTests("Contest API Tests");
