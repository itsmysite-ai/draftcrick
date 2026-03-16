/**
 * Chapter 15: Match Center — Deep Screenshot QA
 *
 * Comprehensive screenshot coverage of the Match Center page.
 * Captures EVERY section individually with expanded AI content.
 * Navigates into sub-pages (compare, solver) for full coverage.
 *
 * User is subscribed to Elite tier so all features are visible/unlocked.
 * Uses JS-based scrolling (scrollIntoView) instead of keyboard PageDown.
 * Waits for AI spinners to finish before taking screenshots.
 *
 * Run: npx playwright test tests/e2e/cricket-story/15-match-center.spec.ts --project=mobile --workers=1
 */
import { test, expect, type Page } from "@playwright/test";
import {
  clearEmulatorAccounts,
  loginViaBrowser,
  trpcAuthQuery,
  trpcAuthMutate,
  unwrap,
} from "../helpers/hybrid-seed";
import { createTestUser } from "../helpers/api-auth";
import { forceClickByTestId } from "../helpers/tamagui";
import { screenshotPath } from "../helpers/screenshot";

const ss = (name: string) => screenshotPath(name);

test.use({ viewport: { width: 390, height: 844 } });
test.describe.configure({ mode: "serial" });

const TS = Date.now();
const RAVI_EMAIL = `ravi-mc-${TS}@draftplay.test`;
const PASSWORD = "CricketFan123!";

/** Scroll to element using JS scrollIntoView — works with RN ScrollView on web */
async function scrollTo(page: Page, testId: string): Promise<boolean> {
  const el = page.locator(`[data-testid="${testId}"]`);
  const visible = await el.isVisible({ timeout: 3000 }).catch(() => false);
  if (!visible) return false;
  await el.evaluate((node) => node.scrollIntoView({ behavior: "smooth", block: "center" }));
  await page.waitForTimeout(600);
  return true;
}

/**
 * Wait for AI loading spinners to disappear after expanding a card.
 * Polls for up to maxWait ms checking if any spinner/loading text is visible.
 */
async function waitForAIContent(page: Page, maxWait = 15000): Promise<void> {
  const start = Date.now();
  // Wait a beat for the expand animation + spinner to appear
  await page.waitForTimeout(800);
  // Poll until no spinners visible
  while (Date.now() - start < maxWait) {
    const spinnerVisible = await page.locator('text=/analyzing|loading|predicting|checking|finding/i')
      .first().isVisible({ timeout: 500 }).catch(() => false);
    if (!spinnerVisible) return;
    await page.waitForTimeout(500);
  }
}

test.describe("Chapter 15 — Match Center Deep QA", () => {
  test.setTimeout(180000);

  let raviToken: string;
  let matchId: string;

  test.beforeAll(async () => {
    await clearEmulatorAccounts();
    const ravi = await createTestUser(RAVI_EMAIL, PASSWORD);
    raviToken = ravi.idToken;

    // Subscribe user to Elite tier so all features are unlocked
    await trpcAuthMutate("subscription.subscribe", { tier: "elite" }, raviToken);

    // Find an active match with draft enabled
    const matchRes = await trpcAuthQuery("match.live", undefined, raviToken);
    const matchData = unwrap(matchRes);
    const matches = Array.isArray(matchData) ? matchData : matchData?.matches ?? [];
    if (matches.length > 0) {
      const draftMatch = matches.find((m: any) => m.draftEnabled);
      matchId = (draftMatch ?? matches[0]).id ?? (draftMatch ?? matches[0]).dbId;
    }
  });

  // ─── 15.1-15.4: Header, CTA, Contests, FDR ───
  test("15.1-15.4 — header, CTA, contests, FDR breakdown", async ({ page }) => {
    if (!matchId) { test.skip(); return; }

    const loggedIn = await loginViaBrowser(page, RAVI_EMAIL, PASSWORD, `/match/${matchId}`);
    if (!loggedIn) { test.skip(); return; }

    await page.locator('[data-testid="match-detail-screen"]').waitFor({ state: "visible", timeout: 15000 });
    await page.waitForTimeout(4000);

    // 15.1 — Header card (team avatars, FDR badges, date/venue)
    const headerCard = page.locator('[data-testid="match-header-card"]');
    await expect(headerCard).toBeVisible({ timeout: 5000 });
    await headerCard.screenshot({ path: ss("15.1-header-card.png") });

    // 15.2 — Full above-the-fold view
    await page.screenshot({ path: ss("15.2-above-fold.png") });

    // 15.3 — Contests section
    const contest0 = page.locator('[data-testid="contest-0"]');
    const hasContest = await contest0.isVisible({ timeout: 3000 }).catch(() => false);
    if (hasContest) {
      await contest0.evaluate((node) => node.scrollIntoView({ behavior: "smooth", block: "center" }));
      await page.waitForTimeout(500);
    }
    await page.screenshot({ path: ss("15.3-contests.png") });

    // 15.4 — FDR breakdown card
    const hasFdr = await scrollTo(page, "fdr-card");
    if (hasFdr) {
      const fdrCard = page.locator('[data-testid="fdr-card"]');
      await fdrCard.screenshot({ path: ss("15.4-fdr-breakdown.png") });
    }
    await page.screenshot({ path: ss("15.4-fdr-viewport.png") });
  });

  // ─── 15.5-15.6: AI Tools — Guru + Projections ───
  test("15.5-15.6 — cricket guru + projected points", async ({ page }) => {
    if (!matchId) { test.skip(); return; }

    const loggedIn = await loginViaBrowser(page, RAVI_EMAIL, PASSWORD, `/match/${matchId}`);
    if (!loggedIn) { test.skip(); return; }

    await page.locator('[data-testid="match-detail-screen"]').waitFor({ state: "visible", timeout: 15000 });
    await page.waitForTimeout(3000);

    // 15.5 — Cricket Guru card (collapsed)
    const hasGuru = await scrollTo(page, "guru-card");
    if (hasGuru) {
      const guruCard = page.locator('[data-testid="guru-card"]');
      await guruCard.screenshot({ path: ss("15.5-guru-card.png") });
    }
    await page.screenshot({ path: ss("15.5-guru-viewport.png") });

    // 15.6a — Projections card (collapsed)
    const hasProj = await scrollTo(page, "projections-card");
    if (hasProj) {
      const projCard = page.locator('[data-testid="projections-card"]');
      await projCard.screenshot({ path: ss("15.6a-projections-collapsed.png") });
    }

    // 15.6b — Projections expanded (click to load AI data, wait for spinner)
    if (hasProj) {
      await forceClickByTestId(page, "projections-card");
      await waitForAIContent(page);
      await scrollTo(page, "projections-card");
      await page.screenshot({ path: ss("15.6b-projections-expanded.png") });
    }
  });

  // ─── 15.7: AI Insights — H2H, Captain Picks, Differentials ───
  test("15.7 — AI insights: H2H, captain picks, differentials", async ({ page }) => {
    if (!matchId) { test.skip(); return; }

    const loggedIn = await loginViaBrowser(page, RAVI_EMAIL, PASSWORD, `/match/${matchId}`);
    if (!loggedIn) { test.skip(); return; }

    await page.locator('[data-testid="match-detail-screen"]').waitFor({ state: "visible", timeout: 15000 });
    await page.waitForTimeout(3000);

    // 15.7a — AI Insights section header
    await scrollTo(page, "ai-insights-header");
    await page.screenshot({ path: ss("15.7a-ai-insights-header.png") });

    // 15.7b — Head to Head (collapsed)
    const hasH2H = await scrollTo(page, "h2h-card");
    if (hasH2H) {
      const h2hCard = page.locator('[data-testid="h2h-card"]');
      await h2hCard.screenshot({ path: ss("15.7b-h2h-collapsed.png") });

      // 15.7c — H2H expanded (wait for AI)
      await forceClickByTestId(page, "h2h-card");
      await waitForAIContent(page);
      await scrollTo(page, "h2h-card");
      await page.screenshot({ path: ss("15.7c-h2h-expanded.png") });
    }

    // 15.7d — Captain Picks (collapsed)
    const hasCaptain = await scrollTo(page, "captain-picks-card");
    if (hasCaptain) {
      const cpCard = page.locator('[data-testid="captain-picks-card"]');
      await cpCard.screenshot({ path: ss("15.7d-captain-picks-collapsed.png") });

      // 15.7e — Captain Picks expanded (wait for AI)
      await forceClickByTestId(page, "captain-picks-card");
      await waitForAIContent(page);
      await scrollTo(page, "captain-picks-card");
      await page.screenshot({ path: ss("15.7e-captain-picks-expanded.png") });
    }

    // 15.7f — Differentials (collapsed)
    const hasDiff = await scrollTo(page, "differentials-card");
    if (hasDiff) {
      const diffCard = page.locator('[data-testid="differentials-card"]');
      await diffCard.screenshot({ path: ss("15.7f-differentials-collapsed.png") });

      // 15.7g — Differentials expanded (wait for AI)
      await forceClickByTestId(page, "differentials-card");
      await waitForAIContent(page);
      await scrollTo(page, "differentials-card");
      await page.screenshot({ path: ss("15.7g-differentials-expanded.png") });
    }
  });

  // ─── 15.8: AI Insights — Playing XI, Weather & Pitch ───
  test("15.8 — AI insights: playing XI, weather & pitch", async ({ page }) => {
    if (!matchId) { test.skip(); return; }

    const loggedIn = await loginViaBrowser(page, RAVI_EMAIL, PASSWORD, `/match/${matchId}`);
    if (!loggedIn) { test.skip(); return; }

    await page.locator('[data-testid="match-detail-screen"]').waitFor({ state: "visible", timeout: 15000 });
    await page.waitForTimeout(3000);

    // 15.8a — Playing XI Prediction (collapsed)
    const hasXI = await scrollTo(page, "playing-xi-card");
    if (hasXI) {
      const xiCard = page.locator('[data-testid="playing-xi-card"]');
      await xiCard.screenshot({ path: ss("15.8a-playing-xi-collapsed.png") });

      // 15.8b — Playing XI expanded (wait for AI)
      await forceClickByTestId(page, "playing-xi-card");
      await waitForAIContent(page);
      await scrollTo(page, "playing-xi-card");
      await page.screenshot({ path: ss("15.8b-playing-xi-expanded.png") });
    }

    // 15.8c — Weather & Pitch (collapsed)
    const hasWeather = await scrollTo(page, "weather-pitch-card");
    if (hasWeather) {
      const wCard = page.locator('[data-testid="weather-pitch-card"]');
      await wCard.screenshot({ path: ss("15.8c-weather-pitch-collapsed.png") });

      // 15.8d — Weather & Pitch expanded (wait for AI)
      await forceClickByTestId(page, "weather-pitch-card");
      await waitForAIContent(page);
      await scrollTo(page, "weather-pitch-card");
      await page.screenshot({ path: ss("15.8d-weather-pitch-expanded.png") });
    }
  });

  // ─── 15.9: Stats — Player Stats + Navigate into Compare & Solver pages ───
  test("15.9 — stats: player stats, compare page, solver page", async ({ page }) => {
    if (!matchId) { test.skip(); return; }

    const loggedIn = await loginViaBrowser(page, RAVI_EMAIL, PASSWORD, `/match/${matchId}`);
    if (!loggedIn) { test.skip(); return; }

    await page.locator('[data-testid="match-detail-screen"]').waitFor({ state: "visible", timeout: 15000 });
    await page.waitForTimeout(3000);

    // 15.9a — Stats & Analytics section header
    await scrollTo(page, "stats-analytics-header");
    await page.screenshot({ path: ss("15.9a-stats-header.png") });

    // 15.9b — Player Stats (collapsed)
    const hasStats = await scrollTo(page, "player-stats-card");
    if (hasStats) {
      const statsCard = page.locator('[data-testid="player-stats-card"]');
      await statsCard.screenshot({ path: ss("15.9b-player-stats-collapsed.png") });

      // 15.9c — Player Stats expanded (wait for data)
      await forceClickByTestId(page, "player-stats-card");
      await waitForAIContent(page);
      await scrollTo(page, "player-stats-card");
      await page.screenshot({ path: ss("15.9c-player-stats-expanded.png") });
    }

    // 15.9d — Compare Players card on match center
    const hasCompare = await scrollTo(page, "compare-players-card");
    if (hasCompare) {
      const compareCard = page.locator('[data-testid="compare-players-card"]');
      await compareCard.screenshot({ path: ss("15.9d-compare-card.png") });

      // 15.9e — Click into Compare Players page
      await forceClickByTestId(page, "compare-players-card");
      const compareScreen = page.locator('[data-testid="compare-screen"]');
      const onCompare = await compareScreen.isVisible({ timeout: 8000 }).catch(() => false);
      if (onCompare) {
        await page.waitForTimeout(2000); // Wait for players to load
        await page.screenshot({ path: ss("15.9e-compare-page.png") });
        await page.screenshot({ path: ss("15.9e-compare-page-full.png"), fullPage: true });
      }
      // Navigate back to match center
      await page.goBack();
      await page.locator('[data-testid="match-detail-screen"]').waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(2000);
    }

    // 15.9f — Team Solver card on match center
    const hasSolver = await scrollTo(page, "team-solver-card");
    if (hasSolver) {
      const solverCard = page.locator('[data-testid="team-solver-card"]');
      await solverCard.screenshot({ path: ss("15.9f-solver-card.png") });

      // 15.9g — Click into Team Solver page
      await forceClickByTestId(page, "team-solver-card");
      const solverScreen = page.locator('[data-testid="solver-screen"]');
      const onSolver = await solverScreen.isVisible({ timeout: 8000 }).catch(() => false);
      if (onSolver) {
        await page.waitForTimeout(2000); // Wait for page load
        await page.screenshot({ path: ss("15.9g-solver-page.png") });
        await page.screenshot({ path: ss("15.9g-solver-page-full.png"), fullPage: true });
      }
      // Navigate back
      await page.goBack();
      await page.locator('[data-testid="match-detail-screen"]').waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
    }
  });

  // ─── 15.10: Value Tracker, Stat Top Fives, Tournament Footer, Full Page ───
  test("15.10 — value tracker, top fives, tournament footer + full page", async ({ page }) => {
    if (!matchId) { test.skip(); return; }

    const loggedIn = await loginViaBrowser(page, RAVI_EMAIL, PASSWORD, `/match/${matchId}`);
    if (!loggedIn) { test.skip(); return; }

    await page.locator('[data-testid="match-detail-screen"]').waitFor({ state: "visible", timeout: 15000 });
    await page.waitForTimeout(3000);

    // 15.10a — Value Tracker (collapsed)
    const hasVT = await scrollTo(page, "value-tracker-card");
    if (hasVT) {
      const vtCard = page.locator('[data-testid="value-tracker-card"]');
      await vtCard.screenshot({ path: ss("15.10a-value-tracker-collapsed.png") });

      // 15.10b — Value Tracker expanded (wait for data)
      await forceClickByTestId(page, "value-tracker-card");
      await waitForAIContent(page);
      await scrollTo(page, "value-tracker-card");
      await page.screenshot({ path: ss("15.10b-value-tracker-expanded.png") });
    }

    // 15.10c — Stat Top Fives (collapsed)
    const hasTopFives = await scrollTo(page, "stat-top-fives-card");
    if (hasTopFives) {
      const topFivesCard = page.locator('[data-testid="stat-top-fives-card"]');
      await topFivesCard.screenshot({ path: ss("15.10c-stat-top-fives-collapsed.png") });

      // 15.10d — Stat Top Fives expanded (wait for data)
      await forceClickByTestId(page, "stat-top-fives-card");
      await waitForAIContent(page);
      await scrollTo(page, "stat-top-fives-card");
      await page.screenshot({ path: ss("15.10d-stat-top-fives-expanded.png") });
    }

    // 15.10e — Tournament footer
    const hasTournament = await scrollTo(page, "tournament-footer-card");
    if (hasTournament) {
      const tournamentCard = page.locator('[data-testid="tournament-footer-card"]');
      await tournamentCard.screenshot({ path: ss("15.10e-tournament-footer.png") });
    }

    // 15.10f — Full page capture
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);
    await page.screenshot({ path: ss("15.10f-full-page.png"), fullPage: true });
  });
});
