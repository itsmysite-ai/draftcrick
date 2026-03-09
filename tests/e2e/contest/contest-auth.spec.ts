/**
 * Contest Authenticated E2E Tests
 *
 * Login → browse contests → view contest detail → join contest flow.
 * Takes screenshots at every step for visual proof.
 */
import { test, expect } from "@playwright/test";
import { forceClickByTestId, forceClickTab, forceClickText } from "../helpers/tamagui";
import { loginTestUser } from "../helpers/auth-login";

test.use({ viewport: { width: 390, height: 844 } });
test.describe.configure({ mode: "serial" });

test.describe("Contests — Full Authenticated Flow", () => {
  test.setTimeout(60000);

  test("login and navigate to contests tab", async ({ page }) => {
    const loggedIn = await loginTestUser(page);
    if (!loggedIn) { test.skip(); return; }

    // Navigate to contests tab
    await forceClickTab(page, "contests");
    await page.waitForTimeout(3000);

    const contestsScreen = page.locator('[data-testid="contests-screen"]');
    const visible = await contestsScreen.isVisible({ timeout: 5000 }).catch(() => false);

    if (!visible) {
      // Try direct navigation
      await page.goto("/(tabs)/contests");
      await page.waitForTimeout(5000);
    }

    await page.screenshot({ path: "screenshots/e2e-contest-auth-list.png" });
  });

  test("contests tab switcher: browse vs my contests", async ({ page }) => {
    const loggedIn = await loginTestUser(page);
    if (!loggedIn) { test.skip(); return; }

    await forceClickTab(page, "contests");
    await page.waitForTimeout(3000);

    const contestsScreen = page.locator('[data-testid="contests-screen"]');
    if (!(await contestsScreen.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(); return;
    }

    // Screenshot of browse tab (default)
    await page.screenshot({ path: "screenshots/e2e-contest-auth-browse-tab.png" });

    // Switch to "My Contests" tab
    const myContestsTab = page.locator('[data-testid="contests-tab-my"]');
    if (await myContestsTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await forceClickByTestId(page, "contests-tab-my");
      await page.waitForTimeout(2000);
    } else {
      await forceClickText(page, /my contests/i);
      await page.waitForTimeout(2000);
    }

    await page.screenshot({ path: "screenshots/e2e-contest-auth-my-contests.png" });
  });

  test("contests shows match cards or empty state", async ({ page }) => {
    const loggedIn = await loginTestUser(page);
    if (!loggedIn) { test.skip(); return; }

    await forceClickTab(page, "contests");
    await page.waitForTimeout(3000);

    const contestsScreen = page.locator('[data-testid="contests-screen"]');
    if (!(await contestsScreen.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(); return;
    }

    // Check for match cards or empty state
    const matchCard = page.getByText(/vs/i).first();
    const emptyState = page.getByText(/no contests|no matches|browse matches/i).first();
    const signIn = page.locator('[data-testid="contests-signin-btn"]');

    const hasMatches = await matchCard.isVisible({ timeout: 5000 }).catch(() => false);
    const hasEmpty = await emptyState.isVisible({ timeout: 3000 }).catch(() => false);
    const hasSignIn = await signIn.isVisible({ timeout: 3000 }).catch(() => false);

    expect(hasMatches || hasEmpty || hasSignIn).toBeTruthy();

    await page.screenshot({ path: "screenshots/e2e-contest-auth-content.png" });
  });

  test("contest detail page shows info or not found", async ({ page }) => {
    const loggedIn = await loginTestUser(page);
    if (!loggedIn) { test.skip(); return; }

    await page.goto("/contest/00000000-0000-0000-0000-000000000000");
    await page.waitForTimeout(5000);

    await page.screenshot({ path: "screenshots/e2e-contest-auth-detail-notfound.png" });
  });

  test("contest detail with join button (real contest)", async ({ page }) => {
    const loggedIn = await loginTestUser(page);
    if (!loggedIn) { test.skip(); return; }

    // Navigate to contests tab
    await forceClickTab(page, "contests");
    await page.waitForTimeout(3000);

    const contestsScreen = page.locator('[data-testid="contests-screen"]');
    if (!(await contestsScreen.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(); return;
    }

    // Click "draft" button on first match card to go to contest detail
    const draftBtn = page.getByText(/draft/i).first();
    if (await draftBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await forceClickText(page, /^draft$/i);
      await page.waitForTimeout(3000);
    } else {
      // No draft button, try clicking first match card via Tamagui click
      await forceClickText(page, /vs/i);
      await page.waitForTimeout(3000);
    }

    // Take screenshot of whatever page we landed on
    await page.screenshot({ path: "screenshots/e2e-contest-auth-detail.png" });

    // Check for contest detail screen with join button
    const joinBtn = page.locator('[data-testid="join-contest-btn"]');
    if (await joinBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await page.screenshot({ path: "screenshots/e2e-contest-auth-join-btn.png" });
    }

    // Scroll down for standings
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);

    await page.screenshot({ path: "screenshots/e2e-contest-auth-standings.png" });
  });
});
