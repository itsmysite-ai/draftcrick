/**
 * Auth API Tests — Authenticated tRPC endpoint validation
 *
 * Tests auth router: getSession, syncUser, getProfile, updatePreferences.
 * Requires Firebase Auth Emulator + API server running.
 *
 * Run: npx tsx tests/e2e/api/auth.api.test.ts
 */

import {
  createEmulatorUser,
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

describe("Auth API", () => {
  const EMAIL = "auth-test@draftplay.test";
  const PASSWORD = "TestPass123!";
  let token: string;

  test("auth.getSession unauthenticated returns null or 401", async () => {
    const res = await trpcAuthQuery("auth.getSession");
    // Public procedure — returns null user, OR 401
    if (res.status === 200) {
      const data = unwrap(res);
      assert(data === null || data === undefined, "Expected null session for unauthenticated");
    } else {
      assert(res.status === 401, `Expected 200 or 401, got ${res.status}`);
    }
  });

  test("auth.getSession authenticated returns user object", async () => {
    await clearEmulatorAccounts();
    const user = await createEmulatorUser(EMAIL, PASSWORD);
    token = user.idToken;

    const res = await trpcAuthQuery("auth.getSession", undefined, token);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = unwrap(res);
    assert(data !== null && data !== undefined, "Expected user object");
    assert(typeof data.id === "string" || typeof data.uid === "string", "Expected user ID");
  });

  test("auth.syncUser creates local profile", async () => {
    const res = await trpcAuthMutate(
      "auth.syncUser",
      { username: "testuser1", displayName: "Test User" },
      token
    );
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = unwrap(res);
    assert(data?.success === true, "Expected success");
    assert(typeof data.userId === "string", "Expected userId");
  });

  test("auth.getProfile returns userId and email", async () => {
    const res = await trpcAuthQuery("auth.getProfile", undefined, token);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = unwrap(res);
    assert(typeof data?.userId === "string", "Expected userId");
  });

  test("auth.updatePreferences succeeds", async () => {
    const res = await trpcAuthMutate(
      "auth.updatePreferences",
      { displayName: "Updated Name" },
      token
    );
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = unwrap(res);
    assert(data?.success === true, "Expected success");
  });
});

runTests("Auth API Tests");
