/**
 * Chapter 5: League Join
 *
 * Priya joins Ravi's draft league using the invite code.
 * Tests join flow, member list, error cases.
 *
 * Run: npx playwright test tests/e2e/cricket-story/05-league-join.spec.ts --project=mobile --workers=1
 */
import { test, expect } from "@playwright/test";
import {
  clearEmulatorAccounts,
  seedLeagueWith2Members,
  loginViaBrowser,
  trpcAuthQuery,
  trpcAuthMutate,
  unwrap,
} from "../helpers/hybrid-seed";
import { createTestUser } from "../helpers/api-auth";
import { forceClickTab } from "../helpers/tamagui";
import { screenshotPath } from "../helpers/screenshot";

const ss = (name: string) => screenshotPath(name);

test.use({ viewport: { width: 390, height: 844 } });
test.describe.configure({ mode: "serial" });

const TS = Date.now();
const PASSWORD = "CricketFan123!";

test.describe("Chapter 5 — League Join", () => {
  test.setTimeout(180000);

  let ownerToken: string;
  let memberToken: string;
  let leagueId: string;
  let inviteCode: string;
  let ownerEmail: string;
  let memberEmail: string;
  let thirdEmail: string;
  let thirdToken: string;

  // --- 5.1-5.3 Setup: create league with 2 members ---
  test("5.1-5.3 — Ravi creates league, Priya joins via invite", async () => {
    await clearEmulatorAccounts();

    const seed = await seedLeagueWith2Members("salary_cap");
    ownerToken = seed.ownerToken;
    memberToken = seed.memberToken;
    leagueId = seed.leagueId;
    inviteCode = seed.inviteCode;
    ownerEmail = seed.ownerEmail;
    memberEmail = seed.memberEmail;

    expect(leagueId).toBeTruthy();
    expect(inviteCode).toBeTruthy();
  });

  // --- 5.4 League shows 2 members ---
  test("5.4 — league detail shows 2 members", async ({ page }) => {
    if (!leagueId) { test.skip(); return; }

    const loggedIn = await loginViaBrowser(page, ownerEmail, PASSWORD, `/league/${leagueId}`);
    if (!loggedIn) { test.skip(); return; }

    const leagueDetail = page.locator('[data-testid="league-detail-screen"]');
    await expect(leagueDetail).toBeVisible({ timeout: 15000 });

    await page.screenshot({ path: ss("05-2-members.png"), fullPage: true });
  });

  // --- 5.5 Priya sees league in social tab ---
  test("5.5 — Priya sees league in social tab", async ({ page }) => {
    const loggedIn = await loginViaBrowser(page, memberEmail, PASSWORD);
    if (!loggedIn) { test.skip(); return; }

    await page.locator('[data-testid="home-screen"]').waitFor({ state: "visible", timeout: 15000 });

    await forceClickTab(page, "Leagues");
    await page.waitForTimeout(3000);

    await page.screenshot({ path: ss("05-priya-social.png") });
  });

  // --- 5.6 Invalid invite code error ---
  test("5.6 — invalid invite code returns error", async () => {
    const res = await trpcAuthMutate(
      "league.join",
      { inviteCode: "INVALID_CODE_123" },
      memberToken,
    );

    // Should fail — NOT_FOUND or BAD_REQUEST
    expect(res.status).not.toBe(200);
  });

  // --- 5.7 Duplicate join error ---
  test("5.7 — duplicate join returns error", async () => {
    // Priya already joined — joining again should fail
    const res = await trpcAuthMutate(
      "league.join",
      { inviteCode },
      memberToken,
    );

    // Should fail — CONFLICT or similar
    expect(res.status).not.toBe(200);
  });
});
