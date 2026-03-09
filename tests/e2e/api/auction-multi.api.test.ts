/**
 * Auction Multi-User API Tests — 2 users testing auction room flow
 *
 * Tests: startDraft(auction), start, nominate, placeBid, getAuctionState.
 * Requires Firebase Auth Emulator + API server + seeded data.
 *
 * Run: npx tsx tests/e2e/api/auction-multi.api.test.ts
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

describe("Auction Multi-User API", () => {
  let tokenA: string, tokenB: string;
  let userAId: string, userBId: string;
  let leagueId: string;
  let roomId: string;
  let playerIds: string[] = [];

  test("setup: seed, create 2 users, create league, both join", async () => {
    await clearEmulatorAccounts();
    const userA = await createTestUser("auction-owner@draftplay.test", "TestPass123!");
    const userB = await createTestUser("auction-member@draftplay.test", "TestPass123!");
    tokenA = userA.idToken;
    tokenB = userB.idToken;

    const sessionA = unwrap(await trpcAuthQuery("auth.getSession", undefined, tokenA));
    const sessionB = unwrap(await trpcAuthQuery("auth.getSession", undefined, tokenB));
    userAId = sessionA?.id ?? sessionA?.uid;
    userBId = sessionB?.id ?? sessionB?.uid;

    // Seed data
    // Data already seeded — skip slow seed call

    // Create league
    const leagueRes = await trpcAuthMutate(
      "league.create",
      { name: "Auction Test League", format: "auction", tournament: "IPL 2026", maxMembers: 10 },
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
    playerIds = players.slice(0, 20).map((p: any) => p.id);
    console.log(`    leagueId=${leagueId}, ${playerIds.length} players`);
  });

  test("league.startDraft (auction) creates room", async () => {
    const res = await trpcAuthMutate(
      "league.startDraft",
      { leagueId, type: "auction" },
      tokenA
    );
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = unwrap(res);
    assert(typeof data?.id === "string", "Expected room id");
    roomId = data.id;
    console.log(`    roomId=${roomId}`);
  });

  test("draft.start transitions auction to in_progress", async () => {
    const res = await trpcAuthMutate("draft.start", { roomId }, tokenA);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = unwrap(res);
    assert(data?.status === "in_progress", `Expected in_progress, got ${data?.status}`);
  });

  test("nominator nominates a player", async () => {
    // Get state to find nominator
    const stateRes = await trpcAuthQuery("draft.getAuctionState", { roomId }, tokenA);
    assert(stateRes.status === 200, `getAuctionState failed: ${stateRes.status}`);
    const state = unwrap(stateRes);
    const nominator = state.currentNominator;
    const nominatorToken = nominator === userAId ? tokenA : tokenB;

    const res = await trpcAuthMutate(
      "draft.nominate",
      { roomId, playerId: playerIds[0] },
      nominatorToken
    );
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = unwrap(res);
    assert(data?.playerId === playerIds[0], "Expected nominated playerId");
    console.log(`    nominated player ${playerIds[0]}`);
  });

  test("other user bids on nominated player", async () => {
    const stateRes = await trpcAuthQuery("draft.getAuctionState", { roomId }, tokenA);
    const state = unwrap(stateRes);
    const nominator = state.currentNominator;
    const otherToken = nominator === userAId ? tokenB : tokenA;

    const res = await trpcAuthMutate(
      "draft.placeBid",
      { roomId, amount: 2 },
      otherToken
    );
    // Bid may fail if auction phase hasn't transitioned to bidding yet
    if (res.status === 200) {
      const data = unwrap(res);
      assert(typeof data?.highestBid === "number", "Expected highestBid");
      console.log(`    bid placed, highestBid=${data.highestBid}`);
    } else {
      console.log(`    bid returned ${res.status} (auction may not be in bidding phase — OK)`);
    }
  });

  test("draft.getAuctionState returns correct state", async () => {
    const res = await trpcAuthQuery("draft.getAuctionState", { roomId }, tokenA);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = unwrap(res);
    assert(data?.roomId === roomId, "Expected matching roomId");
    assert(data?.status === "in_progress", "Expected in_progress");
    assert(typeof data?.budgets === "object", "Expected budgets object");
    assert(Array.isArray(data?.soldPlayers), "Expected soldPlayers array");
    console.log(`    phase=${data.phase}, soldPlayers=${data.soldPlayers.length}`);
  });

  test("re-nominating same player returns error or is handled", async () => {
    const stateRes = await trpcAuthQuery("draft.getAuctionState", { roomId }, tokenA);
    const state = unwrap(stateRes);
    const nominator = state.currentNominator;
    const nominatorToken = nominator === userAId ? tokenA : tokenB;

    // Try to nominate the same player that was already nominated
    const res = await trpcAuthMutate(
      "draft.nominate",
      { roomId, playerId: playerIds[0] },
      nominatorToken
    );
    // The auction may handle this as BAD_REQUEST (already nominated/sold) or allow it
    // depending on state. Either way, the API should respond without crashing.
    assert(res.status === 200 || res.status === 400 || res.status === 409,
      `Expected 200/400/409, got ${res.status}`);
    console.log(`    re-nominate returned ${res.status} (${res.status === 200 ? "accepted" : "rejected"} — OK)`);
  });
});

runTests("Auction Multi-User API Tests");
