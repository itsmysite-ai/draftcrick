import { test, expect } from "@playwright/test";
import {
  clearEmulatorAccounts,
  createTestAccount,
  fillAuthForm,
  submitAuthForm,
} from "../auth/auth-helpers";
import { forceClickByTestId } from "../helpers/tamagui";
import { screenshotPath } from "../helpers/screenshot";

test.use({
  viewport: { width: 390, height: 844 },
});

// Auth tests share Firebase emulator state — run serially to avoid race conditions
test.describe.configure({ mode: "serial" });

test.beforeEach(async () => {
  await clearEmulatorAccounts();
});

test.describe("Auth — Registration", () => {
  test("register new user → redirects to onboarding/tabs", async ({ page }) => {
    await page.goto(`/auth/register`);
    await page.waitForTimeout(3000);

    // Fill username
    const usernameInput = page.locator('[data-testid="username-input"]');
    await usernameInput.waitFor({ state: "visible", timeout: 10000 });
    await usernameInput.fill("testuser1");

    // Fill email + password
    await fillAuthForm(page, "test@example.com", "Password123!");
    await submitAuthForm(page);

    // Wait for redirect — should leave /auth/register
    await page.waitForTimeout(5000);
    const url = page.url();
    expect(url).not.toContain("/auth/register");

    await page.screenshot({
      path: screenshotPath("story-02-auth-register-success.png"),
      fullPage: false,
    });
  });

  test("register duplicate email → shows error", async ({ page }) => {
    // Pre-create account via emulator API
    await createTestAccount("dupe@example.com", "Password123!");

    await page.goto(`/auth/register`);
    await page.waitForTimeout(3000);

    const usernameInput = page.locator('[data-testid="username-input"]');
    await usernameInput.waitFor({ state: "visible", timeout: 10000 });
    await usernameInput.fill("dupeuser");

    await fillAuthForm(page, "dupe@example.com", "Password123!");
    await submitAuthForm(page);

    await page.waitForTimeout(3000);

    // Should show error and remain on register page
    const errorEl = page.locator('[data-testid="auth-error"]');
    await expect(errorEl).toBeVisible({ timeout: 5000 });
    expect(page.url()).toContain("/auth/register");

    await page.screenshot({
      path: screenshotPath("story-02b-auth-register-duplicate-error.png"),
      fullPage: false,
    });
  });

  test("register weak password → shows error", async ({ page }) => {
    await page.goto(`/auth/register`);
    await page.waitForTimeout(3000);

    const usernameInput = page.locator('[data-testid="username-input"]');
    await usernameInput.waitFor({ state: "visible", timeout: 10000 });
    await usernameInput.fill("weakuser");

    await fillAuthForm(page, "weak@example.com", "123");
    await submitAuthForm(page);

    await page.waitForTimeout(3000);

    const errorEl = page.locator('[data-testid="auth-error"]');
    await expect(errorEl).toBeVisible({ timeout: 5000 });
    expect(page.url()).toContain("/auth/register");

    await page.screenshot({
      path: screenshotPath("story-02c-auth-register-weak-password.png"),
      fullPage: false,
    });
  });
});

test.describe("Auth — Login", () => {
  test("login existing user → redirects to tabs", async ({ page }) => {
    // Pre-create account
    await createTestAccount("login@example.com", "Password123!");

    await page.goto(`/auth/login`);
    await page.waitForTimeout(3000);

    await fillAuthForm(page, "login@example.com", "Password123!");
    await submitAuthForm(page);

    await page.waitForTimeout(5000);
    const url = page.url();
    expect(url).not.toContain("/auth/login");

    await page.screenshot({
      path: screenshotPath("story-03-auth-login-success.png"),
      fullPage: false,
    });
  });

  test("login wrong password → shows error", async ({ page }) => {
    await createTestAccount("wrong@example.com", "Password123!");

    await page.goto(`/auth/login`);
    await page.waitForTimeout(3000);

    await fillAuthForm(page, "wrong@example.com", "WrongPassword!");
    await submitAuthForm(page);

    await page.waitForTimeout(3000);

    const errorEl = page.locator('[data-testid="auth-error"]');
    await expect(errorEl).toBeVisible({ timeout: 5000 });
    expect(page.url()).toContain("/auth/login");

    await page.screenshot({
      path: screenshotPath("story-03b-auth-login-wrong-password.png"),
      fullPage: false,
    });
  });
});

test.describe("Auth — Sign Out", () => {
  test("sign out → redirects to login", async ({ page }) => {
    // Create and login
    await createTestAccount("signout@example.com", "Password123!");

    await page.goto(`/auth/login`);
    await page.waitForTimeout(3000);

    await fillAuthForm(page, "signout@example.com", "Password123!");
    await submitAuthForm(page);

    // Wait for login redirect
    await page.waitForTimeout(5000);
    expect(page.url()).not.toContain("/auth/login");

    // Clear all emulator accounts to invalidate the session, then navigate to root
    await clearEmulatorAccounts();

    // Clear browser storage to remove cached Firebase auth state
    await page.evaluate(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      // Clear IndexedDB (Firebase stores auth state here)
      indexedDB.databases().then((dbs) => {
        dbs.forEach((db) => {
          if (db.name) indexedDB.deleteDatabase(db.name);
        });
      });
    });

    await page.waitForTimeout(1000);

    // Navigate to root — auth gate should redirect to login
    await page.goto("/");
    await page.waitForTimeout(5000);

    // Should redirect to login since session is invalidated
    expect(page.url()).toContain("/auth/login");

    await page.screenshot({
      path: screenshotPath("story-04-auth-signout.png"),
      fullPage: false,
    });
  });
});

test.describe("Auth — Redirect", () => {
  test("unauthenticated user → redirected to login", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(5000);

    // Should be redirected to login page
    expect(page.url()).toContain("/auth/login");

    await page.screenshot({
      path: screenshotPath("story-01-auth-redirect-to-login.png"),
      fullPage: false,
    });
  });
});
