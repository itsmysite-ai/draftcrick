/**
 * Quick screenshot: expand card with mixed messages to verify bubble colors
 */
import { test, expect, type Page } from "@playwright/test";

const BASE = "http://localhost:8081";
const EMAIL = "test@test.com";
const PASSWORD = "TestPass123!";
const CONTEST_ID = "e0e14906-eb99-4c5d-b64e-3a06621ed2bc";

async function login(page: Page) {
  await page.goto(`${BASE}/auth/login`);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(3000);
  const emailInput = page.locator('[data-testid="email-input"]');
  if (!(await emailInput.isVisible({ timeout: 8000 }).catch(() => false))) {
    if (!page.url().includes("/auth/")) return true;
    return false;
  }
  await emailInput.fill(EMAIL);
  await page.locator('[data-testid="password-input"]').fill(PASSWORD);
  await page.locator('[data-testid="submit-button"]').evaluate((el: any) => el.click());
  await page.waitForTimeout(8000);
  return !page.url().includes("/auth/");
}

test("Chat bubbles — mixed users", async ({ browser }) => {
  const page = await browser.newPage();
  const ok = await login(page);
  expect(ok).toBe(true);

  await page.goto(`${BASE}/contest/${CONTEST_ID}?section=predictions`);
  await page.waitForTimeout(4000);

  // Find and expand a card that has comments from multiple users
  // Try the wicket card first (had 3 messages in user's screenshot)
  const cards = page.locator('text=/wicket/i');
  const count = await cards.count();

  for (let i = 0; i < count; i++) {
    const card = cards.nth(i);
    if (await card.isVisible({ timeout: 2000 }).catch(() => false)) {
      await card.evaluate((el: any) => el.click());
      await page.waitForTimeout(2000);
      break;
    }
  }

  // Scroll to chat
  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "screenshots/chat-mixed-bubbles.png", fullPage: false });

  // Also scroll more
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(800);
  await page.screenshot({ path: "screenshots/chat-mixed-bubbles-2.png", fullPage: false });

  await page.close();
});
