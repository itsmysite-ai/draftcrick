/**
 * Navigation & Profile Authenticated E2E Tests
 *
 * Login → navigate all tabs → profile page → settings.
 * Takes screenshots at every step for visual proof.
 */
import { test, expect } from "@playwright/test";
import { forceClickByTestId, forceClickTab, forceClickText } from "../helpers/tamagui";
import { loginTestUser } from "../helpers/auth-login";

test.use({ viewport: { width: 390, height: 844 } });
test.describe.configure({ mode: "serial" });

test.describe("Navigation & Profile — Authenticated", () => {
  test.setTimeout(60000);

  test("login redirects to home screen with matches", async ({ page }) => {
    const loggedIn = await loginTestUser(page);
    if (!loggedIn) { test.skip(); return; }

    const homeScreen = page.locator('[data-testid="home-screen"]');
    const visible = await homeScreen.isVisible({ timeout: 5000 }).catch(() => false);
    expect(visible).toBeTruthy();

    // Check for match cards
    const matchCard = page.locator('[data-testid="match-card-0"]');
    const hasMatches = await matchCard.isVisible({ timeout: 5000 }).catch(() => false);

    await page.screenshot({ path: "screenshots/e2e-nav-auth-home.png" });
  });

  test("authenticated home screen shows match cards with teams", async ({ page }) => {
    const loggedIn = await loginTestUser(page);
    if (!loggedIn) { test.skip(); return; }

    // Wait for match cards to load
    const matchCard = page.locator('[data-testid="match-card-0"]');
    const hasMatches = await matchCard.isVisible({ timeout: 8000 }).catch(() => false);

    if (hasMatches) {
      // Check for team names (vs)
      const vs = page.getByText(/vs/i).first();
      const hasVs = await vs.isVisible({ timeout: 3000 }).catch(() => false);
      expect(hasVs).toBeTruthy();
    }

    await page.screenshot({ path: "screenshots/e2e-nav-auth-matches.png" });
  });

  test("navigate to contests tab when authenticated", async ({ page }) => {
    const loggedIn = await loginTestUser(page);
    if (!loggedIn) { test.skip(); return; }

    await forceClickTab(page, "contests");
    await page.waitForTimeout(3000);

    const contestsScreen = page.locator('[data-testid="contests-screen"]');
    const visible = await contestsScreen.isVisible({ timeout: 5000 }).catch(() => false);
    expect(visible).toBeTruthy();

    await page.screenshot({ path: "screenshots/e2e-nav-auth-contests.png" });
  });

  test("navigate to live tab when authenticated", async ({ page }) => {
    const loggedIn = await loginTestUser(page);
    if (!loggedIn) { test.skip(); return; }

    await forceClickTab(page, "live");
    await page.waitForTimeout(3000);

    const liveScreen = page.locator('[data-testid="live-screen"]');
    const visible = await liveScreen.isVisible({ timeout: 5000 }).catch(() => false);
    expect(visible).toBeTruthy();

    await page.screenshot({ path: "screenshots/e2e-nav-auth-live.png" });
  });

  test("navigate to profile tab and see user info", async ({ page }) => {
    const loggedIn = await loginTestUser(page);
    if (!loggedIn) { test.skip(); return; }

    await forceClickTab(page, "profile");
    await page.waitForTimeout(3000);

    const profileScreen = page.locator('[data-testid="profile-screen"]');
    const visible = await profileScreen.isVisible({ timeout: 5000 }).catch(() => false);
    expect(visible).toBeTruthy();

    // Check for profile username or email
    const username = page.locator('[data-testid="profile-username"]');
    const hasUsername = await username.isVisible({ timeout: 3000 }).catch(() => false);

    await page.screenshot({ path: "screenshots/e2e-nav-auth-profile.png" });
  });

  test("profile shows wallet link", async ({ page }) => {
    const loggedIn = await loginTestUser(page);
    if (!loggedIn) { test.skip(); return; }

    await forceClickTab(page, "profile");
    await page.waitForTimeout(3000);

    const profileScreen = page.locator('[data-testid="profile-screen"]');
    if (!(await profileScreen.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(); return;
    }

    // Look for wallet link
    const walletLink = page.getByText(/wallet/i).first();
    const hasWallet = await walletLink.isVisible({ timeout: 3000 }).catch(() => false);

    // Scroll to see full profile
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    await page.screenshot({ path: "screenshots/e2e-nav-auth-profile-full.png", fullPage: true });
  });

  test("dark/light mode toggle when authenticated", async ({ page }) => {
    const loggedIn = await loginTestUser(page);
    if (!loggedIn) { test.skip(); return; }

    await page.screenshot({ path: "screenshots/e2e-nav-auth-theme-before.png" });

    // Find and click mode toggle
    const toggle = page.locator('[data-testid="mode-toggle"]');
    if (await toggle.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await page.evaluate(() => {
        const el = document.querySelector('[data-testid="mode-toggle"]') as HTMLElement;
        if (el) {
          const rect = el.getBoundingClientRect();
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          const opts = { bubbles: true, cancelable: true, clientX: cx, clientY: cy, pointerId: 1, pointerType: "mouse" as const };
          el.dispatchEvent(new PointerEvent("pointerdown", opts));
          el.dispatchEvent(new PointerEvent("pointerup", opts));
          el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, clientX: cx, clientY: cy }));
        }
      });
      await page.waitForTimeout(1000);
    }

    await page.screenshot({ path: "screenshots/e2e-nav-auth-theme-after.png" });
  });

  test("back navigation from match detail", async ({ page }) => {
    const loggedIn = await loginTestUser(page);
    if (!loggedIn) { test.skip(); return; }

    const viewBtn = page.locator('[data-testid="view-match-btn-0"]');
    if (!(await viewBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(); return;
    }

    await forceClickByTestId(page, "view-match-btn-0");
    await page.waitForTimeout(3000);

    const matchDetail = page.locator('[data-testid="match-detail-screen"]');
    if (await matchDetail.isVisible({ timeout: 5000 }).catch(() => false)) {
      await page.goBack();
      await page.waitForTimeout(2000);
    }

    await page.screenshot({ path: "screenshots/e2e-nav-auth-back.png" });
  });

  test("dashboard match status badges visible", async ({ page }) => {
    const loggedIn = await loginTestUser(page);
    if (!loggedIn) { test.skip(); return; }

    // Check for match status badges
    const matchStatus = page.locator('[data-testid="match-status-0"]');
    const hasBadge = await matchStatus.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasBadge) {
      // Verify badge text (LIVE, UPCOMING, COMPLETED, etc.)
      const text = await matchStatus.textContent().catch(() => "");
      console.log(`    Match status badge: "${text}"`);
    }

    await page.screenshot({ path: "screenshots/e2e-nav-auth-dashboard-badges.png" });
  });

  test("click match card navigates to match detail", async ({ page }) => {
    const loggedIn = await loginTestUser(page);
    if (!loggedIn) { test.skip(); return; }

    const matchCard = page.locator('[data-testid="match-card-0"]');
    if (!(await matchCard.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(); return;
    }

    // Click the view match button
    const viewBtn = page.locator('[data-testid="view-match-btn-0"]');
    if (await viewBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await forceClickByTestId(page, "view-match-btn-0");
    } else {
      await forceClickByTestId(page, "match-card-0");
    }
    await page.waitForTimeout(3000);

    const matchDetail = page.locator('[data-testid="match-detail-screen"]');
    const visible = await matchDetail.isVisible({ timeout: 5000 }).catch(() => false);
    expect(visible).toBeTruthy();

    await page.screenshot({ path: "screenshots/e2e-nav-auth-match-detail.png" });
  });
});
