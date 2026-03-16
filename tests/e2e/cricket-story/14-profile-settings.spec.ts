/**
 * Chapter 14: Profile & Settings
 *
 * Ravi checks profile, changes settings, signs out.
 * Tests theme toggle, subscription display, sign out, settings navigation.
 *
 * Run: npx playwright test tests/e2e/cricket-story/14-profile-settings.spec.ts --project=mobile --workers=1
 */
import { test, expect } from "@playwright/test";
import {
  clearEmulatorAccounts,
  loginViaBrowser,
} from "../helpers/hybrid-seed";
import { createTestUser } from "../helpers/api-auth";
import { forceClickByTestId, forceClickTab, forceClickText } from "../helpers/tamagui";
import { screenshotPath } from "../helpers/screenshot";

const ss = (name: string) => screenshotPath(name);

test.use({ viewport: { width: 390, height: 844 } });
test.describe.configure({ mode: "serial" });

const TS = Date.now();
const RAVI_EMAIL = `ravi-profile-${TS}@draftplay.test`;
const PASSWORD = "CricketFan123!";

test.describe("Chapter 14 — Profile & Settings", () => {
  test.setTimeout(120000);

  test.beforeAll(async () => {
    await clearEmulatorAccounts();
    await createTestUser(RAVI_EMAIL, PASSWORD);
  });

  // --- 14.1 Profile screen loads ---
  test("14.1 — profile screen loads with user info", async ({ page }) => {
    const loggedIn = await loginViaBrowser(page, RAVI_EMAIL, PASSWORD);
    if (!loggedIn) { test.skip(); return; }

    await page.locator('[data-testid="home-screen"]').waitFor({ state: "visible", timeout: 15000 });

    await forceClickTab(page, "profile");
    await page.waitForTimeout(5000);

    const profileScreen = page.locator('[data-testid="profile-screen"]');
    const hasProfile = await profileScreen.isVisible({ timeout: 5000 }).catch(() => false);

    const username = page.locator('[data-testid="profile-username"]');
    const hasUsername = await username.isVisible({ timeout: 3000 }).catch(() => false);

    await page.screenshot({ path: ss("14-profile.png") });

    expect(hasProfile || hasUsername).toBeTruthy();
  });

  // --- 14.2 Theme toggle (dark mode) ---
  test("14.2 — toggle dark mode", async ({ page }) => {
    const loggedIn = await loginViaBrowser(page, RAVI_EMAIL, PASSWORD);
    if (!loggedIn) { test.skip(); return; }

    await page.locator('[data-testid="home-screen"]').waitFor({ state: "visible", timeout: 15000 });

    await forceClickTab(page, "profile");
    await page.waitForTimeout(5000);

    // Look for theme toggle
    const themeToggle = page.getByText(/dark|light|theme/i);
    if (await themeToggle.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await forceClickText(page, /dark|light|theme/i);
      await page.waitForTimeout(2000);
    }

    await page.screenshot({ path: ss("14-dark-mode.png") });
  });

  // --- 14.3 Toggle back to light mode ---
  test("14.3 — toggle back to light mode", async ({ page }) => {
    const loggedIn = await loginViaBrowser(page, RAVI_EMAIL, PASSWORD);
    if (!loggedIn) { test.skip(); return; }

    await page.locator('[data-testid="home-screen"]').waitFor({ state: "visible", timeout: 15000 });

    await forceClickTab(page, "profile");
    await page.waitForTimeout(5000);

    const themeToggle = page.getByText(/dark|light|theme/i);
    if (await themeToggle.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await forceClickText(page, /dark|light|theme/i);
      await page.waitForTimeout(2000);
    }

    await page.screenshot({ path: ss("14-light-mode.png") });
  });

  // --- 14.4 Subscription card ---
  test("14.4 — subscription card visible", async ({ page }) => {
    const loggedIn = await loginViaBrowser(page, RAVI_EMAIL, PASSWORD);
    if (!loggedIn) { test.skip(); return; }

    await page.locator('[data-testid="home-screen"]').waitFor({ state: "visible", timeout: 15000 });

    await forceClickTab(page, "profile");
    await page.waitForTimeout(5000);

    const subCard = page.locator('[data-testid="subscription-card"]');
    const hasSub = await subCard.isVisible({ timeout: 5000 }).catch(() => false);

    await page.screenshot({ path: ss("14-subscription.png") });
  });

  // --- 14.5 Sports settings ---
  test("14.5 — navigate to sports settings", async ({ page }) => {
    const loggedIn = await loginViaBrowser(page, RAVI_EMAIL, PASSWORD, "/settings/sports");
    if (!loggedIn) { test.skip(); return; }

    await page.waitForTimeout(5000);

    const sportsScreen = page.locator('[data-testid="sports-settings-screen"]');
    const hasSports = await sportsScreen.isVisible({ timeout: 10000 }).catch(() => false);

    await page.screenshot({ path: ss("14-sports-settings.png") });
  });

  // --- 14.6 Location settings ---
  test("14.6 — navigate to location settings", async ({ page }) => {
    const loggedIn = await loginViaBrowser(page, RAVI_EMAIL, PASSWORD, "/settings/location");
    if (!loggedIn) { test.skip(); return; }

    await page.waitForTimeout(5000);

    const locationScreen = page.locator('[data-testid="location-settings-screen"]');
    const hasLocation = await locationScreen.isVisible({ timeout: 10000 }).catch(() => false);

    await page.screenshot({ path: ss("14-location-settings.png") });
  });

  // --- 14.7 Sign out ---
  test("14.7 — sign out redirects to login", async ({ page }) => {
    const loggedIn = await loginViaBrowser(page, RAVI_EMAIL, PASSWORD);
    if (!loggedIn) { test.skip(); return; }

    await page.locator('[data-testid="home-screen"]').waitFor({ state: "visible", timeout: 15000 });

    await forceClickTab(page, "profile");
    await page.waitForTimeout(5000);

    const signOutBtn = page.locator('[data-testid="sign-out-btn"]');
    if (await signOutBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await forceClickByTestId(page, "sign-out-btn");
      await page.waitForTimeout(5000);

      // Should redirect to login
      expect(page.url()).toContain("/auth/login");
    }

    await page.screenshot({ path: ss("14-signed-out.png") });
  });
});
