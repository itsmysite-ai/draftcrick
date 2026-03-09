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
import { forceClickTab, forceClickText } from "./helpers/tamagui";

const SCREENSHOT_DIR = path.resolve(__dirname, "../../screenshots");

test.use({
  viewport: { width: 390, height: 844 },
});

test.describe("Fix 2 — Home screen (no draft/squad tabs)", () => {
  test("home screen — matches only, no draft tabs", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(8000);
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/fix2-home-no-draft-tabs.png`,
      fullPage: false,
    });
  });

  test("home screen — tournament filter active", async ({ page }) => {
    await page.goto("/");
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
    await page.goto("/");
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
    await page.goto(`/tournament/${tournamentName}`);
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
    await page.goto(`/tournament/${tournamentName}`);
    await page.waitForTimeout(8000);
    await forceClickTab(page, "standings");
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/fix1-tournament-standings.png`,
      fullPage: false,
    });
  });

  test("women's tournament — correct team filtering", async ({ page }) => {
    const tournamentName = encodeURIComponent("Women's Asia Cup Rising Stars 2026");
    await page.goto(`/tournament/${tournamentName}`);
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
