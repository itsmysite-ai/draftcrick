/**
 * Screenshot Tests — AI Engine (L2) UI Verification
 *
 * Takes screenshots of new AI engine screens:
 * - Match detail with FDR badges + AI tools
 * - Cricket Guru chat (initial, with input, with match context)
 * - Rate My Team
 *
 * Requires: Expo web (8081), API (3001), Firebase Auth Emulator (9099)
 * Run: npx playwright test tests/e2e/ai-engine-screenshots.spec.ts
 */

import { test, expect } from "@playwright/test";
import { createTestAccount, clearEmulatorAccounts, fillAuthForm, submitAuthForm } from "./auth/auth-helpers";
import { forceClickByTestId, forceClickText } from "./helpers/tamagui";

const BASE_URL = "http://localhost:8081";
const TEST_EMAIL = "l2-screenshots@test.com";
const TEST_PASSWORD = "testPassword123!";

/**
 * Login helper — creates a test account and signs in via the UI.
 */
async function loginTestUser(page: import("@playwright/test").Page) {
  // Create test account in emulator
  try {
    await createTestAccount(TEST_EMAIL, TEST_PASSWORD);
  } catch {
    // Account may already exist — that's fine
  }

  // Navigate to login and sign in
  await page.goto(BASE_URL);
  await page.waitForTimeout(2000);

  // Check if we're on the login page
  const emailInput = page.locator('[data-testid="email-input"]');
  if (await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await fillAuthForm(page, TEST_EMAIL, TEST_PASSWORD);
    await submitAuthForm(page);
    await page.waitForTimeout(4000); // Wait for auth + redirect to home
  }
}

test.describe("AI Engine UI Screenshots", () => {
  test.beforeAll(async () => {
    // Ensure emulator is clean
    try {
      await clearEmulatorAccounts();
    } catch {
      // Emulator may not be running — tests will still work for non-auth screens
    }
  });

  test("match detail screen — auth + navigate to match with FDR/AI tools", async ({ page }) => {
    await loginTestUser(page);

    // Now we should be on the home screen with matches
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "screenshots/l2-home-authenticated.png", fullPage: true });

    // Try to click first match card
    const matchCard = page.locator('[data-testid^="match-card"]').first();
    const hasMatch = await matchCard.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasMatch) {
      await forceClickByTestId(page, "match-card-0");
      await page.waitForTimeout(4000); // Wait for match detail + FDR query

      // Take screenshot of match detail with FDR badges and AI tools
      await page.screenshot({ path: "screenshots/l2-match-detail-fdr.png", fullPage: true });

      // Check for FDR card visibility
      const fdrCard = page.locator('[data-testid="fdr-card"]');
      const hasFdr = await fdrCard.isVisible({ timeout: 3000 }).catch(() => false);

      // Check for AI tools section
      const guruCard = page.locator('[data-testid="guru-card"]');
      const hasGuru = await guruCard.isVisible({ timeout: 2000 }).catch(() => false);

      console.log(`  FDR card visible: ${hasFdr}, Guru card visible: ${hasGuru}`);
    } else {
      console.log("  [INFO] No match cards on home screen — taking home screen only");
      await page.screenshot({ path: "screenshots/l2-match-detail-fdr.png", fullPage: true });
    }
  });

  test("guru chat screen — initial state with suggestions", async ({ page }) => {
    await page.goto(`${BASE_URL}/guru`);
    await page.waitForTimeout(3000);

    // Screenshot initial state with welcome message and suggestions
    await page.screenshot({ path: "screenshots/l2-guru-initial.png", fullPage: true });

    // Verify welcome message is visible
    const welcomeText = page.getByText("i'm your cricket guru");
    const hasWelcome = await welcomeText.isVisible({ timeout: 3000 }).catch(() => false);
    expect(hasWelcome).toBeTruthy();

    // Verify suggestion chips are visible
    const suggestions = page.locator('[data-testid^="suggestion-"]');
    const chipCount = await suggestions.count();
    expect(chipCount).toBeGreaterThanOrEqual(1);
    console.log(`  Welcome visible: ${hasWelcome}, suggestion chips: ${chipCount}`);

    // Type a message and screenshot
    const input = page.locator('[data-testid="guru-input"]');
    if (await input.isVisible()) {
      await input.fill("who should i captain for IND vs AUS?");
      await page.screenshot({ path: "screenshots/l2-guru-with-input.png", fullPage: true });
    }
  });

  test("guru chat screen — match context banner", async ({ page }) => {
    await page.goto(`${BASE_URL}/guru?matchId=test&teamA=India&teamB=Australia`);
    await page.waitForTimeout(3000);

    // Verify context banner is visible
    const contextBanner = page.getByText("context: india vs australia");
    const hasBanner = await contextBanner.isVisible({ timeout: 3000 }).catch(() => false);
    expect(hasBanner).toBeTruthy();
    console.log(`  Context banner visible: ${hasBanner}`);

    await page.screenshot({ path: "screenshots/l2-guru-match-context.png", fullPage: true });
  });

  test("rate my team screen — team list + rate button", async ({ page }) => {
    await page.goto(`${BASE_URL}/team/rate?teamA=India&teamB=Australia&format=T20`);
    await page.waitForTimeout(3000);

    // Verify team summary card
    const teamCard = page.locator('[data-testid="team-summary-card"]');
    const hasTeam = await teamCard.isVisible({ timeout: 3000 }).catch(() => false);
    expect(hasTeam).toBeTruthy();

    // Verify rate button
    const rateBtn = page.locator('[data-testid="rate-btn"]');
    const hasBtn = await rateBtn.isVisible({ timeout: 3000 }).catch(() => false);
    expect(hasBtn).toBeTruthy();

    console.log(`  Team card visible: ${hasTeam}, Rate button visible: ${hasBtn}`);

    await page.screenshot({ path: "screenshots/l2-rate-my-team.png", fullPage: true });
  });
});
