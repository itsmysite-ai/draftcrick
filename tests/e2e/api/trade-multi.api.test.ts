/**
 * Trade Multi-User API Tests — 2 users testing trade proposals
 *
 * Tests: propose, myTrades, leagueTrades, accept, cancel, reject.
 * Requires Firebase Auth Emulator + API server running.
 *
 * Run: npx tsx tests/e2e/api/trade-multi.api.test.ts
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

describe("Trade Multi-User API", () => {
  let tokenA: string, tokenB: string;
  let userAId: string, userBId: string;
  let leagueId: string;
  let playerIds: string[] = [];
  let tradeId1: string;
  let tradeId2: string;
  let tradeId3: string;

  test("setup: create 2 users, create league, both join, fetch players", async () => {
    await clearEmulatorAccounts();
    const userA = await createTestUser("trade-a@draftplay.test", "TestPass123!");
    const userB = await createTestUser("trade-b@draftplay.test", "TestPass123!");
    tokenA = userA.idToken;
    tokenB = userB.idToken;

    const sessionA = unwrap(await trpcAuthQuery("auth.getSession", undefined, tokenA));
    const sessionB = unwrap(await trpcAuthQuery("auth.getSession", undefined, tokenB));
    userAId = sessionA?.id ?? sessionA?.uid;
    userBId = sessionB?.id ?? sessionB?.uid;

    // Seed data
    // Data already seeded — skip slow seed call

    // Create league with trading enabled
    const leagueRes = await trpcAuthMutate(
      "league.create",
      {
        name: "Trade Test League",
        format: "draft",
        tournament: "IPL 2026",
        maxMembers: 10,
        rules: { transfers: { tradeWindowOpen: true } },
      },
      tokenA
    );
    assert(leagueRes.status === 200, `League create failed: ${leagueRes.status}`);
    const league = unwrap(leagueRes);
    leagueId = league.id;

    // userB joins
    await trpcAuthMutate("league.join", { inviteCode: league.inviteCode }, tokenB);

    // Fetch player IDs
    const playerRes = await trpcAuthQuery("player.list");
    const players = unwrap(playerRes);
    playerIds = players.slice(0, 10).map((p: any) => p.id);
    console.log(`    leagueId=${leagueId}, ${playerIds.length} players`);
  });

  test("userA proposes trade — status pending", async () => {
    const res = await trpcAuthMutate(
      "trade.propose",
      {
        leagueId,
        toUserId: userBId,
        playersOffered: [playerIds[0]],
        playersRequested: [playerIds[1]],
      },
      tokenA
    );
    assert(res.status === 200, `Expected 200, got ${res.status}. Error: ${JSON.stringify(res.data?.error?.json?.message ?? res.data).substring(0, 200)}`);
    const data = unwrap(res);
    assert(data?.status === "pending", `Expected pending, got ${data?.status}`);
    tradeId1 = data.id;
    console.log(`    trade1=${tradeId1}`);
  });

  test("trade.myTrades for userA returns 1 trade", async () => {
    const res = await trpcAuthQuery("trade.myTrades", { leagueId }, tokenA);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = unwrap(res);
    assert(Array.isArray(data), "Expected array");
    assert(data.length >= 1, `Expected at least 1 trade, got ${data.length}`);
  });

  test("trade.myTrades for userB returns 1 trade", async () => {
    const res = await trpcAuthQuery("trade.myTrades", { leagueId }, tokenB);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = unwrap(res);
    assert(Array.isArray(data), "Expected array");
    assert(data.length >= 1, `Expected at least 1 trade, got ${data.length}`);
  });

  test("trade.leagueTrades returns all trades", async () => {
    const res = await trpcAuthQuery("trade.leagueTrades", { leagueId }, tokenA);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = unwrap(res);
    assert(Array.isArray(data), "Expected array");
    assert(data.length >= 1, `Expected at least 1 trade`);
  });

  test("userB accepts trade — status accepted", async () => {
    const res = await trpcAuthMutate("trade.accept", { tradeId: tradeId1 }, tokenB);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = unwrap(res);
    assert(data?.status === "accepted", `Expected accepted, got ${data?.status}`);
  });

  test("userA proposes and cancels — status rejected", async () => {
    // Propose
    const proposeRes = await trpcAuthMutate(
      "trade.propose",
      {
        leagueId,
        toUserId: userBId,
        playersOffered: [playerIds[2]],
        playersRequested: [playerIds[3]],
      },
      tokenA
    );
    assert(proposeRes.status === 200, `Propose failed: ${proposeRes.status}`);
    tradeId2 = unwrap(proposeRes).id;

    // Cancel
    const cancelRes = await trpcAuthMutate("trade.cancel", { tradeId: tradeId2 }, tokenA);
    assert(cancelRes.status === 200, `Cancel failed: ${cancelRes.status}`);
    const data = unwrap(cancelRes);
    assert(data?.status === "rejected", `Expected rejected, got ${data?.status}`);
  });

  test("userA proposes, userB rejects — status rejected", async () => {
    // Propose
    const proposeRes = await trpcAuthMutate(
      "trade.propose",
      {
        leagueId,
        toUserId: userBId,
        playersOffered: [playerIds[4]],
        playersRequested: [playerIds[5]],
      },
      tokenA
    );
    assert(proposeRes.status === 200, `Propose failed: ${proposeRes.status}`);
    tradeId3 = unwrap(proposeRes).id;

    // Reject
    const rejectRes = await trpcAuthMutate("trade.reject", { tradeId: tradeId3 }, tokenB);
    assert(rejectRes.status === 200, `Reject failed: ${rejectRes.status}`);
    const data = unwrap(rejectRes);
    assert(data?.status === "rejected", `Expected rejected, got ${data?.status}`);
  });
});

runTests("Trade Multi-User API Tests");
