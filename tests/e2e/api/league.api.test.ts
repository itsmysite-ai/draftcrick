/**
 * League API Tests — Single-user authenticated tRPC endpoint validation
 *
 * Tests league router: create, join, myLeagues, getById, getMembers,
 * updateSettings, regenerateInviteCode, leave, startDraft.
 * Requires Firebase Auth Emulator + API server running.
 *
 * Run: npx tsx tests/e2e/api/league.api.test.ts
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

describe("League API", () => {
  const EMAIL = "league-test@draftplay.test";
  const PASSWORD = "TestPass123!";
  let token: string;
  let leagueId: string;
  let inviteCode: string;

  test("league.create salary_cap returns league with inviteCode", async () => {
    await clearEmulatorAccounts();
    const user = await createTestUser(EMAIL, PASSWORD);
    token = user.idToken;

    const res = await trpcAuthMutate(
      "league.create",
      {
        name: "Test League SC",
        format: "salary_cap",
        tournament: "IPL 2026",
        maxMembers: 10,
      },
      token
    );
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = unwrap(res);
    assert(typeof data?.id === "string", "Expected league id");
    assert(typeof data?.inviteCode === "string", "Expected inviteCode");
    assert(data?.format === "salary_cap", `Expected salary_cap, got ${data?.format}`);
    leagueId = data.id;
    inviteCode = data.inviteCode;
    console.log(`    leagueId=${leagueId}, inviteCode=${inviteCode}`);
  });

  test("league.myLeagues returns created league", async () => {
    const res = await trpcAuthQuery("league.myLeagues", undefined, token);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = unwrap(res);
    assert(Array.isArray(data), "Expected array");
    assert(data.length >= 1, "Expected at least 1 league");
    const found = data.some(
      (m: any) => m.leagueId === leagueId || m.league?.id === leagueId
    );
    assert(found, "Expected to find created league");
  });

  test("league.getById returns league with owner", async () => {
    const res = await trpcAuthQuery("league.getById", { id: leagueId });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = unwrap(res);
    assert(data !== null, "Expected league data");
    assert(data?.id === leagueId, "Expected matching id");
    assert(data?.name === "Test League SC", `Expected name, got ${data?.name}`);
  });

  test("league.getMembers returns 1 member (owner)", async () => {
    const res = await trpcAuthQuery("league.getMembers", { leagueId }, token);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = unwrap(res);
    assert(Array.isArray(data), "Expected array");
    assert(data.length === 1, `Expected 1 member, got ${data.length}`);
    assert(data[0].role === "owner", `Expected owner role, got ${data[0].role}`);
  });

  test("league.updateSettings owner updates name", async () => {
    const res = await trpcAuthMutate(
      "league.updateSettings",
      { leagueId, name: "Updated League Name" },
      token
    );
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = unwrap(res);
    assert(data?.name === "Updated League Name", `Expected updated name, got ${data?.name}`);
  });

  test("league.regenerateInviteCode returns new code", async () => {
    const res = await trpcAuthMutate("league.regenerateInviteCode", { leagueId }, token);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = unwrap(res);
    assert(typeof data?.inviteCode === "string", "Expected new invite code");
    assert(data.inviteCode !== inviteCode, "Expected different code");
    inviteCode = data.inviteCode;
    console.log(`    new inviteCode=${inviteCode}`);
  });

  test("league.create unauthenticated returns UNAUTHORIZED", async () => {
    const res = await trpcAuthMutate("league.create", {
      name: "Unauth League",
      format: "salary_cap",
      tournament: "IPL 2026",
    });
    expectTRPCError(res, "UNAUTHORIZED");
  });

  test("league.join invalid code returns NOT_FOUND", async () => {
    const res = await trpcAuthMutate("league.join", { inviteCode: "invalid-code-xyz" }, token);
    expectTRPCError(res, "NOT_FOUND");
  });

  test("league.leave as owner returns BAD_REQUEST", async () => {
    const res = await trpcAuthMutate("league.leave", { leagueId }, token);
    expectTRPCError(res, "BAD_REQUEST");
  });

  test("league.startDraft with 1 member returns BAD_REQUEST", async () => {
    const res = await trpcAuthMutate(
      "league.startDraft",
      { leagueId, type: "snake_draft" },
      token
    );
    expectTRPCError(res, "BAD_REQUEST");
  });

  test("league.getById nonexistent returns null", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await trpcAuthQuery("league.getById", { id: fakeId });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = unwrap(res);
    assert(data === null, `Expected null, got ${JSON.stringify(data)}`);
  });

  test("league.create all 4 formats work", async () => {
    const formats = ["salary_cap", "draft", "auction", "prediction"] as const;
    for (const format of formats) {
      const res = await trpcAuthMutate(
        "league.create",
        { name: `Test ${format}`, format, tournament: "IPL 2026" },
        token
      );
      assert(res.status === 200, `Failed to create ${format} league: ${res.status}`);
      const data = unwrap(res);
      assert(data?.format === format, `Expected ${format}, got ${data?.format}`);
    }
    console.log("    all 4 formats created successfully");
  });
});

runTests("League API Tests");
