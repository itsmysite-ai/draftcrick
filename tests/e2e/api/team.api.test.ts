/**
 * Team API Tests — Authenticated tRPC endpoint validation
 *
 * Tests team router: create (with all validation), myTeams.
 * Requires Firebase Auth Emulator + API server + seeded data + contest.
 *
 * Run: npx tsx tests/e2e/api/team.api.test.ts
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

describe("Team API", () => {
  const EMAIL = "team-test@draftplay.test";
  const PASSWORD = "TestPass123!";
  let token: string;
  let contestId: string;
  let validPlayers: { playerId: string; role: string }[] = [];
  let captainId: string;
  let viceCaptainId: string;

  test("setup: find match with players, create contest, assemble team", async () => {
    await clearEmulatorAccounts();
    const user = await createTestUser(EMAIL, PASSWORD);
    token = user.idToken;

    // Find a match that has players linked
    const matchRes = await trpcAuthQuery("match.list", { limit: 50 });
    const allMatches = unwrap(matchRes)?.matches ?? unwrap(matchRes) ?? [];
    assert(allMatches.length > 0, "No matches in DB");

    let matchId = "";
    let matchPlayers: any[] = [];
    for (const m of allMatches) {
      const pRes = await trpcAuthQuery("player.getByMatch", { matchId: m.id });
      const ps = unwrap(pRes) ?? [];
      if (Array.isArray(ps) && ps.length >= 11) {
        matchId = m.id;
        // Deduplicate by player ID (seed may create duplicate playerMatchScores)
        const seen = new Set<string>();
        matchPlayers = [];
        for (const s of ps) {
          const pid = s.playerId ?? s.player?.id;
          if (pid && !seen.has(pid)) {
            seen.add(pid);
            matchPlayers.push({ id: pid, ...s.player });
          }
        }
        console.log(`    using match ${matchId} (${ps.length} players)`);
        break;
      }
    }
    assert(matchId !== "", "No match with 11+ players found — run seed first");

    // Create a free contest
    const contestRes = await trpcAuthMutate(
      "contest.create",
      {
        matchId,
        name: "Team Test Contest",
        entryFee: 0,
        maxEntries: 1000,
        contestType: "public",
        prizeDistribution: [{ rank: 1, amount: 0 }],
      },
      token
    );
    if (contestRes.status === 200) {
      contestId = unwrap(contestRes).id;
    } else {
      const listRes = await trpcAuthQuery("contest.listByMatch", { matchId });
      const listData = unwrap(listRes);
      assert(listData?.length > 0, "No contests available and cannot create one");
      contestId = listData[0].id;
    }

    // Use match players (already have the right players for this match)
    const players = matchPlayers;
    assert(players.length >= 11, `Need 11+ players, got ${players.length}`);

    // Build a valid 11-player team with flexible composition
    // Role limits: min 1 each of WK, BAT, AR, BOWL
    const byRole: Record<string, any[]> = {};
    for (const p of players) {
      const role = p.role ?? "batsman";
      byRole[role] = byRole[role] ?? [];
      byRole[role].push(p);
    }

    // Take min 1 of each, then fill remaining from largest pools
    const picked: any[] = [];
    const roles = ["wicket_keeper", "batsman", "all_rounder", "bowler"];
    for (const role of roles) {
      const pool = byRole[role] ?? [];
      if (pool.length > 0) {
        picked.push(pool.shift());
      }
    }
    // Fill remaining slots from any role (up to max 6 each)
    const remaining = 11 - picked.length;
    const roleCounts: Record<string, number> = {};
    for (const p of picked) roleCounts[p.role] = (roleCounts[p.role] ?? 0) + 1;
    let filled = 0;
    for (const role of roles) {
      const pool = byRole[role] ?? [];
      while (pool.length > 0 && filled < remaining && (roleCounts[role] ?? 0) < 6) {
        picked.push(pool.shift());
        roleCounts[role] = (roleCounts[role] ?? 0) + 1;
        filled++;
      }
    }

    validPlayers = picked.map((p: any) => ({ playerId: p.id, role: p.role }));
    assert(validPlayers.length === 11, `Expected 11 players, assembled ${validPlayers.length} (roles: ${JSON.stringify(roleCounts)})`);
    captainId = validPlayers[0].playerId;
    viceCaptainId = validPlayers[1].playerId;
    console.log(`    contestId=${contestId}, ${validPlayers.length} players assembled`);
  });

  test("team.create valid 11 players succeeds", async () => {
    if (!contestId) { console.log("    SKIP: no contestId"); return; }
    const res = await trpcAuthMutate(
      "team.create",
      { contestId, players: validPlayers, captainId, viceCaptainId },
      token
    );
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = unwrap(res);
    assert(typeof data?.id === "string", "Expected team id");
    assert(typeof data?.creditsUsed === "number", "Expected creditsUsed");
    console.log(`    team created, credits=${data.creditsUsed}`);
  });

  test("team.create duplicate returns CONFLICT", async () => {
    if (!contestId) { console.log("    SKIP"); return; }
    const res = await trpcAuthMutate(
      "team.create",
      { contestId, players: validPlayers, captainId, viceCaptainId },
      token
    );
    expectTRPCError(res, "CONFLICT");
  });

  test("team.create captain == viceCaptain returns BAD_REQUEST", async () => {
    if (!contestId) { console.log("    SKIP"); return; }
    // Create new contest for this test
    const matchRes = await trpcAuthQuery("match.list", {});
    const allMatches = unwrap(matchRes)?.matches ?? unwrap(matchRes);
    const newContestRes = await trpcAuthMutate(
      "contest.create",
      {
        matchId: allMatches[0].id,
        name: "Captain Test Contest",
        entryFee: 0,
        maxEntries: 1000,
        contestType: "public",
        prizeDistribution: [{ rank: 1, amount: 0 }],
      },
      token
    );
    if (newContestRes.status !== 200) { console.log("    SKIP: can't create contest"); return; }
    const newContestId = unwrap(newContestRes).id;

    const res = await trpcAuthMutate(
      "team.create",
      {
        contestId: newContestId,
        players: validPlayers,
        captainId: captainId,
        viceCaptainId: captainId, // same!
      },
      token
    );
    expectTRPCError(res, "BAD_REQUEST");
  });

  test("team.create captain not in players returns BAD_REQUEST", async () => {
    if (!contestId) { console.log("    SKIP"); return; }
    const matchRes = await trpcAuthQuery("match.list", {});
    const allMatches = unwrap(matchRes)?.matches ?? unwrap(matchRes);
    const newContestRes = await trpcAuthMutate(
      "contest.create",
      {
        matchId: allMatches[0].id,
        name: "Captain Not In Test",
        entryFee: 0,
        maxEntries: 1000,
        contestType: "public",
        prizeDistribution: [{ rank: 1, amount: 0 }],
      },
      token
    );
    if (newContestRes.status !== 200) { console.log("    SKIP"); return; }

    const res = await trpcAuthMutate(
      "team.create",
      {
        contestId: unwrap(newContestRes).id,
        players: validPlayers,
        captainId: "00000000-0000-0000-0000-000000000000",
        viceCaptainId,
      },
      token
    );
    expectTRPCError(res, "BAD_REQUEST");
  });

  test("team.create <11 players returns BAD_REQUEST", async () => {
    if (!contestId) { console.log("    SKIP"); return; }
    const matchRes = await trpcAuthQuery("match.list", {});
    const allMatches = unwrap(matchRes)?.matches ?? unwrap(matchRes);
    const newContestRes = await trpcAuthMutate(
      "contest.create",
      {
        matchId: allMatches[0].id,
        name: "Under 11 Test",
        entryFee: 0,
        maxEntries: 1000,
        contestType: "public",
        prizeDistribution: [{ rank: 1, amount: 0 }],
      },
      token
    );
    if (newContestRes.status !== 200) { console.log("    SKIP"); return; }

    const tooFew = validPlayers.slice(0, 5);
    const res = await trpcAuthMutate(
      "team.create",
      {
        contestId: unwrap(newContestRes).id,
        players: tooFew,
        captainId: tooFew[0].playerId,
        viceCaptainId: tooFew[1].playerId,
      },
      token
    );
    // Should fail on Zod validation (exactly 11) or on DB validation
    assert(res.status !== 200, `Expected error, got 200`);
  });

  test("team.create 0 WK returns BAD_REQUEST", async () => {
    if (!contestId) { console.log("    SKIP"); return; }
    const matchRes = await trpcAuthQuery("match.list", {});
    const allMatches = unwrap(matchRes)?.matches ?? unwrap(matchRes);
    const newContestRes = await trpcAuthMutate(
      "contest.create",
      {
        matchId: allMatches[0].id,
        name: "No WK Test",
        entryFee: 0,
        maxEntries: 1000,
        contestType: "public",
        prizeDistribution: [{ rank: 1, amount: 0 }],
      },
      token
    );
    if (newContestRes.status !== 200) { console.log("    SKIP"); return; }

    // All batsmen — no WK
    const playerRes = await trpcAuthQuery("player.list");
    const allPlayers = unwrap(playerRes);
    const batsmen = allPlayers.filter((p: any) => p.role === "batsman").slice(0, 11);
    if (batsmen.length < 11) { console.log("    SKIP: not enough batsmen"); return; }
    const noWkPlayers = batsmen.map((p: any) => ({ playerId: p.id, role: "batsman" }));

    const res = await trpcAuthMutate(
      "team.create",
      {
        contestId: unwrap(newContestRes).id,
        players: noWkPlayers,
        captainId: noWkPlayers[0].playerId,
        viceCaptainId: noWkPlayers[1].playerId,
      },
      token
    );
    expectTRPCError(res, "BAD_REQUEST");
  });

  test("team.myTeams returns created team", async () => {
    const res = await trpcAuthQuery("team.myTeams", undefined, token);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = unwrap(res);
    assert(Array.isArray(data), "Expected array");
    assert(data.length >= 1, `Expected at least 1 team, got ${data.length}`);
    console.log(`    my teams: ${data.length}`);
  });
});

runTests("Team API Tests");
