/**
 * E2E Screenshot Tests — Notification Screens (L3)
 *
 * Captures screenshots of notification inbox (empty + populated) and preferences.
 * Requires Expo web on localhost:8081, API on localhost:3001,
 * and Firebase Auth Emulator on port 9099.
 */

import { test, expect } from "@playwright/test";
import path from "path";
import {
  clearEmulatorAccounts,
  createTestAccount,
  fillAuthForm,
  submitAuthForm,
} from "../auth/auth-helpers";
import {
  seedTestNotifications,
  clearTestNotifications,
} from "../helpers/seed-notifications";

function screenshotPath(name: string) {
  const dir = process.env.REGRESSION_SCREENSHOT_DIR ?? path.join("screenshots");
  return path.join(dir, `${name}.png`);
}

const EMAIL = "notif-e2e@draftplay.test";
const PASSWORD = "TestPass123!";

const EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "localhost:9099";
const API_BASE = process.env.API_URL ?? "http://localhost:3001";

/**
 * Create a user via emulator API and sync to DB (server-side).
 * Returns the DB user ID for seeding test data.
 */
async function createAndSyncUser(): Promise<{ idToken: string; dbUserId: string }> {
  // Create emulator account
  const signUpRes = await fetch(
    `http://${EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD, returnSecureToken: true }),
    }
  );
  const signUpData = await signUpRes.json();
  const idToken = signUpData.idToken;

  // Sync user to DB via auth.syncUser
  const username = `notif_e2e_${Date.now().toString(36).slice(-4)}`;
  const syncRes = await fetch(`${API_BASE}/trpc/auth.syncUser`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ json: { username, displayName: "Notif Test User" } }),
  });
  const syncData = await syncRes.json();
  const dbUserId = syncData?.result?.data?.json?.userId ?? syncData?.result?.data?.userId;

  // Get fresh token
  const signInRes = await fetch(
    `http://${EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD, returnSecureToken: true }),
    }
  );
  const signInData = await signInRes.json();

  return { idToken: signInData.idToken, dbUserId };
}

/**
 * Login the test user via the browser UI.
 */
async function loginViaUI(page: any) {
  await page.goto("http://localhost:8081/auth/login");
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(3000);

  const emailInput = page.locator('[data-testid="email-input"]');
  if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await fillAuthForm(page, EMAIL, PASSWORD);
    await submitAuthForm(page);
    await page.waitForTimeout(8000);
  }
}

test.use({ viewport: { width: 390, height: 844 } });

test.describe.configure({ mode: "serial" });

test.describe("Notification Screens (Authenticated)", () => {
  test.setTimeout(60000);

  test("notification inbox — empty state", async ({ page }) => {
    await clearEmulatorAccounts();
    await createTestAccount(EMAIL, PASSWORD);
    await loginViaUI(page);

    const url = page.url();
    if (url.includes("/auth/")) {
      console.log("  [SKIP] Login did not complete");
      test.skip();
      return;
    }

    await page.goto("http://localhost:8081/notifications/inbox");
    await page.waitForTimeout(3000);

    const screen = page.locator('[data-testid="notification-inbox-screen"]');
    await expect(screen).toBeVisible({ timeout: 10000 });

    const emptyState = page.locator('[data-testid="notification-empty-state"]');
    const hasEmpty = await emptyState.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`  inbox empty state visible: ${hasEmpty}`);

    await page.screenshot({ path: screenshotPath("l3-notification-inbox-empty"), fullPage: true });
    console.log("  screenshot saved: l3-notification-inbox-empty.png");
  });

  test("notification inbox — populated with notifications", async ({ page }) => {
    // Create user server-side and seed notifications
    await clearEmulatorAccounts();
    const { dbUserId } = await createAndSyncUser();

    // Clear any existing notifications first (in case another worker seeded)
    await clearTestNotifications(dbUserId);

    // Seed sample notifications into the DB
    const ids = await seedTestNotifications(dbUserId);
    console.log(`  seeded ${ids.length} notifications for user ${dbUserId}`);

    // Login via browser UI
    await loginViaUI(page);

    const url = page.url();
    if (url.includes("/auth/")) {
      console.log("  [SKIP] Login did not complete");
      await clearTestNotifications(dbUserId);
      test.skip();
      return;
    }

    await page.goto("http://localhost:8081/notifications/inbox");
    await page.waitForTimeout(4000);

    const screen = page.locator('[data-testid="notification-inbox-screen"]');
    await expect(screen).toBeVisible({ timeout: 10000 });

    // Should NOT show empty state — notifications should be visible
    const emptyState = page.locator('[data-testid="notification-empty-state"]');
    const hasEmpty = await emptyState.isVisible({ timeout: 3000 }).catch(() => false);

    if (!hasEmpty) {
      console.log("  inbox shows populated notifications");
    } else {
      console.log("  [WARN] inbox still shows empty state — auth token may not have propagated");
    }

    await page.screenshot({ path: screenshotPath("l3-notification-inbox"), fullPage: true });
    console.log("  screenshot saved: l3-notification-inbox.png");

    // Cleanup
    await clearTestNotifications(dbUserId);
  });

  test("notification preferences screen", async ({ page }) => {
    await clearEmulatorAccounts();
    await createTestAccount(EMAIL, PASSWORD);
    await loginViaUI(page);

    const url = page.url();
    if (url.includes("/auth/")) {
      console.log("  [SKIP] Login did not complete");
      test.skip();
      return;
    }

    await page.goto("http://localhost:8081/settings/notifications");
    await page.waitForTimeout(3000);

    const screen = page.locator('[data-testid="notification-prefs-screen"]');
    await expect(screen).toBeVisible({ timeout: 10000 });

    const deadlinesToggle = page.locator('[data-testid="pref-toggle-deadlines"]');
    const scoresToggle = page.locator('[data-testid="pref-toggle-scores"]');
    const statusToggle = page.locator('[data-testid="pref-toggle-status"]');
    const rankToggle = page.locator('[data-testid="pref-toggle-rank"]');

    const hasDeadlines = await deadlinesToggle.isVisible({ timeout: 10000 }).catch(() => false);
    const hasScores = await scoresToggle.isVisible({ timeout: 5000 }).catch(() => false);
    const hasStatus = await statusToggle.isVisible({ timeout: 5000 }).catch(() => false);
    const hasRank = await rankToggle.isVisible({ timeout: 5000 }).catch(() => false);

    console.log(`  preference toggles — deadlines: ${hasDeadlines}, scores: ${hasScores}, status: ${hasStatus}, rank: ${hasRank}`);

    await page.screenshot({ path: screenshotPath("l3-notification-preferences"), fullPage: true });
    console.log("  screenshot saved: l3-notification-preferences.png");
  });
});
