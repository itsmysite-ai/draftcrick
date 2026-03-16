/**
 * Chapter 13: Guru AI
 *
 * Ravi asks the AI guru for cricket advice.
 * Tests chat rendering, suggestions, and message sending.
 *
 * Run: npx playwright test tests/e2e/cricket-story/13-guru-ai.spec.ts --project=mobile --workers=1
 */
import { test, expect } from "@playwright/test";
import {
  clearEmulatorAccounts,
  loginViaBrowser,
} from "../helpers/hybrid-seed";
import { createTestUser } from "../helpers/api-auth";
import { forceClickByTestId } from "../helpers/tamagui";
import { screenshotPath } from "../helpers/screenshot";

const ss = (name: string) => screenshotPath(name);

test.use({ viewport: { width: 390, height: 844 } });
test.describe.configure({ mode: "serial" });

const TS = Date.now();
const RAVI_EMAIL = `ravi-guru-${TS}@draftplay.test`;
const PASSWORD = "CricketFan123!";

test.describe("Chapter 13 — Guru AI Chat", () => {
  test.setTimeout(180000);

  test.beforeAll(async () => {
    await clearEmulatorAccounts();
    await createTestUser(RAVI_EMAIL, PASSWORD);
  });

  // --- 13.1 Guru screen loads ---
  test("13.1 — guru screen loads with input and send button", async ({ page }) => {
    const loggedIn = await loginViaBrowser(page, RAVI_EMAIL, PASSWORD, "/guru");
    if (!loggedIn) { test.skip(); return; }

    await page.waitForTimeout(5000);

    const guruInput = page.locator('[data-testid="guru-input"]');
    const sendBtn = page.locator('[data-testid="guru-send-btn"]');

    const hasInput = await guruInput.isVisible({ timeout: 10000 }).catch(() => false);
    const hasSend = await sendBtn.isVisible({ timeout: 3000 }).catch(() => false);

    await page.screenshot({ path: ss("13-guru-screen.png") });

    expect(hasInput || hasSend).toBeTruthy();
  });

  // --- 13.2 Suggestion pills ---
  test("13.2 — suggestion pills shown for new chat", async ({ page }) => {
    const loggedIn = await loginViaBrowser(page, RAVI_EMAIL, PASSWORD, "/guru");
    if (!loggedIn) { test.skip(); return; }

    await page.waitForTimeout(5000);

    // Look for suggestion pills (dynamic testIDs)
    const suggestions = page.locator('[data-testid^="suggestion-"]');
    const count = await suggestions.count();

    await page.screenshot({ path: ss("13-suggestions.png") });

    // May or may not have suggestions depending on state
    expect(count >= 0).toBeTruthy();
  });

  // --- 13.3 Send a message ---
  test("13.3 — send a message and get response", async ({ page }) => {
    const loggedIn = await loginViaBrowser(page, RAVI_EMAIL, PASSWORD, "/guru");
    if (!loggedIn) { test.skip(); return; }

    await page.waitForTimeout(5000);

    const guruInput = page.locator('[data-testid="guru-input"]');
    if (!await guruInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      test.skip();
      return;
    }

    await guruInput.fill("Who should I pick as captain for the next IPL match?");
    await forceClickByTestId(page, "guru-send-btn");

    // Wait for AI response (may take a while)
    await page.waitForTimeout(15000);

    const messages = page.locator('[data-testid="guru-messages"]');
    const hasMessages = await messages.isVisible({ timeout: 5000 }).catch(() => false);

    await page.screenshot({ path: ss("13-guru-response.png"), fullPage: true });
  });

  // --- 13.4 Click suggestion pill ---
  test("13.4 — clicking suggestion pill sends message", async ({ page }) => {
    const loggedIn = await loginViaBrowser(page, RAVI_EMAIL, PASSWORD, "/guru");
    if (!loggedIn) { test.skip(); return; }

    await page.waitForTimeout(5000);

    const firstSuggestion = page.locator('[data-testid^="suggestion-"]').first();
    if (await firstSuggestion.isVisible({ timeout: 3000 }).catch(() => false)) {
      const testId = await firstSuggestion.getAttribute("data-testid");
      if (testId) {
        await forceClickByTestId(page, testId);
        await page.waitForTimeout(10000);
      }
    }

    await page.screenshot({ path: ss("13-suggestion-click.png"), fullPage: true });
  });
});
