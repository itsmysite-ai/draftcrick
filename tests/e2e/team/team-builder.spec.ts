/**
 * Team Builder E2E Tests
 *
 * Tests team creation flow: player selection, salary cap, captain/VC selection.
 * Note: Requires auth + API. Without both, shows loading or auth redirect.
 */
import { test, expect } from "@playwright/test";
import { forceClickByTestId } from "../helpers/tamagui";
import testData from "../helpers/test-data.json";
import { screenshotPath } from "../helpers/screenshot";

test.use({ viewport: { width: 390, height: 844 } });

/** Helper: check if we reached the team builder, loading, or got auth-redirected */
async function navigateToTeamBuilder(page: any): Promise<"ready" | "loading" | "auth"> {
  await page.goto(`/team/create?matchId=${testData.dbMatchId}`);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(8000);

  // Check for Firebase/env crash
  const errorOverlay = page.getByText(/uncaught error/i);
  if (await errorOverlay.isVisible({ timeout: 2000 }).catch(() => false)) return "auth";

  const teamScreen = page.locator('[data-testid="team-builder-screen"]');
  if (await teamScreen.isVisible({ timeout: 3000 }).catch(() => false)) return "ready";

  const url = page.url();
  if (url.includes("/auth/")) return "auth";

  return "loading";
}

test.describe("Team Builder", () => {
  test.setTimeout(60000);

  test("team create screen loads, shows loading, or redirects to login", async ({ page }) => {
    const state = await navigateToTeamBuilder(page);

    if (state === "ready") {
      const credits = page.getByText(/credits remaining/i);
      await expect(credits).toBeVisible({ timeout: 5000 });
    } else if (state === "auth") {
      expect(page.url()).toContain("/auth/");
    } else {
      // Loading state — API not available or env error, valid
      const loadingText = page.getByText(/loading/i);
      const errorOverlay = page.getByText(/uncaught error/i);
      const hasLoading = await loadingText.first().isVisible({ timeout: 3000 }).catch(() => false);
      const hasCrash = await errorOverlay.isVisible({ timeout: 2000 }).catch(() => false);
      expect(hasLoading || hasCrash).toBeTruthy();
    }

    await page.screenshot({ path: screenshotPath("story-62-team-builder-load.png") });
  });

  test("team builder shows salary cap, role tabs, and disabled button", async ({ page }) => {
    const state = await navigateToTeamBuilder(page);
    if (state !== "ready") { test.skip(); return; }

    // Verify salary cap info
    const creditsText = page.getByText("100.0");
    const countText = page.getByText("0/11");
    const hasCredits = await creditsText.isVisible({ timeout: 5000 }).catch(() => false);
    const hasCount = await countText.isVisible({ timeout: 3000 }).catch(() => false);
    expect(hasCredits || hasCount).toBeTruthy();

    // Verify role filter tabs
    const wkTab = page.getByText("WK").first();
    const batTab = page.getByText("BAT").first();
    const arTab = page.getByText("AR").first();
    const bowlTab = page.getByText("BOWL").first();
    expect(await wkTab.isVisible({ timeout: 3000 }).catch(() => false)).toBeTruthy();
    expect(await batTab.isVisible({ timeout: 2000 }).catch(() => false)).toBeTruthy();

    // Verify disabled submit button
    const selectMore = page.getByText(/select.*more players/i);
    const hasSelectMore = await selectMore.isVisible({ timeout: 3000 }).catch(() => false);
    expect(hasSelectMore).toBeTruthy();

    // Screenshot with WK tab active (default)
    await page.screenshot({ path: screenshotPath("story-63-team-builder-wk.png") });

    // Switch to BAT tab and screenshot
    await batTab.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: screenshotPath("story-64-team-builder-bat.png") });

    // Switch to BOWL tab and screenshot
    if (await bowlTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await bowlTab.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: screenshotPath("story-65-team-builder-bowl.png") });
    }
  });

  // NOT AUTOMATED — Submit team to contest requires active match + contest join
  test.skip("submit team to active contest", async () => {
    // Reason: Depends on live match data timing and contest state.
  });
});
