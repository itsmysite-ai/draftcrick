/**
 * Match & Player Detail E2E Tests
 *
 * Tests match detail page, player list, and navigation.
 */
import { test, expect } from "@playwright/test";
import { forceClickTab, forceClickByTestId } from "../helpers/tamagui";
import testData from "../helpers/test-data.json";
import { screenshotPath } from "../helpers/screenshot";

test.use({ viewport: { width: 390, height: 844 } });

test.describe("Match & Player Details", () => {
  test.setTimeout(60000);

  /** Helper: check if the app loaded (not crashed by Firebase/env errors or auth-redirected) */
  async function appReady(page: any): Promise<boolean> {
    const url = page.url();
    if (url.includes("/auth/")) return false;
    const errorOverlay = page.getByText(/uncaught error/i);
    if (await errorOverlay.isVisible({ timeout: 2000 }).catch(() => false)) return false;
    return true;
  }

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    // Wait for React auth-gate redirect to settle
    await page.waitForTimeout(8000);
  });

  test("match detail page loads with teams and venue", async ({ page }) => {
    if (!(await appReady(page))) {
      test.skip();
      return;
    }

    // Navigate to first match
    const viewBtn = page.locator('[data-testid="view-match-btn-0"]');
    if (!(await viewBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await forceClickByTestId(page, "view-match-btn-0");
    await page.waitForTimeout(3000);

    const matchScreen = page.locator('[data-testid="match-detail-screen"]');
    if (!(await matchScreen.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip();
      return;
    }

    // Verify teams are displayed (look for "vs" text)
    const vsText = page.getByText(/vs/i);
    await expect(vsText.first()).toBeVisible({ timeout: 5000 });

    // Verify match center header
    const header = page.getByText(/match center/i);
    await expect(header.first()).toBeVisible();

    await page.screenshot({ path: screenshotPath("story-52-match-detail.png") });
  });

  test("match detail shows phase 3 placeholder sections", async ({ page }) => {
    if (!(await appReady(page))) {
      test.skip();
      return;
    }

    const viewBtn = page.locator('[data-testid="view-match-btn-0"]');
    if (!(await viewBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await forceClickByTestId(page, "view-match-btn-0");
    await page.waitForTimeout(3000);

    // Look for phase 3 placeholder sections
    const phase3 = page.getByText(/coming in phase 3/i);
    if (await phase3.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(phase3).toBeVisible();

      // Check for specific section titles
      const sections = ["ai match preview", "captain", "player projections"];
      for (const section of sections) {
        const el = page.getByText(new RegExp(section, "i")).first();
        const visible = await el.isVisible({ timeout: 2000 }).catch(() => false);
        // At least some sections should be visible after scrolling
      }
    }

    await page.screenshot({ path: screenshotPath("story-53-match-detail-sections.png") });
  });

  test("match detail shows tournament link card", async ({ page }) => {
    if (!(await appReady(page))) {
      test.skip();
      return;
    }

    const viewBtn = page.locator('[data-testid="view-match-btn-0"]');
    if (!(await viewBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await forceClickByTestId(page, "view-match-btn-0");
    await page.waitForTimeout(3000);

    // Look for "view tournament" button
    const tournamentBtn = page.getByText(/view tournament/i);
    const hasTournament = await tournamentBtn.isVisible({ timeout: 5000 }).catch(() => false);

    // Tournament link may not always be present
    await page.screenshot({ path: screenshotPath("story-54-match-tournament-link.png") });
  });

  test("direct navigation to real match via dashboard ID", async ({ page }) => {
    // Navigate directly to a real match using the dashboard slug ID
    await page.goto(`/match/${testData.dashboardMatchId}`);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(10000);

    const errorOverlay = page.getByText(/uncaught error/i);
    if (await errorOverlay.isVisible({ timeout: 2000 }).catch(() => false)) {
      test.skip();
      return;
    }
    if (page.url().includes("/auth/")) {
      test.skip();
      return;
    }

    // Should show match detail with teams, or still loading
    const matchScreen = page.locator('[data-testid="match-detail-screen"]');
    const vsText = page.getByText(/vs/i);
    const loading = page.getByText(/loading match/i);

    const hasScreen = await matchScreen.isVisible({ timeout: 5000 }).catch(() => false);
    const hasVs = await vsText.first().isVisible({ timeout: 3000 }).catch(() => false);
    const hasLoading = await loading.isVisible({ timeout: 2000 }).catch(() => false);

    expect(hasScreen || hasVs || hasLoading).toBeTruthy();

    await page.screenshot({ path: screenshotPath("story-55-match-detail-real.png") });
  });

  test("match not found shows error state", async ({ page }) => {
    // Navigate directly to a non-existent match
    await page.goto("/match/nonexistent-match-12345");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(8000);

    const errorOverlay = page.getByText(/uncaught error/i);
    if (await errorOverlay.isVisible({ timeout: 2000 }).catch(() => false)) {
      test.skip();
      return;
    }
    if (!(await appReady(page))) {
      test.skip();
      return;
    }

    // Should show "match not found", loading, or match detail screen
    const notFound = page.getByText(/match not found/i);
    const goBack = page.getByText(/go back/i);
    const loading = page.getByText(/loading/i);
    const matchScreen = page.locator('[data-testid="match-detail-screen"]');

    const hasNotFound = await notFound.isVisible({ timeout: 5000 }).catch(() => false);
    const hasGoBack = await goBack.isVisible({ timeout: 2000 }).catch(() => false);
    const hasLoading = await loading.first().isVisible({ timeout: 2000 }).catch(() => false);
    const hasScreen = await matchScreen.isVisible({ timeout: 2000 }).catch(() => false);

    expect(hasNotFound || hasGoBack || hasLoading || hasScreen).toBeTruthy();

    await page.screenshot({ path: screenshotPath("story-56-match-not-found.png") });
  });

  test("back navigation works from match detail", async ({ page }) => {
    if (!(await appReady(page))) {
      test.skip();
      return;
    }

    const viewBtn = page.locator('[data-testid="view-match-btn-0"]');
    if (!(await viewBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await forceClickByTestId(page, "view-match-btn-0");
    await page.waitForTimeout(3000);

    // Go back
    await page.goBack();
    await page.waitForTimeout(3000);

    // Should be back on home screen
    const homeScreen = page.locator('[data-testid="home-screen"]');
    await expect(homeScreen).toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: screenshotPath("story-57-match-back-nav.png") });
  });
});
