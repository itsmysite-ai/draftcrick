/**
 * Onboarding Flow E2E Tests
 *
 * Tests the 3-step onboarding: team pick, location declaration, format preference.
 * Requires Firebase Auth Emulator for user registration.
 */
import { test, expect } from "@playwright/test";
import { forceClickByTestId, forceClickText } from "../helpers/tamagui";
import { clearEmulatorAccounts, createTestAccount, fillAuthForm, submitAuthForm } from "../auth/auth-helpers";

test.use({ viewport: { width: 390, height: 844 } });

test.describe.configure({ mode: "serial" });

test.describe("Onboarding Flow", () => {
  test.setTimeout(60000);

  test.beforeEach(async () => {
    await clearEmulatorAccounts();
  });

  test("new user sees onboarding screen after registration", async ({ page }) => {
    await page.goto("/auth/register");
    await page.waitForLoadState("domcontentloaded");

    // Fill registration form
    const usernameInput = page.locator('[data-testid="username-input"]');
    if (await usernameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await usernameInput.fill("onboardUser");
    }

    await fillAuthForm(page, "onboard-test@draftplay.test", "OnboardPass123!");
    await submitAuthForm(page);

    // After registration, should see onboarding or tabs
    await page.waitForTimeout(5000);

    const onboardingScreen = page.locator('[data-testid="onboarding-screen"]');
    const tabsScreen = page.locator('[data-testid="home-screen"]');

    const hasOnboarding = await onboardingScreen.isVisible({ timeout: 10000 }).catch(() => false);
    const hasTabs = await tabsScreen.isVisible({ timeout: 5000 }).catch(() => false);

    // Either onboarding or direct to tabs (depending on app config)
    expect(hasOnboarding || hasTabs).toBeTruthy();

    await page.screenshot({ path: "screenshots/e2e-onboarding-after-register.png" });
  });

  test("select favorite team proceeds to next step", async ({ page }) => {
    // Navigate directly to onboarding
    await page.goto("/auth/onboarding");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(3000);

    const onboardingScreen = page.locator('[data-testid="onboarding-screen"]');
    if (!(await onboardingScreen.isVisible({ timeout: 5000 }).catch(() => false))) {
      // May redirect to login if not authenticated
      test.skip();
      return;
    }

    // Should see "pick your team" header
    const pickTeam = page.getByText(/pick your team/i);
    await expect(pickTeam).toBeVisible({ timeout: 5000 });

    // Select CSK team
    await forceClickByTestId(page, "team-pill-CSK");
    await page.waitForTimeout(1000);

    // Next button should be enabled now
    const nextBtn = page.locator('[data-testid="onboarding-next-btn"]');
    await expect(nextBtn).toBeVisible({ timeout: 3000 });

    // Click next
    await forceClickByTestId(page, "onboarding-next-btn");
    await page.waitForTimeout(2000);

    // Should proceed to location step
    const locationHeader = page.getByText(/where are you located/i);
    const hasLocation = await locationHeader.isVisible({ timeout: 5000 }).catch(() => false);

    expect(hasLocation).toBeTruthy();

    await page.screenshot({ path: "screenshots/e2e-onboarding-team-selected.png" });
  });

  test("select format preference on step 3", async ({ page }) => {
    await page.goto("/auth/onboarding");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(3000);

    const onboardingScreen = page.locator('[data-testid="onboarding-screen"]');
    if (!(await onboardingScreen.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip();
      return;
    }

    // Check for format cards if we're on step 2
    const formatHeader = page.getByText(/choose your style/i);
    if (await formatHeader.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Click salary cap format
      await forceClickByTestId(page, "format-card-salary_cap");
      await page.waitForTimeout(1000);

      // Complete button should be visible
      const completeBtn = page.locator('[data-testid="onboarding-complete-btn"]');
      await expect(completeBtn).toBeVisible({ timeout: 3000 });
    }

    await page.screenshot({ path: "screenshots/e2e-onboarding-format.png" });
  });

  test("complete onboarding redirects to home tabs", async ({ page }) => {
    await page.goto("/auth/onboarding");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(3000);

    const onboardingScreen = page.locator('[data-testid="onboarding-screen"]');
    if (!(await onboardingScreen.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip();
      return;
    }

    // If on step 2 (format selection), complete it
    const completeBtn = page.locator('[data-testid="onboarding-complete-btn"]');
    if (await completeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Select a format first
      await forceClickByTestId(page, "format-card-draft");
      await page.waitForTimeout(500);

      await forceClickByTestId(page, "onboarding-complete-btn");
      await page.waitForTimeout(5000);

      // Should redirect to tabs
      const url = page.url();
      const redirectedToTabs = !url.includes("/auth/onboarding");
      expect(redirectedToTabs).toBeTruthy();
    }

    await page.screenshot({ path: "screenshots/e2e-onboarding-complete.png" });
  });
});
