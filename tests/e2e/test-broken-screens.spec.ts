import { test } from "@playwright/test";

test("Screenshot broken screens", async ({ page }) => {
  // Login first
  await page.goto("http://localhost:8081");
  await page.waitForTimeout(3000);

  // Fill login
  const emailInput = page.locator('input[placeholder="email"]').first();
  const passwordInput = page.locator('input[placeholder="password"]').first();

  if (await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await emailInput.fill("testuser@draftplay.test");
    await passwordInput.fill("Test123!");

    // Click sign in
    const signInBtn = page.getByText("sign in").first();
    await signInBtn.click();
    await page.waitForTimeout(4000);
  }

  // Screenshot home tab
  await page.screenshot({ path: "/Users/chandanreddy/Documents/draftcrick/screenshots/debug-home.png", fullPage: true });

  // Navigate to wallet
  const walletTab = page.getByText("wallet").first();
  if (await walletTab.isVisible({ timeout: 2000 }).catch(() => false)) {
    await walletTab.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "/Users/chandanreddy/Documents/draftcrick/screenshots/debug-wallet.png", fullPage: true });
  }

  // Navigate to live tab
  const liveTab = page.getByText("live").first();
  if (await liveTab.isVisible({ timeout: 2000 }).catch(() => false)) {
    await liveTab.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "/Users/chandanreddy/Documents/draftcrick/screenshots/debug-live.png", fullPage: true });
  }

  // Navigate to contests tab
  const contestsTab = page.getByText("contests").first();
  if (await contestsTab.isVisible({ timeout: 2000 }).catch(() => false)) {
    await contestsTab.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "/Users/chandanreddy/Documents/draftcrick/screenshots/debug-contests.png", fullPage: true });
  }
});
