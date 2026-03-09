/**
 * Geo API Tests — Authenticated tRPC endpoint validation
 *
 * Tests geo router: resolveLocation, updateDeclaration, verifyForPaidAction.
 * Requires Firebase Auth Emulator + API server running.
 *
 * Run: npx tsx tests/e2e/api/geo.api.test.ts
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

describe("Geo API", () => {
  const EMAIL = "geo-test@draftplay.test";
  const PASSWORD = "TestPass123!";
  let token: string;

  test("geo.resolveLocation returns zone and features", async () => {
    await clearEmulatorAccounts();
    const user = await createTestUser(EMAIL, PASSWORD);
    token = user.idToken;

    const res = await trpcAuthQuery("geo.resolveLocation", {}, token);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = unwrap(res);
    assert(data?.resolution !== undefined, "Expected resolution object");
    assert(data?.features !== undefined, "Expected features object");
    assert(typeof data.resolution.zone === "string", "Expected zone string");
  });

  test("geo.resolveLocation with GPS includes device data", async () => {
    const res = await trpcAuthQuery(
      "geo.resolveLocation",
      { latitude: 28.6139, longitude: 77.209, accuracy: 50, deviceCountry: "IN" },
      token
    );
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = unwrap(res);
    assert(data?.resolution !== undefined, "Expected resolution");
    console.log(`    zone=${data.resolution.zone}, confidence=${data.resolution.confidence}`);
  });

  test("geo.updateDeclaration country=IN succeeds", async () => {
    const res = await trpcAuthMutate("geo.updateDeclaration", { country: "IN" }, token);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = unwrap(res);
    assert(data?.success === true, "Expected success");
  });

  test("geo.verifyForPaidAction depends on zone", async () => {
    const res = await trpcAuthMutate(
      "geo.verifyForPaidAction",
      { latitude: 28.6139, longitude: 77.209, accuracy: 50 },
      token
    );
    // May return 200 (allowed), 403 (forbidden zone), or 412 (low confidence)
    assert(
      res.status === 200 || res.status === 403 || res.status === 412,
      `Expected 200/403/412, got ${res.status}`
    );
    if (res.status === 200) {
      const data = unwrap(res);
      assert(data?.allowed === true, "Expected allowed=true");
    }
    console.log(`    verifyForPaidAction status: ${res.status}`);
  });

  test("geo.resolveLocation unauthenticated returns UNAUTHORIZED", async () => {
    const res = await trpcAuthQuery("geo.resolveLocation", {});
    expectTRPCError(res, "UNAUTHORIZED");
  });
});

runTests("Geo API Tests");
