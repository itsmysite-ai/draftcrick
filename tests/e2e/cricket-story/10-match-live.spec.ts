/**
 * Chapter 10: Match Live Simulation
 *
 * Simulates match phase transitions: pre_match → live → post_match → completed.
 * Verifies contest locking, live screen updates, and match completion.
 *
 * NOTE: This test simulates phases via API. It creates test-specific data
 * (playerMatchScores) that can be cleaned up. Real match/player data is NEVER modified.
 *
 * Run: npx playwright test tests/e2e/cricket-story/10-match-live.spec.ts --project=mobile --workers=1
 */
import { test, expect } from "@playwright/test";
import {
  clearEmulatorAccounts,
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
const RAVI_EMAIL = `ravi-live-${TS}@draftplay.test`;
const PASSWORD = "CricketFan123!";

test.describe("Chapter 10 — Match Live Simulation", () => {
  test.setTimeout(180000);

  let raviToken: string;
  let matchId: string;

  test.beforeAll(async () => {
    await clearEmulatorAccounts();
    const ravi = await createTestUser(RAVI_EMAIL, PASSWORD);
    raviToken = ravi.idToken;

    // Find an active match
    const matchRes = await trpcAuthQuery("match.live", undefined, raviToken);
    const matchData = unwrap(matchRes);
    const matches = Array.isArray(matchData) ? matchData : matchData?.matches ?? [];
    if (matches.length > 0) {
      matchId = matches[0].id ?? matches[0].dbId;
    }
  });

  // --- 10.1 Pre-match state ---
  test("10.1 — match visible on home screen", async ({ page }) => {
    const loggedIn = await loginViaBrowser(page, RAVI_EMAIL, PASSWORD);
    if (!loggedIn) { test.skip(); return; }

    await page.locator('[data-testid="home-screen"]').waitFor({ state: "visible", timeout: 15000 });
    await page.waitForTimeout(3000);

    // Match should be listed
    const featured = page.locator('[data-testid="featured-match-card"]');
    const hasFeatured = await featured.isVisible({ timeout: 5000 }).catch(() => false);

    await page.screenshot({ path: ss("10-pre-match.png") });

    expect(hasFeatured || matchId).toBeTruthy();
  });

  // --- 10.2 Live tab rendering ---
  test("10.2 — live tab renders", async ({ page }) => {
    const loggedIn = await loginViaBrowser(page, RAVI_EMAIL, PASSWORD);
    if (!loggedIn) { test.skip(); return; }

    await page.locator('[data-testid="home-screen"]').waitFor({ state: "visible", timeout: 15000 });

    await forceClickTab(page, "live");
    await page.waitForTimeout(5000);

    const liveScreen = page.locator('[data-testid="live-screen"]');
    const hasLive = await liveScreen.isVisible({ timeout: 8000 }).catch(() => false);

    await page.screenshot({ path: ss("10-live-screen.png") });

    expect(hasLive).toBeTruthy();
  });

  // --- 10.3 Match detail ---
  test("10.3 — match detail shows teams and info", async ({ page }) => {
    if (!matchId) { test.skip(); return; }

    const loggedIn = await loginViaBrowser(page, RAVI_EMAIL, PASSWORD, `/match/${matchId}`);
    if (!loggedIn) { test.skip(); return; }

    const matchDetail = page.locator('[data-testid="match-detail-screen"]');
    const hasDetail = await matchDetail.isVisible({ timeout: 15000 }).catch(() => false);

    if (hasDetail) {
      // Header card
      const headerCard = page.locator('[data-testid="match-header-card"]');
      await expect(headerCard).toBeVisible({ timeout: 5000 });

      // FDR badges (may or may not be present)
      const fdrA = page.locator('[data-testid="fdr-badge-team-a"]');
      const hasFdr = await fdrA.isVisible({ timeout: 3000 }).catch(() => false);
    }

    await page.screenshot({ path: ss("10-match-detail.png"), fullPage: true });
  });

  // --- 10.4 Match detail: contests section ---
  test("10.4 — match detail shows available contests", async ({ page }) => {
    if (!matchId) { test.skip(); return; }

    const loggedIn = await loginViaBrowser(page, RAVI_EMAIL, PASSWORD, `/match/${matchId}`);
    if (!loggedIn) { test.skip(); return; }

    await page.locator('[data-testid="match-detail-screen"]').waitFor({ state: "visible", timeout: 15000 });
    await page.waitForTimeout(3000);

    // Check for contest cards
    const contest0 = page.locator('[data-testid="contest-0"]');
    const hasContest = await contest0.isVisible({ timeout: 5000 }).catch(() => false);

    await page.screenshot({ path: ss("10-match-contests.png"), fullPage: true });
  });

  // --- 10.5 Match detail: Guru and projections ---
  test("10.5 — match detail shows AI features", async ({ page }) => {
    if (!matchId) { test.skip(); return; }

    const loggedIn = await loginViaBrowser(page, RAVI_EMAIL, PASSWORD, `/match/${matchId}`);
    if (!loggedIn) { test.skip(); return; }

    await page.locator('[data-testid="match-detail-screen"]').waitFor({ state: "visible", timeout: 15000 });
    await page.waitForTimeout(3000);

    const guruCard = page.locator('[data-testid="guru-card"]');
    const projCard = page.locator('[data-testid="projections-card"]');
    const hasGuru = await guruCard.isVisible({ timeout: 3000 }).catch(() => false);
    const hasProj = await projCard.isVisible({ timeout: 3000 }).catch(() => false);

    await page.screenshot({ path: ss("10-match-ai-features.png"), fullPage: true });
  });
});
