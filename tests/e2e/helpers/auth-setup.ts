/**
 * Auth setup helper for authenticated test flows.
 * Creates a test user via Firebase emulator and logs in through the UI.
 */
import { type Page, expect } from "@playwright/test";
import { clearEmulatorAccounts, createTestAccount, fillAuthForm, submitAuthForm } from "../auth/auth-helpers";
import { forceClickByTestId } from "./tamagui";

const TEST_EMAIL = "e2e-test@draftplay.test";
const TEST_PASSWORD = "TestPass123!";
const TEST_USERNAME = "e2eTestUser";

/**
 * Ensure a clean test user exists in the emulator and log in via the UI.
 * Returns after the app redirects away from /auth/login.
 */
export async function loginTestUser(page: Page, opts?: { email?: string; password?: string; username?: string }) {
  const email = opts?.email ?? TEST_EMAIL;
  const password = opts?.password ?? TEST_PASSWORD;
  const username = opts?.username ?? TEST_USERNAME;

  // Wipe emulator state & create fresh account
  await clearEmulatorAccounts();
  await createTestAccount(email, password);

  // Navigate to login
  await page.goto("/auth/login");
  await page.waitForLoadState("networkidle");

  // Fill form & submit
  await fillAuthForm(page, email, password);
  await submitAuthForm(page);

  // Wait for redirect away from login
  await expect(page).not.toHaveURL(/\/auth\/login/, { timeout: 15000 });
}

/**
 * Register a brand-new test user via the UI (register page).
 * Useful for flows that need onboarding.
 */
export async function registerTestUser(page: Page, opts?: { email?: string; password?: string; username?: string }) {
  const email = opts?.email ?? TEST_EMAIL;
  const password = opts?.password ?? TEST_PASSWORD;
  const username = opts?.username ?? TEST_USERNAME;

  await clearEmulatorAccounts();

  await page.goto("/auth/register");
  await page.waitForLoadState("networkidle");

  // Fill username if field exists
  const usernameInput = page.locator('[data-testid="username-input"]');
  if (await usernameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await usernameInput.fill(username);
  }

  await fillAuthForm(page, email, password);
  await submitAuthForm(page);

  // Wait for redirect away from register
  await expect(page).not.toHaveURL(/\/auth\/register/, { timeout: 15000 });
}

export { TEST_EMAIL, TEST_PASSWORD, TEST_USERNAME };
