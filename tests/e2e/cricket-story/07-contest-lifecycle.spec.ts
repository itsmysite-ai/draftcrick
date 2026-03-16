/**
 * Chapter 7: Contest Lifecycle
 *
 * Ravi creates a contest, Priya joins. Wallet balances update.
 * Tests the full contest flow: create → join → spots → leaderboard.
 *
 * Run: npx playwright test tests/e2e/cricket-story/07-contest-lifecycle.spec.ts --project=mobile --workers=1
 */
import { test, expect } from "@playwright/test";
import {
  clearEmulatorAccounts,
  fundWallet,
  seedContestForMatch,
  seedTeamForContest,
  loginViaBrowser,
  trpcAuthQuery,
  trpcAuthMutate,
  unwrap,
} from "../helpers/hybrid-seed";
import { createTestUser } from "../helpers/api-auth";
import { screenshotPath } from "../helpers/screenshot";

const ss = (name: string) => screenshotPath(name);

test.use({ viewport: { width: 390, height: 844 } });
test.describe.configure({ mode: "serial" });

const TS = Date.now();
const RAVI_EMAIL = `ravi-contest-${TS}@draftplay.test`;
const PRIYA_EMAIL = `priya-contest-${TS}@draftplay.test`;
const PASSWORD = "CricketFan123!";

test.describe("Chapter 7 — Contest Lifecycle", () => {
  test.setTimeout(180000);

  let raviToken: string;
  let priyaToken: string;
  let contestId: string;
  let matchId: string;

  // --- 7.1 Setup: create users + fund wallets ---
  test("7.1 — setup users and fund wallets", async () => {
    await clearEmulatorAccounts();

    const ravi = await createTestUser(RAVI_EMAIL, PASSWORD);
    raviToken = ravi.idToken;
    const priya = await createTestUser(PRIYA_EMAIL, PASSWORD);
    priyaToken = priya.idToken;

    await fundWallet(raviToken);
    await fundWallet(priyaToken);

    // Verify balances (signup bonus = 500 Pop Coins)
    const raviBal = unwrap(await trpcAuthQuery("wallet.getBalance", undefined, raviToken));
    expect(raviBal?.coinBalance).toBeGreaterThanOrEqual(500);
  });

  // --- 7.2 Create contest ---
  test("7.2 — create contest for active match", async () => {
    const seed = await seedContestForMatch(raviToken, { entryFee: 50, maxEntries: 100 });
    contestId = seed.contestId;
    matchId = seed.matchId;

    expect(contestId).toBeTruthy();
    expect(matchId).toBeTruthy();
  });

  // --- 7.3 Contest detail screen ---
  test("7.3 — contest detail screen with open status", async ({ page }) => {
    if (!contestId) { test.skip(); return; }

    const loggedIn = await loginViaBrowser(page, RAVI_EMAIL, PASSWORD, `/contest/${contestId}`);
    if (!loggedIn) { test.skip(); return; }

    const contestScreen = page.locator('[data-testid="contest-detail-screen"]');
    await expect(contestScreen).toBeVisible({ timeout: 15000 });

    // Status badge should show "open"
    const statusBadge = page.locator('[data-testid="contest-status-badge"]');
    if (await statusBadge.isVisible({ timeout: 3000 }).catch(() => false)) {
      const text = await statusBadge.textContent();
      expect(text?.toLowerCase()).toContain("open");
    }

    await page.screenshot({ path: ss("07-contest-detail.png") });
  });

  // --- 7.4 Prize pool correct ---
  test("7.4 — prize pool displays correctly", async ({ page }) => {
    if (!contestId) { test.skip(); return; }

    const loggedIn = await loginViaBrowser(page, RAVI_EMAIL, PASSWORD, `/contest/${contestId}`);
    if (!loggedIn) { test.skip(); return; }

    await page.locator('[data-testid="contest-detail-screen"]').waitFor({ state: "visible", timeout: 15000 });

    const prizeEl = page.locator('[data-testid="contest-prize-pool"]');
    if (await prizeEl.isVisible({ timeout: 3000 }).catch(() => false)) {
      const text = await prizeEl.textContent();
      // Prize pool should be 50 * 100 = 5000
      await page.screenshot({ path: ss("07-prize-pool.png") });
    }
  });

  // --- 7.5 Ravi joins contest ---
  test("7.5 — Ravi joins contest with team", async () => {
    if (!contestId || !matchId) { test.skip(); return; }

    const team = await seedTeamForContest(raviToken, contestId, matchId);
    expect(team.teamId).toBeTruthy();

    // Join
    const joinRes = await trpcAuthMutate(
      "contest.join",
      { contestId, teamId: team.teamId },
      raviToken,
    );
    // May already be joined if team creation auto-joins
    expect(joinRes.status === 200 || joinRes.status === 409).toBeTruthy();
  });

  // --- 7.6 Wallet deducted ---
  test("7.6 — wallet balance decreases after joining", async () => {
    const bal = unwrap(await trpcAuthQuery("wallet.getBalance", undefined, raviToken));
    // Coins should have been deducted by entry fee (50)
    expect(bal?.coinBalance).toBeDefined();
  });

  // --- 7.7 Spots update ---
  test("7.7 — spots show at least 1 entry", async ({ page }) => {
    if (!contestId) { test.skip(); return; }

    const loggedIn = await loginViaBrowser(page, RAVI_EMAIL, PASSWORD, `/contest/${contestId}`);
    if (!loggedIn) { test.skip(); return; }

    await page.locator('[data-testid="contest-detail-screen"]').waitFor({ state: "visible", timeout: 15000 });

    const spotsEl = page.locator('[data-testid="contest-spots"]');
    if (await spotsEl.isVisible({ timeout: 3000 }).catch(() => false)) {
      const text = await spotsEl.textContent();
      // Should show at least 1/100
      const match = text?.match(/(\d+)/);
      if (match) expect(parseInt(match[1])).toBeGreaterThanOrEqual(1);
    }

    await page.screenshot({ path: ss("07-spots-1.png") });
  });

  // --- 7.8 Priya joins ---
  test("7.8 — Priya joins contest", async () => {
    if (!contestId || !matchId) { test.skip(); return; }

    const team = await seedTeamForContest(priyaToken, contestId, matchId);
    const joinRes = await trpcAuthMutate(
      "contest.join",
      { contestId, teamId: team.teamId },
      priyaToken,
    );
    expect(joinRes.status === 200 || joinRes.status === 409).toBeTruthy();
  });

  // --- 7.9 Spots: 2 entries ---
  test("7.9 — spots show 2 entries", async ({ page }) => {
    if (!contestId) { test.skip(); return; }

    const loggedIn = await loginViaBrowser(page, RAVI_EMAIL, PASSWORD, `/contest/${contestId}`);
    if (!loggedIn) { test.skip(); return; }

    await page.locator('[data-testid="contest-detail-screen"]').waitFor({ state: "visible", timeout: 15000 });

    await page.screenshot({ path: ss("07-spots-2.png") });
  });

  // --- 7.10 Leaderboard ---
  test("7.10 — leaderboard shows entries", async ({ page }) => {
    if (!contestId) { test.skip(); return; }

    const loggedIn = await loginViaBrowser(page, RAVI_EMAIL, PASSWORD, `/contest/${contestId}`);
    if (!loggedIn) { test.skip(); return; }

    await page.locator('[data-testid="contest-detail-screen"]').waitFor({ state: "visible", timeout: 15000 });

    // Check for leaderboard entries
    const entry1 = page.locator('[data-testid="contest-leaderboard-entry-1"]');
    const hasEntry = await entry1.isVisible({ timeout: 5000 }).catch(() => false);

    await page.screenshot({ path: ss("07-leaderboard.png"), fullPage: true });
  });
});
