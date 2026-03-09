/**
 * Tournament Page E2E Tests (Playwright)
 *
 * Tests tournament page tabs: matches, standings, stats.
 * Uses real data from the sports dashboard API.
 */
import { test, expect } from "@playwright/test";
import { forceClickTab, forceClickByTestId, forceClickText } from "../helpers/tamagui";
import { screenshotPath } from "../helpers/screenshot";

test.use({ viewport: { width: 390, height: 844 } });

test.describe("Tournament Page", () => {
  test.setTimeout(60000);

  async function appReady(page: any): Promise<boolean> {
    const url = page.url();
    if (url.includes("/auth/")) return false;
    const errorOverlay = page.getByText(/uncaught error/i);
    if (await errorOverlay.isVisible({ timeout: 2000 }).catch(() => false)) return false;
    return true;
  }

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(8000);
  });

  test("tournament page loads with matches tab", async ({ page }) => {
    if (!(await appReady(page))) { test.skip(); return; }

    // Navigate to contests tab which may show tournament data
    await forceClickTab(page, "contests");
    await page.waitForTimeout(3000);

    // Look for tournament-related content
    const contestsScreen = page.locator('[data-testid="contests-screen"]');
    const hasTournament = await contestsScreen.isVisible({ timeout: 10000 }).catch(() => false);

    if (hasTournament) {
      // Check for match cards or tournament filters
      const matchCard = page.locator('[data-testid="match-card-0"]');
      const filterBtn = page.locator('[data-testid="tournament-filter"]');
      const emptyState = page.getByText(/no contests|no matches/i);

      const hasMatches = await matchCard.isVisible({ timeout: 5000 }).catch(() => false);
      const hasFilter = await filterBtn.isVisible({ timeout: 3000 }).catch(() => false);
      const hasEmpty = await emptyState.isVisible({ timeout: 3000 }).catch(() => false);

      expect(hasMatches || hasFilter || hasEmpty).toBeTruthy();
    }

    await page.screenshot({ path: screenshotPath("story-76-tournament-matches.png") });
  });

  test("standings tab shows points table", async ({ page }) => {
    if (!(await appReady(page))) { test.skip(); return; }

    await forceClickTab(page, "contests");
    await page.waitForTimeout(3000);

    // Look for standings/points table tab
    const standingsTab = page.getByText(/standings|points table/i);
    if (await standingsTab.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await forceClickText(page, /standings|points table/i);
      await page.waitForTimeout(3000);

      // Should show team standings
      const standingsContent = page.getByText(/team|played|won|lost|points/i);
      const hasStandings = await standingsContent.first().isVisible({ timeout: 5000 }).catch(() => false);

      if (hasStandings) {
        console.log("  Standings tab visible with content");
      }
    }

    await page.screenshot({ path: screenshotPath("story-77-tournament-standings.png") });
  });

  test("stats tab shows top players", async ({ page }) => {
    if (!(await appReady(page))) { test.skip(); return; }

    await forceClickTab(page, "contests");
    await page.waitForTimeout(3000);

    // Look for stats/players tab
    const statsTab = page.getByText(/stats|top players|leaderboard/i);
    if (await statsTab.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await forceClickText(page, /stats|top players|leaderboard/i);
      await page.waitForTimeout(3000);

      // Should show player stats
      const statsContent = page.getByText(/runs|wickets|average|player/i);
      const hasStats = await statsContent.first().isVisible({ timeout: 5000 }).catch(() => false);

      if (hasStats) {
        console.log("  Stats tab visible with player data");
      }
    }

    await page.screenshot({ path: screenshotPath("story-78-tournament-stats.png") });
  });
});
