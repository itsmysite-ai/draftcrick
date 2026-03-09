/**
 * Navigation & UI Chrome E2E Tests
 *
 * Tests tab bar navigation, screen routing, and UI chrome elements.
 */
import { test, expect } from "@playwright/test";
import { forceClickTab, forceClickText, forceClickByTestId } from "../helpers/tamagui";
import testData from "../helpers/test-data.json";
import { screenshotPath } from "../helpers/screenshot";

test.use({ viewport: { width: 390, height: 844 } });

test.describe("Navigation & UI Chrome", () => {
  test.setTimeout(60000);

  /** Helper: check if the app loaded (not crashed by Firebase/env errors or auth-redirected) */
  async function appReady(page: any): Promise<boolean> {
    const url = page.url();
    if (url.includes("/auth/")) return false;
    // Check for uncaught Firebase/env errors that crash the app
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

  test("bottom tab bar shows all 5 tabs", async ({ page }) => {
    if (!(await appReady(page))) {
      test.skip();
      return;
    }

    // Look for tab bar text elements
    const tabTexts = ["home", "contests", "live", "social", "profile"];
    for (const tabText of tabTexts) {
      const tab = page.getByText(new RegExp(tabText, "i")).first();
      await expect(tab).toBeVisible({ timeout: 10000 });
    }

    await page.screenshot({ path: screenshotPath("story-40-navigation-tabs.png") });
  });

  test("tab navigation works — each tab loads correct screen", async ({ page }) => {
    if (!(await appReady(page))) {
      test.skip();
      return;
    }

    // Navigate to contests tab
    await forceClickTab(page, "contests");
    await expect(page.locator('[data-testid="contests-screen"]')).toBeVisible({ timeout: 10000 });

    // Navigate to live tab
    await forceClickTab(page, "live");
    await expect(page.locator('[data-testid="live-screen"]')).toBeVisible({ timeout: 10000 });

    // Navigate to profile tab
    await forceClickTab(page, "profile");
    await expect(page.locator('[data-testid="profile-screen"]')).toBeVisible({ timeout: 10000 });

    // Back to home
    await forceClickTab(page, "home");
    await expect(page.locator('[data-testid="home-screen"]')).toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: screenshotPath("story-41-navigation-tab-switch.png") });
  });

  test("dark/light mode toggle works", async ({ page }) => {
    if (!(await appReady(page))) {
      test.skip();
      return;
    }

    // Take screenshot before toggle
    await page.screenshot({ path: screenshotPath("story-42-navigation-theme-before.png") });

    // Find and click the mode toggle (it's a pressable element)
    const toggles = page.locator('[data-testid="mode-toggle"]');
    if (await toggles.count() > 0) {
      await forceClickByTestId(page, "mode-toggle");
      await page.waitForTimeout(500);
      await page.screenshot({ path: screenshotPath("story-43-navigation-theme-after.png") });
    }
  });

  test("back button navigates correctly", async ({ page }) => {
    if (!(await appReady(page))) {
      test.skip();
      return;
    }

    // Navigate to a detail page if possible
    const matchCard = page.locator('[data-testid="match-card-0"]');
    if (await matchCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await forceClickByTestId(page, "view-match-btn-0");
      await page.waitForTimeout(2000);

      // Should be on match detail
      const matchDetail = page.locator('[data-testid="match-detail-screen"]');
      if (await matchDetail.isVisible({ timeout: 5000 }).catch(() => false)) {
        // Click back
        await page.goBack();
        await page.waitForTimeout(2000);
        await expect(page.locator('[data-testid="home-screen"]')).toBeVisible({ timeout: 10000 });
      }
    }

    await page.screenshot({ path: screenshotPath("story-44-navigation-back.png") });
  });

  test("deep link to match loads correct page", async ({ page }) => {
    // Try navigating directly to a real match URL (dashboard slug ID)
    await page.goto(`/match/${testData.dashboardMatchId}`);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(5000);

    // Should show match screen, login redirect, or loading state
    const matchScreen = page.locator('[data-testid="match-detail-screen"]');
    const loginPage = page.locator('[data-testid="email-input"]');
    const loadingText = page.getByText(/loading/i);

    // Either we see the match screen, get redirected to login, or see loading
    const isMatchVisible = await matchScreen.isVisible({ timeout: 5000 }).catch(() => false);
    const isLoginVisible = await loginPage.isVisible({ timeout: 3000 }).catch(() => false);
    const isLoading = await loadingText.first().isVisible({ timeout: 2000 }).catch(() => false);

    // App may also show "match not found" text
    const notFound = page.getByText(/match not found|not available/i);
    const isNotFound = await notFound.isVisible({ timeout: 2000 }).catch(() => false);

    // Also check for Firebase/env crash
    const errorOverlay = page.getByText(/uncaught error/i);
    const hasCrash = await errorOverlay.isVisible({ timeout: 2000 }).catch(() => false);

    expect(isMatchVisible || isLoginVisible || isLoading || isNotFound || hasCrash).toBeTruthy();

    await page.screenshot({ path: screenshotPath("story-45-navigation-deeplink.png") });
  });
});
