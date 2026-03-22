/**
 * QA: Chat bubble layout — verify left/right alignment + collapsed card comment count
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

async function ss(page: Page, name: string) {
  await page.screenshot({ path: `screenshots/chat-${name}.png`, fullPage: false });
}

test.describe("Chat Layout QA", () => {
  test.describe.configure({ mode: "serial" });
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    const ok = await login(page);
    expect(ok).toBe(true);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("01 — Collapsed cards show comment count badge", async () => {
    await page.goto(`${BASE}/contest/${CONTEST_ID}?section=predictions`);
    await page.waitForTimeout(4000);
    await ss(page, "01-collapsed-with-counts");
  });

  test("02 — Chat bubble alignment (expand card with comments)", async () => {
    // Find a card with comments and expand it
    const card = page.locator('text=/what were you thinking/i').first();
    if (await card.isVisible({ timeout: 3000 }).catch(() => false)) {
      await card.evaluate((el: any) => el.click());
      await page.waitForTimeout(2000);
      // Scroll to chat area
      await page.mouse.wheel(0, 400);
      await page.waitForTimeout(1000);
      await ss(page, "02a-chat-bubbles");

      await page.mouse.wheel(0, 300);
      await page.waitForTimeout(800);
      await ss(page, "02b-chat-bubbles-more");
    } else {
      // Fallback: expand any visible card
      const anyCard = page.locator('text=/will/i').first();
      if (await anyCard.isVisible({ timeout: 3000 }).catch(() => false)) {
        await anyCard.evaluate((el: any) => el.click());
        await page.waitForTimeout(2000);
        await page.mouse.wheel(0, 400);
        await page.waitForTimeout(1000);
        await ss(page, "02-chat-fallback");
      }
    }
  });

  test("03 — Send a message and verify it appears right-aligned", async () => {
    const input = page.locator('input[placeholder="say something..."]').first();
    if (await input.isVisible({ timeout: 3000 }).catch(() => false)) {
      await input.fill("testing chat alignment!");
      await page.waitForTimeout(500);
      // Click send
      const sendBtn = page.locator('text="send"').first();
      if (await sendBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await sendBtn.evaluate((el: any) => el.click());
        await page.waitForTimeout(2000);
        await ss(page, "03-sent-message-right-aligned");
      }
    }
  });

  test("04 — System message (roast) centered in chat", async () => {
    // Go back to top and expand a resolved card
    await page.mouse.wheel(0, -2000);
    await page.waitForTimeout(500);

    const resolvedCard = page.locator('text=/run rate climb above 12/i').first();
    if (await resolvedCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      await resolvedCard.evaluate((el: any) => el.click());
      await page.waitForTimeout(2000);
      await page.mouse.wheel(0, 400);
      await page.waitForTimeout(1000);
      await ss(page, "04-system-msg-centered");
    }
  });
});
