/**
 * Chapter 1: Authentication
 *
 * Ravi discovers DraftPlay and creates an account.
 * Tests registration, login, error handling, and sign-out flows.
 *
 * Run: npx playwright test tests/e2e/cricket-story/01-auth.spec.ts --project=mobile --workers=1
 */
import { test, expect } from "@playwright/test";
import {
  clearEmulatorAccounts,
  createTestAccount,
  fillAuthForm,
  submitAuthForm,
} from "../helpers/auth-helpers";
import { forceClickByTestId } from "../helpers/tamagui";
import { screenshotPath } from "../helpers/screenshot";

const SCREENSHOT_DIR = "tests/e2e/cricket-story/screenshots";
const ss = (name: string) => screenshotPath(name);

test.use({ viewport: { width: 390, height: 844 } });
test.describe.configure({ mode: "serial" });

const TS = Date.now();
const RAVI_EMAIL = `ravi-${TS}@draftplay.test`;
const PASSWORD = "CricketFan123!";

test.describe("Chapter 1 — Authentication", () => {
  test.beforeAll(async () => {
    await clearEmulatorAccounts();
  });

  // --- 1.1 Unauthenticated redirect ---
  test("1.1 — unauthenticated user redirected to login", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(5000);

    expect(page.url()).toContain("/auth/login");

    await page.screenshot({ path: ss("01-unauth-redirect.png") });
  });

  // --- 1.2 Login screen renders ---
  test("1.2 — login screen renders with all fields", async ({ page }) => {
    await page.goto("/auth/login");
    await page.waitForTimeout(3000);

    await expect(page.locator('[data-testid="email-input"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="password-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="submit-button"]')).toBeVisible();

    await page.screenshot({ path: ss("01-login-screen.png") });
  });

  // --- 1.3 Register screen renders ---
  test("1.3 — register screen renders with all fields", async ({ page }) => {
    await page.goto("/auth/register");
    await page.waitForTimeout(3000);

    await expect(page.locator('[data-testid="email-input"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="password-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="age-confirm-checkbox"]')).toBeVisible();
    await expect(page.locator('[data-testid="terms-accept-checkbox"]')).toBeVisible();
    await expect(page.locator('[data-testid="submit-button"]')).toBeVisible();

    await page.screenshot({ path: ss("01-register-screen.png") });
  });

  // --- 1.4 Weak password error ---
  test("1.4 — weak password shows error", async ({ page }) => {
    await page.goto("/auth/register");
    await page.waitForTimeout(3000);

    await page.locator('[data-testid="email-input"]').waitFor({ state: "visible", timeout: 10000 });
    await fillAuthForm(page, "weak@draftplay.test", "123");

    // Check both compliance boxes
    await forceClickByTestId(page, "age-confirm-checkbox");
    await forceClickByTestId(page, "terms-accept-checkbox");
    await submitAuthForm(page);
    await page.waitForTimeout(3000);

    const errorEl = page.locator('[data-testid="auth-error"]');
    await expect(errorEl).toBeVisible({ timeout: 5000 });
    expect(page.url()).toContain("/auth/register");

    await page.screenshot({ path: ss("01-register-weak-pw.png") });
  });

  // --- 1.5 Duplicate email error ---
  test("1.5 — duplicate email shows error", async ({ page }) => {
    // Pre-create account
    await createTestAccount("dupe@draftplay.test", PASSWORD);

    await page.goto("/auth/register");
    await page.waitForTimeout(3000);

    await page.locator('[data-testid="email-input"]').waitFor({ state: "visible", timeout: 10000 });
    await fillAuthForm(page, "dupe@draftplay.test", PASSWORD);
    await forceClickByTestId(page, "age-confirm-checkbox");
    await forceClickByTestId(page, "terms-accept-checkbox");
    await submitAuthForm(page);
    await page.waitForTimeout(3000);

    const errorEl = page.locator('[data-testid="auth-error"]');
    await expect(errorEl).toBeVisible({ timeout: 5000 });
    expect(page.url()).toContain("/auth/register");

    await page.screenshot({ path: ss("01-register-dupe.png") });
  });

  // --- 1.6 Checkboxes required ---
  test("1.6 — submit disabled without checkboxes", async ({ page }) => {
    await page.goto("/auth/register");
    await page.waitForTimeout(3000);

    await page.locator('[data-testid="email-input"]').waitFor({ state: "visible", timeout: 10000 });
    await fillAuthForm(page, "nochecks@draftplay.test", PASSWORD);

    // Don't check any boxes — submit should be disabled
    const submitBtn = page.locator('[data-testid="submit-button"]');
    const isDisabled = await submitBtn.evaluate((el: HTMLElement) => {
      return el.getAttribute("aria-disabled") === "true" ||
        el.hasAttribute("disabled") ||
        window.getComputedStyle(el).opacity === "0.5" ||
        window.getComputedStyle(el).pointerEvents === "none";
    });

    // Either disabled or clicking doesn't navigate away
    if (!isDisabled) {
      await submitAuthForm(page);
      await page.waitForTimeout(2000);
      expect(page.url()).toContain("/auth/register");
    }

    await page.screenshot({ path: ss("01-register-no-checkboxes.png") });
  });

  // --- 1.7 Ravi registers successfully ---
  test("1.7 — Ravi registers successfully", async ({ page }) => {
    await page.goto("/auth/register");
    await page.waitForTimeout(3000);

    await page.locator('[data-testid="email-input"]').waitFor({ state: "visible", timeout: 10000 });
    await fillAuthForm(page, RAVI_EMAIL, PASSWORD);

    // Check both compliance boxes
    await forceClickByTestId(page, "age-confirm-checkbox");
    await forceClickByTestId(page, "terms-accept-checkbox");
    await submitAuthForm(page);

    // Wait for redirect
    await page.waitForTimeout(8000);
    const url = page.url();
    expect(url).not.toContain("/auth/register");

    await page.screenshot({ path: ss("01-register-success.png") });
  });

  // --- 1.8 Ravi logs out ---
  test("1.8 — clearing session redirects to login", async ({ page }) => {
    // Clear browser storage to simulate logout
    await page.goto("/");
    await page.waitForTimeout(3000);

    await page.evaluate(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      indexedDB.databases().then((dbs) => {
        dbs.forEach((db) => {
          if (db.name) indexedDB.deleteDatabase(db.name);
        });
      });
    });

    await clearEmulatorAccounts();
    await page.waitForTimeout(1000);
    await page.goto("/");
    await page.waitForTimeout(5000);

    expect(page.url()).toContain("/auth/login");

    await page.screenshot({ path: ss("01-logout-redirect.png") });
  });

  // --- 1.9 Ravi logs back in ---
  test("1.9 — Ravi logs back in successfully", async ({ page }) => {
    // Re-create account (emulator was cleared)
    await createTestAccount(RAVI_EMAIL, PASSWORD);

    await page.goto("/auth/login");
    await page.waitForTimeout(3000);

    await fillAuthForm(page, RAVI_EMAIL, PASSWORD);
    await submitAuthForm(page);

    await page.waitForTimeout(8000);
    expect(page.url()).not.toContain("/auth/login");

    await page.screenshot({ path: ss("01-login-success.png") });
  });

  // --- 1.10 Wrong password error ---
  test("1.10 — wrong password shows error", async ({ page }) => {
    await page.goto("/auth/login");
    await page.waitForTimeout(3000);

    await fillAuthForm(page, RAVI_EMAIL, "WrongPassword999!");
    await submitAuthForm(page);
    await page.waitForTimeout(3000);

    const errorEl = page.locator('[data-testid="auth-error"]');
    await expect(errorEl).toBeVisible({ timeout: 5000 });
    expect(page.url()).toContain("/auth/login");

    await page.screenshot({ path: ss("01-login-wrong-pw.png") });
  });
});
