/**
 * QA: Prediction Feature — Round 3 (collapsible cards + always-open chat)
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
  await page.screenshot({ path: `screenshots/pqa3-${name}.png`, fullPage: false });
}

test.describe("Prediction QA Round 3", () => {
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

  test("01 — Collapsed cards view", async () => {
    await page.goto(`${BASE}/contest/${CONTEST_ID}?section=predictions`);
    await page.waitForTimeout(4000);
    await ss(page, "01-collapsed-all");
  });

  test("02 — Expand first card", async () => {
    // Click on first collapsed prediction card
    const firstCard = page.locator('text=/will y take a wicket/i').first();
    if (await firstCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstCard.evaluate((el: any) => el.click());
      await page.waitForTimeout(2000);
      await ss(page, "02a-first-expanded");

      // Scroll to see the chat
      await page.mouse.wheel(0, 300);
      await page.waitForTimeout(800);
      await ss(page, "02b-chat-visible");

      await page.mouse.wheel(0, 300);
      await page.waitForTimeout(800);
      await ss(page, "02c-chat-input");
    }
  });

  test("03 — Expand a resolved card with wrong call", async () => {
    // Scroll to see -2 cards
    await page.mouse.wheel(0, -2000);
    await page.waitForTimeout(500);

    const wrongCard = page.locator('text=/run rate climb above 12/i').first();
    if (await wrongCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      await wrongCard.evaluate((el: any) => el.click());
      await page.waitForTimeout(2000);
      await ss(page, "03a-wrong-expanded");

      // Scroll to see roast in chat
      await page.mouse.wheel(0, 400);
      await page.waitForTimeout(1000);
      await ss(page, "03b-wrong-chat");
    }
  });

  test("04 — Expand sixes card (with roast)", async () => {
    await page.mouse.wheel(0, -1000);
    await page.waitForTimeout(500);

    const sixesCard = page.locator('text=/How many sixes/i').first();
    if (await sixesCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      await sixesCard.evaluate((el: any) => el.click());
      await page.waitForTimeout(2000);
      await ss(page, "04a-sixes-expanded");

      await page.mouse.wheel(0, 400);
      await page.waitForTimeout(1000);
      await ss(page, "04b-sixes-chat");
    }
  });

  test("05 — Collapse card back", async () => {
    // Click the ▲ on the expanded card to collapse
    const collapseIcon = page.locator('text="▲"').first();
    if (await collapseIcon.isVisible({ timeout: 2000 }).catch(() => false)) {
      await collapseIcon.evaluate((el: any) => el.click());
      await page.waitForTimeout(1000);
      await ss(page, "05-collapsed-back");
    }
  });
});
