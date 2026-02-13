/**
 * Screenshot validation for Phase 2.75 fixes.
 * Targets Expo web (localhost:8081).
 *
 * Validates:
 *  Fix 1 — Tournament stats filtered by tournament teams (not global)
 *  Fix 2 — Home screen: no draft/squad tabs, only matches + tournament filters
 *  Fix 3 — Match detail placeholder screen with Phase 3 sections
 */
import { test } from "@playwright/test";
import path from "path";

const SCREENSHOT_DIR = path.resolve(__dirname, "../../screenshots");
const BASE = "http://localhost:8081";

test.use({
  viewport: { width: 390, height: 844 },
});

/**
 * Force-click a Tamagui SegmentTab / pressable element by finding its text,
 * walking up to the cursor:pointer ancestor, and dispatching pointer events.
 */
async function forceClickTab(page: any, tabLabel: string) {
  await page.evaluate((label: string) => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const text = walker.currentNode.textContent?.trim();
      if (text === label) {
        let target = walker.currentNode.parentElement;
        while (target && target !== document.body) {
          const cs = window.getComputedStyle(target);
          if (cs.cursor === "pointer") break;
          target = target.parentElement;
        }
        if (!target) target = walker.currentNode.parentElement;
        if (!target) return;

        const rect = target.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;

        const opts = { bubbles: true, cancelable: true, clientX: cx, clientY: cy, pointerId: 1, pointerType: "mouse" as const };
        target.dispatchEvent(new PointerEvent("pointerdown", opts));
        target.dispatchEvent(new PointerEvent("pointerup", opts));
        target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, clientX: cx, clientY: cy }));
        return;
      }
    }
  }, tabLabel);
  await page.waitForTimeout(3000);
}

/**
 * Force-click the first element matching a text pattern.
 * Used for filter pills and buttons.
 */
async function forceClickText(page: any, pattern: RegExp) {
  await page.evaluate((pat: string) => {
    const regex = new RegExp(pat, "i");
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const text = walker.currentNode.textContent?.trim();
      if (text && regex.test(text)) {
        let target = walker.currentNode.parentElement;
        while (target && target !== document.body) {
          const cs = window.getComputedStyle(target);
          if (cs.cursor === "pointer") break;
          target = target.parentElement;
        }
        if (!target) target = walker.currentNode.parentElement;
        if (!target) return;

        const rect = target.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;

        const opts = { bubbles: true, cancelable: true, clientX: cx, clientY: cy, pointerId: 1, pointerType: "mouse" as const };
        target.dispatchEvent(new PointerEvent("pointerdown", opts));
        target.dispatchEvent(new PointerEvent("pointerup", opts));
        target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, clientX: cx, clientY: cy }));
        return;
      }
    }
  }, pattern.source);
  await page.waitForTimeout(2000);
}

test.describe("Fix 2 — Home screen (no draft/squad tabs)", () => {
  test("home screen — matches only, no draft tabs", async ({ page }) => {
    await page.goto(BASE);
    await page.waitForTimeout(8000);
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/fix2-home-no-draft-tabs.png`,
      fullPage: false,
    });
  });

  test("home screen — tournament filter active", async ({ page }) => {
    await page.goto(BASE);
    await page.waitForTimeout(8000);
    // Click a tournament filter pill
    await forceClickText(page, /world cup|t20|ipl|asia/);
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/fix2-home-filter-active.png`,
      fullPage: false,
    });
  });
});

test.describe("Fix 3 — Match detail placeholder", () => {
  test("match detail screen — Phase 3 placeholder", async ({ page }) => {
    await page.goto(BASE);
    await page.waitForTimeout(8000);
    // Click "view match" button on the first match card
    await forceClickText(page, /view match/);
    await page.waitForTimeout(3000);
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/fix3-match-detail-top.png`,
      fullPage: false,
    });
    // Scroll down to see Phase 3 placeholder sections
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(500);
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/fix3-match-detail-phase3.png`,
      fullPage: false,
    });
  });
});

test.describe("Fix 1 — Tournament stats filtered", () => {
  test("tournament details — stats tab (filtered players)", async ({ page }) => {
    // Navigate directly to ICC T20 World Cup tournament details
    const tournamentName = encodeURIComponent("ICC Men's T20 World Cup 2026");
    await page.goto(`${BASE}/tournament/${tournamentName}`);
    await page.waitForTimeout(8000);
    // Screenshot the matches tab (default)
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/fix1-tournament-matches.png`,
      fullPage: false,
    });
    // Try clicking stats tab
    await forceClickTab(page, "stats");
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/fix1-tournament-stats-filtered.png`,
      fullPage: false,
    });
  });

  test("tournament details — standings tab", async ({ page }) => {
    const tournamentName = encodeURIComponent("ICC Men's T20 World Cup 2026");
    await page.goto(`${BASE}/tournament/${tournamentName}`);
    await page.waitForTimeout(8000);
    await forceClickTab(page, "standings");
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/fix1-tournament-standings.png`,
      fullPage: false,
    });
  });

  test("women's tournament — correct team filtering", async ({ page }) => {
    const tournamentName = encodeURIComponent("Women's Asia Cup Rising Stars 2026");
    await page.goto(`${BASE}/tournament/${tournamentName}`);
    await page.waitForTimeout(8000);
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/fix1-women-tournament.png`,
      fullPage: false,
    });
    await forceClickTab(page, "stats");
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/fix1-women-tournament-stats.png`,
      fullPage: false,
    });
  });
});
