/**
 * Draft Multi-User API Tests — 2 users testing snake draft flow
 *
 * Tests: startDraft, start, getState, makePick, wrong user pick, duplicate pick, getPicks.
 * Requires Firebase Auth Emulator + API server + seeded data.
 *
 * Run: npx tsx tests/e2e/api/draft-multi.api.test.ts
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

describe("Draft Multi-User API", () => {
  let tokenA: string, tokenB: string;
  let userAId: string, userBId: string;
  let leagueId: string;
  let roomId: string;
  let playerIds: string[] = [];

  test("setup: seed, create 2 users, create league, both join", async () => {
    await clearEmulatorAccounts();
    const userA = await createTestUser("draft-owner@draftplay.test", "TestPass123!");
    const userB = await createTestUser("draft-member@draftplay.test", "TestPass123!");
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
      { name: "Draft Test League", format: "draft", tournament: "IPL 2026", maxMembers: 10 },
      tokenA
    );
    assert(leagueRes.status === 200, `League create failed: ${leagueRes.status}`);
    const league = unwrap(leagueRes);
    leagueId = league.id;

    // userB joins
    const joinRes = await trpcAuthMutate("league.join", { inviteCode: league.inviteCode }, tokenB);
    assert(joinRes.status === 200, `Join failed: ${joinRes.status}`);

    // Fetch player IDs for picks
    const playerRes = await trpcAuthQuery("player.list");
    const players = unwrap(playerRes);
    playerIds = players.slice(0, 20).map((p: any) => p.id);
    assert(playerIds.length >= 2, "Need at least 2 players for draft");
    console.log(`    leagueId=${leagueId}, ${playerIds.length} players available`);
  });

  test("league.startDraft creates room", async () => {
    const res = await trpcAuthMutate(
      "league.startDraft",
      { leagueId, type: "snake_draft" },
      tokenA
    );
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = unwrap(res);
    assert(typeof data?.id === "string", "Expected room id");
    roomId = data.id;
    console.log(`    roomId=${roomId}`);
  });

  test("draft.start transitions to in_progress", async () => {
    const res = await trpcAuthMutate("draft.start", { roomId }, tokenA);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = unwrap(res);
    assert(data?.status === "in_progress", `Expected in_progress, got ${data?.status}`);
    console.log(`    draft started, currentDrafter=${data?.currentDrafter}`);
  });

  test("draft.getState returns currentDrafter and round 1", async () => {
    const res = await trpcAuthQuery("draft.getState", { roomId }, tokenA);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = unwrap(res);
    assert(data?.status === "in_progress", "Expected in_progress");
    assert(data?.currentRound === 1, `Expected round 1, got ${data?.currentRound}`);
    assert(typeof data?.currentDrafter === "string", "Expected currentDrafter");
    assert(Array.isArray(data?.pickOrder), "Expected pickOrder");
  });

  test("current drafter makes a pick", async () => {
    const stateRes = await trpcAuthQuery("draft.getState", { roomId }, tokenA);
    const state = unwrap(stateRes);
    const currentDrafter = state.currentDrafter;
    const drafterToken = currentDrafter === userAId ? tokenA : tokenB;

    const res = await trpcAuthMutate(
      "draft.makePick",
      { roomId, playerId: playerIds[0] },
      drafterToken
    );
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = unwrap(res);
    assert(data?.pickNumber >= 1, "Expected pickNumber");
    console.log(`    pick made: player=${playerIds[0]}, pickNumber=${data.pickNumber}`);
  });

  test("wrong user picks — BAD_REQUEST", async () => {
    const stateRes = await trpcAuthQuery("draft.getState", { roomId }, tokenA);
    const state = unwrap(stateRes);
    const currentDrafter = state.currentDrafter;
    // Use the OTHER token
    const wrongToken = currentDrafter === userAId ? tokenB : tokenA;

    const res = await trpcAuthMutate(
      "draft.makePick",
      { roomId, playerId: playerIds[1] },
      wrongToken
    );
    expectTRPCError(res, "BAD_REQUEST");
  });

  test("pick already-picked player — BAD_REQUEST", async () => {
    const stateRes = await trpcAuthQuery("draft.getState", { roomId }, tokenA);
    const state = unwrap(stateRes);
    const currentDrafter = state.currentDrafter;
    const drafterToken = currentDrafter === userAId ? tokenA : tokenB;

    // Try to pick player that was already picked (playerIds[0])
    const res = await trpcAuthMutate(
      "draft.makePick",
      { roomId, playerId: playerIds[0] },
      drafterToken
    );
    expectTRPCError(res, "BAD_REQUEST");
  });

  test("draft.getPicks returns picks", async () => {
    const res = await trpcAuthQuery("draft.getPicks", { roomId }, tokenA);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = unwrap(res);
    assert(Array.isArray(data), "Expected array");
    assert(data.length >= 1, `Expected at least 1 pick, got ${data.length}`);
    console.log(`    total picks: ${data.length}`);
  });
});

runTests("Draft Multi-User API Tests");
