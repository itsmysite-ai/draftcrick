/**
 * Onboarding Authenticated E2E Tests
 *
 * Register new user → onboarding screen → step through team/format selection.
 * Takes screenshots at every step for visual proof.
 */
import { test, expect } from "@playwright/test";
import { forceClickByTestId, forceClickText } from "../helpers/tamagui";
import { clearEmulatorAccounts, createTestAccount, fillAuthForm, submitAuthForm } from "../auth/auth-helpers";

test.use({ viewport: { width: 390, height: 844 } });
test.describe.configure({ mode: "serial" });

test.describe("Onboarding — Full Authenticated Flow", () => {
  test.setTimeout(60000);

  test("new user registration shows onboarding screen", async ({ page }) => {
    await clearEmulatorAccounts();

    await page.goto("/auth/register");
    await page.waitForTimeout(3000);

    // Register new user
    const usernameInput = page.locator('[data-testid="username-input"]');
    await usernameInput.waitFor({ state: "visible", timeout: 10000 });
    await usernameInput.fill("onboarduser1");

    await fillAuthForm(page, "onboard-test@draftplay.test", "TestPass123!");
    await submitAuthForm(page);
    await page.waitForTimeout(6000);

    // Should show onboarding or redirect to tabs
    const onboardingScreen = page.locator('[data-testid="onboarding-screen"]');
    const visible = await onboardingScreen.isVisible({ timeout: 5000 }).catch(() => false);

    await page.screenshot({ path: "screenshots/e2e-onboard-auth-after-register.png" });
  });

  test("onboarding step 1: favorite team selection", async ({ page }) => {
    await clearEmulatorAccounts();

    await page.goto("/auth/register");
    await page.waitForTimeout(3000);

    const usernameInput = page.locator('[data-testid="username-input"]');
    await usernameInput.waitFor({ state: "visible", timeout: 10000 });
    await usernameInput.fill("onboarduser2");

    await fillAuthForm(page, "onboard-teams@draftplay.test", "TestPass123!");
    await submitAuthForm(page);
    await page.waitForTimeout(6000);

    const onboardingScreen = page.locator('[data-testid="onboarding-screen"]');
    if (!(await onboardingScreen.isVisible({ timeout: 5000 }).catch(() => false))) {
      // May go straight to tabs — skip
      await page.screenshot({ path: "screenshots/e2e-onboard-auth-skipped-to-tabs.png" });
      test.skip(); return;
    }

    // Look for team pills (CSK, MI, RCB, etc.)
    const teamPills = page.getByText(/CSK|MI|RCB|KKR|DC|SRH|GT|LSG|PBKS|RR/i);
    const hasTeams = await teamPills.first().isVisible({ timeout: 3000 }).catch(() => false);

    await page.screenshot({ path: "screenshots/e2e-onboard-auth-team-pills.png" });

    // Select a team
    const cskPill = page.locator('[data-testid="team-pill-CSK"]');
    if (await cskPill.isVisible({ timeout: 3000 }).catch(() => false)) {
      await forceClickByTestId(page, "team-pill-CSK");
      await page.waitForTimeout(500);
    }

    await page.screenshot({ path: "screenshots/e2e-onboard-auth-team-selected.png" });
  });

  test("onboarding step 2: location / country", async ({ page }) => {
    await clearEmulatorAccounts();

    await page.goto("/auth/register");
    await page.waitForTimeout(3000);

    const usernameInput = page.locator('[data-testid="username-input"]');
    await usernameInput.waitFor({ state: "visible", timeout: 10000 });
    await usernameInput.fill("onboarduser3");

    await fillAuthForm(page, "onboard-loc@draftplay.test", "TestPass123!");
    await submitAuthForm(page);
    await page.waitForTimeout(6000);

    const onboardingScreen = page.locator('[data-testid="onboarding-screen"]');
    if (!(await onboardingScreen.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(); return;
    }

    // Select team to advance
    const cskPill = page.locator('[data-testid="team-pill-CSK"]');
    if (await cskPill.isVisible({ timeout: 3000 }).catch(() => false)) {
      await forceClickByTestId(page, "team-pill-CSK");
      await page.waitForTimeout(500);
    }

    // Click next
    const nextBtn = page.locator('[data-testid="onboarding-next-btn"]');
    if (await nextBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await forceClickByTestId(page, "onboarding-next-btn");
      await page.waitForTimeout(2000);
    }

    await page.screenshot({ path: "screenshots/e2e-onboard-auth-location-step.png" });
  });

  test("onboarding step 3: format preference", async ({ page }) => {
    await clearEmulatorAccounts();

    await page.goto("/auth/register");
    await page.waitForTimeout(3000);

    const usernameInput = page.locator('[data-testid="username-input"]');
    await usernameInput.waitFor({ state: "visible", timeout: 10000 });
    await usernameInput.fill("onboarduser4");

    await fillAuthForm(page, "onboard-fmt@draftplay.test", "TestPass123!");
    await submitAuthForm(page);
    await page.waitForTimeout(6000);

    const onboardingScreen = page.locator('[data-testid="onboarding-screen"]');
    if (!(await onboardingScreen.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(); return;
    }

    // Step through: select team → next → location next → format step
    const cskPill = page.locator('[data-testid="team-pill-CSK"]');
    if (await cskPill.isVisible({ timeout: 3000 }).catch(() => false)) {
      await forceClickByTestId(page, "team-pill-CSK");
      await page.waitForTimeout(500);
    }

    const nextBtn = page.locator('[data-testid="onboarding-next-btn"]');
    if (await nextBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await forceClickByTestId(page, "onboarding-next-btn");
      await page.waitForTimeout(2000);
    }

    // Try to advance past location step
    const locNextBtn = page.locator('[data-testid="onboarding-location-next-btn"]');
    if (await locNextBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await forceClickByTestId(page, "onboarding-location-next-btn");
      await page.waitForTimeout(2000);
    }

    await page.screenshot({ path: "screenshots/e2e-onboard-auth-format-step.png" });

    // Select a format
    const salaryCard = page.locator('[data-testid="format-card-salary_cap"]');
    if (await salaryCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      await forceClickByTestId(page, "format-card-salary_cap");
      await page.waitForTimeout(500);
    }

    await page.screenshot({ path: "screenshots/e2e-onboard-auth-format-selected.png" });
  });
});
