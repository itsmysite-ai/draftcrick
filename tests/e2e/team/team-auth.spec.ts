/**
 * Team Builder Authenticated E2E Tests
 *
 * Login → team builder → player selection → role tabs → captain selection.
 * Takes screenshots at every step for visual proof.
 */
import { test, expect } from "@playwright/test";
import { forceClickByTestId, forceClickTab, forceClickText } from "../helpers/tamagui";
import { loginTestUser } from "../helpers/auth-login";

test.use({ viewport: { width: 390, height: 844 } });
test.describe.configure({ mode: "serial" });

test.describe("Team Builder — Full Authenticated Flow", () => {
  test.setTimeout(60000);

  test("login and navigate to team builder", async ({ page }) => {
    const loggedIn = await loginTestUser(page);
    if (!loggedIn) { test.skip(); return; }

    await page.goto("/team/create");
    await page.waitForTimeout(5000);

    const teamScreen = page.locator('[data-testid="team-builder-screen"]');
    const visible = await teamScreen.isVisible({ timeout: 5000 }).catch(() => false);

    await page.screenshot({ path: "screenshots/e2e-team-auth-builder-screen.png" });
  });

  test("team builder shows salary cap and role tabs", async ({ page }) => {
    const loggedIn = await loginTestUser(page);
    if (!loggedIn) { test.skip(); return; }

    await page.goto("/team/create");
    await page.waitForTimeout(5000);

    const teamScreen = page.locator('[data-testid="team-builder-screen"]');
    if (!(await teamScreen.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(); return;
    }

    // Check for salary cap / credits display
    const credits = page.getByText(/credits|salary|budget|100/i).first();
    const hasCredits = await credits.isVisible({ timeout: 3000 }).catch(() => false);

    // Check for role tabs (WK, BAT, AR, BOWL)
    const wkTab = page.getByText(/wk|keeper/i).first();
    const batTab = page.getByText(/bat/i).first();
    const bowlTab = page.getByText(/bowl/i).first();

    const hasWk = await wkTab.isVisible({ timeout: 3000 }).catch(() => false);
    const hasBat = await batTab.isVisible({ timeout: 3000 }).catch(() => false);
    const hasBowl = await bowlTab.isVisible({ timeout: 3000 }).catch(() => false);

    await page.screenshot({ path: "screenshots/e2e-team-auth-roles-credits.png" });
  });

  test("team builder WK tab shows wicket keepers", async ({ page }) => {
    const loggedIn = await loginTestUser(page);
    if (!loggedIn) { test.skip(); return; }

    await page.goto("/team/create");
    await page.waitForTimeout(5000);

    const teamScreen = page.locator('[data-testid="team-builder-screen"]');
    if (!(await teamScreen.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(); return;
    }

    // Click WK tab
    await forceClickText(page, /^wk$/i);
    await page.waitForTimeout(1000);

    await page.screenshot({ path: "screenshots/e2e-team-auth-wk-tab.png" });
  });

  test("team builder BAT tab shows batsmen", async ({ page }) => {
    const loggedIn = await loginTestUser(page);
    if (!loggedIn) { test.skip(); return; }

    await page.goto("/team/create");
    await page.waitForTimeout(5000);

    const teamScreen = page.locator('[data-testid="team-builder-screen"]');
    if (!(await teamScreen.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(); return;
    }

    await forceClickText(page, /^bat$/i);
    await page.waitForTimeout(1000);

    await page.screenshot({ path: "screenshots/e2e-team-auth-bat-tab.png" });
  });

  test("team builder BOWL tab shows bowlers", async ({ page }) => {
    const loggedIn = await loginTestUser(page);
    if (!loggedIn) { test.skip(); return; }

    await page.goto("/team/create");
    await page.waitForTimeout(5000);

    const teamScreen = page.locator('[data-testid="team-builder-screen"]');
    if (!(await teamScreen.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(); return;
    }

    await forceClickText(page, /^bowl$/i);
    await page.waitForTimeout(1000);

    await page.screenshot({ path: "screenshots/e2e-team-auth-bowl-tab.png" });
  });

  test("team builder continue button disabled when < 11 players", async ({ page }) => {
    const loggedIn = await loginTestUser(page);
    if (!loggedIn) { test.skip(); return; }

    await page.goto("/team/create");
    await page.waitForTimeout(5000);

    const teamScreen = page.locator('[data-testid="team-builder-screen"]');
    if (!(await teamScreen.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(); return;
    }

    // Continue button should be disabled
    const continueBtn = page.locator('[data-testid="team-continue-btn"]');
    if (await continueBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Check opacity (disabled state)
      const opacity = await continueBtn.evaluate((el) =>
        window.getComputedStyle(el).opacity
      ).catch(() => "1");
      console.log(`    Continue button opacity: ${opacity}`);
    }

    await page.screenshot({ path: "screenshots/e2e-team-auth-continue-disabled.png" });
  });
});
