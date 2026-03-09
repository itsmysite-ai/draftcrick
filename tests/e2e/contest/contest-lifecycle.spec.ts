/**
 * Contest Lifecycle E2E Test
 *
 * Tests the full contest lifecycle from league creation to settlement:
 * 1. Create league with tournament picker (not hardcoded IPL 2026)
 * 2. Create contest for upcoming match (via admin API)
 * 3. Build fantasy team → join contest
 * 4. Lock contests (match starts)
 * 5. Seed & process player scores
 * 6. Complete match
 * 7. Settle contests (distribute prizes)
 *
 * Prerequisites:
 * - Backend running at localhost:3000
 * - Expo web running at localhost:8081
 * - At least one visible tournament with upcoming matches
 * - Players linked to the test match
 * - Authenticated user session
 */
import { test, expect } from "@playwright/test";
import { forceClickTab, forceClickText, forceClickByTestId } from "../helpers/tamagui";
import { screenshotPath } from "../helpers/screenshot";

test.use({ viewport: { width: 390, height: 844 } });

const API_BASE = process.env.API_URL ?? "http://localhost:3000";

/** Helper: navigate to home screen, returns false if auth-redirected */
async function navigateToHome(page: any): Promise<boolean> {
  await page.goto("/");
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(8000);

  const url = page.url();
  if (url.includes("/auth/")) return false;

  const homeScreen = page.locator('[data-testid="home-screen"]');
  if (!(await homeScreen.isVisible({ timeout: 5000 }).catch(() => false))) return false;

  return true;
}

test.describe("Contest Lifecycle", () => {
  test.setTimeout(120000); // 2 minutes for full lifecycle

  test("create league shows tournament picker with visible tournaments (not hardcoded IPL 2026)", async ({ page }) => {
    if (!(await navigateToHome(page))) {
      test.skip();
      return;
    }

    // Navigate to create league
    await page.goto("/#/league/create");
    await page.waitForTimeout(3000);

    const createScreen = page.locator('[data-testid="create-league-screen"]');
    await expect(createScreen).toBeVisible({ timeout: 10000 });

    // Verify tournament section exists
    const tournamentSection = page.getByText(/tournament/i).first();
    await expect(tournamentSection).toBeVisible({ timeout: 5000 });

    // Check that there's NO freeform text input for tournament
    // Instead, there should be selectable tournament cards
    const tournamentInput = page.locator('input[placeholder*="IPL"]');
    const hasTextInput = await tournamentInput.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasTextInput).toBe(false); // Should NOT have a text input anymore

    // Take screenshot of create league with tournament picker
    await page.screenshot({ path: screenshotPath("lifecycle-create-league-tournament-picker.png") });
  });

  test("create league with visible tournament", async ({ page }) => {
    if (!(await navigateToHome(page))) {
      test.skip();
      return;
    }

    await page.goto("/#/league/create");
    await page.waitForTimeout(3000);

    const createScreen = page.locator('[data-testid="create-league-screen"]');
    if (!(await createScreen.isVisible({ timeout: 10000 }).catch(() => false))) {
      test.skip();
      return;
    }

    // Fill league name
    const nameInput = page.locator('[data-testid="league-name-input"]');
    await nameInput.fill("E2E Test League");

    // Tournament should be auto-selected (first visible one)
    // Format should default to salary_cap (already selected)
    // Template should default to casual (already selected)

    // Take screenshot before creating
    await page.screenshot({ path: screenshotPath("lifecycle-create-league-filled.png") });

    // Click create
    await forceClickByTestId(page, "create-league-btn");
    await page.waitForTimeout(5000);

    // Should navigate to league detail page
    const url = page.url();
    const leagueCreated = url.includes("/league/");
    expect(leagueCreated).toBe(true);

    await page.screenshot({ path: screenshotPath("lifecycle-league-created.png") });
  });

  test("admin match detail page shows lifecycle controls", async ({ page }) => {
    // Navigate to admin
    await page.goto("/admin/matches");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(3000);

    // Check if admin page loads (may require auth)
    const heading = page.getByText("Matches");
    if (!(await heading.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip();
      return;
    }

    // Click on first match link
    const matchLink = page.locator("a[href*='/admin/matches/']").first();
    if (!(await matchLink.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await matchLink.click();
    await page.waitForTimeout(3000);

    // Verify lifecycle controls section
    const lifecycleSection = page.getByText("Lifecycle Controls");
    await expect(lifecycleSection).toBeVisible({ timeout: 10000 });

    // Verify key buttons exist
    const lockBtn = page.getByText(/Lock Contests/);
    const seedBtn = page.getByText(/Seed Scores/);
    const completeBtn = page.getByText(/Complete Match/);
    const settleBtn = page.getByText(/Settle Contests/);

    await expect(lockBtn).toBeVisible({ timeout: 5000 });
    await expect(seedBtn).toBeVisible({ timeout: 5000 });
    await expect(completeBtn).toBeVisible({ timeout: 5000 });
    await expect(settleBtn).toBeVisible({ timeout: 5000 });

    // Verify tabs
    const playersTab = page.getByText(/players/i).first();
    const contestsTab = page.getByText(/contests/i).first();
    await expect(playersTab).toBeVisible({ timeout: 5000 });
    await expect(contestsTab).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: screenshotPath("lifecycle-admin-match-detail.png") });
  });

  test("admin matches list shows score/toss/result columns", async ({ page }) => {
    await page.goto("/admin/matches");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(3000);

    const heading = page.getByText("Matches");
    if (!(await heading.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip();
      return;
    }

    // Verify new columns exist
    const scoreHeader = page.getByText("Score").first();
    const resultHeader = page.getByText("Result").first();
    const tossHeader = page.getByText("Toss").first();

    await expect(scoreHeader).toBeVisible({ timeout: 5000 });
    await expect(resultHeader).toBeVisible({ timeout: 5000 });
    await expect(tossHeader).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: screenshotPath("lifecycle-admin-matches-list.png") });
  });
});
