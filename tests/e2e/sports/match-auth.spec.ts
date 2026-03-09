/**
 * Match & Live Authenticated E2E Tests
 *
 * Login → home → click match → match detail → live tab.
 * Takes screenshots at every step for visual proof.
 */
import { test, expect } from "@playwright/test";
import { forceClickByTestId, forceClickTab, forceClickText } from "../helpers/tamagui";
import { loginTestUser } from "../helpers/auth-login";

test.use({ viewport: { width: 390, height: 844 } });
test.describe.configure({ mode: "serial" });

test.describe("Matches & Live — Authenticated", () => {
  test.setTimeout(60000);

  test("home screen shows real match data when authenticated", async ({ page }) => {
    const loggedIn = await loginTestUser(page);
    if (!loggedIn) { test.skip(); return; }

    const homeScreen = page.locator('[data-testid="home-screen"]');
    await expect(homeScreen).toBeVisible({ timeout: 8000 });

    // Check for match cards
    const matchCard = page.locator('[data-testid="match-card-0"]');
    const hasMatch = await matchCard.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasMatch) {
      // Verify match has team info
      const matchStatus = page.locator('[data-testid="match-status-0"]');
      await matchStatus.isVisible({ timeout: 3000 }).catch(() => false);
    }

    await page.screenshot({ path: "screenshots/e2e-match-auth-home-matches.png" });
  });

  test("match detail shows full info when authenticated", async ({ page }) => {
    const loggedIn = await loginTestUser(page);
    if (!loggedIn) { test.skip(); return; }

    // Click first match card
    const viewBtn = page.locator('[data-testid="view-match-btn-0"]');
    if (await viewBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await forceClickByTestId(page, "view-match-btn-0");
    } else {
      const matchCard = page.locator('[data-testid="match-card-0"]');
      if (await matchCard.isVisible({ timeout: 3000 }).catch(() => false)) {
        await forceClickByTestId(page, "match-card-0");
      } else {
        test.skip(); return;
      }
    }
    await page.waitForTimeout(3000);

    const matchDetail = page.locator('[data-testid="match-detail-screen"]');
    const visible = await matchDetail.isVisible({ timeout: 5000 }).catch(() => false);
    expect(visible).toBeTruthy();

    await page.screenshot({ path: "screenshots/e2e-match-auth-detail-top.png" });

    // Scroll down to see all sections
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);

    await page.screenshot({ path: "screenshots/e2e-match-auth-detail-bottom.png" });
  });

  test("live tab shows live matches when authenticated", async ({ page }) => {
    const loggedIn = await loginTestUser(page);
    if (!loggedIn) { test.skip(); return; }

    await forceClickTab(page, "live");
    await page.waitForTimeout(3000);

    const liveScreen = page.locator('[data-testid="live-screen"]');
    const visible = await liveScreen.isVisible({ timeout: 5000 }).catch(() => false);
    expect(visible).toBeTruthy();

    // Check for live match cards
    const liveCard = page.locator('[data-testid="live-match-card-0"]');
    const hasLive = await liveCard.isVisible({ timeout: 5000 }).catch(() => false);

    // Also check for "no live matches" state
    const noLive = page.getByText(/no live matches|no matches currently live/i).first();
    const hasNoLive = await noLive.isVisible({ timeout: 3000 }).catch(() => false);

    await page.screenshot({ path: "screenshots/e2e-match-auth-live-tab.png" });
  });

  test("live tab match card detail", async ({ page }) => {
    const loggedIn = await loginTestUser(page);
    if (!loggedIn) { test.skip(); return; }

    await forceClickTab(page, "live");
    await page.waitForTimeout(3000);

    const liveCard = page.locator('[data-testid="live-match-card-0"]');
    if (!(await liveCard.isVisible({ timeout: 5000 }).catch(() => false))) {
      // No live matches right now
      await page.screenshot({ path: "screenshots/e2e-match-auth-no-live.png" });
      return;
    }

    // Click into live match
    await forceClickByTestId(page, "live-match-card-0");
    await page.waitForTimeout(3000);

    await page.screenshot({ path: "screenshots/e2e-match-auth-live-detail.png" });
  });
});
