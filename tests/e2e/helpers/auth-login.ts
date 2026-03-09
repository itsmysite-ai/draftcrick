/**
 * Shared authenticated login helper for Playwright E2E tests.
 * Logs in via Firebase Auth Emulator → browser form → verified redirect.
 */
import type { Page } from "@playwright/test";
import { clearEmulatorAccounts, createTestAccount, fillAuthForm, submitAuthForm } from "../auth/auth-helpers";

const DEFAULT_EMAIL = "e2e-user@draftplay.test";
const DEFAULT_PASSWORD = "TestPass123!";

/**
 * Register + login a test user via the emulator, returning the authenticated page.
 * Call once per test.describe block (serial mode) or per test.
 */
export async function loginTestUser(
  page: Page,
  opts?: { email?: string; password?: string; clearFirst?: boolean }
): Promise<boolean> {
  const email = opts?.email ?? DEFAULT_EMAIL;
  const password = opts?.password ?? DEFAULT_PASSWORD;

  if (opts?.clearFirst !== false) {
    await clearEmulatorAccounts();
    await createTestAccount(email, password);
  } else {
    // User may already exist (e.g. created via API helper) — try create, ignore EMAIL_EXISTS
    await createTestAccount(email, password).catch(() => {});
  }

  await page.goto("/auth/login");
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(3000);

  const emailInput = page.locator('[data-testid="email-input"]');
  if (!(await emailInput.isVisible({ timeout: 5000 }).catch(() => false))) {
    return false;
  }

  await fillAuthForm(page, email, password);
  await submitAuthForm(page);
  await page.waitForTimeout(8000);

  // Verify we left the auth pages
  const url = page.url();
  return !url.includes("/auth/");
}

/**
 * Navigate to a path and wait for a testID element to be visible.
 * Returns whether the target screen loaded.
 */
export async function navigateAuth(
  page: Page,
  path: string,
  testId: string,
  timeout = 8000
): Promise<boolean> {
  await page.goto(path);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(timeout);

  const el = page.locator(`[data-testid="${testId}"]`);
  return el.isVisible({ timeout: 5000 }).catch(() => false);
}
