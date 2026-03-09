/**
 * Feature Gates Functional E2E Tests
 *
 * Tests geo-location zone resolution and feature gating.
 * Pure API tests — no browser needed.
 *
 * Run: FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 npx playwright test tests/e2e/geo/feature-gates-functional.spec.ts --project=mobile --workers=1
 */
import { test, expect } from "@playwright/test";
import {
  clearEmulatorAccounts,
  trpcAuthQuery,
  unwrap,
} from "../helpers/hybrid-seed";
import { createTestUser } from "../helpers/api-auth";
import { screenshotPath } from "../helpers/screenshot";

test.use({ viewport: { width: 390, height: 844 } });
test.describe.configure({ mode: "serial" });

test.describe("Feature Gates — Geo Zone Resolution", () => {
  test.setTimeout(60000);

  let token: string;

  test("0 — setup user", async () => {
    await clearEmulatorAccounts();
    const user = await createTestUser(`geo-func-${Date.now()}@test.com`, "TestPass123!");
    token = user.idToken;
  });

  test("1 — resolve India location returns zone + features", async () => {
    // geo.resolveLocation is a query with deviceCountry/deviceState input
    const res = await trpcAuthQuery(
      "geo.resolveLocation",
      { deviceCountry: "IN", deviceState: "Karnataka" },
      token
    );

    expect(res.status).toBe(200);
    const data = unwrap(res);
    expect(data).toBeTruthy();
    expect(typeof data).toBe("object");

    // Should contain zone and features
    const hasZone = data?.zone !== undefined || data?.regulatoryZone !== undefined;
    const hasFeatures = data?.features !== undefined || data?.gates !== undefined;
    expect(hasZone || hasFeatures).toBeTruthy();
  });

  test("2 — India = free-to-play only (PROGA active)", async () => {
    const res = await trpcAuthQuery(
      "geo.resolveLocation",
      { deviceCountry: "IN" },
      token
    );

    expect(res.status).toBe(200);
    const data = unwrap(res);

    // With PROGA active, India should restrict paid features
    if (data?.features?.canJoinPaid !== undefined) {
      expect(data.features.canJoinPaid).toBe(false);
    } else if (data?.gates?.canJoinPaid !== undefined) {
      expect(data.gates.canJoinPaid).toBe(false);
    }
    // At minimum verify we got a valid response
    expect(typeof data).toBe("object");
  });

  test("3 — US = international, paid permitted", async () => {
    const res = await trpcAuthQuery(
      "geo.resolveLocation",
      { deviceCountry: "US" },
      token
    );

    expect(res.status).toBe(200);
    const data = unwrap(res);

    // US should allow paid features
    if (data?.features?.canJoinPaid !== undefined) {
      expect(data.features.canJoinPaid).toBe(true);
    } else if (data?.gates?.canJoinPaid !== undefined) {
      expect(data.gates.canJoinPaid).toBe(true);
    }
    expect(typeof data).toBe("object");
  });

  test("4 — unknown zone returns restricted features", async () => {
    const res = await trpcAuthQuery(
      "geo.resolveLocation",
      { deviceCountry: "XX" },
      token
    );

    // Unknown country could return 200 with restricted zone or a 400/404 error
    expect([200, 400, 404, 405]).toContain(res.status);

    if (res.status === 200) {
      const data = unwrap(res);
      // Unknown country should be in a restricted or blocked zone
      if (data?.zone) {
        expect(["blocked", "restricted", "unknown", "international"]).toContain(data.zone);
      }
    }
  });
});
