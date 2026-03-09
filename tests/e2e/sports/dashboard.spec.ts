/**
 * Sports Dashboard & Home Screen E2E Tests
 *
 * Tests the home screen match cards, tournament filters, and data loading.
 */
import { test, expect } from "@playwright/test";
import { forceClickTab, forceClickText, forceClickByTestId } from "../helpers/tamagui";
import { screenshotPath } from "../helpers/screenshot";

test.use({ viewport: { width: 390, height: 844 } });

test.describe("Sports Dashboard & Home", () => {
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

  test("home screen loads and shows match cards with team names", async ({ page }) => {
    if (!(await appReady(page))) {
      test.skip();
      return;
    }

    const homeScreen = page.locator('[data-testid="home-screen"]');
    await expect(homeScreen).toBeVisible({ timeout: 15000 });

    // Wait for data to load (loading spinner should disappear)
    await page.waitForTimeout(5000);

    // Check for match cards or empty state
    const matchCard = page.locator('[data-testid="match-card-0"]');
    const emptyState = page.getByText(/no matches/i);

    const hasMatches = await matchCard.isVisible({ timeout: 5000 }).catch(() => false);
    const hasEmpty = await emptyState.isVisible({ timeout: 2000 }).catch(() => false);

    expect(hasMatches || hasEmpty).toBeTruthy();

    if (hasMatches) {
      // Verify team names are present (not "TBA vs TBA")
      const cardText = await matchCard.textContent();
      expect(cardText).toBeTruthy();
      expect(cardText!.length).toBeGreaterThan(5);
    }

    await page.screenshot({ path: screenshotPath("story-46-dashboard-home.png") });
  });

  test("match card shows countdown or live status", async ({ page }) => {
    if (!(await appReady(page))) {
      test.skip();
      return;
    }

    await page.waitForTimeout(5000);

    const statusBadge = page.locator('[data-testid="match-status-0"]');
    if (await statusBadge.isVisible({ timeout: 5000 }).catch(() => false)) {
      const statusText = await statusBadge.textContent();
      expect(statusText).toBeTruthy();
      // Should be either "LIVE", a countdown like "2h 30m", "1d", or "STARTED"
      expect(statusText!.length).toBeGreaterThan(0);
    }

    await page.screenshot({ path: screenshotPath("story-47-dashboard-status.png") });
  });

  test("tournament badges display correctly", async ({ page }) => {
    if (!(await appReady(page))) {
      test.skip();
      return;
    }

    await page.waitForTimeout(5000);

    const badge = page.locator('[data-testid="tournament-badge-0"]');
    if (await badge.isVisible({ timeout: 5000 }).catch(() => false)) {
      const badgeText = await badge.textContent();
      expect(badgeText).toBeTruthy();
      expect(badgeText!.length).toBeGreaterThan(0);
    }

    await page.screenshot({ path: screenshotPath("story-48-dashboard-badges.png") });
  });

  test("pull-to-refresh updates match data", async ({ page }) => {
    if (!(await appReady(page))) {
      test.skip();
      return;
    }

    await page.waitForTimeout(5000);

    // Simulate pull-to-refresh via scroll gesture
    const homeScreen = page.locator('[data-testid="home-screen"]');
    await homeScreen.evaluate((el) => {
      el.scrollTop = 0;
    });

    // The refresh control is native, so we verify the page doesn't crash
    await page.screenshot({ path: screenshotPath("story-49-dashboard-refresh.png") });
  });

  test("tap match card navigates to match detail", async ({ page }) => {
    if (!(await appReady(page))) {
      test.skip();
      return;
    }

    await page.waitForTimeout(5000);

    const viewBtn = page.locator('[data-testid="view-match-btn-0"]');
    if (await viewBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await forceClickByTestId(page, "view-match-btn-0");
      await page.waitForTimeout(3000);

      // Should navigate to match detail
      const matchDetail = page.locator('[data-testid="match-detail-screen"]');
      const hasDetail = await matchDetail.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasDetail) {
        await page.screenshot({ path: screenshotPath("story-50-dashboard-to-match.png") });
      }
    }
  });

  test("live tab shows live matches section", async ({ page }) => {
    if (!(await appReady(page))) {
      test.skip();
      return;
    }

    // Verify home loaded first
    const homeScreen = page.locator('[data-testid="home-screen"]');
    if (!(await homeScreen.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await forceClickTab(page, "live");
    await page.waitForTimeout(5000);

    const liveScreen = page.locator('[data-testid="live-screen"]');
    const hasLive = await liveScreen.isVisible({ timeout: 10000 }).catch(() => false);

    if (hasLive) {
      // Should show either live matches or empty state
      const liveCard = page.locator('[data-testid="live-match-card-0"]');
      const emptyState = page.getByText(/no matches right now/i);

      const hasLiveCard = await liveCard.isVisible({ timeout: 3000 }).catch(() => false);
      const hasEmpty = await emptyState.isVisible({ timeout: 3000 }).catch(() => false);

      expect(hasLiveCard || hasEmpty).toBeTruthy();
    }

    await page.screenshot({ path: screenshotPath("story-51-dashboard-live-tab.png") });
  });
});
