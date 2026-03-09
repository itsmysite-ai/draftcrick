/**
 * League Multi-User API Tests — 3 users testing league management
 *
 * Tests: join, double-join, promote, kick, transfer ownership, permission checks.
 * Requires Firebase Auth Emulator + API server running.
 *
 * Run: npx tsx tests/e2e/api/league-multi.api.test.ts
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

describe("League Multi-User API", () => {
  let tokenA: string, tokenB: string, tokenC: string;
  let userAId: string, userBId: string, userCId: string;
  let leagueId: string;
  let inviteCode: string;

  test("setup: create 3 users", async () => {
    await clearEmulatorAccounts();
    const userA = await createTestUser("owner@draftplay.test", "TestPass123!");
    const userB = await createTestUser("member-b@draftplay.test", "TestPass123!");
    const userC = await createTestUser("member-c@draftplay.test", "TestPass123!");
    tokenA = userA.idToken;
    tokenB = userB.idToken;
    tokenC = userC.idToken;

    // Get user IDs from auth.getSession
    const sessionA = unwrap(await trpcAuthQuery("auth.getSession", undefined, tokenA));
    const sessionB = unwrap(await trpcAuthQuery("auth.getSession", undefined, tokenB));
    const sessionC = unwrap(await trpcAuthQuery("auth.getSession", undefined, tokenC));
    userAId = sessionA?.id ?? sessionA?.uid;
    userBId = sessionB?.id ?? sessionB?.uid;
    userCId = sessionC?.id ?? sessionC?.uid;
    assert(userAId && userBId && userCId, "Expected all 3 user IDs");
    console.log(`    userA=${userAId}, userB=${userBId}, userC=${userCId}`);
  });

  test("userA creates league", async () => {
    const res = await trpcAuthMutate(
      "league.create",
      { name: "Multi-User League", format: "draft", tournament: "IPL 2026", maxMembers: 10 },
      tokenA
    );
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = unwrap(res);
    leagueId = data.id;
    inviteCode = data.inviteCode;
    console.log(`    leagueId=${leagueId}`);
  });

  test("userB joins with invite code", async () => {
    const res = await trpcAuthMutate("league.join", { inviteCode }, tokenB);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  test("userC joins with invite code", async () => {
    const res = await trpcAuthMutate("league.join", { inviteCode }, tokenC);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  test("userA gets members — expects 3", async () => {
    const res = await trpcAuthQuery("league.getMembers", { leagueId }, tokenA);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = unwrap(res);
    assert(data.length === 3, `Expected 3 members, got ${data.length}`);
  });

  test("userB joins again — CONFLICT", async () => {
    const res = await trpcAuthMutate("league.join", { inviteCode }, tokenB);
    expectTRPCError(res, "CONFLICT");
  });

  test("userA promotes userB to admin", async () => {
    const res = await trpcAuthMutate(
      "league.promoteMember",
      { leagueId, userId: userBId, role: "admin" },
      tokenA
    );
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  test("userA kicks userC", async () => {
    const res = await trpcAuthMutate(
      "league.kickMember",
      { leagueId, userId: userCId },
      tokenA
    );
    assert(res.status === 200, `Expected 200, got ${res.status}`);

    // Verify only 2 members
    const members = unwrap(await trpcAuthQuery("league.getMembers", { leagueId }, tokenA));
    assert(members.length === 2, `Expected 2 members, got ${members.length}`);
  });

  test("userB (admin) cannot regenerateInviteCode — FORBIDDEN", async () => {
    const res = await trpcAuthMutate("league.regenerateInviteCode", { leagueId }, tokenB);
    expectTRPCError(res, "FORBIDDEN");
  });

  test("userA transfers ownership to userB", async () => {
    const res = await trpcAuthMutate(
      "league.transferOwnership",
      { leagueId, newOwnerId: userBId },
      tokenA
    );
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  test("userA (now admin) cannot kick — FORBIDDEN", async () => {
    // userA is now admin (from transfer), userB is owner
    // userA tries to kick userB (owner) — should fail
    const res = await trpcAuthMutate(
      "league.kickMember",
      { leagueId, userId: userBId },
      tokenA
    );
    // Either FORBIDDEN (can't kick) or BAD_REQUEST (can't kick owner)
    assert(res.status !== 200, `Expected error, got 200`);
  });
});

runTests("League Multi-User API Tests");
