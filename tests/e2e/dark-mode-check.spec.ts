import { test } from "@playwright/test";

test("dark-mode-fix: F1 dark mode tabs + join league", async ({ page }) => {
  await page.goto("http://localhost:8081");
  await page.waitForTimeout(3000);

  // Login
  const emailInput = page.locator('input[type="text"], input[placeholder*="email"]').first();
  const passInput = page.locator('input[type="password"], input[placeholder*="password"]').first();

  if (await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await emailInput.fill("indnz-u1-1773022797056@test.com");
    await passInput.fill("TestPass123!");
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('[role="button"], button'));
      const signIn = btns.find(b => b.textContent?.toLowerCase().includes('sign in'));
      if (signIn) signIn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await page.waitForTimeout(5000);
  }

  // Switch to F1
  await page.evaluate(() => {
    const trigger = document.querySelector('[data-testid="sport-dropdown-trigger"]');
    if (trigger) {
      trigger.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      trigger.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }
  });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    const f1 = document.querySelector('[data-testid="sport-option-f1"]');
    if (f1) f1.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForTimeout(1500);

  // Switch to dark mode
  await page.evaluate(() => {
    const toggles = document.querySelectorAll('[role="button"], [data-testid*="mode"]');
    toggles.forEach(t => {
      if (t.textContent?.includes('\u2600\uFE0F') || t.textContent?.includes('\uD83C\uDF19')) {
        t.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }
    });
  });
  await page.waitForTimeout(1500);

  // Screenshot F1 dark home
  await page.screenshot({ path: "screenshots/f1-dark-fix-home.png", fullPage: true });

  // Navigate to join league
  await page.goto("http://localhost:8081/league/join");
  await page.waitForTimeout(3000);
  await page.screenshot({ path: "screenshots/f1-dark-fix-join-league.png", fullPage: true });
});
